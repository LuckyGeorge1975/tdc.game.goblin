import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustObjectiveProbe, validateIronDustObjectiveProbe,
  queryIronDustObjectiveProbe, dispatchIronDustObjectiveProbe} from '../src/core/iron-dust-objective-probe.mjs';
import {createIronDustRamProbe, dispatchIronDustRamProbe} from '../src/core/iron-dust-ram-probe.mjs';
import {createIronDustSystemProbe, queryIronDustSystemProbe,
  dispatchIronDustSystemProbe} from '../src/core/iron-dust-system-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const observe = changes => ({type: 'ObserveHpBatch', changes});
const change = (unitId, hp) => ({unitId, hp});

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`), opening = text.indexOf('{', start);
  assert.ok(start >= 0 && opening > start, name);
  let depth = 0;
  for (let i = opening; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`unclosed Legacy function ${name}`);
}

function legacyObjective(units) {
  const config = {objectiveVersion: IRON_DUST_CORE_DATA_V1.objectiveVersion,
    objective: IRON_DUST_CORE_DATA_V1.objective};
  let finished = null;
  const context = vm.createContext({units: plain(units),
    legacySession: {effectiveRules: config}, finish(value) {finished = value}});
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  vm.runInContext(['victoryProfile', 'objectiveSnapshot', 'victoryOutcome', 'checkVictory']
    .map(name => extractFunction(game, name)).join('\n'), context);
  const profile = vm.runInContext('victoryProfile(legacySession.effectiveRules)', context);
  const snapshot = vm.runInContext('objectiveSnapshot', context)(profile, context.units);
  const checkReturned = vm.runInContext('checkVictory()', context);
  return {snapshot: plain(snapshot), checkReturned, finished};
}

function compareLegacy(state) {
  const observed = queryIronDustObjectiveProbe(state), legacy = legacyObjective(state.units);
  assert.deepEqual(observed, {
    coreHp: legacy.snapshot.coreHp,
    enemyAlive: legacy.snapshot.enemyAlive,
    playerAlive: legacy.snapshot.playerAlive,
    outcome: legacy.snapshot.outcome
  });
  assert.equal(legacy.checkReturned, observed.outcome !== null);
  assert.equal(legacy.finished, observed.outcome);
  return observed;
}

function helplessSystemState() {
  let state = createIronDustSystemProbe(5);
  while (state.unit.ogreSystems.treads > 0)
    state = dispatchIronDustSystemProbe(state, {type: 'ResolveSystemAttack',
      attackerId: 'guard', targetKey: 'treads'}).state;
  for (const key of ['main', 'secondary', 'missiles', 'antipersonnel']) {
    while (queryIronDustSystemProbe(state).weapons[key] > 0)
      state = dispatchIronDustSystemProbe(state, {type: 'ResolveSystemAttack',
        attackerId: 'guard', targetKey: key}).state;
  }
  return state;
}

test('objective probe is the exact inactive IRON DUST core contract', () => {
  const sourceBefore = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustObjectiveProbe(5);
  assert.equal(state.objectiveVersion, 1);
  assert.equal(state.objective, 'core');
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.equal(validateIronDustObjectiveProbe(plain(state)).probeVersion, state.probeVersion);
  assert.deepEqual(compareLegacy(state), {coreHp: 5, enemyAlive: 3,
    playerAlive: true, outcome: null});
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), sourceBefore);
});

test('ram observation and phase events keep the core objective ongoing', () => {
  const ramState = dispatchIronDustRamProbe(createIronDustRamProbe(5,
    {fixture: 'near-guard'}), {type: 'Ram', targetId: 'guard'}).state;
  assert.equal(ramState.units.find(unit => unit.id === 'guard').hp, 0);
  let state = createIronDustObjectiveProbe(5);
  const before = JSON.stringify(state);
  const result = dispatchIronDustObjectiveProbe(state,
    observe([change('guard', ramState.units.find(unit => unit.id === 'guard').hp)]));
  assert.deepEqual(result.events, [{type: 'ObjectiveRosterObserved',
    changes: [change('guard', 0)], outcome: null, playerAlive: true, coreHp: 5}]);
  assert.equal(JSON.stringify(state), before);
  state = result.state;
  assert.deepEqual(compareLegacy(state), {coreHp: 5, enemyAlive: 2,
    playerAlive: true, outcome: null});
  const phase = dispatchIronDustObjectiveProbe(state, {type: 'ObservePhase', phase: 'fire'});
  assert.equal(phase.state, state);
  assert.deepEqual(phase.events, [{type: 'ObjectivePhaseObserved', phase: 'fire', outcome: null}]);
  assert.deepEqual(compareLegacy(phase.state), compareLegacy(state));
  assert.equal(state.rng.state, 5);
});

test('core death wins with surviving player even when other enemies live', () => {
  const state = dispatchIronDustObjectiveProbe(createIronDustObjectiveProbe(5),
    observe([change('core', 0)])).state;
  assert.deepEqual(compareLegacy(state), {coreHp: 0, enemyAlive: 2,
    playerAlive: true, outcome: true});
  assert.deepEqual(dispatchIronDustObjectiveProbe(state, {type: 'ObservePhase', phase: 'enemy'}),
    {error: {code: 'OBJECTIVE_ALREADY_ENDED'}});
  assert.equal(state.rng.state, 5);
});

test('Siegebreaker helplessness and simultaneous player loss take defeat priority', () => {
  const system = helplessSystemState();
  assert.equal(queryIronDustSystemProbe(system).helpless, true);
  assert.equal(system.unit.hp, 0);
  let state = dispatchIronDustObjectiveProbe(createIronDustObjectiveProbe(5),
    observe([change('ogre', system.unit.hp)])).state;
  assert.deepEqual(compareLegacy(state), {coreHp: 5, enemyAlive: 3,
    playerAlive: true, outcome: null});
  state = dispatchIronDustObjectiveProbe(state, observe([
    change('core', 0), change('gev', 0), change('missile', 0), change('infantry', 0)
  ])).state;
  assert.deepEqual(compareLegacy(state), {coreHp: 0, enemyAlive: 2,
    playerAlive: false, outcome: false});
  assert.equal(state.rng.state, 5);

  const ordinaryLoss = dispatchIronDustObjectiveProbe(createIronDustObjectiveProbe(5),
    observe(['ogre', 'gev', 'missile', 'infantry'].map(id => change(id, 0)))).state;
  assert.deepEqual(compareLegacy(ordinaryLoss), {coreHp: 5, enemyAlive: 3,
    playerAlive: false, outcome: false});
});

test('invalid observations and tampered contracts reject without State or RNG mutation', () => {
  assert.throws(() => createIronDustObjectiveProbe(-1),
    {code: 'OBJECTIVE_PROBE_SEED_INVALID'});
  for (const changeState of [
    state => {state.objectiveVersion = 2},
    state => {state.objective = 'core-and-escort'},
    state => {state.units.find(unit => unit.id === 'core').core = false},
    state => {state.units.find(unit => unit.id === 'ogre').hp = 6},
    state => {state.rng.state++}
  ]) {
    const state = plain(createIronDustObjectiveProbe(5));
    changeState(state);
    const before = JSON.stringify(state);
    assert.throws(() => dispatchIronDustObjectiveProbe(state, observe([change('guard', 0)])),
      {code: 'OBJECTIVE_PROBE_MISMATCH'});
    assert.equal(JSON.stringify(state), before);
  }
  const state = createIronDustObjectiveProbe(5), before = JSON.stringify(state);
  for (const [command, code] of [
    [observe([change('unknown', 0)]), 'OBJECTIVE_OBSERVATION_INVALID'],
    [observe([change('guard', 4)]), 'OBJECTIVE_OBSERVATION_INVALID'],
    [observe([change('guard', 0), change('guard', 0)]), 'OBJECTIVE_OBSERVATION_INVALID'],
    [observe([]), 'OBJECTIVE_OBSERVATION_INVALID'],
    [{type: 'ObservePhase', phase: 'over'}, 'OBJECTIVE_PHASE_INVALID'],
    [{type: 'Fire', targetId: 'core'}, 'OBJECTIVE_COMMAND_UNSUPPORTED'],
    [null, 'OBJECTIVE_COMMAND_INVALID']
  ]) {
    assert.deepEqual(dispatchIronDustObjectiveProbe(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
