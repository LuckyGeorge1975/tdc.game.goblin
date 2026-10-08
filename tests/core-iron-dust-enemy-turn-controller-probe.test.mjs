import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import TerrainRules from '../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from
  '../src/core/iron-dust-legacy-los-probe.mjs';
import {createIronDustUnifiedStateProbe, validateIronDustUnifiedStateProbe} from
  '../src/core/iron-dust-unified-state-probe.mjs';
import {dispatchIronDustStandardFireAction} from
  '../src/core/iron-dust-standard-fire-action-probe.mjs';
import {queryIronDustEnemyMoveAction, preflightIronDustEnemyMoveAction,
  dispatchIronDustEnemyMoveAction} from
  '../src/core/iron-dust-enemy-move-action-probe.mjs';
import {createIronDustEnemyTurnController, validateIronDustEnemyTurnController,
  queryIronDustEnemyTurnController, preflightIronDustEnemyTurnController,
  dispatchIronDustEnemyTurnController} from
  '../src/core/iron-dust-enemy-turn-controller-probe.mjs';
import {createGame} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const unit = (state, id) => state.units.find(item => item.id === id);
const request = {type: 'AdvanceEnemyTurn', playerId: 'enemy'};
const end = {type: 'EndPhase', playerId: 'player'};
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
function extract(name, last = false) {
  const start = last ? game.lastIndexOf(`function ${name}(`) :
    game.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const opening = game.indexOf('{', start);
  let depth = 0, quote = null, escaped = false;
  for (let i = opening; i < game.length; i++) {
    const ch = game[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return game.slice(start, i + 1);
  }
  throw new Error(`unclosed ${name}`);
}
function legacyTurn(seed, changes = {}) {
  const map = IRON_DUST_CORE_DATA_V1.map;
  const units = clone(IRON_DUST_CORE_DATA_V1.units);
  for (const [id, fields] of Object.entries(changes))
    Object.assign(unit({units}, id), fields);
  let rng = seed;
  const math = Object.assign(Object.create(Math), {random: () => {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return (rng % 6) / 6;
  }});
  const node = {};
  const context = vm.createContext({units, W: map.width, H: map.height,
    turn: 1, phase: 'player', turnPhase: 'gev', Math: math,
    $: () => node, scheduleGameTask: callback => callback(),
    showPhaseTransition() {}, setToast() {}, addLog() {},
    setTimeout() {}, draw() {}, updateSelection() {},
    setTurnPhase(value) {context.turnPhase = value},
    resetActionState() {for (const actor of units) {
      actor.moved = false; actor.fired = false; actor.secondMoved = false;
    }},
    checkVictory: () => false, reportPassengerHits() {}, carrierCargo: () => [],
    lineOfSight: (from, to) =>
      hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, from, to),
    terrainTypeAt: (x, y) => map.terrain.find(cell => cell.x === x && cell.y === y)?.type ??
      map.defaultTerrain,
    movementCost: (actor, key) => {
      const [x, y] = key.split(',').map(Number);
      const type = map.terrain.find(cell => cell.x === x && cell.y === y)?.type ??
        map.defaultTerrain;
      return TerrainRules.movementCost(type, actor);
    },
    effectiveDefense: target => target.defense +
      TerrainRules.coverBonus(map.terrain.find(cell =>
        cell.x === target.x && cell.y === target.y)?.type ?? map.defaultTerrain)});
  const crtStart = game.indexOf('const COMBAT_RULES='), crtEnd =
    game.indexOf(';const units', crtStart);
  vm.runInContext(`${game.slice(crtStart, crtEnd + 1)}\n` +
    ['hexNeighbors', 'dist', 'findEnemyStep', 'recoverDisabled', 'combatRatio',
      'applyCombatRoll', 'combatOutcome', 'enemyTurn'].map(name => extract(name)).join('\n') +
    '\n' + extract('enemyFire', true), context);
  vm.runInContext('enemyTurn()', context);
  return {units, rng, turn: context.turn};
}
function enemy(seed = 1, fixture = 'source', changes = {}) {
  let state = createIronDustUnifiedStateProbe(seed, {fixture});
  for (let i = 0; i < 3; i++)
    state = dispatchIronDustStandardFireAction(state, end).state;
  state = clone(state);
  for (const [id, fields] of Object.entries(changes))
    Object.assign(unit(state, id), fields);
  validateIronDustUnifiedStateProbe(state);
  return state;
}
function step(controller) {
  const before = JSON.stringify(controller);
  const query = queryIronDustEnemyTurnController(controller, request);
  assert.equal(query.available, true, JSON.stringify(query.error));
  assert.deepEqual(preflightIronDustEnemyTurnController(controller, request), query);
  const resolved = dispatchIronDustEnemyTurnController(controller, request);
  assert.ok(resolved.controller, JSON.stringify(resolved.error));
  assert.equal(JSON.stringify(controller), before);
  assert.doesNotThrow(() => validateIronDustEnemyTurnController(resolved.controller));
  return {action: query.action, ...resolved};
}
function complete(controller) {
  const trace = [];
  while (controller.cursor.pass !== 'complete') {
    assert.ok(trace.length < 7);
    const next = step(controller);
    trace.push({action: next.action, events: next.events,
      state: next.controller.state, cursor: next.controller.cursor});
    controller = next.controller;
  }
  return {controller, trace};
}
function unchangedReject(controller, command, code) {
  const before = JSON.stringify(controller);
  assert.deepEqual(queryIronDustEnemyTurnController(controller, command),
    {available: false, error: {code}});
  assert.deepEqual(preflightIronDustEnemyTurnController(controller, command),
    {available: false, error: {code}});
  assert.deepEqual(dispatchIronDustEnemyTurnController(controller, command),
    {error: {code}});
  assert.equal(JSON.stringify(controller), before);
}

