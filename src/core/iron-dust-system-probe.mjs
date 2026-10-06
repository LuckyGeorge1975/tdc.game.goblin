import TerrainRules from '../../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';

export const IRON_DUST_SYSTEM_PROBE_VERSION = 'iron-dust-siegebreaker-systems-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const original = source.units.find(unit => unit.id === 'ogre');
const enemyById = Object.fromEntries(source.units.filter(unit => unit.team === 'enemy').map(unit => [unit.id, unit]));
const weaponKeys = Object.keys(original.ogreSystems.weapons);
const targetPriority = ['missiles', 'main', 'secondary', 'treads', 'antipersonnel'];
const crt = {
  '1-2': ['NE', 'NE', 'NE', 'NE', 'D', 'X'],
  '1-1': ['NE', 'NE', 'D', 'D', 'D', 'X'],
  '2-1': ['NE', 'D', 'D', 'X', 'X', 'X'],
  '3-1': ['D', 'D', 'X', 'X', 'X', 'X'],
  '4-1': ['D', 'X', 'X', 'X', 'X', 'X']
};
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
const reject = code => {throw Object.assign(new Error(code), {code})};
const remaining = weapon => Math.max(0, Math.min(weapon.remaining, weapon.count - weapon.destroyed));
const movement = treads => treads >= 31 ? 3 : treads >= 16 ? 2 : treads > 0 ? 1 : 0;
const helpless = unit => unit.ogreSystems.treads <= 0 &&
  Object.values(unit.ogreSystems.weapons).every(weapon => remaining(weapon) <= 0);
const available = state => [...weaponKeys.filter(key => remaining(state.weapons[key]) > 0), 'treads'];
const terrain = source.map.terrain.find(cell => cell.x === original.x && cell.y === original.y)?.type ?? source.map.defaultTerrain;

function ratio(attack, defense) {
  const strength = Math.max(0, attack), guarded = Math.max(1, defense);
  if (strength >= guarded * 5) return '5-1';
  if (strength * 2 < guarded) return '1-2';
  return `${Math.min(4, Math.max(1, Math.floor(strength / guarded)))}-1`;
}

export function createIronDustSystemProbe(seed) {
  if (!u32(seed)) reject('SYSTEM_PROBE_SEED_INVALID');
  return freeze({
    probeVersion: IRON_DUST_SYSTEM_PROBE_VERSION,
    executable: false,
    sourceDataVersion: source.dataContractVersion,
    sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId,
    unit: clone(original),
    rng: {seed, state: seed}
  });
}

export function validateIronDustSystemProbe(state) {
  const unit = state?.unit, systems = unit?.ogreSystems;
  if (!state || Object.keys(state).length !== 7 ||
      state.probeVersion !== IRON_DUST_SYSTEM_PROBE_VERSION || state.executable !== false ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceScenarioId !== source.scenarioId || state.sourceRuleProfileId !== source.ruleProfileId ||
      !state.rng || Object.keys(state.rng).length !== 2 ||
      !u32(state.rng.seed) || !u32(state.rng.state) ||
      !unit || !systems || !systems.weapons || typeof systems.weapons !== 'object' ||
      !Number.isInteger(unit.hp) || unit.hp < 0 || unit.hp > original.hp ||
      !Number.isInteger(systems.treads) || systems.treads < 0 || systems.treads > systems.maxTreads ||
      !same({...unit, hp: original.hp, move: original.move,
        ogreSystems: {...systems, treads: original.ogreSystems.treads,
          weapons: original.ogreSystems.weapons}}, original) ||
      !same({...systems, treads: original.ogreSystems.treads,
        weapons: original.ogreSystems.weapons}, original.ogreSystems) ||
      !same(Object.keys(systems.weapons), weaponKeys) ||
      !weaponKeys.every(key => {
        const weapon = systems.weapons[key], initial = original.ogreSystems.weapons[key];
        return weapon && Number.isInteger(weapon.destroyed) &&
          weapon.destroyed >= 0 && weapon.destroyed <= initial.count &&
          same({...weapon, destroyed: initial.destroyed}, initial);
      }) || unit.move !== movement(systems.treads) ||
      (helpless(unit) ? unit.hp !== 0 : unit.hp !== original.hp)) reject('SYSTEM_PROBE_MISMATCH');
  return state;
}

export function queryIronDustSystemProbe(state) {
  validateIronDustSystemProbe(state);
  const unit = state.unit, systems = unit.ogreSystems;
  return {targets: available(systems), treads: systems.treads, movement: unit.move,
    hp: unit.hp, helpless: helpless(unit), weapons: Object.fromEntries(weaponKeys.map(key =>
      [key, remaining(systems.weapons[key])]))};
}

// Diagnostic resolution only: target selection and system effects after an assumed attack.
// This does not check range, LOS, phase or Fire eligibility.
export function dispatchIronDustSystemProbe(state, command) {
  validateIronDustSystemProbe(state);
  if (!command || command.type !== 'ResolveSystemAttack')
    return {error: {code: 'SYSTEM_COMMAND_UNSUPPORTED'}};
  if (!Object.hasOwn(enemyById, command.attackerId) ||
      enemyById[command.attackerId].hp <= 0 || enemyById[command.attackerId].damage <= 0)
    return {error: {code: 'SYSTEM_ATTACKER_INVALID'}};
  if (state.unit.hp <= 0) return {error: {code: 'SYSTEM_TARGET_HELPLESS'}};
  const targets = available(state.unit.ogreSystems);
  const targetKey = command.targetKey === undefined ? targetPriority.find(key => targets.includes(key)) : command.targetKey;
  if (!targets.includes(targetKey)) return {error: {code: 'SYSTEM_TARGET_INVALID'}};

  const next = clone(state), systems = next.unit.ogreSystems;
  next.rng.state = (Math.imul(1664525, next.rng.state) + 1013904223) >>> 0;
  const roll = next.rng.state % 6, attack = enemyById[command.attackerId].damage;
  const isTreads = targetKey === 'treads';
  const defense = isTreads ? null : systems.weapons[targetKey].defense;
  const combatRatio = isTreads ? '1-1' : ratio(attack, defense + TerrainRules.coverBonus(terrain));
  const result = isTreads ? (roll >= 4 ? 'X' : 'NE') :
    (combatRatio === '5-1' ? 'X' : crt[combatRatio][roll]);
  const loss = result === 'X' ? (isTreads ? Math.min(systems.treads, attack) : 1) : 0;
  if (isTreads) systems.treads -= loss;
  else systems.weapons[targetKey].destroyed += loss;
  next.unit.move = movement(systems.treads);
  if (helpless(next.unit)) next.unit.hp = 0;
  const remainingAfter = isTreads ? systems.treads : remaining(systems.weapons[targetKey]);
  return {state: freeze(next), events: [{type: 'SystemAttackResolved', attackerId: command.attackerId,
    targetKey, ratio: combatRatio, roll, result, loss, remaining: remainingAfter,
    movement: next.unit.move, hp: next.unit.hp, helpless: helpless(next.unit)}]};
}
