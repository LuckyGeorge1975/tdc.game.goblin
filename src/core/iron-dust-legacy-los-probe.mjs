import TerrainRules from '../../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);

// Standalone geometry probe; this header is never registered with createGame.
export const IRON_DUST_LEGACY_LOS_PROBE_V1 = freeze({
  probeVersion: 'iron-dust-legacy-pixel-los-v1',
  executable: false,
  scenarioId: source.scenarioId,
  scenarioVersion: source.scenarioVersion,
  sourceRuleProfileId: source.ruleProfileId,
  dataContractVersion: source.dataContractVersion,
  losMode: 'legacy-pixel-sample-8-v1',
  map: clone(source.map)
});

export function validateIronDustLegacyLosProbeV1(value) {
  if (!same(value, IRON_DUST_LEGACY_LOS_PROBE_V1)) {
    const error = new Error('LOS_PROBE_MISMATCH');
    error.code = 'LOS_PROBE_MISMATCH';
    throw error;
  }
  return IRON_DUST_LEGACY_LOS_PROBE_V1;
}

const S = 34, DX = Math.sqrt(3) * S, DY = 1.5 * S;
const hexCenter = (x, y) => ({x: 58 + x * DX + (y % 2 ? DX / 2 : 0), y: 48 + y * DY});
const terrainTypeAt = (map, x, y) => map.terrain.find(cell => cell.x === x && cell.y === y)?.type ?? map.defaultTerrain;

function nearestHex(map, px, py) {
  let best = null, bestDistance = Infinity;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const center = hexCenter(x, y), distance = (center.x - px) ** 2 + (center.y - py) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = {x, y}; }
  }
  return best;
}

export function hasIronDustLegacyLineOfSight(probe, from, to) {
  const {map} = validateIronDustLegacyLosProbeV1(probe);
  for (const point of [from, to]) {
    if (!Number.isInteger(point?.x) || !Number.isInteger(point?.y) ||
        point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) {
      const error = new Error('LOS_PROBE_INVALID_POINT');
      error.code = 'LOS_PROBE_INVALID_POINT';
      throw error;
    }
  }
  const steps = Math.max(2, Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y),
    Math.abs((from.x + from.y) - (to.x + to.y))) * 8);
  const a = hexCenter(from.x, from.y), b = hexCenter(to.x, to.y);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, cell = nearestHex(map, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    if ((cell.x !== from.x || cell.y !== from.y) &&
        (cell.x !== to.x || cell.y !== to.y) &&
        TerrainRules.blocksLos(terrainTypeAt(map, cell.x, cell.y))) return false;
  }
  return true;
}
