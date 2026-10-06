import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustUnifiedStateProbe, validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {createIronDustRamProbe, queryIronDustRamProbe} from '../src/core/iron-dust-ram-probe.mjs';
import {createIronDustEnemyPhaseProbe, dispatchIronDustEnemyPhaseProbe} from '../src/core/iron-dust-enemy-phase-probe.mjs';
import {makeIronDustGevProbeScenario} from '../src/core/iron-dust-gev-probe.mjs';
import {movementPaths} from '../src/core/hex.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {queryIronDustB1Action, preflightIronDustB1Action,
  dispatchIronDustB1Action} from '../src/core/iron-dust-b1-action-probe.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const end = playerId => ({type: 'EndPhase', playerId});
const pass = actorId => ({type: 'EnemyPass', playerId: 'enemy', actorId});
const move = to => ({type: 'Move', playerId: 'player', unitId: 'gev', to});
const ram = targetId => ({type: 'Ram', playerId: 'player', unitId: 'ogre', targetId});
const unit = (state, id) => state.units.find(value => value.id === id);

test('B1 is inactive, exact and cannot enter Core or replay', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustUnifiedStateProbe(5, {fixture: 'adjacent'});
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('explicit GEV Move then Ogre Ram shares one roster and matches checked Legacy probes', () => {
  const start = createIronDustUnifiedStateProbe(5, {fixture: 'adjacent'});
  const sourceBefore = JSON.stringify(start);
  const destination = {x: 2, y: 7};
  const oldGev = createGame(makeIronDustGevProbeScenario(), 5);
  const oldPath = movementPaths(oldGev, unit(oldGev, 'gev'), 3).get('2,7').path;
  const moveQuery = queryIronDustB1Action(start, move(destination));
  assert.deepEqual(moveQuery, {available: true, path: oldPath});
  const moved = dispatchIronDustB1Action(start, move(destination));
  assert.deepEqual(moved.events, [{type: 'UnitMoved', unitId: 'gev',
    from: {x: 2, y: 6}, to: destination, path: oldPath, phase: 'movement'}]);
  assert.equal(unit(moved.state, 'gev').moved, true);
  const oldRam = queryIronDustRamProbe(createIronDustRamProbe(5, {fixture: 'near-guard'}), 'guard');
  const ramQuery = queryIronDustB1Action(moved.state, ram('guard'));
  assert.deepEqual(ramQuery, oldRam);
  const resolved = dispatchIronDustB1Action(moved.state, ram('guard'));
  assert.deepEqual(resolved.events, [{type: 'RamResolved', actorId: 'ogre',
    targetId: 'guard', from: {x: 1, y: 5}, to: {x: 2, y: 5},
    path: oldRam.path, targetHp: 0, actorHp: 5}]);
  assert.equal(unit(resolved.state, 'ogre').moved, true);
  assert.equal(unit(resolved.state, 'guard').hp, 0);
  assert.deepEqual(resolved.state.victory, {status: 'ongoing', winner: null});
  assert.equal(resolved.state.rng.state, 5);
  assert.equal(JSON.stringify(start), sourceBefore);
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(plain(resolved.state)));
});

