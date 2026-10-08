import {createGame, dispatch} from './game-core.mjs';
import {CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT} from './profile-contract.mjs';
import {ARTILLERY_CORE_PROBE_DATA, ARTILLERY_CORE_ACTORS,
  artilleryCoreProbeScenario} from './artillery-spotter-core-probe.mjs';

// Internal, inactive U08/U09 replay; separate from schema-1 and the U07 probe.
export const ARTILLERY_SPOTTER_PROBE_REPLAY_VERSION =
  'artillery-spotter-probe-replay-v1';
export const ARTILLERY_SPOTTER_PROBE_DATA_VERSION =
  'artillery-spotter-probe-data-v1';
const {rulesVersion, scenarioId, scenarioVersion, ruleProfileId,
  effectiveRules} = CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT;
const enemyIds = artilleryCoreProbeScenario.units.filter(unit => unit.team === 'enemy')
  .map(unit => unit.id);
const spotterIds = artilleryCoreProbeScenario.units.filter(unit => unit.team === 'player')
  .map(unit => unit.id);
const headerKeys = ['rulesVersion', 'scenarioId', 'scenarioVersion',
  'ruleProfileId', 'resolverVersion', 'dataVersion', 'dataDigest',
  'effectiveRules', 'initialStateDigest'];
const envelopeKeys = ['replayVersion', 'executable', 'header', 'initialScenario',
  'initialSeed', 'commands', 'commandsDigest', 'traceDigest'];
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
  resolverVersion: effectiveRules.artillerySpotterVersion,
  dataVersion: ARTILLERY_SPOTTER_PROBE_DATA_VERSION,
  dataDigest: digest(ARTILLERY_CORE_PROBE_DATA),
  effectiveRules: clone(effectiveRules), initialStateDigest});
function validCommand(command) {
  if (command?.type === 'EndPhase')
    return exact(command, ['type', 'playerId']) &&
      ['player', 'enemy'].includes(command.playerId);
  if (command?.type === 'Move')
    return exact(command, ['type', 'playerId', 'unitId', 'to']) &&
      command.playerId === 'player' && command.unitId === 'mobile-siege-gun' &&
      exact(command.to, ['x', 'y']) &&
      Number.isInteger(command.to.x) && Number.isInteger(command.to.y);
  return exact(command, ['type', 'playerId', 'unitId', 'targetId',
    'mode', 'spotterId']) && command.type === 'FireArtillery' &&
    command.playerId === 'player' && ARTILLERY_CORE_ACTORS.includes(command.unitId) &&
    enemyIds.includes(command.targetId) &&
    (command.mode === 'direct' && command.spotterId === null ||
      command.mode === 'indirect' && spotterIds.includes(command.spotterId));
}
function simulate(initialState, commands) {
  let state = initialState;
  const steps = [];
  for (const command of commands) {
    const result = dispatch(state, command);
    if (!result.state || !Array.isArray(result.events))
      reject('ARTILLERY_REPLAY_COMMAND_REJECTED');
    state = result.state;
    steps.push({command: clone(command), events: clone(result.events),
      state: clone(state)});
  }
  return {initialState: clone(initialState), steps, finalState: clone(state)};
}
function inspect(envelope) {
  if (!jsonValue(envelope) || !exact(envelope, envelopeKeys) ||
      envelope.replayVersion !== ARTILLERY_SPOTTER_PROBE_REPLAY_VERSION ||
      envelope.executable !== false || !exact(envelope.header, headerKeys) ||
      canonical(envelope.initialScenario) !== canonical(artilleryCoreProbeScenario) ||
      !uint32(envelope.initialSeed) || !Array.isArray(envelope.commands) ||
      !envelope.commands.every(validCommand))
    reject('ARTILLERY_REPLAY_MISMATCH');
  const initialState = createGame(clone(artilleryCoreProbeScenario),
    envelope.initialSeed);
  if (canonical(envelope.header) !== canonical(expectedHeader(digest(initialState))) ||
      envelope.commandsDigest !== digest(envelope.commands))
    reject('ARTILLERY_REPLAY_MISMATCH');
  const playback = simulate(initialState, envelope.commands);
  if (envelope.traceDigest !== digest(playback.steps))
    reject('ARTILLERY_REPLAY_MISMATCH');
  return {envelope: freeze(clone(envelope)), playback: freeze(playback)};
}

export function recordArtillerySpotterProbeReplay(seed, commands) {
  if (!uint32(seed) || !Array.isArray(commands) ||
      !jsonValue(commands) || !commands.every(validCommand))
    reject('ARTILLERY_REPLAY_MISMATCH');
  const initialState = createGame(clone(artilleryCoreProbeScenario), seed);
  const playback = simulate(initialState, commands);
  return inspect({replayVersion: ARTILLERY_SPOTTER_PROBE_REPLAY_VERSION,
    executable: false, header: expectedHeader(digest(initialState)),
    initialScenario: clone(artilleryCoreProbeScenario), initialSeed: seed,
    commands: clone(commands), commandsDigest: digest(commands),
    traceDigest: digest(playback.steps)}).envelope;
}

export function validateArtillerySpotterProbeReplay(envelope) {
  return inspect(envelope).envelope;
}

export function playArtillerySpotterProbeReplay(envelope) {
  return inspect(envelope).playback;
}
