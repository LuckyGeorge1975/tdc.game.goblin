import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame, dispatch, queryCommand, queryActions, queryWeaponActions,
  queryAreas} from '../src/core/game-core.mjs';
import {CORE_PROFILE_CONTRACT, CORE_SIEGE_TANK_PROBE_CONTRACT} from '../src/core/profile-contract.mjs';
import {SIEGE_TANK_PROBE_DATA, siegeTankProbeScenario} from '../src/core/siege-tank-probe.mjs';
import {recordProfileReplay, validateProfileReplay} from '../src/core/replay-contract.mjs';
import {phaseScenario} from '../src/core/phase-fixture.mjs';

const seed = 7;
const start = () => createGame(structuredClone(siegeTankProbeScenario), seed);
const end = playerId => ({type: 'EndPhase', playerId});
const fire = (weaponId, targetId, playerId = 'player') =>
  ({type: 'FireWeapon', playerId, unitId: 'siege-tank', targetId, weaponId});
const firePhase = () => dispatch(start(), end('player')).state;
const available = (state, command) => queryCommand(state, command).available;
const shot = (state, command) => {
  assert.equal(available(state, command), true);
  const result = dispatch(state, command);
  assert.ok(result.state);
  return result;
};
const denied = (state, command, code) => {
  const before = JSON.stringify(state);
  assert.deepEqual(queryCommand(state, command),
    {available: false, error: dispatch(state, command).error});
  assert.equal(dispatch(state, command).error.code, code);
  assert.equal(JSON.stringify(state), before);
};

