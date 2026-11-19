import {evaluateStrongBranch} from './strong-search.mjs';
let packet;
async function respond({id,op,value}) {
  if(op==='bind') {
    if(!value?.actions?.length) throw Error('STRONG_SEARCH_EMPTY');
    packet=value;
    return {bound:true};
  }
  if(op!=='evaluate'||!packet) throw Error('STRONG_WORKER_UNBOUND');
  const path=packet.profile==='CORE_IRON_DUST_v2'?'./iron-dust-strong-simulation.mjs':
    packet.profile==='FULL_CATALOG_v1'?'./full-strong-simulation.mjs':null;
  if(!path) throw Error('STRONG_PROFILE_UNSUPPORTED');
  const {createSimulationPort}=await import(path);
  const results=[];
  for(const index of value) results.push(await evaluateStrongBranch(packet,index,createSimulationPort));
  return results;
}
globalThis.addEventListener('message',async({data})=>{
  try {globalThis.postMessage({id:data.id,result:await respond(data)});}
  catch(error) {globalThis.postMessage({id:data.id,error:error.message??'STRONG_WORKER_FAILED',
    diagnosticStack:typeof error.stack==='string'?error.stack:null});}
});
