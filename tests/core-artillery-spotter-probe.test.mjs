import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame, dispatch, queryCommand, queryActions, queryArtilleryActions,
  queryAreas} from '../src/core/game-core.mjs';
import {CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT, CORE_PROFILE_CONTRACT}
  from '../src/core/profile-contract.mjs';
import {ARTILLERY_CORE_PROBE_DATA, artilleryCoreProbeScenario}
  from '../src/core/artillery-spotter-core-probe.mjs';
import {phaseScenario} from '../src/core/phase-fixture.mjs';
import {recordProfileReplay, validateProfileReplay} from '../src/core/replay-contract.mjs';
import {recordSiegeTankProbeReplay} from '../src/core/siege-tank-probe-replay.mjs';

const seed = 7;
const battery = 'long-range-battery', mobile = 'mobile-siege-gun';
const start = () => createGame(structuredClone(artilleryCoreProbeScenario), seed);
const end = playerId => ({type: 'EndPhase', playerId});
const fire = (unitId, targetId, mode = 'direct', spotterId = null) =>
  ({type: 'FireArtillery', playerId: 'player', unitId, targetId, mode, spotterId});
const firePhase = () => dispatch(start(), end('player')).state;
const accepted = (state, command) => {
  assert.deepEqual(queryCommand(state, command), {available: true});
  const result = dispatch(state, command);
  assert.ok(result.state);
  return result;
};
const rejected = (state, command, code) => {
  const before = JSON.stringify(state);
  const result = dispatch(state, command);
  assert.equal(result.error?.code, code);
  assert.deepEqual(queryCommand(state, command), {available: false, error: result.error});
  assert.equal(JSON.stringify(state), before);
};

test('versioned inactive data and fixed two-actor scenario are exact', () => {
  const source = JSON.parse(readFileSync(new URL(
    '../assets/unit-art/rules/unit-profiles.v1.json', import.meta.url), 'utf8'));
  assert.equal(source.targetActive, false);
  for (const id of [battery, mobile])
    assert.deepEqual(ARTILLERY_CORE_PROBE_DATA.units[id].target, source.units[id].target);
  const state = start();
  assert.deepEqual(state.effectiveRules, CORE_ARTILLERY_SPOTTER_PROBE_CONTRACT.effectiveRules);
  assert.equal(Object.isFrozen(state.effectiveRules), true);
  assert.deepEqual(Object.keys(state.artilleryFire).sort(), [battery, mobile].sort());
  assert.equal(state.artilleryFire[battery].forceBudgetValue, 2);
  assert.equal(state.artilleryFire[mobile].forceBudgetValue, 2);
  assert.equal(Object.hasOwn(state.artilleryFire[battery], 'setupTurnsRemaining'), false);
  for (const mutate of [
    s => {s.ruleProfileId = 'FULL_CATALOG_v1'},
    s => {s.effectiveRules.sourceTargetActive = true},
    s => {s.effectiveRules.batteryRange = 7},
    s => {s.units[0].range = 6},
    s => {s.map.terrain = []}
  ]) {
    const scenario = structuredClone(artilleryCoreProbeScenario);
    mutate(scenario);
    assert.throws(() => createGame(scenario, seed));
  }
});

test('P1: both direct A6 shots need shooter LOS and one roll; mobile fires after moving', () => {
  let state = firePhase();
  const first = accepted(state, fire(battery, 'battery-near'));
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].attack, 6);
  assert.equal(first.events[0].mode, 'direct');
  assert.equal(first.events[0].spotterId, null);
  assert.equal(first.events[0].roll, 0);
  state = first.state;
  const second = accepted(state, fire(mobile, 'mobile-near'));
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].roll, 3);
  assert.equal(second.state.artilleryFire[battery].fired, true);
  assert.equal(second.state.artilleryFire[mobile].fired, true);
  rejected(second.state, fire(battery, 'battery-far', 'indirect', 'battery-spotter'),
    'WEAPON_SPENT');
  let moved = start();
  moved = accepted(moved, {type: 'Move', playerId: 'player',
    unitId: mobile, to: {x: 0, y: 3}}).state;
  moved = accepted(moved, end('player')).state;
  assert.equal(accepted(moved, fire(mobile, 'mobile-near')).events[0].attack, 6);
  const clear = structuredClone(firePhase());
  clear.map.terrain = [];
  assert.equal(accepted(clear, fire(battery, 'battery-far')).events[0].range, 8);
  assert.equal(accepted(clear, fire(mobile, 'mobile-far')).events[0].range, 6);
});

