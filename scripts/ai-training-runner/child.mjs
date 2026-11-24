import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const [requestPath]=process.argv.slice(2);
const stop=new AbortController();
process.on('message',message=>{if(message?.type==='stop')stop.abort();});
process.on('SIGINT',()=>stop.abort());process.on('SIGTERM',()=>stop.abort());
process.on('disconnect',()=>stop.abort());
const started=new Promise((accept,reject)=>{process.once('disconnect',()=>reject(Error('CONTROLLER_DISCONNECTED_BEFORE_START')));process.on('message',message=>{if(message?.type==='start')accept();});});
const request=JSON.parse(await readFile(requestPath,'utf8'));
await started;
if(request.engineRoot!==fileURLToPath(new URL('../../',import.meta.url)))throw Error('CHILD_ENGINE_ROOT_CHANGED');
if(request.runRoot!==resolve(dirname(requestPath),'capture')||request.returnPath!==resolve(dirname(requestPath),'returned.json'))throw Error('CHILD_CASE_ROOT_CHANGED');
const core=await import(new URL('../ai-training-core/index.mjs',import.meta.url));
try{
 const result=await core.runCase({...request,signal:stop.signal});
 await writeFile(request.returnPath,JSON.stringify(result)+'\n',{flag:'wx'});
 process.send?.({type:'complete'});
}catch(error){console.error(error.stack??String(error));process.exitCode=1;}
finally{process.disconnect?.();}
