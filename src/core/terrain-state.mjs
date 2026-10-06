import TerrainRules from '../../terrain-rules.js';

// Inactive data contract. A projection is a query fixture, not an engineering
// action or an authorization for any terrain transition during play.
export const TERRAIN_STATE_SCHEMA_VERSION = 1;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value, names) => isRecord(value) && Object.keys(value).length === names.length &&
  names.every(name => Object.hasOwn(value, name));
const validSize = value => Number.isInteger(value) && value > 0;
const inside = (snapshot, cell) => Number.isInteger(cell.x) && Number.isInteger(cell.y) &&
  cell.x >= 0 && cell.x < snapshot.width && cell.y >= 0 && cell.y < snapshot.height;
const cellKey = cell => `${cell.x},${cell.y}`;

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function checkCells(snapshot, cells) {
  if (!Array.isArray(cells)) reject('INVALID_TERRAIN_CELLS');
  const seen = new Set();
  for (const cell of cells) {
    if (!keysAre(cell, ['x', 'y', 'type']) || !inside(snapshot, cell) ||
        typeof cell.type !== 'string' || !Object.hasOwn(TerrainRules.rules, cell.type))
      reject('INVALID_TERRAIN_CELL');
    const key = cellKey(cell);
    if (seen.has(key)) reject('DUPLICATE_TERRAIN_CELL');
    seen.add(key);
  }
}

export function snapshotTerrainState(map) {
  if (!keysAre(map, ['width', 'height', 'terrain'])) reject('INVALID_TERRAIN_STATE');
  return validateTerrainState({...map, schemaVersion: TERRAIN_STATE_SCHEMA_VERSION});
}

export function validateTerrainState(value) {
  if (!keysAre(value, ['schemaVersion', 'width', 'height', 'terrain']))
    reject('INVALID_TERRAIN_STATE');
  if (value.schemaVersion !== TERRAIN_STATE_SCHEMA_VERSION) reject('UNSUPPORTED_TERRAIN_VERSION');
  if (!validSize(value.width) || !validSize(value.height)) reject('INVALID_TERRAIN_STATE');
  checkCells(value, value.terrain);
  return Object.freeze({
    schemaVersion: TERRAIN_STATE_SCHEMA_VERSION,
    width: value.width,
    height: value.height,
    terrain: Object.freeze(value.terrain.map(cell => Object.freeze({x: cell.x, y: cell.y, type: cell.type})))
  });
}

// Replaces named cells in an isolated snapshot. This has no gameplay caller,
// action budget, permitted transition table, or replay meaning.
export function projectTerrainStateForProbe(base, replacements) {
  const snapshot = validateTerrainState(base);
  checkCells(snapshot, replacements);
  const changes = new Map(replacements.map(cell => [cellKey(cell), cell]));
  const terrain = snapshot.terrain.map(cell => changes.get(cellKey(cell)) ?? cell);
  for (const cell of replacements) {
    if (!snapshot.terrain.some(existing => cellKey(existing) === cellKey(cell))) terrain.push(cell);
  }
  return snapshotTerrainState({width: snapshot.width, height: snapshot.height, terrain});
}