test('P2: blocked shooter LOS uses named allied spotter at exact R8/R6', () => {
  const initial = firePhase();
  rejected(initial, fire(battery, 'battery-far'), 'DIRECT_LOS_REQUIRED');
  rejected(initial, fire(mobile, 'mobile-far'), 'DIRECT_LOS_REQUIRED');
  const a = accepted(initial, fire(battery, 'battery-far', 'indirect', 'battery-spotter'));
  assert.equal(a.events.length, 1);
  assert.equal(a.events[0].spotterId, 'battery-spotter');
  assert.equal(a.events[0].mode, 'indirect');
  assert.equal(a.events[0].attack, 6);
  assert.equal(a.events[0].range, 8);
  assert.equal(a.events[0].roll, 0);
  assert.equal(Object.hasOwn(a.events[0], 'splash'), false);
  assert.deepEqual(a.state.units.find(u => u.id === 'battery-near'),
    initial.units.find(u => u.id === 'battery-near'));
  assert.equal(a.state.artilleryFire[mobile].fired, false);
  const b = accepted(a.state, fire(mobile, 'mobile-far', 'indirect', 'mobile-spotter'));
  assert.equal(b.events.length, 1);
  assert.equal(b.events[0].range, 6);
  assert.equal(b.events[0].roll, 3);
  assert.equal(b.state.artilleryFire[mobile].fired, true);
  const direct = structuredClone(initial);
  direct.map.terrain = [];
  assert.equal(accepted(direct, fire(battery, 'battery-far')).state.rng.state,
    a.state.rng.state);
  const options = queryArtilleryActions(initial, battery);
  assert.equal(options.find(o => o.targetId === 'battery-far' &&
    o.mode === 'direct').reason, 'DIRECT_LOS_REQUIRED');
  assert.equal(options.find(o => o.targetId === 'battery-far' &&
    o.spotterId === 'battery-spotter').available, true);
  assert.equal(queryActions(initial, battery).units[battery].fire.available, true);
  assert.deepEqual(queryAreas(initial, battery).attackableTargets, []);
});

test('P3: own-turn reset and complete snapshot undo reproduce state, event and RNG', () => {
  let state = firePhase();
  const snapshot = structuredClone(state);
  const first = accepted(state, fire(battery, 'battery-far', 'indirect', 'battery-spotter'));
  assert.deepEqual(accepted(structuredClone(snapshot),
    fire(battery, 'battery-far', 'indirect', 'battery-spotter')), first);
  assert.deepEqual(state, snapshot);
  state = accepted(first.state, fire(mobile, 'mobile-far', 'indirect', 'mobile-spotter')).state;
  for (const playerId of ['player', 'player', 'enemy', 'enemy']) {
    state = accepted(state, end(playerId)).state;
    assert.equal(state.artilleryFire[battery].turn, 1);
    assert.equal(state.artilleryFire[mobile].turn, 1);
  }
  state = accepted(state, end('enemy')).state;
  assert.equal(state.turn, 2);
  for (const id of [battery, mobile]) {
    assert.equal(state.artilleryFire[id].turn, 2);
    assert.equal(state.artilleryFire[id].fired, false);
  }
});

test('N1: invalid spotter state, identity and LOS cannot yield indirect fire', () => {
  const ready = firePhase();
  for (const spotterId of [null, 'missing', battery, 'battery-far']) {
    const command = fire(battery, 'battery-far', 'indirect', spotterId);
    rejected(ready, command, spotterId === null ? 'INVALID_COMMAND' :
      'VALID_SPOTTER_REQUIRED');
  }
  for (const [change, code] of [
    [s => {s.units.find(u => u.id === 'battery-spotter').hp = 0},
      'VALID_SPOTTER_REQUIRED'],
    [s => {s.units.find(u => u.id === 'battery-spotter').disabled = true},
      'VALID_SPOTTER_REQUIRED'],
    [s => {s.units.find(u => u.id === 'battery-spotter').team = 'enemy'},
      'VALID_SPOTTER_REQUIRED'],
    [s => {s.units.find(u => u.id === 'battery-spotter').embarkedOn = 'carrier'},
      'VALID_SPOTTER_REQUIRED'],
    [s => {s.units.find(u => u.id === 'mobile-spotter').x = 5;
      s.units.find(u => u.id === 'mobile-spotter').y = 0},
      'VALID_SPOTTER_REQUIRED'],
    [s => {s.map.terrain.push({x: 6, y: 0, type: 'forest'})},
      'VALID_SPOTTER_REQUIRED']
  ]) {
    const state = structuredClone(ready);
    change(state);
    rejected(state, fire(battery, 'battery-far', 'indirect', 'battery-spotter'), code);
  }
  const mobileBad = structuredClone(ready);
  mobileBad.units.find(u => u.id === 'mobile-spotter').disabled = true;
  rejected(mobileBad, fire(mobile, 'mobile-far', 'indirect', 'mobile-spotter'),
    'VALID_SPOTTER_REQUIRED');
  rejected(ready, {...fire(battery, 'battery-far'), spotterId: 'battery-spotter'},
    'INVALID_COMMAND');
});

