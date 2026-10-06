import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';
import {CORE_IRON_DUST_GEV_PROBE_CONTRACT} from './profile-contract.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const expected = {
  map: clone(source.map),
  units: clone(source.units.filter(unit => unit.id === 'gev' || unit.id === 'core'))
};
const same = (actual, value) => {
  if (value === null || typeof value !== 'object') return actual === value;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], value[key]));
};

export function makeIronDustGevProbeScenario() {
  return {...clone(CORE_IRON_DUST_GEV_PROBE_CONTRACT), ...clone(expected)};
}

// Called only at createGame, before cloning the input or initializing RNG.
export function ironDustGevProbeScenarioError(scenario) {
  return same(scenario?.map, expected.map) && same(scenario?.units, expected.units)
    ? null : {code: 'SCENARIO_PROFILE_MISMATCH', details: {scenarioId: scenario?.scenarioId ?? null}};
}
