import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHeadlessFullEngine} from '../src/core/full-worker-engine.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
const readSource=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const data=JSON.parse(await readSource('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json'));
const levels=JSON.parse(await readSource('assets/unit-art/levels/catalog-full-levels.v3.json'));
async function engine() {
  const result=await createHeadlessFullEngine({readSource});
  await result.initialize(data,levels);
  return result;
}

test('the browser-free FULL engine has native legal actions, tactics, isolated roots and synchronous seeded reload',async()=>{
  const first=await engine(),second=await engine();
  const baseline=first.load('catalog-full-atlas',{roles:{player:'ai',enemy:'ai'},policyIds:{},seed:7});
  const loaded=await second.loadConfig(baseline.session.config,7,'catalog-full-atlas');
  assert.notEqual(first.root,second.root);
  const full=second.root.GoblinCatalogFullRuntime;
  const host=createFullCatalogAiHost(full,second.root.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>loaded.port.state()?.side,second.root.GoblinSpecialistsRuntime);
  assert.ok(loaded.port.project('ai').view.tactics);
  const moves=host.playerOptions(true).filter(entry=>entry.command.type==='Move');
  assert.ok(moves.length>0);
  const before=JSON.stringify(full.snapshot());
  const token=loaded.port.open('ai').permit;
  assert.equal(loaded.port.commit('ai',token,moves[0].command,host.dispatch).ok,true);
  assert.notEqual(JSON.stringify(full.snapshot()),before);
  const restored=second.reload();
  assert.equal(restored.port.state().side,'player');
  assert.notEqual(restored.port.state().sessionId,loaded.port.state()?.sessionId);
  assert.equal(first.state().turn,1);
  assert.equal(first.state().phase,'player');
  first.dispose();second.dispose();
});

test('the isolated FULL bootstrap preserves a draft minimum through registered simulation references',async()=>{
  const instance=await engine();
  const draft={version:'goblin-level-v3',width:8,height:6,objective:'core-and-escort',
    minimumDifficulty:'strong',terrain:[],units:[
      {id:'lead',assetId:'assault-tank',team:'player',x:1,y:2},
      {id:'core',assetId:'command-core',team:'enemy',x:6,y:2},
      {id:'guard',assetId:'guard-tank',team:'enemy',x:5,y:3}]};
  const {port}=await instance.loadConfig(null,19,'editor-draft',draft);
  assert.equal(port.state().side,'player');
  assert.equal(port.project('ai').view.side,'player');
  assert.ok(port.project('ai').view.tactics);
  const restored=instance.reload();
  assert.equal(restored.session.config.minimumDifficulty,'strong');
  instance.dispose();
});

test('the worker knowledge hook removes undisclosed positions from the native model world',async()=>{
  const views=[],modelViews=[];
  for(const hiddenX of [4,11]) {
    const instance=await engine();
    const draft={version:'goblin-level-v3',width:12,height:8,objective:'core-and-escort',terrain:[],units:[
      {id:'lead',assetId:'assault-tank',team:'player',x:1,y:2},
      {id:'core',assetId:'command-core',team:'enemy',x:7,y:5},
      {id:'hidden',assetId:'phantom-platform',team:'enemy',x:hiddenX,y:hiddenX===4?2:7}]};
    const {port}=await instance.loadConfig(null,7,'editor-draft',draft);
    const view=port.project('ai').view;
    assert.ok(!view.units.some(unit=>unit.id==='hidden'));
    views.push(view);
    const ids=instance.applyRootKnowledge(view).knownIds;
    assert.ok(!ids.includes('hidden'));
    assert.deepEqual(ids.toSorted(),view.units.map(unit=>unit.id).toSorted());
    assert.ok(!instance.root.GoblinCatalogFullRuntime.roster('enemy').some(unit=>unit.id==='hidden'));
    modelViews.push(port.project('ai').view);
    instance.dispose();
  }
  assert.deepEqual(views[0],views[1]);
  assert.deepEqual(modelViews[0],modelViews[1]);
});

test('unknown wave effects remain excluded for the model and reload restores native replay behaviour',async()=>{
  const instance=await engine();
  const baseline=instance.load('catalog-full-atlas',{roles:{player:'ai',enemy:'ai'},policyIds:{},seed:7});
  const {port}=await instance.loadConfig(baseline.session.config,7,'catalog-full-atlas');
  const waves=instance.root.GoblinCatalogWaves,config=waves.CONFIG;
  function throughFirstWave() {
    let state=waves.create(config),result;
    for(let ownTurn=1;ownTurn<=3;ownTurn++) {
      const entries=config.waves.filter(wave=>wave.team==='enemy'&&wave.dueOwnTurn===ownTurn)
        .map(wave=>({waveId:wave.id,options:wave.entries.map(cell=>({...cell,passable:true,occupied:false}))}));
      result=waves.beginTurn(state,{eventId:'wave-test-'+ownTurn,revision:'wave-test',
        team:'enemy',ownTurn,entries},config);
      state=result.state;
    }
    return result;
  }
  assert.ok(throughFirstWave().effects.some(effect=>effect.type==='SpawnWave'));
  instance.applyRootKnowledge(port.project('ai').view);
  assert.equal(waves.pendingEnemy(waves.create(config)),0);
  assert.equal(throughFirstWave().effects.length,0);
  instance.reload();
  assert.equal(waves.pendingEnemy(waves.create(config)),1);
  assert.ok(throughFirstWave().effects.some(effect=>effect.type==='SpawnWave'));
  instance.dispose();
});

