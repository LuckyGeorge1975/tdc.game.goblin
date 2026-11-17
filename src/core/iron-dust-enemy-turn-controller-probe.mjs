import {validateIronDustUnifiedStateProbe, IRON_DUST_ZERO_TREADS_POLICY_VERSION}
  from './iron-dust-unified-state-probe.mjs';
import {queryIronDustEnemyIntent} from './iron-dust-enemy-intent-probe.mjs?v=2';
import {queryIronDustEnemyMoveAction, dispatchIronDustEnemyMoveAction,
  queryIronDustEnemyExplicitMoveAction, dispatchIronDustEnemyExplicitMoveAction,
  listIronDustEnemyExplicitMoves} from
  './iron-dust-enemy-move-action-probe.mjs?v=3';
import {queryIronDustStandardFireAction, dispatchIronDustStandardFireAction,listIronDustEnemyFireChoices} from
  './iron-dust-standard-fire-action-probe.mjs?v=2';
import {validIronDustEnemyPolicy} from './iron-dust-enemy-policy.mjs';

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
const policyField = policy => policy ? {enemyPolicy: policy} : {};
const stamp = (state, cursor, policy) => digest({state, cursor, ...policyField(policy)});
const nextCursor = cursor => {
  if (cursor.pass === 'first') return {...cursor,
    pass: cursor.index === 1 ? 'retry' : 'first',
    index: cursor.index === 1 ? 0 : 1};
  if (cursor.pass === 'retry') return {...cursor,
    pass: cursor.index === 1 ? 'finish' : 'retry',
    index: cursor.index === 1 ? 0 : 1};
  return {...cursor, pass: 'complete', index: 0};
};

export function createIronDustEnemyTurnController(state, policy = null) {
  validateIronDustUnifiedStateProbe(state);
  if (!validIronDustEnemyPolicy(policy) || state.phase !== 'enemy' || state.activeTeam !== 'enemy' ||
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
    executable: false, state: copy, cursor, ...policyField(clone(policy)),
    digest: stamp(copy, cursor, policy)});
}

