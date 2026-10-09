import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustUnifiedStateProbe, queryIronDustUnifiedUnit,
  validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {createIronDustEnemySystemFireProbe, queryIronDustEnemySystemFireProbe,
  dispatchIronDustEnemySystemFireProbe} from '../src/core/iron-dust-enemy-system-fire-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';
import {queryIronDustB3aAction, preflightIronDustB3aAction,
  dispatchIronDustB3aAction} from '../src/core/iron-dust-b3a-action-probe.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const unit = (state, id) => state.units.find(value => value.id === id);
const end = playerId => ({type: 'EndPhase', playerId});
const pass = actorId => ({type: 'EnemyPass', playerId: 'enemy', actorId});
const fire = () => ({type: 'PlayerFire', playerId: 'player', unitId: 'ogre',
  targetId: 'guard', weaponKey: 'main'});
const attack = (targetKey = 'missiles', attackerId = 'guard') =>
  ({type: 'EnemySystemAttack', playerId: 'enemy', attackerId,
    targetId: 'ogre', targetKey});
const apply = (state, command) => {
  const result = dispatchIronDustB3aAction(state, command);
  assert.ok(result.state, JSON.stringify(result.error));
  return result.state;
};
const inEnemy = (seed, fixture = 'adjacent') => {
  let state = createIronDustUnifiedStateProbe(seed, {fixture});
  for (let i = 0; i < 3; i++) state = apply(state, end('player'));
  return state;
};

test('B3a stays technical and fixed enemy system NE, D, X vectors match Legacy', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  for (const seed of [0, 3, 2]) {
    const state = inEnemy(seed), original = JSON.stringify(state);
    const oracle = createIronDustEnemySystemFireProbe(seed);
    assert.deepEqual(queryIronDustB3aAction(state, attack()),
      queryIronDustEnemySystemFireProbe(oracle, attack()));
    assert.deepEqual(preflightIronDustB3aAction(state, attack()),
      queryIronDustB3aAction(state, attack()));
    const current = dispatchIronDustB3aAction(state, attack());
    const old = dispatchIronDustEnemySystemFireProbe(oracle, attack());
    assert.deepEqual(current.events, old.events);
    assert.equal(current.state.rng.state, old.state.systemState.rng.state);
    assert.equal(unit(current.state, 'ogre').ogreSystems.weapons.missiles.destroyed,
      old.state.systemState.unit.ogreSystems.weapons.missiles.destroyed);
    assert.deepEqual(current.state.firedActorIds, ['guard']);
    assert.equal(JSON.stringify(state), original);
    assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(plain(current.state)));
  }
  const state = inEnemy(5);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('real Fire then enemy system attack and pass returns to a reset new turn with one hit RNG', () => {
  let state = createIronDustUnifiedStateProbe(0, {fixture: 'adjacent'});
  state = apply(state, end('player'));
  const shot = dispatchIronDustB3aAction(state, fire());
  assert.equal(shot.events[0].result, 'NE');
  state = shot.state;
  state = apply(state, end('player'));
  state = apply(state, end('player'));
  const afterFireRng = state.rng.state;
  const oracle = createIronDustEnemySystemFireProbe(afterFireRng);
  const incoming = dispatchIronDustB3aAction(state, attack());
  assert.deepEqual(incoming.events,
    dispatchIronDustEnemySystemFireProbe(oracle, attack()).events);
  assert.notEqual(incoming.state.rng.state, afterFireRng);
  state = incoming.state;
  assert.deepEqual(queryIronDustB3aAction(state, end('enemy')),
    {available: false, error: {code: 'ENEMY_COMMANDS_PENDING'}});
  const passed = dispatchIronDustB3aAction(state, pass('raider'));
  assert.deepEqual(passed.events[0].pendingActorIds, []);
  state = passed.state;
  const beforeTurnRng = state.rng.state;
  const turn = dispatchIronDustB3aAction(state, end('enemy'));
  assert.deepEqual(turn.events, [{type: 'PhaseChanged', from: 'enemy',
    to: 'movement', side: 'player', turn: 2}]);
  assert.equal(turn.state.turn, 2);
  assert.equal(turn.state.rng.state, beforeTurnRng);
  assert.deepEqual(turn.state.firedActorIds, []);
  assert.deepEqual(turn.state.enemyPassed, []);
  assert.equal(unit(turn.state, 'ogre').ogreSystems.weapons.main.firedThisPhase, 0);
  assert.equal(unit(turn.state, 'ogre').fired, false);
});

