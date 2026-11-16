import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from
  './iron-dust-source-victory-trace.v2.mjs';
import {IRON_DUST_SOURCE_DEFEAT_TRACE_V2 as defeat} from
  './iron-dust-source-defeat-trace.v2.mjs';
import {recordProfileReplay, validateProfileReplay} from
  '../src/core/replay-contract.mjs';
import {createIronDustProfile,dispatchIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder,IRON_DUST_COMMIT_REPLAY_VERSION,
  validateIronDustProfileReplay as validate,
  playIronDustProfileReplay as play} from
  '../src/core/iron-dust-profile-replay.mjs';
import {recordIronDustCommands} from './helpers/iron-dust-commit-replay.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const end = {type: 'EndPhase', playerId: 'player'};
const auto = {type: 'AutoEnemyAdvance', playerId: 'enemy'};
const record = (seed, commands) => recordIronDustCommands(createIronDustProfile(seed), commands);
const commandsOf = oracle => oracle.commands ?? oracle.steps.map(step =>
  step.command === 'E' ? auto : end);
function check(oracle) {
  const commands = commandsOf(oracle);
  const recorded = record(oracle.seed, commands);
  assert.equal(recorded.replayVersion, IRON_DUST_COMMIT_REPLAY_VERSION);
  assert.equal(recorded.executable, false);
  assert.deepEqual(recorded.initialSnapshot, createIronDustProfile(oracle.seed));
  assert.equal(recorded.header.profileHeader.targetPolicyVersion,
    'skip-depleted-treads-v1');
  const encoded = JSON.stringify(recorded);
  assert.equal(JSON.stringify(validate(JSON.parse(encoded))), encoded);
  const first = play(JSON.parse(encoded)), second = play(JSON.parse(encoded));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.steps.length, commands.length);
  for (const [index, step] of first.steps.entries()) {
    const expected = oracle.steps[index];
    assert.deepEqual(step.events, expected.events);
    assert.equal(step.checkpoint.commandIndex, index);
    assert.equal(step.checkpoint.entryDigest, expected.state.digest);
    assert.equal(step.checkpoint.rngState, expected.state.rngState);
    assert.equal(step.state.state.rng.state, expected.state.rngState);
    assert.equal(step.state.mode, expected.state.mode);
  }
  assert.equal(first.finalState.state.victory.winner,
    oracle === victory ? 'player' : 'enemy');
  assert.deepEqual(first.checkpoints, recorded.checkpoints);
  return recorded;
}

test('current Seed8 victory commits replay twice with recorded events, RNG and terminal state', () => {
  const replay = check(victory);
  assert.equal(replay.commands.length, 21);
  assert.equal(replay.checkpoints.at(-1).mode, 'ended');
});

test('current Seed2 defeat commits replay twice with 989 exact source checkpoints', () => {
  const replay = check(defeat);
  assert.equal(replay.commands.length, 989);
  assert.equal(replay.checkpoints.at(-1).mode, 'ended');
});

test('authorized Ram, SelectWeapon and non-Ogre Fire remain replay commands', () => {
  const ogreMove = x => ({type: 'Move', playerId: 'player', unitId: 'ogre',
    to: {x, y: 2}});
  const round = x => [ogreMove(x), end, end, end,
    auto, auto, auto, auto, auto];
  const ram = {type: 'Ram', playerId: 'player', unitId: 'ogre',
    targetId: 'guard'};
  const ramTrace = play(record(1, [...round(3), ...round(6), ram]));
  assert.equal(ramTrace.steps.at(-1).events[0].type, 'RamResolved');

  const select = {type: 'SelectWeapon', playerId: 'player', unitId: 'ogre',
    weaponKey: 'secondary'};
  const selected = play(record(1, [end, select]));
  assert.equal(selected.finalState.state.units.find(unit => unit.id === 'ogre')
    .ogreSystems.selectedWeapon, 'secondary');

  const missileMove = (x, y) => ({type: 'Move', playerId: 'player',
    unitId: 'missile', to: {x, y}});
  const missileFire = {type: 'PlayerFire', playerId: 'player',
    unitId: 'missile', targetId: 'guard'};
  const fireTrace = play(record(1, [missileMove(4, 6), end, end, end,
    auto, auto, auto, auto, auto, missileMove(4, 5), end, missileFire]));
  assert.equal(fireTrace.steps.at(-1).events[0].type, 'PlayerFireResolved');
});

