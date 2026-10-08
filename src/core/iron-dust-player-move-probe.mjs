import TerrainRules from '../../terrain-rules.js';
import {inside} from './hex.mjs';
import {queryIronDustUnifiedUnit, validateIronDustUnifiedStateProbe} from './iron-dust-unified-state-probe.mjs';

// Explicit normal moves on the existing inactive seven-unit state. The older
// B1 fixture and its historical command oracle retain their original scope.
export const IRON_DUST_PLAYER_MOVE_PROBE_VERSION = 'iron-dust-player-move-probe-v1';
const playerIds = ['ogre', 'gev', 'missile', 'infantry'];
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const deny = code => ({available: false, error: {code}});
const key = point => `${point.x},${point.y}`;
const sameKeys = (value, keys) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(name => Object.hasOwn(value, name));
const neighbors = ({x, y}) => y % 2 === 0
  ? [{x, y: y + 1}, {x: x - 1, y: y + 1}, {x: x - 1, y},
    {x: x - 1, y: y - 1}, {x, y: y - 1}, {x: x + 1, y}]
  : [{x: x + 1, y: y + 1}, {x, y: y + 1}, {x: x - 1, y},
    {x, y: y - 1}, {x: x + 1, y: y - 1}, {x: x + 1, y}];

// Match Legacy findMovementPath's neighbor order and equal-cost tie handling.
function legacyMovePath(state, actor, to, allowance) {
  const occupied = new Set(state.units.filter(unit => unit.hp > 0 && unit.id !== actor.id).map(key));
  const best = new Map([[key(actor), 0]]);
  const queue = [{x: actor.x, y: actor.y, cost: 0, path: []}];
  const mover = actor.id === 'gev' ? {...actor, movementMode: 'gev'} : actor;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const node = queue.shift();
    if (key(node) === key(to)) return node.path;
    if (node.cost > allowance) continue;
    for (const next of neighbors(node)) {
      if (!inside(state.map, next) || occupied.has(key(next))) continue;
      const terrain = state.map.terrain.find(cell => cell.x === next.x && cell.y === next.y)?.type ??
        state.map.defaultTerrain;
      const cost = node.cost + TerrainRules.movementCost(terrain, mover);
      if (cost > allowance || best.has(key(next)) && best.get(key(next)) <= cost) continue;
      best.set(key(next), cost);
      queue.push({...next, cost, path: [...node.path, next]});
    }
  }
  return null;
}

export function queryIronDustPlayerMove(state, command) {
  validateIronDustUnifiedStateProbe(state);
  if (state.fixture !== 'source') return deny('MOVE_FIXTURE_UNSUPPORTED');
  if (!sameKeys(command, ['type', 'playerId', 'unitId', 'to']) || command.type !== 'Move' ||
      typeof command.unitId !== 'string') return deny('MOVE_COMMAND_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== 'player' || state.activeTeam !== 'player')
    return deny('NOT_ACTIVE_TEAM');
  if (!playerIds.includes(command.unitId)) return deny('MOVE_UNIT_UNSUPPORTED');
  if (state.phase !== 'movement' && !(state.phase === 'gev' && command.unitId === 'gev'))
    return deny('WRONG_PHASE');
  const actor = state.units.find(unit => unit.id === command.unitId);
  if (actor.hp <= 0 || actor.disabled) return deny('UNIT_UNAVAILABLE');
  if (state.phase === 'gev' ? actor.secondMoved : actor.moved) return deny('ACTION_SPENT');
  if (!sameKeys(command.to, ['x', 'y']) || !inside(state.map, command.to))
    return deny('OUT_OF_BOUNDS');
  if (key(command.to) === key(actor)) return deny('UNREACHABLE');
  const allowance = state.phase === 'gev' ? 2 :
    queryIronDustUnifiedUnit(state, actor.id).firstMove;
  const path = legacyMovePath(state, actor, command.to, allowance);
  return path ? {available: true, resolverVersion: IRON_DUST_PLAYER_MOVE_PROBE_VERSION,
    allowance, cost: path.reduce((sum, cell) => {
      const terrain = state.map.terrain.find(item => item.x === cell.x && item.y === cell.y)?.type ??
        state.map.defaultTerrain;
      return sum + TerrainRules.movementCost(terrain,
        actor.id === 'gev' ? {...actor, movementMode: 'gev'} : actor);
    }, 0), path} : deny('UNREACHABLE');
}

export function preflightIronDustPlayerMove(state, command) {
  return queryIronDustPlayerMove(state, command);
}

export function dispatchIronDustPlayerMove(state, command) {
  const query = queryIronDustPlayerMove(state, command);
  if (!query.available) return {error: query.error};
  const next = clone(state), actor = next.units.find(unit => unit.id === command.unitId);
  const from = {x: actor.x, y: actor.y};
  actor.x = command.to.x;
  actor.y = command.to.y;
  if (state.phase === 'gev') actor.secondMoved = true;
  else actor.moved = true;
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events: [{type: 'UnitMoved', unitId: actor.id,
    from, to: clone(command.to), path: query.path, phase: state.phase}]};
}
