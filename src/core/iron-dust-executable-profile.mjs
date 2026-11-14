import TerrainRules from '../../terrain-rules-module.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from
  '../levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEVEL_V3} from '../levels/iron-dust.v3.mjs';
import {validateIronDustLevelV3} from '../levels/iron-dust.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1} from './iron-dust-legacy-los-probe.mjs';
import {IRON_DUST_ZERO_TREADS_STATE_VERSION,
  IRON_DUST_ZERO_TREADS_POLICY_VERSION, IRON_DUST_FIRE_GEOMETRY_VERSION,
  queryIronDustFireGeometry} from
  './iron-dust-unified-state-probe.mjs';
import {ironDustCrtRatio} from './iron-dust-crt-ratio.mjs';
import {IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION,queryIronDustEnemyMoveChoice} from
  './iron-dust-enemy-turn-controller-probe.mjs?v=2';
import {IRON_DUST_PLAYER_MOVE_PROBE_VERSION} from './iron-dust-player-move-probe.mjs';
import {IRON_DUST_STANDARD_FIRE_ACTION_VERSION} from
  './iron-dust-standard-fire-action-probe.mjs';
import {IRON_DUST_B3B_ACTION_VERSION} from './iron-dust-b3b-action-probe.mjs';
import {effectiveIronDustDifficulty, ironDustEnemyPolicy, validIronDustEnemyPolicy} from './iron-dust-enemy-policy.mjs';
export {IRON_DUST_ENEMY_DIFFICULTIES} from './iron-dust-enemy-policy.mjs';
import {IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION,
  createIronDustZeroTreadsSourceActionEntry, validateIronDustSourceActionEntry,
  queryIronDustSourceActionEntry, dispatchIronDustSourceActionEntry, dispatchIronDustSourceEnemyFireChoice,
  dispatchIronDustSourceEnemyMoveChoice} from
  './iron-dust-source-action-entry-probe.mjs?v=2';

// Internal executable profile boundary; no browser, level picker or replay import.
export const IRON_DUST_PROFILE_VERSION = 'core-iron-dust-profile-v1';
export const IRON_DUST_PROFILE_PROJECTION_VERSION = 'core-iron-dust-projection-v1';
export const IRON_DUST_ENEMY_DECISION_TRACE_VERSION = 1;
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
const headerFor = (policy, minimumDifficulty) => ({
  ...IRON_DUST_PROFILE_HEADER,
  ...(policy ? {enemyPolicy:policy} : {}),
  ...(minimumDifficulty === undefined ? {} : {minimumDifficulty})
});
const wrap = (entry, sourceStartDigest, policy, minimumDifficulty) => {
  const copy = clone(entry), header = clone(headerFor(policy, minimumDifficulty));
  return freeze({profileVersion: IRON_DUST_PROFILE_VERSION, executable: true,
    header, sourceStartDigest, entry: copy,
    digest: stamp(header, sourceStartDigest, copy)});
};

export function createIronDustProfile(seed, {difficulty = 'medium', minimumDifficulty, level = IRON_DUST_LEVEL_V3} = {}) {
  const levelMinimum = validateIronDustLevelV3(level).minimumDifficulty;
  if (levelMinimum !== undefined) minimumDifficulty = effectiveIronDustDifficulty(levelMinimum,minimumDifficulty);
  const policy = ironDustEnemyPolicy(effectiveIronDustDifficulty(difficulty,minimumDifficulty));
  const entry = createIronDustZeroTreadsSourceActionEntry(seed);
  return wrap(entry, digest(entry), policy, minimumDifficulty);
}

export function validateIronDustProfile(profile) {
  try {
    const policy = profile?.header?.enemyPolicy ?? null;
    const minimumDifficulty = profile?.header?.minimumDifficulty;
    const difficulty = policy?.difficulty ?? 'medium';
    if (!exact(profile, ['profileVersion', 'executable', 'header',
      'sourceStartDigest', 'entry', 'digest']) ||
        profile.profileVersion !== IRON_DUST_PROFILE_VERSION ||
        profile.executable !== true ||
        !validIronDustEnemyPolicy(policy) ||
        effectiveIronDustDifficulty(difficulty,minimumDifficulty) !== difficulty ||
        JSON.stringify(profile.header) !== JSON.stringify(headerFor(policy,minimumDifficulty)) ||
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
          (profile.entry.payload.controllerVersion !== IRON_DUST_PROFILE_HEADER.controllerVersion ||
            JSON.stringify(profile.entry.payload.enemyPolicy ?? null) !== JSON.stringify(policy)) ||
        profile.sourceStartDigest !== digest(start)) fail();
  } catch {fail()}
  return profile;
}

