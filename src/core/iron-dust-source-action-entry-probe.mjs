import {createIronDustUnifiedStateProbe, createIronDustZeroTreadsUnifiedStateProbe,
  validateIronDustUnifiedStateProbe, IRON_DUST_ZERO_TREADS_POLICY_VERSION} from
  './iron-dust-unified-state-probe.mjs';
import {queryIronDustStandardFireAction, dispatchIronDustStandardFireAction} from
  './iron-dust-standard-fire-action-probe.mjs';
import {createIronDustEnemyTurnController, validateIronDustEnemyTurnController,
  queryIronDustEnemyTurnController, dispatchIronDustEnemyTurnController} from
  './iron-dust-enemy-turn-controller-probe.mjs';

// The sole source-game command boundary for this inactive technical probe.
// Older action modules remain independently importable diagnostic fixtures.
export const IRON_DUST_SOURCE_ACTION_ENTRY_VERSION = 'iron-dust-source-action-entry-v1';
export const IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION =
  'iron-dust-source-action-entry-v2';
const playerActors = ['ogre', 'gev', 'missile', 'infantry'];
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const exact = (value, keys) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const deny = code => ({available: false, error: {code}});
const digest = value => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
};
const stamp = (version, mode, payload) => digest({
  entryVersion: version, mode, payload
});
const wrap = (mode, value, version = IRON_DUST_SOURCE_ACTION_ENTRY_VERSION) => {
  const payload = clone(value);
  return freeze({entryVersion: version,
    executable: false, mode, payload, digest: stamp(version, mode, payload)});
};
const stateOf = entry => entry.mode === 'enemy' ? entry.payload.state : entry.payload;

export function createIronDustSourceActionEntry(seed) {
  const state = createIronDustUnifiedStateProbe(seed, {fixture: 'source'});
  validateIronDustUnifiedStateProbe(state);
  return wrap('player', state);
}

export function createIronDustZeroTreadsSourceActionEntry(seed) {
  const state = createIronDustZeroTreadsUnifiedStateProbe(seed);
  validateIronDustUnifiedStateProbe(state);
  return wrap('player', state, IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION);
}

export function validateIronDustSourceActionEntry(entry) {
  if (!exact(entry, ['entryVersion', 'executable', 'mode', 'payload', 'digest']) ||
      ![IRON_DUST_SOURCE_ACTION_ENTRY_VERSION,
        IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION].includes(entry.entryVersion) ||
      entry.executable !== false || !['player', 'enemy', 'ended'].includes(entry.mode) ||
      entry.digest !== stamp(entry.entryVersion, entry.mode, entry.payload))
    throw Object.assign(new Error('SOURCE_ENTRY_STATE_MISMATCH'),
      {code: 'SOURCE_ENTRY_STATE_MISMATCH'});
  try {
    if (entry.mode === 'enemy') validateIronDustEnemyTurnController(entry.payload);
    else validateIronDustUnifiedStateProbe(entry.payload);
    const state = stateOf(entry);
    if (state.fixture !== 'source' ||
        (entry.entryVersion === IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION) !==
          (state.targetPolicyVersion === IRON_DUST_ZERO_TREADS_POLICY_VERSION) ||
        (entry.mode === 'enemy' && entry.payload.cursor.pass === 'complete') ||
        (entry.mode === 'enemy' &&
          (state.activeTeam !== 'enemy' || state.phase !== 'enemy' ||
            state.victory.status !== 'ongoing')) ||
        (entry.mode === 'player' &&
          (state.activeTeam !== 'player' || state.victory.status !== 'ongoing')) ||
        (entry.mode === 'ended' && state.victory.status !== 'ended'))
      throw new Error('source mode mismatch');
  } catch {
    throw Object.assign(new Error('SOURCE_ENTRY_STATE_MISMATCH'),
      {code: 'SOURCE_ENTRY_STATE_MISMATCH'});
  }
  return entry;
}

function commandGate(entry, command) {
  if (entry.mode === 'ended') return deny('GAME_ENDED');
  const keys = {
    Move: ['type', 'playerId', 'unitId', 'to'],
    Ram: ['type', 'playerId', 'unitId', 'targetId'],
    SelectWeapon: ['type', 'playerId', 'unitId', 'weaponKey'],
    PlayerFire: command?.unitId === 'ogre'
      ? ['type', 'playerId', 'unitId', 'targetId', 'weaponKey']
      : ['type', 'playerId', 'unitId', 'targetId'],
    EndPhase: ['type', 'playerId'],
    AutoEnemyAdvance: ['type', 'playerId']
  }[command?.type];
  if (!keys) return deny('SOURCE_ENTRY_COMMAND_UNSUPPORTED');
  if (!exact(command, keys)) return deny('SOURCE_ENTRY_COMMAND_INVALID');
  const enemyCommand = command.type === 'AutoEnemyAdvance';
  if (command.playerId !== (enemyCommand ? 'enemy' : 'player'))
    return deny('NOT_ACTIVE_TEAM');
  if (entry.mode !== (enemyCommand ? 'enemy' : 'player'))
    return deny('WRONG_PHASE');
  if (Object.hasOwn(command, 'unitId') && !playerActors.includes(command.unitId))
    return deny('SOURCE_ENTRY_ACTOR_INVALID');
  return null;
}

export function queryIronDustSourceActionEntry(entry, command) {
  try {validateIronDustSourceActionEntry(entry)}
  catch {return deny('SOURCE_ENTRY_STATE_MISMATCH')}
  const gate = commandGate(entry, command);
  if (gate) return gate;
  return entry.mode === 'enemy'
    ? queryIronDustEnemyTurnController(entry.payload,
      {type: 'AdvanceEnemyTurn', playerId: 'enemy'})
    : queryIronDustStandardFireAction(entry.payload, command);
}

export function preflightIronDustSourceActionEntry(entry, command) {
  return queryIronDustSourceActionEntry(entry, command);
}

export function dispatchIronDustSourceActionEntry(entry, command) {
  const query = queryIronDustSourceActionEntry(entry, command);
  if (!query.available) return {error: query.error};
  if (entry.mode === 'enemy') {
    const result = dispatchIronDustEnemyTurnController(entry.payload,
      {type: 'AdvanceEnemyTurn', playerId: 'enemy'});
    if (!result.controller) return {error: result.error};
    const controller = result.controller;
    const next = controller.cursor.pass === 'complete'
      ? wrap(controller.state.victory.status === 'ended' ? 'ended' : 'player',
        controller.state, entry.entryVersion)
      : wrap('enemy', controller, entry.entryVersion);
    validateIronDustSourceActionEntry(next);
    return {entry: next, events: result.events};
  }
  const result = dispatchIronDustStandardFireAction(entry.payload, command);
  if (!result.state) return {error: result.error};
  const state = result.state;
  const next = state.victory.status === 'ended' ? wrap('ended', state, entry.entryVersion)
    : state.phase === 'enemy' ? wrap('enemy', createIronDustEnemyTurnController(state),
      entry.entryVersion)
      : wrap('player', state, entry.entryVersion);
  validateIronDustSourceActionEntry(next);
  return {entry: next, events: result.events};
}
