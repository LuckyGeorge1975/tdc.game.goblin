import TerrainRules from '../../terrain-rules.js';
import {hexDistance} from './hex.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from './iron-dust-legacy-los-probe.mjs';

export const IRON_DUST_UNIFIED_STATE_VERSION = 'iron-dust-unified-state-probe-v1';
export const IRON_DUST_NEAR_CORE_FIXTURE_VERSION = 'iron-dust-near-core-fixture-v1';
export const IRON_DUST_REST_OGRE_FIXTURE_VERSION = 'iron-dust-rest-ogre-fixture-v1';
export const IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION = 'iron-dust-blocked-fire-fixture-v1';
export const IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION = 'iron-dust-infantry-fire-fixture-v1';
export const IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION = 'iron-dust-core-roster-fire-fixture-v1';
export const IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION = 'iron-dust-blocked-gev-fire-fixture-v1';
export const IRON_DUST_FIRE_GEOMETRY_VERSION = 'iron-dust-legacy-fire-geometry-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const sourceOgre = source.units.find(unit => unit.id === 'ogre');
const ids = source.units.map(unit => unit.id);
const enemyActors = ['guard', 'raider'];
const weaponKeys = Object.keys(sourceOgre.ogreSystems.weapons);
const fixtures = Object.freeze({source: {}, adjacent: {guard: {x: 2, y: 5}},
  [IRON_DUST_NEAR_CORE_FIXTURE_VERSION]: {ogre: {x: 10, y: 1}},
  [IRON_DUST_REST_OGRE_FIXTURE_VERSION]: {ogre: {x: 8, y: 4},
    gev: {hp: 0}, missile: {hp: 0}, infantry: {hp: 0}},
  boundary: {ogre: {x: 2, y: 0}, guard: {x: 6, y: 1}},
  [IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION]: {ogre: {x: 3, y: 0}, guard: {x: 4, y: 1}},
  [IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION]: {guard: {x: 1, y: 7}},
  [IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION]: {
    gev: {x: 9, y: 2}, missile: {x: 9, y: 3}, infantry: {x: 10, y: 3}},
  [IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION]: {gev: {x: 3, y: 0},
    guard: {x: 4, y: 1}}});
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
const inside = point => Number.isInteger(point?.x) && Number.isInteger(point?.y) &&
  point.x >= 0 && point.y >= 0 && point.x < source.map.width && point.y < source.map.height;
const terrainAt = point => source.map.terrain.find(cell => cell.x === point.x && cell.y === point.y)?.type ??
  source.map.defaultTerrain;
const movement = treads => treads >= 31 ? 3 : treads >= 16 ? 2 : treads > 0 ? 1 : 0;
const remaining = weapon => Math.max(0, Math.min(weapon.remaining, weapon.count - weapon.destroyed));
const ready = weapon => weapon.expendable ? remaining(weapon) :
  Math.max(0, remaining(weapon) - weapon.firedThisPhase);
const helpless = systems => systems.treads === 0 &&
  weaponKeys.every(key => remaining(systems.weapons[key]) === 0);

function initialUnit(unit, fixture) {
  const next = {...clone(unit), ...(fixtures[fixture][unit.id] ?? {}),
    moved: false, fired: false, secondMoved: false,
    disabled: false, disabledUntil: 0, embarkedOn: null, passengerIds: []};
  if (unit.id === 'ogre') {
    delete next.move;
    delete next.range;
    delete next.damage;
  }
  return next;
}

function expectedVictory(units) {
  const playerAlive = units.some(unit => unit.team === 'player' && unit.hp > 0);
  const coreAlive = units.find(unit => unit.id === 'core').hp > 0;
  return !playerAlive ? {status: 'ended', winner: 'enemy'} :
    !coreAlive ? {status: 'ended', winner: 'player'} :
      {status: 'ongoing', winner: null};
}