export function validateIronDustEnemyTurnController(value) {
  const policy = value?.enemyPolicy ?? null;
  if (!exact(value, ['controllerVersion', 'executable', 'state', 'cursor', 'digest',
      ...Object.keys(policyField(policy))]) || !validIronDustEnemyPolicy(policy) ||
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
      value.digest !== stamp(value.state, value.cursor, policy))
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

function fixedAction(controller) {
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
  if (cursor.pass==='first'&&actor.disabled)
    return {kind:'pass',actorId,reason:'DISABLED',command:{type:'EnemyPass',playerId:'enemy',actorId}};
}

function nextAction(controller, decisionTrace) {
  const fixed=fixedAction(controller);
  if (fixed) return fixed;
  const {state,cursor}=controller;
  const policy=controller.enemyPolicy??null;
  const actorId=actors[cursor.index];
  const stage = cursor.pass === 'first' ? 'first-fire' : 'retry-fire';
  const intent = queryIronDustEnemyIntent(state, intentRequest(actorId, stage), policy, decisionTrace);
  if (!intent.available) return {error: intent.error};
  if (intent.kind === 'fire') return {kind: 'fire', actorId, command: intent.command};
  if (intent.kind === 'pass') {
    if (cursor.pass === 'retry' || intent.reason === 'DISABLED')
      return {kind: 'pass', actorId, reason: intent.reason, command: intent.command};
    return {error: {code: 'ENEMY_CONTROLLER_UNEXPECTED_PASS'}};
  }
  if (cursor.pass !== 'first' || intent.kind !== 'continue')
    return {error: {code: 'ENEMY_CONTROLLER_INTENT_MISMATCH'}};
  const move = queryIronDustEnemyIntent(state, intentRequest(actorId, 'move'), policy, decisionTrace);
  if (!move.available) return {error: move.error};
  const command = move.kind === 'move'
    ? {type: 'EnemyMove', playerId: 'enemy', actorId, to: move.to}
    : {type: 'EnemyHold', playerId: 'enemy', actorId};
  const preflight = queryIronDustEnemyMoveAction(state, command, policy);
  if (!preflight.available) return {error: preflight.error};
  return {kind: move.kind === 'move' ? 'move' : 'hold', actorId, command,
    ...(move.kind === 'move' ? {targetId: move.targetId, to: move.to,
      cost: move.cost, path: move.path} : {reason: 'HOLD'})};
}

export function queryIronDustEnemyLegalSlot(controller) {
  try {validateIronDustEnemyTurnController(controller)}
  catch {return deny('ENEMY_CONTROLLER_STATE_MISMATCH')}
  const {state,cursor}=controller;
  if (cursor.pass==='complete') return deny('ENEMY_TURN_COMPLETE');
  const fixed=fixedAction(controller);
  if (fixed?.error) return {available:false,error:fixed.error};
  if (fixed) return {available:true,kind:'mechanical',action:fixed};
  const actorId=actors[cursor.index];
  const fire=listIronDustEnemyFireChoices(state,actorId);
  if (fire.length) return {available:true,kind:'fire',actorId,fire};
  if (cursor.pass==='first') return {available:true,kind:'move',actorId};
  return {available:true,kind:'mechanical',action:{kind:'pass',actorId,reason:'NO_TARGET',
    command:{type:'EnemyPass',playerId:'enemy',actorId}}};
}

export function dispatchIronDustEnemyMechanical(controller) {
  const slot=queryIronDustEnemyLegalSlot(controller);
  if (!slot.available) return {error:slot.error};
  if (slot.kind!=='mechanical') return {error:{code:'ENEMY_MANUAL_CHOICE_REQUIRED'}};
  return applyControllerAction(controller,slot.action);
}

export function queryIronDustEnemyTurnController(controller, request, decisionTrace) {
  try {validateIronDustEnemyTurnController(controller)}
  catch {return deny('ENEMY_CONTROLLER_STATE_MISMATCH')}
  if (!exact(request, ['type', 'playerId']) || request.type !== 'AdvanceEnemyTurn')
    return deny('ENEMY_CONTROLLER_COMMAND_INVALID');
  if (request.playerId !== 'enemy') return deny('NOT_ACTIVE_TEAM');
  if (controller.cursor.pass === 'complete') return deny('ENEMY_TURN_COMPLETE');
  const action = nextAction(controller, decisionTrace);
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
  return applyControllerAction(controller, action);
}

// The controller owns actor/pass eligibility. A choice can replace the target
// of an already permitted fire attempt, including a different system component.
export function queryIronDustEnemyFireChoice(controller, command) {
  const slot=queryIronDustEnemyLegalSlot(controller);
  if (!slot.available) return slot;
  if (slot.kind!=='fire' || command?.attackerId!==slot.actorId ||
      !['EnemyUnitAttack', 'EnemySystemAttack'].includes(command?.type))
    return deny('ENEMY_FIRE_CHOICE_OUTSIDE_SLOT');
  return queryIronDustStandardFireAction(controller.state, command);
}

export function dispatchIronDustEnemyFireChoice(controller, command) {
  const check = queryIronDustEnemyFireChoice(controller, command);
  return check.available ? applyControllerAction(controller, {kind: 'fire', command}) : check;
}

export function listIronDustEnemyMoveChoices(controller, automation) {
  const slot=queryIronDustEnemyLegalSlot(controller);
  if (!slot.available) return [];
  if (slot.kind!=='move') return [];
  const {actorId}=slot, common={playerId:'enemy',actorId};
  const choices=listIronDustEnemyExplicitMoves(controller.state,actorId).map(move=>({
    command:{type:'EnemyMove',...common,to:move.to},cost:move.cost,path:move.path,
    baseline:automation?.kind==='move'&&move.to.x===automation.to.x&&move.to.y===automation.to.y
  }));
  choices.push({command:{type:'EnemyHold',...common},baseline:automation?.kind==='hold'});
  return choices.sort((a,b)=>Number(b.baseline)-Number(a.baseline));
}

function withEnemyMovementSlot(controller, command, resolve) {
  const slot=queryIronDustEnemyLegalSlot(controller);
  if (!slot.available) return slot;
  if (slot.kind!=='move'||command?.actorId!==slot.actorId) return deny('ENEMY_MOVE_CHOICE_OUTSIDE_SLOT');
  return resolve(controller.state,command,controller.enemyPolicy??null);
}

export function queryIronDustEnemyMoveChoice(controller, command) {
  return withEnemyMovementSlot(controller,command,queryIronDustEnemyExplicitMoveAction);
}

export function dispatchIronDustEnemyMoveChoice(controller, command) {
  const result=withEnemyMovementSlot(controller,command,dispatchIronDustEnemyExplicitMoveAction);
  return applyControllerResult(controller,result);
}

function applyControllerAction(controller, action) {
  const policy = controller.enemyPolicy ?? null;
  let result;
  if (action.kind === 'move' || action.kind === 'hold')
    result = dispatchIronDustEnemyMoveAction(controller.state, action.command, policy);
  else if (action.command)
    result = dispatchIronDustStandardFireAction(controller.state, action.command);
  else result = {state: controller.state, events: [{type: 'EnemySkipped',
    actorId: action.actorId, reason: action.reason, turn: controller.state.turn}]};
  return applyControllerResult(controller,result);
}

function applyControllerResult(controller, result) {
  const policy = controller.enemyPolicy ?? null;
  if (!result.state) return {error: result.error};
  const cursor = nextCursor(controller.cursor);
  if (result.state.victory.status !== 'ongoing') {
    cursor.pass = 'complete';
    cursor.index = 0;
  }
  cursor.turn = result.state.turn;
  const state = clone(result.state);
  const next = freeze({controllerVersion: controller.controllerVersion,
    executable: false, state, cursor, ...policyField(clone(policy)),
    digest: stamp(state, cursor, policy)});
  validateIronDustEnemyTurnController(next);
  return {controller: next, events: result.events};
}
