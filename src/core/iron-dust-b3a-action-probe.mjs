import {IRON_DUST_NEAR_CORE_FIXTURE_VERSION, IRON_DUST_REST_OGRE_FIXTURE_VERSION,
  IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION,
  validateIronDustUnifiedStateProbe,
  queryIronDustFireGeometry} from './iron-dust-unified-state-probe.mjs';
import {queryIronDustB2Action, dispatchIronDustB2Action} from './iron-dust-b2-action-probe.mjs';

export const IRON_DUST_B3A_ACTION_VERSION = 'iron-dust-explicit-enemy-system-turn-v1';
const fixtures = ['source', 'adjacent', IRON_DUST_NEAR_CORE_FIXTURE_VERSION,
  IRON_DUST_REST_OGRE_FIXTURE_VERSION, 'boundary', IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION];
const actors = ['guard', 'raider'];
const crt = {
  '1-2': ['NE', 'NE', 'NE', 'NE', 'D', 'X'],
  '1-1': ['NE', 'NE', 'D', 'D', 'D', 'X'],
  '2-1': ['NE', 'D', 'D', 'X', 'X', 'X'],
  '3-1': ['D', 'D', 'X', 'X', 'X', 'X'],
  '4-1': ['D', 'X', 'X', 'X', 'X', 'X']
};
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const deny = code => ({available: false, error: {code}});
const exact = (value, keys) => value && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const unit = (state, id) => state.units.find(item => item.id === id);
const liveActors = state => actors.filter(id => unit(state, id).hp > 0);
const pending = state => liveActors(state).filter(id =>
  !state.enemyPassed.includes(id) && !state.firedActorIds.includes(id));
const remaining = weapon => Math.max(0, Math.min(weapon.remaining,
  weapon.count - weapon.destroyed));
const movement = treads => treads >= 31 ? 3 : treads >= 16 ? 2 : treads > 0 ? 1 : 0;
const helpless = systems => systems.treads === 0 &&
  Object.values(systems.weapons).every(weapon => remaining(weapon) === 0);
const ratio = (attack, defense) => {
  const strength = Math.max(0, attack), guarded = Math.max(1, defense);
  if (strength >= guarded * 5) return '5-1';
  if (strength * 2 < guarded) return '1-2';
  return `${Math.min(4, Math.max(1, Math.floor(strength / guarded)))}-1`;
};