test('N2: range, occupancy, actor, target, phase, profile and state fail closed', () => {
  const ready = firePhase();
  rejected(start(), fire(battery, 'battery-near'), 'WRONG_PHASE');
  rejected(ready, {...fire(battery, 'battery-near'), playerId: 'enemy'},
    'NOT_ACTIVE_TEAM');
  rejected(ready, {...fire(battery, 'battery-near'), distance: 1}, 'INVALID_COMMAND');
  rejected(ready, fire(battery, 'missing'), 'INVALID_TARGET');
  rejected(ready, fire(battery, battery), 'INVALID_TARGET');
  for (const [change, command, code] of [
    [s => {s.units.find(u => u.id === battery).hp = 0},
      fire(battery, 'battery-near'), 'UNIT_DESTROYED'],
    [s => {s.units.find(u => u.id === battery).disabled = true},
      fire(battery, 'battery-near'), 'UNIT_DISABLED'],
    [s => {s.units.find(u => u.id === battery).embarkedOn = 'carrier'},
      fire(battery, 'battery-near'), 'UNIT_EMBARKED'],
    [s => {s.units.find(u => u.id === 'battery-near').hp = 0},
      fire(battery, 'battery-near'), 'INVALID_TARGET'],
    [s => {s.units.find(u => u.id === 'battery-near').team = 'player'},
      fire(battery, 'battery-near'), 'INVALID_TARGET'],
    [s => {s.units.find(u => u.id === 'battery-near').embarkedOn = 'carrier'},
      fire(battery, 'battery-near'), 'INVALID_TARGET'],
    [s => {s.units.find(u => u.id === 'mobile-near').x = 1;
      s.units.find(u => u.id === 'mobile-near').y = 0},
      fire(battery, 'battery-near'), 'INVALID_TARGET'],
    [s => {s.units.find(u => u.id === 'battery-far').y = 1},
      fire(battery, 'battery-far', 'indirect', 'battery-spotter'),
      'TARGET_OUT_OF_RANGE'],
    [s => {s.units.find(u => u.id === 'mobile-far').x = 7},
      fire(mobile, 'mobile-far', 'indirect', 'mobile-spotter'),
      'TARGET_OUT_OF_RANGE']
  ]) {
    const state = structuredClone(ready);
    change(state);
    rejected(state, command, code);
  }
  const corrupt = structuredClone(ready);
  corrupt.artilleryFire[battery].fired = 'yes';
  rejected(corrupt, fire(battery, 'battery-near'), 'INVALID_ARTILLERY_STATE');
  rejected(ready, {type: 'Fire', playerId: 'player', unitId: battery,
    targetId: 'battery-near'}, 'UNSUPPORTED_COMMAND');
  rejected(ready, {type: 'FireWeapon', playerId: 'player', unitId: battery,
    targetId: 'battery-near', weaponId: 'main-1'}, 'UNSUPPORTED_COMMAND');
  const legacy = createGame(structuredClone(phaseScenario), seed);
  rejected(legacy, fire(battery, 'battery-near'), 'UNSUPPORTED_COMMAND');
});

test('schema-1 and U07 probe replays reject FireArtillery', () => {
  assert.throws(() => recordSiegeTankProbeReplay(seed,
    [fire(battery, 'battery-near')]), {code: 'SIEGE_REPLAY_MISMATCH'});
  const v3 = recordProfileReplay({...structuredClone(phaseScenario),
    ...structuredClone(CORE_PROFILE_CONTRACT)}, seed, []);
  const changed = structuredClone(v3);
  changed.commands.push(fire(battery, 'battery-near'));
  assert.throws(() => validateProfileReplay(changed),
    {code: 'REPLAY_PROFILE_MISMATCH'});
});