test('no-action phase cycle, GEV second move, resets and recovery match Legacy phase probe', () => {
  let state = createIronDustUnifiedStateProbe(5, {fixture: 'source'});
  const legacyStart = createIronDustEnemyPhaseProbe(5);
  let legacy = legacyStart;
  const first = dispatchIronDustB1Action(state, move({x: 2, y: 7}));
  state = first.state;
  const commands = [end('player'), end('player'), move({x: 4, y: 7}),
    end('player'), pass('guard'), pass('raider'), end('enemy')];
  const phaseCommands = [end('player'), end('player'), end('player'),
    pass('guard'), pass('raider'), end('enemy')];
  const phaseEvents = [];
  for (const command of commands) {
    const result = dispatchIronDustB1Action(state, command);
    assert.ok(result.state, JSON.stringify(result.error));
    if (command.type !== 'Move') phaseEvents.push(result.events.at(-1));
    state = result.state;
  }
  for (const command of phaseCommands)
    legacy = dispatchIronDustEnemyPhaseProbe(legacy, command).state;
  assert.equal(state.phase, legacy.phase);
  assert.equal(state.activeTeam, legacy.side);
  assert.equal(state.turn, legacy.turn);
  assert.equal(state.rng.state, legacy.rng.state);
  assert.equal(unit(state, 'gev').moved, false);
  assert.equal(unit(state, 'gev').secondMoved, false);
  assert.deepEqual(state.enemyPassed, []);
  assert.equal(phaseEvents.length, 6);
  assert.deepEqual(phaseEvents.at(-1),
    {type: 'PhaseChanged', from: 'enemy', to: 'movement', side: 'player', turn: 2});

  const recovery = plain(createIronDustUnifiedStateProbe(5));
  recovery.phase = 'gev';
  unit(recovery, 'guard').disabled = true;
  unit(recovery, 'guard').disabledUntil = 1;
  unit(recovery, 'gev').disabled = true;
  unit(recovery, 'gev').disabledUntil = 2;
  const enemy = dispatchIronDustB1Action(recovery, end('player'));
  assert.deepEqual(enemy.events[0],
    {type: 'UnitRecovered', unitId: 'guard', side: 'enemy', turn: 1});
  let next = enemy.state;
  next = dispatchIronDustB1Action(next, pass('guard')).state;
  next = dispatchIronDustB1Action(next, pass('raider')).state;
  const player = dispatchIronDustB1Action(next, end('enemy'));
  assert.deepEqual(player.events[0],
    {type: 'UnitRecovered', unitId: 'gev', side: 'player', turn: 2});
  assert.equal(unit(player.state, 'gev').disabled, false);
  assert.equal(player.state.rng.state, 5);
});

test('Query, preflight and dispatch reject the same unsupported or spent actions without mutation', () => {
  const base = createIronDustUnifiedStateProbe(5, {fixture: 'adjacent'});
  const boundary = createIronDustUnifiedStateProbe(5, {fixture: 'boundary'});
  const spentMove = dispatchIronDustB1Action(base, move({x: 2, y: 7})).state;
  const spentRam = dispatchIronDustB1Action(base, ram('guard')).state;
  let enemy = base;
  for (let index = 0; index < 3; index++) enemy = dispatchIronDustB1Action(enemy, end('player')).state;
  const passed = dispatchIronDustB1Action(enemy, pass('guard')).state;
  for (const [state, command, code] of [
    [base, {type: 'Fire', playerId: 'player', unitId: 'ogre', targetId: 'guard'}, 'B1_COMMAND_UNSUPPORTED'],
    [base, {type: 'Move', playerId: 'player', unitId: 'ogre', to: {x: 1, y: 4}}, 'B1_UNIT_UNSUPPORTED'],
    [base, {type: 'Move', playerId: 'player', unitId: 'infantry', to: {x: 2, y: 5}}, 'B1_UNIT_UNSUPPORTED'],
    [base, {type: 'EnemySystemAttack', playerId: 'enemy', attackerId: 'guard', targetId: 'ogre', targetKey: 'main'}, 'B1_COMMAND_UNSUPPORTED'],
    [boundary, end('player'), 'B1_FIXTURE_UNSUPPORTED'],
    [base, move({x: 12, y: 6}), 'OUT_OF_BOUNDS'],
    [base, move({x: 5, y: 7}), 'UNREACHABLE'],
    [base, ram('core'), 'RAM_CORE_FORBIDDEN'],
    [spentMove, move({x: 1, y: 5}), 'ACTION_SPENT'],
    [spentRam, ram('raider'), 'RAM_ACTION_SPENT'],
    [enemy, end('enemy'), 'ENEMY_COMMANDS_PENDING'],
    [enemy, pass('core'), 'ENEMY_ACTOR_FORBIDDEN'],
    [enemy, {type: 'Move', playerId: 'enemy', unitId: 'guard', to: {x: 7, y: 3}}, 'B1_UNIT_UNSUPPORTED'],
    [passed, pass('guard'), 'ACTION_SPENT']
  ]) {
    const before = JSON.stringify(state);
    assert.deepEqual(queryIronDustB1Action(state, command),
      {available: false, error: {code}});
    assert.deepEqual(preflightIronDustB1Action(state, command),
      queryIronDustB1Action(state, command));
    assert.deepEqual(dispatchIronDustB1Action(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
});
