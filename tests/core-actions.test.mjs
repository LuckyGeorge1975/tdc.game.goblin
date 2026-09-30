import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, dispatch, queryAreas, queryActions, queryCommand,
  phaseScenario, PHASE_SEED, referenceScenario, REFERENCE_SEED,
  replayReference, replayPhase, expectedPhaseReplay,
} from '../src/core/game-core.mjs';

const phase = () => createGame(phaseScenario, PHASE_SEED);
const end = state => dispatch(state, { type: 'EndPhase', playerId: state.activeTeam }).state;

test('queryCommand shares every concrete acceptance and rejection with dispatch without mutating RNG', () => {
  const initial = phase();
  const fire = end(initial);
  const commands = [
    [initial, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 2, y: 1 } }],
    [initial, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 7, y: 5 } }],
    [initial, { type: 'Move', playerId: 'enemy', unitId: 'e-tank', to: { x: 3, y: 4 } }],
    [fire, { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' }],
    [fire, { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'p-gev' }],
    [fire, { type: 'Fire', playerId: 'player', unitId: 'p-gev', targetId: 'e-tank' }],
    [initial, { type: 'EndPhase', playerId: 'player' }],
    [initial, { type: 'Load', playerId: 'player', unitId: 'p-tank' }],
  ];
  for (const [state, command] of commands) {
    const original = JSON.stringify(state);
    const first = queryCommand(state, command), second = queryCommand(state, command);
    const actual = dispatch(state, command);
    assert.deepEqual(first, second);
    assert.equal(first.available, !!actual.state);
    if (actual.error) assert.deepEqual(first.error, actual.error);
    assert.equal(JSON.stringify(state), original);
  }
  assert.notEqual(dispatch(fire, { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' }).state.rng.state, fire.rng.state);
});

test('queryActions reports legal targets, stable reasons and sorted pending units from Core', () => {
  let state = phase();
  const initial = queryActions(state);
  assert.deepEqual(initial, queryActions(state));
  assert.deepEqual(initial.endPhase.pendingUnitIds, ['p-gev', 'p-tank']);
  assert.equal(initial.endPhase.available, true);
  assert.equal(initial.endPhase.reason, null);
  assert.deepEqual(initial.endPhase.next, { phase: 'fire', activeTeam: 'player', turn: 1 });
  assert.deepEqual(initial.units['p-gev'].move.targets, queryAreas(state, 'p-gev').movementReachable);
  assert.equal(initial.units['e-tank'].move.reason, 'NOT_ACTIVE_TEAM');
  assert.deepEqual(initial.units['e-tank'].move.targets, []);
  assert.equal(initial.units['p-gev'].fire.reason, 'WRONG_PHASE');

  state = dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 2, y: 1 } }).state;
  assert.equal(queryActions(state, 'p-gev').units['p-gev'].move.reason, 'ACTION_SPENT');
  assert.deepEqual(queryActions(state).endPhase.pendingUnitIds, ['p-tank']);
  state = end(state);
  const fire = queryActions(state);
  assert.equal(fire.units['p-gev'].fire.reason, 'NO_ATTACKABLE_TARGET');
  assert.deepEqual(fire.units['p-tank'].fire.targetIds, queryAreas(state, 'p-tank').attackableTargets);
  assert.deepEqual(fire.endPhase.pendingUnitIds, ['p-tank']);
  state = dispatch(state, { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' }).state;
  assert.equal(queryActions(state, 'p-tank').units['p-tank'].fire.reason, 'ACTION_SPENT');
  assert.deepEqual(queryActions(state).endPhase.pendingUnitIds, []);
  state = end(state);
  const gev = queryActions(state);
  assert.equal(gev.units['p-gev'].move.available, true);
  assert.equal(gev.units['p-tank'].move.reason, 'GEV_ONLY');
  assert.deepEqual(gev.endPhase.pendingUnitIds, ['p-gev']);
  state = dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 4, y: 1 } }).state;
  assert.deepEqual(queryActions(state).endPhase.pendingUnitIds, []);
  state = end(state);
  assert.equal(state.activeTeam, 'enemy');
  assert.equal(queryActions(state, 'e-tank').units['e-tank'].move.reason, 'UNIT_DISABLED');
  assert.equal(queryActions(state, 'e-core').units['e-core'].move.reason, 'NO_REACHABLE_HEX');
  assert.equal(queryActions(state).endPhase.available, true);
  assert.deepEqual(queryActions(state).endPhase.pendingUnitIds, []);
});

