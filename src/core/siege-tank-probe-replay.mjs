import {createGame, dispatch} from './game-core.mjs';
import {CORE_SIEGE_TANK_PROBE_CONTRACT} from './profile-contract.mjs';
import {SIEGE_TANK_PROBE_DATA, siegeTankProbeScenario} from './siege-tank-probe.mjs';

// Internal, inactive replay envelope; independent of schema-1/core-v3 replay.
export const SIEGE_TANK_PROBE_REPLAY_VERSION = 'siege-tank-probe-replay-v1';
export const SIEGE_TANK_PROBE_DATA_VERSION = 'siege-tank-probe-data-v1';
const {rulesVersion, scenarioId, scenarioVersion, ruleProfileId,
  effectiveRules} = CORE_SIEGE_TANK_PROBE_CONTRACT;
const weapons = ['main-1', 'main-2', 'main-both', 'ap-1', 'ap-2'];
const enemyIds = siegeTankProbeScenario.units.filter(unit => unit.team === 'enemy')
  .map(unit => unit.id);
const headerKeys = ['rulesVersion', 'scenarioId', 'scenarioVersion',
  'ruleProfileId', 'resolverVersion', 'dataVersion', 'dataDigest',
  'effectiveRules', 'initialStateDigest'];
const envelopeKeys = ['replayVersion', 'executable', 'header', 'initialScenario', 'initialSeed',
  'commands', 'commandsDigest', 'traceDigest'];
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
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const reject = code => {throw Object.assign(new Error(code), {code})};
function jsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const keys = Array.isArray(value) ? Object.keys(value) : [];
  const valid = (!Array.isArray(value) || keys.length === value.length &&
      keys.every((key, index) => key === String(index))) &&
    (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null) &&
    Object.values(value).every(item => jsonValue(item, seen));
  seen.delete(value);
  return valid;
}
const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const digest = value => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
};
const expectedHeader = initialStateDigest => ({rulesVersion, scenarioId,
  scenarioVersion, ruleProfileId,
  resolverVersion: effectiveRules.fireBudgetVersion,
  dataVersion: SIEGE_TANK_PROBE_DATA_VERSION,
  dataDigest: digest(SIEGE_TANK_PROBE_DATA),
  effectiveRules: clone(effectiveRules), initialStateDigest});
function validCommand(command) {
  if (command?.type === 'EndPhase')
    return exact(command, ['type', 'playerId']) &&
      ['player', 'enemy'].includes(command.playerId);
  return exact(command, ['type', 'playerId', 'unitId', 'targetId', 'weaponId']) &&
    command.type === 'FireWeapon' && command.playerId === 'player' &&
    command.unitId === 'siege-tank' && enemyIds.includes(command.targetId) &&
    weapons.includes(command.weaponId);
}
function simulate(initialState, commands) {
  let state = initialState;
  const steps = [];
  for (const command of commands) {
    const result = dispatch(state, command);
    if (!result.state || !Array.isArray(result.events))
      reject('SIEGE_REPLAY_COMMAND_REJECTED');
    state = result.state;
    steps.push({command: clone(command), events: clone(result.events),
      state: clone(state)});
  }
  return {initialState: clone(initialState), steps, finalState: clone(state)};
}
function inspect(envelope) {
  if (!jsonValue(envelope) || !exact(envelope, envelopeKeys) ||
      envelope.replayVersion !== SIEGE_TANK_PROBE_REPLAY_VERSION ||
      envelope.executable !== false ||
      !exact(envelope.header, headerKeys) ||
      canonical(envelope.initialScenario) !== canonical(siegeTankProbeScenario) ||
      !uint32(envelope.initialSeed) || !Array.isArray(envelope.commands) ||
      !envelope.commands.every(validCommand))
    reject('SIEGE_REPLAY_MISMATCH');
  const initialState = createGame(clone(siegeTankProbeScenario),
    envelope.initialSeed);
  if (canonical(envelope.header) !== canonical(expectedHeader(digest(initialState))) ||
      envelope.commandsDigest !== digest(envelope.commands))
    reject('SIEGE_REPLAY_MISMATCH');
  const playback = simulate(initialState, envelope.commands);
  if (envelope.traceDigest !== digest(playback.steps))
    reject('SIEGE_REPLAY_MISMATCH');
  return {envelope: freeze(clone(envelope)), playback: freeze(playback)};
}

export function recordSiegeTankProbeReplay(seed, commands) {
  if (!uint32(seed) || !Array.isArray(commands) ||
      !jsonValue(commands) || !commands.every(validCommand))
    reject('SIEGE_REPLAY_MISMATCH');
  const initialState = createGame(clone(siegeTankProbeScenario), seed);
  const playback = simulate(initialState, commands);
  return inspect({replayVersion: SIEGE_TANK_PROBE_REPLAY_VERSION,
    executable: false,
    header: expectedHeader(digest(initialState)),
    initialScenario: clone(siegeTankProbeScenario), initialSeed: seed,
    commands: clone(commands), commandsDigest: digest(commands),
    traceDigest: digest(playback.steps)}).envelope;
}

export function validateSiegeTankProbeReplay(envelope) {
  return inspect(envelope).envelope;
}

export function playSiegeTankProbeReplay(envelope) {
  return inspect(envelope).playback;
}
