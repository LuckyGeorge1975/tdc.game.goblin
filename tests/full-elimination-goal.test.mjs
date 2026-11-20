import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createHeadlessFullEngine} from '../src/core/full-worker-engine.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from '../src/core/full-catalog-ai-adapter.mjs';
import {createSimulationPort} from '../src/core/full-strong-simulation.mjs';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullExplorationPolicy} from '../src/core/full-exploration-policy.mjs';

const readSource=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const data=JSON.parse(readSource('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json'));
const levelData=JSON.parse(readSource('assets/unit-art/levels/catalog-full-levels.v3.json'));
const draft=(units,extra={})=>({version:'goblin-level-v3',width:12,height:8,
  objective:'eliminate-opponent',terrain:[],units,...extra});
const unit=(id,team,x,y,assetId='assault-tank')=>({id,team,x,y,assetId});
const hostFor=(engine,port)=>createFullCatalogAiHost(engine.root.GoblinCatalogFullRuntime,
  engine.root.GoblinSpecialistsUI,engine.root.GoblinCatalogFullRuntime.nativePlayerGateway,
  ()=>port.state().side,engine.root.GoblinSpecialistsRuntime);
async function engineFor(source,seed=7){
  const engine=await createHeadlessFullEngine({readSource});
  await engine.initialize(data,levelData);
  const loaded=await engine.loadConfig(null,seed,'editor-draft',source);
  return {engine,...loaded,host:hostFor(engine,loaded.port)};
}
const commit=(port,host,command)=>assert.equal(port.commit('ai',port.open('ai').permit,command,host.dispatch).ok,true);

test('both seats receive the same force goal and public undiscovered count without a privileged core',async()=>{
  const {engine,port,host}=await engineFor(draft([unit('own','player',1,2),
    unit('hidden','enemy',11,7,'phantom-platform')]));
  try{
    const full=engine.root.GoblinCatalogFullRuntime;
    for(const side of ['player','enemy']){
      const view=full.aiProjection(side);
      assert.deepEqual(view.objectives,[{kind:'destroy-opponent-force',remaining:1,satisfied:false},
        {kind:'survive',satisfied:true}]);
      assert.equal(view.objectiveRemaining,1);
    }
    assert.equal(port.project('ai').view.units.some(u=>u.id==='hidden'),false);
    const batch=createOwnedFullCatalogAiAdapter(port,host).open('player');
    const exploration=createFullExplorationPolicy({side:'player'});
    exploration.observe(batch.view);
    const key=exploration.select(batch);
    assert.equal(batch.candidates.find(candidate=>candidate.key===key)?.kind,'move');
    assert.equal(engine.state().ended,false);
  }finally{engine.dispose();}
});

test('command cores are ordinary force members and disabled living targets still count',async()=>{
  const {engine,port,host}=await engineFor(draft([unit('p','player',1,2),
    unit('own-core','player',1,5,'command-core'),unit('target-core','enemy',2,2,'command-core'),
    unit('remaining','enemy',10,6)]));
  try{
    assert.equal(port.project('ai').view.objectiveRemaining,2);
    commit(port,host,{type:'EndPhase'});
    const shot=host.playerOptions(true).find(({command})=>command.type==='CatalogFire'&&
      command.target.runtimeUnitId==='target-core');
    assert.ok(shot);
    engine.setModalRoll(5);
    commit(port,host,shot.command);
    assert.equal(engine.state().ended,false);
    assert.equal(port.project('ai').view.objectiveRemaining,1);
  }finally{engine.dispose();}
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js'])game.run(readSource(file));
  game.context.source=draft([unit('p','player',1,2),unit('e','enemy',8,5)]);
  await game.run('GoblinEditorDraft.prepare(source).then(config=>loadEditorDraft(config,{roles:{player:"human",enemy:"human"}}))');
  game.run('units.forEach(unit=>{unit.disabled=true})');
  assert.equal(game.run("GoblinCatalogFullRuntime.aiProjection('player').objectiveRemaining"),1);
  assert.equal(game.run("GoblinCatalogFullRuntime.aiProjection('enemy').objectiveRemaining"),1);
  assert.equal(game.run('checkVictory()'),false);
});

