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
// Canonical unit catalogue for the Ogre/G.E.V. family. Values are kept separate
// from the playable prototype rules above until the corresponding mechanics exist.
export const UNIT_CATALOG = Object.freeze({
  heavyTank: Object.freeze({ id: 'heavy-tank', name: 'HEAVY TANK', attack: 4, range: 2, defense: 3, movement: [3], mode: 'tracked', source: 'Ogre/G.E.V.' }),
  missileTank: Object.freeze({ id: 'missile-tank', name: 'MISSILE TANK', attack: 3, range: 4, defense: 2, movement: [2], mode: 'tracked', source: 'Ogre/G.E.V.' }),
  lightTank: Object.freeze({ id: 'light-tank', name: 'LIGHT TANK', attack: 2, range: 2, defense: 2, movement: [3], mode: 'tracked', halfUnit: true, source: 'Ogre/G.E.V.' }),
  superheavyTank: Object.freeze({ id: 'superheavy-tank', name: 'SUPERHEAVY TANK', attack: 6, range: 3, defense: 5, movement: [3], mode: 'ogre', splitFire: true, antipersonnel: 2, source: 'Ogre/G.E.V.' }),
  howitzer: Object.freeze({ id: 'howitzer', name: 'HOWITZER', attack: 6, range: 8, defense: 1, movement: [0], mode: 'fixed', setupValue: 2, source: 'Ogre/G.E.V.' }),
  mobileHowitzer: Object.freeze({ id: 'mobile-howitzer', name: 'MOBILE HOWITZER', attack: 6, range: 6, defense: 2, movement: [1], mode: 'tracked', setupValue: 2, source: 'Shockwave' }),
  gev: Object.freeze({ id: 'gev', name: 'GEV', attack: 2, range: 2, defense: 2, movement: [4, 3], mode: 'gev', source: 'Ogre/G.E.V.' }),
  lightGev: Object.freeze({ id: 'light-gev', name: 'LIGHT GEV', attack: 1, range: 2, defense: 1, movement: [4, 3], mode: 'gev', halfUnit: true, source: 'Shockwave' }),
  gevPc: Object.freeze({ id: 'gev-pc', name: 'GEV-PC', attack: 1, range: 2, defense: 2, movement: [3, 2], mode: 'gev', transportSquads: 3, source: 'Shockwave' }),
  missileCrawler: Object.freeze({ id: 'missile-crawler', name: 'MISSILE CRAWLER', attack: 0, range: 0, defense: 2, movement: [1], mode: 'tracked', cruiseMissile: true, source: 'Shockwave' }),
  lightArtilleryDrone: Object.freeze({ id: 'light-artillery-drone', name: 'LIGHT ARTILLERY DRONE', attack: 2, range: 8, defense: 1, movement: [0], mode: 'fixed', transportable: true, source: 'Battlefields' }),
  infantry: Object.freeze({ id: 'infantry', name: 'INFANTRY SQUAD', attack: 'squads', range: 1, defense: 'squads', movement: [2], mode: 'infantry', maxSquads: 3, source: 'Ogre/G.E.V.' }),
  marines: Object.freeze({ id: 'marines', name: 'MARINES', attack: 'squads', range: 1, defense: 'squads', movement: [2], mode: 'infantry', maxSquads: 3, waterCombat: true, source: 'Shockwave' }),
  combatEngineers: Object.freeze({ id: 'combat-engineers', name: 'COMBAT ENGINEERS', attack: 2, range: 1, defense: 2, movement: [2], mode: 'infantry', engineering: true, source: 'Reinforcement Pack' }),
  militia: Object.freeze({ id: 'militia', name: 'MILITIA', attack: 1, range: 1, defense: 1, movement: [2], mode: 'infantry', cannonFodder: true, source: 'Battlefields' }),
  commandPost: Object.freeze({ id: 'command-post', name: 'COMMAND POST', attack: 0, range: 0, defense: 2, movement: [0], mode: 'fixed', commandUnit: true, source: 'Ogre/G.E.V.' })
});

export const OGRE_SYSTEMS = Object.freeze({
  mkIII: Object.freeze({ id: 'ogre-mk-iii', name: 'OGRE MK III', tread: 45, movement: [3, 2, 1, 0], mainBatteries: 1, secondaryBatteries: 4, missiles: 2, antipersonnel: 8, source: 'Ogre' }),
  mkV: Object.freeze({ id: 'ogre-mk-v', name: 'OGRE MK V', tread: 60, movement: [3, 2, 1, 0], mainBatteries: 2, secondaryBatteries: 6, missiles: 6, antipersonnel: 12, source: 'Ogre' }),
  vulcan: Object.freeze({ id: 'vulcan', name: 'VULCAN', tread: 45, movement: [3, 2, 1, 0], engineering: true, drones: true, source: 'Reinforcement Pack' }),
  ninja: Object.freeze({ id: 'ninja', name: 'NINJA', stealth: true, source: 'Reinforcement Pack' })
});