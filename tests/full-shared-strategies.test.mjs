import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
import {selectWeakFullCatalog,selectMediumFullCatalog} from '../src/core/full-catalog-difficulty.mjs';
import {prepareFullAttack2a,FULL_ATTACK_2A_ENGINE,FULL_ATTACK_2A_ID} from '../src/core/full-attack-2a.mjs';
import {prepareDefenderTrial} from '../src/core/full-defender-trial.mjs';
import {createStrongSearchController} from '../src/core/strong-search-controller.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const attacker=await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,
  modelBytes:Buffer.from(JSON.parse(read('assets/ai/full-attack-2a.json')).base64,'base64')});
const defender=await prepareDefenderTrial('full-defender-control-trial',
  readFileSync(new URL('../assets/ai/full-defender-control-trial.json',import.meta.url)));
const trained=side=>side==='player'?FULL_ATTACK_2A_ID:'full-defender-control-trial';
function transport(){
  const threads=[];
  return {threads,factory(){
    const worker=new Worker(new URL('./helpers/full-worker-thread.mjs',import.meta.url),{workerData:{
      entrypoint:new URL('../src/core/strong-search.worker.mjs',import.meta.url).href}});
    threads.push(worker);
    return {addEventListener(type,listener){worker.on(type,data=>listener(type==='message'?{data}:{message:data.message}));},
      postMessage:value=>worker.postMessage(value),terminate:()=>worker.terminate()};
  }};
}
async function setup(side,kind,source){
  const game=await fullScene();for(const file of ['level-events.js','editor-draft.js'])game.run(read(file));
  const full=game.context.GoblinCatalogFullRuntime,workers=transport(),searches=[];
  for(const seat of ['player','enemy']){
    full.registerQualifiedController({side:seat,id:seat+'-weak',difficulty:'weak',select:selectWeakFullCatalog});
    full.registerQualifiedController({side:seat,id:seat+'-medium',difficulty:'medium',select:selectMediumFullCatalog});
    let controller;
    full.registerQualifiedController({side:seat,id:seat+'-strong',difficulty:'strong',select(batch,_port,report,capture){
      controller??=createStrongSearchController({profile:'FULL_CATALOG_v1',capture,
        reference:selectMediumFullCatalog,workerFactory:workers.factory,hardwareConcurrency:8,
        onSearch:search=>searches.push(search)});
      return controller.select(batch,report);
    }});
  }
  full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select:attacker});
  full.registerQualifiedController({side:'enemy',id:trained('enemy'),difficulty:null,
    select:(batch,_port,report)=>defender(batch,report)});
  game.context.source=source;
  const roles={player:side==='player'?'ai':'human',enemy:side==='enemy'?'ai':'human'};
  game.context.control={roles,policyIds:{[side]:kind==='trained'?trained(side):side+'-'+kind},seed:7,
    ui:{handoff(_seat,take){take();}}};
  await game.run('GoblinEditorDraft.prepare(source).then(config=>{globalThis.port=loadEditorDraft(config,control)})');
  const port=game.context.port;
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  if(side==='enemy')for(let i=0;i<3;i++)
    assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'},player.dispatch).ok,true);
  const evidence=[];
  const host=createOwnedFullCatalogSessionHost({port,player,onCommit(result,before,report){
    evidence.push({result,side:before.side,report});
    if(port.state().side===before.side&&result.action.type!=='EndPhase'){
      const snapshot=JSON.stringify(full.snapshot());
      assert.equal(port.undo(port.ticket('ai')),false);
      game.run('undoPhaseCommand()');
      assert.equal(JSON.stringify(full.snapshot()),snapshot,'human Back cannot rewind an AI-owned accepted action');
    }
  }});
  return {game,full,port,player,host,evidence,searches,workers,
    async leave(){host.leave();await Promise.all(workers.threads.map(worker=>worker.terminate()));}};
}

