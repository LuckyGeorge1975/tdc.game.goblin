import {IRON_DUST_PROFILE_VERSION, IRON_DUST_PROFILE_HEADER,
  IRON_DUST_PROFILE_PROJECTION_VERSION, createIronDustProfile,
  validateIronDustProfile, queryIronDustProfile, dispatchIronDustProfile,
  projectIronDustProfile} from './iron-dust-executable-profile.mjs';

// Internal v2 source replay. This does not extend schema-1 or expose file I/O.
export const IRON_DUST_PROFILE_REPLAY_VERSION = 'iron-dust-profile-replay-v1';
export const IRON_DUST_PROFILE_EVENT_CODEC_VERSION = 'iron-dust-source-events-v2';
const actors = ['ogre', 'gev', 'missile', 'infantry'];
const targets = ['core', 'guard', 'raider'];
const weapons = ['main', 'secondary', 'missiles', 'antipersonnel'];
const envelopeKeys = ['replayVersion', 'executable', 'header', 'initialSeed',
  'initialSnapshot', 'commands', 'commandsDigest', 'checkpoints', 'traceDigest'];
const headerKeys = ['profileVersion', 'profileHeader', 'projectionVersion',
  'eventCodecVersion', 'controllerVersion', 'targetPolicyVersion',
  'initialSnapshotDigest'];
const checkpointKeys = ['commandIndex', 'turn', 'phase', 'mode', 'rngState',
  'entryDigest', 'stateDigest', 'eventsDigest'];
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
const stateOf = profile => profile.entry.mode === 'enemy'
  ? profile.entry.payload.state : profile.entry.payload;
const expectedHeader = initialSnapshot => ({
  profileVersion: IRON_DUST_PROFILE_VERSION,
  profileHeader: clone(IRON_DUST_PROFILE_HEADER),
  projectionVersion: IRON_DUST_PROFILE_PROJECTION_VERSION,
  eventCodecVersion: IRON_DUST_PROFILE_EVENT_CODEC_VERSION,
  controllerVersion: IRON_DUST_PROFILE_HEADER.controllerVersion,
  targetPolicyVersion: IRON_DUST_PROFILE_HEADER.targetPolicyVersion,
  initialSnapshotDigest: digest(initialSnapshot)
});
function validCommand(command) {
  if (command?.type === 'AutoEnemyAdvance')
    return exact(command, ['type', 'playerId']) && command.playerId === 'enemy';
  if (command?.type === 'EndPhase')
    return exact(command, ['type', 'playerId']) && command.playerId === 'player';
  if (command?.type === 'Move')
    return exact(command, ['type', 'playerId', 'unitId', 'to']) &&
      command.playerId === 'player' && actors.includes(command.unitId) &&
      exact(command.to, ['x', 'y']) &&
      Number.isInteger(command.to.x) && Number.isInteger(command.to.y);
  if (command?.type === 'Ram')
    return exact(command, ['type', 'playerId', 'unitId', 'targetId']) &&
      command.playerId === 'player' && command.unitId === 'ogre' &&
      ['guard', 'raider'].includes(command.targetId);
  if (command?.type === 'SelectWeapon')
    return exact(command, ['type', 'playerId', 'unitId', 'weaponKey']) &&
      command.playerId === 'player' && command.unitId === 'ogre' &&
      weapons.includes(command.weaponKey);
  if (command?.type !== 'PlayerFire') return false;
  const ogre = command.unitId === 'ogre';
  return exact(command, ogre
    ? ['type', 'playerId', 'unitId', 'targetId', 'weaponKey']
    : ['type', 'playerId', 'unitId', 'targetId']) &&
    command.playerId === 'player' && actors.includes(command.unitId) &&
    targets.includes(command.targetId) && (!ogre || weapons.includes(command.weaponKey));
}
function simulate(initialSnapshot, commands) {
  let profile = initialSnapshot;
  const steps = [], checkpoints = [];
  for (const [commandIndex, command] of commands.entries()) {
    const allowed = queryIronDustProfile(profile, command);
    if (!allowed.available) reject('IRON_DUST_REPLAY_COMMAND_REJECTED');
    const result = dispatchIronDustProfile(profile, command);
    if (!result.profile || !Array.isArray(result.events))
      reject('IRON_DUST_REPLAY_COMMAND_REJECTED');
    profile = result.profile;
    const state = stateOf(profile);
    const checkpoint = {commandIndex, turn: state.turn, phase: state.phase,
      mode: profile.entry.mode, rngState: state.rng.state,
      entryDigest: profile.entry.digest, stateDigest: profile.digest,
      eventsDigest: digest(result.events)};
    checkpoints.push(checkpoint);
    steps.push({commandIndex, command: clone(command),
      events: clone(result.events), state: projectIronDustProfile(profile),
      checkpoint});
  }
  return {initialState: projectIronDustProfile(initialSnapshot),
    steps, finalState: projectIronDustProfile(profile), checkpoints};
}
function inspect(envelope) {
  if (!jsonValue(envelope) || !exact(envelope, envelopeKeys) ||
      envelope.replayVersion !== IRON_DUST_PROFILE_REPLAY_VERSION ||
      envelope.executable !== false || !exact(envelope.header, headerKeys) ||
      !uint32(envelope.initialSeed) || !Array.isArray(envelope.commands) ||
      !envelope.commands.every(validCommand) ||
      !Array.isArray(envelope.checkpoints) ||
      envelope.checkpoints.length !== envelope.commands.length ||
      !envelope.checkpoints.every((point, index) =>
        exact(point, checkpointKeys) && point.commandIndex === index))
    reject('IRON_DUST_REPLAY_MISMATCH');
  const start = createIronDustProfile(envelope.initialSeed);
  if (canonical(envelope.initialSnapshot) !== canonical(start) ||
      canonical(envelope.header) !== canonical(expectedHeader(start)) ||
      envelope.commandsDigest !== digest(envelope.commands) ||
      envelope.traceDigest !== digest(envelope.checkpoints))
    reject('IRON_DUST_REPLAY_MISMATCH');
  validateIronDustProfile(start);
  const playback = simulate(start, envelope.commands);
  if (canonical(playback.checkpoints) !== canonical(envelope.checkpoints))
    reject('IRON_DUST_REPLAY_MISMATCH');
  return {envelope: freeze(clone(envelope)), playback: freeze(playback)};
}

export function recordIronDustProfileReplay(seed, commands) {
  if (!uint32(seed) || !Array.isArray(commands) ||
      !jsonValue(commands) || !commands.every(validCommand))
    reject('IRON_DUST_REPLAY_MISMATCH');
  const start = createIronDustProfile(seed);
  const playback = simulate(start, commands);
  return inspect({replayVersion: IRON_DUST_PROFILE_REPLAY_VERSION,
    executable: false, header: expectedHeader(start), initialSeed: seed,
    initialSnapshot: clone(start), commands: clone(commands),
    commandsDigest: digest(commands), checkpoints: playback.checkpoints,
    traceDigest: digest(playback.checkpoints)}).envelope;
}

export function validateIronDustProfileReplay(envelope) {
  return inspect(envelope).envelope;
}

export function playIronDustProfileReplay(envelope) {
  return inspect(envelope).playback;
}