test('A: source start performs both first moves, then both retries and one reset', () => {
  const state = enemy(1), initial = JSON.stringify(state);
  const controller = createIronDustEnemyTurnController(state);
  assert.equal(controller.executable, false);
  assert.equal(controller.cursor.pass, 'first');
  const {controller: done, trace} = complete(controller);
  assert.deepEqual(trace.map(item => item.action.kind),
    ['move', 'move', 'pass', 'pass', 'end-phase']);
  assert.deepEqual(trace.map(item => item.action.actorId).slice(0, 4),
    ['guard', 'raider', 'guard', 'raider']);
  assert.deepEqual([unit(trace[0].state, 'guard').x, unit(trace[0].state, 'guard').y],
    [8, 4]);
  assert.deepEqual([unit(trace[1].state, 'raider').x, unit(trace[1].state, 'raider').y],
    [8, 6]);
  assert.deepEqual(trace.map(item => item.events[0].type),
    ['EnemyMoved', 'EnemyMoved', 'EnemyPassRecorded', 'EnemyPassRecorded',
      'PhaseChanged']);
  assert.ok(trace.every(item => item.state.rng.state === 1));
  assert.equal(done.state.turn, 2);
  assert.equal(done.state.phase, 'movement');
  assert.deepEqual(done.state.firedActorIds, []);
  assert.deepEqual(done.state.enemyPassed, []);
  assert.equal(JSON.stringify(state), initial);
  unchangedReject(done, request, 'ENEMY_TURN_COMPLETE');
  assert.throws(() => createGame(done.state, 1), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(done.state, 1, []),
    {code: 'REPLAY_PROFILE_MISMATCH'});
});

test('complete source and move-retry turns match the actual Legacy VM', () => {
  for (const [seed, changes] of [[1, {}], [2, {guard: {x: 5, y: 5}}]]) {
    const {controller} = complete(createIronDustEnemyTurnController(
      enemy(seed, 'source', changes)));
    const old = legacyTurn(seed, changes);
    for (const id of ['guard', 'raider', 'ogre', 'gev', 'missile', 'infantry']) {
      const actual = unit(controller.state, id), expected = unit({units: old.units}, id);
      assert.deepEqual([actual.x, actual.y, actual.hp, actual.disabled],
        [expected.x, expected.y, expected.hp, !!expected.disabled], `${seed} ${id}`);
    }
    assert.equal(controller.state.rng.state, old.rng);
    assert.equal(controller.state.turn, old.turn);
  }
});