test('all four strategies make only native own-turn decisions on both shared FULL seats',async()=>{
  const terrain=[];
  const land=new Set(['1,1','1,2','4,3','4,2']);
  for(let y=0;y<5;y++)for(let x=0;x<6;x++)if(!land.has(x+','+y))terrain.push({x,y,type:'water'});
  const source={version:'goblin-level-v3',width:6,height:5,objective:'eliminate-opponent',terrain,units:[
    {id:'p',assetId:'assault-tank',team:'player',x:1,y:1},
    {id:'e',assetId:'assault-tank',team:'enemy',x:4,y:3}]};
  for(const kind of ['weak','medium','trained','strong'])for(const side of ['player','enemy']){
    const f=await setup(side,kind,source);
    try{
      const count=f.player.playerOptions(true).length+1;
      assert.equal(count,2);
      for(let step=0;f.port.state().side===side&&step<10;step++)
        assert.equal((await f.host.advance()).ok,true,side+'/'+kind);
      assert.notEqual(f.port.state().side,side);
      assert.ok(f.evidence.length>=3);
      assert.ok(f.evidence.every(entry=>entry.side===side));
      assert.equal(f.port.canUndo(),false);
      const before=f.evidence.length,searches=f.searches.length;
      assert.equal((await f.host.advance()).code,'AI_HOST_WRONG_SIDE');
      assert.equal(f.evidence.length,before);
      assert.equal(f.searches.length,searches);
      if(kind==='strong'){
        assert.equal(f.workers.threads.length,4);
        assert.equal(f.searches[0].branches.length,count);
        assert.deepEqual(f.searches[0].branches.map(branch=>branch.index),[0,1]);
        assert.ok(f.searches[0].branches.every(branch=>branch.final.ended||branch.final.side===side));
      }
    }finally{await f.leave();}
  }
});

test('both real pinned models evaluate their original fire features and commit native actions',async()=>{
  const source={version:'goblin-level-v3',width:6,height:5,objective:'eliminate-opponent',terrain:[],units:[
    {id:'p',assetId:'assault-tank',team:'player',x:2,y:2},
    {id:'e',assetId:'assault-tank',team:'enemy',x:3,y:2}]};
  for(const side of ['player','enemy']){
    const f=await setup(side,'trained',source);
    try{
      assert.equal(f.port.commit('ai',f.port.open('ai').permit,{type:'EndPhase'},f.player.dispatch).ok,true);
      assert.equal((await f.host.advance()).ok,true);
      assert.equal(f.evidence.length,1);
      assert.equal(f.evidence[0].result.action.type,'CatalogFire');
      const reported=f.evidence[0].report;
      assert.ok(['v2.round.modelTarget','v2.round.modelBaseline'].includes(reported.explanationKey));
      assert.ok(reported.options.some(option=>Number.isFinite(option.scores.model)));
    }finally{await f.leave();}
  }
  assert.throws(()=>defender({ok:true,side:'player',slot:'fire',phase:'fire',candidates:[]}),/FULL_DEFENDER_TRIAL_SCOPE/);
  assert.throws(()=>defender({ok:true,side:'enemy',slot:'first',phase:'enemy',candidates:[]}),/FULL_DEFENDER_TRIAL_SCOPE/);
});

test('two accepted own moves in the same public phase receive distinct permissions and each replan once',async()=>{
  for(const side of ['player','enemy']){
    const source={version:'goblin-level-v3',width:8,height:8,objective:'eliminate-opponent',terrain:[],units:[
      {id:'p1',assetId:'assault-tank',team:'player',x:1,y:1},
      {id:'p2',assetId:'assault-tank',team:'player',x:1,y:3},
      {id:'e1',assetId:'assault-tank',team:'enemy',x:6,y:6},
      {id:'e2',assetId:'assault-tank',team:'enemy',x:6,y:4}]};
    const f=await setup(side,'weak',source);
    try{
      const first=f.port.ticket('ai');
      assert.equal((await f.host.advance()).ok,true);
      const second=f.port.ticket('ai');
      assert.equal(f.port.state().slot,'movement');
      assert.equal((await f.host.advance()).ok,true);
      const third=f.port.ticket('ai');
      assert.equal(f.port.state().slot,'movement');
      assert.ok(first.slot<second.slot&&second.slot<third.slot);
      assert.notEqual(first.revision,second.revision);
      assert.notEqual(second.revision,third.revision);
      assert.equal(f.evidence.length,2);
      assert.ok(f.evidence.every(entry=>entry.side===side&&entry.result.action.type==='Move'));
      assert.equal(new Set(f.evidence.map(entry=>entry.result.action.actorId)).size,2);
      assert.equal(f.port.commit('ai',first,{type:'EndPhase'},f.player.dispatch).ok,false);
      assert.equal((await f.host.advance()).ok,true);
      assert.equal(f.port.state().phase,'fire');
    }finally{await f.leave();}
  }
});
