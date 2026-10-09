import {validateIronDustUnifiedStateProbe, IRON_DUST_ZERO_TREADS_POLICY_VERSION}
  from './iron-dust-unified-state-probe.mjs';
import {queryIronDustEnemyIntent} from './iron-dust-enemy-intent-probe.mjs';
import {queryIronDustEnemyMoveAction, dispatchIronDustEnemyMoveAction} from
  './iron-dust-enemy-move-action-probe.mjs';
import {queryIronDustStandardFireAction, dispatchIronDustStandardFireAction} from
  './iron-dust-standard-fire-action-probe.mjs';

// A diagnostic scheduler, separate from Core product profiles and Replay.
// Legacy performs a whole first pass before any actor's retry pass.
export const IRON_DUST_ENEMY_TURN_CONTROLLER_VERSION = 'iron-dust-enemy-turn-controller-v1';
export const IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION =
  'iron-dust-enemy-turn-controller-v2';
const controllerVersionFor = state => state?.targetPolicyVersion ===
  IRON_DUST_ZERO_TREADS_POLICY_VERSION
  ? IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION
  : IRON_DUST_ENEMY_TURN_CONTROLLER_VERSION;
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
const intentRequest = (actorId, stage) => ({type: 'EnemyIntent',
  playerId: 'enemy', actorId, stage, claim: 'auto'});
const digest = value => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
};
const stamp = (state, cursor) => digest({state, cursor});
const nextCursor = cursor => {
  if (cursor.pass === 'first') return {...cursor,
    pass: cursor.index === 1 ? 'retry' : 'first',
    index: cursor.index === 1 ? 0 : 1};
  if (cursor.pass === 'retry') return {...cursor,
    pass: cursor.index === 1 ? 'finish' : 'retry',
    index: cursor.index === 1 ? 0 : 1};
  return {...cursor, pass: 'complete', index: 0};
};

export function createIronDustEnemyTurnController(state) {
  validateIronDustUnifiedStateProbe(state);
  if (state.phase !== 'enemy' || state.activeTeam !== 'enemy' ||
      state.victory.status !== 'ongoing' || state.enemyPassed.length ||
      state.firedActorIds.length || actors.some(id => unit(state, id).moved) ||
      actors.some(id => {
        const actor = unit(state, id);
        return actor.hp > 0 && actor.disabled && actor.disabledUntil <= state.turn;
      })) throw Object.assign(new Error('ENEMY_CONTROLLER_SETUP_INVALID'),
    {code: 'ENEMY_CONTROLLER_SETUP_INVALID'});
  const copy = clone(state);
  const cursor = {turn: copy.turn, pass: 'first', index: 0,
    eligibleActorIds: actors.filter(id => {
      const actor = unit(copy, id);
      return actor.hp > 0 && !actor.disabled;
    })};
  return freeze({controllerVersion: controllerVersionFor(copy),
    executable: false, state: copy, cursor, digest: stamp(copy, cursor)});
}

export function validateIronDustEnemyTurnController(value) {
  if (!exact(value, ['controllerVersion', 'executable', 'state', 'cursor', 'digest']) ||
      value.controllerVersion !== controllerVersionFor(value.state) ||
      value.executable !== false ||
      !exact(value.cursor, ['turn', 'pass', 'index', 'eligibleActorIds']) ||
      !['first', 'retry', 'finish', 'complete'].includes(value.cursor.pass) ||
      !Number.isSafeInteger(value.cursor.turn) || value.cursor.turn < 1 ||
      value.cursor.turn !== value.state?.turn ||
      !(value.cursor.pass === 'first' || value.cursor.pass === 'retry'
        ? [0, 1].includes(value.cursor.index) : value.cursor.index === 0) ||
      !Array.isArray(value.cursor.eligibleActorIds) ||
      JSON.stringify(value.cursor.eligibleActorIds) !== JSON.stringify(actors.filter(id => {
        const actor = value.state?.units?.find(item => item.id === id);
        return actor?.hp > 0 && !actor.disabled;
      })) ||
      value.digest !== stamp(value.state, value.cursor))
    throw Object.assign(new Error('ENEMY_CONTROLLER_STATE_MISMATCH'),
      {code: 'ENEMY_CONTROLLER_STATE_MISMATCH'});
  validateIronDustUnifiedStateProbe(value.state);
  const phaseMatches = value.cursor.pass === 'complete'
    ? value.state.victory.status === 'ongoing'
      ? value.state.phase === 'movement' && value.state.activeTeam === 'player'
      : value.state.phase === 'enemy' && value.state.activeTeam === 'enemy'
    : value.state.victory.status === 'ongoing' &&
      value.state.phase === 'enemy' && value.state.activeTeam === 'enemy';
  if (!phaseMatches)
    throw Object.assign(new Error('ENEMY_CONTROLLER_STATE_MISMATCH'),
      {code: 'ENEMY_CONTROLLER_STATE_MISMATCH'});
  const resolvedFirst = id => {
    const actor = unit(value.state, id);
    return actor.hp <= 0 || actor.moved ||
      value.state.firedActorIds.includes(id) || value.state.enemyPassed.includes(id);
  };
  const resolvedRetry = id => {
    const actor = unit(value.state, id);
    return actor.hp <= 0 || value.state.firedActorIds.includes(id) ||
      value.state.enemyPassed.includes(id);
  };
  if ((value.cursor.pass === 'first' && value.cursor.index === 1 &&
      !resolvedFirst('guard')) ||
      (['retry', 'finish'].includes(value.cursor.pass) &&
        !actors.every(resolvedFirst)) ||
      (value.cursor.pass === 'retry' && value.cursor.index === 1 &&
        !resolvedRetry('guard')) ||
      (value.cursor.pass === 'finish' && !actors.every(resolvedRetry)))
    throw Object.assign(new Error('ENEMY_CONTROLLER_STATE_MISMATCH'),
      {code: 'ENEMY_CONTROLLER_STATE_MISMATCH'});
  return value;
}

