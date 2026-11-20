// These handles are explicitly prepared by a trusted local recorder/import caller.
// Hashes identify its files; they do not authenticate arbitrary foreign programs.
import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {artifact,artifactList,bytes,check,currentSourcesHash,exact,freeze,hash,isCommit,isHash,json,textHash} from './full-training-artifacts.mjs';
import {resolveFullExperimentPolicy,validateFullExperimentRecording} from './full-experiment-policies.mjs';

const captures=new WeakMap();
const plain=value=>JSON.parse(JSON.stringify(value));
function seatsCheck(seats,catalog){
 check(exact(seats,['player','enemy']));
 for(const side of ['player','enemy']){
  const seat=seats[side];
  if(exact(seat,['controller'])&&seat.controller==='human')continue;
  check(exact(seat,['controller','policy','difficulty'])&&seat.controller==='ai');
  if(typeof seat.policy==='string'&&seat.policy.startsWith('full-experiment:'))
   resolveFullExperimentPolicy(catalog,seat.policy,side,seat.difficulty);
  else check(['weak','medium','strong'].includes(seat.difficulty)&&seat.policy===side+'-'+seat.difficulty||
   seat.difficulty===null&&(side==='player'?seat.policy==='full-attack-2a':
    seat.policy===null||seat.policy==='full-defender-control-trial'));
 }
}

export async function prepareFullTrainingCapture({expectationBytes,expectedExpectationSha256,artifactRoot,
 engineArchivePath,runtimeCommit,experimentCatalog}){
 artifactRoot=await realpath(artifactRoot);engineArchivePath=await realpath(engineArchivePath);
 check(isHash(expectedExpectationSha256)&&textHash(expectationBytes)===expectedExpectationSha256,'FULL_CAPTURE_EXPECTATION_HASH');
 const expectation=json(expectationBytes);
 check(exact(expectation,['version','caseId','runtimeCommit','engineArchiveSha256','nativeSourcesSha256',
  'runManifestRef','runManifestSha256','recorderArtifacts','seed','level','seats']));
 check(expectation.version==='goblin-full-capture-expectation-v1'&&typeof expectation.caseId==='string'&&expectation.caseId.length>0&&
  isCommit(runtimeCommit)&&expectation.runtimeCommit===runtimeCommit&&
  expectation.engineArchiveSha256===hash(await readFile(engineArchivePath))&&
  expectation.nativeSourcesSha256===currentSourcesHash()&&
  Number.isInteger(expectation.seed)&&expectation.seed>=0&&expectation.seed<=0xffffffff&&
  exact(expectation.level,['id','digest'])&&typeof expectation.level.id==='string'&&typeof expectation.level.digest==='string');
 const guards=[];
 const manifest=await artifact(artifactRoot,expectation.runManifestRef,expectation.runManifestSha256);
 guards.push({path:manifest.absolute,sha256:expectation.runManifestSha256});
 artifactList(expectation.recorderArtifacts);
 for(const item of expectation.recorderArtifacts){
  const loaded=await artifact(artifactRoot,item.path,item.sha256);guards.push({path:loaded.absolute,sha256:item.sha256});
 }
 guards.push({path:engineArchivePath,sha256:expectation.engineArchiveSha256,raw:true});
 seatsCheck(expectation.seats,experimentCatalog);
 for(const side of ['player','enemy'])if(expectation.seats[side].policy?.startsWith('full-experiment:')){
  const seat=expectation.seats[side], entry=resolveFullExperimentPolicy(experimentCatalog,seat.policy,side,seat.difficulty);
  for(const name of ['runtimeCommit','engineArchiveSha256','nativeSourcesSha256','runManifestSha256'])
   check(entry[name]===expectation[name],'FULL_CAPTURE_EXPERIMENT_CONTEXT');
  validateFullExperimentRecording(experimentCatalog,seat.policy,{seed:expectation.seed,caseId:expectation.caseId});
 }
 const handle=Object.freeze({});
 captures.set(handle,{expectation:freeze(expectation),expectedExpectationSha256,sealed:false,guards});
 return handle;
}

