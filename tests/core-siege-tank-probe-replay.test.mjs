import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, dispatch} from '../src/core/game-core.mjs';
import {siegeTankProbeScenario} from '../src/core/siege-tank-probe.mjs';
import {recordProfileReplay, validateProfileReplay} from
  '../src/core/replay-contract.mjs';
import {phaseScenario} from '../src/core/phase-fixture.mjs';
import {CORE_PROFILE_CONTRACT} from '../src/core/profile-contract.mjs';
import {recordSiegeTankProbeReplay as record,
  validateSiegeTankProbeReplay as validate,
  playSiegeTankProbeReplay as play} from
  '../src/core/siege-tank-probe-replay.mjs';

const seed = 7;
const copy = value => JSON.parse(JSON.stringify(value));
const fire = (weaponId, targetId) => ({type: 'FireWeapon',
  playerId: 'player', unitId: 'siege-tank', targetId, weaponId});
const end = playerId => ({type: 'EndPhase', playerId});
const commands = [end('player'), fire('main-both', 'armor-a'),
  fire('ap-1', 'infantry-a'), fire('ap-2', 'infantry-b'),
  end('player'), end('player'), end('enemy'), end('enemy'), end('enemy'),
  end('player'), fire('main-1', 'armor-b')];
const direct = () => {
  let state = createGame(copy(siegeTankProbeScenario), seed);
  const initialState = copy(state), steps = [];
  for (const command of commands) {
    const result = dispatch(state, command);
    assert.ok(result.state, JSON.stringify(result.error));
    state = result.state;
    steps.push({command, events: result.events, state: copy(state)});
  }
  return {initialState, steps, finalState: copy(state)};
};
const reject = (replay, code = 'SIEGE_REPLAY_MISMATCH') => {
  const before = JSON.stringify(replay);
  assert.throws(() => validate(replay), {code});
  assert.throws(() => play(replay), {code});
  assert.equal(JSON.stringify(replay), before);
};

test('internal replay preserves A6 one-roll bundle, slots and next-turn reset', () => {
  const replay = record(seed, commands);
  assert.equal(replay.executable, false);
  const encoded = JSON.stringify(replay);
  assert.equal(JSON.stringify(validate(JSON.parse(encoded))), encoded);
  const first = play(JSON.parse(encoded)), second = play(JSON.parse(encoded));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first, direct());
  assert.deepEqual(first.initialState.rng, {seed: 7, state: 7});
  const bundle = first.steps[1], before = first.steps[0];
  assert.equal(bundle.events.length, 1);
  assert.deepEqual([bundle.events[0].weaponId, bundle.events[0].attack,
    bundle.events[0].slots], ['main-both', 6, ['main-1', 'main-2']]);
  assert.equal(bundle.state.rng.state,
    (Math.imul(1664525, before.state.rng.state) + 1013904223) >>> 0);
  assert.deepEqual(bundle.state.siegeTankFire.used, ['main-1', 'main-2']);
  assert.deepEqual(first.steps[9].state.siegeTankFire.used, []);
  assert.equal(first.steps[9].state.siegeTankFire.turn, 2);
  assert.deepEqual(first.steps[10].state.siegeTankFire.used, ['main-1']);
  assert.equal(first.steps[10].state.turn, 2);
});

test('header, snapshot, seed, command and trace tampering fail before any playback', () => {
  const replay = record(seed, commands);
  for (const mutate of [
    r => {r.replayVersion = 'schema-1'},
    r => {r.executable = true},
    r => {r.header.rulesVersion = 'core-v3'},
    r => {r.header.scenarioId = 'other'},
    r => {r.header.ruleProfileId = 'FULL_CATALOG'},
    r => {r.header.resolverVersion = 'old'},
    r => {r.header.dataVersion = 'old'},
    r => {r.header.dataDigest = 'fnv1a64:0000000000000000'},
    r => {r.header.effectiveRules.weapons.mainBoth = 7},
    r => {r.header.initialStateDigest = 'fnv1a64:0000000000000000'},
    r => {r.initialScenario.units[0].damage = 7},
    r => {r.initialSeed = -1},
    r => {r.initialSeed = 8},
    r => {r.commands[1].weaponId = 'main-1'},
    r => {r.commands[1].targetId = 'armor-b'},
    r => {[r.commands[1], r.commands[2]] = [r.commands[2], r.commands[1]]},
    r => {r.commandsDigest = 'fnv1a64:0000000000000000'},
    r => {r.traceDigest = 'fnv1a64:0000000000000000'},
    r => {r.commands.push({type: 'Fire', playerId: 'player',
      unitId: 'siege-tank', targetId: 'armor-a'})},
    r => {r.extra = true}
  ]) {
    const altered = copy(replay);
    mutate(altered);
    reject(altered);
  }
  const invalidOrder = copy(replay);
  invalidOrder.commands[0] = fire('main-both', 'armor-a');
  reject(invalidOrder);
  assert.throws(() => record(seed, [fire('main-both', 'armor-a')]),
    {code: 'SIEGE_REPLAY_COMMAND_REJECTED'});
});

test('schema-1/core-v3 remains separate from the Siege Tank replay', () => {
  const replay = record(seed, commands);
  assert.throws(() => validateProfileReplay(replay),
    {code: 'UNSUPPORTED_REPLAY_VERSION'});
  assert.throws(() => recordProfileReplay(siegeTankProbeScenario, seed, commands),
    {code: 'REPLAY_PROFILE_MISMATCH'});
  const core = recordProfileReplay({...copy(phaseScenario),
    ...copy(CORE_PROFILE_CONTRACT)}, seed, []);
  const injected = copy(core);
  injected.commands.push(fire('main-both', 'armor-a'));
  assert.throws(() => validateProfileReplay(injected),
    {code: 'REPLAY_PROFILE_MISMATCH'});
});
