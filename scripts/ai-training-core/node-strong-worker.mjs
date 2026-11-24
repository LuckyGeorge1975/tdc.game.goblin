// Node transport for the unchanged browser Strong worker and native simulation.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
globalThis.addEventListener=(name,callback)=>{if(name==='message')parentPort.on('message',data=>callback({data}));};
globalThis.postMessage=data=>parentPort.postMessage(data);
globalThis.fetch=async input=>{
  const url=new URL(input);if(url.protocol!=='file:')throw Error('AI_CORE_WORKER_NONLOCAL_FETCH');url.search='';
  const data=await readFile(url);
  return {ok:true,text:async()=>data.toString('utf8'),json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
};
await import(workerData.module);
