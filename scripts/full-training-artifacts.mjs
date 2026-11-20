import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalSources,normalizeSource} from '../full-training-source-binding.mjs';
import {gameplaySourceHashes} from '../tests/helpers/replay-source-binding.mjs';

export const engineRoot=fileURLToPath(new URL('../',import.meta.url));
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const text=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
export const textHash=bytes=>hash(normalizeSource(text(bytes)));
export const json=bytes=>JSON.parse(text(bytes));
export const bytes=value=>Buffer.from(JSON.stringify(value)+'\n');
export function canonicalBytes(value){
 const sorted=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(sorted):
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])]))):value;
 return bytes(sorted(value));
}
export const currentSourcesHash=()=>hash(canonicalSources(gameplaySourceHashes()));
export const isHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const isCommit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export function check(value,code='FULL_TRAINING_ARTIFACT_INVALID'){assert.ok(value,code);}
export function freeze(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
 return value;
}
export async function artifact(root,path,expected,{raw=false}={}){
 check(typeof path==='string'&&path.length>0&&!isAbsolute(path)&&!path.includes('\\')&&
  !path.includes(':')&&!path.split('/').some(part=>!part||part==='.'||part==='..'));
 check(isHash(expected));
 const base=await realpath(root), absolute=await realpath(resolve(base,path));
 const child=relative(base,absolute);
 check(child&&child!=='..'&&!child.startsWith('..'+sep)&&!isAbsolute(child));
 const data=await readFile(absolute);
 check((raw?hash(data):textHash(data))===expected,'FULL_TRAINING_ARTIFACT_HASH');
 return {absolute,data};
}
export function artifactList(list){
 check(Array.isArray(list)&&list.length>0&&list.every(item=>exact(item,['path','sha256'])&&isHash(item.sha256)));
 check(new Set(list.map(item=>item.path)).size===list.length);
}
