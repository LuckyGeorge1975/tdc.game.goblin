import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {setImmediate as yieldToEventLoop} from 'node:timers/promises';
import {initialWeights,validateWeights,validateInput,pairGradients,createScorer} from './fire-network.mjs';
import {jsonBytes,sha256} from './sealed-artifacts.mjs';
import {getBinding} from './binding.mjs';
import {FULL_EXPERIMENT_MODEL_VERSION,FULL_EXPERIMENT_FEATURE_VERSION,FULL_EXPERIMENT_REWARD_VERSION} from '../full-experiment-policies.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
export function pairMetrics(model,rows){
  const score=createScorer(model);let squared=0,absolute=0,nonneutral=0,correct=0,baselineSquared=0;
  for(const row of rows){const predicted=score(row.alternative)-score(row.reference),error=predicted-row.delta;
    squared+=error**2;absolute+=Math.abs(error);baselineSquared+=row.delta**2;
    if(row.delta!==0){nonneutral++;if(Math.sign(predicted)===Math.sign(row.delta))correct++;}}
  const n=rows.length;return {pairs:n,meanPairLoss:squared/(2*n),rmse:Math.sqrt(squared/n),mae:absolute/n,
    zeroDifferenceRmse:Math.sqrt(baselineSquared/n),nonneutral,rankAccuracy:nonneutral?correct/nonneutral:null,
    labels:Object.fromEntries([-1,-0.5,0,0.5,1].map(delta=>[delta,rows.filter(row=>row.delta===delta).length]))};
}
function validateRows(rows,side){
  assert.ok(Array.isArray(rows));for(const row of rows){
    assert.equal(row.side,side,'AI_CORE_FIT_SIDE');validateInput(row.reference);validateInput(row.alternative);
    assert.ok([-1,-0.5,0,0.5,1].includes(row.delta),'AI_CORE_PAIR_LABEL');
    assert.ok(typeof row.familyId==='string'&&row.familyId.length&&Number.isInteger(row.seed),'AI_CORE_PAIR_FAMILY');
  }
}
export async function fitFireTarget({train,validation,config,checkpoint,signal,onEpoch}){
  const checkpointPath=config?.checkpointPath?resolve(config.checkpointPath):config?.outputRoot?resolve(config.outputRoot,'checkpoint.json'):null;
  const cfg={side:config?.side,maxEpochs:config?.maxEpochs??5000,patience:config?.patience??50,minDelta:config?.minDelta??1e-8,
    learningRate:config?.learningRate??0.01,seed:config?.seed??231371,minPairs:config?.minPairs??1,
    orderingSeed:config?.orderingSeed??((config?.seed??231371)^0x9e3779b9)>>>0,
    runManifestSha256:config?.runManifestSha256};
  assert.ok(['player','enemy'].includes(cfg.side));
  assert.ok(Number.isSafeInteger(cfg.maxEpochs)&&cfg.maxEpochs>=1&&cfg.maxEpochs<=5000);
  assert.ok(Number.isSafeInteger(cfg.patience)&&cfg.patience>=1&&Number.isFinite(cfg.minDelta)&&cfg.minDelta>=0);
  assert.ok(Number.isFinite(cfg.learningRate)&&cfg.learningRate>0&&Number.isInteger(cfg.seed)&&cfg.seed>=0&&cfg.seed<=0xffffffff);
  assert.ok(Number.isInteger(cfg.orderingSeed)&&cfg.orderingSeed>=0&&cfg.orderingSeed<=0xffffffff);
  assert.ok(Number.isSafeInteger(cfg.minPairs)&&cfg.minPairs>=1);assert.match(cfg.runManifestSha256,/^[a-f0-9]{64}$/);
  validateRows(train,cfg.side);validateRows(validation,cfg.side);
  if(train.length<cfg.minPairs||validation.length<cfg.minPairs)return {status:'DATA_INSUFFICIENT',model:null,modelRef:null};
  const families=new Set(train.map(row=>row.familyId)),seeds=new Set(train.map(row=>row.seed));
  assert.ok(validation.every(row=>!families.has(row.familyId)&&!seeds.has(row.seed)),'AI_CORE_SPLIT_LEAKAGE');
  const binding=await getBinding(),trainHash=sha256(jsonBytes(train)),validationHash=sha256(jsonBytes(validation)),configHash=sha256(jsonBytes(cfg));
  for(const row of [...train,...validation]){
    if(row.codeSha256)assert.equal(row.codeSha256,binding.codeSha256,'AI_CORE_FIT_DATA_CODE');
    if(row.manifestSha256)assert.equal(row.manifestSha256,cfg.runManifestSha256,'AI_CORE_FIT_DATA_MANIFEST');
  }
  if(!checkpoint&&checkpointPath)try{checkpoint=JSON.parse(await readFile(checkpointPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(typeof checkpoint==='string')checkpoint=JSON.parse(await readFile(checkpoint,'utf8'));
  if(checkpoint){const {stateSha256,...body}=checkpoint;assert.equal(stateSha256,sha256(jsonBytes(body)),'AI_CORE_CHECKPOINT_INTEGRITY');}
  let state=checkpoint?plain(checkpoint):{version:'goblin-ai-fit-checkpoint-v1',side:cfg.side,configHash,trainHash,validationHash,
    codeSha256:binding.codeSha256,runtimeCommit:binding.runtimeCommit,engineArchiveSha256:binding.engineArchiveSha256,
    nativeSourcesSha256:binding.nativeSourcesSha256,model:initialWeights(cfg.seed),epoch:0,updates:0,rngState:cfg.orderingSeed,order:[],cursor:0,
    best:null,bestLoss:null,bestEpoch:0,staleEpochs:0,history:[]};
  assert.equal(state.version,'goblin-ai-fit-checkpoint-v1');
  for(const [field,value]of Object.entries({side:cfg.side,configHash,trainHash,validationHash,codeSha256:binding.codeSha256,
    runtimeCommit:binding.runtimeCommit,engineArchiveSha256:binding.engineArchiveSha256,nativeSourcesSha256:binding.nativeSourcesSha256}))
    assert.equal(state[field],value,'AI_CORE_CHECKPOINT_BINDING '+field);
  validateWeights(state.model);
  assert.ok(Number.isSafeInteger(state.epoch)&&state.epoch>=0&&state.epoch<=cfg.maxEpochs&&Number.isSafeInteger(state.updates)&&state.updates>=0);
  assert.ok(Number.isSafeInteger(state.rngState)&&state.rngState>=0&&state.rngState<=0xffffffff);
  assert.ok(Array.isArray(state.order)&&Number.isInteger(state.cursor)&&state.cursor>=0&&state.cursor<=state.order.length);
  if(state.order.length)assert.deepEqual([...state.order].sort((a,b)=>a-b),Array.from({length:train.length},(_,i)=>i),'AI_CORE_CHECKPOINT_ORDER');
  assert.equal(state.updates,state.epoch*train.length+state.cursor,'AI_CORE_CHECKPOINT_UPDATES');
  assert.equal(state.history.length,state.epoch,'AI_CORE_CHECKPOINT_EPOCH_HISTORY');
  if(state.best)validateWeights(state.best);
  const outputRoot=config.outputRoot;
  if(outputRoot)await mkdir(outputRoot,{recursive:true});
  if(checkpointPath)await mkdir(dirname(checkpointPath),{recursive:true});
  async function persist(){if(checkpointPath){
    const temporary=checkpointPath+'.tmp';
    await writeFile(temporary,jsonBytes(state));await rename(temporary,checkpointPath);
  }}
  function seal(){const {stateSha256,...body}=state;state.stateSha256=sha256(jsonBytes(body));}
  function shuffle(){
    state.order=Array.from({length:train.length},(_,i)=>i);
    for(let i=state.order.length-1;i>0;i--){state.rngState=(Math.imul(state.rngState,1664525)+1013904223)>>>0;
      const j=Math.floor(state.rngState/2**32*(i+1));[state.order[i],state.order[j]]=[state.order[j],state.order[i]];}
  }
  let stopped=false;
  while(state.epoch<cfg.maxEpochs&&state.staleEpochs<cfg.patience){
    if(!state.order.length)shuffle();
    while(state.cursor<train.length){
      if(signal?.aborted){stopped=true;break;}
      const {gradients}=pairGradients(state.model,train[state.order[state.cursor]]);
      for(let i=0;i<8;i++){
        state.model.hidden[i].weights=state.model.hidden[i].weights.map((weight,j)=>weight-cfg.learningRate*gradients.hidden[i].weights[j]);
        state.model.hidden[i].bias-=cfg.learningRate*gradients.hidden[i].bias;
        state.model.output.weights[i]-=cfg.learningRate*gradients.output.weights[i];
      }
      validateWeights(state.model);state.cursor++;state.updates++;
      if(state.updates%64===0)await yieldToEventLoop();
    }
    if(stopped)break;
    state.epoch++;state.order=[];state.cursor=0;
    const metrics={epoch:state.epoch,updates:state.updates,train:pairMetrics(state.model,train),validation:pairMetrics(state.model,validation)};
    assert.ok(Number.isFinite(metrics.train.rmse)&&Number.isFinite(metrics.validation.rmse),'AI_CORE_NONFINITE_FIT');
    const loss=metrics.validation.meanPairLoss;
    if(state.bestLoss===null||state.bestLoss-loss>cfg.minDelta){state.bestLoss=loss;state.best=plain(state.model);state.bestEpoch=state.epoch;state.staleEpochs=0;}
    else state.staleEpochs++;
    state.history.push(metrics);seal();await persist();await onEpoch?.({...metrics,checkpoint:plain(state)});await yieldToEventLoop();
  }
  seal();await persist();
  if(stopped)return {status:'STOPPED',model:null,modelRef:null,checkpoint:state,epochs:state.epoch,updates:state.updates,metrics:state.history};
  assert.ok(state.best,'AI_CORE_NO_VALIDATION_CHECKPOINT');
  const trainingDataSha256=sha256(jsonBytes({train:trainHash,validation:validationHash}));
  const model={version:FULL_EXPERIMENT_MODEL_VERSION,side:cfg.side,featureVersion:FULL_EXPERIMENT_FEATURE_VERSION,rewardVersion:FULL_EXPERIMENT_REWARD_VERSION,
    runtimeCommit:binding.runtimeCommit,engineArchiveSha256:binding.engineArchiveSha256,nativeSourcesSha256:binding.nativeSourcesSha256,
    runManifestSha256:cfg.runManifestSha256,trainingDataSha256,...plain(state.best)};
  const modelBytes=Buffer.from(JSON.stringify(model)+'\n'),hash=sha256(modelBytes);
  let modelRef=null;
  if(outputRoot){const path=resolve(outputRoot,'model-'+cfg.side+'-'+hash+'.json');
    try{await writeFile(path,modelBytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert.equal(sha256(await readFile(path)),hash,'AI_CORE_FROZEN_MODEL_DRIFT');}
    modelRef={path,sha256:hash,trainingDataSha256,side:cfg.side};}
  return {status:'FITTED',model,modelRef,models:{[cfg.side]:modelRef},epochs:state.epoch,updates:state.updates,checkpoint:state,
    metrics:{history:state.history,bestEpoch:state.bestEpoch,train:pairMetrics(state.best,train),validation:pairMetrics(state.best,validation)},
    freeze:{sha256:hash,trainingDataSha256,trainSha256:trainHash,validationSha256:validationHash,configSha256:configHash,codeSha256:binding.codeSha256}};
}
