import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {artilleryScene,queryBridge,read} from './artillery-product-harness.mjs';
import {catalogScene} from './catalog-product-harness.mjs';
import {specialistsScene} from './catalog-specialists-harness.mjs';
import {apply,route,trainingScene} from './training-product-harness.mjs';
import {createLegacyAiAdapter} from '../src/core/legacy-ai-adapter.mjs';

const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const hostSource=ui.slice(ui.indexOf('    function legacyCommands('),ui.indexOf('    const targetCommands ='));
const occupant=ui.split('\n').find(line=>line.startsWith('    const targetOccupant ='));
const adapterFor=g=>{
  g.run(occupant+'\n'+hostSource);
  return createLegacyAiAdapter(g.run('legacyAiHost()'));
};
const request=(batch,option)=>({schemaVersion:1,decisionId:batch.decisionId,revision:batch.revision,key:option.key});
const state=g=>[g.state(),g.rng(),read(g,'phaseCommands.length')];

function enemy(g,choose=null){
  g.context.choose=choose;
  g.run("setTurnPhase('fire');setTurnPhase('gev');startEnemyTurn(undefined,choose)");
  const entry=[...g.timers].find(([,fn])=>String(fn).includes('const foes='));
  assert.ok(entry);
  g.timers.delete(entry[0]);entry[1]();
}

test('move uses native history and BACK invalidates a pending decision at the restored state',()=>{
  const g=artilleryScene(false);
  queryBridge(g);g.run("loadScenario('iron-dust')");
  const adapter=adapterFor(g), before=state(g), old=adapter.open('player');
  assert.equal(old.ok,true);
  assert.deepEqual(state(g),before);
  assert.ok(old.view.units.every(unit=>unit.relation==='own'||unit.relation==='opponent'));
  assert.equal(old.view.terrain.width,g.run('W'));
  const move=old.candidates.find(c=>c.kind==='move');
  g.context.move={type:'Move',actorId:move.actorId,x:move.target.x,y:move.target.y};
  assert.equal(g.run('dispatch(move,revision()).ok'),true);
  assert.equal(g.run('phaseCommands.length'),1);
  g.run('undoPhaseCommand()');
  assert.equal(adapter.execute(request(old,move)).code,'AI_STALE_DECISION');
  const current=adapter.open('player');
  const next=current.candidates.find(c=>c.actorId===move.actorId&&c.target?.x===move.target.x&&c.target?.y===move.target.y);
  assert.equal(adapter.execute(request(current,next)).ok,true);
  assert.equal(g.run('phaseCommands.length'),1);
  assert.equal(adapter.execute(request(current,next)).code,'AI_STALE_DECISION');
});

function legacyFireSetup(){
  const g=artilleryScene(false);queryBridge(g);
  g.run(`loadScenario('iron-dust');terrain.clear();terrainTypes.clear();
    const guard=units.find(u=>u.id==='guard'), ogre=units.find(u=>u.id==='ogre'), scout=units.find(u=>u.id==='gev');
    Object.assign(guard,{x:5,y:4});Object.assign(ogre,{x:4,y:4});Object.assign(scout,{x:5,y:5});`);
  return g;
}

test('legacy fire baseline matches historical runtime and alternate target uses the native resolver',()=>{
  const direct=legacyFireSetup();enemy(direct);
  const g=legacyFireSetup(), adapter=adapterFor(g);
  let attempts=0;
  enemy(g,adapter.chooseEnemyFire((batch,execute)=>{
    const baseline=batch.candidates?.find(c=>c.facts.baseline);
    if(execute(request(batch,baseline)).ok)attempts++;
  }));
  assert.ok(attempts>0);assert.deepEqual(state(g),state(direct));

  const other=legacyFireSetup(), alternativeAdapter=adapterFor(other);
  let attempt;
  enemy(other,alternativeAdapter.chooseEnemyFire((batch,execute)=>{
    if(attempt||batch.candidates?.[0]?.actorId!=='guard')return;
    const chosen=batch.candidates.find(c=>!c.facts.baseline);
    const before=other.rolls(), selection=request(batch,chosen);
    const result=execute(selection);
    attempt={chosen,result,draws:other.rolls()-before,replay:execute(selection),late:()=>execute(selection)};
  }));
  assert.ok(attempt.chosen);
  assert.equal(attempt.result.ok,true);
  assert.equal(attempt.result.action.targetId,attempt.chosen.target.unitId);
  assert.equal(attempt.draws,1);
  assert.equal(attempt.replay.code,'AI_STALE_DECISION');
  assert.equal(attempt.late().code,'AI_STALE_DECISION');
});

