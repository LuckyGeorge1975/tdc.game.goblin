import {lifeGlobals} from './helpers/unit-life-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustSystemProbe, validateIronDustSystemProbe,
  queryIronDustSystemProbe, dispatchIronDustSystemProbe} from '../src/core/iron-dust-system-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const source = IRON_DUST_CORE_DATA_V1.units.find(unit => unit.id === 'ogre');
const hit = (targetKey, attackerId = 'guard') => ({type: 'ResolveSystemAttack', attackerId, targetKey});

function legacy() {
  const context = vm.createContext({...lifeGlobals,units: [], showUnitInfo() {}, draw() {},
    Math: Object.assign(Object.create(Math), {random: () => 0}),
    terrainTypeAt: () => 'open-ground'});
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  const crtStart = game.indexOf('const COMBAT_RULES='), crtEnd = game.indexOf(';const units', crtStart);
  assert.ok(crtStart >= 0 && crtEnd > crtStart);
  const functionStart = game.indexOf('function combatRatio('), opening = game.indexOf('{', functionStart);
  assert.ok(functionStart >= 0 && opening > functionStart);
  let depth = 0, functionEnd = -1;
  for (let i = opening; i < game.length; i++) {
    if (game[i] === '{') depth++;
    if (game[i] === '}' && --depth === 0) {functionEnd = i + 1; break;}
  }
  assert.ok(functionEnd > opening);
  vm.runInContext(`${game.slice(crtStart, crtEnd + 1)}\n${game.slice(functionStart, functionEnd)}`, context);
  for (const name of ['terrain-rules.js', 'ogre-systems.js', 'ogre-runtime.js'])
    vm.runInContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), context);
  return context;
}

test('system probe is an exact inactive IRON DUST snapshot and cannot enter Core or replay', () => {
  const sourceBefore = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustSystemProbe(5);
  assert.deepEqual(plain(state.unit), plain(source));
  assert.equal(validateIronDustSystemProbe(plain(state)).probeVersion, state.probeVersion);
  assert.deepEqual(queryIronDustSystemProbe(state), {
    targets: ['main', 'secondary', 'missiles', 'antipersonnel', 'treads'],
    treads: 45, movement: 3, hp: 5, helpless: false,
    weapons: {main: 1, secondary: 4, missiles: 2, antipersonnel: 8}
  });
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), sourceBefore);
});

test('fixed seed NE, D and X vectors match Legacy resolution and system effects', () => {
  const context = legacy();
  for (const [seed, roll, result, loss, remaining] of [
    [0, 1, 'NE', 0, 2], [2, 5, 'X', 1, 1], [3, 4, 'D', 0, 2]
  ]) {
    const event = dispatchIronDustSystemProbe(createIronDustSystemProbe(seed),
      {type: 'ResolveSystemAttack', attackerId: 'guard'}).events[0];
    assert.deepEqual(event, {type: 'SystemAttackResolved', attackerId: 'guard',
      targetKey: 'missiles', ratio: '1-2', roll, result, loss, remaining,
      movement: 3, hp: 5, helpless: false});
  }
  for (const targetKey of ['main', 'secondary', 'missiles', 'antipersonnel', 'treads']) {
    const found = new Set();
    for (let seed = 0; seed < 100 && found.size < (targetKey === 'treads' ? 2 : 3); seed++) {
      const before = createIronDustSystemProbe(seed), command = hit(targetKey);
      const {state, events} = dispatchIronDustSystemProbe(before, command);
      const event = events[0];
      if (found.has(event.result)) continue;
      found.add(event.result);
      const unit = plain(before.unit);
      const attacker = IRON_DUST_CORE_DATA_V1.units.find(u => u.id === command.attackerId);
      context.Math.random = () => event.roll / 6;
      const actual = context.GoblinOgreRuntime.resolveSystemAttack(attacker, unit, targetKey);
      for (const key of ['ratio', 'roll', 'result', 'loss', 'remaining'])
        assert.equal(event[key], actual[key], `${targetKey}/${seed}/${key}`);
      assert.deepEqual(plain(state.unit), unit, `${targetKey}/${seed}`);
      assert.equal(state.rng.state, (Math.imul(1664525, seed) + 1013904223) >>> 0);
      if (event.result === 'D') assert.equal(event.loss, 0);
    }
    assert.equal(found.size, targetKey === 'treads' ? 2 : 3, targetKey);
  }
});