function nextAction(controller) {
  const {state, cursor} = controller;
  if (cursor.pass === 'finish') {
    const command = {type: 'EndPhase', playerId: 'enemy'};
    const query = queryIronDustStandardFireAction(state, command);
    return query.available ? {kind: 'end-phase', command} :
      {error: query.error};
  }
  const actorId = actors[cursor.index], actor = unit(state, actorId);
  if (actor.hp <= 0) return {kind: 'skip', actorId, reason: 'DESTROYED'};
  if (cursor.pass === 'retry' && (state.firedActorIds.includes(actorId) ||
      state.enemyPassed.includes(actorId)))
    return {kind: 'skip', actorId, reason: state.firedActorIds.includes(actorId)
      ? 'FIRED' : 'PASSED'};
  const stage = cursor.pass === 'first' ? 'first-fire' : 'retry-fire';
  const intent = queryIronDustEnemyIntent(state, intentRequest(actorId, stage));
  if (!intent.available) return {error: intent.error};
  if (intent.kind === 'fire') return {kind: 'fire', actorId, command: intent.command};
  if (intent.kind === 'pass') {
    if (cursor.pass === 'retry' || intent.reason === 'DISABLED')
      return {kind: 'pass', actorId, reason: intent.reason, command: intent.command};
    return {error: {code: 'ENEMY_CONTROLLER_UNEXPECTED_PASS'}};
  }
  if (cursor.pass !== 'first' || intent.kind !== 'continue')
    return {error: {code: 'ENEMY_CONTROLLER_INTENT_MISMATCH'}};
  const move = queryIronDustEnemyIntent(state, intentRequest(actorId, 'move'));
  if (!move.available) return {error: move.error};
  const command = move.kind === 'move'
    ? {type: 'EnemyMove', playerId: 'enemy', actorId, to: move.to}
    : {type: 'EnemyHold', playerId: 'enemy', actorId};
  const preflight = queryIronDustEnemyMoveAction(state, command);
  if (!preflight.available) return {error: preflight.error};
  return {kind: move.kind === 'move' ? 'move' : 'hold', actorId, command,
    ...(move.kind === 'move' ? {targetId: move.targetId, to: move.to,
      cost: move.cost, path: move.path} : {reason: 'HOLD'})};
}

export function queryIronDustEnemyTurnController(controller, request) {
  try {validateIronDustEnemyTurnController(controller)}
  catch {return deny('ENEMY_CONTROLLER_STATE_MISMATCH')}
  if (!exact(request, ['type', 'playerId']) || request.type !== 'AdvanceEnemyTurn')
    return deny('ENEMY_CONTROLLER_COMMAND_INVALID');
  if (request.playerId !== 'enemy') return deny('NOT_ACTIVE_TEAM');
  if (controller.cursor.pass === 'complete') return deny('ENEMY_TURN_COMPLETE');
  const action = nextAction(controller);
  if (action.error) return {available: false, error: action.error};
  return {available: true, controllerVersion: controller.controllerVersion,
    cursor: clone(controller.cursor), action};
}

export function preflightIronDustEnemyTurnController(controller, request) {
  return queryIronDustEnemyTurnController(controller, request);
}

export function dispatchIronDustEnemyTurnController(controller, request) {
  const query = queryIronDustEnemyTurnController(controller, request);
  if (!query.available) return {error: query.error};
  const {action} = query;
  let result;
  if (action.kind === 'move' || action.kind === 'hold')
    result = dispatchIronDustEnemyMoveAction(controller.state, action.command);
  else if (action.command)
    result = dispatchIronDustStandardFireAction(controller.state, action.command);
  else result = {state: controller.state, events: [{type: 'EnemySkipped',
    actorId: action.actorId, reason: action.reason, turn: controller.state.turn}]};
  if (!result.state) return {error: result.error};
  const cursor = nextCursor(controller.cursor);
  if (result.state.victory.status !== 'ongoing') {
    cursor.pass = 'complete';
    cursor.index = 0;
  }
  cursor.turn = result.state.turn;
  const state = clone(result.state);
  const next = freeze({controllerVersion: controller.controllerVersion,
    executable: false, state, cursor, digest: stamp(state, cursor)});
  validateIronDustEnemyTurnController(next);
  return {controller: next, events: result.events};
}
