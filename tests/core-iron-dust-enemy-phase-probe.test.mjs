import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustEnemyPhaseProbe, validateIronDustEnemyPhaseProbe,
  queryIronDustEnemyPhaseProbe, dispatchIronDustEnemyPhaseProbe} from '../src/core/iron-dust-enemy-phase-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const end = playerId => ({type: 'EndPhase', playerId});
const pass = (actorId, playerId = 'enemy') => ({type: 'EnemyPass', playerId, actorId});
const tracePoint = state => [state.phase, state.side, state.turn, state.rng.state];

function extractFunction(text, name, last = false) {
  const needle = `function ${name}(`;
  const start = last ? text.lastIndexOf(needle) : text.indexOf(needle);
  const opening = text.indexOf('{', start);
  assert.ok(start >= 0 && opening > start, name);
  let depth = 0;
  for (let i = opening; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`unclosed Legacy function ${name}`);
}

function legacyNoActionCycle() {
  let scheduled;
  const controls = new Map(), node = key => {
    if (!controls.has(key)) controls.set(key, {textContent: '', innerHTML: '', title: ''});
    return controls.get(key);
  };
  const units = plain(IRON_DUST_CORE_DATA_V1.units).map(unit => ({...unit,
    moveCount: 0, moveFrom: null, acted: false, disabled: false, justHit: false,
    moved: false, fired: false, secondMoved: false,
    embarkedThisTurn: false, disembarkedThisTurn: false}));
  const context = vm.createContext({units, phase: 'player', turnPhase: 'movement',
    turn: 1, selected: null, transportLoadMode: null, transportUnloadMode: null,
    $: node, setViewMode() {}, updatePhaseControls() {}, setToast() {},
    showPhaseTransition() {}, updateSelection() {}, draw() {}, setTimeout() {},
    maybeAutoAdvancePhase() {}, addLog() {}, checkVictory: () => false,
    enemyFire: () => false, findEnemyStep: () => null,
    dist(a, b) {return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)},
    scheduleGameTask(callback) {scheduled = callback}
  });
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  const code = ['recoverDisabled', 'setTurnPhase', 'enemyTurn']
    .map(name => extractFunction(game, name)).join('\n') + '\n' +
    extractFunction(game, 'resetActionState', true);
  vm.runInContext(code, context);
  const point = () => [context.turnPhase, context.phase, context.turn];
  const points = [point()];
  vm.runInContext("setTurnPhase('fire')", context); points.push(point());
  vm.runInContext("setTurnPhase('gev')", context); points.push(point());
  vm.runInContext('enemyTurn()', context); points.push(point());
  assert.equal(typeof scheduled, 'function');
  scheduled(); points.push(point());
  return {points, units: plain(context.units)};
}

test('phase probe is exact, inactive and cannot enter Core or replay', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustEnemyPhaseProbe(5);
  assert.equal(validateIronDustEnemyPhaseProbe(plain(state)).probeVersion, state.probeVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.deepEqual(tracePoint(state), ['movement', 'player', 1, 5]);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
});

