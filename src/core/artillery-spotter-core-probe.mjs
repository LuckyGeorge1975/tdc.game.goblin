import {createArtillerySpotterProbe} from '../../artillery-spotter-probe.mjs';
import {CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT} from './profile-contract.mjs';

const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// Exact inactive data targets for the two technical actors.
export const ARTILLERY_CORE_PROBE_DATA = deepFreeze({
  schemaVersion: 1, legacyProfile: 'field-test-atlas-v1',
  targetProfile: 'full-catalog-v1-draft', targetActive: false,
  units: {
    'long-range-battery': {target: {source: 'UNIT_CATALOG.howitzer',
      attack: 6, range: 8, defense: 1, movement: [0], mode: 'fixed', setupValue: 2}},
    'mobile-siege-gun': {target: {source: 'UNIT_CATALOG.mobileHowitzer',
      attack: 6, range: 6, defense: 2, movement: [1], mode: 'tracked', setupValue: 2}}
  }
});
export const ARTILLERY_CORE_ACTORS = Object.freeze(['long-range-battery', 'mobile-siege-gun']);
export const artilleryCoreProbeState = turn => Object.fromEntries(
  ARTILLERY_CORE_ACTORS.map(id => [id, createArtillerySpotterProbe(
    ARTILLERY_CORE_PROBE_DATA, 'full-catalog-v1-draft', id, turn)]));

const unit = (id, team, x, y, values = {}) => ({id, team, x, y,
  hp: 2, maxHp: 2, defense: 2, move: 0, range: 0, damage: 0, ...values});
export const artilleryCoreProbeScenario = deepFreeze({
  ...CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT,
  map: {width: 9, height: 5, terrain: [
    {x: 2, y: 0, type: 'forest'}, {x: 2, y: 4, type: 'forest'}
  ]},
  units: [
    unit('long-range-battery', 'player', 0, 0,
      {defense: 1, move: 0, range: 8, damage: 6}),
    unit('mobile-siege-gun', 'player', 0, 4,
      {hp: 3, maxHp: 3, defense: 2, move: 1, range: 6, damage: 6}),
    unit('battery-spotter', 'player', 5, 0),
    unit('mobile-spotter', 'player', 4, 4),
    unit('battery-near', 'enemy', 1, 0),
    unit('battery-far', 'enemy', 8, 0),
    unit('mobile-near', 'enemy', 1, 4),
    unit('mobile-far', 'enemy', 6, 4),
    unit('enemy-core', 'enemy', 8, 2, {core: true})
  ]
});

export function artilleryCoreProbeScenarioError(scenario) {
  if (scenario?.rulesVersion !== CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT.rulesVersion)
    return null;
  if (JSON.stringify(scenario.map) !== JSON.stringify(artilleryCoreProbeScenario.map) ||
      JSON.stringify(scenario.units) !== JSON.stringify(artilleryCoreProbeScenario.units))
    return {code: 'INVALID_ARTILLERY_SCENARIO', details: {reason: 'fixture differs'}};
  return null;
}
