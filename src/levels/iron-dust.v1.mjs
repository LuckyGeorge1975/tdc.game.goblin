// Versioned Legacy data snapshot. No game path imports this module yet.
// The Siegebreaker systems are data dependencies, not a claim of Core support.
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const IRON_DUST_LEVEL_V1 = freeze({
  schemaVersion: 1,
  id: 'iron-dust',
  scenarioVersion: 1,
  ruleProfileId: 'FIELD_TEST_LEGACY_v1',
  objectiveVersion: 1,
  objective: 'core',
  width: 12,
  height: 8,
  defaultTerrain: 'open-ground',
  terrain: ['3,1', '8,1', '1,4', '5,3', '9,5', '2,6', '7,6', '10,2'],
  units: [
    {
      id: 'ogre', name: 'GOBLIN SIEGEBREAKER', type: 'HEAVY ASSAULT', team: 'player',
      x: 1, y: 5, hp: 5, maxHp: 5, defense: 5, range: 2, move: 3, damage: 3, icon: 'G',
      ogreSystems: {
        model: 'SIEGEBREAKER', selectedWeapon: 'main', maxTreads: 45, treads: 45,
        weapons: {
          main: {label: 'MAIN BATTERY', count: 1, attack: 4, range: 3, defense: 4, destroyed: 0, remaining: 1, firedThisPhase: 0},
          secondary: {label: 'SECONDARY BATTERY', count: 4, attack: 3, range: 2, defense: 3, destroyed: 0, remaining: 4, firedThisPhase: 0},
          missiles: {label: 'MISSILES', count: 2, attack: 6, range: 5, defense: 3, expendable: true, destroyed: 0, remaining: 2, firedThisPhase: 0},
          antipersonnel: {label: 'ANTI-PERSONNEL', count: 8, attack: 1, range: 1, defense: 1, infantryOnly: true, destroyed: 0, remaining: 8, firedThisPhase: 0}
        }
      }
    },
    {id: 'gev', name: 'SKIMMER SCOUT', type: 'HOVERCRAFT', team: 'player', x: 2, y: 6, hp: 3, maxHp: 3, defense: 3, range: 3, move: 3, damage: 1, icon: 'G'},
    {id: 'missile', name: 'ROCKET ARTILLERY', type: 'ARTILLERY', team: 'player', x: 3, y: 6, hp: 3, maxHp: 3, defense: 3, range: 4, move: 1, damage: 2, icon: 'M'},
    {id: 'infantry', name: 'INFANTRY PLATOON', type: 'MOBILE INFANTRY', team: 'player', x: 1, y: 6, hp: 2, maxHp: 2, defense: 2, range: 1, move: 2, damage: 1, icon: 'I', infantry: true},
    {id: 'core', name: 'COMMAND CORE', type: 'FORTIFIED TARGET', team: 'enemy', x: 10, y: 2, hp: 5, maxHp: 5, defense: 5, range: 0, move: 0, damage: 0, icon: 'X', core: true},
    {id: 'guard', name: 'GUARD TANK', type: 'HOSTILE ARMOR', team: 'enemy', x: 8, y: 3, hp: 3, maxHp: 3, defense: 3, range: 2, move: 1, damage: 1, icon: 'G'},
    {id: 'raider', name: 'RAIDER SKIMMER', type: 'HOSTILE HOVER', team: 'enemy', x: 9, y: 5, hp: 2, maxHp: 2, defense: 2, range: 2, move: 2, damage: 1, icon: 'R'}
  ]
});

const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};

export function validateIronDustLevelV1(value) {
  if (value?.schemaVersion !== 1 || value?.scenarioVersion !== 1 || value?.objectiveVersion !== 1)
    throw new Error('UNSUPPORTED_LEVEL_VERSION');
  if (value.id !== 'iron-dust' || value.ruleProfileId !== 'FIELD_TEST_LEGACY_v1' || value.objective !== 'core')
    throw new Error('UNSUPPORTED_LEVEL_PROFILE');
  if (!same(value, IRON_DUST_LEVEL_V1)) throw new Error('LEVEL_DATA_MISMATCH');
  return IRON_DUST_LEVEL_V1;
}