test('catalog transports and specialist typed component shots use their current native queries',async()=>{
  const transport=await catalogScene();
  const carrier=adapterFor(transport);
  const phase=carrier.open('player');
  assert.ok(phase.candidates.some(c=>c.kind==='load'));
  const deployed=phase.candidates.find(c=>c.kind==='move');
  assert.equal(carrier.execute(request(phase,deployed)).ok,true);
  const g=await specialistsScene(), adapter=adapterFor(g);
  g.run("units.find(u=>u.id==='alpha').x=6;units.find(u=>u.id==='alpha').y=1");
  g.context.rollQueue=Array(40).fill(0);
  let receipt;
  enemy(g,adapter.chooseEnemyFire((batch,execute)=>{
    const component=batch.candidates?.find(c=>c.target?.kind==='component'&&!c.facts.baseline);
    if(!receipt&&component)receipt=execute(request(batch,component));
  }));
  assert.equal(receipt?.ok,true);
  assert.equal(receipt.action.type,'CatalogFire');
  assert.equal(receipt.action.target.kind,'component');
});

test('artillery pilot direct and spotter candidates use existing weapon selection and dispatch',()=>{
  const g=artilleryScene(false);queryBridge(g);
  g.run("units.find(u=>u.id==='long-range-battery').x=5;setTurnPhase('fire');terrain.clear();terrainTypes.clear()");
  const adapter=adapterFor(g), batch=adapter.open('player');
  const indirect=batch.candidates.find(c=>c.facts.mode==='indirect');
  assert.ok(indirect);
  assert.ok(batch.candidates.some(c=>c.facts.mode==='direct'));
  const result=adapter.execute(request(batch,indirect));
  assert.equal(result.ok,true);assert.equal(result.action.type,'FireArtillery');
  assert.equal(result.action.mode,'indirect');
});

test('T01 and T02 allow native human actions with their learning holds and deny AI batches',async()=>{
  const t01=await trainingScene(), a=adapterFor(t01);
  const actions=route('training-t01');
  for(const step of actions.slice(0,4))apply(t01,step);
  assert.equal(a.open('player').ok,false);
  apply(t01,actions[4]);
  t01.run("document.querySelector('#auto-end-turn').checked=true;maybeAutoAdvancePhase()");
  assert.deepEqual(read(t01,"[turnPhase,GoblinTrainingRuntime.view().progress.stepId,phaseCommands.length]"),['movement','undo',1]);

  const t02=await trainingScene('training-t02'), b=adapterFor(t02);
  for(const step of route('training-t02').slice(0,5))apply(t02,step);
  assert.equal(b.open('player').ok,false);
  apply(t02,route('training-t02')[5]);
  t02.run("document.querySelector('#auto-end-turn').checked=true;maybeAutoAdvancePhase()");
  await t02.run("confirmPhaseAdvance(()=>setTurnPhase('gev'))");
  assert.deepEqual(read(t02,"[turn,turnPhase,GoblinTrainingRuntime.view().progress.stepId]"),[1,'fire','result']);
});

test('T03 blocked-sight instruction is a native lesson step that legal gameplay cannot satisfy',async()=>{
  const g=await trainingScene('training-t03'), adapter=adapterFor(g);
  const actions=route('training-t03');
  for(const step of actions.slice(0,3))apply(g,step);
  apply(g,actions[3]);
  const blocked=actions[4].command;
  assert.equal(g.run(`query(${JSON.stringify(blocked)}).ok`),false);
  assert.equal(g.run("GoblinTrainingRuntime.view().progress.stepId"),'blocked');
  assert.equal(adapter.open('player').ok,false);
  apply(g,actions[4]);
  assert.equal(g.run("GoblinTrainingRuntime.view().progress.stepId"),'blocked-read');
});