test('B: adjacent guard picks Ogre missiles, then waits until after raider first pass', () => {
  const {trace} = complete(createIronDustEnemyTurnController(enemy(2, 'adjacent')));
  assert.equal(trace[0].action.kind, 'fire');
  assert.equal(trace[0].action.actorId, 'guard');
  assert.equal(trace[0].action.command.targetId, 'ogre');
  assert.equal(trace[0].action.command.targetKey, 'missiles');
  assert.equal(trace[0].events[0].roll, 5);
  assert.equal(trace[0].events[0].result, 'X');
  assert.equal(unit(trace[0].state, 'ogre').ogreSystems.weapons.missiles.destroyed, 1);
  assert.equal(trace[2].action.actorId, 'guard');
  assert.equal(trace[2].action.kind, 'skip');
  assert.equal(trace[2].action.reason, 'FIRED');
  assert.equal(trace[1].state.rng.state, trace[0].state.rng.state);
});

test('C: first guard move precedes raider first pass and guard retry fire', () => {
  const {trace} = complete(createIronDustEnemyTurnController(
    enemy(2, 'source', {guard: {x: 5, y: 5}})));
  assert.deepEqual([trace[0].action.kind, trace[0].action.to],
    ['move', {x: 5, y: 6}]);
  assert.equal(trace[0].state.rng.state, 2);
  assert.equal(trace[1].action.actorId, 'raider');
  assert.equal(trace[2].action.actorId, 'guard');
  assert.equal(trace[2].action.kind, 'fire');
  assert.equal(trace[2].action.command.targetId, 'missile');
  assert.equal(trace[2].events[0].roll, 5);
  assert.equal(trace[2].events[0].result, 'X');
  assert.notEqual(trace[2].state.rng.state, 2);
});

test('a fixed HOLD records the first attempt without moving or drawing RNG', () => {
  const state = enemy(1, 'source', {guard: {x: 4, y: 0}});
  const controller = createIronDustEnemyTurnController(state);
  const first = step(controller);
  assert.deepEqual([first.action.kind, first.action.reason], ['hold', 'HOLD']);
  assert.deepEqual([unit(first.controller.state, 'guard').x,
    unit(first.controller.state, 'guard').y], [4, 0]);
  assert.equal(unit(first.controller.state, 'guard').moved, true);
  assert.equal(first.controller.state.rng.state, 1);
  const second = step(first.controller);
  assert.equal(second.action.actorId, 'raider');
  const retry = step(second.controller);
  assert.equal(retry.action.actorId, 'guard');
  assert.equal(retry.action.kind, 'pass');
  assert.equal(retry.action.reason, 'NO_TARGET');
});

test('D: disabled guard receives one technical pass and recovers next enemy entry', () => {
  const state = enemy(1, 'source',
    {guard: {disabled: true, disabledUntil: 2}});
  const {controller: done, trace} = complete(createIronDustEnemyTurnController(state));
  assert.deepEqual([trace[0].action.kind, trace[0].action.reason],
    ['pass', 'DISABLED']);
  assert.equal(trace[0].state.rng.state, 1);
  assert.equal(trace[2].action.kind, 'skip');
  assert.equal(trace[2].action.reason, 'PASSED');
  assert.equal(unit(done.state, 'guard').disabled, true);
  let next = done.state;
  for (let i = 0; i < 3; i++) next = dispatchIronDustStandardFireAction(next, end).state;
  assert.equal(unit(next, 'guard').disabled, false);
  assert.equal(unit(next, 'guard').disabledUntil, 0);
  assert.equal(createIronDustEnemyTurnController(next).cursor.turn, 2);
});

test('a destroyed guard is skipped without a synthetic pass or RNG draw', () => {
  const {controller, trace} = complete(createIronDustEnemyTurnController(
    enemy(1, 'source', {guard: {hp: 0}})));
  assert.deepEqual(controller.cursor.eligibleActorIds, ['raider']);
  assert.deepEqual(trace.map(item => item.action.kind),
    ['skip', 'move', 'skip', 'pass', 'end-phase']);
  assert.equal(trace[0].action.reason, 'DESTROYED');
  assert.equal(trace[2].action.reason, 'DESTROYED');
  assert.ok(trace.every(item => item.state.rng.state === 1));
  assert.ok(trace.every(item => !item.events.some(event =>
    event.type === 'EnemyPassRecorded' && event.actorId === 'guard')));
});

