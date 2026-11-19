import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker} from 'node:worker_threads';
import {createIronDustProfile,dispatchIronDustProfile,forkIronDustProfileRng} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustAiAdapter} from '../src/core/iron-dust-ai-adapter.mjs';
import {captureIronDustStrongDecision,createSimulationPort} from '../src/core/iron-dust-strong-simulation.mjs';
import {evaluateStrongBranch} from '../src/core/strong-search.mjs';
import {createStrongSearchController} from '../src/core/strong-search-controller.mjs';
import {strongWorkerCount} from '../src/core/strong-worker-pool.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from './iron-dust-source-victory-trace.v2.mjs';

const at=index=>victory.commands.slice(0,index).reduce((p,c)=>dispatchIronDustProfile(p,c).profile,createIronDustProfile(8));
function transport() {
  const workers=[];
  return {workers,factory() {
    const worker=new Worker(new URL('./helpers/strong-node-worker.mjs',import.meta.url),{
      workerData:{module:new URL('../src/core/strong-search.worker.mjs',import.meta.url).href}});
    const wrapper={messages:0,terminated:false,addEventListener(type,fn) {
      worker.on(type,data=>fn(type==='message'?{data}:{message:data.message}));
    },postMessage(data){wrapper.messages++;worker.postMessage(data);},
    terminate(){wrapper.terminated=true;return worker.terminate();}};
    workers.push(wrapper);
    return wrapper;
  }};
}
const packetFor=profile=>{
  const batch=createIronDustAiAdapter(()=>({state:profile,generation:1}),{objectiveAttack:true,explicitEnemyMovement:true})
    .open(profile.entry.mode==='enemy'?'enemy':'player');
  return {batch,packet:captureIronDustStrongDecision(profile,batch)};
};

test('worker allocation reserves hardware and caps the pool',()=>{
  assert.deepEqual([1,2,4,8,32].map(strongWorkerCount),[1,1,2,4,8]);
});

test('a native opponent turn with no available actors still completes the model response',async()=>{
  let turn=1;
  const result=await evaluateStrongBranch({side:'player',actions:[{index:0,action:{type:'EndPhase'}}]},0,()=>({
    status:()=>({side:'player',turn,ended:false,winner:null}),
    commit(){turn++;return {events:[]};},
    open(){throw Error('an additional own turn would exceed the response boundary');},
    evaluate:()=>0
  }));
  assert.equal(result.continuation.length,1);
  assert.equal(result.final.turn,2);
});

test('all native Iron Dust defender fire choices get complete modal reply branches without consuming live RNG',async()=>{
  const profile=at(13),initial=JSON.stringify(profile),{batch,packet}=packetFor(profile);
  const other=packetFor(forkIronDustProfileRng(profile,246813579)).packet;
  const before=await evaluateStrongBranch(packet,0,createSimulationPort);
  const alternate=await evaluateStrongBranch(other,0,createSimulationPort);
  assert.equal(before.score,alternate.score);
  assert.deepEqual(before.continuation,alternate.continuation);
  assert.equal(before.final.ended||before.final.side==='enemy',true);
  assert.ok(before.continuation.some(step=>step.side==='player'));
  const messages=transport();
  const runs=[];
  const controller=createStrongSearchController({capture:value=>captureIronDustStrongDecision(profile,value),
    profile:'CORE_IRON_DUST_v2',hardwareConcurrency:4,workerFactory:messages.factory,onSearch:run=>runs.push(run)});
  try {
    const key=await controller.select(batch);
    assert.ok(batch.candidates.some(candidate=>candidate.key===key));
    assert.equal(runs[0].branches.length,batch.candidates.length);
    assert.equal(messages.workers.length,2);
    assert.ok(runs[0].branches.every(branch=>branch.final.ended||branch.final.side==='enemy'));
    assert.ok(runs[0].branches.every(branch=>branch.continuation.some(step=>step.side==='player')||branch.final.ended));
    await controller.select(batch);
    assert.equal(messages.workers.length,2);
    assert.equal(JSON.stringify(profile),initial);
  } finally {controller.stop();}
  assert.ok(messages.workers.every(worker=>worker.terminated));
});

test('equal full-turn evaluations preserve EndPhase instead of repeating weapon setup',async()=>{
  const profile=dispatchIronDustProfile(createIronDustProfile(8),{type:'EndPhase',playerId:'player'}).profile;
  const {batch,packet}=packetFor(profile),messages=transport();
  assert.ok(batch.candidates.some(candidate=>candidate.kind==='select-weapon'));
  const controller=createStrongSearchController({capture:()=>packet,profile:'CORE_IRON_DUST_v2',
    workerFactory:messages.factory,hardwareConcurrency:2});
  try {
    const chosen=await controller.select(batch);
    assert.equal(batch.candidates.find(candidate=>candidate.key===chosen).kind,'end-phase');
  } finally {controller.stop();}
});

test('an invalidated search cannot publish a delayed worker choice',async()=>{
  const {batch,packet}=packetFor(at(13));
  const messages=transport(),runs=[];
  const controller=createStrongSearchController({capture:()=>packet,profile:'CORE_IRON_DUST_v2',
    workerFactory:messages.factory,hardwareConcurrency:2,onSearch:run=>runs.push(run)});
  const pending=controller.select(batch);
  controller.invalidate();
  await assert.rejects(pending,/STRONG_SEARCH_STOPPED/);
  assert.equal(runs.length,0);
  controller.stop();
  assert.ok(messages.workers.every(worker=>worker.terminated));
});
