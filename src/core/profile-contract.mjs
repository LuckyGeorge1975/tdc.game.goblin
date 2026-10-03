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
  const contract = CORE_PROFILE_CONTRACT;
  if (value && historicalPairs.has(`${value.rulesVersion}/${value.scenarioVersion}`) &&
      !['scenarioId', 'ruleProfileId', 'effectiveRules'].some(key => own(value, key)))
    return null;
  if (value?.rulesVersion !== contract.rulesVersion ||
      value?.ruleProfileId !== contract.ruleProfileId)
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
  if (state.rulesVersion !== CORE_PROFILE_CONTRACT.rulesVersion) return state;
  Object.freeze(state.effectiveRules.movement);
  Object.freeze(state.effectiveRules);
  return state;
}