test('public unresolved target counts prevent an invented model victory while a known complete victory remains valid',async()=>{
  for(const hidden of [false,true]) {
    const instance=await engine();
    const draft={version:'goblin-level-v3',width:12,height:8,objective:'core-and-escort',terrain:[],units:[
      {id:'lead-a',assetId:'assault-tank',team:'player',x:1,y:2},
      {id:'lead-b',assetId:'assault-tank',team:'player',x:2,y:1},
      {id:'core',assetId:'command-core',team:'enemy',x:3,y:2},
      {id:'guard',assetId:'guard-tank',team:'enemy',x:2,y:3},
      ...(hidden?[{id:'hidden',assetId:'phantom-platform',team:'enemy',x:11,y:7}]:[])]};
    const {port}=await instance.loadConfig(null,7,'editor-draft',draft);
    const view=port.project('ai').view;
    // The integration DTO exposes these same scalar counts to Human and AI.
    view.objectives=view.objectives.map(goal=>goal.kind==='destroy-core'?{...goal,remaining:1}:
      goal.kind==='destroy-escort'?{...goal,remaining:hidden?2:1}:goal);
    assert.ok(!view.units.some(unit=>unit.id==='hidden'));
    const knowledge=instance.applyRootKnowledge(view);
    assert.equal(knowledge.unmodeledTargets.enemy,hidden?1:0);
    const full=instance.root.GoblinCatalogFullRuntime;
    const host=createFullCatalogAiHost(full,instance.root.GoblinSpecialistsUI,full.nativePlayerGateway,
      ()=>port.state()?.side,instance.root.GoblinSpecialistsRuntime);
    const commit=command=>assert.equal(port.commit('ai',port.open('ai').permit,command,host.dispatch).ok,true);
    commit({type:'EndPhase'});
    instance.setModalRoll(5);
    for(const [actorId,targetId] of [['lead-a','core'],['lead-b','guard']]) {
      const choice=host.playerOptions(true).find(({command})=>command.type==='CatalogFire'&&
        command.actorId===actorId&&command.target.runtimeUnitId===targetId);
      assert.ok(choice);
      commit(choice.command);
    }
    assert.equal(instance.state().ended,!hidden);
    assert.equal(instance.state().winner,hidden?null:'player');
    instance.dispose();
  }
});

test('a publicly known native deadline still ends the model when undisclosed targets remain',async()=>{
  const instance=await engine();
  const draft={version:'goblin-level-v3',width:12,height:8,objective:'core-and-escort',terrain:[],
    goals:[{type:'enemy-turn-limit',turns:1}],units:[
      {id:'lead',assetId:'assault-tank',team:'player',x:1,y:2},
      {id:'core',assetId:'command-core',team:'enemy',x:7,y:5},
      {id:'hidden',assetId:'phantom-platform',team:'enemy',x:11,y:7}]};
  const {port}=await instance.loadConfig(null,7,'editor-draft',draft);
  const view=port.project('ai').view;
  view.objectives=view.objectives.map(goal=>goal.kind==='destroy-core'?{...goal,remaining:1}:
    goal.kind==='destroy-escort'?{...goal,remaining:1}:goal);
  instance.applyRootKnowledge(view);
  for(let index=0;index<3;index++)
    assert.equal(port.commit('ai',port.open('ai').permit,{type:'EndPhase'}).ok,true);
  assert.equal(instance.state().ended,true);
  assert.equal(instance.state().winner,'enemy');
  instance.dispose();
});

test('the defender model also keeps an unresolved public player target instead of inventing victory',async()=>{
  for(const hidden of [false,true]) {
    const instance=await engine();
    const draft={version:'goblin-level-v3',width:12,height:8,objective:'core-and-escort',terrain:[],units:[
      {id:'lead',assetId:'assault-tank',team:'player',x:7,y:3},
      {id:'core',assetId:'command-core',team:'enemy',x:7,y:5},
      {id:'guard',assetId:'guard-tank',team:'enemy',x:7,y:4},
      ...(hidden?[{id:'hidden',assetId:'phantom-platform',team:'player',x:0,y:0}]:[])]};
    const {port}=await instance.loadConfig(null,7,'editor-draft',draft);
    for(let index=0;index<3;index++)
      assert.equal(port.commit('ai',port.open('ai').permit,{type:'EndPhase'}).ok,true);
    assert.equal(port.state().side,'enemy');
    const view=port.project('ai').view;
    view.objectives=view.objectives.map(goal=>goal.kind==='protect-core'?{...goal,remaining:1}:
      goal.kind==='protect-escort'?{...goal,remaining:1}:
      goal.kind==='destroy-player-force'?{...goal,remaining:hidden?2:1}:goal);
    const knowledge=instance.applyRootKnowledge(view);
    assert.equal(knowledge.unmodeledTargets.player,hidden?1:0);
    const opened=port.open('ai');
    const shot=opened.entries.find(entry=>entry.command.type==='CatalogFire'&&
      entry.command.target.runtimeUnitId==='lead');
    assert.ok(shot);
    instance.setModalRoll(5);
    assert.equal(port.commit('ai',opened.permit,shot.command).ok,true);
    assert.equal(instance.state().ended,!hidden);
    assert.equal(instance.state().winner,hidden?null:'enemy');
    instance.dispose();
  }
});
