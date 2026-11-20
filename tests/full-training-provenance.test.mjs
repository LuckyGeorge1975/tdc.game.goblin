import assert from 'node:assert/strict';
import test from 'node:test';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {environment,level,play,aiSeats,humanSeats,expectation} from './helpers/full-training-provenance.mjs';
import {prepareFullTrainingCapture,sealFullTrainingCapture} from '../scripts/full-training-capture.mjs';
import {bytes,hash} from '../scripts/full-training-artifacts.mjs';
import {importFullTrainingArchive} from '../scripts/full-training-import.mjs';

test('fresh native archives reject canonical role/policy relabels while neutral simulation prefixes remain unchanged',async()=>{
 const map=await level(), seats=aiSeats(), original=await play(map,seats);
 assert.equal(original.archive.replay.entries.length,6);
 for(const side of ['player','enemy'])for(const replacement of [{controller:'human'},
  {controller:'ai',policy:side+'-weak',difficulty:'weak'},
  {controller:'ai',policy:side+'-strong',difficulty:'strong'}]){
  const changed=structuredClone(original.archive);changed.seats[side]=replacement;
  await assert.rejects(()=>importFullTrainingArchive(changed));
 }
 const a=await importFullTrainingArchive(original.archive);
 assert.deepEqual(a.demonstrations,[]);assert.deepEqual(a.declaredDemonstrations,[]);
 assert.equal(a.provenance.status,'declared-replay');
});

test('independent pre-run expectation and original file/trace receipt gate Human fit rows and recomputed forgeries',async()=>{
 const env=await environment(), map=await level(), seats=humanSeats();
 const input=await expectation(env,map,seats), handle=await prepareFullTrainingCapture(input);
 const original=await play(map,seats), receiptBytes=sealFullTrainingCapture(handle,original);
 const capture={handle,receiptBytes,expectedReceiptSha256:hash(receiptBytes),...original};
 const imported=await importFullTrainingArchive(original.archive,{capture});
 assert.equal(imported.provenance.status,'verified-local-capture');
 assert.equal(imported.demonstrations.length,6);assert.deepEqual(imported.declaredDemonstrations,[]);
 const foreign=await importFullTrainingArchive(original.archive);
 assert.deepEqual(foreign.demonstrations,[]);assert.equal(foreign.declaredDemonstrations.length,6);
 assert.throws(()=>sealFullTrainingCapture(handle,original),/FULL_CAPTURE_ALREADY_SEALED/);
 // A valid newly computed journal with different seat metadata remains declared replay;
 // it cannot satisfy the already sealed independent original recording context.
 const relabeledSeats=humanSeats();relabeledSeats.enemy={controller:'ai',policy:'enemy-weak',difficulty:'weak'};
 const recomputed=await play(map,relabeledSeats);
 assert.equal((await importFullTrainingArchive(recomputed.archive)).provenance.status,'declared-replay');
 await assert.rejects(()=>importFullTrainingArchive(recomputed.archive,{capture:{...capture,...recomputed}}),/FULL_CAPTURE_SEATS/);
 for(const patch of [{receiptBytes:bytes({fake:true})},{archiveBytes:Buffer.concat([original.archiveBytes,Buffer.from(' ')])},
  {traceBytes:Buffer.concat([original.traceBytes,Buffer.from(' ')])},{expectedReceiptSha256:'0'.repeat(64)}])
  await assert.rejects(()=>importFullTrainingArchive(original.archive,{capture:{...capture,...patch}}));
 // Even a newly hashed receipt cannot legitimize a dishonest selector->offer trace.
 const trace=JSON.parse(original.traceBytes);trace.decisions[0].selected=999;
 const altered={...original,traceBytes:bytes(trace)};
 const newHandle=await prepareFullTrainingCapture(input), alteredReceipt=sealFullTrainingCapture(newHandle,altered);
 await assert.rejects(()=>importFullTrainingArchive(original.archive,{capture:{handle:newHandle,
  receiptBytes:alteredReceipt,expectedReceiptSha256:hash(alteredReceipt),...altered}}),/FULL_CAPTURE_DECISION_TRACE/);
 await assert.rejects(()=>prepareFullTrainingCapture({...input,expectedExpectationSha256:'0'.repeat(64)}));
 const beforeCodeChange=await prepareFullTrainingCapture(input);
 await writeFile(resolve(env.root,'recorder.mjs'),'// changed recorder\n');
 assert.throws(()=>sealFullTrainingCapture(beforeCodeChange,original),/FULL_CAPTURE_ARTIFACT_CHANGED/);
 await assert.rejects(()=>prepareFullTrainingCapture(input),/FULL_TRAINING_ARTIFACT_HASH/);
});

test('verified AI/AI captures retain their actual seats, full offer trace, and zero Human demonstrations',async()=>{
 const env=await environment(), map=await level(), seats=aiSeats();
 const input=await expectation(env,map,seats), handle=await prepareFullTrainingCapture(input);
 const original=await play(map,seats), receiptBytes=sealFullTrainingCapture(handle,original);
 const result=await importFullTrainingArchive(original.archive,{capture:{handle,receiptBytes,
  expectedReceiptSha256:hash(receiptBytes),...original}});
 assert.equal(result.provenance.status,'verified-local-capture');assert.deepEqual(result.demonstrations,[]);
 assert.ok(JSON.parse(original.traceBytes).decisions.some(row=>row.candidates.length>1));
 const independent=await prepareFullTrainingCapture({...input});
 const forged=await play(map,{...seats,player:{controller:'human'}});
 const declared=await importFullTrainingArchive(forged.archive);
 assert.equal(declared.declaredDemonstrations.length,3);assert.deepEqual(declared.demonstrations,[]);
 await assert.rejects(()=>importFullTrainingArchive(forged.archive,{capture:{handle:independent,receiptBytes,
  expectedReceiptSha256:hash(receiptBytes),...forged}}),/FULL_CAPTURE_SEATS/);
});
