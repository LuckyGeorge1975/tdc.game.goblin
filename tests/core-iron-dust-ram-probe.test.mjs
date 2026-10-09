import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustRamProbe, validateIronDustRamProbe, queryIronDustRamProbe,
  dispatchIronDustRamProbe} from '../src/core/iron-dust-ram-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const ram = targetId => ({type: 'Ram', targetId});

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

function legacyRam(state, targetId) {
  const units = plain(state.units), actor = units.find(unit => unit.id === 'ogre');
  const target = units.find(unit => unit.id === targetId);
  const logs = [], toasts = [];
  const context = vm.createContext({
    units, selected: actor, phase: state.phase, turnPhase: state.turnPhase,
    gameOver: false, focusedCell: null, transportLoadMode: null,
    transportUnloadMode: null, W: IRON_DUST_CORE_DATA_V1.map.width,
    H: IRON_DUST_CORE_DATA_V1.map.height,
    terrainTypes: new Map(),
    terrain: new Set(IRON_DUST_CORE_DATA_V1.map.terrain.map(cell => `${cell.x},${cell.y}`)),
    victoryChecks: 0,
    draw() {}, showFieldInfo() {}, showUnitInfo() {}, clearUnitInfo() {}, updateSelection() {},
    setTimeout() {}, setToast(message) {toasts.push(message)},
    addLog(message) {logs.push(message)},
    checkVictory() {context.victoryChecks++; return false},
    clearSelection(message) {context.selected = null; toasts.push(message)},
    lineOfSight: () => false, weaponTargetAllowed: () => false,
    dist: () => 1, attack() {throw new Error('unexpected Fire')},
    selectEnemyUnit() {}, selectPlayerUnit() {}, canEmbark: () => false,
    canUnloadTo: () => false
  });
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  vm.runInContext(readFileSync(new URL('../terrain-rules.js', import.meta.url), 'utf8'), context);
  const functions = ['terrainTypeAt', 'hexNeighbors', 'movementCost', 'findMovementPath', 'handleHex'];
  vm.runInContext(functions.map(name => extractFunction(game, name)).join('\n'), context);
  const path = target ? vm.runInContext('findMovementPath', context)(actor, target, actor.move) : null;
  vm.runInContext('handleHex', context)(target?.x ?? 0, target?.y ?? 0);
  for (const name of ['ogre-systems.js', 'ogre-runtime.js'])
    vm.runInContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), context);
  context.GoblinOgreRuntime.syncUnit(actor);
  return {units: plain(context.units), selectedUnitId: context.selected?.id ?? null,
    logs: plain(logs), toasts: plain(toasts),
    victoryChecks: context.victoryChecks, path: plain(path)};
}

test('ram probe preserves source and cannot enable Core or replay', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustRamProbe(5);
  assert.deepEqual(state.units.map(unit => unit.id), IRON_DUST_CORE_DATA_V1.units.map(unit => unit.id));
  assert.deepEqual(plain(state.units.find(unit => unit.id === 'ogre').ogreSystems),
    plain(IRON_DUST_CORE_DATA_V1.units.find(unit => unit.id === 'ogre').ogreSystems));
  assert.equal(validateIronDustRamProbe(plain(state)).probeVersion, state.probeVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
});

test('reachable non-core rams match the actual Legacy path and unit mutations', () => {
  for (const [fixture, targetId, to] of [
    ['near-guard', 'guard', {x: 2, y: 5}],
    ['near-raider', 'raider', {x: 2, y: 5}],
    ['rubble-guard', 'guard', {x: 1, y: 4}]
  ]) {
    const before = createIronDustRamProbe(5, {fixture});
    const queried = queryIronDustRamProbe(before, targetId);
    assert.deepEqual(queried, {available: true, path: [to]});
    const result = dispatchIronDustRamProbe(before, ram(targetId));
    const legacy = legacyRam(before, targetId);
    assert.deepEqual(plain(result.state.units), legacy.units);
    assert.equal(result.state.selectedUnitId, legacy.selectedUnitId);
    assert.deepEqual(result.events, [{type: 'RamResolved', actorId: 'ogre', targetId,
      from: {x: 1, y: 5}, to, path: legacy.path,
      targetHp: 0, actorHp: 5, rngState: 5}]);
    assert.equal(legacy.victoryChecks, 1); // Deliberately separate from the probe.
    assert.equal(result.state.rng.state, 5);
    assert.equal(validateIronDustRamProbe(plain(result.state)).rammed, true);
    assert.deepEqual(dispatchIronDustRamProbe(result.state, ram(targetId)),
      {error: {code: 'RAM_ACTION_SPENT'}});
    assert.equal(JSON.stringify(before), JSON.stringify(createIronDustRamProbe(5, {fixture})));
  }
});

test('phase, action, core and position boundaries reject without mutating state or RNG', () => {
  const cases = [
    [{fixture: 'source'}, 'guard', 'RAM_PATH_BLOCKED'],
    [{fixture: 'near-core'}, 'core', 'RAM_CORE_FORBIDDEN'],
    [{fixture: 'near-guard', turnPhase: 'fire'}, 'guard', 'RAM_WRONG_PHASE'],
    [{fixture: 'near-guard', turnPhase: 'gev'}, 'guard', 'RAM_WRONG_PHASE'],
    [{fixture: 'near-guard', moved: true}, 'guard', 'RAM_ACTION_SPENT'],
    [{fixture: 'near-guard'}, 'infantry', 'RAM_TARGET_INVALID'],
    [{fixture: 'near-guard'}, 'missing', 'RAM_TARGET_INVALID']
  ];
  for (const [options, targetId, code] of cases) {
    const state = createIronDustRamProbe(5, options), before = JSON.stringify(state);
    const legacy = targetId === 'guard' || targetId === 'core' ? legacyRam(state, targetId) : null;
    assert.deepEqual(queryIronDustRamProbe(state, targetId), {available: false, error: {code}});
    assert.deepEqual(dispatchIronDustRamProbe(state, ram(targetId)), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
    if (legacy) assert.deepEqual(legacy.units, plain(state.units));
  }
});

test('tampering and unsupported commands are rejected without mutation', () => {
  assert.throws(() => createIronDustRamProbe(-1), {code: 'RAM_PROBE_SETUP_INVALID'});
  assert.throws(() => createIronDustRamProbe(5, {fixture: 'invented'}),
    {code: 'RAM_PROBE_SETUP_INVALID'});
  for (const change of [
    state => {state.sourceRuleProfileId = 'FULL_CATALOG_v1'},
    state => {state.units.find(unit => unit.id === 'ogre').move = 9},
    state => {state.units.find(unit => unit.id === 'guard').hp = 0},
    state => {state.rng.state++}
  ]) {
    const state = plain(createIronDustRamProbe(5, {fixture: 'near-guard'}));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => dispatchIronDustRamProbe(state, ram('guard')),
      {code: 'RAM_PROBE_MISMATCH'});
    assert.equal(JSON.stringify(state), before);
  }
  const state = createIronDustRamProbe(5, {fixture: 'near-guard'});
  const before = JSON.stringify(state);
  assert.deepEqual(dispatchIronDustRamProbe(state, {type: 'Fire', targetId: 'guard'}),
    {error: {code: 'RAM_COMMAND_UNSUPPORTED'}});
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
