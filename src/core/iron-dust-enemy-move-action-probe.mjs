import {validateIronDustUnifiedStateProbe} from './iron-dust-unified-state-probe.mjs';
import {queryIronDustEnemyIntent} from './iron-dust-enemy-intent-probe.mjs';

export const IRON_DUST_ENEMY_MOVE_ACTION_VERSION = 'iron-dust-explicit-enemy-move-v1';
const actors = ['guard', 'raider'];
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const exact = (value, keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const deny = code => ({available: false, error: {code}});
const unit = (state, id) => state.units.find(item => item.id === id);

export function queryIronDustEnemyMoveAction(state, command) {
  validateIronDustUnifiedStateProbe(state);
  const hold = command?.type === 'EnemyHold';
  if (!exact(command, hold ? ['type', 'playerId', 'actorId'] :
    ['type', 'playerId', 'actorId', 'to']) ||
      !['EnemyMove', 'EnemyHold'].includes(command.type))
    return deny('ENEMY_MOVE_COMMAND_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (state.phase !== 'enemy') return deny('WRONG_PHASE');
  if (!actors.includes(command.actorId)) return deny('ENEMY_ACTOR_INVALID');
  const actor = unit(state, command.actorId);
  if (actor.hp <= 0 || actor.disabled) return deny('ENEMY_ACTOR_UNAVAILABLE');
  if (actor.moved || state.enemyPassed.includes(actor.id) ||
      state.firedActorIds.includes(actor.id)) return deny('ACTION_SPENT');
  const intent = queryIronDustEnemyIntent(state,
    {type: 'EnemyIntent', playerId: 'enemy', actorId: actor.id,
      stage: 'move', claim: 'auto'});
  if (!intent.available) return intent;
  if (hold ? intent.kind !== 'pass' || intent.reason !== 'HOLD' :
    intent.kind !== 'move') return deny('ENEMY_MOVE_INTENT_MISMATCH');
  if (!hold && (!exact(command.to, ['x', 'y']) ||
      command.to.x !== intent.to.x || command.to.y !== intent.to.y))
    return deny('ENEMY_MOVE_TARGET_MISMATCH');
  return {available: true, resolverVersion: IRON_DUST_ENEMY_MOVE_ACTION_VERSION,
    kind: hold ? 'hold' : 'move', actorId: actor.id,
    ...(hold ? {reason: 'HOLD'} : {targetId: intent.targetId,
      to: intent.to, cost: intent.cost, path: intent.path})};
}

export function preflightIronDustEnemyMoveAction(state, command) {
  return queryIronDustEnemyMoveAction(state, command);
}

export function dispatchIronDustEnemyMoveAction(state, command) {
  const query = queryIronDustEnemyMoveAction(state, command);
  if (!query.available) return {error: query.error};
  const next = clone(state), actor = unit(next, command.actorId);
  const from = {x: actor.x, y: actor.y};
  if (command.type === 'EnemyMove') {
    actor.x = query.to.x;
    actor.y = query.to.y;
  }
  // This records that Legacy's first-pass move/hold attempt is complete;
  // the read-only retry intent uses the existing moved flag as its gate.
  actor.moved = true;
  const event = command.type === 'EnemyMove'
    ? {type: 'EnemyMoved', actorId: actor.id, targetId: query.targetId,
      from, to: query.to, cost: query.cost, path: query.path, turn: next.turn}
    : {type: 'EnemyHeld', actorId: actor.id, at: from, reason: 'HOLD', turn: next.turn};
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events: [event]};
}
