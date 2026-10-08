import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, dispatch} from '../src/core/game-core.mjs';
import {artilleryCoreProbeScenario} from
  '../src/core/artillery-spotter-core-probe.mjs';
import {recordProfileReplay, validateProfileReplay} from
  '../src/core/replay-contract.mjs';
import {recordSiegeTankProbeReplay, validateSiegeTankProbeReplay} from
  '../src/core/siege-tank-probe-replay.mjs';
import {recordArtillerySpotterProbeReplay as record,
  validateArtillerySpotterProbeReplay as validate,
  playArtillerySpotterProbeReplay as play} from
  '../src/core/artillery-spotter-probe-replay.mjs';

const seed = 7;
const battery = 'long-range-battery', mobile = 'mobile-siege-gun';
const copy = value => JSON.parse(JSON.stringify(value));
const end = playerId => ({type: 'EndPhase', playerId});
const fire = (unitId, targetId, mode = 'direct', spotterId = null) =>
  ({type: 'FireArtillery', playerId: 'player', unitId, targetId, mode, spotterId});
const commands = [end('player'),
  fire(battery, 'battery-near'), fire(mobile, 'mobile-near'),
  end('player'), end('player'), end('enemy'), end('enemy'), end('enemy'),
  end('player'),
  fire(battery, 'battery-far', 'indirect', 'battery-spotter'),
  fire(mobile, 'mobile-far', 'indirect', 'mobile-spotter')];
function direct(sequence) {
  let state = createGame(copy(artilleryCoreProbeScenario), seed);
  const initialState = copy(state), steps = [];
  for (const command of sequence) {
    const result = dispatch(state, command);
    assert.ok(result.state, JSON.stringify(result.error));
    state = result.state;
    steps.push({command, events: result.events, state: copy(state)});
  }
  return {initialState, steps, finalState: copy(state)};
}
function reject(replay, code = 'ARTILLERY_REPLAY_MISMATCH') {
  const before = JSON.stringify(replay);
  assert.throws(() => validate(replay), {code});
  assert.throws(() => play(replay), {code});
  assert.equal(JSON.stringify(replay), before);
}

test('U08/U09 direct and indirect JSON replays preserve events, RNG and fired reset', () => {
  const replay = record(seed, commands);
  assert.equal(replay.executable, false);
  const encoded = JSON.stringify(replay);
  assert.equal(JSON.stringify(validate(JSON.parse(encoded))), encoded);
  const first = play(JSON.parse(encoded)), second = play(JSON.parse(encoded));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first, direct(commands));
  assert.deepEqual(first.initialState.rng, {seed: 7, state: 7});
  for (const [index, actor, mode, spotter] of [
    [1, battery, 'direct', null], [2, mobile, 'direct', null],
    [9, battery, 'indirect', 'battery-spotter'],
    [10, mobile, 'indirect', 'mobile-spotter']
  ]) {
    const step = first.steps[index], previous = first.steps[index - 1].state;
    assert.equal(step.events.length, 1);
    assert.deepEqual([step.events[0].type, step.events[0].attackerId,
      step.events[0].mode, step.events[0].spotterId, step.events[0].attack],
    ['ShotResolved', actor, mode, spotter, 6]);
    assert.equal(step.state.rng.state,
      (Math.imul(1664525, previous.rng.state) + 1013904223) >>> 0);
    assert.equal(step.state.artilleryFire[actor].fired, true);
  }
  for (const actor of [battery, mobile]) {
    assert.equal(first.steps[8].state.artilleryFire[actor].turn, 2);
    assert.equal(first.steps[8].state.artilleryFire[actor].fired, false);
  }
});

test('U09 mobile move and direct fire survive a separate exact replay', () => {
  const sequence = [{type: 'Move', playerId: 'player', unitId: mobile,
    to: {x: 0, y: 3}}, end('player'), fire(mobile, 'mobile-near')];
  const encoded = JSON.stringify(record(seed, sequence));
  assert.deepEqual(play(JSON.parse(encoded)), direct(sequence));
  assert.equal(JSON.stringify(play(JSON.parse(encoded))),
    JSON.stringify(play(JSON.parse(encoded))));
});

test('U08/U09 negative spotter, LOS and target traces reject before playback', () => {
  for (const [actor, near, far, self] of [
    [battery, 'battery-near', 'battery-far', battery],
    [mobile, 'mobile-near', 'mobile-far', mobile]
  ]) {
    assert.throws(() => record(seed, [end('player'), fire(actor, far)]),
      {code: 'ARTILLERY_REPLAY_COMMAND_REJECTED'});
    assert.throws(() => record(seed, [end('player'),
      fire(actor, far, 'indirect', self)]),
    {code: 'ARTILLERY_REPLAY_COMMAND_REJECTED'});
    assert.throws(() => record(seed, [end('player'),
      fire(actor, 'missing')]), {code: 'ARTILLERY_REPLAY_MISMATCH'});
    assert.throws(() => record(seed, [end('player'),
      fire(actor, near, 'blind', null)]), {code: 'ARTILLERY_REPLAY_MISMATCH'});
  }
});

test('tampered profile, snapshot, mode, spotter, target and order fail closed', () => {
  const replay = record(seed, commands);
  for (const mutate of [
    r => {r.replayVersion = 'schema-1'},
    r => {r.executable = true},
    r => {r.header.rulesVersion = 'core-v3'},
    r => {r.header.scenarioVersion = 'old'},
    r => {r.header.ruleProfileId = 'FULL_CATALOG'},
    r => {r.header.resolverVersion = 'old'},
    r => {r.header.dataVersion = 'old'},
    r => {r.header.dataDigest = 'fnv1a64:0000000000000000'},
    r => {r.header.effectiveRules.batteryRange = 9},
    r => {r.header.initialStateDigest = 'fnv1a64:0000000000000000'},
    r => {r.initialScenario.units[0].damage = 7},
    r => {r.initialSeed = 8},
    r => {r.initialSeed = -1},
    r => {r.commands[9].mode = 'direct'},
    r => {r.commands[9].spotterId = 'mobile-spotter'},
    r => {r.commands[9].targetId = 'battery-near'},
    r => {[r.commands[9], r.commands[10]] = [r.commands[10], r.commands[9]]},
    r => {r.commandsDigest = 'fnv1a64:0000000000000000'},
    r => {r.traceDigest = 'fnv1a64:0000000000000000'},
    r => {r.extra = true}
  ]) {
    const altered = copy(replay);
    mutate(altered);
    reject(altered);
  }
  const wrongPhase = copy(replay);
  wrongPhase.commands[0] = fire(battery, 'battery-near');
  reject(wrongPhase);
});

test('schema-1 and U07 replay contracts remain separate', () => {
  const replay = record(seed, commands);
  assert.throws(() => validateProfileReplay(replay),
    {code: 'UNSUPPORTED_REPLAY_VERSION'});
  assert.throws(() => validateSiegeTankProbeReplay(replay),
    {code: 'SIEGE_REPLAY_MISMATCH'});
  assert.throws(() => recordSiegeTankProbeReplay(seed, commands),
    {code: 'SIEGE_REPLAY_MISMATCH'});
  assert.throws(() => recordProfileReplay(artilleryCoreProbeScenario, seed,
    commands), {code: 'REPLAY_PROFILE_MISMATCH'});
});
