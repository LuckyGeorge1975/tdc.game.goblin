import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createGame} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';
import {createIronDustUnifiedStateProbe, validateIronDustUnifiedStateProbe,
  IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION,
  IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION,
  IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION} from
  '../src/core/iron-dust-unified-state-probe.mjs';
import {queryIronDustB3bAction} from '../src/core/iron-dust-b3b-action-probe.mjs';
import {queryIronDustStandardFireAction, preflightIronDustStandardFireAction,
  dispatchIronDustStandardFireAction} from
  '../src/core/iron-dust-standard-fire-action-probe.mjs';

const unit = (state, id) => state.units.find(item => item.id === id);
const end = playerId => ({type: 'EndPhase', playerId});
const playerFire = (unitId, targetId = 'guard') =>
  ({type: 'PlayerFire', playerId: 'player', unitId, targetId});
const enemyFire = targetId => ({type: 'EnemyUnitAttack', playerId: 'enemy',
  attackerId: 'guard', targetId});
const pass = actorId => ({type: 'EnemyPass', playerId: 'enemy', actorId});
const apply = (state, command) => {
  const resolved = dispatchIronDustStandardFireAction(state, command);
  assert.ok(resolved.state, JSON.stringify(resolved.error));
  return resolved.state;
};
const inPhase = (seed, fixture, phase) => {
  let state = createIronDustUnifiedStateProbe(seed, {fixture});
  for (let i = 0; i < (phase === 'fire' ? 1 : 3); i++)
    state = apply(state, end('player'));
  return state;
};
const unchangedReject = (state, command, code) => {
  const before = JSON.stringify(state);
  const query = queryIronDustStandardFireAction(state, command);
  assert.deepEqual(query, {available: false, error: {code}});
  assert.deepEqual(preflightIronDustStandardFireAction(state, command), query);
  assert.deepEqual(dispatchIronDustStandardFireAction(state, command),
    {error: {code}});
  assert.equal(JSON.stringify(state), before);
};

test('GEV, artillery and corrected odd-row infantry fire each spend one action and one RNG roll', () => {
  const cases = [
    {id: 'gev', fixture: 'adjacent', ratio: '1-2', range: 3},
    {id: 'missile', fixture: 'adjacent', ratio: '1-1', range: 4},
    {id: 'infantry', fixture: IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION,
      ratio: '1-2', range: 1}
  ];
  for (const {id, fixture, ratio, range} of cases) {
    const state = inPhase(2, fixture, 'fire');
    const command = playerFire(id), original = JSON.stringify(state);
    const query = queryIronDustStandardFireAction(state, command);
    assert.equal(query.available, true);
    assert.equal(query.distance, 1);
    assert.equal(query.range, range);
    assert.equal(query.losMode, 'legacy-pixel-sample-8-v1');
    assert.deepEqual(preflightIronDustStandardFireAction(state, command), query);
    const resolved = dispatchIronDustStandardFireAction(state, command);
    assert.deepEqual([resolved.events[0].ratio, resolved.events[0].roll,
      resolved.events[0].result, resolved.events[0].hp], [ratio, 5, 'X', 0]);
    assert.equal(resolved.state.rng.state,
      (Math.imul(1664525, 2) + 1013904223) >>> 0);
    assert.equal(unit(resolved.state, id).fired, true);
    assert.deepEqual(resolved.state.victory, {status: 'ongoing', winner: null});
    assert.equal(JSON.stringify(state), original);
    assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(resolved.state));
    unchangedReject(resolved.state, command, 'ACTION_SPENT');
  }
  const falseNeighbor = inPhase(2, 'adjacent', 'fire');
  assert.equal(queryIronDustStandardFireAction(falseNeighbor,
    playerFire('infantry')).error.code, 'STANDARD_FIRE_OUT_OF_RANGE');
});

