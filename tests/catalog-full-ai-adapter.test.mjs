import assert from 'node:assert/strict';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';
import {createFullCatalogAiAdapter, createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';

const full = id => fullScene(id,7,false,'FULL_CATALOG_v1');
const snapshot = game => [game.state(),read(game,'GoblinCatalogFullRuntime.snapshot()'),game.rng()];
const request = (batch, candidate) => ({schemaVersion:1,decisionId:batch.decisionId,
  revision:batch.revision,key:candidate.key});

function hostFor(game) {
  const player = game.run('({query, dispatch, previewFire})');
  return createFullCatalogAiHost(game.context.GoblinCatalogFullRuntime,
    game.context.GoblinSpecialistsUI,player,()=>game.run('phase'),game.context.GoblinSpecialistsRuntime);
}

function schedule(game, fire = null, step = null) {
  Object.assign(game.context,{chooseStep:step,chooseFire:fire});
  game.run("setTurnPhase('fire');setTurnPhase('gev');startEnemyTurn(chooseStep,chooseFire)");
  const job = [...game.timers].find(([,callback])=>String(callback).includes('const foes='));
  assert.ok(job);
  game.timers.delete(job[0]);
  return job[1];
}

function closeAtlas(game) {
  game.run(`const shooter=units.find(u=>u.id==='catalog-full-atlas-20');
    const targetSystem=units.find(u=>u.id==='catalog-full-atlas-1');
    const opposing=units.find(u=>u.id==='catalog-full-atlas-2');
    shooter.x=1;shooter.y=1;targetSystem.x=2;targetSystem.y=1;opposing.x=1;opposing.y=2;
    terrain.clear();terrainTypes.clear();GoblinCatalogFullRuntime.refresh();`);
}

test('player projection excludes concealed Phantom and dispatch revalidates after revision change',async()=>{
  const g = await full('catalog-full-atlas');
  g.run(`const phantom=units.find(u=>u.catalogId==='U21');
    phantom.x=11;phantom.y=7;GoblinCatalogFullRuntime.refresh();`);
  let generation=1;
  const adapter=createFullCatalogAiAdapter(hostFor(g),()=>generation);
  const before=snapshot(g);
  const batch=adapter.open('player');
  assert.equal(batch.ok,true);
  const phantomId=g.run('phantom.id');
  assert.equal(JSON.stringify(batch).includes(phantomId),false);
  assert.equal(adapter.open('enemy').ok,false);
  assert.deepEqual(snapshot(g),before);
  const candidate=batch.candidates.find(c=>c.kind==='move');
  assert.ok(candidate);
  generation++;
  assert.equal(adapter.execute(request(batch,candidate)).code,'AI_STALE_DECISION');
  const next=adapter.open('player');
  const move=next.candidates.find(c=>c.kind==='move');
  const result=adapter.execute(request(next,move));
  assert.equal(result.ok,true);
  assert.equal(result.action.type,'Move');
  assert.deepEqual(read(g,`units.filter(u=>u.id===${JSON.stringify(move.actorId)}).map(u=>[u.x,u.y])`),[[move.target.x,move.target.y]]);
  assert.equal(adapter.execute(request(next,move)).code,'AI_STALE_DECISION');
});

test('Atlas selects an alternative component in the same enemy weapon slot',async()=>{
  const g=await full('catalog-full-atlas');closeAtlas(g);
  const adapter=createFullCatalogAiAdapter(hostFor(g),()=>1);
  let proof, oldExecute, oldRequest;
  schedule(g,adapter.chooseEnemyFire((batch,execute)=>{
    if(!batch.ok || proof || batch.candidates[0]?.actorId!=='catalog-full-atlas-20')return;
    const baseline=batch.candidates.find(c=>c.facts.baseline);
    const alternative=batch.candidates.find(c=>c.target?.kind==='component'&&c.target.componentId==='treads'&&c.key!==baseline.key);
    assert.ok(alternative);
    assert.equal(alternative.facts.effectKind,'tread-roll-5-6');
    assert.equal(alternative.facts.ratioCategory,null);
    assert.equal(batch.slot,'first');
    assert.ok(batch.candidates.every(c=>c.weaponRef===baseline.weaponRef));
    assert.equal(batch.view.units.find(u=>u.id===alternative.actorId).relation,'own');
    const draws=g.rolls();
    oldRequest=request(batch,alternative);oldExecute=execute;
    const result=execute(oldRequest);
    assert.equal(result.ok,true);
    assert.equal(result.action.target.componentId,'treads');
    assert.equal(g.rolls(),draws+1);
    assert.equal(read(g,'shooter.specialistJournal.at(-1).command.target.componentId'),'treads');
    assert.equal(execute(oldRequest).code,'AI_STALE_DECISION');
    proof=true;
  }))();
  assert.ok(proof);
  assert.equal(oldExecute(oldRequest).code,'AI_STALE_DECISION');
  assert.equal(g.run('phase'),'player');
});

test('FULL baseline selection matches the existing turn and stale session cannot fire',async()=>{
  const expected=await full('catalog-full-atlas');closeAtlas(expected);schedule(expected)();
  const g=await full('catalog-full-atlas');closeAtlas(g);
  const adapter=createFullCatalogAiAdapter(hostFor(g),()=>1);
  let selected=0;
  schedule(g,adapter.chooseEnemyFire((batch,execute)=>{
    assert.equal(batch.ok,true);
    const baseline=batch.candidates.find(c=>c.facts.baseline);
    assert.equal(execute(request(batch,baseline)).ok,true);
    selected++;
  }))();
  assert.ok(selected>1);
  assert.deepEqual(snapshot(g),snapshot(expected));
  const restarted=await full('catalog-full-atlas');closeAtlas(restarted);
  const next=createFullCatalogAiAdapter(hostFor(restarted),()=>1);
  let afterRestart;
  schedule(restarted,next.chooseEnemyFire((batch,execute)=>{
    restarted.run("loadScenario('catalog-full-atlas')");
    afterRestart=snapshot(restarted);
    assert.equal(execute(request(batch,batch.candidates[0])).code,'AI_STALE_DECISION');
  }))();
  assert.ok(afterRestart);
  assert.deepEqual(snapshot(restarted),afterRestart);
});

test('Hold at the existing first slot leaves the retry fire choice available',async()=>{
  const g=await full('catalog-full-atlas');closeAtlas(g);
  const adapter=createFullCatalogAiAdapter(hostFor(g),()=>1);
  const observed=[];
  const step=adapter.chooseEnemyStep((batch,execute)=>{
    if(batch.candidates[0]?.actorId!=='catalog-full-atlas-20')return;
    const hold=batch.candidates.find(c=>c.kind==='hold');
    const result=execute(request(batch,hold));
    observed.push([batch.slot,result.ok]);
  });
  const fire=adapter.chooseEnemyFire(batch=>{
    if(batch.candidates[0]?.actorId==='catalog-full-atlas-20' && observed.length===1)
      observed.push([batch.slot,batch.candidates.some(c=>c.facts.baseline)]);
  });
  schedule(g,fire,step)();
  assert.deepEqual(observed,[['first-movement',true],['retry',true]]);
});
