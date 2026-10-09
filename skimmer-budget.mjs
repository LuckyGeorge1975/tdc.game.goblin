// Reads movement data for a future, explicitly versioned rule path. This module
// is not connected to scenario starts, game.js, or the modular Core runtime.
const PLAYER_SKIMMER_IDS = new Set([
  'skimmer-scout', 'combat-skimmer', 'light-skimmer', 'skimmer-carrier'
]);
const LEGACY_DATA_PROFILE = 'field-test-atlas-v1';
const TARGET_DATA_PROFILE = 'full-catalog-v1-draft';

function reject(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

export function skimmerMovementBudget(registry, dataProfileId, unitId) {
  if (registry?.schemaVersion !== 1 ||
      registry.legacyProfile !== LEGACY_DATA_PROFILE ||
      registry.targetProfile !== TARGET_DATA_PROFILE ||
      (dataProfileId !== LEGACY_DATA_PROFILE && dataProfileId !== TARGET_DATA_PROFILE))
    reject('UNSUPPORTED_UNIT_DATA_PROFILE', String(dataProfileId));
  if (!PLAYER_SKIMMER_IDS.has(unitId) || !registry.units?.[unitId])
    reject('NOT_PLAYER_SKIMMER', String(unitId));

  const record = registry.units[unitId];
  if (dataProfileId === LEGACY_DATA_PROFILE) {
    const primary = record.legacy?.[3];
    if (!Number.isInteger(primary) || primary < 0)
      reject('INVALID_SKIMMER_BUDGET', `${unitId} Legacy movement`);
    return Object.freeze({primary, secondary: 2});
  }

  // The target registry is a draft data source, never an authorization to start
  // a FULL_CATALOG game. Its eventual product binding belongs to versioning.
  if (registry.targetActive !== false)
    reject('UNSUPPORTED_UNIT_DATA_PROFILE', 'target profile is not a draft');
  const movement = record.target?.movement;
  if (record.target?.mode !== 'gev' || !Array.isArray(movement) ||
      movement.length !== 2 || !movement.every(value => Number.isInteger(value) && value > 0))
    reject('INVALID_SKIMMER_BUDGET', `${unitId} target movement`);
  return Object.freeze({primary: movement[0], secondary: movement[1]});
}
