import TerrainRules from '../../terrain-rules-module.mjs';
import {hexDistance, terrainAt} from './hex.mjs';
import {validateIronDustUnifiedStateProbe, queryIronDustFireGeometry,
  IRON_DUST_ZERO_TREADS_POLICY_VERSION} from
  './iron-dust-unified-state-probe.mjs';
import {queryIronDustStandardFireAction} from './iron-dust-standard-fire-action-probe.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from
  './iron-dust-legacy-los-probe.mjs';
import {validIronDustEnemyPolicy} from './iron-dust-enemy-policy.mjs';

// Read-only Legacy decision on the inactive seven-unit probe. No scheduler,
// state transition, event, or random draw is exposed here.
export const IRON_DUST_ENEMY_INTENT_VERSION = 'iron-dust-enemy-intent-v1';
export const IRON_DUST_ZERO_TREADS_ENEMY_INTENT_VERSION = 'iron-dust-enemy-intent-v2';
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
const systemTarget = (systems, corrected, checks) => systemPriority.find((name, priority) => {
  const available = name === 'treads' ? !corrected || systems.treads > 0 : remaining(systems.weapons[name]) > 0;
  if (checks) checks.push({targetKey: name, priority, status: available ? 'selected' : 'rejected',
    reason: available ? 'first-available-system' : 'depleted-system'});
  return available;
});
const candidates = (state, actor, excludeEmbarked) => state.units
  .filter(unit => unit.team === 'player' && unit.hp > 0 &&
    (!excludeEmbarked || !unit.embarkedOn))
  .sort((a, b) => hexDistance(actor, a) - hexDistance(actor, b));

function threat(target) {
  if (!target.ogreSystems) return target.damage;
  return Math.max(0, ...Object.values(target.ogreSystems.weapons)
    .filter(weapon => remaining(weapon) > 0).map(weapon => weapon.attack));
}

function firstFire(state, actor, policy, trace) {
  const targets = candidates(state, actor, true);
  if (policy) {
    const direction = policy.difficulty === 'strong' ? -1 : 1;
    // Stable sort retains the Legacy distance and roster order on equal threat.
    targets.sort((a, b) => direction * (threat(a) - threat(b)));
  }
  if (trace) trace.criteria = policy ? [policy.difficulty === 'strong' ? 'negative-threat' : 'threat',
    'distance', 'roster-order'] : ['distance', 'roster-order'];
  for (const target of targets) {
    const candidate = trace && {targetId: target.id, priority: trace.candidates.length,
      rank: [...(policy ? [threat(target) * (policy.difficulty === 'strong' ? -1 : 1)] : []),
        hexDistance(actor, target), state.units.indexOf(target)]};
    if (trace) trace.candidates.push(candidate);
    const geometry = queryIronDustFireGeometry(state, actor.id, target.id, actor.range,
      {outOfRange: 'OUT_OF_RANGE', sightBlocked: 'SIGHT_BLOCKED'});
    if (!geometry.available) {
      if (trace) Object.assign(candidate, {status: 'rejected', reason: geometry.error.code});
      continue;
    }
    const systemChecks = candidate && target.id === 'ogre' ? [] : undefined;
    if (systemChecks) candidate.systemChecks = systemChecks;
    const command = target.id === 'ogre'
      ? {type: 'EnemySystemAttack', playerId: 'enemy', attackerId: actor.id,
        targetId: 'ogre', targetKey: systemTarget(target.ogreSystems,
          state.targetPolicyVersion === IRON_DUST_ZERO_TREADS_POLICY_VERSION, systemChecks)}
      : {type: 'EnemyUnitAttack', playerId: 'enemy', attackerId: actor.id,
        targetId: target.id};
    const query = queryIronDustStandardFireAction(state, command);
    if (trace) candidate.command = command.targetKey === undefined && command.type === 'EnemySystemAttack'
      ? {...command, targetKey: null} : command;
    if (!query.available) {
      if (trace) Object.assign(candidate, {status: 'rejected', reason: query.error.code});
      continue;
    }
    if (trace) Object.assign(candidate, {status: 'selected', reason: 'first-legal-fire-target'});
    return {kind: 'fire', actorId: actor.id, targetId: target.id,
      ...(target.id === 'ogre' ? {targetKey: command.targetKey} : {}), command};
  }
  return null;
}

