import {parentPort,workerData} from 'node:worker_threads';
globalThis.addEventListener=(type,listener)=>{
  if(type==='message') parentPort.on('message',data=>listener({data}));
};
globalThis.postMessage=data=>parentPort.postMessage(data);
await import(workerData.module);
