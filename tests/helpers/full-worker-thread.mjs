// Exercise the shipped Worker entrypoint in a real Node thread. Only browser
// message transport and file-URL fetch are supplied by this test harness.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='object'&&input.url?input.url:input);
  return url.protocol==='file:'?new Response(await readFile(url)):nativeFetch(input,options);
};
globalThis.addEventListener=(type,listener)=>{
  if(type==='message')parentPort.on('message',data=>listener({data}));
};
globalThis.postMessage=data=>parentPort.postMessage(data);
await import(workerData.entrypoint);
