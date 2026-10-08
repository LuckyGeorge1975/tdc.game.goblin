import {createGame, dispatch} from './game-core.mjs';
import {CORE_PROFILE_CONTRACT, profileContractError} from './profile-contract.mjs';
import TerrainRules from '../../terrain-rules-module.mjs';

export const REPLAY_SCHEMA_VERSION = 1;
const headerKeys = ['effectiveRules', 'ruleProfileId', 'rulesVersion', 'scenarioDigest',
  'scenarioId', 'scenarioVersion'];
const envelopeKeys = ['commands', 'header', 'initialScenario', 'initialSeed', 'replaySchemaVersion'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value, keys) => isObject(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

function reject(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function jsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const arrayKeys = Array.isArray(value) ? Object.keys(value) : [];
  const valid = (!Array.isArray(value) ||
    arrayKeys.length === value.length && arrayKeys.every((key, index) => key === String(index))) &&
    (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null) &&
    Object.values(value).every(item => jsonValue(item, seen));
  seen.delete(value);
  return valid;
}

const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : isObject(value)
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);

// Drift check for a self-contained snapshot, not an authenticity signature.
function scenarioDigest(snapshot) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical(snapshot))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

function validScenario(snapshot) {
  if (!keysAre(snapshot, ['map', 'units']) ||
      !keysAre(snapshot.map, ['height', 'terrain', 'width']) ||
      !Number.isInteger(snapshot.map.width) || snapshot.map.width < 1 ||
      !Number.isInteger(snapshot.map.height) || snapshot.map.height < 1 ||
      !Array.isArray(snapshot.map.terrain) || !Array.isArray(snapshot.units) ||
      !snapshot.units.length) return false;
  const inside = point => Number.isInteger(point?.x) && Number.isInteger(point?.y) &&
    point.x >= 0 && point.y >= 0 && point.x < snapshot.map.width && point.y < snapshot.map.height;
  const unitIds = new Set();
  for (const terrain of snapshot.map.terrain)
    if (!inside(terrain) || !Object.hasOwn(TerrainRules.rules, terrain.type)) return false;
  for (const unit of snapshot.units) {
    if (!isObject(unit) || typeof unit.id !== 'string' || !unit.id || unitIds.has(unit.id) ||
        !inside(unit) || !['player', 'enemy'].includes(unit.team) ||
        !Number.isInteger(unit.hp) || unit.hp < 1 ||
        !Number.isInteger(unit.maxHp) || unit.maxHp < unit.hp ||
        !Number.isInteger(unit.defense) || unit.defense < 1 ||
        !Number.isInteger(unit.move) || unit.move < 0 ||
        !Number.isInteger(unit.range) || unit.range < 0 ||
        !Number.isInteger(unit.damage) || unit.damage < 0) return false;
    unitIds.add(unit.id);
  }
  return true;
}

function validCommand(command) {
  if (!isObject(command) || !['player', 'enemy'].includes(command.playerId)) return false;
  if (command.type === 'EndPhase') return keysAre(command, ['type', 'playerId']);
  if (command.type === 'Fire') return keysAre(command, ['type', 'playerId', 'unitId', 'targetId']) &&
    typeof command.unitId === 'string' && !!command.unitId &&
    typeof command.targetId === 'string' && !!command.targetId;
  if (command.type === 'Move') return keysAre(command, ['type', 'playerId', 'unitId', 'to']) &&
    typeof command.unitId === 'string' && !!command.unitId &&
    keysAre(command.to, ['x', 'y']) && Number.isInteger(command.to.x) && Number.isInteger(command.to.y);
  return false;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function validateProfileReplay(envelope) {
  if (!jsonValue(envelope) || !isObject(envelope))
    reject('REPLAY_PROFILE_MISMATCH', 'invalid replay envelope');
  if (envelope.replaySchemaVersion !== REPLAY_SCHEMA_VERSION)
    reject('UNSUPPORTED_REPLAY_VERSION', String(envelope.replaySchemaVersion));
  if (!keysAre(envelope, envelopeKeys))
    reject('REPLAY_PROFILE_MISMATCH', 'invalid replay envelope');
  const {header, initialScenario, initialSeed, commands} = envelope;
  if (!keysAre(header, headerKeys) || header.rulesVersion !== CORE_PROFILE_CONTRACT.rulesVersion ||
      profileContractError(header))
    reject('REPLAY_PROFILE_MISMATCH', 'only the exact core-v3 profile probe is supported');
  if (!uint32(initialSeed) || !validScenario(initialScenario) ||
      header.scenarioDigest !== scenarioDigest(initialScenario) ||
      !Array.isArray(commands) || !commands.every(validCommand))
    reject('REPLAY_PROFILE_MISMATCH', 'seed, scenario snapshot, or commands differ');
  return deepFreeze(JSON.parse(JSON.stringify(envelope)));
}

export function recordProfileReplay(scenario, seed, commands) {
  if (profileContractError(scenario) || scenario?.rulesVersion !== CORE_PROFILE_CONTRACT.rulesVersion)
    reject('REPLAY_PROFILE_MISMATCH', 'only the exact core-v3 profile probe is supported');
  const initialScenario = {map: scenario.map, units: scenario.units};
  return validateProfileReplay({replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    header: {...CORE_PROFILE_CONTRACT, scenarioDigest: scenarioDigest(initialScenario)},
    initialScenario, initialSeed: seed, commands});
}

export function playProfileReplay(envelope) {
  const replay = validateProfileReplay(envelope);
  const scenario = {...replay.header, map: replay.initialScenario.map, units: replay.initialScenario.units};
  const initialState = createGame(scenario, replay.initialSeed);
  let state = initialState;
  const steps = replay.commands.map(command => {
    const result = dispatch(state, command);
    if (result.state) state = result.state;
    return {command, result};
  });
  return {initialState, steps, finalState: state};
}
