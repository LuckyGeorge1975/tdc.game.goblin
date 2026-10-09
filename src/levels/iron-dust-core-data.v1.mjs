import {IRON_DUST_LEVEL_V1, validateIronDustLevelV1} from './iron-dust.v1.mjs';

// This is a data contract, not a Core scenario. In particular, it has no
// rulesVersion or effectiveRules and cannot authorize createGame or replay.
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

const clone = value => JSON.parse(JSON.stringify(value));
const source = validateIronDustLevelV1(IRON_DUST_LEVEL_V1);

export const IRON_DUST_CORE_DATA_V1 = freeze({
  dataContractVersion: 'iron-dust-core-data-v1',
  executable: false,
  sourceSchemaVersion: source.schemaVersion,
  scenarioId: source.id,
  scenarioVersion: source.scenarioVersion,
  ruleProfileId: source.ruleProfileId,
  objectiveVersion: source.objectiveVersion,
  objective: source.objective,
  map: {
    width: source.width,
    height: source.height,
    defaultTerrain: source.defaultTerrain,
    terrain: source.terrain.map(key => {
      const [x, y] = key.split(',').map(Number);
      return {x, y, type: 'rubble-field'};
    })
  },
  units: clone(source.units),
  legacyTraitEvidence: [
    {unitId: 'gev', trait: 'gev', sourceField: 'id', sourceValue: 'gev'}
  ]
});

const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};

export function validateIronDustCoreDataV1(value) {
  if (value?.dataContractVersion !== 'iron-dust-core-data-v1')
    throw new Error('UNSUPPORTED_DATA_VERSION');
  if (value.scenarioId !== 'iron-dust' || value.scenarioVersion !== 1 ||
      value.sourceSchemaVersion !== 1 ||
      value.ruleProfileId !== 'FIELD_TEST_LEGACY_v1' || value.objectiveVersion !== 1 ||
      value.objective !== 'core' || value.executable !== false)
    throw new Error('UNSUPPORTED_DATA_PROFILE');
  if (!same(value, IRON_DUST_CORE_DATA_V1)) throw new Error('DATA_SNAPSHOT_MISMATCH');
  return IRON_DUST_CORE_DATA_V1;
}

export function adaptIronDustLevelV1(value) {
  validateIronDustLevelV1(value);
  return IRON_DUST_CORE_DATA_V1;
}
