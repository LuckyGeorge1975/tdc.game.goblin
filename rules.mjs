export const UNIT_RULES = Object.freeze({
  goblin: Object.freeze({ move: 1, range: 2, damage: 3, ram: true }),
  gev: Object.freeze({ move: 3, range: 3, damage: 1, secondMove: 2 }),
  missile: Object.freeze({ move: 1, range: 4, damage: 2 }),
  infantry: Object.freeze({ move: 2, range: 1, damage: 1, infantry: true }),
});

export const TERRAIN_RULES = Object.freeze({
  open: Object.freeze({ cost: 1, cover: false, blocksLos: false }),
  cover: Object.freeze({ cost: 2, cover: true, blocksLos: true }),
});

export function hexDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs((a.x + a.y) - (b.x + b.y)));
}

export function terrainCost(isCover) {
  return isCover ? TERRAIN_RULES.cover.cost : TERRAIN_RULES.open.cost;
}

export function movementCostForMode(mode, isCover) {
  if (!isCover) return TERRAIN_RULES.open.cost;
  if (mode === 'fixed') return Infinity;
  return TERRAIN_RULES.cover.cost;
}

export function combatRatio(damage, maxHp) {
  const strength = Math.max(0, damage);
  const defense = Math.max(1, maxHp);
  if (strength >= defense * 5) return '5-1';
  if (strength * 2 < defense) return '1-2';
  return `${Math.min(4, Math.max(1, Math.floor(strength / defense)))}-1`;
}

export function applyCombatResult(target, result) {
  if (result === 'X') return { ...target, hp: 0 };
  if (result !== 'D') return { ...target };
  if (target.infantry) return { ...target, hp: Math.max(0, target.hp - 1) };
  if (target.disabled) return { ...target, hp: 0 };
  return { ...target, disabled: true };
}
// Original G.O.B.L.I.N. unit catalogue. Values are kept separate from the
// playable prototype rules above until the corresponding mechanics exist.
export const UNIT_CATALOG = Object.freeze({
  heavyTank: Object.freeze({ id: 'heavy-tank', name: 'ASSAULT TANK', attack: 4, range: 2, defense: 3, movement: [3], mode: 'tracked', source: 'CORE' }),
  missileTank: Object.freeze({ id: 'missile-tank', name: 'ROCKET ARTILLERY', attack: 3, range: 4, defense: 2, movement: [2], mode: 'tracked', source: 'CORE' }),
  lightTank: Object.freeze({ id: 'light-tank', name: 'RECON TANK', attack: 2, range: 2, defense: 2, movement: [3], mode: 'tracked', halfUnit: true, source: 'CORE' }),
  superheavyTank: Object.freeze({ id: 'superheavy-tank', name: 'SIEGE TANK', attack: 6, range: 3, defense: 5, movement: [3], mode: 'ogre', splitFire: true, antipersonnel: 2, source: 'CORE' }),
  howitzer: Object.freeze({ id: 'howitzer', name: 'LONG-RANGE BATTERY', attack: 6, range: 8, defense: 1, movement: [0], mode: 'fixed', setupValue: 2, source: 'CORE' }),
  mobileHowitzer: Object.freeze({ id: 'mobile-howitzer', name: 'MOBILE SIEGE GUN', attack: 6, range: 6, defense: 2, movement: [1], mode: 'tracked', setupValue: 2, source: 'EXPEDITIONARY' }),
  gev: Object.freeze({ id: 'gev', name: 'COMBAT SKIMMER', attack: 2, range: 2, defense: 2, movement: [4, 3], mode: 'gev', source: 'CORE' }),
  lightGev: Object.freeze({ id: 'light-gev', name: 'LIGHT SKIMMER', attack: 1, range: 2, defense: 1, movement: [4, 3], mode: 'gev', halfUnit: true, source: 'EXPEDITIONARY' }),
  gevPc: Object.freeze({ id: 'gev-pc', name: 'SKIMMER CARRIER', attack: 1, range: 2, defense: 2, movement: [3, 2], mode: 'gev', transportSquads: 3, source: 'EXPEDITIONARY' }),
  missileCrawler: Object.freeze({ id: 'missile-crawler', name: 'STRATEGIC MISSILE CARRIER', attack: 6, splashAttack: 3, blastRadius: 1, ammunition: 1, range: 8, defense: 2, movement: [1], mode: 'tracked', cruiseMissile: true, source: 'EXPEDITIONARY' }),
  lightArtilleryDrone: Object.freeze({ id: 'light-artillery-drone', name: 'ARTILLERY DRONE', attack: 2, range: 8, defense: 1, movement: [0], mode: 'fixed', transportable: true, source: 'FRONTIER' }),
  infantry: Object.freeze({ id: 'infantry', name: 'INFANTRY SQUAD', attack: 'squads', range: 1, defense: 'squads', movement: [2], mode: 'infantry', maxSquads: 3, source: 'CORE' }),
  marines: Object.freeze({ id: 'marines', name: 'AMPHIBIOUS INFANTRY', attack: 'squads', range: 1, defense: 'squads', movement: [2], mode: 'infantry', maxSquads: 3, waterCombat: true, source: 'EXPEDITIONARY' }),
  combatEngineers: Object.freeze({ id: 'combat-engineers', name: 'FIELD ENGINEERS', attack: 2, range: 1, defense: 2, movement: [2], mode: 'infantry', engineering: true, source: 'SUPPORT' }),
  militia: Object.freeze({ id: 'militia', name: 'LOCAL DEFENSE', attack: 1, range: 1, defense: 1, movement: [2], mode: 'infantry', cannonFodder: true, source: 'FRONTIER' }),
  commandPost: Object.freeze({ id: 'command-post', name: 'COMMAND HUB', attack: 0, range: 0, defense: 2, movement: [0], mode: 'fixed', commandUnit: true, source: 'CORE' })
});

export const OGRE_SYSTEMS = Object.freeze({
  mkIII: Object.freeze({ id: 'ogre-mk-iii', name: 'GOBLIN SIEGEBREAKER', tread: 45, movement: [3, 2, 1, 0], mainBatteries: 1, secondaryBatteries: 4, missiles: 2, antipersonnel: 8, source: 'AUTONOMOUS' }),
  mkV: Object.freeze({ id: 'ogre-mk-v', name: 'GOBLIN DREADNAUGHT', tread: 60, movement: [3, 2, 1, 0], mainBatteries: 2, secondaryBatteries: 6, missiles: 6, antipersonnel: 12, source: 'AUTONOMOUS' }),
  vulcan: Object.freeze({ id: 'vulcan', name: 'FORGE ENGINEER', tread: 45, movement: [3, 2, 1, 0], engineering: true, drones: true, source: 'SUPPORT' }),
  ninja: Object.freeze({ id: 'ninja', name: 'PHANTOM PLATFORM', stealth: true, source: 'SUPPORT' })
});