// Keep the historical FIFO queue, neighbor order, cheaper-cost revisit and
// strict distance improvement. The shared Core pathfinder has different ties.
function preferredStep(state, actor, target, policy, trace) {
  const occupied = new Set(state.units.filter(unit => unit.hp > 0 && unit !== actor).map(key));
  const queue = [{x: actor.x, y: actor.y, cost: 0, path: []}];
  const seen = new Map([[key(actor), 0]]);
  let best = null;
  const targets = policy?.difficulty === 'strong' ? candidates(state, actor, true) : [];
  const rank = (node, distance) => {
    if (policy?.difficulty === 'weak') return [node.cost, distance];
    if (!policy) return [distance, node.cost];
    const firingLane = targets.some(foe => hexDistance(node, foe) <= actor.range &&
      hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, node, foe));
    const cover = TerrainRules.coverBonus(terrainAt(state, node));
    return [firingLane ? 0 : 1, -cover, distance, node.cost];
  };
  let bestRank;
  let bestCandidate;
  const original = hexDistance(actor, target);
  if (trace) trace.criteria = policy?.difficulty === 'weak' ? ['movement-cost', 'distance'] :
    policy ? ['no-firing-lane', 'negative-cover', 'distance', 'movement-cost'] : ['distance', 'movement-cost'];
  while (queue.length) {
    const node = queue.shift();
    const distance = hexDistance(node, target);
    const candidate = trace && node.path.length ? {to: {x: node.x, y: node.y},
      path: node.path, targetId: target.id, cost: node.cost, distance} : null;
    if (candidate) trace.candidates.push(candidate);
    if (node.path.length && distance < original) {
      const score = rank(node, distance);
      if (candidate) Object.assign(candidate, {rank: score, status: 'eligible'});
      const difference = bestRank ? score.findIndex((value, i) => value !== bestRank[i]) : -1;
      if (!bestRank || difference >= 0 && score[difference] < bestRank[difference]) {
        best = node;
        bestRank = score;
        bestCandidate = candidate;
      }
    } else if (candidate) {
      Object.assign(candidate, {status: 'rejected', reason: 'no-distance-improvement'});
    }
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
  if (bestCandidate) {
    Object.assign(bestCandidate, {status: 'selected', reason: 'best-move-rank'});
    for (const candidate of trace.candidates) {
      if (candidate.status !== 'eligible') continue;
      const difference = candidate.rank.findIndex((value, i) => value !== bestRank[i]);
      candidate.status = 'rejected';
      candidate.reason = difference < 0 ? 'earlier-search-order' : `worse-${trace.criteria[difference]}`;
    }
  }
  return best;
}

export function queryIronDustEnemyIntent(state, request, policy = null, decisionTrace) {
  validateIronDustUnifiedStateProbe(state);
  if (!validIronDustEnemyPolicy(policy)) return deny('IRON_DUST_DIFFICULTY_INVALID');
  const resolverVersion = state.targetPolicyVersion === IRON_DUST_ZERO_TREADS_POLICY_VERSION
    ? IRON_DUST_ZERO_TREADS_ENEMY_INTENT_VERSION : IRON_DUST_ENEMY_INTENT_VERSION;
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
    return {available: true, resolverVersion,
      kind: 'pass', actorId: actor.id, reason: 'DISABLED',
      command: {type: 'EnemyPass', playerId: 'enemy', actorId: actor.id}};
  }
  if (request.stage === 'retry-fire' ? !actor.moved : actor.moved)
    return deny('STALE_STAGE');
  const startTrace = stage => {
    if (!decisionTrace) return undefined;
    const trace = {stage, criteria: [], candidates: []};
    decisionTrace.push(trace);
    return trace;
  };
  let intent;
  if (request.stage === 'move') {
    if (firstFire(state, actor, policy, startTrace('move-fire-gate'))) return deny('FIRE_AVAILABLE');
    const targets = candidates(state, actor, false);
    const [target] = targets;
    const targetTrace = startTrace('move-target');
    if (targetTrace) {
      targetTrace.criteria = ['distance', 'roster-order'];
      targetTrace.candidates = targets.map((unit, index) => ({targetId: unit.id,
        rank: [hexDistance(actor, unit), state.units.indexOf(unit)], status: index ? 'rejected' : 'selected',
        reason: !index ? 'nearest-target' : hexDistance(actor, unit) > hexDistance(actor, target)
          ? 'greater-distance' : 'later-roster-order'}));
    }
    const step = target && preferredStep(state, actor, target, policy, startTrace('move-destination'));
    intent = step ? {kind: 'move', actorId: actor.id, targetId: target.id,
      to: {x: step.x, y: step.y}, cost: step.cost,
      path: step.path.map(point => ({x: point.x, y: point.y}))} : null;
  } else intent = firstFire(state, actor, policy, startTrace(request.stage));
  if (!intent && request.stage === 'first-fire')
    intent = {kind: 'continue', actorId: actor.id, nextStage: 'move'};
  if (!intent) intent = {kind: 'pass', actorId: actor.id,
    reason: request.stage === 'move' ? 'HOLD' : 'NO_TARGET',
    command: {type: 'EnemyPass', playerId: 'enemy', actorId: actor.id}};
  if (request.claim === 'pass' && intent.kind !== 'pass') return deny('PASS_FORBIDDEN');
  return {available: true, resolverVersion, ...intent};
}
