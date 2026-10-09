import {createSiegeTankFireBudget} from '../../siege-tank-fire-budget.mjs';
import {CORE_SIEGE_TANK_PROBE_CONTRACT} from './profile-contract.mjs';

// Exact inactive catalog snapshot for this technical probe. Tests compare it to
// the data file; a product loader must use its own versioned data boundary.
export const SIEGE_TANK_PROBE_DATA = Object.freeze({
  schemaVersion: 1, legacyProfile: 'field-test-atlas-v1',
  targetProfile: 'full-catalog-v1-draft', targetActive: false,
  units: Object.freeze({'siege-tank': Object.freeze({target: Object.freeze({
    source: 'UNIT_CATALOG.superheavyTank', attack: 6, range: 3,
    defense: 5, movement: Object.freeze([3]), mode: 'ogre',
    splitFire: true, antipersonnel: 2
  })})})
});

export const siegeTankProbeBudget = turn => createSiegeTankFireBudget(
  SIEGE_TANK_PROBE_DATA, 'full-catalog-v1-draft', 'siege-tank', turn);

const enemy = (id, x, y, extra = {}) => ({id, team: 'enemy', x, y,
  hp: 3, maxHp: 3, defense: 5, move: 0, range: 0, damage: 0, ...extra});
const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
export const siegeTankProbeScenario = deepFreeze({
  ...CORE_SIEGE_TANK_PROBE_CONTRACT,
  map: {width: 8, height: 4, terrain: []},
  units: [
    {id: 'siege-tank', team: 'player', x: 0, y: 1, hp: 5, maxHp: 5,
      defense: 5, move: 3, range: 3, damage: 6},
    enemy('armor-a', 3, 1), enemy('armor-b', 2, 0),
    enemy('infantry-a', 1, 1, {type: 'infantry', infantry: true}),
    enemy('infantry-b', 0, 2, {type: 'infantry', infantry: true}),
    enemy('enemy-core', 7, 1, {core: true})
  ]
});

export function siegeTankProbeScenarioError(scenario) {
  if (scenario?.rulesVersion !== CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion) return null;
  const tanks = Array.isArray(scenario.units)
    ? scenario.units.filter(unit => unit?.id === 'siege-tank') : [];
  if (tanks.length !== 1) return {code: 'INVALID_SIEGE_TANK_SCENARIO', details: {reason: 'single actor required'}};
  const unit = tanks[0];
  if (unit.team !== 'player' || unit.hp !== 5 || unit.maxHp !== 5 ||
      unit.defense !== 5 || unit.move !== 3 || unit.range !== 3 ||
      unit.damage !== 6 || unit.infantry === true || unit.embarkedOn)
    return {code: 'INVALID_SIEGE_TANK_SCENARIO', details: {reason: 'actor values differ'}};
  if (JSON.stringify(scenario.map) !== JSON.stringify(siegeTankProbeScenario.map) ||
      JSON.stringify(scenario.units) !== JSON.stringify(siegeTankProbeScenario.units))
    return {code: 'INVALID_SIEGE_TANK_SCENARIO', details: {reason: 'fixture differs'}};
  return null;
}
