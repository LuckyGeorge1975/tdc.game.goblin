import {validateIronDustUnifiedStateProbe} from './iron-dust-unified-state-probe.mjs';
import {ironDustEnemyMovementNodes, queryIronDustEnemyIntent} from './iron-dust-enemy-intent-probe.mjs?v=2';
import {inside, key} from './hex.mjs';

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

function queryMoveAction(state, command, policy, explicit) {
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
      stage: 'move', claim: 'auto'}, policy);
  if (!intent.available) return intent;
  if (explicit) {
    if (hold) return {available:true, resolverVersion:IRON_DUST_ENEMY_MOVE_ACTION_VERSION,
      kind:'hold',actorId:actor.id,reason:'HOLD'};
    if (!exact(command.to,['x','y']) || !inside(state.map,command.to) || key(command.to)===key(actor))
      return deny('ENEMY_MOVE_DESTINATION_INVALID');
    const node = reachableEnemyMoves(state,actor).get(key(command.to));
    return node ? explicitMove(actor.id,node,intent) : deny('ENEMY_MOVE_DESTINATION_UNREACHABLE');
  }
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

function reachableEnemyMoves(state, actor) {
  const best = new Map();
  for (const node of ironDustEnemyMovementNodes(state,actor)) {
    if (node.path.length && node.cost < (best.get(key(node))?.cost ?? Infinity)) best.set(key(node),node);
  }
  return best;
}

function explicitMove(actorId, node, automated) {
  const to={x:node.x,y:node.y};
  // Selecting the historical destination keeps its historical tie and receipt.
  const sameDestination=automated.kind==='move'&&key(automated.to)===key(to);
  return {available:true,resolverVersion:IRON_DUST_ENEMY_MOVE_ACTION_VERSION,
    kind:'move',actorId,targetId:automated.targetId??null,to,
    cost:sameDestination?automated.cost:node.cost,path:sameDestination?automated.path:node.path};
}

export function queryIronDustEnemyMoveAction(state, command, policy = null) {
  return queryMoveAction(state,command,policy,false);
}

export function queryIronDustEnemyExplicitMoveAction(state, command, policy = null) {
  return queryMoveAction(state,command,policy,true);
}

export function listIronDustEnemyExplicitMoves(state, actorId, automated) {
  const actor=unit(state,actorId);
  return [...reachableEnemyMoves(state,actor).values()].map(node=>explicitMove(actorId,node,automated));
}

export function preflightIronDustEnemyMoveAction(state, command, policy = null) {
  return queryIronDustEnemyMoveAction(state, command, policy);
}

export function dispatchIronDustEnemyMoveAction(state, command, policy = null) {
  return applyMoveAction(state,queryIronDustEnemyMoveAction(state,command,policy));
}

export function dispatchIronDustEnemyExplicitMoveAction(state, command, policy = null) {
  return applyMoveAction(state,queryIronDustEnemyExplicitMoveAction(state,command,policy));
}

function applyMoveAction(state, query) {
  if (!query.available) return {error: query.error};
  const next = clone(state), actor = unit(next, query.actorId);
  const from = {x: actor.x, y: actor.y};
  if (query.kind === 'move') {
    actor.x = query.to.x;
    actor.y = query.to.y;
  }
  // This records that Legacy's first-pass move/hold attempt is complete;
  // the read-only retry intent uses the existing moved flag as its gate.
  actor.moved = true;
  const event = query.kind === 'move'
    ? {type: 'EnemyMoved', actorId: actor.id, targetId: query.targetId,
      from, to: query.to, cost: query.cost, path: query.path, turn: next.turn}
    : {type: 'EnemyHeld', actorId: actor.id, at: from, reason: 'HOLD', turn: next.turn};
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events: [event]};
}