function reject(replay, code = 'IRON_DUST_REPLAY_MISMATCH') {
  const before = JSON.stringify(replay);
  assert.throws(() => validate(replay), {code});
  assert.throws(() => play(replay), {code});
  assert.equal(JSON.stringify(replay), before);
}

test('header, source start, checkpoints and command order reject before playback', () => {
  const replay = record(victory.seed, victory.commands);
  for (const mutate of [
    r => {r.replayVersion = 'iron-dust-profile-replay-v1'},
    r => {r.replayVersion = 'schema-1'},
    r => {r.executable = true},
    r => {r.header.profileVersion = 'old'},
    r => {r.header.profileHeader.rulesVersion = 'core-v3'},
    r => {r.header.profileHeader.sourceDataDigest = 'fnv1a64:0000000000000000'},
    r => {r.header.controllerVersion = 'old'},
    r => {r.header.targetPolicyVersion = 'old'},
    r => {r.header.eventCodecVersion = 'old'},
    r => {r.header.initialSnapshotDigest = 'fnv1a64:0000000000000000'},
    r => {r.initialSeed = -1},
    r => {r.initialSeed = 9},
    r => {r.initialSnapshot.entry.payload.rng.state++},
    r => {r.initialSnapshot.entry.payload.map.defaultTerrain = 'forest'},
    r => {r.commands[0].to.x = 2},
    r => {[r.commands[0], r.commands[1]] = [r.commands[1], r.commands[0]]},
    r => {r.commandsDigest = 'fnv1a64:0000000000000000'},
    r => {r.checkpoints[0].rngState++},
    r => {r.checkpoints[0].entryDigest = 'fnv1a64:0000000000000000'},
    r => {r.traceDigest = 'fnv1a64:0000000000000000'},
    r => {r.extra = true}
  ]) {
    const altered = copy(replay);
    mutate(altered);
    reject(altered);
  }
});

test('invalid receipts and enemy actions outside their native phase cannot be replayed', () => {
  const initial = createIronDustProfile(8);
  const result = dispatchIronDustProfile(initial, end);
  const recorder = createIronDustCommitRecorder(initial);
  for (const command of [
    {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'},
    {type: 'EnemySystemAttack', playerId: 'enemy', attackerId: 'guard'},
    {type: 'AdvanceEnemyTurn', playerId: 'enemy'},
    {type: 'EndPhase', playerId: 'enemy'},
    {type: 'Move', playerId: 'player', unitId: 'core', to: {x: 1, y: 1}},
    {type: 'PlayerFire', playerId: 'player', unitId: 'ogre', targetId: 'core',
      weaponKey: 'bogus'}
  ]) {
    assert.throws(() => recorder.accept(initial, {action:command,...result}),
      {code: 'IRON_DUST_REPLAY_RECEIPT_INVALID'});
  }
  assert.deepEqual(recorder.snapshot().commands, []);
  const wrongPhase = {type:'EnemyMove',playerId:'enemy',actorId:'guard',to:{x:1,y:1}};
  recorder.accept(initial, {action:wrongPhase,...result});
  reject(recorder.snapshot(), 'IRON_DUST_REPLAY_COMMAND_REJECTED');
  assert.throws(() => record(8, [auto]),
    {code: 'WRONG_PHASE'});
  assert.throws(() => record(8, [...victory.commands, end]),
    {code: 'GAME_ENDED'});
  const injected = copy(record(8, victory.commands));
  injected.commands[0] = {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'};
  reject(injected);
});

test('schema-1 rejects an Iron Dust commit recording and profile', () => {
  const replay = record(8, victory.commands);
  assert.throws(() => validateProfileReplay(replay),
    {code: 'UNSUPPORTED_REPLAY_VERSION'});
  assert.throws(() => recordProfileReplay(createIronDustProfile(8), 8,
    victory.commands), {code: 'REPLAY_PROFILE_MISMATCH'});
});