test('Fire-killed guard cannot pass or attack; only live raider is required', () => {
  let state = createIronDustUnifiedStateProbe(2, {fixture: 'adjacent'});
  state = apply(state, end('player'));
  state = apply(state, fire());
  assert.equal(unit(state, 'guard').hp, 0);
  state = apply(state, end('player'));
  state = apply(state, end('player'));
  for (const command of [pass('guard'), attack()]) {
    const before = JSON.stringify(state);
    assert.deepEqual(queryIronDustB3aAction(state, command),
      {available: false, error: {code: 'ENEMY_ACTOR_DESTROYED'}});
    assert.deepEqual(dispatchIronDustB3aAction(state, command),
      {error: {code: 'ENEMY_ACTOR_DESTROYED'}});
    assert.equal(JSON.stringify(state), before);
  }
  assert.deepEqual(queryIronDustB3aAction(state, end('enemy')),
    {available: false, error: {code: 'ENEMY_COMMANDS_PENDING'}});
  const passed = dispatchIronDustB3aAction(state, pass('raider'));
  assert.deepEqual(passed.events[0].pendingActorIds, []);
  const after = dispatchIronDustB3aAction(passed.state, end('enemy'));
  assert.equal(after.state.turn, 2);
  assert.equal(after.state.rng.state, state.rng.state);
});

test('tread attack changes derived movement and turn reset preserves damage', () => {
  const state = inEnemy(1);
  const oracle = createIronDustEnemySystemFireProbe(1);
  const command = attack('treads');
  assert.deepEqual(queryIronDustB3aAction(state, command),
    queryIronDustEnemySystemFireProbe(oracle, command));
  const hit = dispatchIronDustB3aAction(state, command);
  assert.deepEqual(hit.events, dispatchIronDustEnemySystemFireProbe(oracle, command).events);
  assert.equal(unit(hit.state, 'ogre').ogreSystems.treads, 45);
  assert.equal(queryIronDustUnifiedUnit(hit.state, 'ogre').movement, 3);
  let next = apply(hit.state, pass('raider'));
  next = apply(next, end('enemy'));
  assert.equal(unit(next, 'ogre').ogreSystems.treads, 45);
  assert.equal(queryIronDustUnifiedUnit(next, 'ogre').movement, 3);
});

test('a disabled guard destroyed by a real second D does not recover when enemy phase starts', () => {
  let state = createIronDustUnifiedStateProbe(10, {fixture: 'adjacent'});
  state = apply(state, end('player'));
  state = apply(state, fire());
  assert.equal(unit(state, 'guard').disabled, true);
  state = apply(state, {...fire(), weaponKey: 'secondary'});
  assert.equal(unit(state, 'guard').hp, 0);
  state = apply(state, end('player'));
  state = apply(state, end('player'));
  assert.equal(unit(state, 'guard').disabled, true);
  assert.equal(unit(state, 'guard').disabledUntil, 2);
  assert.deepEqual(queryIronDustB3aAction(state, pass('guard')),
    {available: false, error: {code: 'ENEMY_ACTOR_DESTROYED'}});
});

test('enemy turn reset recovers eligible living player units without consuming RNG', () => {
  let state = plain(inEnemy(5));
  unit(state, 'gev').disabled = true;
  unit(state, 'gev').disabledUntil = 2;
  state = apply(state, pass('guard'));
  state = apply(state, pass('raider'));
  const result = dispatchIronDustB3aAction(state, end('enemy'));
  assert.deepEqual(result.events, [
    {type: 'UnitRecovered', unitId: 'gev', side: 'player', turn: 2},
    {type: 'PhaseChanged', from: 'enemy', to: 'movement', side: 'player', turn: 2}
  ]);
  assert.equal(unit(result.state, 'gev').disabled, false);
  assert.equal(result.state.rng.state, state.rng.state);
});

test('dynamic system targets and rejected directions never mutate state, RNG or events', () => {
  const enemy = inEnemy(5), source = inEnemy(5, 'source');
  const fired = apply(enemy, attack());
  const passed = apply(enemy, pass('guard'));
  for (const [state, command, code] of [
    [enemy, attack('unknown'), 'SYSTEM_TARGET_INVALID'],
    [enemy, attack('missiles', 'core'), 'ENEMY_ACTOR_FORBIDDEN'],
    [enemy, attack('missiles', 'ghost'), 'ENEMY_ACTOR_INVALID'],
    [enemy, {...attack(), targetId: 'gev'}, 'SYSTEM_TARGET_INVALID'],
    [enemy, {...attack(), playerId: 'player'}, 'NOT_ACTIVE_TEAM'],
    [source, attack(), 'SYSTEM_OUT_OF_RANGE'],
    [enemy, pass('core'), 'ENEMY_ACTOR_FORBIDDEN'],
    [fired, attack(), 'ACTION_SPENT'],
    [fired, pass('guard'), 'ACTION_SPENT'],
    [passed, attack(), 'ACTION_SPENT'],
    [enemy, {type: 'EnemyMove', playerId: 'enemy', actorId: 'guard',
      to: {x: 2, y: 4}}, 'B1_COMMAND_UNSUPPORTED']
  ]) {
    const before = JSON.stringify(state), rng = state.rng.state;
    assert.deepEqual(queryIronDustB3aAction(state, command),
      {available: false, error: {code}});
    assert.deepEqual(preflightIronDustB3aAction(state, command),
      queryIronDustB3aAction(state, command));
    assert.deepEqual(dispatchIronDustB3aAction(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, rng);
  }
});
