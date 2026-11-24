import {readFile,readdir,mkdir,stat,statfs,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {fork} from 'node:child_process';
import {freemem} from 'node:os';
import {randomUUID} from 'node:crypto';
import {hash,canonical,read,once,atomic,initialize,journal,lock,events} from './files.mjs';
import {discover} from './pool.mjs';
import {configuration,makePlan} from './plan.mjs';
import {report} from './report.mjs';
const engineRoot=fileURLToPath(new URL('../../',import.meta.url));
const coreApi=()=>import(new URL('../ai-training-core/index.mjs',import.meta.url));
async function tooling(){
 const files=['scripts/ai-train.mjs','scripts/Start-AiAutoplay.ps1','scripts/Start-AiTraining.ps1'];
 for(const entry of await readdir(new URL('./',import.meta.url)))if(entry.endsWith('.mjs'))files.push('scripts/ai-training-runner/'+entry);
 return Promise.all(files.sort().map(async path=>({path,sha256:hash((await readFile(resolve(engineRoot,path),'utf8')).replaceAll('\r\n','\n'))})));
}
async function exists(path){try{await stat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
export async function start({output,levelDirectory,config,resume=false}){
 const core=await coreApi(),root=resolve(output);let manifest;
 if(!resume){
  const settings=configuration(config),pool=await discover(levelDirectory,core.validateLevel);
  const plan=makePlan(pool,settings,(entry,p,e)=>entry.validation.strategies.player.includes(p)&&entry.validation.strategies.enemy.includes(e));
  const binding=await core.getBinding();
  manifest={...binding,runVersion:'goblin-ai-run-v1',binding,config:settings,pool,plan,toolingBinding:await tooling()};
  await initialize(root);await once(resolve(root,'manifest.json'),manifest);
 }else manifest=await read(resolve(root,'manifest.json'));
 await operate(root,manifest,'data',resume,core);
}
async function checkBinding(manifest,core){
 const binding=await core.getBinding();
 if(canonical(manifest.binding)!==canonical(binding))throw Error('RESUME_SOURCE_BINDING_CHANGED');
 if(canonical(manifest.toolingBinding)!==canonical(await tooling()))throw Error('RESUME_RUNNER_BINDING_CHANGED');
 if(canonical(configuration(manifest.config))!==canonical(manifest.config))throw Error('MANIFEST_CONFIG_INVALID');
 if(manifest.plan.poolDigest!==hash(canonical(manifest.pool)))throw Error('POOL_SNAPSHOT_CHANGED');
 for(const entry of manifest.pool.levels){if(entry.sha256!==hash(canonical(entry.level)))throw Error('LEVEL_SNAPSHOT_CHANGED');await core.validateLevel({level:entry.level});}
}
export async function train({output,resume=false}){const root=resolve(output),core=await coreApi(),manifest=await read(resolve(root,'manifest.json'));await operate(root,manifest,'training',resume,core);}
async function operate(root,manifest,phase,resume,core){
 const release=await lock(root,resume);let log,stopping=false,active=null,killTimer=null;
 const stoppingSignal=new AbortController();
 const stop=()=>{stopping=true;stoppingSignal.abort();if(active){if(active.connected)active.send({type:'stop'});killTimer??=setTimeout(()=>active?.kill('SIGKILL'),3000);}};
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  await checkBinding(manifest,core);log=await journal(root);
  const manifestDigest=hash(canonical(manifest));
  if(log.rows.some(e=>e.manifestDigest&&e.manifestDigest!==manifestDigest))throw Error('MANIFEST_TAMPERED');
  if(!log.rows.length)await log.append({type:'manifest-bound',manifestDigest});
  if(resume&&await exists(resolve(root,'STOP'))){await log.append({type:'stop-cleared',request:await read(resolve(root,'STOP'))});await unlink(resolve(root,'STOP'));}
  if(phase==='training'&&!log.rows.some(e=>e.type==='data-finished'))throw Error('AUTOPLAY_NOT_FINISHED');
  const completed=new Map();
  for(const entry of log.rows.filter(e=>e.type==='game-complete')){
   if(completed.has(entry.jobId))throw Error('DUPLICATE_JOB_COMPLETION');
   const result=await read(resolve(root,entry.resultPath));
   if(hash(canonical(result))!==entry.resultSha256)throw Error('RESULT_TAMPERED');
   const requestPath=resolve(root,entry.attempt,'request.json'),request=await read(requestPath);
   if(log.rows.find(e=>e.type==='game-start'&&e.attempt===entry.attempt)?.requestSha256!==hash(canonical(request)))throw Error('CASE_REQUEST_CHANGED');
   await freshVerify(requestPath);
   completed.set(entry.jobId,{result,attempt:entry.attempt});
  }
  async function status(value){const state={phase,...value,startedGames:log.rows.filter(e=>e.type==='game-start').length,maxGames:manifest.config.maxGames};await atomic(resolve(root,'status.json'),state);if(value.status!=='FITTING'||!value.epoch?.epoch||value.epoch.epoch%50===0)console.log(JSON.stringify(state));}
  async function game(family,kind,intervention=null,model=null,evaluationManifest=null){
   const jobId=family.id+'-'+kind;
   if(completed.has(jobId))return completed.get(jobId).result;
   if(await exists(resolve(root,'STOP')))stopping=true;
   if(stopping)return null;
   const starts=log.rows.filter(e=>e.type==='game-start'),isTest=family.split==='test';
   const spent=starts.filter(e=>(e.split==='test')===isTest).length;
   const budget=isTest?manifest.plan.evaluationBudget:manifest.plan.dataBudget;
   if(starts.length>=manifest.config.maxGames||spent>=budget){await status({status:'BUDGET_EXHAUSTED'});return null;}
   if(freemem()/1048576<manifest.config.minFreeMemoryMb)throw Error('INSUFFICIENT_FREE_MEMORY');
   const disk=await statfs(root);if(Number(disk.bavail)*Number(disk.bsize)/1048576<manifest.config.minFreeDiskMb)throw Error('INSUFFICIENT_FREE_DISK');
   const token=randomUUID(),attempt='attempts/'+jobId+'-'+token,dir=resolve(root,attempt);
   await mkdir(dir);await mkdir(resolve(dir,'capture'));await status({status:'RUNNING',jobId});
   const level=manifest.pool.levels.find(l=>l.id===family.levelId).level;
   const request={engineRoot,runRoot:resolve(dir,'capture'),returnPath:resolve(dir,'returned.json'),manifest:evaluationManifest??manifest,caseId:jobId,level,seed:family.seed,seats:family.seats,
    intervention,model,limits:{commandLimit:manifest.config.commandLimit,roundLimit:manifest.config.roundLimit,wallMs:null,workers:1}};
   await once(resolve(dir,'request.json'),request);
   await log.append({type:'game-start',jobId,attempt,split:family.split,token,requestSha256:hash(canonical(request))});
   const started=performance.now(),cpu=process.cpuUsage();
   let exit;
   const {open}=await import('node:fs/promises');const stdout=await open(resolve(dir,'stdout.log'),'wx'),stderr=await open(resolve(dir,'stderr.log'),'wx');
   try{
    const child=fork(fileURLToPath(new URL('./child.mjs',import.meta.url)),[resolve(dir,'request.json')],{cwd:engineRoot,execArgv:['--max-old-space-size='+manifest.config.maxHeapMb],stdio:['ignore',stdout.fd,stderr.fd,'ipc']});
    active=child;
    const finished=new Promise((accept,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>accept({code,signal}));});
    await log.append({type:'child-start',token,pid:child.pid,attempt});
    child.send({type:'start'});
    exit=await finished;
   }finally{active=null;if(killTimer){clearTimeout(killTimer);killTimer=null;}await stdout.close();await stderr.close();}
   await log.append({type:'child-exit',token,...exit,wallMs:performance.now()-started,controllerCpuUs:process.cpuUsage(cpu)});
   if(exit.code!==0){await log.append({type:'game-interrupted',jobId,attempt,...exit});if(stopping)return null;throw Error('GAME_PROCESS_FAILED: '+jobId);}
   const resultPath=attempt+'/returned.json',result=await read(resolve(root,resultPath));
   if(result.completion==='stopped'){await log.append({type:'game-interrupted',jobId,attempt,reason:'stopped'});stopping=true;return null;}
   await freshVerify(resolve(dir,'request.json'));
   if(result.completion==='error')throw Error('NATIVE_GAME_ERROR');
   await log.append({type:'game-complete',jobId,attempt,resultPath,resultSha256:hash(canonical(result)),evaluationManifest});
   completed.set(jobId,{result,attempt});return result;
  }
  async function pairs(){
   const train={player:[],enemy:[]},validation={player:[],enemy:[]};
   for(const family of manifest.plan.data){
    const reference=completed.get(family.id+'-reference')?.result;if(!reference)continue;
    for(const side of ['player','enemy']){
     const alternative=completed.get(family.id+'-alternative-'+side)?.result;if(!alternative)continue;
     const pair=await core.buildPair({reference,alternative,side});if(pair)(family.split==='validation'?validation:train)[side].push(pair);
    }
   }return {train,validation};
  }
  if(phase==='data'){
   for(const family of manifest.plan.data){
    const reference=await game(family,'reference');if(!reference)break;
    if(reference.completion==='native')for(const side of ['player','enemy']){
     const intervention=reference.sampled?.find(item=>item.side===side);if(intervention)await game(family,'alternative-'+side,intervention);
    }
    if(stopping)break;
   }
   if(!stopping){const data=await pairs();await atomic(resolve(root,'pairs.json'),data);if(!log.rows.some(e=>e.type==='data-finished'))await log.append({type:'data-finished',pairsSha256:hash(canonical(data))});}
   await status({status:stopping?'STOPPED':'DATA_READY'});
  }else{
   const data=await pairs(),dataBytes=canonical(data);
   if(hash(dataBytes)!==log.rows.find(e=>e.type==='data-finished').pairsSha256)throw Error('DATASET_BINDING_CHANGED');
   const missingCoverage=[];
   for(const side of ['player','enemy'])for(const split of ['train','validation'])for(const level of manifest.pool.levels)
    if(!data[split][side].some(pair=>pair.level===level.id))missingCoverage.push({side,split,level:level.id});
   if(missingCoverage.length){await report(root,{status:'DATA_INSUFFICIENT',missingCoverage,modelPromotion:false,reason:'No valid independent native pair for each selected map, side and data split.'});await status({status:'DATA_INSUFFICIENT'});return;}
   let freeze;
   if(await exists(resolve(root,'freeze.json')))freeze=await read(resolve(root,'freeze.json'));
   else{
    const models=[];
    for(const side of ['player','enemy']){
     const checkpointPath=resolve(root,'fit',side+'-checkpoint.json');
     const fitPath=resolve(root,'fit',side+'-result.json');
     const fitEvent=log.rows.find(e=>e.type==='fit-complete'&&e.side===side);
     const fitStarted=performance.now(),fitCpu=process.cpuUsage();
     if(fitEvent&&fitEvent.sha256!==hash(canonical(fitEvent.result)))throw Error('FIT_RESULT_CHANGED');
     if(fitEvent&&await exists(fitPath)&&fitEvent.sha256!==hash(canonical(await read(fitPath))))throw Error('FIT_RESULT_CHANGED');
     const fit=fitEvent?.result??await core.fitFireTarget({train:data.train[side],validation:data.validation[side],config:{side,outputRoot:resolve(root,'fit',side),runManifestSha256:manifestDigest,maxEpochs:manifest.config.maxEpochs,patience:manifest.config.patience,minDelta:manifest.config.minDelta,learningRate:manifest.config.learningRate,seed:manifest.config.masterSeed},checkpoint:await exists(checkpointPath)?await read(checkpointPath):undefined,signal:stoppingSignal.signal,
      onEpoch:async value=>{if(await exists(resolve(root,'STOP')))stop();await log.append({type:'fit-epoch',side,metrics:value});await status({status:'FITTING',side,epoch:value});}});
     if(fit.checkpoint)await atomic(checkpointPath,fit.checkpoint);
     if(stopping||fit.status==='STOPPED'){await status({status:'STOPPED'});return;}
     if(fit.status==='DATA_INSUFFICIENT'){await report(root,{status:'DATA_INSUFFICIENT',side,fit,counts:{train:data.train[side].length,validation:data.validation[side].length}});await status({status:'DATA_INSUFFICIENT'});return;}
     if(!fitEvent)await log.append({type:'fit-complete',side,sha256:hash(canonical(fit)),result:fit,wallMs:performance.now()-fitStarted,cpuUs:process.cpuUsage(fitCpu),animations:0});
     if(!await exists(fitPath))await once(fitPath,fit);
     models.push({side,fit,model:fit.modelRef});
    }
    freeze={manifestDigest,datasetSha256:hash(dataBytes),models};await once(resolve(root,'freeze.json'),freeze);await log.append({type:'models-frozen',sha256:hash(canonical(freeze))});
   }
   if(freeze.manifestDigest!==manifestDigest||freeze.datasetSha256!==hash(dataBytes)||log.rows.find(e=>e.type==='models-frozen')?.sha256!==hash(canonical(freeze)))throw Error('MODEL_FREEZE_TAMPERED');
   const evaluationManifest={...manifest,modelFreeze:freeze},outcomes=[];
   for(const family of manifest.plan.evaluation){
    const reference=await game(family,'reference',null,null,evaluationManifest);if(!reference)break;
    for(const side of ['player','enemy']){
     const model=freeze.models.find(item=>item.side===side).model;
     if(hash(await readFile(model.path))!==model.sha256)throw Error('FROZEN_MODEL_BYTES_CHANGED');
     const candidate=await game(family,'candidate-'+side,null,model,evaluationManifest);
     if(candidate)outcomes.push({familyId:family.id,levelId:family.levelId,side,reference:reference.outcome,candidate:candidate.outcome,referenceCompletion:reference.completion,candidateCompletion:candidate.completion});
    }if(stopping)break;
   }
   const points=(outcome,side)=>outcome==='draw'?.5:outcome===true||outcome==='player'||outcome==='player-win'?(side==='player'?1:0):side==='enemy'?1:0;
   const valid=outcomes.filter(r=>r.referenceCompletion==='native'&&r.candidateCompletion==='native');
   const delta=valid.reduce((sum,r)=>sum+points(r.candidate,r.side)-points(r.reference,r.side),0);
   const bySide=Object.fromEntries(['player','enemy'].map(side=>{
    const rows=valid.filter(row=>row.side===side),deltas=rows.map(row=>points(row.candidate,side)-points(row.reference,side));
    const mean=deltas.length?deltas.reduce((a,b)=>a+b,0)/deltas.length:null;
    const se=deltas.length>1?Math.sqrt(deltas.reduce((sum,value)=>sum+(value-mean)**2,0)/(deltas.length-1)/deltas.length):null;
    const outcomesFor=key=>({wins:rows.filter(r=>points(r[key],side)===1).length,draws:rows.filter(r=>points(r[key],side)===.5).length,losses:rows.filter(r=>points(r[key],side)===0).length});
    return [side,{families:rows.length,reference:outcomesFor('reference'),candidate:outcomesFor('candidate'),meanPairedDelta:mean,standardError:se,note:'Small samples and known layouts do not qualify general playing strength.'}];
   }));
   const byLevel=Object.fromEntries(manifest.pool.levels.map(level=>{const rows=outcomes.filter(r=>r.levelId===level.id),native=rows.filter(r=>r.referenceCompletion==='native'&&r.candidateCompletion==='native');return [level.id,{comparisons:native.length,technicalOrMissing:rows.length-native.length,pairedDelta:native.reduce((sum,r)=>sum+points(r.candidate,r.side)-points(r.reference,r.side),0)}];}));
   const result={status:stopping?'STOPPED':valid.length<manifest.plan.evaluation.length*2?'DATA_INSUFFICIENT':delta>0?'OBSERVED_IMPROVEMENT':'NO_IMPROVEMENT',delta,bySide,byLevel,validComparisons:valid.length,technicalOrMissing:outcomes.length-valid.length,outcomes,freeze,modelPromotion:false,
    totalGameStarts:log.rows.filter(e=>e.type==='game-start').length,limits:manifest.config,timing:'Native CPU/Wall in each result; controller CPU separate; no browser animations.'};
   await report(root,result);await status({status:result.status});
  }
 }catch(error){await atomic(resolve(root,'status.json'),{status:'INVALID',phase,error:String(error.message??error)});throw error;}
 finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await release();}
}
export async function stopRun(output){await atomic(resolve(output,'STOP'),{requestedAt:new Date().toISOString()});}
export async function inspect(output,verify=false){const root=resolve(output),manifest=await read(resolve(root,'manifest.json')),rows=await events(root);if(verify){const core=await coreApi();await checkBinding(manifest,core);for(const entry of rows.filter(e=>e.type==='game-complete')){const result=await read(resolve(root,entry.resultPath));if(hash(canonical(result))!==entry.resultSha256)throw Error('RESULT_TAMPERED');await freshVerify(resolve(root,entry.attempt,'request.json'));}}return {manifestDigest:hash(canonical(manifest)),events:rows.length,gameStarts:rows.filter(e=>e.type==='game-start').length,completed:rows.filter(e=>e.type==='game-complete').length,status:await exists(resolve(root,'status.json'))?await read(resolve(root,'status.json')):null};}
async function freshVerify(requestPath){let verified=false;const child=fork(fileURLToPath(new URL('./verify-child.mjs',import.meta.url)),[requestPath],{cwd:engineRoot,stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',data=>{if(errors.length<8000)errors+=data;});child.on('message',message=>{if(message?.verified)verified=true;});await new Promise((accept,reject)=>{child.once('error',reject);child.once('exit',code=>code===0&&verified?accept():reject(Error('FRESH_VERIFICATION_FAILED: '+errors)));});}