test('known-world terminal guards preserve the symmetric public rest for either seat',async()=>{
  for(const side of ['player','enemy'])for(const hidden of [false,true]){
    const opposite=side==='player'?'enemy':'player';
    const source=draft([unit('own',side,2,2),unit('target',opposite,3,2),
      ...(hidden?[unit('hidden',opposite,11,7,'phantom-platform')]:[])]);
    const {engine,port,host}=await engineFor(source);
    try{
      if(side==='enemy')for(let index=0;index<3;index++)commit(port,host,{type:'EndPhase'});
      assert.equal(port.state().side,side);
      const view=port.project('ai').view;
      assert.equal(view.units.some(u=>u.id==='hidden'),false);
      assert.equal(view.objectiveRemaining,hidden?2:1);
      const modeled=engine.applyRootKnowledge(view);
      assert.equal(modeled.unmodeledTargets[opposite],hidden?1:0);
      if(side==='player')commit(port,host,{type:'EndPhase'});
      const opened=port.open('ai');
      const options=side==='player'?host.playerOptions(true):opened.entries;
      const shot=options.find(({command})=>command.type==='CatalogFire'&&
        command.actorId==='own'&&command.target.runtimeUnitId==='target');
      assert.ok(shot);
      engine.setModalRoll(5);
      commit(port,host,shot.command);
      assert.equal(engine.state().ended,!hidden);
      assert.equal(engine.state().winner,hidden?null:side);
    }finally{engine.dispose();}
  }
});

test('symmetric simulation reconstructs a real seeded prefix without changing its owner',async()=>{
  const {engine,port,host}=await engineFor(draft([unit('p','player',1,2),unit('e','enemy',8,5)]),19);
  try{
    const move=host.playerOptions(true).find(entry=>entry.command.type==='Move');
    assert.ok(move);
    commit(port,host,move.command);
    const adapter=createOwnedFullCatalogAiAdapter(port,host);
    const packet=adapter.captureStrongDecision(adapter.open('player'));
    const before=JSON.stringify(packet.snapshot);
    const model=await createSimulationPort(packet,{levelData,
      engineFactory:()=>createHeadlessFullEngine({readSource})});
    try{
      assert.equal(model.open().batch.view.objectives[0].kind,'destroy-opponent-force');
      assert.equal(model.status().ended,false);
    }finally{model.dispose();}
    assert.equal(JSON.stringify(port.simulationSnapshot(port.ticket('ai'))),before);
    const again=await engineFor(packet.snapshot.draft,19);
    try{
      for(const entry of packet.snapshot.replay.entries)commit(again.port,again.host,entry.command);
      const replay=again.port.simulationSnapshot(again.port.ticket('ai')).replay;
      assert.equal(replay.digest,packet.snapshot.replay.digest);
      assert.deepEqual(replay.entries,packet.snapshot.replay.entries);
    }finally{again.engine.dispose();}
  }finally{engine.dispose();}
});

test('four fixed mission IDs accept prepared symmetric data while unlisted IDs remain rejected',async()=>{
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js'])game.run(readSource(file));
  game.context.source=draft([unit('p','player',1,2),unit('e','enemy',6,5)],{width:8,height:8});
  await game.run('GoblinEditorDraft.prepare(source).then(config=>{globalThis.prepared=config})');
  for(const id of ['ai-urban-8','ai-plains-12','ai-mountains-18','ai-coast-24']){
    game.context.missionId=id;
    game.run('ScenarioRuleProfiles.registerFullMission(missionId,prepared);scenarioCatalog[missionId]=prepared;loadScenario(missionId)');
    assert.equal(game.run('legacySession.effectiveRules.objective'),'eliminate-opponent');
    assert.equal(game.run('W'),8);
    assert.equal(game.run('H'),8);
  }
  assert.throws(()=>game.run("ScenarioRuleProfiles.registerFullMission('arbitrary-script',prepared)"));
});

test('symmetric objectives reject asymmetric deadlines and waves instead of executing another rule',async()=>{
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js'])game.run(readSource(file));
  game.context.source=draft([unit('p','player',1,2),unit('e','enemy',8,5)]);
  await game.run('GoblinEditorDraft.prepare(source).then(config=>{globalThis.prepared=config})');
  for(const full of [{turnLimit:1},{deadlineEvent:'core-died'},
    {waves:{version:'catalog-wave-config-v1',waves:[{}]}},{waveTemplates:[{}]}]){
    game.context.fullOverride=full;
    assert.throws(()=>game.run('victoryProfile({...prepared,catalog:{...prepared.catalog,full:{...prepared.catalog.full,...fullOverride}}})'),
      /Unsupported elimination objective combination/);
  }
  for(const source of [draft([unit('p','player',1,2),unit('e','enemy',8,5)],{goals:[{type:'enemy-turn-limit',turns:1}]}),
    draft([unit('p','player',1,2),unit('e','enemy',8,5)],{events:[],waveTemplates:[]})]){
    game.context.source=source;
    await assert.rejects(game.run('GoblinEditorDraft.prepare(source)'));
  }
});
