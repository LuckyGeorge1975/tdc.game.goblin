import TerrainRules from '../../terrain-rules.js';
import {inside, movementPaths} from './hex.mjs';
import {IRON_DUST_NEAR_CORE_FIXTURE_VERSION, IRON_DUST_REST_OGRE_FIXTURE_VERSION,
  IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION, IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION,
  IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION,
  validateIronDustUnifiedStateProbe,
  queryIronDustUnifiedUnit} from './iron-dust-unified-state-probe.mjs';

export const IRON_DUST_B1_ACTION_VERSION = 'iron-dust-explicit-phase-move-ram-v1';
const actors = ['guard', 'raider'];
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const deny = code => ({available: false, error: {code}});
const sameKeys = (command, keys) => command && Object.keys(command).length === keys.length &&
  keys.every(key => Object.hasOwn(command, key));
const unit = (state, id) => state.units.find(item => item.id === id);
const key = point => `${point.x},${point.y}`;
const terrainAt = (state, point) => state.map.terrain.find(cell =>
  cell.x === point.x && cell.y === point.y)?.type ?? 'open-ground';
const neighbors = ({x, y}) => y % 2 === 0
  ? [{x, y: y + 1}, {x: x - 1, y: y + 1}, {x: x - 1, y},
    {x: x - 1, y: y - 1}, {x, y: y - 1}, {x: x + 1, y}]
  : [{x: x + 1, y: y + 1}, {x, y: y + 1}, {x: x - 1, y},
    {x, y: y - 1}, {x: x + 1, y: y - 1}, {x: x + 1, y}];

// Legacy findMovementPath allows the occupied destination only for this Ram branch.
function ramPath(state, actor, target) {
  const occupied = new Set(state.units.filter(item => item.hp > 0 && item.id !== actor.id).map(key));
  const best = new Map([[key(actor), 0]]);
  const queue = [{x: actor.x, y: actor.y, cost: 0, path: []}];
  const allowance = queryIronDustUnifiedUnit(state, actor.id).movement;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const node = queue.shift();
    if (key(node) === key(target)) return node.path;
    if (node.cost > allowance) continue;
    for (const next of neighbors(node)) {
      if (!inside(state.map, next)) continue;
      const nextKey = key(next);
      if (occupied.has(nextKey) && nextKey !== key(target)) continue;
      const cost = node.cost + TerrainRules.movementCost(terrainAt(state, next), actor);
      if (cost > allowance || best.has(nextKey) && best.get(nextKey) <= cost) continue;
      best.set(nextKey, cost);
      queue.push({...next, cost, path: [...node.path, next]});
    }
  }
  return null;
}

export function queryIronDustB1Action(state, command) {
  validateIronDustUnifiedStateProbe(state);
  if (!['source', 'adjacent', IRON_DUST_NEAR_CORE_FIXTURE_VERSION,
    IRON_DUST_REST_OGRE_FIXTURE_VERSION, IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION,
    IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION,
    IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION].includes(state.fixture))
    return deny('B1_FIXTURE_UNSUPPORTED');
  if (!command || typeof command.type !== 'string') return deny('B1_COMMAND_INVALID');
  const keys = command.type === 'EndPhase' ? ['type', 'playerId'] :
    command.type === 'EnemyPass' ? ['type', 'playerId', 'actorId'] :
    command.type === 'Move' ? ['type', 'playerId', 'unitId', 'to'] :
    command.type === 'Ram' ? ['type', 'playerId', 'unitId', 'targetId'] : null;
  if (!keys) return deny('B1_COMMAND_UNSUPPORTED');
  if (!sameKeys(command, keys)) return deny('B1_COMMAND_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (command.type === 'EndPhase') {
    if (state.phase === 'enemy' && state.enemyPassed.length !== actors.length)
      return deny('ENEMY_COMMANDS_PENDING');
    if (state.phase === 'enemy' && state.turn === Number.MAX_SAFE_INTEGER)
      return deny('TURN_LIMIT');
    return {available: true};
  }
  if (command.type === 'EnemyPass') {
    if (state.phase !== 'enemy') return deny('WRONG_PHASE');
    if (!actors.includes(command.actorId))
      return deny(command.actorId === 'core' ? 'ENEMY_ACTOR_FORBIDDEN' : 'ENEMY_ACTOR_INVALID');
    if (state.enemyPassed.includes(command.actorId) || state.firedActorIds.includes(command.actorId))
      return deny('ACTION_SPENT');
    return {available: true};
  }
  if (command.type === 'Move') {
    if (command.unitId !== 'gev') return deny('B1_UNIT_UNSUPPORTED');
    if (!['movement', 'gev'].includes(state.phase)) return deny('WRONG_PHASE');
    const actor = unit(state, 'gev');
    if (actor.hp <= 0 || actor.disabled) return deny('UNIT_UNAVAILABLE');
    if (state.phase === 'movement' ? actor.moved : actor.secondMoved) return deny('ACTION_SPENT');
    if (!sameKeys(command.to, ['x', 'y']) || !inside(state.map, command.to))
      return deny('OUT_OF_BOUNDS');
    const allowance = state.phase === 'gev' ? 2 : queryIronDustUnifiedUnit(state, actor.id).movement;
    const path = movementPaths(state, {...actor, movementMode: 'gev'}, allowance)
      .get(key(command.to))?.path;
    return path ? {available: true, path} : deny('UNREACHABLE');
  }
  if (command.unitId !== 'ogre') return deny('B1_UNIT_UNSUPPORTED');
  if (state.phase !== 'movement') return deny('WRONG_PHASE');
  const actor = unit(state, 'ogre');
  if (actor.hp <= 0 || actor.disabled) return deny('UNIT_UNAVAILABLE');
  if (actor.moved) return deny('RAM_ACTION_SPENT');
  const target = unit(state, command.targetId);
  if (!target || target.team !== 'enemy' || target.hp <= 0)
    return deny('RAM_TARGET_INVALID');
  if (target.core) return deny('RAM_CORE_FORBIDDEN');
  const path = ramPath(state, actor, target);
  return path ? {available: true, path} : deny('RAM_PATH_BLOCKED');
}

