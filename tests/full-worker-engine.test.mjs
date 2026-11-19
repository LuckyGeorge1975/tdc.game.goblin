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
