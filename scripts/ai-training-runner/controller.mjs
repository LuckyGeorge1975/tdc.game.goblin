import {readFile,readdir,mkdir,stat,statfs,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fork} from 'node:child_process';
import {freemem} from 'node:os';
import {randomUUID} from 'node:crypto';
import {watch} from 'node:fs';
import {hash,canonical,read,once,atomic,initialize,journal,lock,events} from './files.mjs';
import {discover} from './pool.mjs';
import {configuration,makePlan} from './plan.mjs';
import {report} from './report.mjs';
import {assertPlannedRequest} from './job-identity.mjs';
const engineRoot=fileURLToPath(new URL('../../',import.meta.url));
const coreApi=()=>import(new URL('../ai-training-core/index.mjs',import.meta.url));
const legalSeats=(entry,p,e)=>entry.validation.strategies.player.includes(p)&&entry.validation.strategies.enemy.includes(e);
const legalOverlay=(entry,p,e)=>['player','enemy'].filter(side=>entry.validation.pairStrategies[side].includes(side==='player'?p:e));
async function tooling(){
 const files=['scripts/ai-train.mjs','scripts/Start-AiAutoplay.ps1','scripts/Start-AiTraining.ps1'];
 for(const entry of await readdir(new URL('./',import.meta.url)))if(entry.endsWith('.mjs'))files.push('scripts/ai-training-runner/'+entry);
 return Promise.all(files.sort().map(async path=>({path,sha256:hash((await readFile(resolve(engineRoot,path),'utf8')).replaceAll('\r\n','\n'))})));
}
async function exists(path){try{await stat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function checkEvaluation(start,request,rows){
 if(start?.split!=='test')return;
 const frozen=rows.find(e=>e.type==='models-frozen'&&e.sequence<start.sequence);
 if(!frozen||start.modelFreezeSha256!==frozen.sha256||hash(canonical(frozen.freeze))!==frozen.sha256)throw Error('EVALUATION_FREEZE_BINDING_CHANGED');
 if(request.model&&!frozen.freeze.models.some(item=>canonical(item.model)===canonical(request.model)))throw Error('EVALUATION_MODEL_NOT_FROZEN');
}
export async function start({output,levelDirectory,config,resume=false}){
 const core=await coreApi(),root=resolve(output);let manifest;
 if(!resume){
  const settings=configuration(config),pool=await discover(levelDirectory,core.validateLevel);
  const plan=makePlan(pool,settings,legalSeats,legalOverlay);
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
 for(const entry of manifest.pool.levels){if(entry.sha256!==hash(canonical(entry.level)))throw Error('LEVEL_SNAPSHOT_CHANGED');if(canonical(await core.validateLevel({level:entry.level}))!==canonical(entry.validation))throw Error('LEVEL_CAPABILITIES_CHANGED');}
 const expectedPlan=makePlan(manifest.pool,manifest.config,legalSeats,legalOverlay);
 if(canonical(expectedPlan)!==canonical(manifest.plan))throw Error('BOUND_PLAN_CHANGED');
}
export async function train({output,resume=false,maxEpochs}){const root=resolve(output),core=await coreApi(),manifest=await read(resolve(root,'manifest.json'));await operate(root,manifest,'training',resume,core,{maxEpochs});}
async function operate(root,manifest,phase,resume,core,options={}){
 const release=await lock(root,resume);let log,stopping=false,active=null,killTimer=null;
 const stoppingSignal=new AbortController();
 const stop=()=>{stopping=true;stoppingSignal.abort();if(active){if(active.connected)active.send({type:'stop'},()=>{});killTimer??=setTimeout(()=>active?.kill('SIGKILL'),3000);}};
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
 let stopWatcher;
 try{
  stopWatcher=watch(root,{persistent:false},(_event,name)=>{if(name?.toString()==='STOP')exists(resolve(root,'STOP')).then(found=>{if(found)stop();}).catch(stop);});
  await checkBinding(manifest,core);log=await journal(root);
  const manifestDigest=hash(canonical(manifest));
  if(log.rows.some(e=>e.manifestDigest&&e.manifestDigest!==manifestDigest))throw Error('MANIFEST_TAMPERED');
  if(!log.rows.length)await log.append({type:'manifest-bound',manifestDigest});
  if(resume&&await exists(resolve(root,'STOP'))){await log.append({type:'stop-cleared',request:await read(resolve(root,'STOP'))});await unlink(resolve(root,'STOP'));}
  if(phase==='training'&&!log.rows.some(e=>e.type==='data-finished'))throw Error('AUTOPLAY_NOT_FINISHED');
  if(options.maxEpochs!==undefined&&(!Number.isInteger(options.maxEpochs)||options.maxEpochs<1||options.maxEpochs>manifest.config.maxEpochs))throw Error('EPOCH_LIMIT_EXCEEDS_BOUND_CEILING');
  const completed=new Map();
  for(const entry of log.rows.filter(e=>e.type==='game-complete')){
   if(completed.has(entry.jobId))throw Error('DUPLICATE_JOB_COMPLETION');
   const result=await read(resolve(root,entry.resultPath));
   if(hash(canonical(result))!==entry.resultSha256)throw Error('RESULT_TAMPERED');
   const requestPath=resolve(root,entry.attempt,'request.json'),request=await read(requestPath);
   assertPlannedRequest(request,manifest,entry.jobId);
   if(log.rows.find(e=>e.type==='game-start'&&e.attempt===entry.attempt)?.requestSha256!==hash(canonical(request)))throw Error('CASE_REQUEST_CHANGED');
   checkEvaluation(log.rows.find(e=>e.type==='game-start'&&e.attempt===entry.attempt),request,log.rows);
   await freshVerify(requestPath);
   completed.set(entry.jobId,{result,attempt:entry.attempt});
  }
  // A controller can die after a child sealed its result but before journal commit.
  // Reuse the earliest such verified attempt, rather than replaying a finished game.
  for(const entry of log.rows.filter(e=>e.type==='game-start')){
   if(completed.has(entry.jobId)||!await exists(resolve(root,entry.attempt,'returned.json')))continue;
   const requestPath=resolve(root,entry.attempt,'request.json'),request=await read(requestPath);
   assertPlannedRequest(request,manifest,entry.jobId);
   if(entry.requestSha256!==hash(canonical(request)))throw Error('CASE_REQUEST_CHANGED');
   checkEvaluation(entry,request,log.rows);
   let result;try{result=await read(resolve(root,entry.attempt,'returned.json'));}catch(error){if(error instanceof SyntaxError)continue;throw error;}
   if(!['native','technical-limit'].includes(result.completion))continue;
   await freshVerify(requestPath);
   const resultPath=entry.attempt+'/returned.json';
   await log.append({type:'game-complete',jobId:entry.jobId,attempt:entry.attempt,resultPath,resultSha256:hash(canonical(result)),evaluationManifest:entry.split==='test'?request.manifest:null,recovered:true});
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
   await mkdir(dir);await mkdir(resolve(dir,'capture'));
   const level=manifest.pool.levels.find(l=>l.id===family.levelId).level;
   const request={engineRoot,runRoot:resolve(dir,'capture'),returnPath:resolve(dir,'returned.json'),manifest:evaluationManifest??manifest,caseId:jobId,level,seed:family.seed,seats:family.seats,
    intervention,model,limits:{commandLimit:manifest.config.commandLimit,roundLimit:manifest.config.roundLimit,wallMs:null,workers:1}};
   assertPlannedRequest(request,manifest,jobId);
   await once(resolve(dir,'request.json'),request);
   const modelFreezeSha256=isTest?log.rows.find(e=>e.type==='models-frozen')?.sha256:null;
   if(isTest&&!modelFreezeSha256)throw Error('EVALUATION_REQUIRES_FROZEN_MODELS');
   await log.append({type:'game-start',jobId,attempt,split:family.split,token,modelFreezeSha256,requestSha256:hash(canonical(request))});
   await status({status:'RUNNING',jobId});
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
   const verification=await freshVerify(resolve(dir,'request.json'));
   await log.append({type:'verification',jobId,attempt,timing:verification});
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
  function runSummary(){const counts={},outcomes={};for(const {result}of completed.values()){counts[result.completion]=(counts[result.completion]??0)+1;if(result.completion==='native')outcomes[result.outcome]=(outcomes[result.outcome]??0)+1;}const starts=log.rows.filter(e=>e.type==='game-start').length;return {gameStarts:starts,uniqueCompletedJobs:completed.size,completionCounts:counts,nativeOutcomeCounts:outcomes,extraOrUnfinishedAttempts:starts-completed.size,pairSkips:log.rows.filter(e=>e.type==='pair-skipped').map(({familyId,side,strategy,reason})=>({familyId,side,strategy,reason}))};}
  if(phase==='data'){
   for(const family of manifest.plan.data){
    const reference=await game(family,'reference');if(!reference)break;
    for(const side of ['player','enemy']){
     const entry=manifest.pool.levels.find(l=>l.id===family.levelId);
     const supported=entry.validation.pairStrategies[side].includes(family.seats[side]);
     const intervention=supported&&reference.completion==='native'?reference.sampled?.find(item=>item.side===side):null;
     if(intervention)await game(family,'alternative-'+side,intervention);
     else if(!log.rows.some(e=>e.type==='pair-skipped'&&e.familyId===family.id&&e.side===side))await log.append({type:'pair-skipped',familyId:family.id,side,strategy:family.seats[side],reason:!supported?'UNSUPPORTED_CONTROLLED_STRATEGY':reference.completion!=='native'?'CENSORED_REFERENCE':'NO_FEATURE_DISTINCT_OFFER',budgetOriginalCounted:true});
    }
    if(stopping)break;
   }
   if(!stopping){const data=await pairs(),path=resolve(root,'pairs.json');if(await exists(path)){if(hash(canonical(await read(path)))!==hash(canonical(data)))throw Error('DATASET_CHANGED');}else await atomic(path,data);if(!log.rows.some(e=>e.type==='data-finished'))await log.append({type:'data-finished',pairsSha256:hash(canonical(data))});}
   await status({status:stopping?'STOPPED':'DATA_READY'});
  }else{
   const data=await pairs(),dataBytes=canonical(data);
   if(hash(dataBytes)!==log.rows.find(e=>e.type==='data-finished').pairsSha256)throw Error('DATASET_BINDING_CHANGED');
   if(hash(canonical(await read(resolve(root,'pairs.json'))))!==hash(dataBytes))throw Error('DATASET_CHANGED');
   const missingCoverage=[];
   for(const side of ['player','enemy'])for(const split of ['train','validation'])for(const level of manifest.pool.levels)
    if(!data[split][side].some(pair=>pair.level===level.id))missingCoverage.push({side,split,level:level.id});
   if(missingCoverage.length){await report(root,{status:'DATA_INSUFFICIENT',missingCoverage,...runSummary(),modelPromotion:false,reason:'No valid independent native pair for each selected map, side and data split.'});await status({status:'DATA_INSUFFICIENT'});return;}
   const policyPath=resolve(root,'fit-policy.json');let fitPolicy;
   const boundPolicy=log.rows.find(e=>e.type==='fit-policy-bound');
   if(boundPolicy){
    fitPolicy=boundPolicy.policy;
    if(boundPolicy.sha256!==hash(canonical(fitPolicy)))throw Error('FIT_POLICY_CHANGED');
    if(await exists(policyPath)){if(hash(canonical(await read(policyPath)))!==boundPolicy.sha256)throw Error('FIT_POLICY_CHANGED');}else await atomic(policyPath,fitPolicy);
    if(options.maxEpochs!==undefined&&options.maxEpochs!==fitPolicy.maxEpochs)throw Error('FIT_POLICY_ALREADY_BOUND');
   }else{
    fitPolicy={maxEpochs:options.maxEpochs??manifest.config.maxEpochs,patience:manifest.config.patience,minDelta:manifest.config.minDelta,learningRate:manifest.config.learningRate,
     seeds:Object.fromEntries(['player','enemy'].map(side=>[side,parseInt(hash(canonical({masterSeed:manifest.config.masterSeed,namespace:'network-initialization',side})).slice(0,8),16)]))};
    if(await exists(policyPath))throw Error('FIT_POLICY_WITHOUT_JOURNAL');
    await log.append({type:'fit-policy-bound',sha256:hash(canonical(fitPolicy)),policy:fitPolicy});await atomic(policyPath,fitPolicy);
   }
   let freeze;
   const freezeEvent=log.rows.find(e=>e.type==='models-frozen');
   if(freezeEvent){freeze=freezeEvent.freeze;if(await exists(resolve(root,'freeze.json'))){if(hash(canonical(await read(resolve(root,'freeze.json'))))!==freezeEvent.sha256)throw Error('MODEL_FREEZE_TAMPERED');}else await atomic(resolve(root,'freeze.json'),freeze);}
   else{
    const models=[];
    for(const side of ['player','enemy']){
     const checkpointPath=resolve(root,'fit',side+'-checkpoint.json');
     const fitPath=resolve(root,'fit',side+'-result.json');
     const fitEvent=log.rows.find(e=>e.type==='fit-complete'&&e.side===side);
     const fitStarted=performance.now(),fitCpu=process.cpuUsage();
     if(fitEvent&&fitEvent.sha256!==hash(canonical(fitEvent.result)))throw Error('FIT_RESULT_CHANGED');
     if(fitEvent&&await exists(fitPath)&&fitEvent.sha256!==hash(canonical(await read(fitPath))))throw Error('FIT_RESULT_CHANGED');
     const fit=fitEvent?.result??await core.fitFireTarget({train:data.train[side],validation:data.validation[side],config:{side,outputRoot:resolve(root,'fit',side),checkpointPath,runManifestSha256:manifestDigest,maxEpochs:fitPolicy.maxEpochs,patience:fitPolicy.patience,minDelta:fitPolicy.minDelta,learningRate:fitPolicy.learningRate,seed:fitPolicy.seeds[side]},checkpoint:await exists(checkpointPath)?await read(checkpointPath):undefined,signal:stoppingSignal.signal,
      onEpoch:async value=>{if(await exists(resolve(root,'STOP')))stop();await log.append({type:'fit-epoch',side,metrics:value});await status({status:'FITTING',side,epoch:value});}});
     if(fit.checkpoint)await atomic(checkpointPath,fit.checkpoint);
     if(stopping||fit.status==='STOPPED'){await status({status:'STOPPED'});return;}
     if(fit.status==='DATA_INSUFFICIENT'){await report(root,{status:'DATA_INSUFFICIENT',side,fit,...runSummary(),counts:{train:data.train[side].length,validation:data.validation[side].length}});await status({status:'DATA_INSUFFICIENT'});return;}
     if(!fitEvent)await log.append({type:'fit-complete',side,sha256:hash(canonical(fit)),result:fit,wallMs:performance.now()-fitStarted,cpuUs:process.cpuUsage(fitCpu),animations:0});
     if(!await exists(fitPath))await atomic(fitPath,fit);
     models.push({side,fit,model:fit.modelRef});
    }
    freeze={manifestDigest,datasetSha256:hash(dataBytes),fitPolicy,models};if(await exists(resolve(root,'freeze.json')))throw Error('FREEZE_WITHOUT_JOURNAL');await log.append({type:'models-frozen',sha256:hash(canonical(freeze)),freeze});await atomic(resolve(root,'freeze.json'),freeze);
   }
   if(freeze.manifestDigest!==manifestDigest||freeze.datasetSha256!==hash(dataBytes)||log.rows.find(e=>e.type==='models-frozen')?.sha256!==hash(canonical(freeze)))throw Error('MODEL_FREEZE_TAMPERED');
   // Model headers retain their original training-manifest identity. The prior
   // models-frozen journal event and each game-start bind the evaluation bytes.
   const evaluationManifest=manifest,outcomes=[];
   for(const family of manifest.plan.evaluation){
    const reference=await game(family,'reference',null,null,evaluationManifest);if(!reference)break;
    for(const side of family.sides){
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
   const expectedComparisons=manifest.plan.evaluation.reduce((sum,family)=>sum+family.sides.length,0);
   const result={status:stopping?'STOPPED':valid.length<expectedComparisons||!valid.length?'DATA_INSUFFICIENT':delta>0?'OBSERVED_IMPROVEMENT':'NO_IMPROVEMENT',delta,bySide,byLevel,expectedComparisons,validComparisons:valid.length,technicalOrMissing:expectedComparisons-valid.length,missingComparisons:expectedComparisons-outcomes.length,outcomes,freeze,modelPromotion:false,
    ...runSummary(),totalGameStarts:log.rows.filter(e=>e.type==='game-start').length,limits:manifest.config,timing:'Native CPU/Wall in each result; controller CPU separate; no browser animations.'};
   await report(root,result);await status({status:result.status});
  }
 }catch(error){const failure={status:stopping?'STOPPED':'INVALID',phase,error:String(error.message??error),gameStarts:log?.rows.filter(e=>e.type==='game-start').length??0,modelPromotion:false};await atomic(resolve(root,'status.json'),failure);try{await report(root,failure);}catch{}if(!stopping)throw error;}
 finally{stopWatcher?.close();process.off('SIGINT',stop);process.off('SIGTERM',stop);await release();}
}
export async function stopRun(output){await atomic(resolve(output,'STOP'),{requestedAt:new Date().toISOString()});}
export async function inspect(output,verify=false){const root=resolve(output),manifest=await read(resolve(root,'manifest.json')),rows=await events(root);if(verify){const core=await coreApi();await checkBinding(manifest,core);if(rows.find(e=>e.type==='manifest-bound')?.manifestDigest!==hash(canonical(manifest)))throw Error('MANIFEST_TAMPERED');for(const entry of rows.filter(e=>e.type==='game-complete')){const result=await read(resolve(root,entry.resultPath));if(hash(canonical(result))!==entry.resultSha256)throw Error('RESULT_TAMPERED');const requestPath=resolve(root,entry.attempt,'request.json');if(rows.find(e=>e.type==='game-start'&&e.attempt===entry.attempt)?.requestSha256!==hash(canonical(await read(requestPath))))throw Error('CASE_REQUEST_CHANGED');assertPlannedRequest(await read(requestPath),manifest,entry.jobId);checkEvaluation(rows.find(e=>e.type==='game-start'&&e.attempt===entry.attempt),await read(requestPath),rows);await freshVerify(requestPath);}
 const policy=rows.find(e=>e.type==='fit-policy-bound');
 if(policy){if(hash(canonical(policy.policy))!==policy.sha256)throw Error('FIT_POLICY_CHANGED');if(await exists(resolve(root,'fit-policy.json'))&&hash(canonical(await read(resolve(root,'fit-policy.json'))))!==policy.sha256)throw Error('FIT_POLICY_CHANGED');}
 const frozen=rows.find(e=>e.type==='models-frozen');
 if(frozen){if(hash(canonical(frozen.freeze))!==frozen.sha256||frozen.freeze.manifestDigest!==hash(canonical(manifest)))throw Error('MODEL_FREEZE_TAMPERED');if(await exists(resolve(root,'freeze.json'))&&hash(canonical(await read(resolve(root,'freeze.json'))))!==frozen.sha256)throw Error('MODEL_FREEZE_TAMPERED');for(const item of frozen.freeze.models){if(hash(await readFile(item.model.path))!==item.model.sha256)throw Error('FROZEN_MODEL_BYTES_CHANGED');}}
 }return {manifestDigest:hash(canonical(manifest)),events:rows.length,gameStarts:rows.filter(e=>e.type==='game-start').length,completed:rows.filter(e=>e.type==='game-complete').length,status:await exists(resolve(root,'status.json'))?await read(resolve(root,'status.json')):null};}
async function freshVerify(requestPath){const request=await read(requestPath);let verified=false,timing;const child=fork(fileURLToPath(new URL('./verify-child.mjs',import.meta.url)),[requestPath],{cwd:engineRoot,execArgv:['--max-old-space-size='+request.manifest.config.maxHeapMb],stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',data=>{if(errors.length<8000)errors+=data;});child.on('message',message=>{if(message?.verified){verified=true;timing=message.timing;}});await new Promise((accept,reject)=>{child.once('error',reject);child.once('exit',code=>code===0&&verified?accept():reject(Error('FRESH_VERIFICATION_FAILED: '+errors)));});return timing;}
