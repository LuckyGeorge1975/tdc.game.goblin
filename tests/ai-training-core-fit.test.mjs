import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fitFireTarget} from '../scripts/ai-training-core/index.mjs';
import {pairMetrics} from '../scripts/ai-training-core/fit.mjs';
import {initialWeights,nativePairLabel} from '../scripts/ai-training-core/fire-network.mjs';
const vector=x=>[1,0,0,0,0,0,1,0,0,0,x,0.5,0,0,0,0,0,0,0];
// Analytic optimizer fixtures, not asserted to be real game-training rows.
const row=(seed,delta=0.5)=>({familyId:'family-'+seed,seed,side:'player',reference:vector(0.25),alternative:vector(0.75),delta});
const train=[row(1),row(2,-0.5)],validation=[row(3)];
const config={side:'player',maxEpochs:4,patience:50,minDelta:0,learningRate:0.01,seed:231371,runManifestSha256:'1'.repeat(64)};

test('Gen58 pair optimizer resumes the exact RNG/order/current/best checkpoint and freezes idempotent model bytes',async()=>{
  const base=fileURLToPath(new URL('../.tools/ai-training-core-tests/',import.meta.url));await mkdir(base,{recursive:true});
  const root=await mkdtemp(resolve(base,'fit-'));
  const full=await fitFireTarget({train,validation,config:{...config,outputRoot:resolve(root,'full')}});
  const controller=new AbortController();
  const checkpointPath=resolve(root,'explicit-checkpoint.json');
  const stopped=await fitFireTarget({train,validation,config:{...config,checkpointPath},signal:controller.signal,onEpoch:async state=>{
    await Promise.resolve();if(state.epoch===2)controller.abort();
  }});
  assert.equal(stopped.status,'STOPPED');assert.equal(stopped.model,null);assert.equal(stopped.updates,2*train.length);
  assert.deepEqual(JSON.parse(await readFile(checkpointPath)),stopped.checkpoint);
  const resumed=await fitFireTarget({train,validation,config:{...config,outputRoot:resolve(root,'resumed')},checkpoint:stopped.checkpoint});
  assert.equal(resumed.status,'FITTED');assert.equal(resumed.updates,4*train.length);
  assert.deepEqual(resumed.model,full.model);assert.deepEqual(resumed.metrics,full.metrics);assert.deepEqual(resumed.checkpoint,full.checkpoint);
  assert.deepEqual(await readFile(resumed.modelRef.path),await readFile(full.modelRef.path));
  const fromFile=await fitFireTarget({train,validation,config:{...config,checkpointPath}});
  assert.deepEqual(fromFile.model,full.model);assert.deepEqual(fromFile.checkpoint,full.checkpoint);
  const repeated=await fitFireTarget({train,validation,config:{...config,outputRoot:resolve(root,'resumed')},checkpoint:resumed.checkpoint});
  assert.equal(repeated.modelRef.sha256,resumed.modelRef.sha256);
  const corrupt=structuredClone(stopped.checkpoint);corrupt.model.hidden[0].weights[0]+=0.1;
  await assert.rejects(()=>fitFireTarget({train,validation,config,checkpoint:corrupt}),/AI_CORE_CHECKPOINT_INTEGRITY/);
  await assert.rejects(()=>fitFireTarget({train,validation,config:{...config,learningRate:0.02},checkpoint:stopped.checkpoint}),/AI_CORE_CHECKPOINT_BINDING/);
  await assert.rejects(()=>fitFireTarget({train:[...train,row(4)],validation,config,checkpoint:stopped.checkpoint}),/AI_CORE_CHECKPOINT_BINDING/);
});

test('validation controls the best checkpoint and early stopping, with RMSE=sqrt(2*meanPairLoss)',async()=>{
  const fitted=await fitFireTarget({train,validation,config:{...config,maxEpochs:20,patience:2,minDelta:100}});
  assert.equal(fitted.epochs,3);assert.equal(fitted.metrics.bestEpoch,1);assert.equal(fitted.updates,3*train.length);
  const metrics=pairMetrics(initialWeights(),validation);assert.ok(Math.abs(metrics.rmse-Math.sqrt(2*metrics.meanPairLoss))<1e-15);
  assert.equal(metrics.zeroDifferenceRmse,0.5);assert.equal(metrics.nonneutral,1);
  const neutral=pairMetrics(initialWeights(),[row(5,0)]);assert.equal(neutral.nonneutral,0);assert.equal(neutral.rankAccuracy,null);
  assert.equal((await fitFireTarget({train:[],validation,config})).status,'DATA_INSUFFICIENT');
  await assert.rejects(()=>fitFireTarget({train,validation:[row(1)],config}),/AI_CORE_SPLIT_LEAKAGE/);
  await assert.rejects(()=>fitFireTarget({train,validation:[{...row(3),familyId:train[0].familyId}],config}),/AI_CORE_SPLIT_LEAKAGE/);
  await assert.rejects(()=>fitFireTarget({train:[{...row(1),delta:0.1}],validation,config}),/AI_CORE_PAIR_LABEL/);
  await assert.rejects(()=>fitFireTarget({train:[{...row(1),reference:vector(Infinity)}],validation,config}));
});

test('timers can interrupt a long epoch cooperatively and the effective checkpoint resumes without invented labels',async()=>{
  const rows=Array.from({length:512},(_,i)=>row(i+100));const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),0);
  const stopped=await fitFireTarget({train:rows,validation:[row(9999)],config:{...config,maxEpochs:20},signal:controller.signal});
  clearTimeout(timer);assert.equal(stopped.status,'STOPPED');assert.ok(stopped.updates<20*rows.length);assert.equal(stopped.model,null);
  for(const completion of ['technical-limit','error'])assert.equal(nativePairLabel(
    {completion:'native',outcome:'player-win'},{completion,outcome:null},'player'),null);
  assert.equal(nativePairLabel({completion:'native',outcome:'enemy-win'},{completion:'native',outcome:'draw'},'player'),0.5);
});