function originalCheck(state,archiveBytes,traceBytes){
 check(state,'FULL_CAPTURE_NOT_PREPARED');
 for(const guard of state.guards)check((guard.raw?hash:textHash)(readFileSync(guard.path))===guard.sha256,'FULL_CAPTURE_ARTIFACT_CHANGED');
 check(currentSourcesHash()===state.expectation.nativeSourcesSha256,'FULL_CAPTURE_SOURCE_CHANGED');
 const archive=json(archiveBytes), trace=json(traceBytes), expected=state.expectation;
 assert.deepEqual(archive.seats,expected.seats,'FULL_CAPTURE_SEATS');
 check(archive.profile==='FULL_CATALOG_v1'&&archive.replay.seed===expected.seed&&
  archive.replay.level.id===expected.level.id&&archive.replay.level.digest===expected.level.digest,'FULL_CAPTURE_CONTEXT');
 check(exact(trace,['version','caseId','decisions'])&&trace.version==='goblin-full-decision-trace-v1'&&
  trace.caseId===expected.caseId&&Array.isArray(trace.decisions)&&trace.decisions.length===archive.replay.entries.length,'FULL_CAPTURE_TRACE');
 return {archive,trace};
}

export function sealFullTrainingCapture(handle,{archiveBytes,traceBytes}){
 const state=captures.get(handle);
 check(state&&!state.sealed,'FULL_CAPTURE_ALREADY_SEALED');
 const {archive}=originalCheck(state,archiveBytes,traceBytes);
 const receipt={version:'goblin-full-capture-receipt-v1',caseId:state.expectation.caseId,
  expectationSha256:state.expectedExpectationSha256,archiveRawSha256:hash(archiveBytes),
  decisionTraceRawSha256:hash(traceBytes),acceptedCommands:archive.replay.entries.length};
 state.sealed=true;
 return bytes(receipt);
}

export function verifyFullTrainingCapture(archive,{handle,receiptBytes,expectedReceiptSha256,archiveBytes,traceBytes}){
 check(isHash(expectedReceiptSha256)&&hash(receiptBytes)===expectedReceiptSha256,'FULL_CAPTURE_RECEIPT_HASH');
 const state=captures.get(handle), receipt=json(receiptBytes);
 const original=originalCheck(state,archiveBytes,traceBytes);
 assert.deepEqual(original.archive,archive,'FULL_CAPTURE_ORIGINAL_BYTES');
 check(exact(receipt,['version','caseId','expectationSha256','archiveRawSha256','decisionTraceRawSha256','acceptedCommands'])&&
  receipt.version==='goblin-full-capture-receipt-v1'&&receipt.caseId===state.expectation.caseId&&
  receipt.expectationSha256===state.expectedExpectationSha256&&receipt.archiveRawSha256===hash(archiveBytes)&&
  receipt.decisionTraceRawSha256===hash(traceBytes)&&receipt.acceptedCommands===archive.replay.entries.length,'FULL_CAPTURE_RECEIPT');
 return {trace:original.trace,provenance:{status:'verified-local-capture',caseId:receipt.caseId,
  expectationSha256:receipt.expectationSha256,receiptSha256:expectedReceiptSha256,
  archiveRawSha256:receipt.archiveRawSha256,decisionTraceRawSha256:receipt.decisionTraceRawSha256}};
}

// Use the existing native composer for both recorder and verifier. No policy is
// re-executed during import, and no opaque candidate key becomes persisted identity.
export function fullTrainingDecisionFrame(port,player){
 const state=port.state(), opened=port.open(state.controller), projection=port.project(state.controller);
 check(opened&&projection&&!state.ended,'FULL_CAPTURE_FRAME');
 const candidates=opened.entries??[...(state.controller==='human'?player.humanPlayerOptions(port):
  player.playerOptions(!!projection.view.tactics)),{command:{type:'EndPhase'},facts:{}}];
 return {state,opened,view:projection.view,candidates};
}

export function fullTrainingDecisionTraceRow(frame,commandIndex,command,seat){
 const {state,view,candidates}=frame;
 check(Number.isSafeInteger(commandIndex)&&commandIndex>=0&&seat.controller===state.controller,'FULL_CAPTURE_FRAME');
 const selected=candidates.findIndex(item=>{
  try{assert.deepEqual(plain(item.command),plain(command));return true;}catch{return false;}
 });
 check(selected>=0,'FULL_CAPTURE_COMMAND_NOT_OFFERED');
 return plain({commandIndex,side:state.side,slot:state.slot,controller:seat.controller,
  policy:seat.controller==='ai'?seat.policy:null,view,
  candidates:candidates.map(({command,facts})=>({command,facts})),selected});
}
