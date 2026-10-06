// Contract pilot for new Core sessions. It does not enable FULL_CATALOG or
// change the mechanics of the historical core-v1/core-v2 fixtures.
export const CORE_PROFILE_CONTRACT = Object.freeze({
  rulesVersion: 'core-v3-profile-v1',
  scenarioId: 'core-profile-probe',
  scenarioVersion: 'profile-probe-v1',
  ruleProfileId: 'FIELD_TEST_LEGACY_v1',
  effectiveRules: Object.freeze({
    schemaVersion: 1,
    objective: 'enemy-core',
    movement: Object.freeze({gevSecondMove: 2})
  })
});

// An isolated Core test profile. Browser levels and Legacy sessions do not
// advertise this product ID, so it cannot become the default game profile.
export const CORE_SUPERCOVER_CONTRACT = Object.freeze({
  rulesVersion: 'core-v4-supercover-v1',
  scenarioId: 'core-supercover-probe',
  scenarioVersion: 'supercover-probe-v1',
  ruleProfileId: 'CORE_SUPERCOVER_PROBE_v1',
  effectiveRules: Object.freeze({
    schemaVersion: 1,
    objective: 'enemy-core',
    movement: Object.freeze({gevSecondMove: 2}),
    losMode: 'strict-supercover'
  })
});

// Movement-only probe derived from the inactive Iron Dust data snapshot.
// Its profile ID is deliberately separate from the playable Legacy product.
export const CORE_IRON_DUST_GEV_PROBE_CONTRACT = Object.freeze({
  rulesVersion: 'core-v5-iron-dust-gev-probe-v1',
  scenarioId: 'core-iron-dust-gev-probe',
  scenarioVersion: 'iron-dust-gev-probe-v1',
  ruleProfileId: 'CORE_IRON_DUST_GEV_PROBE_v1',
  effectiveRules: Object.freeze({
    schemaVersion: 1,
    capability: 'gev-movement-only',
    sourceDataVersion: 'iron-dust-core-data-v1',
    sourceScenarioId: 'iron-dust',
    sourceUnitId: 'gev',
    terrainVersion: 'iron-dust-v1',
    movement: Object.freeze({gevFirstMove: 3, gevSecondMove: 2})
  })
});

const profileContracts = [CORE_PROFILE_CONTRACT, CORE_SUPERCOVER_CONTRACT,
  CORE_IRON_DUST_GEV_PROBE_CONTRACT];

const historicalPairs = new Set([
  'core-v1/reference-v1',
  'core-v2/phase-v2',
  'core-v2/phase-v2-enemy-d',
  'core-v2/phase-v2-second-d',
  'core-v2/phase-v2-infantry-d',
  'core-v2/phase-v2-terrain-los'
]);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => own(actual, key) && same(actual[key], expected[key]));
};

export function profileContractError(value) {
  if (value && historicalPairs.has(`${value.rulesVersion}/${value.scenarioVersion}`) &&
      !['scenarioId', 'ruleProfileId', 'effectiveRules'].some(key => own(value, key)))
    return null;
  const contract = profileContracts.find(item => item.rulesVersion === value?.rulesVersion);
  if (!contract || value?.ruleProfileId !== contract.ruleProfileId)
    return {code: 'UNSUPPORTED_RULE_PROFILE', details: {
      rulesVersion: value?.rulesVersion ?? null,
      ruleProfileId: value?.ruleProfileId ?? null
    }};
  if (value.scenarioId !== contract.scenarioId ||
      value.scenarioVersion !== contract.scenarioVersion)
    return {code: 'SCENARIO_PROFILE_MISMATCH', details: {
      scenarioId: value.scenarioId ?? null,
      scenarioVersion: value.scenarioVersion ?? null
    }};
  if (!same(value.effectiveRules, contract.effectiveRules))
    return {code: 'RULE_SNAPSHOT_MISMATCH', details: {scenarioId: value.scenarioId}};
  return null;
}

export function freezeEffectiveRules(state) {
  if (!profileContracts.some(item => item.rulesVersion === state.rulesVersion)) return state;
  Object.freeze(state.effectiveRules.movement);
  Object.freeze(state.effectiveRules);
  return state;
}