function validSystems(systems) {
  const initial = sourceOgre.ogreSystems;
  return systems && Object.keys(systems).length === Object.keys(initial).length &&
    systems.model === initial.model && systems.maxTreads === initial.maxTreads &&
    Number.isInteger(systems.treads) && systems.treads >= 0 &&
    systems.treads <= systems.maxTreads && weaponKeys.includes(systems.selectedWeapon) &&
    systems.weapons && same(Object.keys(systems.weapons), weaponKeys) &&
    weaponKeys.every(key => {
      const weapon = systems.weapons[key], baseline = initial.weapons[key];
      return weapon && Number.isInteger(weapon.destroyed) &&
        weapon.destroyed >= 0 && weapon.destroyed <= baseline.count &&
        Number.isInteger(weapon.remaining) && weapon.remaining >= 0 &&
        weapon.remaining <= baseline.count &&
        Number.isInteger(weapon.firedThisPhase) && weapon.firedThisPhase >= 0 &&
        weapon.firedThisPhase <= baseline.count &&
        (weapon.expendable ? weapon.firedThisPhase === 0 :
          weapon.remaining === baseline.count) &&
        same(weapon, {...baseline, destroyed: weapon.destroyed,
          remaining: weapon.remaining, firedThisPhase: weapon.firedThisPhase});
    });
}

function validUnit(unit, baseline, fixture) {
  const original = initialUnit(baseline, fixture);
  return unit?.id === baseline.id && inside(unit) &&
    Number.isInteger(unit.hp) && unit.hp >= 0 && unit.hp <= baseline.maxHp &&
    ['moved', 'fired', 'secondMoved', 'disabled'].every(key => typeof unit[key] === 'boolean') &&
    (baseline.id === 'gev' || !unit.secondMoved) &&
    Number.isSafeInteger(unit.disabledUntil) && unit.disabledUntil >= 0 &&
    (unit.disabled ? unit.disabledUntil > 0 : unit.disabledUntil === 0) &&
    unit.embarkedOn === null && same(unit.passengerIds, []) &&
    (baseline.id !== 'ogre' || validSystems(unit.ogreSystems) &&
      unit.hp === (helpless(unit.ogreSystems) ? 0 : baseline.hp)) &&
    same(unit, {...original, x: unit.x, y: unit.y, hp: unit.hp,
      moved: unit.moved, fired: unit.fired, secondMoved: unit.secondMoved,
      disabled: unit.disabled, disabledUntil: unit.disabledUntil,
      ...(baseline.id === 'ogre' ? {ogreSystems: unit.ogreSystems} : {})});
}

const validActors = values => Array.isArray(values) &&
  same(values, enemyActors.filter(id => values.includes(id)));

export function createIronDustUnifiedStateProbe(seed, {fixture = 'source'} = {}) {
  if (!u32(seed) || !Object.hasOwn(fixtures, fixture)) reject('UNIFIED_STATE_SETUP_INVALID');
  return freeze({
    capabilityVersion: IRON_DUST_UNIFIED_STATE_VERSION,
    executable: false,
    scenarioId: 'core-iron-dust-state-probe',
    scenarioVersion: 'state-probe-v1',
    ruleProfileId: 'CORE_IRON_DUST_STATE_PROBE_v1',
    sourceScenarioId: source.scenarioId,
    sourceDataVersion: source.dataContractVersion,
    sourceRuleProfileId: source.ruleProfileId,
    objectiveVersion: source.objectiveVersion,
    objective: source.objective,
    fixture,
    map: clone(source.map),
    units: source.units.map(unit => initialUnit(unit, fixture)),
    activeTeam: 'player', phase: 'movement', turn: 1,
    enemyPassed: [], firedActorIds: [],
    victory: {status: 'ongoing', winner: null},
    rng: {seed, state: seed}
  });
}