export function preflightIronDustB1Action(state, command) {
  return queryIronDustB1Action(state, command);
}

// Explicit technical actions only. Fire, AI, replay and product profiles stay outside this module.
export function dispatchIronDustB1Action(state, command) {
  const query = queryIronDustB1Action(state, command);
  if (!query.available) return {error: query.error};
  const next = clone(state), events = [];
  if (command.type === 'EndPhase') {
    const from = state.phase;
    if (from === 'movement') next.phase = 'fire';
    else if (from === 'fire') next.phase = 'gev';
    else if (from === 'gev') {
      next.phase = 'enemy';
      next.activeTeam = 'enemy';
      recover(next, 'enemy', events);
    } else {
      next.turn++;
      next.phase = 'movement';
      next.activeTeam = 'player';
      next.enemyPassed = [];
      next.firedActorIds = [];
      for (const item of next.units) {
        item.moved = false;
        item.fired = false;
        item.secondMoved = false;
      }
      for (const weapon of Object.values(unit(next, 'ogre').ogreSystems.weapons))
        weapon.firedThisPhase = 0;
      recover(next, 'player', events);
    }
    events.push({type: 'PhaseChanged', from, to: next.phase,
      side: next.activeTeam, turn: next.turn});
  } else if (command.type === 'EnemyPass') {
    next.enemyPassed.push(command.actorId);
    next.enemyPassed.sort((a, b) => actors.indexOf(a) - actors.indexOf(b));
    events.push({type: 'EnemyPassRecorded', actorId: command.actorId,
      turn: next.turn, pendingActorIds: actors.filter(id => !next.enemyPassed.includes(id))});
  } else if (command.type === 'Move') {
    const moving = unit(next, 'gev'), from = {x: moving.x, y: moving.y};
    moving.x = command.to.x;
    moving.y = command.to.y;
    if (state.phase === 'gev') moving.secondMoved = true;
    else moving.moved = true;
    events.push({type: 'UnitMoved', unitId: moving.id, from, to: clone(command.to),
      path: query.path, phase: state.phase});
  } else {
    const actor = unit(next, 'ogre'), target = unit(next, command.targetId);
    const from = {x: actor.x, y: actor.y}, to = {x: target.x, y: target.y};
    actor.x = to.x;
    actor.y = to.y;
    actor.moved = true;
    target.hp = 0;
    events.push({type: 'RamResolved', actorId: 'ogre', targetId: target.id,
      from, to, path: query.path, targetHp: 0, actorHp: actor.hp});
  }
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events};
}

function recover(state, team, events) {
  for (const item of state.units.filter(unit => unit.team === team && unit.hp > 0 &&
      unit.disabled && unit.disabledUntil <= state.turn)) {
    item.disabled = false;
    item.disabledUntil = 0;
    events.push({type: 'UnitRecovered', unitId: item.id, side: team, turn: state.turn});
  }
}
