import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustSystemProbe, dispatchIronDustSystemProbe} from '../src/core/iron-dust-system-probe.mjs';
import {createIronDustEnemySystemFireProbe, validateIronDustEnemySystemFireProbe,
  queryIronDustEnemySystemFireProbe, preflightIronDustEnemySystemFireProbe,
  dispatchIronDustEnemySystemFireProbe} from '../src/core/iron-dust-enemy-system-fire-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const fire = (targetKey = 'missiles', attackerId = 'guard') =>
  ({type: 'EnemySystemAttack', playerId: 'enemy', attackerId, targetId: 'ogre', targetKey});
const hit = targetKey => ({type: 'ResolveSystemAttack', attackerId: 'guard', targetKey});

function legacy() {
  const context = vm.createContext({units: [], showUnitInfo() {}, draw() {},
    Math: Object.assign(Object.create(Math), {random: () => 0}),
    terrainTypeAt: () => 'open-ground'});
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  const crtStart = game.indexOf('const COMBAT_RULES='), crtEnd = game.indexOf(';const units', crtStart);
  const start = game.indexOf('function combatRatio('), opening = game.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = opening; i < game.length; i++) {
    if (game[i] === '{') depth++;
    if (game[i] === '}' && --depth === 0) {end = i + 1; break}
  }
  assert.ok(start >= 0 && end > opening);
  vm.runInContext(`${game.slice(crtStart, crtEnd + 1)}\n${game.slice(start, end)}`, context);
  for (const name of ['terrain-rules.js', 'ogre-systems.js', 'ogre-runtime.js'])
    vm.runInContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), context);
  return context;
}

