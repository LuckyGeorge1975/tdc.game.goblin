import {hexDistance} from './hex.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from './iron-dust-legacy-los-probe.mjs';
import {IRON_DUST_WEAPON_PROBE_VERSION, createIronDustWeaponProbe,
  validateIronDustWeaponProbe, queryIronDustWeapon} from './iron-dust-weapon-probe.mjs';

export const IRON_DUST_ATTACK_PREFLIGHT_VERSION = 'iron-dust-siegebreaker-attack-preflight-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const original = source.units.find(unit => unit.id === 'ogre');
const fixtures = Object.freeze({source: {x: original.x, y: original.y},
  boundary: {x: 2, y: 0}});
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const denied = code => ({available: false, error: {code}});
const reject = code => {throw Object.assign(new Error(code), {code})};

export function createIronDustAttackPreflightProbe(seed, options = {}) {
  if (!u32(seed)) reject('ATTACK_PREFLIGHT_SETUP_INVALID');
  const {fixture = 'source', phase = 'fire', weaponState = createIronDustWeaponProbe(seed)} = options ?? {};
  if (!Object.hasOwn(fixtures, fixture) ||
      !['movement', 'fire', 'gev'].includes(phase)) reject('ATTACK_PREFLIGHT_SETUP_INVALID');
  validateIronDustWeaponProbe(weaponState);
  if (weaponState.rng.seed !== seed) reject('ATTACK_PREFLIGHT_SETUP_INVALID');
  return freeze({
    probeVersion: IRON_DUST_ATTACK_PREFLIGHT_VERSION,
    executable: false,
    sourceDataVersion: source.dataContractVersion,
    sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId,
    losProbeVersion: IRON_DUST_LEGACY_LOS_PROBE_V1.probeVersion,
    weaponProbeVersion: IRON_DUST_WEAPON_PROBE_VERSION,
    fixture,
    phase,
    activeTeam: 'player',
    attacker: {id: original.id, team: original.team, hp: original.hp,
      ...fixtures[fixture]},
    weaponState: clone(weaponState)
  });
}

export function validateIronDustAttackPreflightProbe(state) {
  if (!state || Object.keys(state).length !== 12 ||
      state.probeVersion !== IRON_DUST_ATTACK_PREFLIGHT_VERSION || state.executable !== false ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceScenarioId !== source.scenarioId || state.sourceRuleProfileId !== source.ruleProfileId ||
      state.losProbeVersion !== IRON_DUST_LEGACY_LOS_PROBE_V1.probeVersion ||
      state.weaponProbeVersion !== IRON_DUST_WEAPON_PROBE_VERSION ||
      !Object.hasOwn(fixtures, state.fixture) ||
      !['movement', 'fire', 'gev'].includes(state.phase) || state.activeTeam !== 'player' ||
      !same(state.attacker, {id: original.id, team: original.team,
        hp: original.hp, ...fixtures[state.fixture]})) reject('ATTACK_PREFLIGHT_MISMATCH');
  validateIronDustWeaponProbe(state.weaponState);
  return state;
}

function check(state, command) {
  validateIronDustAttackPreflightProbe(state);
  if (!command || command.type !== 'Fire') return denied('ATTACK_COMMAND_INVALID');
  if (command.playerId !== state.activeTeam) return denied('NOT_ACTIVE_TEAM');
  if (command.unitId !== state.attacker.id) return denied('ATTACK_ACTOR_INVALID');
  if (state.phase !== 'fire') return denied('WRONG_PHASE');
  if (command.weaponKey !== state.weaponState.selectedWeapon) return denied('WEAPON_NOT_SELECTED');
  const weapon = queryIronDustWeapon(state.weaponState, command.weaponKey);
  if (!weapon.available) return denied(weapon.error?.code ?? 'WEAPON_NOT_READY');
  const target = command.target;
  if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) ||
      target.x < 0 || target.y < 0 || target.x >= source.map.width || target.y >= source.map.height ||
      target.team !== 'enemy' || !Number.isInteger(target.hp) || target.hp <= 0)
    return denied('WEAPON_TARGET_INVALID');
  if (hexDistance(state.attacker, target) > weapon.range) return denied('WEAPON_OUT_OF_RANGE');
  if (!hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, state.attacker, target))
    return denied('WEAPON_SIGHT_BLOCKED');
  if (weapon.infantryOnly && target.infantry !== true && target.engineering !== true)
    return denied('WEAPON_INFANTRY_ONLY');
  return {available: true, attack: weapon.attack, range: weapon.range, ready: weapon.ready,
    losMode: IRON_DUST_LEGACY_LOS_PROBE_V1.losMode};
}

export function queryIronDustAttackProbe(state, command) {
  return check(state, command);
}

export function queryIronDustAttackSurface(state, targets) {
  validateIronDustAttackPreflightProbe(state);
  if (!Array.isArray(targets)) return {error: {code: 'ATTACK_TARGET_SET_INVALID'}};
  const weaponKey = state.weaponState.selectedWeapon;
  return {weaponKey, entries: targets.map((target, index) => ({index,
    ...check(state, {type: 'Fire', playerId: 'player', unitId: 'ogre', weaponKey, target})}))};
}

// Preflight only. No budget, hit, HP, system or RNG transition is performed.
export function preflightIronDustFireProbe(state, command) {
  return check(state, command);
}
