import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from '../src/core/iron-dust-legacy-los-probe.mjs';
import {hexDistance} from '../src/core/hex.mjs';
import {createIronDustWeaponProbe, validateIronDustWeaponProbe, queryIronDustWeapon,
  queryIronDustWeaponTarget, dispatchIronDustWeaponProbe} from '../src/core/iron-dust-weapon-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const select = weaponKey => ({type: 'SelectWeapon', weaponKey});
const spend = weaponKey => ({type: 'SpendWeaponBudget', weaponKey});
const reset = {type: 'ResetWeaponPhase'};
const source = IRON_DUST_CORE_DATA_V1.units.find(unit => unit.id === 'ogre');

function legacySystems() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../ogre-systems.js', import.meta.url), 'utf8'), context);
  return context.GoblinSystems;
}

function legacyTargetAllowed(systems) {
  const text = readFileSync(new URL('../siegebreaker-weapons.js', import.meta.url), 'utf8');
  const names = ['stateFor', 'targetAllowed'];
  const functions = names.map(name => {
    const start = text.indexOf(`function ${name}(`), opening = text.indexOf('{', start);
    assert.ok(start >= 0);
    let depth = 0;
    for (let i = opening; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
    }
    throw new Error(`unclosed Legacy function ${name}`);
  });
  const context = vm.createContext({GoblinSystems: systems, dist: hexDistance,
    lineOfSight: (a, b) => hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, a, b)});
  vm.runInContext(functions.join('\n'), context);
  return vm.runInContext('targetAllowed', context);
}

test('weapon probe owns the exact four Legacy weapon specs without enabling Core Fire or replay', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1), legacy = legacySystems();
  const state = createIronDustWeaponProbe(5);
  assert.equal(validateIronDustWeaponProbe(plain(state)).probeVersion, state.probeVersion);
  assert.deepEqual(plain(state.weapons), plain(source.ogreSystems.weapons));
  assert.deepEqual(Object.keys(state.weapons), ['main', 'secondary', 'missiles', 'antipersonnel']);
  assert.deepEqual(Object.fromEntries(Object.entries(state.weapons).map(([key, weapon]) =>
    [key, [weapon.attack, weapon.range, legacy.weaponReady(weapon)]])), {
    main: [4, 3, 1], secondary: [3, 2, 4], missiles: [6, 5, 2], antipersonnel: [1, 1, 8]
  });
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
});

test('range, infantry-only and readiness queries match the named Legacy target predicate', () => {
  const legacy = legacySystems(), targetAllowed = legacyTargetAllowed(legacy);
  const state = createIronDustWeaponProbe(5);
  const attacker = {id: 'ogre', team: 'player', x: source.x, y: source.y,
    ogreSystems: plain(source.ogreSystems)};
  const vectors = [
    ['main', {x: 2, y: 5, team: 'enemy', hp: 2}, true],
    ['main', {x: 10, y: 2, team: 'enemy', hp: 5}, false],
    ['secondary', {x: 2, y: 5, team: 'enemy', hp: 2}, true],
    ['secondary', {x: 0, y: 4, team: 'enemy', hp: 2}, false],
    ['missiles', {x: 2, y: 5, team: 'enemy', hp: 2}, true],
    ['antipersonnel', {x: 1, y: 4, team: 'enemy', hp: 2, infantry: true}, true],
    ['antipersonnel', {x: 1, y: 4, team: 'enemy', hp: 2, engineering: true}, true],
    ['antipersonnel', {x: 1, y: 4, team: 'enemy', hp: 2, infantry: false}, false],
    ['main', {x: 1, y: 4, team: 'player', hp: 2}, false]
  ];
  for (const [key, target, expected] of vectors) {
    assert.equal(!!targetAllowed(attacker, target, key), expected, key);
    assert.equal(queryIronDustWeaponTarget(state, key, target).available, expected, key);
  }
  assert.equal(queryIronDustWeaponTarget(state, 'antipersonnel',
    {x: 1, y: 4, team: 'enemy', hp: 2, infantry: false}).error.code, 'WEAPON_INFANTRY_ONLY');
  assert.equal(queryIronDustWeaponTarget(state, 'secondary',
    {x: 0, y: 4, team: 'enemy', hp: 2}).error.code, 'WEAPON_SIGHT_BLOCKED');
  assert.equal(queryIronDustWeapon(state, 'unknown').error.code, 'WEAPON_UNKNOWN');
});