test('E: raider selects the live GEV after guard destroys the last Ogre system', () => {
  const state = enemy(2, 'source',
    {guard: {x: 1, y: 4}, raider: {x: 2, y: 5}});
  const ogre = unit(state, 'ogre');
  ogre.ogreSystems.treads = 0;
  for (const [key, weapon] of Object.entries(ogre.ogreSystems.weapons))
    weapon.destroyed = key === 'missiles' ? weapon.count - 1 : weapon.count;
  validateIronDustUnifiedStateProbe(state);
  const controller = createIronDustEnemyTurnController(state);
  const guard = step(controller);
  assert.equal(guard.action.command.targetId, 'ogre');
  assert.equal(guard.action.command.targetKey, 'missiles');
  assert.equal(unit(guard.controller.state, 'ogre').hp, 0);
  assert.equal(guard.controller.state.victory.status, 'ongoing');
  const raider = step(guard.controller);
  assert.equal(raider.action.command.targetId, 'gev');
});

test('F: blocked nearer line yields a visible infantry first shot', () => {
  const first = step(createIronDustEnemyTurnController(enemy(1, 'source',
    {guard: {x: 0, y: 4}})));
  assert.equal(first.action.kind, 'fire');
  assert.equal(first.action.command.targetId, 'infantry');
  assert.equal(first.events[0].type, 'EnemyUnitFireResolved');
});

test('terminal last-player death stops without a synthetic turn reset', () => {
  const state = enemy(2, 'iron-dust-rest-ogre-fixture-v1');
  const ogre = unit(state, 'ogre');
  ogre.ogreSystems.treads = 0;
  for (const [key, weapon] of Object.entries(ogre.ogreSystems.weapons))
    weapon.destroyed = key === 'missiles' ? weapon.count - 1 : weapon.count;
  validateIronDustUnifiedStateProbe(state);
  const {controller: done, trace} = complete(createIronDustEnemyTurnController(state));
  assert.equal(trace.length, 1);
  assert.equal(trace[0].action.kind, 'fire');
  assert.equal(trace[0].events[0].roll, 5);
  assert.deepEqual(done.state.victory, {status: 'ended', winner: 'enemy'});
  assert.equal(done.state.turn, 1);
  assert.equal(done.state.phase, 'enemy');
  unchangedReject(done, request, 'ENEMY_TURN_COMPLETE');
});

test('cursor digest, command and move/pass gates reject without mutation', () => {
  const state = enemy(1);
  const controller = createIronDustEnemyTurnController(state);
  unchangedReject(controller, {...request, extra: 1}, 'ENEMY_CONTROLLER_COMMAND_INVALID');
  unchangedReject(controller, {...request, playerId: 'player'}, 'NOT_ACTIVE_TEAM');
  const forged = clone(controller);
  forged.cursor.index = 1;
  unchangedReject(forged, request, 'ENEMY_CONTROLLER_STATE_MISMATCH');
  const stale = clone(controller);
  stale.state.rng.state = 2;
  unchangedReject(stale, request, 'ENEMY_CONTROLLER_STATE_MISMATCH');
  const move = {type: 'EnemyMove', playerId: 'enemy', actorId: 'guard',
    to: {x: 8, y: 4}};
  assert.equal(queryIronDustEnemyMoveAction(state, move).available, true);
  assert.deepEqual(preflightIronDustEnemyMoveAction(state, move),
    queryIronDustEnemyMoveAction(state, move));
  const before = JSON.stringify(state);
  assert.deepEqual(dispatchIronDustEnemyMoveAction(state, {...move, to: {x: 7, y: 4}}),
    {error: {code: 'ENEMY_MOVE_TARGET_MISMATCH'}});
  assert.equal(JSON.stringify(state), before);
  const adjacent = enemy(1, 'adjacent');
  assert.equal(queryIronDustEnemyMoveAction(adjacent,
    {type: 'EnemyHold', playerId: 'enemy', actorId: 'guard'}).error.code,
  'FIRE_AVAILABLE');
});
