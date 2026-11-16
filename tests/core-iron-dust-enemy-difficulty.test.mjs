import test from 'node:test';
import assert from 'node:assert/strict';
import {createIronDustProfile, dispatchIronDustProfile, IRON_DUST_ENEMY_DIFFICULTIES}
  from '../src/core/iron-dust-executable-profile.mjs';
import {ironDustEnemyPolicy} from '../src/core/iron-dust-enemy-policy.mjs';
import {queryIronDustEnemyIntent} from '../src/core/iron-dust-enemy-intent-probe.mjs';
import {queryIronDustStandardFireAction} from '../src/core/iron-dust-standard-fire-action-probe.mjs';
import {playIronDustProfileReplay}
  from '../src/core/iron-dust-profile-replay.mjs';
import {recordIronDustCommands} from './helpers/iron-dust-commit-replay.mjs';
import {IRON_DUST_LEVEL_V3} from '../src/levels/iron-dust.v3.mjs';

const seed = 2;
const end = {type: 'EndPhase', playerId: 'player'};
const auto = {type: 'AutoEnemyAdvance', playerId: 'enemy'};
const commands = [{type: 'Move', playerId: 'player', unitId: 'gev', to: {x: 0, y: 6}},
  ...Array.from({length: 4}, () => [end, end, end, auto, auto, auto, auto, auto]).flat()];

test('a registered level minimum clamps difficulty and remains bound through replay', () => {
  const level = {...IRON_DUST_LEVEL_V3, minimumDifficulty:'medium'};
  const below = createIronDustProfile(seed, {difficulty:'weak',level});
  assert.deepEqual(below, createIronDustProfile(seed, {difficulty:'medium',level}));
  assert.equal(below.header.minimumDifficulty, 'medium');
  assert.equal(below.header.enemyPolicy, undefined);
  assert.equal(createIronDustProfile(seed, {difficulty:'strong',level}).header.enemyPolicy.difficulty, 'strong');
  assert.throws(() => createIronDustProfile(seed, {level:{...level,minimumDifficulty:'unknown'}}), /DIFFICULTY_INVALID/);
  assert.throws(() => createIronDustProfile(seed, {level:{...level,losMode:'strict'}}), /LEVEL_DATA_MISMATCH/);
  const replay = recordIronDustCommands(below, commands.slice(0, 2));
  assert.equal(replay.header.profileHeader.minimumDifficulty, 'medium');
  assert.doesNotThrow(() => playIronDustProfileReplay(replay));
});

test('three policies run and replay one common source route with the same dice rule', () => {
  const medium = createIronDustProfile(seed);
  assert.deepEqual(createIronDustProfile(seed, {difficulty: 'medium'}), medium);
  const observations = [];
  for (const difficulty of IRON_DUST_ENEMY_DIFFICULTIES) {
    const record = recordIronDustCommands(createIronDustProfile(seed, {difficulty}), commands);
    assert.deepEqual(record.initialSnapshot.entry, medium.entry);
    assert.equal(record.header.profileHeader.enemyPolicy?.difficulty ?? 'medium', difficulty);
    const playback = playIronDustProfileReplay(JSON.parse(JSON.stringify(record)));
    assert.deepEqual(playIronDustProfileReplay(record), playback);
    assert.equal(playback.finalState.state.turn, 5);
    assert.equal(playback.finalState.state.phase, 'movement');

    let rng = seed;
    const moves = [], shots = [];
    for (const step of playback.steps) {
      for (const event of step.events) {
        if (event.type === 'EnemyMoved' && event.actorId === 'raider')
          moves.push([event.turn, event.to]);
        if (['EnemyUnitFireResolved', 'EnemySystemFireResolved'].includes(event.type)) {
          rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
          assert.equal(event.roll, rng % 6);
          shots.push([event.turn, event.targetId]);
        }
      }
      assert.equal(step.checkpoint.rngState, rng);
    }
    observations.push([moves[0], moves.at(-1), shots]);
  }
  assert.deepEqual(observations, [
    [[1, {x: 9, y: 6}], [4, {x: 5, y: 7}], []],
    [[1, {x: 8, y: 6}], [4, {x: 3, y: 6}], [[3, 'missile']]],
    [[1, {x: 8, y: 6}], [4, {x: 3, y: 5}], [[3, 'missile'], [4, 'ogre']]]
  ]);
});

test('same sight and legal targets, different threat preferences', () => {
  let profile = createIronDustProfile(seed);
  for (let phase = 0; phase < 3; phase++) profile = dispatchIronDustProfile(profile, end).profile;
  // Diagnostic position with three legal targets before the same first shot.
  const state = structuredClone(profile.entry.payload.state);
  Object.assign(state.units.find(unit => unit.id === 'guard'), {x: 3, y: 5});
  const request = {type: 'EnemyIntent', playerId: 'enemy', actorId: 'guard',
    stage: 'first-fire', claim: 'auto'};
  const choices = IRON_DUST_ENEMY_DIFFICULTIES.map(difficulty =>
    queryIronDustEnemyIntent(state, request, ironDustEnemyPolicy(difficulty)));
  assert.deepEqual(choices.map(choice => [choice.kind, choice.targetId]),
    [['fire', 'gev'], ['fire', 'missile'], ['fire', 'ogre']]);
  for (const choice of choices)
    assert.equal(queryIronDustStandardFireAction(state, choice.command).available, true);
  assert.equal(state.rng.state, seed);
});

test('unknown difficulty and mixed replay policy bindings reject', () => {
  assert.throws(() => createIronDustProfile(seed, {difficulty: 'expert'}),
    {code: 'IRON_DUST_DIFFICULTY_INVALID'});
  const weak = recordIronDustCommands(createIronDustProfile(seed, {difficulty:'weak'}), [end, end, end, auto]);
  for (const change of [
    replay => {replay.header.profileHeader.enemyPolicy.version = 'unrecognized'},
    replay => {replay.header.profileHeader.enemyPolicy.difficulty = 'strong'},
    replay => {delete replay.header.profileHeader.enemyPolicy},
    replay => {delete replay.initialSnapshot.header.enemyPolicy}
  ]) {
    const copy = structuredClone(weak);
    change(copy);
    assert.throws(() => playIronDustProfileReplay(copy), {code: 'IRON_DUST_REPLAY_MISMATCH'});
  }
});