test('per-weapon budgets, missile expenditure and reset match Legacy without a combat roll', () => {
  const legacy = legacySystems();
  const commands = [spend('main'), select('secondary'),
    ...Array.from({length: 4}, () => spend('secondary')),
    select('missiles'), spend('missiles'), spend('missiles'),
    select('antipersonnel'), spend('antipersonnel'), reset];
  const play = () => {
    let state = createIronDustWeaponProbe(5);
    const trace = [];
    for (const command of commands) {
      const result = dispatchIronDustWeaponProbe(state, command);
      assert.ok(result.state, JSON.stringify(result.error));
      trace.push({command, result});
      state = result.state;
    }
    return {trace, state};
  };
  const first = play(), second = play();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  const beforeReset = first.trace.at(-2).result.state;
  const legacyState = plain(source.ogreSystems);
  legacy.recordFire(legacyState.weapons.main);
  for (let i = 0; i < 4; i++) legacy.recordFire(legacyState.weapons.secondary);
  legacy.recordFire(legacyState.weapons.missiles);
  legacy.recordFire(legacyState.weapons.missiles);
  legacy.recordFire(legacyState.weapons.antipersonnel);
  assert.deepEqual(plain(beforeReset.weapons), legacyState.weapons);
  assert.deepEqual(Object.values(beforeReset.weapons).map(legacy.weaponReady), [0, 0, 0, 7]);
  legacy.resetFireState(legacyState);
  assert.deepEqual(plain(first.state.weapons), legacyState.weapons);
  assert.deepEqual(Object.values(first.state.weapons).map(legacy.weaponReady), [1, 4, 0, 8]);
  assert.equal(first.trace[0].result.events[0].type, 'WeaponBudgetSpent');
  assert.equal(first.state.rng.state, 5);
  assert.equal(first.state.cycle, 2);
});

test('invalid inventory and rejected commands leave state, events and RNG untouched', () => {
  assert.throws(() => createIronDustWeaponProbe(-1), {code: 'WEAPON_PROBE_SEED_INVALID'});
  for (const change of [
    state => {state.probeVersion = 'other'},
    state => {state.sourceRuleProfileId = 'FULL_CATALOG_v1'},
    state => {state.weapons.main.attack = 9},
    state => {state.weapons.missiles.remaining = 3},
    state => {state.rng.state++}
  ]) {
    const state = plain(createIronDustWeaponProbe(5));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => dispatchIronDustWeaponProbe(state, spend('main')),
      {code: 'WEAPON_PROBE_MISMATCH'});
    assert.equal(JSON.stringify(state), before);
  }
  let state = createIronDustWeaponProbe(5);
  for (const [command, code] of [
    [select('unknown'), 'WEAPON_UNKNOWN'],
    [spend('missiles'), 'WEAPON_NOT_SELECTED'],
    [{type: 'Fire', targetId: 'core'}, 'WEAPON_COMMAND_UNSUPPORTED'],
    [null, 'WEAPON_COMMAND_INVALID']
  ]) {
    const before = JSON.stringify(state);
    assert.deepEqual(dispatchIronDustWeaponProbe(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
  state = dispatchIronDustWeaponProbe(state, spend('main')).state;
  assert.deepEqual(dispatchIronDustWeaponProbe(state, spend('main')),
    {error: {code: 'WEAPON_NOT_READY'}});
  assert.equal(state.rng.state, 5);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
