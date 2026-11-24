import {readFile,readdir,realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {hash,canonical} from './files.mjs';
export async function discover(directory,validateLevel){
 const base=await realpath(directory),files=[],levels=[],ids=new Set();
 async function visit(path){for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isSymbolicLink())throw Error('LEVEL_SYMLINK_NOT_ALLOWED');
  const child=resolve(path,entry.name);if(entry.isDirectory())await visit(child);else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.json'))files.push(child);
 }}await visit(base);
 for(const path of files){
  const bytes=await readFile(path);if(bytes.length>1024*1024)throw Error('LEVEL_FILE_TOO_LARGE');
  let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('LEVEL_JSON_INVALID: '+path);}
  const list=parsed?.version==='goblin-level-package-v3'&&Object.keys(parsed).sort().join(',')==='levels,version'?parsed.levels:[parsed];
  if(!Array.isArray(list)||!list.length)throw Error('LEVEL_PACKAGE_EMPTY');
  for(const level of list){
   if(!level||level.version!=='goblin-level-v3'||!level.id||ids.has(level.id))throw Error('LEVEL_ID_MISSING_OR_DUPLICATE: '+level?.id);
   ids.add(level.id);
   const validated=await validateLevel({level});
   levels.push({id:level.id,level,validation:validated,sha256:hash(canonical(level)),file:relative(base,path).split(sep).join('/'),fileSha256:hash(bytes)});
  }
 }
 if(!levels.length)throw Error('LEVEL_POOL_EMPTY');
 return {directory:base,recursive:true,levels:levels.sort((a,b)=>a.id.localeCompare(b.id))};
}
