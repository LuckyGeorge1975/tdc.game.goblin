import TerrainRules from '../legacy/scripts/terrain-rules.js';

export const key = ({ x, y }) => `${x},${y}`;
export const inside = (map, p) => Number.isInteger(p?.x) && Number.isInteger(p?.y) && p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
export const terrainAt = (state, p) => state.map.terrain.find(t => t.x === p.x && t.y === p.y)?.type ?? 'open-ground';

// Existing artwork uses odd-row offset coordinates. Convert only inside the core.
const axial = p => ({ q: p.x - (p.y - (p.y & 1)) / 2, r: p.y });
const offset = ({ q, r }) => ({ x: q + (r - (r & 1)) / 2, y: r });
export function hexDistance(a, b) {
  const u = axial(a), v = axial(b), dq = u.q - v.q, dr = u.r - v.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}
export function neighbors(p) {
  const { q, r } = axial(p);
  return [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([dq, dr]) => offset({ q: q + dq, r: r + dr }));
}
export function cells(map) {
  return Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => ({ x, y }))).flat();
}
function roundHex(q, r) {
  let x = Math.round(q), z = Math.round(r), y = Math.round(-q - r);
  const dx = Math.abs(x - q), dy = Math.abs(y + q + r), dz = Math.abs(z - r);
  if (dx > dy && dx > dz) x = -y - z;
  else if (dy > dz) y = -x - z;
  else z = -x - y;
  return offset({ q: x, r: z });
}
export function hasLineOfSight(state, from, to) {
  if (!inside(state.map, from) || !inside(state.map, to)) return false;
  const distance = hexDistance(from, to), a = axial(from), b = axial(to);
  for (let step = 1; step < distance; step++) {
    const t = step / distance;
    const p = roundHex(a.q + (b.q - a.q) * t + 1e-7, a.r + (b.r - a.r) * t + 1e-7);
    if (TerrainRules.blocksLos(terrainAt(state, p))) return false;
  }
  return true;
}
export function movementPaths(state, unit, allowance = unit.move) {
  const start = { x: unit.x, y: unit.y }, occupied = new Set(state.units.filter(u => u.id !== unit.id && u.hp > 0 && !u.embarkedOn).map(key));
  const best = new Map([[key(start), { cost: 0, path: [] }]]), pending = [{ cell: start, cost: 0, path: [] }];
  while (pending.length) {
    pending.sort((a, b) => a.cost - b.cost || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
    const current = pending.shift();
    if (current.cost !== best.get(key(current.cell))?.cost) continue;
    for (const next of neighbors(current.cell)) {
      if (!inside(state.map, next) || occupied.has(key(next))) continue;
      const cost = current.cost + TerrainRules.movementCost(terrainAt(state, next), unit);
      if (!Number.isFinite(cost) || cost > allowance || cost >= (best.get(key(next))?.cost ?? Infinity)) continue;
      const path = [...current.path, next];
      best.set(key(next), { cost, path });
      pending.push({ cell: next, cost, path });
    }
  }
  best.delete(key(start));
  return best;
}

export function queryAreas(state, unitId) {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.hp <= 0 || unit.embarkedOn) return { movementReachable: [], fireRange: [], lineOfSight: [], attackableTargets: [] };
  const origin = { x: unit.x, y: unit.y };
  const canMove = state.activeTeam === unit.team && !unit.disabled && (
    state.phase === 'movement' && !unit.moved ||
    state.phase === 'gev' && unit.movementMode === 'gev' && !unit.secondMoved
  );
  const movementReachable = [...(canMove ? movementPaths(state, unit, state.phase === 'gev' ? 2 : unit.move).keys() : [])].map(k => {
    const [x, y] = k.split(',').map(Number); return { x, y };
  });
  const fireRange = cells(state.map).filter(p => hexDistance(origin, p) > 0 && hexDistance(origin, p) <= unit.range);
  const lineOfSight = cells(state.map).filter(p => key(p) !== key(origin) && hasLineOfSight(state, origin, p));
  const inRange = new Set(fireRange.map(key)), visible = new Set(lineOfSight.map(key));
  const attackableTargets = state.phase === 'fire' && state.activeTeam === unit.team && !unit.fired && !unit.disabled
    ? state.units.filter(target => target.team !== unit.team && target.hp > 0 && !target.embarkedOn && inRange.has(key(target)) && visible.has(key(target))).map(target => target.id)
    : [];
  return { movementReachable, fireRange, lineOfSight, attackableTargets };
}