export function queryIronDustB3aAction(state, command) {
  validateIronDustUnifiedStateProbe(state);
  if (!fixtures.includes(state.fixture)) return deny('B3A_FIXTURE_UNSUPPORTED');
  if (!command || typeof command.type !== 'string') return deny('B3A_COMMAND_INVALID');
  if (!['EnemySystemAttack', 'EnemyPass'].includes(command.type) &&
      !(command.type === 'EndPhase' && state.phase === 'enemy'))
    return queryIronDustB2Action(state, command);
  const keys = command.type === 'EndPhase' ? ['type', 'playerId'] :
    command.type === 'EnemyPass' ? ['type', 'playerId', 'actorId'] :
      ['type', 'playerId', 'attackerId', 'targetId', 'targetKey'];
  if (!exact(command, keys)) return deny('B3A_COMMAND_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (state.phase !== 'enemy') return deny('WRONG_PHASE');
  if (command.type === 'EndPhase') {
    if (pending(state).length) return deny('ENEMY_COMMANDS_PENDING');
    if (state.turn === Number.MAX_SAFE_INTEGER) return deny('TURN_LIMIT');
    return {available: true};
  }
  const actorId = command.type === 'EnemyPass' ? command.actorId : command.attackerId;
  if (!actors.includes(actorId))
    return deny(actorId === 'core' ? 'ENEMY_ACTOR_FORBIDDEN' : 'ENEMY_ACTOR_INVALID');
  const actor = unit(state, actorId);
  if (actor.hp <= 0) return deny('ENEMY_ACTOR_DESTROYED');
  if (state.enemyPassed.includes(actorId) || state.firedActorIds.includes(actorId))
    return deny('ACTION_SPENT');
  if (command.type === 'EnemyPass') return {available: true};
  if (actor.disabled) return deny('SYSTEM_ACTOR_OR_TARGET_UNAVAILABLE');
  if (command.targetId !== 'ogre') return deny('SYSTEM_TARGET_INVALID');
  const target = unit(state, 'ogre');
  if (target.hp <= 0 || target.embarkedOn) return deny('SYSTEM_ACTOR_OR_TARGET_UNAVAILABLE');
  const systems = target.ogreSystems;
  if (command.targetKey !== 'treads' &&
      (!Object.hasOwn(systems.weapons, command.targetKey) ||
        remaining(systems.weapons[command.targetKey]) <= 0))
    return deny('SYSTEM_TARGET_INVALID');
  const geometry = queryIronDustFireGeometry(state, actorId, 'ogre', actor.range,
    {outOfRange: 'SYSTEM_OUT_OF_RANGE', sightBlocked: 'SYSTEM_SIGHT_BLOCKED'});
  if (!geometry.available) return geometry;
  return {available: true, direction: 'enemy-to-system', attackerId: actorId,
    targetId: 'ogre', targetKey: command.targetKey, turn: state.turn,
    availableSystemTargets: [...Object.keys(systems.weapons).filter(key =>
      remaining(systems.weapons[key]) > 0), 'treads']};
}

export function preflightIronDustB3aAction(state, command) {
  return queryIronDustB3aAction(state, command);
}

// Explicit enemy action only: no AI, target choice, product or replay activation.
export function dispatchIronDustB3aAction(state, command) {
  const query = queryIronDustB3aAction(state, command);
  if (!query.available) return {error: query.error};
  if (!['EnemySystemAttack', 'EnemyPass'].includes(command.type) &&
      !(command.type === 'EndPhase' && state.phase === 'enemy'))
    return dispatchIronDustB2Action(state, command);
  const next = clone(state), events = [];
  if (command.type === 'EndPhase') {
    next.turn++;
    next.phase = 'movement';
    next.activeTeam = 'player';
    next.enemyPassed = [];
    next.firedActorIds = [];
    for (const item of next.units) {
      item.moved = false;
      item.fired = false;
      item.secondMoved = false;
    }
    for (const weapon of Object.values(unit(next, 'ogre').ogreSystems.weapons))
      weapon.firedThisPhase = 0;
    for (const item of next.units.filter(item => item.team === 'player' && item.hp > 0 &&
        item.disabled && item.disabledUntil <= next.turn)) {
      item.disabled = false;
      item.disabledUntil = 0;
      events.push({type: 'UnitRecovered', unitId: item.id, side: 'player', turn: next.turn});
    }
    events.push({type: 'PhaseChanged', from: 'enemy', to: 'movement',
      side: 'player', turn: next.turn});
  } else if (command.type === 'EnemyPass') {
    next.enemyPassed.push(command.actorId);
    next.enemyPassed.sort((a, b) => actors.indexOf(a) - actors.indexOf(b));
    events.push({type: 'EnemyPassRecorded', actorId: command.actorId,
      turn: next.turn, pendingActorIds: pending(next)});
  } else {
    const actor = unit(next, command.attackerId), target = unit(next, 'ogre');
    const systems = target.ogreSystems, treadHit = command.targetKey === 'treads';
    next.rng.state = (Math.imul(1664525, next.rng.state) + 1013904223) >>> 0;
    const roll = next.rng.state % 6;
    const geometry = queryIronDustFireGeometry(next, actor.id, 'ogre', actor.range,
      {outOfRange: 'SYSTEM_OUT_OF_RANGE', sightBlocked: 'SYSTEM_SIGHT_BLOCKED'});
    const combatRatio = treadHit ? '1-1' : ratio(actor.damage,
      systems.weapons[command.targetKey].defense + geometry.cover);
    const result = treadHit ? (roll >= 4 ? 'X' : 'NE') :
      (combatRatio === '5-1' ? 'X' : crt[combatRatio][roll]);
    const loss = result === 'X' ? (treadHit ? Math.min(systems.treads, actor.damage) : 1) : 0;
    if (treadHit) systems.treads -= loss;
    else systems.weapons[command.targetKey].destroyed += loss;
    if (helpless(systems)) target.hp = 0;
    if (target.hp === 0 && !next.units.some(item => item.team === 'player' && item.hp > 0))
      next.victory = {status: 'ended', winner: 'enemy'};
    const remainingAfter = treadHit ? systems.treads : remaining(systems.weapons[command.targetKey]);
    next.firedActorIds.push(actor.id);
    next.firedActorIds.sort((a, b) => actors.indexOf(a) - actors.indexOf(b));
    events.push({type: 'EnemySystemFireResolved', attackerId: actor.id,
      targetId: 'ogre', targetKey: command.targetKey, ratio: combatRatio,
      roll, result, loss, remaining: remainingAfter, movement: movement(systems.treads),
      hp: target.hp, helpless: helpless(systems), turn: next.turn});
  }
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events};
}
