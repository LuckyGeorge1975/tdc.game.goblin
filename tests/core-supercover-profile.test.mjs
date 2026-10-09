import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, dispatch, queryAreas, queryCommand, phaseScenario,
  replayPhase, expectedPhaseReplay, PHASE_SEED} from '../src/core/game-core.mjs';
import {CORE_SUPERCOVER_CONTRACT} from '../src/core/profile-contract.mjs';

const A = {x: 2, y: 2}, B = {x: 2, y: 0};
const L = {x: 1, y: 1}, R = {x: 2, y: 1};
const end = playerId => ({type: 'EndPhase', playerId});
const contains = (cells, point) => cells.some(cell => cell.x === point.x && cell.y === point.y);
const fire = (playerId, unitId, targetId) => ({type: 'Fire', playerId, unitId, targetId});

function scenario(from = A, to = B, blocked = []) {
  const source = {...structuredClone(phaseScenario), ...structuredClone(CORE_SUPERCOVER_CONTRACT)};
  Object.assign(source.units.find(unit => unit.id === 'p-tank'), from);
  Object.assign(source.units.find(unit => unit.id === 'e-tank'), to);
  Object.assign(source.units.find(unit => unit.id === 'p-gev'), {x: 0, y: 5});
  source.map.terrain = blocked.map(point => ({...point, type: 'rubble-field'}));
  return source;
}

function atFire(state, team) {
  const teams = team === 'player' ? ['player'] : ['player', 'player', 'player', 'enemy'];
  for (const playerId of teams) state = dispatch(state, end(playerId)).state;
  assert.equal(state.phase, 'fire');
  assert.equal(state.activeTeam, team);
  return state;
}

test('the v4 probe binds only its explicit profile, scenario, and LOS parameter', () => {
  const source = scenario();
  const state = createGame(source, PHASE_SEED);
  assert.equal(state.rulesVersion, 'core-v4-supercover-v1');
  assert.equal(state.ruleProfileId, 'CORE_SUPERCOVER_PROBE_v1');
  assert.equal(state.effectiveRules.losMode, 'strict-supercover');
  assert.equal(Object.isFrozen(state.effectiveRules), true);
  source.effectiveRules.losMode = 'legacy-round';
  assert.equal(state.effectiveRules.losMode, 'strict-supercover');

  for (const [alter, code] of [
    [s => {delete s.rulesVersion}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.rulesVersion = 'unknown'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {delete s.ruleProfileId}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.ruleProfileId = 'FIELD_TEST_LEGACY_v1'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.scenarioId = 'core-profile-probe'}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {delete s.scenarioVersion}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {delete s.effectiveRules.losMode}, 'RULE_SNAPSHOT_MISMATCH'],
    [s => {s.effectiveRules.losMode = 'legacy-round'}, 'RULE_SNAPSHOT_MISMATCH']
  ]) {
    const input = scenario();
    alter(input);
    assert.throws(() => createGame(input, PHASE_SEED), {code});
  }
});

test('either boundary blocker vetoes both directions in query and Fire dispatch', () => {
  for (const [blocked, visible] of [
    [[], true], [[L], false], [[R], false], [[L, R], false]
  ]) {
    for (const team of ['player', 'enemy']) {
      const state = atFire(createGame(scenario(A, B, blocked), PHASE_SEED), team);
      const actor = team === 'player' ? 'p-tank' : 'e-tank';
      const target = team === 'player' ? 'e-tank' : 'p-tank';
      const point = team === 'player' ? B : A;
      const areas = queryAreas(state, actor);
      const command = fire(team, actor, target);
      assert.equal(contains(areas.fireRange, point), true);
      assert.equal(contains(areas.lineOfSight, point), visible);
      assert.equal(areas.attackableTargets.includes(target), visible);
      assert.equal(queryCommand(state, command).available, visible);
      const before = JSON.stringify(state);
      const result = dispatch(state, command);
      assert.equal(JSON.stringify(state), before);
      if (visible) {
        assert.equal(result.events[0].type, 'ShotResolved');
        assert.equal(Object.isFrozen(result.state.effectiveRules), true);
      } else {
        assert.equal(result.error.code, 'TARGET_NOT_ATTACKABLE');
        assert.equal(state.rng.state, PHASE_SEED);
      }
    }
  }
});

test('ordinary center crossing and endpoint terrain retain their LOS meaning', () => {
  for (const [blocked, visible] of [
    [[], true], [[{x: 2, y: 3}], false], [[{x: 1, y: 3}, {x: 3, y: 3}], true]
  ]) {
    const state = atFire(createGame(scenario({x: 1, y: 3}, {x: 3, y: 3}, blocked), PHASE_SEED), 'player');
    assert.equal(contains(queryAreas(state, 'p-tank').lineOfSight, {x: 3, y: 3}), visible);
    assert.equal(queryCommand(state, fire('player', 'p-tank', 'e-tank')).available, visible);
  }
});

test('invalid v4 state is rejected before Fire can change state or RNG', () => {
  const state = atFire(createGame(scenario(), PHASE_SEED), 'player');
  const changed = structuredClone(state);
  delete changed.effectiveRules.losMode;
  const before = JSON.stringify(changed);
  const command = fire('player', 'p-tank', 'e-tank');
  assert.equal(dispatch(changed, command).error.code, 'RULE_SNAPSHOT_MISMATCH');
  assert.equal(queryCommand(changed, command).error.code, 'RULE_SNAPSHOT_MISMATCH');
  assert.equal(JSON.stringify(changed), before);
  assert.equal(changed.rng.state, PHASE_SEED);
});

test('historical phase replay remains byte-for-byte at its fixed oracle', () => {
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