export function validateIronDustUnifiedStateProbe(state) {
  if (!state || Object.keys(state).length !== 20 ||
      state.capabilityVersion !== IRON_DUST_UNIFIED_STATE_VERSION || state.executable !== false ||
      state.scenarioId !== 'core-iron-dust-state-probe' ||
      state.scenarioVersion !== 'state-probe-v1' ||
      state.ruleProfileId !== 'CORE_IRON_DUST_STATE_PROBE_v1' ||
      state.sourceScenarioId !== source.scenarioId ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceRuleProfileId !== source.ruleProfileId ||
      state.objectiveVersion !== source.objectiveVersion || state.objective !== source.objective ||
      !Object.hasOwn(fixtures, state.fixture) || !same(state.map, source.map) ||
      !Number.isSafeInteger(state.turn) || state.turn < 1 ||
      !(state.activeTeam === 'enemy' ? state.phase === 'enemy' :
        state.activeTeam === 'player' && ['movement', 'fire', 'gev'].includes(state.phase)) ||
      !state.rng || Object.keys(state.rng).length !== 2 ||
      !u32(state.rng.seed) || !u32(state.rng.state) ||
      !validActors(state.enemyPassed) || !validActors(state.firedActorIds) ||
      state.enemyPassed.some(id => state.firedActorIds.includes(id)) ||
      (state.activeTeam === 'player' &&
        (state.enemyPassed.length !== 0 || state.firedActorIds.length !== 0)) ||
      !Array.isArray(state.units) || state.units.length !== ids.length ||
      !state.units.every((unit, index) => validUnit(unit, source.units[index], state.fixture)) ||
      new Set(state.units.filter(unit => unit.hp > 0).map(unit => `${unit.x},${unit.y}`)).size !==
        state.units.filter(unit => unit.hp > 0).length ||
      !same(state.victory, expectedVictory(state.units))) reject('UNIFIED_STATE_MISMATCH');
  return state;
}

export function queryIronDustUnifiedPhase(state) {
  validateIronDustUnifiedStateProbe(state);
  return {activeTeam: state.activeTeam, phase: state.phase, turn: state.turn,
    enemyPassed: [...state.enemyPassed], firedActorIds: [...state.firedActorIds],
    victory: clone(state.victory), rng: clone(state.rng)};
}

export function queryIronDustUnifiedUnit(state, unitId) {
  validateIronDustUnifiedStateProbe(state);
  const unit = state.units.find(item => item.id === unitId);
  if (!unit) return {error: {code: 'UNIFIED_UNIT_UNKNOWN'}};
  const systems = unit.ogreSystems, selected = systems?.weapons[systems.selectedWeapon];
  return {id: unit.id, team: unit.team, x: unit.x, y: unit.y, hp: unit.hp,
    disabled: unit.disabled, disabledUntil: unit.disabledUntil,
    moved: unit.moved, fired: unit.fired, secondMoved: unit.secondMoved,
    movement: systems ? movement(systems.treads) : unit.move,
    firstMove: systems ? movement(systems.treads) : unit.move,
    secondMove: unit.id === 'gev' ? 2 : 0,
    attack: selected ? selected.attack : unit.damage,
    range: selected ? selected.range : unit.range,
    ...(systems ? {systems: {treads: systems.treads,
      selectedWeapon: systems.selectedWeapon,
      weapons: Object.fromEntries(weaponKeys.map(key =>
        [key, {remaining: remaining(systems.weapons[key]), ready: ready(systems.weapons[key])}]))}} : {})};
}

export function queryIronDustUnifiedGeometry(state, fromId, toId) {
  validateIronDustUnifiedStateProbe(state);
  const from = state.units.find(unit => unit.id === fromId);
  const to = state.units.find(unit => unit.id === toId);
  if (!from || !to) return {error: {code: 'UNIFIED_UNIT_UNKNOWN'}};
  const targetTerrain = terrainAt(to);
  return {fromId, toId, distance: hexDistance(from, to),
    lineOfSight: hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, from, to),
    terrain: targetTerrain, cover: TerrainRules.coverBonus(targetTerrain),
    entryCost: TerrainRules.movementCost(targetTerrain, from)};
}

// Shared, read-only Legacy fire geometry for the inactive technical fixtures.
// Range precedes LOS, as in the historical attack preflight.
export function queryIronDustFireGeometry(state, fromId, toId, range, codes) {
  const geometry = queryIronDustUnifiedGeometry(state, fromId, toId);
  if (geometry.error) return geometry;
  if (!Number.isInteger(range) || range < 0 ||
      !codes || typeof codes.outOfRange !== 'string' || typeof codes.sightBlocked !== 'string')
    throw new TypeError('Invalid fire geometry contract');
  if (geometry.distance > range) return {available: false, error: {code: codes.outOfRange}};
  if (!geometry.lineOfSight) return {available: false, error: {code: codes.sightBlocked}};
  return {available: true, resolverVersion: IRON_DUST_FIRE_GEOMETRY_VERSION,
    distance: geometry.distance, terrain: geometry.terrain, cover: geometry.cover,
    losMode: IRON_DUST_LEGACY_LOS_PROBE_V1.losMode};
}