test('explicit guard fire covers rubble, open artillery and infantry without target AI', () => {
  const cases = [
    {id: 'gev', fixture: 'adjacent', defense: 4, ratio: '1-2'},
    {id: 'missile', fixture: 'adjacent', defense: 3, ratio: '1-2'},
    {id: 'infantry', fixture: IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION,
      defense: 2, ratio: '1-1'}
  ];
  for (const {id, fixture, defense, ratio} of cases) {
    const state = inPhase(2, fixture, 'enemy');
    const command = enemyFire(id), original = JSON.stringify(state);
    const query = queryIronDustStandardFireAction(state, command);
    assert.equal(query.available, true);
    assert.equal(query.distance, 1);
    assert.equal(query.effectiveDefense, defense);
    assert.deepEqual(preflightIronDustStandardFireAction(state, command), query);
    const resolved = dispatchIronDustStandardFireAction(state, command);
    assert.deepEqual([resolved.events[0].ratio, resolved.events[0].roll,
      resolved.events[0].result, resolved.events[0].hp], [ratio, 5, 'X', 0]);
    assert.deepEqual(resolved.state.firedActorIds, ['guard']);
    assert.equal(resolved.state.rng.state,
      (Math.imul(1664525, 2) + 1013904223) >>> 0);
    assert.deepEqual(resolved.state.victory, {status: 'ongoing', winner: null});
    assert.equal(JSON.stringify(state), original);
    unchangedReject(resolved.state, command, 'ACTION_SPENT');
    unchangedReject(resolved.state, pass('guard'), 'ACTION_SPENT');
    let next = apply(resolved.state, pass('raider'));
    next = apply(next, end('enemy'));
    assert.equal(next.turn, 2);
    assert.deepEqual(next.firedActorIds, []);
  }
});

test('NE still spends fire budget; D applies side-specific disability and infantry HP', () => {
  const miss = dispatchIronDustStandardFireAction(inPhase(1, 'adjacent', 'fire'),
    playerFire('gev'));
  assert.deepEqual([miss.events[0].roll, miss.events[0].result], [0, 'NE']);
  assert.equal(unit(miss.state, 'guard').hp, 3);
  assert.equal(unit(miss.state, 'gev').fired, true);
  const playerD = dispatchIronDustStandardFireAction(inPhase(3, 'adjacent', 'fire'),
    playerFire('gev'));
  assert.equal(playerD.events[0].result, 'D');
  assert.equal(unit(playerD.state, 'guard').disabledUntil, 2);
  const enemyD = dispatchIronDustStandardFireAction(inPhase(3, 'adjacent', 'enemy'),
    enemyFire('gev'));
  assert.equal(enemyD.events[0].result, 'D');
  assert.equal(unit(enemyD.state, 'gev').disabledUntil, 3);
  let afterD = apply(enemyD.state, pass('raider'));
  afterD = apply(afterD, end('enemy'));
  afterD = apply(afterD, end('player'));
  unchangedReject(afterD, playerFire('gev'), 'STANDARD_FIRE_ACTOR_UNAVAILABLE');
  afterD = apply(afterD, end('player'));
  afterD = apply(afterD, end('player'));
  afterD = apply(afterD, pass('guard'));
  afterD = apply(afterD, pass('raider'));
  afterD = apply(afterD, end('enemy'));
  assert.equal(unit(afterD, 'gev').disabled, false);
  assert.equal(unit(afterD, 'gev').disabledUntil, 0);
  const infantryD = dispatchIronDustStandardFireAction(
    inPhase(3, IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION, 'enemy'),
    enemyFire('infantry'));
  assert.equal(infantryD.events[0].result, 'D');
  assert.equal(unit(infantryD.state, 'infantry').hp, 1);
  assert.equal(unit(infantryD.state, 'infantry').disabled, false);
});

test('raider uses the same explicit standard fire contract and enemy budget', () => {
  const state = inPhase(2, IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION, 'enemy');
  const command = {...enemyFire('missile'), attackerId: 'raider'};
  const query = queryIronDustStandardFireAction(state, command);
  assert.equal(query.available, true);
  assert.equal(query.distance, 2);
  const resolved = dispatchIronDustStandardFireAction(state, command);
  assert.deepEqual([resolved.events[0].ratio, resolved.events[0].roll,
    resolved.events[0].result], ['1-2', 5, 'X']);
  assert.deepEqual(resolved.state.firedActorIds, ['raider']);
  unchangedReject(resolved.state, command, 'ACTION_SPENT');
  unchangedReject(resolved.state, pass('raider'), 'ACTION_SPENT');
});