test('explicit enemy passes bracket the Legacy no-action phase cycle', () => {
  const legacy = legacyNoActionCycle();
  let state = createIronDustEnemyPhaseProbe(5);
  const points = [tracePoint(state)], events = [];
  for (const command of [end('player'), end('player'), end('player'),
    pass('guard'), pass('raider'), end('enemy')]) {
    assert.deepEqual(queryIronDustEnemyPhaseProbe(state, command), {available: true});
    const result = dispatchIronDustEnemyPhaseProbe(state, command);
    assert.ok(result.state);
    events.push(result.events[0]);
    state = result.state;
    points.push(tracePoint(state));
  }
  assert.deepEqual(points, [
    ['movement', 'player', 1, 5], ['fire', 'player', 1, 5],
    ['gev', 'player', 1, 5], ['enemy', 'enemy', 1, 5],
    ['enemy', 'enemy', 1, 5], ['enemy', 'enemy', 1, 5],
    ['movement', 'player', 2, 5]
  ]);
  assert.deepEqual(points.filter((_, index) => [0, 1, 2, 3, 6].includes(index))
    .map(([phase, side, turn]) => [phase, side, turn]), legacy.points);
  assert.deepEqual(events, [
    {type: 'PhaseChanged', from: 'movement', to: 'fire', side: 'player', turn: 1},
    {type: 'PhaseChanged', from: 'fire', to: 'gev', side: 'player', turn: 1},
    {type: 'PhaseChanged', from: 'gev', to: 'enemy', side: 'enemy', turn: 1},
    {type: 'EnemyPassRecorded', actorId: 'guard', turn: 1, pendingActorIds: ['raider']},
    {type: 'EnemyPassRecorded', actorId: 'raider', turn: 1, pendingActorIds: []},
    {type: 'PhaseChanged', from: 'enemy', to: 'movement', side: 'player', turn: 2}
  ]);
  assert.deepEqual(legacy.units.filter(unit => unit.team === 'enemy' && !unit.core)
    .map(unit => [unit.id, unit.enemyFired]), [['guard', false], ['raider', false]]);
  assert.ok(legacy.units.every(unit => !unit.moved && !unit.fired && !unit.secondMoved && !unit.acted));
  assert.deepEqual(state.enemyPassed, []);
  assert.equal(state.rng.state, 5);
  let repeat = createIronDustEnemyPhaseProbe(5);
  const repeatedEvents = [];
  for (const command of [end('player'), end('player'), end('player'),
    pass('guard'), pass('raider'), end('enemy')]) {
    const result = dispatchIronDustEnemyPhaseProbe(repeat, command);
    repeatedEvents.push(result.events[0]);
    repeat = result.state;
  }
  assert.deepEqual(repeatedEvents, events);
  assert.equal(JSON.stringify(repeat), JSON.stringify(state));
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('wrong team, phase, core, duplicate and pending enemy actions reject without mutation', () => {
  const initial = createIronDustEnemyPhaseProbe(5);
  for (const [command, code] of [
    [end('enemy'), 'NOT_ACTIVE_TEAM'],
    [pass('guard'), 'NOT_ACTIVE_TEAM'],
    [pass('guard', 'player'), 'WRONG_PHASE'],
    [{type: 'Fire', playerId: 'player', unitId: 'ogre', targetId: 'guard'}, 'UNSUPPORTED_COMMAND'],
    [{type: 'Move', playerId: 'player', unitId: 'ogre', to: {x: 2, y: 5}}, 'UNSUPPORTED_COMMAND'],
    [null, 'ENEMY_COMMAND_INVALID']
  ]) {
    const before = JSON.stringify(initial);
    assert.deepEqual(dispatchIronDustEnemyPhaseProbe(initial, command), {error: {code}});
    assert.equal(JSON.stringify(initial), before);
  }
  let state = initial;
  for (let i = 0; i < 3; i++) state = dispatchIronDustEnemyPhaseProbe(state, end('player')).state;
  for (const [command, code] of [
    [end('player'), 'NOT_ACTIVE_TEAM'],
    [end('enemy'), 'ENEMY_COMMANDS_PENDING'],
    [pass('core'), 'ENEMY_ACTOR_FORBIDDEN'],
    [pass('ogre'), 'ENEMY_ACTOR_INVALID'],
    [pass('unknown'), 'ENEMY_ACTOR_INVALID'],
    [{type: 'Fire', playerId: 'enemy', unitId: 'guard', targetId: 'ogre'}, 'UNSUPPORTED_COMMAND']
  ]) {
    const before = JSON.stringify(state);
    assert.deepEqual(dispatchIronDustEnemyPhaseProbe(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
  state = dispatchIronDustEnemyPhaseProbe(state, pass('guard')).state;
  assert.deepEqual(dispatchIronDustEnemyPhaseProbe(state, pass('guard')),
    {error: {code: 'ACTION_SPENT'}});
  assert.deepEqual(dispatchIronDustEnemyPhaseProbe(state, end('enemy')),
    {error: {code: 'ENEMY_COMMANDS_PENDING'}});
});

test('tampered state rejects before command execution', () => {
  assert.throws(() => createIronDustEnemyPhaseProbe(-1), {code: 'ENEMY_PHASE_SEED_INVALID'});
  for (const change of [
    state => {state.sourceRuleProfileId = 'FULL_CATALOG_v1'},
    state => {state.side = 'enemy'},
    state => {state.enemyPassed = ['core']},
    state => {state.turn = 0},
    state => {state.rng.state++}
  ]) {
    const state = plain(createIronDustEnemyPhaseProbe(5));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => dispatchIronDustEnemyPhaseProbe(state, end('player')),
      {code: 'ENEMY_PHASE_MISMATCH'});
    assert.equal(JSON.stringify(state), before);
  }
});
