import {hexDistance} from './hex.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from './iron-dust-legacy-los-probe.mjs';

export const IRON_DUST_WEAPON_PROBE_VERSION = 'iron-dust-siegebreaker-weapons-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const attacker = source.units.find(unit => unit.id === 'ogre');
const initialWeapons = attacker.ogreSystems.weapons;
const keys = Object.keys(initialWeapons);
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const own = (value, key) => Object.hasOwn(value, key);
const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const names = Object.keys(expected);
  return Object.keys(actual).length === names.length &&
    names.every(key => own(actual, key) && same(actual[key], expected[key]));
};
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function ready(weapon) {
  const remaining = Math.max(0, Math.min(weapon.remaining, weapon.count - weapon.destroyed));
  return weapon.expendable ? remaining : Math.max(0, remaining - weapon.firedThisPhase);
}

export function createIronDustWeaponProbe(seed) {
  if (!u32(seed)) reject('WEAPON_PROBE_SEED_INVALID');
  return freeze({
    probeVersion: IRON_DUST_WEAPON_PROBE_VERSION,
    executable: false,
    sourceDataVersion: source.dataContractVersion,
    sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId,
    unitId: attacker.id,
    cycle: 1,
    selectedWeapon: attacker.ogreSystems.selectedWeapon,
    weapons: clone(initialWeapons),
    rng: {seed, state: seed}
  });
}

export function validateIronDustWeaponProbe(state) {
  if (!state || Object.keys(state).length !== 10 ||
      state.probeVersion !== IRON_DUST_WEAPON_PROBE_VERSION || state.executable !== false ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceScenarioId !== source.scenarioId ||
      state.sourceRuleProfileId !== source.ruleProfileId || state.unitId !== attacker.id ||
      !Number.isInteger(state.cycle) || state.cycle < 1 ||
      !keys.includes(state.selectedWeapon) ||
      !state.rng || Object.keys(state.rng).length !== 2 ||
      !u32(state.rng.seed) || state.rng.state !== state.rng.seed ||
      !state.weapons || Object.keys(state.weapons).length !== keys.length ||
      !keys.every(key => {
        const weapon = state.weapons[key], initial = initialWeapons[key];
        if (!weapon || Object.keys(weapon).length !== Object.keys(initial).length ||
            !Number.isInteger(weapon.remaining) || weapon.remaining < 0 ||
            weapon.remaining > initial.count ||
            !Number.isInteger(weapon.firedThisPhase) || weapon.firedThisPhase < 0 ||
            weapon.firedThisPhase > initial.count) return false;
        const expected = {...initial, remaining: weapon.remaining,
          firedThisPhase: weapon.firedThisPhase};
        return same(weapon, expected) && weapon.destroyed === 0 &&
          (weapon.expendable ? weapon.firedThisPhase === 0 : weapon.remaining === initial.count);
      })) reject('WEAPON_PROBE_MISMATCH');
  return state;
}

export function queryIronDustWeapon(state, weaponKey) {
  validateIronDustWeaponProbe(state);
  if (!own(state.weapons, weaponKey)) return {available: false, error: {code: 'WEAPON_UNKNOWN'}};
  const weapon = state.weapons[weaponKey];
  return {available: ready(weapon) > 0, ready: ready(weapon),
    attack: weapon.attack, range: weapon.range, infantryOnly: weapon.infantryOnly === true};
}

export function queryIronDustWeaponTarget(state, weaponKey, target) {
  const weapon = queryIronDustWeapon(state, weaponKey);
  if (!weapon.available) return {available: false, error: weapon.error ?? {code: 'WEAPON_NOT_READY'}};
  if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) ||
      target.x < 0 || target.y < 0 || target.x >= source.map.width || target.y >= source.map.height ||
      target.team !== 'enemy' || !Number.isInteger(target.hp) || target.hp <= 0)
    return {available: false, error: {code: 'WEAPON_TARGET_INVALID'}};
  if (hexDistance(attacker, target) > weapon.range)
    return {available: false, error: {code: 'WEAPON_OUT_OF_RANGE'}};
  if (!hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, attacker, target))
    return {available: false, error: {code: 'WEAPON_SIGHT_BLOCKED'}};
  if (weapon.infantryOnly && target.infantry !== true && target.engineering !== true)
    return {available: false, error: {code: 'WEAPON_INFANTRY_ONLY'}};
  return {available: true};
}

// Inventory transitions only. No combat roll, hit, HP or system defense occurs.
export function dispatchIronDustWeaponProbe(state, command) {
  validateIronDustWeaponProbe(state);
  if (!command || typeof command.type !== 'string') return {error: {code: 'WEAPON_COMMAND_INVALID'}};
  if (command.type === 'SelectWeapon') {
    const query = queryIronDustWeapon(state, command.weaponKey);
    if (!query.available) return {error: query.error ?? {code: 'WEAPON_NOT_READY'}};
    const next = clone(state);
    next.selectedWeapon = command.weaponKey;
    return {state: freeze(next), events: [{type: 'WeaponSelected', weaponKey: command.weaponKey,
      attack: query.attack, range: query.range, ready: query.ready}]};
  }
  if (command.type === 'SpendWeaponBudget') {
    if (command.weaponKey !== state.selectedWeapon)
      return {error: {code: 'WEAPON_NOT_SELECTED'}};
    const query = queryIronDustWeapon(state, command.weaponKey);
    if (!query.available) return {error: query.error ?? {code: 'WEAPON_NOT_READY'}};
    const next = clone(state), weapon = next.weapons[command.weaponKey];
    if (weapon.expendable) weapon.remaining--;
    else weapon.firedThisPhase++;
    return {state: freeze(next), events: [{type: 'WeaponBudgetSpent',
      weaponKey: command.weaponKey, readyBefore: query.ready, readyAfter: ready(weapon)}]};
  }
  if (command.type === 'ResetWeaponPhase') {
    const next = clone(state);
    for (const weapon of Object.values(next.weapons)) weapon.firedThisPhase = 0;
    next.cycle++;
    if (!ready(next.weapons[next.selectedWeapon]))
      next.selectedWeapon = keys.find(key => ready(next.weapons[key])) ?? 'main';
    return {state: freeze(next), events: [{type: 'WeaponPhaseReset', cycle: next.cycle}]};
  }
  return {error: {code: 'WEAPON_COMMAND_UNSUPPORTED'}};
}
