import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let serial=0;
export async function productionOwner(game){
 const installed={document:{},GoblinV2Flow:{},GoblinCatalogFullRuntime:game.context.GoblinCatalogFullRuntime,
  GoblinSpecialistsUI:game.context.GoblinSpecialistsUI,GoblinSpecialistsRuntime:game.context.GoblinSpecialistsRuntime,
  GoblinLanguage:{t:key=>key},fetch:async input=>{
   const url=new URL(input);url.search='';const data=await readFile(url);
   return {ok:true,json:async()=>JSON.parse(data.toString('utf8')),
    arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
  }};
 const saved=Object.fromEntries([...Object.keys(installed),'GoblinFullSeatOwner'].map(key=>[key,globalThis[key]]));
 try{
  Object.assign(globalThis,installed);
  await import('../../full-standard-seat-owner.mjs?provenance-test='+ ++serial);
  const owner=globalThis.GoblinFullSeatOwner;await owner.ready;assert.deepEqual(owner.unavailable,[]);return owner;
 }finally{
  for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
}