test('all three players can hit the covered core and technical victory remains gated', () => {
  const sourceBefore = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  for (const id of ['gev', 'missile', 'infantry']) {
    const state = inPhase(2, IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION, 'fire');
    const query = queryIronDustStandardFireAction(state, playerFire(id, 'core'));
    assert.equal(query.available, true);
    assert.equal(query.effectiveDefense, 6);
    assert.equal(query.distance, 1);
    const result = dispatchIronDustStandardFireAction(state, playerFire(id, 'core'));
    assert.equal(result.events[0].result, 'X');
    assert.deepEqual(result.state.victory, {status: 'ended', winner: 'player'});
    assert.equal(unit(result.state, 'core').hp, 0);
    unchangedReject(result.state, playerFire(id, 'core'), 'GAME_ENDED');
    assert.equal(result.state.executable, false);
    assert.throws(() => createGame(result.state, 2), {code: 'UNSUPPORTED_RULE_PROFILE'});
    assert.throws(() => recordProfileReplay(result.state, 2, []),
      {code: 'REPLAY_PROFILE_MISMATCH'});
  }
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), sourceBefore);
});

test('range, historical pixel sight, phase, team and exact command schema fail closed', () => {
  const fire = inPhase(2, 'adjacent', 'fire');
  unchangedReject(fire, playerFire('infantry'), 'STANDARD_FIRE_OUT_OF_RANGE');
  unchangedReject(fire, {...playerFire('gev'), weaponKey: 'main'},
    'STANDARD_FIRE_COMMAND_INVALID');
  unchangedReject(fire, playerFire('gev', 'infantry'), 'STANDARD_FIRE_TARGET_INVALID');
  unchangedReject(fire, {...playerFire('gev'), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM');
  unchangedReject(createIronDustUnifiedStateProbe(2, {fixture: 'adjacent'}),
    playerFire('gev'), 'WRONG_PHASE');
  const blocked = inPhase(2, IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION, 'fire');
  unchangedReject(blocked, playerFire('gev'), 'STANDARD_FIRE_SIGHT_BLOCKED');
  const enemy = inPhase(2, 'adjacent', 'enemy');
  unchangedReject(enemy, {...enemyFire('gev'), attackerId: 'core'},
    'STANDARD_FIRE_ACTOR_INVALID');
  unchangedReject(enemy, enemyFire('ogre'), 'STANDARD_FIRE_TARGET_INVALID');
  unchangedReject(enemy, {...enemyFire('gev'), targetKey: 'main'},
    'STANDARD_FIRE_COMMAND_INVALID');
  unchangedReject(enemy, {...enemyFire('gev'), playerId: 'player'}, 'NOT_ACTIVE_TEAM');
  unchangedReject(fire, enemyFire('gev'), 'NOT_ACTIVE_TEAM');
  const sourceEnemy = inPhase(2, 'source', 'enemy');
  unchangedReject(sourceEnemy, enemyFire('gev'), 'STANDARD_FIRE_OUT_OF_RANGE');
  const killedGuard = apply(fire, playerFire('gev'));
  const afterKill = apply(apply(killedGuard, end('player')), end('player'));
  unchangedReject(afterKill, enemyFire('gev'), 'STANDARD_FIRE_ACTOR_UNAVAILABLE');
});

test('existing Ogre fire, enemy systems and source Move delegate on one state', () => {
  const moved = apply(createIronDustUnifiedStateProbe(2),
    {type: 'Move', playerId: 'player', unitId: 'missile', to: {x: 4, y: 6}});
  assert.equal(unit(moved, 'missile').moved, true);
  let state = inPhase(1, 'adjacent', 'fire');
  const ogre = {type: 'PlayerFire', playerId: 'player', unitId: 'ogre',
    targetId: 'guard', weaponKey: 'main'};
  assert.deepEqual(queryIronDustStandardFireAction(state, ogre),
    queryIronDustB3bAction(state, ogre));
  state = apply(state, ogre);
  state = apply(state, end('player'));
  state = apply(state, end('player'));
  const system = {type: 'EnemySystemAttack', playerId: 'enemy',
    attackerId: 'guard', targetId: 'ogre', targetKey: 'missiles'};
  assert.equal(queryIronDustStandardFireAction(state, system).available, true);
  assert.equal(dispatchIronDustStandardFireAction(state, system).events[0].type,
    'EnemySystemFireResolved');
});
