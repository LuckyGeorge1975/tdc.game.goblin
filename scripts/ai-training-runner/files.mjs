import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,mkdir,open,readdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hostname} from 'node:os';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item)+'\n';
export const read=async path=>JSON.parse(await readFile(path,'utf8'));
export async function once(path,value){const file=await open(path,'wx');try{await file.writeFile(canonical(value));await file.sync();}finally{await file.close();}}
export async function atomic(path,value){const temp=path+'.'+randomUUID()+'.tmp';await once(temp,value);await rename(temp,path);}
export function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;return true;}}
export async function events(root){
 const names=(await readdir(resolve(root,'journal'))).filter(n=>/^\d{8}\.json$/.test(n)).sort(),rows=[];
 let previous=null;
 for(const [index,name]of names.entries()){
  const row=await read(resolve(root,'journal',name));
  if(row.sequence!==index||row.previous!==previous)throw Error('JOURNAL_CHAIN_INVALID');
  const {digest,...body}=row;if(hash(canonical(body))!==digest)throw Error('JOURNAL_DIGEST_INVALID');
  previous=digest;rows.push(row);
 }
 return rows;
}
export async function journal(root){
 const rows=await events(root);let queue=Promise.resolve();
 return {rows,append(event){const task=queue.then(async()=>{const body={sequence:rows.length,previous:rows.at(-1)?.digest??null,...event};const row={...body,digest:hash(canonical(body))};const final=resolve(root,'journal',String(rows.length).padStart(8,'0')+'.json'),temp=final+'.'+randomUUID()+'.tmp';await once(temp,row);await rename(temp,final);rows.push(row);return row;});queue=task.catch(()=>{});return task;}};
}
export async function lock(root,resume=false){
 const path=resolve(root,'controller.lock'),token=randomUUID(),owner={pid:process.pid,host:hostname(),token};
 try{await once(path,owner);}
 catch(error){
  if(error.code!=='EEXIST'||!resume)throw Error('RUN_LOCKED');
  const recovery=path+'.recovery';
  try{await once(recovery,owner);}catch{throw Error('RUN_RECOVERY_LOCKED');}
  try{
   const old=await read(path),rows=await events(root);
   if(old.host!==hostname()||alive(old.pid))throw Error('RUN_LOCKED');
   const children=rows.filter(e=>e.type==='child-start'&&!rows.some(done=>done.type==='child-exit'&&done.token===e.token));
   if(children.some(e=>alive(e.pid)))throw Error('OWNED_CHILD_STILL_ALIVE');
   await unlink(path);await once(path,owner);
  }finally{await unlink(recovery);}
 }
 return async()=>{const current=await read(path);if(current.token!==token||current.pid!==process.pid||current.host!==hostname())throw Error('LOCK_OWNER_CHANGED');await unlink(path);};
}
export async function initialize(root){await mkdir(root,{recursive:false});for(const dir of ['journal','attempts','snapshots','fit'])await mkdir(resolve(root,dir));}