test('incoming system probe is versioned, inactive and leaves source and replay unchanged', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustEnemySystemFireProbe(5);
  assert.equal(validateIronDustEnemySystemFireProbe(plain(state)).probeVersion,
    state.probeVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.deepEqual(state.firedActorIds, []);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('fixed NE, D and X vectors equal Legacy system defense, event, state and RNG', () => {
  const context = legacy();
  const attacker = IRON_DUST_CORE_DATA_V1.units.find(unit => unit.id === 'guard');
  for (const [seed, roll, result, loss, remaining] of [
    [0, 1, 'NE', 0, 2], [3, 4, 'D', 0, 2], [2, 5, 'X', 1, 1]
  ]) {
    const initial = createIronDustEnemySystemFireProbe(seed), command = fire();
    const before = JSON.stringify(initial);
    const query = queryIronDustEnemySystemFireProbe(initial, command);
    assert.equal(query.available, true);
    assert.deepEqual(preflightIronDustEnemySystemFireProbe(initial, command), query);
    const {state, events: [event]} = dispatchIronDustEnemySystemFireProbe(initial, command);
    const legacyTarget = plain(initial.systemState.unit);
    context.Math.random = () => roll / 6;
    const actual = context.GoblinOgreRuntime.resolveSystemAttack(attacker, legacyTarget, 'missiles');
    assert.deepEqual(event, {type: 'EnemySystemFireResolved', attackerId: 'guard',
      targetId: 'ogre', targetKey: 'missiles', ratio: '1-2', roll, result,
      loss, remaining, movement: 3, hp: 5, helpless: false, turn: 1});
    for (const key of ['ratio', 'roll', 'result', 'loss', 'remaining'])
      assert.equal(event[key], actual[key]);
    assert.deepEqual(plain(state.systemState.unit), legacyTarget);
    assert.equal(state.systemState.rng.state,
      (Math.imul(1664525, seed) + 1013904223) >>> 0);
    assert.deepEqual(state.firedActorIds, ['guard']);
    assert.equal(JSON.stringify(initial), before);
  }
});

test('tread loss crosses movement threshold and destroyed systems are no longer targets', () => {
  let prior = createIronDustSystemProbe(1);
  while (prior.unit.ogreSystems.treads > 31)
    prior = dispatchIronDustSystemProbe(prior, hit('treads')).state;
  assert.equal(prior.unit.move, 3);
  const crossing = createIronDustEnemySystemFireProbe(1, {systemState: prior});
  const result = dispatchIronDustEnemySystemFireProbe(crossing, fire('treads'));
  assert.deepEqual([result.events[0].roll, result.events[0].result,
    result.events[0].loss, result.events[0].remaining, result.events[0].movement],
  [4, 'X', 1, 30, 2]);
  assert.equal(result.state.systemState.unit.move, 2);
  const context = legacy(), legacyTarget = plain(prior.unit);
  context.Math.random = () => 4 / 6;
  const actual = context.GoblinOgreRuntime.resolveSystemAttack(
    IRON_DUST_CORE_DATA_V1.units.find(unit => unit.id === 'guard'), legacyTarget, 'treads');
  assert.equal(actual.loss, result.events[0].loss);
  assert.deepEqual(plain(result.state.systemState.unit), legacyTarget);

  let destroyed = createIronDustSystemProbe(2);
  while (destroyed.unit.ogreSystems.weapons.missiles.destroyed < 2)
    destroyed = dispatchIronDustSystemProbe(destroyed, hit('missiles')).state;
  const later = createIronDustEnemySystemFireProbe(2, {systemState: destroyed});
  const before = JSON.stringify(later);
  assert.deepEqual(queryIronDustEnemySystemFireProbe(later, fire()),
    {available: false, error: {code: 'SYSTEM_TARGET_INVALID'}});
  assert.deepEqual(dispatchIronDustEnemySystemFireProbe(later, fire()),
    {error: {code: 'SYSTEM_TARGET_INVALID'}});
  assert.equal(queryIronDustEnemySystemFireProbe(later, fire('treads')).available, true);
  assert.equal(JSON.stringify(later), before);
});

test('wrong direction, phase, actor, range and spent action reject without state or RNG change', () => {
  const base = createIronDustEnemySystemFireProbe(5);
  const source = createIronDustEnemySystemFireProbe(5, {fixture: 'source'});
  const player = createIronDustEnemySystemFireProbe(5, {side: 'player', phase: 'fire'});
  const fired = dispatchIronDustEnemySystemFireProbe(base, fire()).state;
  for (const [state, command, code] of [
    [base, fire('unknown'), 'SYSTEM_TARGET_INVALID'],
    [base, fire('missiles', 'ghost'), 'SYSTEM_ATTACKER_INVALID'],
    [base, fire('missiles', 'core'), 'SYSTEM_ATTACKER_INVALID'],
    [base, {...fire(), targetId: 'gev'}, 'SYSTEM_TARGET_INVALID'],
    [base, {...fire(), weaponKey: 'main'}, 'FIRE_CONTRACT_COMMAND_INVALID'],
    [base, {...fire(), playerId: 'player'}, 'NOT_ACTIVE_TEAM'],
    [source, fire(), 'SYSTEM_OUT_OF_RANGE'],
    [player, {...fire(), playerId: 'player'}, 'WRONG_PHASE'],
    [player, {type: 'PlayerFire', playerId: 'player', unitId: 'ogre',
      targetId: 'guard', weaponKey: 'main'}, 'ENEMY_SYSTEM_COMMAND_INVALID'],
    [fired, fire(), 'ACTION_SPENT']
  ]) {
    const before = JSON.stringify(state), rng = state.systemState.rng.state;
    assert.deepEqual(queryIronDustEnemySystemFireProbe(state, command),
      {available: false, error: {code}});
    assert.deepEqual(preflightIronDustEnemySystemFireProbe(state, command),
      queryIronDustEnemySystemFireProbe(state, command));
    assert.deepEqual(dispatchIronDustEnemySystemFireProbe(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.systemState.rng.state, rng);
  }
  const changed = plain(base);
  changed.systemState.unit.ogreSystems.weapons.main.defense = 99;
  assert.throws(() => queryIronDustEnemySystemFireProbe(changed, fire()),
    {code: 'SYSTEM_PROBE_MISMATCH'});
});