test('tread thresholds and helplessness match Legacy across a deterministic trace', () => {
  const context = legacy();
  let state = createIronDustSystemProbe(5), legacyUnit = plain(state.unit);
  const crossed = new Set();
  for (let attempt = 0; attempt < 180 && state.unit.ogreSystems.treads > 0; attempt++) {
    const command = hit('treads'), result = dispatchIronDustSystemProbe(state, command);
    const event = result.events[0];
    context.Math.random = () => event.roll / 6;
    const actual = context.GoblinOgreRuntime.resolveSystemAttack(
      IRON_DUST_CORE_DATA_V1.units.find(u => u.id === 'guard'), legacyUnit, 'treads');
    assert.equal(event.loss, actual.loss);
    assert.deepEqual(plain(result.state.unit), legacyUnit);
    state = result.state;
    for (const n of [31, 16, 1, 0]) if (state.unit.ogreSystems.treads === n) crossed.add(n);
    assert.equal(queryIronDustSystemProbe(state).movement,
      state.unit.ogreSystems.treads >= 31 ? 3 : state.unit.ogreSystems.treads >= 16 ? 2 :
        state.unit.ogreSystems.treads > 0 ? 1 : 0);
  }
  assert.deepEqual([...crossed].sort((a, b) => a - b), [0, 1, 16, 31]);
  assert.equal(state.unit.hp, 5); // Lost treads alone are not helplessness.
  for (const key of ['main', 'secondary', 'missiles', 'antipersonnel']) {
    while (queryIronDustSystemProbe(state).weapons[key] > 0) {
      const command = hit(key), result = dispatchIronDustSystemProbe(state, command), event = result.events[0];
      context.Math.random = () => event.roll / 6;
      context.GoblinOgreRuntime.resolveSystemAttack(
        IRON_DUST_CORE_DATA_V1.units.find(u => u.id === 'guard'), legacyUnit, key);
      assert.deepEqual(plain(result.state.unit), legacyUnit);
      state = result.state;
    }
  }
  assert.deepEqual(queryIronDustSystemProbe(state), {
    targets: ['treads'], treads: 0, movement: 0, hp: 0, helpless: true,
    weapons: {main: 0, secondary: 0, missiles: 0, antipersonnel: 0}
  });
  assert.deepEqual(dispatchIronDustSystemProbe(state, hit('treads')),
    {error: {code: 'SYSTEM_TARGET_HELPLESS'}});
});

test('rejections and tampered state preserve input and RNG', () => {
  assert.throws(() => createIronDustSystemProbe(-1), {code: 'SYSTEM_PROBE_SEED_INVALID'});
  for (const change of [
    state => {state.probeVersion = 'other'},
    state => {state.sourceRuleProfileId = 'FULL_CATALOG_v1'},
    state => {state.unit.ogreSystems.weapons.main.defense = 9},
    state => {delete state.unit.ogreSystems.weapons},
    state => {state.unit.ogreSystems.treads = 99},
    state => {state.unit.move = 2},
    state => {state.rng.state = -1}
  ]) {
    const state = plain(createIronDustSystemProbe(5)); change(state);
    const before = JSON.stringify(state);
    assert.throws(() => dispatchIronDustSystemProbe(state, hit('main')),
      {code: 'SYSTEM_PROBE_MISMATCH'});
    assert.equal(JSON.stringify(state), before);
  }
  const state = createIronDustSystemProbe(5), before = JSON.stringify(state);
  for (const [command, code] of [
    [{type: 'Fire', targetId: 'ogre'}, 'SYSTEM_COMMAND_UNSUPPORTED'],
    [{type: 'ResolveSystemAttack', attackerId: 'unknown', targetKey: 'main'}, 'SYSTEM_ATTACKER_INVALID'],
    [{type: 'ResolveSystemAttack', attackerId: 'core', targetKey: 'main'}, 'SYSTEM_ATTACKER_INVALID'],
    [hit('unknown'), 'SYSTEM_TARGET_INVALID'],
    [null, 'SYSTEM_COMMAND_UNSUPPORTED']
  ]) {
    assert.deepEqual(dispatchIronDustSystemProbe(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
