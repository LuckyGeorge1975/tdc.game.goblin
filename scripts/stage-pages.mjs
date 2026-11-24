import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,readdir,unlink,rmdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function stagePages({sourceRoot=process.cwd(),output}){
 const source=resolve(sourceRoot),destination=resolve(output);
 const rel=relative(source,destination);
 if(!rel||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))throw Error('PAGES_STAGE_MUST_BE_OUTSIDE_CHECKOUT');
 const git=args=>execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+source.replaceAll('\\','/'),'-c','core.autocrlf=false','-c','core.eol=lf',...args],{cwd:source});
 const commit=git(['rev-parse','HEAD']).toString().trim();
 const files=new Map();
 for(const row of git(['ls-tree','-rz',commit]).toString('utf8').split('\0').filter(Boolean)){
  const match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
  if(!match)throw Error('PAGES_STAGE_UNSUPPORTED_GIT_ENTRY');
  const path=match[3],parts=path.split('/');
  if(isAbsolute(path)||path.includes('\\')||parts.some(p=>!p||p==='.'||p==='..')||['.git','.tools','training-runs'].includes(parts[0].toLowerCase()))throw Error('PAGES_STAGE_PRIVATE_OR_UNSAFE_TRACKED_PATH');
  files.set(path,match[2]);
 }
 await mkdir(destination); // Existing or partially staged runs must fail closed.
 const temporary=await mkdtemp(join(dirname(destination),'pages-source-')),archive=join(temporary,'source.tar');
 try{
  git(['archive','--format=tar','--output='+archive,commit]);
  execFileSync('tar',['-xf',archive,'-C',destination]);
  let count=0;
  async function check(directory,prefix=''){
   for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=prefix+entry.name,absolute=join(directory,entry.name);
    if(entry.isDirectory())await check(absolute,path+'/');
    else{
     if(!entry.isFile()||!files.has(path))throw Error('PAGES_STAGE_UNTRACKED_OUTPUT');
     const bytes=await readFile(absolute),actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
     if(actual!==files.get(path))throw Error('PAGES_STAGE_BLOB_MISMATCH: '+path);
     count++;
    }
   }
  }
  await check(destination);
  if(count!==files.size)throw Error('PAGES_STAGE_MISSING_TRACKED_FILE');
  return {commit,files:count,output:destination};
 }finally{
  try{await unlink(archive);}catch(error){if(error.code!=='ENOENT')throw error;}
  await rmdir(temporary);
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output')throw Error('Usage: node scripts/stage-pages.mjs --output <fresh-directory>');
  console.log(JSON.stringify(await stagePages({output:args[1]})));
 }catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
