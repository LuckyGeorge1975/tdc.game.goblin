import assert from 'node:assert/strict';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {resolve,join,isAbsolute,relative} from 'node:path';
import {gzipSync} from 'node:zlib';
import {engineRoot as ownRoot,gameplaySourceHashes,normalize,sha256} from './sources.mjs';
import {canonicalSources} from '../../full-training-source-binding.mjs';
import {jsonBytes} from './sealed-artifacts.mjs';
export const policyId=(side,id)=>id==='trained'?(side==='player'?'full-attack-2a':'full-defender-control-trial'):side+'-'+id;
export const difficulty=id=>id==='trained'?null:id;
export async function checkEngineRoot(root=ownRoot){
  assert.equal(await realpath(root),await realpath(ownRoot),'AI_CORE_ENGINE_ROOT_MISMATCH');return ownRoot;
}
async function commit(root){
  let path=join(root,'.git');
  try{const value=await readFile(path,'utf8');assert.match(value,/^gitdir: /);path=resolve(root,value.trim().slice(8));}catch(error){if(error.code!=='EISDIR'&&error.code!=='EPERM')throw error;}
  const head=(await readFile(join(path,'HEAD'),'utf8')).trim();
  if(/^[a-f0-9]{40}$/.test(head))return head;
  assert.match(head,/^ref: refs\//);const ref=head.slice(5);
  let common=path;try{common=resolve(path,(await readFile(join(path,'commondir'),'utf8')).trim());}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const base of [path,common])try{const value=(await readFile(join(base,ref),'utf8')).trim();if(/^[a-f0-9]{40}$/.test(value))return value;}catch(error){if(error.code!=='ENOENT')throw error;}
  const packed=await readFile(join(common,'packed-refs'),'utf8');
  const line=packed.split('\n').find(line=>line.endsWith(' '+ref));assert.ok(line,'AI_CORE_COMMIT_UNAVAILABLE');return line.slice(0,40);
}
async function sourceFiles(root){
  const paths=[];
  async function walk(directory){
    for(const item of (await readdir(resolve(root,directory),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      assert.ok(!item.isSymbolicLink(),'AI_CORE_SOURCE_SYMLINK');
      const path=(directory?directory+'/':'')+item.name;
      if(item.isDirectory())await walk(path);
      else if(/\.(?:mjs|js|json)$/.test(item.name))paths.push(path);
    }
  }
  for(const directory of ['src','scripts','assets/unit-art/rules','assets/unit-art/levels','assets/ai','assets/training'])await walk(directory);
  for(const item of await readdir(root,{withFileTypes:true}))if(item.isFile()&&/\.(?:mjs|js)$/.test(item.name))paths.push(item.name);
  paths.push('index.html');return [...new Set(paths)].sort();
}
export async function bindingSnapshot({engineRoot}={}){
  const root=await checkEngineRoot(engineRoot),paths=await sourceFiles(root),files=[];
  for(const path of paths){
    assert.ok(!isAbsolute(path)&&!relative(root,resolve(root,path)).startsWith('..'));
    const text=normalize(await readFile(resolve(root,path),'utf8'));files.push({path,sha256:sha256(text),text});
  }
  const runtimeCommit=await commit(root);
  const inventory=files.map(({path,sha256})=>({path,sha256}));
  const models=[];
  for(const [side,path]of [['player','assets/ai/full-attack-2a.json'],['enemy','assets/ai/full-defender-control-trial.json']])
    models.push({side,policy:policyId(side,'trained'),path,sha256:sha256(await readFile(resolve(root,path)))});
  const codeSha256=sha256(jsonBytes({inventory,models,nodeVersion:process.version}));
  const archive=gzipSync(jsonBytes({version:'goblin-ai-engine-snapshot-v1',runtimeCommit,codeSha256,files}),{level:9});
  const binding={version:'ai-training-core-binding-v1',runtimeCommit,codeSha256,nodeVersion:process.version,
    nativeSourcesSha256:sha256(canonicalSources(gameplaySourceHashes())),engineArchiveSha256:sha256(archive),
    engineArchivePath:'engine.snapshot.json.gz',recorderArtifacts:inventory.map(({path,sha256})=>({path:'code/'+path,sha256})),
    policies:{player:['weak','medium','strong','trained'],enemy:['weak','medium','strong','trained']},models};
  binding.interventionStrategies={player:['weak','medium','strong'],enemy:['weak','medium','strong']};
  binding.overlayStrategies={player:['weak','medium','strong'],enemy:['weak','medium','strong']};
  return {binding,archive,files};
}
export async function getBinding(options){return (await bindingSnapshot(options)).binding;}
