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