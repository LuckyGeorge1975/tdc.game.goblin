import test from 'node:test';
import assert from 'node:assert/strict';
import {phaseScenario, phaseCommands, PHASE_SEED,
  replayReference, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {CORE_PROFILE_CONTRACT, CORE_SUPERCOVER_CONTRACT} from '../src/core/profile-contract.mjs';
import {recordProfileReplay, validateProfileReplay, playProfileReplay,
  REPLAY_SCHEMA_VERSION} from '../src/core/replay-contract.mjs';

const sourceScenario = () => ({...structuredClone(phaseScenario), ...structuredClone(CORE_PROFILE_CONTRACT)});
const recorded = () => recordProfileReplay(sourceScenario(), PHASE_SEED, structuredClone(phaseCommands));

test('exact v3 profile replay survives JSON roundtrip with a stable state, events, errors and seed', () => {
  const envelope = recorded();
  assert.equal(envelope.replaySchemaVersion, REPLAY_SCHEMA_VERSION);
  assert.equal(envelope.header.rulesVersion, 'core-v3-profile-v1');
  assert.equal(envelope.header.ruleProfileId, 'FIELD_TEST_LEGACY_v1');
  assert.equal(envelope.initialSeed, PHASE_SEED);
  assert.equal(Object.isFrozen(envelope.header.effectiveRules.movement), true);
  const decoded = JSON.parse(JSON.stringify(envelope));
  assert.deepEqual(validateProfileReplay(decoded), envelope);
  const first = playProfileReplay(decoded), second = playProfileReplay(envelope);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.initialState.rng.seed, PHASE_SEED);
  assert.equal(first.steps[1].result.error.code, 'ACTION_SPENT');
  assert.equal(first.steps[3].result.events[0].type, 'ShotResolved');
  assert.equal(JSON.stringify(decoded), JSON.stringify(envelope));
});

test('recording owns the initial scenario, effective rules and commands', () => {
  const source = sourceScenario(), commands = structuredClone(phaseCommands);
  const envelope = recordProfileReplay(source, PHASE_SEED, commands);
  const before = JSON.stringify(envelope);
  source.map.width = 2;
  source.units[0].hp = 1;
  source.effectiveRules.movement.gevSecondMove = 9;
  commands[0].to.x = 7;
  assert.equal(JSON.stringify(envelope), before);
  assert.equal(playProfileReplay(envelope).initialState.map.width, phaseScenario.map.width);
});

test('all replay header, snapshot, seed and command mismatches fail before play', () => {
  const mutations = [
    [e => {delete e.replaySchemaVersion}, 'UNSUPPORTED_REPLAY_VERSION'],
    [e => {e.replaySchemaVersion = 2}, 'UNSUPPORTED_REPLAY_VERSION'],
    [e => {delete e.header}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.header.rulesVersion = 'core-v2'}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.header.scenarioId = 'other'}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {delete e.header.scenarioVersion}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.header.ruleProfileId = 'FULL_CATALOG_v1'}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.header.effectiveRules.movement.gevSecondMove = 3}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.initialSeed = -1}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.initialSeed = 0x100000000}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {delete e.initialSeed}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.initialScenario.units[0].hp = 1}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.initialScenario.map.terrain.push({x: 2, y: 2, type: 'unregistered'})}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.header.scenarioDigest = 'fnv1a64:0000000000000000'}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.commands[0].to.x = '2'}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.commands.length += 1}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.commands.push({type: 'Load', playerId: 'player'})}, 'REPLAY_PROFILE_MISMATCH'],
    [e => {e.header = {...CORE_SUPERCOVER_CONTRACT, scenarioDigest: e.header.scenarioDigest}}, 'REPLAY_PROFILE_MISMATCH']
  ];
  for (const [change, code] of mutations) {
    const envelope = JSON.parse(JSON.stringify(recorded()));
    change(envelope);
    const before = JSON.stringify(envelope);
    assert.throws(() => playProfileReplay(envelope), {code});
    assert.equal(JSON.stringify(envelope), before, code);
  }
  assert.throws(() => recordProfileReplay(
    {...sourceScenario(), ...CORE_SUPERCOVER_CONTRACT}, PHASE_SEED, phaseCommands),
    {code: 'REPLAY_PROFILE_MISMATCH'});
});

test('historical replay helpers and the fixed core-v2 oracle retain their exact output', () => {
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
  assert.equal(JSON.stringify(replayReference()), JSON.stringify(replayReference()));
});
