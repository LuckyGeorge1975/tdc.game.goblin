import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from '../src/core/full-catalog-ai-adapter.mjs';
import {createHeadlessFullEngine} from '../src/core/full-worker-engine.mjs';
import {createSimulationPort} from '../src/core/full-strong-simulation.mjs';
import {evaluateStrongBranch} from '../src/core/strong-search.mjs';

test('FULL simulation reconstructs the native seed prefix and completes a response without changing its live owner',async()=>{
  const game=await fullScene('catalog-full-terrain-course');
  const full=game.context.GoblinCatalogFullRuntime;
  for(const side of ['player','enemy'])
    full.registerQualifiedController({side,id:side+'-strong',difficulty:'strong',select(){throw Error('unused');}});
  game.run(`globalThis.port=loadScenario('catalog-full-terrain-course',{
    roles:{player:'ai',enemy:'ai'},policyIds:{player:'player-strong',enemy:'enemy-strong'},seed:7})`);
  const port=game.context.port;
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state().side,game.context.GoblinSpecialistsRuntime);
  const adapter=createOwnedFullCatalogAiAdapter(port,player);
  const batch=adapter.open('player');
  const packet=adapter.captureStrongDecision(batch);
  assert.equal(packet.actions.length,batch.candidates.length);
  const before=JSON.stringify(packet.snapshot);
  const options={
    levelData:JSON.parse(readFileSync(new URL('../assets/unit-art/levels/catalog-full-levels.v3.json',import.meta.url),'utf8')),
    engineFactory:()=>createHeadlessFullEngine({readSource:path=>
      readFileSync(new URL('../'+path,import.meta.url),'utf8')})
  };
  const result=await evaluateStrongBranch(packet,packet.actions.findIndex(entry=>entry.action.type==='EndPhase'),
    captured=>createSimulationPort(captured,options));
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.final.ended||result.final.side==='player');
  assert.ok(result.continuation.some(entry=>entry.side==='enemy'));
  assert.equal(JSON.stringify(adapter.captureStrongDecision(batch).snapshot),before);
  port.pause();
  assert.equal(adapter.captureStrongDecision(batch),null);
  port.resume();
  assert.equal(adapter.captureStrongDecision(batch),null);
});

test('FULL models a real native shot over six W6 outcomes and preserves the live seed cursor',async()=>{
  const game=await fullScene('catalog-full-terrain-course');
  for(const file of ['level-events.js','editor-draft.js'])
    game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  const full=game.context.GoblinCatalogFullRuntime;
  for(const side of ['player','enemy'])
    full.registerQualifiedController({side,id:side+'-strong',difficulty:'strong',select(){throw Error('unused');}});
  await game.run(`GoblinEditorDraft.prepare({version:'goblin-level-v3',width:6,height:5,
    objective:'core-and-escort',terrain:[],units:[
      {id:'assault',assetId:'assault-tank',team:'player',x:1,y:1},
      {id:'guard',assetId:'guard-tank',team:'enemy',x:2,y:1},
      {id:'core',assetId:'command-core',team:'enemy',x:4,y:1}
    ]}).then(config=>{globalThis.port=loadEditorDraft(config,{roles:{player:'ai',enemy:'ai'},
      policyIds:{player:'player-strong',enemy:'enemy-strong'},seed:7})})`);
  const port=game.context.port;
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state().side,game.context.GoblinSpecialistsRuntime);
  assert.equal(port.commit('ai',port.ticket('ai'),{type:'EndPhase'},player.dispatch).ok,true);
  const adapter=createOwnedFullCatalogAiAdapter(port,player);
  const batch=adapter.open('player'), packet=adapter.captureStrongDecision(batch);
  const before=JSON.stringify(packet.snapshot);
  const simulation=await createSimulationPort(packet,{
    levelData:JSON.parse(readFileSync(new URL('../assets/unit-art/levels/catalog-full-levels.v3.json',import.meta.url),'utf8')),
    engineFactory:()=>createHeadlessFullEngine({readSource:path=>
      readFileSync(new URL('../'+path,import.meta.url),'utf8')})
  });
  try {
    const shot=packet.actions.find(entry=>entry.action.type==='CatalogFire');
    assert.ok(shot);
    const result=simulation.commit(shot.action);
    assert.ok(Number.isFinite(result.expectedAdjustment));
    assert.notEqual(result.expectedAdjustment,0);
    assert.equal(JSON.stringify(adapter.captureStrongDecision(batch).snapshot),before);
  } finally {simulation.dispose();}
});
