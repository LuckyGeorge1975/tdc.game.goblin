import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, dispatch, queryCommand, phaseScenario, PHASE_SEED,
  replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {CORE_PROFILE_CONTRACT} from '../src/core/profile-contract.mjs';

const scenario = () => ({...structuredClone(phaseScenario), ...structuredClone(CORE_PROFILE_CONTRACT)});
const end = {type: 'EndPhase', playerId: 'player'};

test('a new explicit Core profile pair starts with an immutable effective snapshot', () => {
  const source = scenario();
  const state = createGame(source, PHASE_SEED);
  assert.equal(state.rulesVersion, 'core-v3-profile-v1');
  assert.equal(state.scenarioId, 'core-profile-probe');
  assert.deepEqual(state.effectiveRules, CORE_PROFILE_CONTRACT.effectiveRules);
  assert.equal(Object.isFrozen(state.effectiveRules), true);
  assert.equal(Object.isFrozen(state.effectiveRules.movement), true);
  source.effectiveRules.movement.gevSecondMove = 99;
  source.units[0].move = 99;
  assert.equal(state.effectiveRules.movement.gevSecondMove, 2);
  assert.equal(state.units[0].move, phaseScenario.units[0].move);
  const next = dispatch(state, end).state;
  assert.equal(next.phase, 'fire');
  assert.deepEqual(next.effectiveRules, state.effectiveRules);
  assert.equal(Object.isFrozen(next.effectiveRules.movement), true);
  assert.deepEqual(state.effectiveRules, CORE_PROFILE_CONTRACT.effectiveRules);
});

test('new Core starts reject missing, unknown and mismatched headers or parameters', () => {
  const variants = [
    [s => {delete s.rulesVersion}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.rulesVersion = 'core-v4'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {delete s.ruleProfileId}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.ruleProfileId = 'FULL_CATALOG_v1'}, 'UNSUPPORTED_RULE_PROFILE'],
    [s => {s.scenarioId = 'other'}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {delete s.scenarioVersion}, 'SCENARIO_PROFILE_MISMATCH'],
    [s => {delete s.effectiveRules}, 'RULE_SNAPSHOT_MISMATCH'],
    [s => {s.effectiveRules.movement.gevSecondMove = 3}, 'RULE_SNAPSHOT_MISMATCH'],
    [s => {s.effectiveRules.extra = true}, 'RULE_SNAPSHOT_MISMATCH']
  ];
  for (const [change, code] of variants) {
    const input = scenario();
    change(input);
    const before = JSON.stringify(input);
    assert.throws(() => createGame(input, PHASE_SEED), {code});
    assert.equal(JSON.stringify(input), before, code);
  }
});

test('a mismatched new state is rejected before a command changes state or RNG', () => {
  const initial = createGame(scenario(), PHASE_SEED);
  for (const change of [
    s => {s.ruleProfileId = 'FULL_CATALOG_v1'},
    s => {delete s.scenarioId},
    s => {s.effectiveRules.movement.gevSecondMove = 3},
    s => {delete s.effectiveRules}
  ]) {
    const state = structuredClone(initial);
    change(state);
    const before = JSON.stringify(state);
    const result = dispatch(state, end);
    assert.ok(result.error?.code);
    assert.deepEqual(queryCommand(state, end), {available: false, error: result.error});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, PHASE_SEED);
  }
});

test('historical Core-v2 replay oracle remains byte-for-byte unchanged', () => {
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
