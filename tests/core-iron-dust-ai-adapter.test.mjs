import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as trace} from './iron-dust-source-victory-trace.v2.mjs';
import {AI_DECISION_SCHEMA_VERSION} from '../src/core/ai-decision-adapter.mjs';
import {createIronDustAiAdapter, IRON_DUST_TARGET_FEATURES} from '../src/core/iron-dust-ai-adapter.mjs';
import {createIronDustProfile, dispatchIronDustProfile, dispatchIronDustProfileEnemyFireChoice,
  dispatchIronDustProfileEnemyMoveChoice,queryIronDustProfileEnemyMoveChoice,
  projectIronDustProfile, queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {hexDistance,movementPaths} from '../src/core/hex.mjs';

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

test('first unsuccessful fire exposes all reachable fields, including lateral and backward moves',()=>{
  const state=at(4), projection=projectIronDustProfile(state);
  const guard=projection.state.units.find(unit=>unit.id==='guard');
  const ogre=projection.state.units.find(unit=>unit.id==='ogre');
  const adapter=createIronDustAiAdapter(()=>({state,generation:1}));
  const batch=adapter.open('enemy');
  assert.equal(batch.slot,'first');
  const moves=batch.candidates.filter(candidate=>candidate.kind==='move');
  assert.deepEqual(new Set(moves.map(({target})=>`${target.x},${target.y}`)),
    new Set(movementPaths(projection.state,guard).keys()));
  assert.equal(moves.length,6);
  const baseline=moves.find(option=>option.facts.baseline);
  assert.equal(batch.candidates[0],baseline);
  assert.equal(baseline.facts.automatic,true);
  assert.deepEqual(baseline.target,{kind:'cell',x:7,y:3});
  const retreat=moves.find(option=>option.target.x===9&&option.target.y===3);
  assert.ok(hexDistance(retreat.target,ogre)>hexDistance(guard,ogre));
  const command={type:'EnemyMove',playerId:'enemy',actorId:'guard',to:{x:9,y:3}};
  const query=queryIronDustProfileEnemyMoveChoice(state,command);
  assert.equal(query.available,true);
  assert.deepEqual(query.path,retreat.facts.path);
  const result=adapter.execute(pick(batch,retreat));
  assert.deepEqual(result.events[0].to,command.to);
  assert.equal(result.events[0].type,'EnemyMoved');
  assert.deepEqual(result.profile.entry.payload.state.rng,projection.state.rng);
  assert.equal(result.profile.entry.payload.cursor.index,1);
  assert.deepEqual(dispatchIronDustProfileEnemyMoveChoice(state,{...command,to:{x:7,y:3}}),
    dispatchIronDustProfile(state,auto));
});

test('Hold spends only the first movement attempt and leaves the ordinary retry',()=>{
  const state=at(4), adapter=createIronDustAiAdapter(()=>({state,generation:1}));
  const batch=adapter.open('enemy'), hold=batch.candidates.find(candidate=>candidate.kind==='hold');
  const result=adapter.execute(pick(batch,hold));
  const guard=result.profile.entry.payload.state.units.find(unit=>unit.id==='guard');
  assert.deepEqual(result.events,[{type:'EnemyHeld',actorId:'guard',at:{x:8,y:3},reason:'HOLD',turn:1}]);
  assert.deepEqual([guard.x,guard.y,guard.moved,guard.fired],[8,3,true,false]);
  assert.ok(!result.profile.entry.payload.state.enemyPassed.includes('guard'));
  assert.deepEqual(result.profile.entry.payload.state.rng,state.entry.payload.state.rng);
  const retry=dispatchIronDustProfile(result.profile,auto).profile;
  assert.equal(retry.entry.payload.cursor.pass,'retry');
  assert.deepEqual(queryIronDustProfile(retry,auto).action,
    {kind:'pass',actorId:'guard',reason:'NO_TARGET',command:{type:'EnemyPass',playerId:'enemy',actorId:'guard'}});
  assert.equal(dispatchIronDustProfile(retry,auto).events[0].type,'EnemyPassRecorded');
  assert.equal(dispatchIronDustProfileEnemyMoveChoice(retry,{type:'EnemyHold',playerId:'enemy',actorId:'guard'}).error.code,
    'ENEMY_MOVE_CHOICE_OUTSIDE_SLOT');
  assert.equal(adapter.execute(pick(batch,hold)).code,'AI_STALE_DECISION');
});

test('movement query rejects wrong phase, available first fire, invalid fields and wrong actors',()=>{
  const state=at(4), move={type:'EnemyMove',playerId:'enemy',actorId:'guard',to:{x:9,y:3}};
  const digest=state.digest;
  for(const [profile,command,code] of [
    [createIronDustProfile(trace.seed),move,'WRONG_PHASE'],
    [at(13),move,'ENEMY_MOVE_CHOICE_OUTSIDE_SLOT'],
    [state,{...move,actorId:'core'},'ENEMY_MOVE_CHOICE_OUTSIDE_SLOT'],
    [state,{...move,actorId:'raider'},'ENEMY_MOVE_CHOICE_OUTSIDE_SLOT'],
    [state,{...move,playerId:'player'},'NOT_ACTIVE_TEAM'],
    [state,{...move,to:{x:-1,y:3}},'ENEMY_MOVE_DESTINATION_INVALID'],
    [state,{...move,to:{x:8,y:3}},'ENEMY_MOVE_DESTINATION_INVALID'],
    [state,{...move,to:{x:9,y:5}},'ENEMY_MOVE_DESTINATION_UNREACHABLE'],
    [state,{...move,to:{x:9,y:3,path:[]}},'ENEMY_MOVE_DESTINATION_INVALID'],
    [state,{...move,cost:0},'ENEMY_MOVE_COMMAND_INVALID']
  ]) {
    assert.equal(queryIronDustProfileEnemyMoveChoice(profile,command).error.code,code);
    assert.equal(dispatchIronDustProfileEnemyMoveChoice(profile,command).error.code,code);
  }
  assert.equal(state.digest,digest);
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
