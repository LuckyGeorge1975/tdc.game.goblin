import TerrainRules from '../../terrain-rules-module.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from
  '../levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1} from './iron-dust-legacy-los-probe.mjs';
import {IRON_DUST_ZERO_TREADS_STATE_VERSION,
  IRON_DUST_ZERO_TREADS_POLICY_VERSION, IRON_DUST_FIRE_GEOMETRY_VERSION} from
  './iron-dust-unified-state-probe.mjs';
import {IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION} from
  './iron-dust-enemy-turn-controller-probe.mjs';
import {IRON_DUST_PLAYER_MOVE_PROBE_VERSION} from './iron-dust-player-move-probe.mjs';
import {IRON_DUST_STANDARD_FIRE_ACTION_VERSION} from
  './iron-dust-standard-fire-action-probe.mjs';
import {IRON_DUST_B3B_ACTION_VERSION} from './iron-dust-b3b-action-probe.mjs';
import {IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION,
  createIronDustZeroTreadsSourceActionEntry, validateIronDustSourceActionEntry,
  queryIronDustSourceActionEntry, dispatchIronDustSourceActionEntry} from
  './iron-dust-source-action-entry-probe.mjs';

// Internal executable profile boundary; no browser, level picker or replay import.
export const IRON_DUST_PROFILE_VERSION = 'core-iron-dust-profile-v1';
export const IRON_DUST_PROFILE_PROJECTION_VERSION = 'core-iron-dust-projection-v1';
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
const fail = () => {throw Object.assign(new Error('IRON_DUST_PROFILE_MISMATCH'),
  {code: 'IRON_DUST_PROFILE_MISMATCH'})};
const digest = value => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
};
const stateOf = entry => entry.mode === 'enemy' ? entry.payload.state : entry.payload;
const terrain = Object.fromEntries(['open-ground', 'rubble-field'].map(type => {
  const rule = TerrainRules.rules[type];
  return [type, {cost: rule.cost, cover: rule.cover, blocksLos: rule.blocksLos}];
}));
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
export const IRON_DUST_PROFILE_HEADER = freeze({
  rulesVersion: 'core-iron-dust-v2', scenarioId: 'core-iron-dust',
  scenarioVersion: 'iron-dust-source-v2', ruleProfileId: 'CORE_IRON_DUST_v2',
  sourceScenarioId: source.scenarioId,
  sourceScenarioVersion: source.scenarioVersion,
  sourceRuleProfileId: source.ruleProfileId,
  sourceDataVersion: source.dataContractVersion,
  sourceDataDigest: digest(source), objectiveVersion: source.objectiveVersion,
  objective: source.objective,
  entryVersion: IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION,
  stateVersion: IRON_DUST_ZERO_TREADS_STATE_VERSION,
  controllerVersion: IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION,
  targetPolicyVersion: IRON_DUST_ZERO_TREADS_POLICY_VERSION,
  losVersion: IRON_DUST_LEGACY_LOS_PROBE_V1.losMode,
  terrainVersion: 'iron-dust-source-terrain-v1', terrainDigest: digest(terrain),
  combatVersion: 'iron-dust-source-combat-v2',
  fireGeometryVersion: IRON_DUST_FIRE_GEOMETRY_VERSION,
  playerMoveVersion: IRON_DUST_PLAYER_MOVE_PROBE_VERSION,
  standardFireVersion: IRON_DUST_STANDARD_FIRE_ACTION_VERSION,
  coreFireVersion: IRON_DUST_B3B_ACTION_VERSION
});
const stamp = (header, sourceStartDigest, entry) => digest({
  profileVersion: IRON_DUST_PROFILE_VERSION, header, sourceStartDigest, entry
});
const wrap = (entry, sourceStartDigest) => {
  const copy = clone(entry), header = clone(IRON_DUST_PROFILE_HEADER);
  return freeze({profileVersion: IRON_DUST_PROFILE_VERSION, executable: true,
    header, sourceStartDigest, entry: copy,
    digest: stamp(header, sourceStartDigest, copy)});
};

export function createIronDustProfile(seed) {
  const entry = createIronDustZeroTreadsSourceActionEntry(seed);
  return wrap(entry, digest(entry));
}

export function validateIronDustProfile(profile) {
  try {
    if (!exact(profile, ['profileVersion', 'executable', 'header',
      'sourceStartDigest', 'entry', 'digest']) ||
        profile.profileVersion !== IRON_DUST_PROFILE_VERSION ||
        profile.executable !== true ||
        JSON.stringify(profile.header) !== JSON.stringify(IRON_DUST_PROFILE_HEADER) ||
        profile.digest !== stamp(profile.header, profile.sourceStartDigest,
          profile.entry)) fail();
    validateIronDustSourceActionEntry(profile.entry);
    const state = stateOf(profile.entry);
    const start = createIronDustZeroTreadsSourceActionEntry(state.rng.seed);
    if (profile.entry.entryVersion !== IRON_DUST_PROFILE_HEADER.entryVersion ||
        state.capabilityVersion !== IRON_DUST_PROFILE_HEADER.stateVersion ||
        state.sourceScenarioId !== IRON_DUST_PROFILE_HEADER.sourceScenarioId ||
        state.sourceDataVersion !== IRON_DUST_PROFILE_HEADER.sourceDataVersion ||
        state.targetPolicyVersion !== IRON_DUST_PROFILE_HEADER.targetPolicyVersion ||
        profile.entry.mode === 'enemy' &&
          profile.entry.payload.controllerVersion !==
            IRON_DUST_PROFILE_HEADER.controllerVersion ||
        profile.sourceStartDigest !== digest(start)) fail();
  } catch {fail()}
  return profile;
}

export function queryIronDustProfile(profile, command) {
  try {validateIronDustProfile(profile)}
  catch {return deny('IRON_DUST_PROFILE_MISMATCH')}
  return queryIronDustSourceActionEntry(profile.entry, command);
}

export function preflightIronDustProfile(profile, command) {
  return queryIronDustProfile(profile, command);
}

export function dispatchIronDustProfile(profile, command) {
  const query = queryIronDustProfile(profile, command);
  if (!query.available) return {error: query.error};
  const result = dispatchIronDustSourceActionEntry(profile.entry, command);
  if (!result.entry) return {error: result.error};
  const next = wrap(result.entry, profile.sourceStartDigest);
  validateIronDustProfile(next);
  return {profile: next, events: freeze(clone(result.events))};
}

export function projectIronDustProfile(profile, events = []) {
  validateIronDustProfile(profile);
  if (!Array.isArray(events)) fail();
  const state = stateOf(profile.entry);
  return freeze({projectionVersion: IRON_DUST_PROFILE_PROJECTION_VERSION,
    profileVersion: profile.profileVersion, mode: profile.entry.mode,
    state: clone(state),
    cursor: profile.entry.mode === 'enemy' ? clone(profile.entry.payload.cursor) : null,
    events: clone(events)});
}
