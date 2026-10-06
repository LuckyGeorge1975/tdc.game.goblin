import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {makeIronDustGevProbeScenario} from '../src/core/iron-dust-gev-probe.mjs';
import {CORE_IRON_DUST_GEV_PROBE_CONTRACT} from '../src/core/profile-contract.mjs';
import {createGame, dispatch, queryActions, queryAreas, queryCommand,
  replayPhase, replayReference, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {movementPaths} from '../src/core/hex.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';
import TerrainRules from '../terrain-rules.js';
import {UNIT_RULES, movementCostForMode} from '../rules.mjs';

const end = playerId => ({type: 'EndPhase', playerId});
const move = to => ({type: 'Move', playerId: 'player', unitId: 'gev', to});
const fire = {type: 'Fire', playerId: 'player', unitId: 'gev', targetId: 'core'};
const unit = state => state.units.find(candidate => candidate.id === 'gev');
const plain = value => JSON.parse(JSON.stringify(value));

test('v5 movement-only probe derives one GEV capability from exact Iron Dust v1 data', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const scenario = makeIronDustGevProbeScenario();
  assert.deepEqual(scenario.map, IRON_DUST_CORE_DATA_V1.map);
  assert.deepEqual(scenario.units, IRON_DUST_CORE_DATA_V1.units.filter(u => ['gev', 'core'].includes(u.id)));
  assert.equal(scenario.units[0].movementMode, undefined);
  assert.equal(scenario.ruleProfileId, 'CORE_IRON_DUST_GEV_PROBE_v1');
  assert.equal(IRON_DUST_CORE_DATA_V1.ruleProfileId, 'FIELD_TEST_LEGACY_v1');
  const state = createGame(scenario, 5);
  assert.equal(state.rulesVersion, CORE_IRON_DUST_GEV_PROBE_CONTRACT.rulesVersion);
  assert.equal(unit(state).movementMode, 'gev');
  assert.equal(state.units.length, 2);
  assert.equal(Object.isFrozen(state.effectiveRules), true);
  assert.equal(Object.isFrozen(state.effectiveRules.movement), true);
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
  assert.equal(scenario.units[0].movementMode, undefined);
  assert.throws(() => recordProfileReplay(scenario, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.throws(() => createGame(IRON_DUST_CORE_DATA_V1, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
});

test('the source skimmer uses 3+2 movement and Iron Dust open/rubble costs across phases', () => {
  const source = IRON_DUST_CORE_DATA_V1.units.find(candidate => candidate.id === 'gev');
  assert.equal(source.move, UNIT_RULES.gev.move);
  assert.equal(CORE_IRON_DUST_GEV_PROBE_CONTRACT.effectiveRules.movement.gevSecondMove,
    UNIT_RULES.gev.secondMove);
  assert.equal(TerrainRules.movementCost('open-ground', source), 1);
  assert.equal(TerrainRules.movementCost('rubble-field', source), 2);
  assert.equal(movementCostForMode('tracked', 'open-ground'), 1);
  assert.equal(movementCostForMode('tracked', 'rubble-field'), 2);
  const commands = [move({x: 1, y: 5}), end('player'), end('player'), move({x: 1, y: 4}),
    end('player'), end('enemy'), end('enemy'), end('enemy')];
  const run = () => {
    let state = createGame(makeIronDustGevProbeScenario(), 5);
    const initial = state, results = [];
    assert.equal(movementPaths(state, unit(state), 3).get('1,4').cost, 3);
    for (const command of commands) {
      const result = dispatch(state, command);
      assert.ok(result.state, JSON.stringify(result.error));
      results.push(result);
      state = result.state;
    }
    return {initial, results, finalState: state};
  };
  const first = run(), second = run();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.results[0].events[0].path, [{x: 1, y: 5}]);
  assert.equal(first.results[2].state.phase, 'gev');
  const gevState = first.results[2].state;
  assert.equal(movementPaths(gevState, unit(gevState), 2).get('1,4').cost, 2);
  assert.ok(queryAreas(gevState, 'gev').movementReachable.some(p => p.x === 1 && p.y === 4));
  assert.deepEqual(first.results[3].events[0].path, [{x: 1, y: 4}]);
  assert.equal(unit(first.results[3].state).secondMoved, true);
  assert.deepEqual(queryAreas(first.results[3].state, 'gev').movementReachable, []);
  assert.equal(first.finalState.phase, 'movement');
  assert.equal(first.finalState.activeTeam, 'player');
  assert.equal(first.finalState.turn, 2);
  assert.equal(unit(first.finalState).secondMoved, false);
  assert.equal(first.finalState.rng.state, 5);
});

test('probe rejects wrong headers, altered source data and unsupported actions before state/RNG mutation', () => {
  for (const [change, code] of [
    [s => {delete s.rulesVersion}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.rulesVersion = 'core-v4-supercover-v1'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.ruleProfileId = 'FIELD_TEST_LEGACY_v1'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.ruleProfileId = 'FULL_CATALOG_v1'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.scenarioId = 'iron-dust'}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {s.scenarioVersion = 'other'}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {s.effectiveRules.movement.gevSecondMove = 3}, 'RULE_SNAPSHOT_MISMATCH'],
    [s => {s.map.terrain[0].type = 'open-ground'}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {s.units[0].id = 'other'}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {s.units[0].movementMode = 'gev'}, 'SCENARIO_PROFILE_MISMATCH']
  ]) {
    const scenario = makeIronDustGevProbeScenario();
    change(scenario);
    const before = JSON.stringify(scenario);
    assert.throws(() => createGame(scenario, 5), {code});
    assert.equal(JSON.stringify(scenario), before);
  }
  let state = createGame(makeIronDustGevProbeScenario(), 5);
  for (const [command, code] of [
    [fire, 'UNSUPPORTED_COMMAND'],
    [{type: 'Move', playerId: 'player', unitId: 'core', to: {x: 9, y: 2}}, 'UNSUPPORTED_COMMAND'],
    [move({x: 12, y: 6}), 'OUT_OF_BOUNDS']
  ]) {
    const before = JSON.stringify(state);
    assert.equal(queryCommand(state, command).error.code, code);
    assert.equal(dispatch(state, command).error.code, code);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
  state = dispatch(dispatch(state, end('player')).state, end('player')).state;
  assert.equal(queryActions(state, 'gev').units.gev.fire.reason, 'UNSUPPORTED_COMMAND');
  assert.deepEqual(queryAreas(state, 'gev').attackableTargets, []);
  const moved = dispatch(state, move({x: 1, y: 5})).state;
  const before = JSON.stringify(moved);
  assert.equal(dispatch(moved, move({x: 2, y: 5})).error.code, 'ACTION_SPENT');
  assert.equal(JSON.stringify(moved), before);
  assert.equal(moved.rng.state, 5);
  const tampered = plain(moved);
  tampered.effectiveRules.movement.gevSecondMove = 3;
  const tamperedBefore = JSON.stringify(tampered);
  assert.equal(dispatch(tampered, end('player')).error.code, 'RULE_SNAPSHOT_MISMATCH');
  assert.equal(JSON.stringify(tampered), tamperedBefore);
});

test('historical v1/v2 replay oracle and isolated v3/v4 contracts remain intact', () => {
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
  assert.equal(JSON.stringify(replayReference()), JSON.stringify(replayReference()));
});
