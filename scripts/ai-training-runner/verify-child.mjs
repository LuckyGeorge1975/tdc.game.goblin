import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const request=JSON.parse(await readFile(process.argv[2],'utf8'));
if(request.engineRoot!==fileURLToPath(new URL('../../',import.meta.url)))throw Error('CHILD_ENGINE_ROOT_CHANGED');
const core=await import(new URL('../ai-training-core/index.mjs',import.meta.url));
const result=JSON.parse(await readFile(request.returnPath,'utf8'));
await core.verifyCase({engineRoot:request.engineRoot,caseRoot:request.runRoot,result,manifest:request.manifest});
process.send?.({verified:true});process.disconnect?.();