test('an unmoved skimmer is still pending in GEV, while LOS blocks a concrete fire intent', () => {
  const gev = end(end(phase()));
  const actions = queryActions(gev);
  assert.equal(actions.units['p-gev'].move.available, true);
  assert.deepEqual(actions.endPhase.pendingUnitIds, ['p-gev']);
  assert.deepEqual(actions.units['p-gev'].move.targets, queryAreas(gev, 'p-gev').movementReachable);
  const blockedScenario = structuredClone(phaseScenario);
  blockedScenario.map.terrain.push({ x: 2, y: 4, type: 'mountain' });
  const blocked = end(createGame(blockedScenario, PHASE_SEED));
  const command = { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' };
  assert.equal(queryCommand(blocked, command).error.code, 'TARGET_NOT_ATTACKABLE');
  assert.deepEqual(queryCommand(blocked, command).error, dispatch(blocked, command).error);
});

test('endPhase.next predicts every actual phase, team and turn transition, including pending actions', () => {
  let state = phase();
  for (let i = 0; i < 9; i++) {
    const before = JSON.stringify(state);
    const queried = queryActions(state).endPhase;
    const concrete = queryCommand(state, { type: 'EndPhase', playerId: state.activeTeam });
    assert.equal(queried.available, true);
    assert.equal(concrete.available, true);
    const next = end(state);
    assert.deepEqual(queried.next, { phase: next.phase, activeTeam: next.activeTeam, turn: next.turn });
    assert.equal(JSON.stringify(state), before);
    state = next;
  }
});

test('ended games and unknown units expose stable reasons and empty targets', () => {
  const state = phase();
  const unknown = queryActions(state, 'missing');
  assert.equal(unknown.units.missing.move.reason, 'UNIT_NOT_FOUND');
  assert.equal(unknown.units.missing.fire.reason, 'UNIT_NOT_FOUND');
  assert.deepEqual(unknown.units.missing.move.targets, []);
  const ended = structuredClone(state);
  ended.victory = { status: 'ended', winner: 'player' };
  const actions = queryActions(ended);
  assert.equal(actions.units['p-gev'].move.reason, 'GAME_ENDED');
  assert.deepEqual(actions.units['p-gev'].move.targets, []);
  assert.deepEqual(actions.units['p-tank'].fire.targetIds, []);
  assert.deepEqual(actions.endPhase, { available: false, reason: 'GAME_ENDED', pendingUnitIds: [], next: null });
  assert.deepEqual(queryCommand(ended, { type: 'EndPhase', playerId: 'player' }), { available: false, error: { code: 'GAME_ENDED', details: {} } });
});

test('query exports leave both versioned replay oracles unchanged', () => {
  const oldBefore = replayReference(), newBefore = replayPhase();
  for (const run of [oldBefore, newBefore]) {
    queryActions(run.initialState);
    for (const { command, result } of run.steps) {
      const state = result.state ?? run.initialState;
      queryActions(state);
      queryCommand(state, command);
    }
  }
  assert.deepEqual(replayReference(), oldBefore);
  assert.deepEqual(replayPhase(), newBefore);
  assert.deepEqual(newBefore, expectedPhaseReplay);
  assert.deepEqual(queryActions(createGame(referenceScenario, REFERENCE_SEED)), queryActions(createGame(referenceScenario, REFERENCE_SEED)));
});
