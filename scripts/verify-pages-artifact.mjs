import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {configurePagesSupport} from './configure-pages-support.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
function tarFiles(bytes){
 const files=new Map(),directories=new Set();let offset=0,longName=null,pax={};
 const text=buffer=>new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/\0.*$/s,'');
 while(offset+512<=bytes.length){
  const header=bytes.subarray(offset,offset+512);offset+=512;
  if(header.every(byte=>byte===0)){if(bytes.length-offset<512||longName||Object.keys(pax).length||bytes.subarray(offset).some(byte=>byte!==0))throw Error('PAGES_TAR_TRAILING_DATA');return {files,directories};}
  const octal=(a,b)=>{const value=text(header.subarray(a,b)).trim();if(!/^[0-7]+$/.test(value))throw Error('PAGES_TAR_NUMBER');return parseInt(value,8);};
  const checksum=header.reduce((sum,byte,index)=>sum+(index>=148&&index<156?32:byte),0);
  if(checksum!==octal(148,156))throw Error('PAGES_TAR_CHECKSUM');
  const size=octal(124,136),end=offset+size;
  if(!Number.isSafeInteger(size)||end>bytes.length)throw Error('PAGES_TAR_TRUNCATED');
  const data=bytes.subarray(offset,end);offset+=Math.ceil(size/512)*512;
  const type=String.fromCharCode(header[156]||48);
  if(type==='L'){longName=text(data).replace(/\n$/,'');continue;}
  if(type==='x'){
   let at=0;
   while(at<data.length){const space=data.indexOf(32,at),length=Number(data.subarray(at,space).toString());if(space<at||!Number.isSafeInteger(length)||length<=space-at+1||at+length>data.length)throw Error('PAGES_TAR_PAX');
    const row=text(data.subarray(space+1,at+length)).replace(/\n$/,''),equals=row.indexOf('=');if(equals<1)throw Error('PAGES_TAR_PAX');
    const key=row.slice(0,equals);if(!['path','size','mtime','atime','ctime','uid','gid','uname','gname','charset','hdrcharset'].includes(key))throw Error('PAGES_TAR_UNSUPPORTED_PAX');pax[key]=row.slice(equals+1);at+=length;
   }continue;
  }
  if(!['0','5'].includes(type))throw Error('PAGES_TAR_LINK_OR_SPECIAL_ENTRY');
  if(pax.size!==undefined&&Number(pax.size)!==size)throw Error('PAGES_TAR_PAX_SIZE');
  const prefix=header.subarray(257,263).equals(Buffer.from('ustar\0'))?text(header.subarray(345,500)):'';
  let path=pax.path??longName??(prefix?prefix+'/':'')+text(header.subarray(0,100));pax={};longName=null;
  path=path.replace(/^\.\//,'').replace(/\/$/,'');
  if(!path&&type==='5')continue;
  if(!path||path.includes('\\')||path.includes(':')||path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('PAGES_TAR_UNSAFE_PATH');
  if(type==='5'){if(size)throw Error('PAGES_TAR_DIRECTORY_DATA');directories.add(path);continue;}
  if(files.has(path))throw Error('PAGES_TAR_DUPLICATE_FILE');files.set(path,data);
 }
 throw Error('PAGES_TAR_MISSING_END');
}
export async function verifyPagesArtifact({sourceRoot=process.cwd(),stagingRoot,artifactPath,supportUrl=process.env.GOBLIN_SUPPORT_URL}){
 const source=resolve(sourceRoot),stage=resolve(stagingRoot);
 const git=args=>execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+source.replaceAll('\\','/'),...args],{cwd:source});
 const commit=git(['rev-parse','HEAD']).toString().trim(),expected=new Map(),allowedDirs=new Set();
 for(const row of git(['ls-tree','-rz',commit]).toString().split('\0').filter(Boolean)){
  const match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);if(!match)throw Error('PAGES_ARTIFACT_UNSUPPORTED_GIT_ENTRY');
  const path=match[3],parts=path.split('/');if(parts.some(part=>part==='.git'||part==='.github'))continue;
  if(['.tools','training-runs'].includes(parts[0].toLowerCase()))throw Error('PAGES_ARTIFACT_PRIVATE_TRACKED_FILE');
  expected.set(path,match[2]);for(let i=1;i<parts.length;i++)allowedDirs.add(parts.slice(0,i).join('/'));
 }
 const bytes=await readFile(artifactPath),{files,directories}=tarFiles(bytes);
 if(files.size!==expected.size)throw Error('PAGES_ARTIFACT_FILE_COUNT');
 for(const directory of directories)if(!allowedDirs.has(directory))throw Error('PAGES_ARTIFACT_EXTRA_DIRECTORY');
 let supportConfigured=false;const inventory=[];
 for(const [path,data]of files){
  if(!expected.has(path))throw Error('PAGES_ARTIFACT_UNTRACKED_FILE');
  const staged=await readFile(resolve(stage,path));if(!staged.equals(data))throw Error('PAGES_ARTIFACT_STAGE_MISMATCH: '+path);
  if(path==='index.html'){
   const original=git(['show',commit+':index.html']);if(blob(original)!==expected.get(path))throw Error('PAGES_ARTIFACT_INDEX_SOURCE');
   const configured=Buffer.from(configurePagesSupport(original.toString('utf8'),supportUrl));
   if(!configured.equals(data))throw Error('PAGES_ARTIFACT_INDEX_TRANSFORMATION');supportConfigured=!configured.equals(original);
  }else if(blob(data)!==expected.get(path))throw Error('PAGES_ARTIFACT_GIT_BLOB_MISMATCH: '+path);
  inventory.push({path,sha256:hash(data)});
 }
 return {commit,artifactTarSha256:hash(bytes),payloadInventorySha256:hash(JSON.stringify(inventory.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0))),files:files.size,allPayloadFilesMatchGitAndStage:true,supportConfigured,privateRunOutputsIncluded:false,linksOrSpecialEntries:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);
  if(args.length!==6||args[0]!=='--staging'||args[2]!=='--artifact'||args[4]!=='--proof')throw Error('Usage: verify-pages-artifact.mjs --staging <directory> --artifact <tar> --proof <json>');
  const proof=await verifyPagesArtifact({stagingRoot:args[1],artifactPath:args[3]});
  await writeFile(args[5],JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof));
 }catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