export function queryIronDustProfile(profile, command, decisionTrace) {
  try {validateIronDustProfile(profile)}
  catch {return deny('IRON_DUST_PROFILE_MISMATCH')}
  return queryIronDustSourceActionEntry(profile.entry, command, decisionTrace);
}

// This describes only the directly selected player target. The legal query remains
// the authority for phase, weapon, range, sight, and available resources.
export function queryIronDustCrtPreview(profile, command) {
  if (command?.type !== 'PlayerFire') return null;
  const query = queryIronDustProfile(profile, command);
  if (!query.available) return null;
  const state = stateOf(profile.entry);
  const actor = state.units.find(unit => unit.id === command.unitId);
  const target = state.units.find(unit => unit.id === command.targetId);
  if (!actor || !target) return null;
  const geometry = command.unitId === 'ogre' ? queryIronDustFireGeometry(state,
    actor.id, target.id, query.range, {outOfRange: 'WEAPON_OUT_OF_RANGE',
      sightBlocked: 'WEAPON_SIGHT_BLOCKED'}) : null;
  const effectiveDefense = command.unitId === 'ogre'
    ? geometry?.available ? target.defense + geometry.cover : null
    : query.effectiveDefense;
  const ratioCategory = Number.isFinite(query.attack) && Number.isFinite(effectiveDefense)
    ? ironDustCrtRatio(query.attack, effectiveDefense) : null;
  return Object.freeze({profileId: profile.header.ruleProfileId,
    stateRevision: profile.digest, actorId: actor.id, targetId: target.id,
    weaponKey: command.weaponKey ?? null, from: {x: actor.x, y: actor.y},
    to: {x: target.x, y: target.y}, legal: true, ratioCategory,
    meaning: 'crt-attack-effective-defense'});
}

export function preflightIronDustProfile(profile, command) {
  return queryIronDustProfile(profile, command);
}

export function dispatchIronDustProfile(profile, command) {
  const query = queryIronDustProfile(profile, command);
  if (!query.available) return {error: query.error};
  const policy = profile.header.enemyPolicy ?? null;
  return applyEntryResult(profile, dispatchIronDustSourceActionEntry(profile.entry, command, policy));
}

// Explicit enemy target choice is opt-in. Existing browser and replay commands
// continue to use dispatchIronDustProfile and its versioned automatic policy.
export function dispatchIronDustProfileEnemyFireChoice(profile, command) {
  try {validateIronDustProfile(profile)}
  catch {return {error: {code: 'IRON_DUST_PROFILE_MISMATCH'}}}
  return applyEntryResult(profile, dispatchIronDustSourceEnemyFireChoice(profile.entry, command));
}

export function queryIronDustProfileEnemyMoveChoice(profile,command) {
  try {validateIronDustProfile(profile)}
  catch {return deny('IRON_DUST_PROFILE_MISMATCH')}
  if (profile.entry.mode==='ended') return deny('GAME_ENDED');
  if (profile.entry.mode!=='enemy') return deny('WRONG_PHASE');
  return queryIronDustEnemyMoveChoice(profile.entry.payload,command);
}

export function dispatchIronDustProfileEnemyMoveChoice(profile,command) {
  try {validateIronDustProfile(profile)}
  catch {return {error:{code:'IRON_DUST_PROFILE_MISMATCH'}}}
  if (profile.entry.mode==='ended') return {error:{code:'GAME_ENDED'}};
  return applyEntryResult(profile,dispatchIronDustSourceEnemyMoveChoice(profile.entry,command));
}

function applyEntryResult(profile, result) {
  if (!result.entry) return {error: result.error};
  const next = wrap(result.entry, profile.sourceStartDigest, profile.header.enemyPolicy ?? null,
    profile.header.minimumDifficulty);
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
