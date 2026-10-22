import {validateIronDustUnifiedStateProbe, queryIronDustFireGeometry} from
  './iron-dust-unified-state-probe.mjs';
import {queryIronDustPlayerMove, dispatchIronDustPlayerMove} from
  './iron-dust-player-move-probe.mjs';
import {queryIronDustB3bAction, dispatchIronDustB3bAction} from
  './iron-dust-b3b-action-probe.mjs';
import {ironDustCrtRatio} from './iron-dust-crt-ratio.mjs';

// Explicit technical commands on the same inactive seven-unit state. Enemy
// target selection and movement are deliberately outside this probe.
export const IRON_DUST_STANDARD_FIRE_ACTION_VERSION = 'iron-dust-standard-fire-action-v1';
const playerActors = ['gev', 'missile', 'infantry'];
const enemyActors = ['guard', 'raider'];
const playerTargets = ['core', ...enemyActors];
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
const exact = (value, keys) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const unit = (state, id) => state.units.find(item => item.id === id);
const victory = units => !units.some(item => item.team === 'player' && item.hp > 0)
  ? {status: 'ended', winner: 'enemy'}
  : unit({units}, 'core').hp === 0
    ? {status: 'ended', winner: 'player'}
    : {status: 'ongoing', winner: null};

function isStandardFire(command) {
  return command?.type === 'EnemyUnitAttack' ||
    command?.type === 'PlayerFire' && command.unitId !== 'ogre';
}

export function queryIronDustStandardFireAction(state, command) {
  validateIronDustUnifiedStateProbe(state);
  if (command?.type === 'Move' && state.fixture === 'source')
    return queryIronDustPlayerMove(state, command);
  if (!isStandardFire(command)) return queryIronDustB3bAction(state, command);
  const playerFire = command.type === 'PlayerFire';
  const keys = playerFire ? ['type', 'playerId', 'unitId', 'targetId'] :
    ['type', 'playerId', 'attackerId', 'targetId'];
  if (!exact(command, keys)) return deny('STANDARD_FIRE_COMMAND_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (state.phase !== (playerFire ? 'fire' : 'enemy')) return deny('WRONG_PHASE');
  const actorId = playerFire ? command.unitId : command.attackerId;
  if (!(playerFire ? playerActors : enemyActors).includes(actorId))
    return deny('STANDARD_FIRE_ACTOR_INVALID');
  const actor = unit(state, actorId);
  if (actor.hp <= 0 || actor.disabled || actor.embarkedOn)
    return deny('STANDARD_FIRE_ACTOR_UNAVAILABLE');
  if (playerFire ? actor.fired :
    state.firedActorIds.includes(actorId) || state.enemyPassed.includes(actorId))
    return deny('ACTION_SPENT');
  if (!(playerFire ? playerTargets : playerActors).includes(command.targetId))
    return deny('STANDARD_FIRE_TARGET_INVALID');
  const target = unit(state, command.targetId);
  if (target.hp <= 0 || target.embarkedOn)
    return deny('STANDARD_FIRE_TARGET_UNAVAILABLE');
  const geometry = queryIronDustFireGeometry(state, actorId, target.id, actor.range,
    {outOfRange: 'STANDARD_FIRE_OUT_OF_RANGE',
      sightBlocked: 'STANDARD_FIRE_SIGHT_BLOCKED'});
  if (!geometry.available) return geometry;
  return {available: true, resolverVersion: IRON_DUST_STANDARD_FIRE_ACTION_VERSION,
    direction: playerFire ? 'player-to-unit' : 'enemy-to-unit', actorId,
    targetId: target.id, attack: actor.damage, range: actor.range,
    defense: target.defense, effectiveDefense: target.defense + geometry.cover,
    distance: geometry.distance, terrain: geometry.terrain,
    losMode: geometry.losMode, turn: state.turn};
}

export function preflightIronDustStandardFireAction(state, command) {
  return queryIronDustStandardFireAction(state, command);
}

export function dispatchIronDustStandardFireAction(state, command) {
  const query = queryIronDustStandardFireAction(state, command);
  if (!query.available) return {error: query.error};
  if (command.type === 'Move' && state.fixture === 'source')
    return dispatchIronDustPlayerMove(state, command);
  if (!isStandardFire(command)) return dispatchIronDustB3bAction(state, command);
  const next = clone(state), playerFire = command.type === 'PlayerFire';
  const actorId = playerFire ? command.unitId : command.attackerId;
  const actor = unit(next, actorId), target = unit(next, command.targetId);
  next.rng.state = (Math.imul(1664525, next.rng.state) + 1013904223) >>> 0;
  const roll = next.rng.state % 6;
  const combatRatio = ironDustCrtRatio(actor.damage, query.effectiveDefense);
  const result = combatRatio === '5-1' ? 'X' : crt[combatRatio][roll];
  if (result === 'D') {
    if (target.infantry === true || target.engineering === true || target.id === 'infantry')
      target.hp = Math.max(0, target.hp - 1);
    else if (target.disabled) target.hp = 0;
    else {target.disabled = true; target.disabledUntil = next.turn + (playerFire ? 1 : 2)}
  }
  if (result === 'X') target.hp = 0;
  if (playerFire) actor.fired = true;
  else {
    next.firedActorIds.push(actorId);
    next.firedActorIds.sort((a, b) => enemyActors.indexOf(a) - enemyActors.indexOf(b));
  }
  next.victory = victory(next.units);
  const event = {type: playerFire ? 'PlayerFireResolved' : 'EnemyUnitFireResolved',
    attackerId: actorId, targetId: target.id, ratio: combatRatio, roll, result,
    effectiveDefense: query.effectiveDefense, hp: target.hp,
    disabled: target.disabled, disabledUntil: target.disabledUntil,
    passengerIds: target.passengerIds, turn: next.turn};
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events: [event]};
}
