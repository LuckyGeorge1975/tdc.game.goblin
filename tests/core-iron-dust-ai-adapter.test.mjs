import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as trace} from './iron-dust-source-victory-trace.v2.mjs';
import {AI_DECISION_SCHEMA_VERSION} from '../src/core/ai-decision-adapter.mjs';
import {createIronDustAiAdapter, IRON_DUST_TARGET_FEATURES} from '../src/core/iron-dust-ai-adapter.mjs';
import {createIronDustProfile, dispatchIronDustProfile, dispatchIronDustProfileEnemyFireChoice,
  projectIronDustProfile, queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';

const auto = {type: 'AutoEnemyAdvance', playerId: 'enemy'};
const at = index => trace.commands.slice(0, index).reduce((state, command) => {
  const result = dispatchIronDustProfile(state, command);
  assert.ok(result.profile);
  return result.profile;
}, createIronDustProfile(trace.seed));
const pick = (decision, candidate) => ({schemaVersion: AI_DECISION_SCHEMA_VERSION,
  decisionId: decision.decisionId, revision: decision.revision, key: candidate.key});

test('player candidates are side-relative and bind legal fire features for a fixed actor and weapon', () => {
  const state = at(20), adapter = createIronDustAiAdapter(() => ({state, generation: 1}));
  const scope = {actorId: 'ogre', weaponRef: trace.commands[20].weaponKey};
  const decision = adapter.open('player', scope);
  assert.equal(decision.view.units.find(unit => unit.id === 'ogre').relation, 'own');
  assert.equal(decision.view.units.find(unit => unit.id === 'core').relation, 'opponent');
  assert.equal(decision.slot, 'fire-target');
  assert.deepEqual(decision.candidates.map(item => item.target.unitId), ['core', 'guard', 'raider']);
  assert.deepEqual(IRON_DUST_TARGET_FEATURES, ['ratio:1-2', 'ratio:1-1', 'ratio:2-1', 'ratio:3-1',
    'ratio:4-1', 'ratio:5-1', 'objective-target', 'disabled-target']);
  assert.deepEqual(decision.candidates[0].facts.features, [0, 1, 0, 0, 0, 0, 1, 0]);
  assert.deepEqual(decision.candidates[2].facts.features, [0, 0, 1, 0, 0, 0, 0, 0]);
  assert.ok(Object.isFrozen(decision.candidates[2].facts.features));
  const serial = JSON.stringify(decision);
  for (const privateValue of ['"rng"', '"seed"', '"command"', '"digest"', state.digest])
    assert.ok(!serial.includes(privateValue));
  const result = adapter.execute(pick(decision, decision.candidates[2]));
  const expected = dispatchIronDustProfile(state, {...trace.commands[20], targetId: 'raider'});
  assert.deepEqual(result.profile, expected.profile);
  assert.deepEqual(result.events, expected.events);
  assert.equal(adapter.execute(pick(decision, decision.candidates[2])).code, 'AI_STALE_DECISION');
  assert.equal(adapter.open('player', scope).code, 'AI_STATE_NOT_ADVANCED');
});

test('explicit enemy fire commits a different legal component using the existing controller cursor', () => {
  const state = at(13), adapter = createIronDustAiAdapter(() => ({state, generation: 1}));
  const decision = adapter.open('enemy');
  assert.equal(decision.view.units.find(unit => unit.id === 'guard').relation, 'own');
  assert.equal(decision.view.units.find(unit => unit.id === 'ogre').relation, 'opponent');
  assert.ok(decision.candidates.some(item => item.target.componentId === 'missiles' && item.facts.baseline));
  const treads = decision.candidates.find(item => item.target.componentId === 'treads');
  assert.equal(treads.facts.features, undefined);
  const wrongActor = dispatchIronDustProfileEnemyFireChoice(state, {type:'EnemySystemAttack', playerId:'enemy',
    attackerId:'raider', targetId:'ogre', targetKey:'treads'});
  assert.equal(wrongActor.error.code, 'ENEMY_FIRE_CHOICE_OUTSIDE_SLOT');
  const result = adapter.execute(pick(decision, treads));
  assert.equal(result.events[0].targetKey, 'treads');
  assert.equal(result.events[0].attackerId, 'guard');
  assert.equal(result.profile.entry.payload.cursor.index, 1);
  const before = projectIronDustProfile(state).state.rng.state;
  assert.equal(projectIronDustProfile(result.profile).state.rng.state,
    (Math.imul(1664525, before) + 1013904223) >>> 0);
});

test('engine baseline and mechanical enemy slots match all reference automatic steps', () => {
  let state = createIronDustProfile(trace.seed);
  const adapter = createIronDustAiAdapter(() => ({state, generation: 1}));
  for (const command of trace.commands) {
    const expected = dispatchIronDustProfile(state, command);
    if (command.type === auto.type) {
      assert.ok(queryIronDustProfile(state, auto).available);
      const decision = adapter.open('enemy');
      const candidate = decision.candidates.find(item => item.facts.baseline) ?? decision.candidates[0];
      const result = adapter.execute(pick(decision, candidate));
      assert.deepEqual(result.profile, expected.profile);
      assert.deepEqual(result.events, expected.events);
    }
    state = expected.profile;
  }
  assert.equal(adapter.open('enemy').code, 'GAME_ENDED');
});

test('selection gates reject unknown keys, another side, replaced states and generations', () => {
  const context = {state: at(4), generation: 7};
  const adapter = createIronDustAiAdapter(() => context);
  assert.equal(adapter.open('player').code, 'NOT_ACTIVE_TEAM');
  let decision = adapter.open('enemy');
  const request = pick(decision, decision.candidates[0]);
  assert.equal(adapter.execute({...request, key: 'unknown'}).code, 'AI_UNKNOWN_CANDIDATE');
  assert.equal(adapter.execute({...request, command: auto}).code, 'AI_INVALID_SELECTION');
  context.generation++;
  assert.equal(adapter.execute(request).code, 'AI_STALE_DECISION');
  decision = adapter.open('enemy');
  const equalState = at(4);
  assert.equal(equalState.digest, context.state.digest);
  context.state = equalState;
  assert.equal(adapter.execute(pick(decision, decision.candidates[0])).code, 'AI_STALE_DECISION');
  decision = adapter.open('enemy');
  adapter.invalidate();
  assert.equal(adapter.execute(pick(decision, decision.candidates[0])).code, 'AI_STALE_DECISION');
});
