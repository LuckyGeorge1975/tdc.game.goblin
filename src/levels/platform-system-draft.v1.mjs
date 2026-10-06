// Inactive catalog data only. No runtime system, HP, combat or transport model.
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const PLATFORM_SYSTEM_DRAFT_V1 = freeze({
  schemaVersion: 1,
  dataProfile: 'full-catalog-v1-draft',
  active: false,
  platforms: {
    'goblin-dreadnaught': {
      source: 'OGRE_SYSTEMS.mkV', system: 'mkV', tread: 60,
      movement: [3, 2, 1, 0],
      mainBatteries: 2, secondaryBatteries: 6, missiles: 6, antipersonnel: 12
    },
    'forge-engineer': {
      source: 'OGRE_SYSTEMS.vulcan', system: 'vulcan', tread: 45,
      movement: [3, 2, 1, 0], engineering: true, drones: true
    }
  }
});

const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};

export function validatePlatformSystemDraftV1(value) {
  if (value?.schemaVersion !== 1) throw new Error('UNSUPPORTED_PLATFORM_DRAFT_VERSION');
  if (value.dataProfile !== 'full-catalog-v1-draft' || value.active !== false)
    throw new Error('UNSUPPORTED_PLATFORM_DRAFT_PROFILE');
  if (!same(value, PLATFORM_SYSTEM_DRAFT_V1)) throw new Error('PLATFORM_DRAFT_MISMATCH');
  return PLATFORM_SYSTEM_DRAFT_V1;
}
