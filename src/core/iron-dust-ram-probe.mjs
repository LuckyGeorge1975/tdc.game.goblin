import TerrainRules from '../../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';

export const IRON_DUST_RAM_PROBE_VERSION = 'iron-dust-siegebreaker-ram-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const fixtures = Object.freeze({source: null, 'near-guard': 'guard',
  'near-raider': 'raider', 'near-core': 'core', 'rubble-guard': 'guard'});
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
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const reject = code => {throw Object.assign(new Error(code), {code})};
const cellKey = ({x, y}) => `${x},${y}`;
const terrainAt = ({x, y}) => source.map.terrain.find(cell => cell.x === x && cell.y === y)?.type ?? source.map.defaultTerrain;

function neighbors(x, y) {
  return y % 2 === 0
    ? [{x, y: y + 1}, {x: x - 1, y: y + 1}, {x: x - 1, y},
      {x: x - 1, y: y - 1}, {x, y: y - 1}, {x: x + 1, y}]
    : [{x: x + 1, y: y + 1}, {x, y: y + 1}, {x: x - 1, y},
      {x, y: y - 1}, {x: x + 1, y: y - 1}, {x: x + 1, y}];
}

// Matches Legacy findMovementPath for this fixed, non-embarked snapshot.
function pathTo(state, actor, target) {
  const targetKey = cellKey(target);
  const occupied = new Set(state.units.filter(unit => unit.hp > 0 && unit !== actor).map(cellKey));
  const best = new Map([[cellKey(actor), 0]]);
  const queue = [{x: actor.x, y: actor.y, cost: 0, path: []}];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const node = queue.shift();
    if (cellKey(node) === targetKey) return node.path;
    if (node.cost > actor.move) continue;
    for (const next of neighbors(node.x, node.y)) {
      if (next.x < 0 || next.x >= source.map.width || next.y < 0 || next.y >= source.map.height) continue;
      const key = cellKey(next);
      if (occupied.has(key) && key !== targetKey) continue;
      const cost = node.cost + TerrainRules.movementCost(terrainAt(next), actor);
      if (cost > actor.move || best.has(key) && best.get(key) <= cost) continue;
      best.set(key, cost);
      queue.push({x: next.x, y: next.y, cost, path: [...node.path, next]});
    }
  }
  return null;
}

function initialState(seed, fixture, turnPhase, initialMoved) {
  const units = clone(source.units), actor = units.find(unit => unit.id === 'ogre');
  actor.moved = initialMoved;
  actor.acted = false;
  actor.disabled = false;
  if (fixtures[fixture]) {
    const target = units.find(unit => unit.id === fixtures[fixture]);
    target.x = fixture === 'rubble-guard' ? 1 : 2;
    target.y = fixture === 'rubble-guard' ? 4 : 5;
  }
  return {probeVersion: IRON_DUST_RAM_PROBE_VERSION, executable: false,
    sourceDataVersion: source.dataContractVersion, sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId, fixture, phase: 'player', turnPhase,
    initialMoved, selectedUnitId: 'ogre', rammed: false, units, rng: {seed, state: seed}};
}

export function createIronDustRamProbe(seed, options = {}) {
  const {fixture = 'source', turnPhase = 'movement', moved = false} = options ?? {};
  if (!u32(seed) || !Object.hasOwn(fixtures, fixture) ||
      !['movement', 'fire', 'gev'].includes(turnPhase) || typeof moved !== 'boolean')
    reject('RAM_PROBE_SETUP_INVALID');
  return freeze(initialState(seed, fixture, turnPhase, moved));
}

export function validateIronDustRamProbe(state) {
  if (!state || !u32(state.rng?.seed) || state.rng.state !== state.rng.seed ||
      !Object.hasOwn(fixtures, state.fixture) ||
      !['movement', 'fire', 'gev'].includes(state.turnPhase) ||
      typeof state.initialMoved !== 'boolean') reject('RAM_PROBE_MISMATCH');
  const initial = initialState(state.rng.seed, state.fixture, state.turnPhase, state.initialMoved);
  if (same(state, initial)) return state;
  if (state.fixture === 'source' || state.fixture === 'near-core' ||
      state.turnPhase !== 'movement' || state.initialMoved) reject('RAM_PROBE_MISMATCH');
  const target = initial.units.find(unit => unit.id === fixtures[state.fixture]);
  const actor = initial.units.find(unit => unit.id === 'ogre');
  actor.moveFrom = {x: actor.x, y: actor.y};
  actor.x = target.x;
  actor.y = target.y;
  actor.moved = true;
  actor.acted = true;
  target.hp = 0;
  target.justHit = true;
  initial.selectedUnitId = null;
  initial.rammed = true;
  if (!same(state, initial)) reject('RAM_PROBE_MISMATCH');
  return state;
}

export function queryIronDustRamProbe(state, targetId) {
  validateIronDustRamProbe(state);
  const actor = state.units.find(unit => unit.id === 'ogre');
  const target = state.units.find(unit => unit.id === targetId);
  if (state.rammed || actor.moved) return {available: false, error: {code: 'RAM_ACTION_SPENT'}};
  if (state.phase !== 'player' || state.turnPhase !== 'movement')
    return {available: false, error: {code: 'RAM_WRONG_PHASE'}};
  if (!target || target.team !== 'enemy' || target.hp <= 0)
    return {available: false, error: {code: 'RAM_TARGET_INVALID'}};
  if (target.core) return {available: false, error: {code: 'RAM_CORE_FORBIDDEN'}};
  const path = pathTo(state, actor, target);
  if (!path) return {available: false, error: {code: 'RAM_PATH_BLOCKED'}};
  return {available: true, path};
}

// No victory transition, UI selection flow or actual Core Move/Fire is enabled.
export function dispatchIronDustRamProbe(state, command) {
  validateIronDustRamProbe(state);
  if (!command || command.type !== 'Ram') return {error: {code: 'RAM_COMMAND_UNSUPPORTED'}};
  const query = queryIronDustRamProbe(state, command.targetId);
  if (!query.available) return {error: query.error};
  const next = clone(state), actor = next.units.find(unit => unit.id === 'ogre');
  const target = next.units.find(unit => unit.id === command.targetId);
  const from = {x: actor.x, y: actor.y}, to = {x: target.x, y: target.y};
  actor.moveFrom = from;
  actor.x = to.x;
  actor.y = to.y;
  actor.moved = true;
  actor.acted = true;
  target.hp = 0;
  target.justHit = true;
  next.selectedUnitId = null;
  next.rammed = true;
  return {state: freeze(next), events: [{type: 'RamResolved', actorId: 'ogre',
    targetId: target.id, from, to, path: query.path, targetHp: 0,
    actorHp: actor.hp, rngState: next.rng.state}]};
}
