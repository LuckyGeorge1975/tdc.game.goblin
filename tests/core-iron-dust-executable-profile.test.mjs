import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from
  './iron-dust-source-victory-trace.v2.mjs';
import {IRON_DUST_SOURCE_DEFEAT_TRACE_V2 as defeat} from
  './iron-dust-source-defeat-trace.v2.mjs';
import {createIronDustSourceActionEntry} from
  '../src/core/iron-dust-source-action-entry-probe.mjs';
import {createIronDustProfile as create, validateIronDustProfile as validate,
  queryIronDustProfile as query, preflightIronDustProfile as preflight,
  dispatchIronDustProfile as dispatch, projectIronDustProfile as project,
  IRON_DUST_PROFILE_HEADER} from
  '../src/core/iron-dust-executable-profile.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stateOf = profile => profile.entry.mode === 'enemy'
  ? profile.entry.payload.state : profile.entry.payload;
const auto = {type: 'AutoEnemyAdvance', playerId: 'enemy'};
const end = {type: 'EndPhase', playerId: 'player'};
function reject(profile, command, code) {
  const before = JSON.stringify(profile);
  assert.deepEqual(query(profile, command), {available: false, error: {code}});
  assert.deepEqual(preflight(profile, command), {available: false, error: {code}});
  assert.deepEqual(dispatch(profile, command), {error: {code}});
  assert.equal(JSON.stringify(profile), before);
}

function run(oracle) {
  let profile = create(oracle.seed);
  assert.equal(profile.executable, true);
  assert.equal(profile.entry.executable, false);
  assert.equal(hash(profile.entry), oracle.initialHash);
  const steps = [];
  const commands = oracle.commands ?? oracle.steps.map(step =>
    step.command === 'E' ? auto : end);
  for (const [index, command] of commands.entries()) {
    const before = JSON.stringify(profile);
    const allowed = query(profile, command);
    assert.equal(allowed.available, true, `${index}: ${JSON.stringify(allowed.error)}`);
    assert.deepEqual(preflight(profile, command), allowed);
    assert.equal(JSON.stringify(profile), before);
    const result = dispatch(profile, command);
    assert.ok(result.profile, `${index}: ${JSON.stringify(result.error)}`);
    profile = result.profile;
    assert.doesNotThrow(() => validate(profile));
    assert.deepEqual(result.events, oracle.steps[index].events);
    assert.equal(profile.entry.digest, oracle.steps[index].state.digest);
    assert.equal(stateOf(profile).rng.state, oracle.steps[index].state.rngState);
    assert.equal(hash({command, allowed, events: result.events, entry: profile.entry}),
      oracle.steps[index].hash);
    steps.push({digest: profile.entry.digest, events: result.events,
      rng: stateOf(profile).rng.state});
  }
  assert.equal(profile.entry.mode, 'ended');
  assert.equal(stateOf(profile).victory.winner,
    oracle === victory ? 'player' : 'enemy');
  reject(profile, end, 'GAME_ENDED');
  reject(profile, auto, 'GAME_ENDED');
  return {profile, steps};
}

test('Seed8 v2 source victory is byte-identical through the internal profile', () => {
  const first = run(victory), second = run(victory);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.steps.length, 21);
});

test('Seed2 v2 source defeat is byte-identical through the internal profile', () => {
  const first = run(defeat), second = run(defeat);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.steps.length, 989);
});

test('profile header and state gates reject mixed versions before action or RNG', () => {
  const profile = create(8);
  assert.equal(stateOf(profile).fixture, 'source');
  assert.deepEqual(profile.header, IRON_DUST_PROFILE_HEADER);
  for (const mutate of [
    p => {p.profileVersion = 'old'},
    p => {p.executable = false},
    p => {p.header.rulesVersion = 'core-v3'},
    p => {p.header.ruleProfileId = 'FIELD_TEST_LEGACY_v1'},
    p => {p.header.sourceDataVersion = 'old'},
    p => {p.header.sourceDataDigest = 'fnv1a64:0000000000000000'},
    p => {p.header.controllerVersion = 'old'},
    p => {p.header.targetPolicyVersion = 'old'},
    p => {p.header.losVersion = 'old'},
    p => {p.header.terrainDigest = 'fnv1a64:0000000000000000'},
    p => {p.header.combatVersion = 'old'},
    p => {p.sourceStartDigest = 'fnv1a64:0000000000000000'},
    p => {p.digest = 'fnv1a64:0000000000000000'},
    p => {p.entry.payload.rng.state++},
    p => {p.entry.payload.fixture = 'adjacent'},
    p => {p.entry.payload.units[0].ogreSystems.treads = 0},
    p => {p.extra = true}
  ]) {
    const altered = copy(profile);
    mutate(altered);
    reject(altered, end, 'IRON_DUST_PROFILE_MISMATCH');
  }
  const mixed = copy(profile);
  mixed.entry = copy(createIronDustSourceActionEntry(8));
  reject(mixed, end, 'IRON_DUST_PROFILE_MISMATCH');
  reject(profile, auto, 'WRONG_PHASE');
  reject(profile, {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'},
    'SOURCE_ENTRY_COMMAND_UNSUPPORTED');
  reject(profile, {type: 'Move', playerId: 'player', unitId: 'core',
    to: {x: 1, y: 1}}, 'SOURCE_ENTRY_ACTOR_INVALID');
  let enemy = profile;
  for (let i = 0; i < 3; i++) enemy = dispatch(enemy, end).profile;
  assert.equal(enemy.entry.mode, 'enemy');
  const cursor = copy(enemy);
  cursor.entry.payload.cursor.index = 1;
  reject(cursor, auto, 'IRON_DUST_PROFILE_MISMATCH');
  const controllerVersion = copy(enemy);
  controllerVersion.entry.payload.controllerVersion = 'old';
  reject(controllerVersion, auto, 'IRON_DUST_PROFILE_MISMATCH');
});

test('read-only projection exposes state and events without changing gameplay', () => {
  const profile = create(8), before = JSON.stringify(profile);
  const result = dispatch(profile, end);
  assert.ok(result.profile);
  const view = project(result.profile, result.events);
  assert.equal(view.projectionVersion, 'core-iron-dust-projection-v1');
  assert.deepEqual(view.state, stateOf(result.profile));
  assert.deepEqual(view.events, result.events);
  assert.equal(Object.isFrozen(view.state), true);
  assert.equal(Object.isFrozen(view.events), true);
  assert.equal(JSON.stringify(profile), before);
  assert.equal(JSON.stringify(result.profile),
    JSON.stringify(dispatch(profile, end).profile));
  assert.throws(() => {view.state.turn = 9}, TypeError);
});