test('probe snapshot is exact, inactive, and bound to one catalog actor', () => {
  const source = JSON.parse(readFileSync(new URL(
    '../assets/unit-art/rules/unit-profiles.v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(SIEGE_TANK_PROBE_DATA.units['siege-tank'].target,
    source.units['siege-tank'].target);
  assert.equal(source.targetActive, false);
  const state = start();
  assert.deepEqual(state.effectiveRules, CORE_SIEGE_TANK_PROBE_CONTRACT.effectiveRules);
  assert.equal(Object.isFrozen(state.effectiveRules), true);
  assert.equal(Object.isFrozen(state.effectiveRules.weapons), true);
  assert.deepEqual(state.siegeTankFire.used, []);
  for (const mutate of [
    s => {s.ruleProfileId = 'FULL_CATALOG_v1'},
    s => {s.effectiveRules.sourceTargetActive = true},
    s => {s.effectiveRules.weapons.ap1 = 2},
    s => {s.units[0].damage = 7},
    s => {s.units[0].id = 'other'}
  ]) {
    const scenario = structuredClone(siegeTankProbeScenario);
    mutate(scenario);
    assert.throws(() => createGame(scenario, seed));
  }
});

test('P1: separate A3 targets and two A1 infantry attacks consume four rolls and reset next own turn', () => {
  let state = firePhase();
  const initialRng = state.rng.state;
  const commands = [
    fire('main-1', 'armor-a'), fire('main-2', 'armor-b'),
    fire('ap-1', 'infantry-a'), fire('ap-2', 'infantry-b')
  ];
  const attacks = [3, 3, 1, 1];
  const rolls = [];
  for (const [index, command] of commands.entries()) {
    const result = shot(state, command);
    assert.equal(result.events[0].attack, attacks[index]);
    assert.equal(result.events[0].weaponId, command.weaponId);
    rolls.push(result.events[0].roll);
    state = result.state;
  }
  assert.deepEqual(rolls, [0, 3, 4, 1]);
  assert.notEqual(state.rng.state, initialRng);
  assert.deepEqual(state.siegeTankFire.used, ['main-1', 'main-2', 'ap-1', 'ap-2']);
  denied(state, fire('ap-1', 'infantry-b'), 'WEAPON_SPENT');
  for (const playerId of ['player', 'player', 'enemy', 'enemy']) {
    state = shot(state, end(playerId)).state;
    assert.equal(state.siegeTankFire.turn, 1);
  }
  state = shot(state, end('enemy')).state;
  assert.equal(state.turn, 2);
  assert.equal(state.siegeTankFire.turn, 2);
  assert.deepEqual(state.siegeTankFire.used, []);
});

test('P2/P3: combined A6 is one event/roll; same main target is rejected but AP is independent', () => {
  const initial = firePhase();
  const both = shot(initial, fire('main-both', 'armor-a'));
  assert.equal(both.events.length, 1);
  assert.equal(both.events[0].attack, 6);
  assert.deepEqual(both.events[0].slots, ['main-1', 'main-2']);
  assert.deepEqual(both.state.siegeTankFire.used, ['main-1', 'main-2']);
  assert.equal(available(both.state, fire('ap-1', 'infantry-a')), true);
  denied(both.state, fire('main-1', 'armor-b'), 'WEAPON_SPENT');
  const one = shot(initial, fire('main-1', 'infantry-a')).state;
  assert.equal(both.state.rng.state, one.rng.state);
  denied(one, fire('main-2', 'infantry-a'), 'MAIN_TARGET_ALREADY_FIRED');
  assert.equal(available(one, fire('main-2', 'armor-b')), true);
  assert.equal(available(one, fire('ap-1', 'infantry-a')), true);
  const actions = queryWeaponActions(one, 'siege-tank');
  assert.equal(actions.find(a => a.weaponId === 'main-2' &&
    a.targetId === 'infantry-a').reason, 'MAIN_TARGET_ALREADY_FIRED');
  assert.equal(actions.find(a => a.weaponId === 'main-2' &&
    a.targetId === 'armor-b').available, true);
  assert.equal(queryActions(one, 'siege-tank').units['siege-tank'].fire.available, true);
  assert.deepEqual(queryAreas(one, 'siege-tank').attackableTargets, []);
});

test('N1/N2: profile, phase, team, actor, target, LOS, range and slot rejects preserve state/RNG', () => {
  const ready = firePhase();
  denied(start(), fire('main-1', 'armor-a'), 'WRONG_PHASE');
  denied(ready, fire('main-1', 'armor-a', 'enemy'), 'NOT_ACTIVE_TEAM');
  denied(ready, {type: 'Fire', playerId: 'player', unitId: 'siege-tank',
    targetId: 'armor-a'}, 'UNSUPPORTED_COMMAND');
  denied(ready, fire('ap-1', 'armor-a'), 'TARGET_NOT_ATTACKABLE');
  denied(ready, fire('main-1', 'enemy-core'), 'TARGET_NOT_ATTACKABLE');
  denied(ready, fire('main-1', 'missing'), 'INVALID_TARGET');
  denied(ready, fire('main-1', 'siege-tank'), 'INVALID_TARGET');
  denied(ready, {...fire('main-1', 'armor-a'), suppliedDistance: 1}, 'INVALID_COMMAND');
});

test('N2/N3: authoritative status/geometry and snapshot undo keep one RNG roll', () => {
  const ready = firePhase();
  for (const [mutate, code] of [
    [s => {s.units[0].hp = 0}, 'UNIT_DESTROYED'],
    [s => {s.units[0].disabled = true}, 'UNIT_DISABLED'],
    [s => {s.units[0].embarkedOn = 'carrier'}, 'UNIT_EMBARKED'],
    [s => {s.units[1].hp = 0}, 'INVALID_TARGET'],
    [s => {s.units[1].team = 'player'}, 'INVALID_TARGET'],
    [s => {s.map.terrain.push({x: 1, y: 1, type: 'forest'})}, 'TARGET_NOT_ATTACKABLE']
  ]) {
    const state = structuredClone(ready);
    mutate(state);
    denied(state, fire('main-1', 'armor-a'), code);
  }
  const corrupt = structuredClone(ready);
  corrupt.siegeTankFire.used = ['main-1'];
  denied(corrupt, fire('main-2', 'armor-b'), 'INVALID_SIEGE_TANK_STATE');
  const before = structuredClone(ready);
  const first = shot(ready, fire('main-both', 'armor-a'));
  const undone = structuredClone(before);
  const again = shot(undone, fire('main-both', 'armor-a'));
  assert.deepEqual(again, first);
  assert.deepEqual(ready, before);
  const old = createGame(structuredClone(phaseScenario), seed);
  denied(old, fire('main-1', 'armor-a'), 'UNSUPPORTED_COMMAND');
});

test('schema-1 replay rejects FireWeapon and probe profile before play', () => {
  assert.throws(() => recordProfileReplay(siegeTankProbeScenario, seed,
    [fire('main-1', 'armor-a')]), {code: 'REPLAY_PROFILE_MISMATCH'});
  const legacy = recordProfileReplay({...structuredClone(phaseScenario),
    ...structuredClone(CORE_PROFILE_CONTRACT)}, seed, []);
  const injected = structuredClone(legacy);
  injected.commands.push(fire('main-1', 'armor-a'));
  assert.throws(() => validateProfileReplay(injected), {code: 'REPLAY_PROFILE_MISMATCH'});
});
