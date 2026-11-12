// Historical Iron Dust unit profile. The layout references these entries by asset ID.
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const IRON_DUST_START_ROSTER = freeze({
  "goblin-siegebreaker": {
    "name": "GOBLIN SIEGEBREAKER",
    "type": "HEAVY ASSAULT",
    "hp": 5,
    "maxHp": 5,
    "defense": 5,
    "range": 2,
    "move": 3,
    "damage": 3,
    "icon": "G",
    "ogreSystems": {
      "model": "SIEGEBREAKER",
      "selectedWeapon": "main",
      "maxTreads": 45,
      "treads": 45,
      "weapons": {
        "main": {
          "label": "MAIN BATTERY",
          "count": 1,
          "attack": 4,
          "range": 3,
          "defense": 4,
          "destroyed": 0,
          "remaining": 1,
          "firedThisPhase": 0
        },
        "secondary": {
          "label": "SECONDARY BATTERY",
          "count": 4,
          "attack": 3,
          "range": 2,
          "defense": 3,
          "destroyed": 0,
          "remaining": 4,
          "firedThisPhase": 0
        },
        "missiles": {
          "label": "MISSILES",
          "count": 2,
          "attack": 6,
          "range": 5,
          "defense": 3,
          "expendable": true,
          "destroyed": 0,
          "remaining": 2,
          "firedThisPhase": 0
        },
        "antipersonnel": {
          "label": "ANTI-PERSONNEL",
          "count": 8,
          "attack": 1,
          "range": 1,
          "defense": 1,
          "infantryOnly": true,
          "destroyed": 0,
          "remaining": 8,
          "firedThisPhase": 0
        }
      }
    }
  },
  "skimmer-scout": {
    "name": "SKIMMER SCOUT",
    "type": "HOVERCRAFT",
    "hp": 3,
    "maxHp": 3,
    "defense": 3,
    "range": 3,
    "move": 3,
    "damage": 1,
    "icon": "G"
  },
  "rocket-artillery": {
    "name": "ROCKET ARTILLERY",
    "type": "ARTILLERY",
    "hp": 3,
    "maxHp": 3,
    "defense": 3,
    "range": 4,
    "move": 1,
    "damage": 2,
    "icon": "M"
  },
  "infantry-platoon": {
    "name": "INFANTRY PLATOON",
    "type": "MOBILE INFANTRY",
    "hp": 2,
    "maxHp": 2,
    "defense": 2,
    "range": 1,
    "move": 2,
    "damage": 1,
    "icon": "I",
    "infantry": true
  },
  "command-core": {
    "name": "COMMAND CORE",
    "type": "FORTIFIED TARGET",
    "hp": 5,
    "maxHp": 5,
    "defense": 5,
    "range": 0,
    "move": 0,
    "damage": 0,
    "icon": "X",
    "core": true
  },
  "guard-tank": {
    "name": "GUARD TANK",
    "type": "HOSTILE ARMOR",
    "hp": 3,
    "maxHp": 3,
    "defense": 3,
    "range": 2,
    "move": 1,
    "damage": 1,
    "icon": "G"
  },
  "raider-skimmer": {
    "name": "RAIDER SKIMMER",
    "type": "HOSTILE HOVER",
    "hp": 2,
    "maxHp": 2,
    "defense": 2,
    "range": 2,
    "move": 2,
    "damage": 1,
    "icon": "R"
  }
});
