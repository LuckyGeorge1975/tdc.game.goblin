import TerrainRules from '../../terrain-rules-module.mjs';
import {supercoverIntermediateHexes} from './supercover-line.mjs';
import {CORE_SUPERCOVER_CONTRACT, CORE_IRON_DUST_GEV_PROBE_CONTRACT,
  CORE_SIEGE_TANK_PROBE_CONTRACT, CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT} from './profile-contract.mjs';

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
// Legacy pixel-sampling LOS: interpolates pixel centers at 8x hex-distance resolution.
const PIXEL_S = 34, PIXEL_DX = Math.sqrt(3) * PIXEL_S, PIXEL_DY = 1.5 * PIXEL_S;
function pixelCenter(x, y) { return { px: 58 + x * PIXEL_DX + (y & 1 ? PIXEL_DX / 2 : 0), py: 48 + y * PIXEL_DY }; }
function nearestHexPixel(map, px, py) {
  let best = null, bestD = Infinity;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const c = pixelCenter(x, y), d = (c.px - px) ** 2 + (c.py - py) ** 2;
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  return best;
}
function legacyPixelLos(state, from, to) {
  const steps = Math.max(2, Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y),
    Math.abs((from.x + from.y) - (to.x + to.y))) * 8);
  const a = pixelCenter(from.x, from.y), b = pixelCenter(to.x, to.y);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, cell = nearestHexPixel(state.map, a.px + (b.px - a.px) * t, a.py + (b.py - a.py) * t);
    if ((cell.x !== from.x || cell.y !== from.y) && (cell.x !== to.x || cell.y !== to.y) &&
        TerrainRules.blocksLos(terrainAt(state, cell))) return false;
  }
  return true;
}
export function hasLineOfSight(state, from, to) {
  if (!inside(state.map, from) || !inside(state.map, to)) return false;
  if (state.rulesVersion === CORE_SUPERCOVER_CONTRACT.rulesVersion)
    return supercoverIntermediateHexes(from, to)
      .every(cell => !TerrainRules.blocksLos(terrainAt(state, cell)));
  return legacyPixelLos(state, from, to);
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
  const gevProbe = state.rulesVersion === CORE_IRON_DUST_GEV_PROBE_CONTRACT.rulesVersion;
  const origin = { x: unit.x, y: unit.y };
  const canMove = (!gevProbe || unit.id === 'gev') && state.activeTeam === unit.team && !unit.disabled && (
    state.phase === 'movement' && !unit.moved ||
    state.phase === 'gev' && unit.movementMode === 'gev' && !unit.secondMoved
  );
  const movementReachable = [...(canMove ? movementPaths(state, unit, state.phase === 'gev' ? 2 : unit.move).keys() : [])].map(k => {
    const [x, y] = k.split(',').map(Number); return { x, y };
  });
  const fireRange = cells(state.map).filter(p => hexDistance(origin, p) > 0 && hexDistance(origin, p) <= unit.range);
  const lineOfSight = cells(state.map).filter(p => key(p) !== key(origin) && hasLineOfSight(state, origin, p));
  const inRange = new Set(fireRange.map(key)), visible = new Set(lineOfSight.map(key));
  const attackableTargets = !gevProbe &&
    state.rulesVersion !== CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion &&
    state.rulesVersion !== CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT.rulesVersion &&
    state.phase === 'fire' && state.activeTeam === unit.team && !unit.fired && !unit.disabled
    ? state.units.filter(target => target.team !== unit.team && target.hp > 0 && !target.embarkedOn && inRange.has(key(target)) && visible.has(key(target))).map(target => target.id)
    : [];
  return { movementReachable, fireRange, lineOfSight, attackableTargets };
}
