import TerrainRules from '../../terrain-rules.js';
import {hexDistance, terrainAt} from './hex.mjs';
import {validateIronDustUnifiedStateProbe, queryIronDustFireGeometry} from
  './iron-dust-unified-state-probe.mjs';
import {queryIronDustStandardFireAction} from './iron-dust-standard-fire-action-probe.mjs';

// Read-only Legacy decision on the inactive seven-unit probe. No scheduler,
// state transition, event, or random draw is exposed here.
export const IRON_DUST_ENEMY_INTENT_VERSION = 'iron-dust-enemy-intent-v1';
const actors = ['guard', 'raider'];
const stages = ['first-fire', 'move', 'retry-fire'];
const systemPriority = ['missiles', 'main', 'secondary', 'treads', 'antipersonnel'];
const deny = code => ({available: false, error: {code}});
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const key = p => `${p.x},${p.y}`;
const neighbors = ({x, y}) => y % 2 === 0
  ? [{x, y: y + 1}, {x: x - 1, y: y + 1}, {x: x - 1, y},
    {x: x - 1, y: y - 1}, {x, y: y - 1}, {x: x + 1, y}]
  : [{x: x + 1, y: y + 1}, {x, y: y + 1}, {x: x - 1, y},
    {x, y: y - 1}, {x: x + 1, y: y - 1}, {x: x + 1, y}];
const remaining = weapon => Math.max(0, Math.min(weapon.remaining, weapon.count - weapon.destroyed));
const systemTarget = systems => systemPriority.find(name => name === 'treads' ||
  remaining(systems.weapons[name]) > 0);
const candidates = (state, actor, excludeEmbarked) => state.units
  .filter(unit => unit.team === 'player' && unit.hp > 0 &&
    (!excludeEmbarked || !unit.embarkedOn))
  .sort((a, b) => hexDistance(actor, a) - hexDistance(actor, b));

function firstFire(state, actor) {
  for (const target of candidates(state, actor, true)) {
    const geometry = queryIronDustFireGeometry(state, actor.id, target.id, actor.range,
      {outOfRange: 'OUT_OF_RANGE', sightBlocked: 'SIGHT_BLOCKED'});
    if (!geometry.available) continue;
    const command = target.id === 'ogre'
      ? {type: 'EnemySystemAttack', playerId: 'enemy', attackerId: actor.id,
        targetId: 'ogre', targetKey: systemTarget(target.ogreSystems)}
      : {type: 'EnemyUnitAttack', playerId: 'enemy', attackerId: actor.id,
        targetId: target.id};
    if (!queryIronDustStandardFireAction(state, command).available) continue;
    return {kind: 'fire', actorId: actor.id, targetId: target.id,
      ...(target.id === 'ogre' ? {targetKey: command.targetKey} : {}), command};
  }
  return null;
}

// Keep the historical FIFO queue, neighbor order, cheaper-cost revisit and
// strict distance improvement. The shared Core pathfinder has different ties.
function legacyStep(state, actor, target) {
  const occupied = new Set(state.units.filter(unit => unit.hp > 0 && unit !== actor).map(key));
  const queue = [{x: actor.x, y: actor.y, cost: 0, path: []}];
  const seen = new Map([[key(actor), 0]]);
  let best = null;
  while (queue.length) {
    const node = queue.shift();
    const distance = hexDistance(node, target), original = hexDistance(actor, target);
    if (node.path.length && distance < original &&
        (!best || distance < hexDistance(best, target) ||
          distance === hexDistance(best, target) && node.cost < best.cost)) best = node;
    for (const next of neighbors(node)) {
      const nextKey = key(next);
      const stepCost = TerrainRules.movementCost(terrainAt(state, next), actor);
      const cost = node.cost + stepCost;
      if (next.x < 0 || next.x >= state.map.width || next.y < 0 ||
          next.y >= state.map.height || occupied.has(nextKey) || cost > actor.move) continue;
      if (!seen.has(nextKey) || cost < seen.get(nextKey)) {
        seen.set(nextKey, cost);
        queue.push({x: next.x, y: next.y, cost, path: [...node.path, next]});
      }
    }
  }
  return best;
}

export function queryIronDustEnemyIntent(state, request) {
  validateIronDustUnifiedStateProbe(state);
  if (!exact(request, ['type', 'playerId', 'actorId', 'stage', 'claim']) ||
      request.type !== 'EnemyIntent' || !stages.includes(request.stage) ||
      !['auto', 'pass'].includes(request.claim)) return deny('ENEMY_INTENT_REQUEST_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (request.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (state.phase !== 'enemy') return deny('WRONG_PHASE');
  if (!actors.includes(request.actorId)) return deny(request.actorId === 'core'
    ? 'ENEMY_ACTOR_FORBIDDEN' : 'ENEMY_ACTOR_INVALID');
  const actor = state.units.find(unit => unit.id === request.actorId);
  if (actor.hp <= 0) return deny('ENEMY_ACTOR_DESTROYED');
  if (state.enemyPassed.includes(actor.id) || state.firedActorIds.includes(actor.id))
    return deny('ACTION_SPENT');
  if (actor.disabled) {
    if (request.stage !== 'first-fire') return deny('STALE_STAGE');
    return {available: true, resolverVersion: IRON_DUST_ENEMY_INTENT_VERSION,
      kind: 'pass', actorId: actor.id, reason: 'DISABLED',
      command: {type: 'EnemyPass', playerId: 'enemy', actorId: actor.id}};
  }
  if (request.stage === 'retry-fire' ? !actor.moved : actor.moved)
    return deny('STALE_STAGE');
  let intent;
  if (request.stage === 'move') {
    if (firstFire(state, actor)) return deny('FIRE_AVAILABLE');
    const target = candidates(state, actor, false)[0];
    const step = target && legacyStep(state, actor, target);
    intent = step ? {kind: 'move', actorId: actor.id, targetId: target.id,
      to: {x: step.x, y: step.y}, cost: step.cost,
      path: step.path.map(point => ({x: point.x, y: point.y}))} : null;
  } else intent = firstFire(state, actor);
  if (!intent && request.stage === 'first-fire')
    intent = {kind: 'continue', actorId: actor.id, nextStage: 'move'};
  if (!intent) intent = {kind: 'pass', actorId: actor.id,
    reason: request.stage === 'move' ? 'HOLD' : 'NO_TARGET',
    command: {type: 'EnemyPass', playerId: 'enemy', actorId: actor.id}};
  if (request.claim === 'pass' && intent.kind !== 'pass') return deny('PASS_FORBIDDEN');
  return {available: true, resolverVersion: IRON_DUST_ENEMY_INTENT_VERSION, ...intent};
}
