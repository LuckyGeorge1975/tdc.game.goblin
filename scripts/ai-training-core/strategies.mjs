import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker as NodeWorker} from 'node:worker_threads';
let serial=0,active=false;
export async function installStrategies(game,{observe=()=>{},workers=1}={}){
  assert.ok(!active,'AI_CORE_ONE_CASE_PER_PROCESS');assert.ok(Number.isInteger(workers)&&workers>=1&&workers<=8);
  active=true;
  const full=game.context.GoblinCatalogFullRuntime,policies=new Map(),threads=new Set();
  const workerDescriptor=Object.getOwnPropertyDescriptor(globalThis,'Worker'),navDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  class WorkerBridge{
    constructor(module){this.worker=new NodeWorker(new URL('./node-strong-worker.mjs',import.meta.url),{workerData:{module:module.href}});threads.add(this.worker);}
    addEventListener(name,callback){this.worker.on(name,name==='message'?data=>callback({data}):error=>callback({message:error.message}));}
    postMessage(data){this.worker.postMessage(data);}
    terminate(){return this.worker.terminate();}
  }
  Object.defineProperty(globalThis,'Worker',{value:WorkerBridge,configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:workers*2},configurable:true});
  const observed={...full,registerQualifiedController(policy){
    policies.set(policy.id,policy);
    full.registerQualifiedController({...policy,select(...args){
      const start=performance.now(),cpu=process.cpuUsage();
      const done=key=>{observe(args[0],key,policy,{wallMs:performance.now()-start,cpuUs:process.cpuUsage(cpu)});return key;};
      const result=policy.select(...args);return result&&typeof result.then==='function'?result.then(done):done(result);
    }});
  }};
  const installed={document:{},GoblinV2Flow:{},GoblinCatalogFullRuntime:observed,
    GoblinSpecialistsUI:game.context.GoblinSpecialistsUI,GoblinSpecialistsRuntime:game.context.GoblinSpecialistsRuntime,
    GoblinLanguage:{t:key=>key},fetch:async input=>{
      const url=new URL(input);assert.equal(url.protocol,'file:');url.search='';const data=await readFile(url);
      return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
    }};
  const saved=new Map([...Object.keys(installed),'GoblinFullSeatOwner'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let owner;
  async function dispose(){
    await Promise.allSettled([...threads].map(worker=>worker.terminate()));
    for(const [key,descriptor]of [['Worker',workerDescriptor],['navigator',navDescriptor]]){
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    }
    active=false;
  }
  try{
    Object.assign(globalThis,installed);
    await import(new URL('../../full-standard-seat-owner.mjs?ai-core='+ ++serial,import.meta.url));
    owner=globalThis.GoblinFullSeatOwner;await owner.ready;
    assert.deepEqual(owner.unavailable,[],'AI_CORE_BUILTIN_MODEL_UNAVAILABLE');
  }catch(error){await dispose();throw error;}
  finally{for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
  return {owner,policies,dispose,
    baseSelector(id){
      const policy=policies.get(id);assert.ok(policy,'AI_CORE_BASE_POLICY_UNAVAILABLE');
      return {id,select(batch,port,report,capture){
        return policy.difficulty==='strong'||policy.difficulty===null?policy.select(batch,port,report,capture):policy.select(batch,report);
      }};
    }};
}
