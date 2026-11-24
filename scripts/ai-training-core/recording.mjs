import assert from 'node:assert/strict';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createRecordingGame} from './headless.mjs';
import {bindingSnapshot,getBinding,policyId,difficulty} from './binding.mjs';
import {installStrategies} from './strategies.mjs';
import {createPolicyPackage} from './packages.mjs';
import {jsonBytes,sha256,writeOnce,readArtifact,semanticCandidate,candidateFingerprint} from './sealed-artifacts.mjs';
import {encodeFullFireEffects} from '../../src/core/full-attack-2a.mjs';
import {createFullCatalogAiHost} from '../../src/core/full-catalog-ai-adapter.mjs';
import {fullTrainingDecisionFrame,fullTrainingDecisionTraceRow,prepareFullTrainingCapture,sealFullTrainingCapture} from '../full-training-capture.mjs';
import {registerFullExperimentController,prepareFullExperimentCatalog} from '../full-experiment-policies.mjs';
import {importFullTrainingArchive} from '../full-training-import.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const matchBinding=(manifest,binding)=>assert.deepEqual(manifest.binding??manifest,binding,'AI_CORE_RUN_BINDING');
const outcome=value=>value==='draw'?'draw':value===true?'player-win':value===false?'enemy-win':null;
function bounds(value){
  const result={commandLimit:value?.commandLimit??10000,roundLimit:value?.roundLimit??500,wallMs:value?.wallMs??null,workers:value?.workers??1};
  assert.ok(Number.isSafeInteger(result.commandLimit)&&result.commandLimit>0&&Number.isSafeInteger(result.roundLimit)&&result.roundLimit>0);
  assert.ok(result.wallMs===null||Number.isFinite(result.wallMs)&&result.wallMs>0);
  assert.ok(Number.isInteger(result.workers)&&result.workers>=1&&result.workers<=8);return result;
}

export async function runCase({engineRoot,runRoot,manifest,caseId,level,seed,seats,intervention,model,limits,signal}){
  const caseStarted=performance.now(),caseCpu=process.cpuUsage();
  assert.ok(typeof caseId==='string'&&caseId.length>0,'AI_CORE_CASE_ID');
  assert.ok(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'AI_CORE_SEED');
  assert.ok(seats&&Object.keys(seats).sort().join(',')==='enemy,player'&&
    Object.values(seats).every(id=>['weak','medium','strong','trained'].includes(id)),'AI_CORE_AI_SEATS_REQUIRED');
  assert.ok(!(intervention&&model),'AI_CORE_SINGLE_EXPERIMENT');
  if(intervention||model)assert.notEqual(seats[(intervention??model).side],'trained','AI_CORE_TRAINED_OVERLAY_UNSUPPORTED');
  const snapshot=await bindingSnapshot({engineRoot}),binding=snapshot.binding;
  matchBinding(manifest,binding);
  limits=bounds(limits??manifest.bounds??manifest.config?.bounds);
  await mkdir(runRoot,{recursive:true});runRoot=await import('node:fs/promises').then(fs=>fs.realpath(runRoot));
  assert.equal((await readdir(runRoot)).length,0,'AI_CORE_ATTEMPT_NOT_EMPTY');
  const artifactRefs={};
  async function save(name,data){const ref=await writeOnce(runRoot,name,data);artifactRefs[name]=ref;return ref;}
  await save('engine.snapshot.json.gz',snapshot.archive);
  for(const file of snapshot.files){const name='code/'+file.path;await mkdir(dirname(resolve(runRoot,name)),{recursive:true});await writeOnce(runRoot,name,Buffer.from(file.text));}
  const manifestBytes=jsonBytes(manifest),manifestRef=await save('manifest.json',manifestBytes);
  const game=createRecordingGame(),decisions=[],diagnostics=[],sampled=[];
  let installed,host,port,frame,row,selectionTiming,experiment,catalog,handle,expectationRef;
  const registrations=[],packages=[];
  let completion='technical-limit',error=null,selectionError;
  const started=performance.now(),cpuStart=process.cpuUsage();
  let strategyWallMs=0,strategyCpuUs=0,engineWallMs=0;
  function selected(batch,key,policy,timing){
    const index=batch.candidates.findIndex(candidate=>candidate.key===key);
    assert.ok(index>=0,'AI_CORE_SELECTION_NOT_OFFERED');
    assert.equal(batch.candidates.length,frame.candidates.length,'AI_CORE_OFFER_COUNT');
    const command=frame.candidates[index].command;
    row=fullTrainingDecisionTraceRow(frame,decisions.length,command,recordedSeats[frame.state.side]);
    diagnostics.push({commandIndex:decisions.length,side:batch.side,turn:batch.view.turn,phase:batch.phase,
      policy,selected:index,candidateCount:batch.candidates.length,timing:timing??null});
    if(intervention||model||seats[batch.side]==='trained'||sampled.some(item=>item.side===batch.side))return;
    const baseline=batch.candidates[index],features=encodeFullFireEffects(batch,baseline);
    if(!features||!['fire','hex-fire'].includes(baseline.kind))return;
    const alternative=batch.candidates.find(candidate=>candidate.actorId===baseline.actorId&&candidate.weaponRef===baseline.weaponRef&&
      ['fire','hex-fire'].includes(candidate.kind)&&encodeFullFireEffects(batch,candidate)!==null&&
      JSON.stringify(encodeFullFireEffects(batch,candidate))!==JSON.stringify(features));
    if(!alternative)return;
    sampled.push({version:'goblin-full-fire-intervention-v1',caseId,side:batch.side,seed,turn:batch.view.turn,phase:'fire',slot:'fire',
      commandIndex:decisions.length,actorId:baseline.actorId,weaponRef:baseline.weaponRef,
      referenceCommandSha256:sha256(jsonBytes(plain(command))),offerSha256:sha256(jsonBytes(batch.candidates.map(semanticCandidate))),
      referenceSha256:candidateFingerprint(baseline),alternativeSha256:candidateFingerprint(alternative),
      prefixSha256:sha256(jsonBytes(plain(port.simulationSnapshot(port.ticket('ai')).replay))),
      referenceFeatures:features,alternativeFeatures:encodeFullFireEffects(batch,alternative),
      referenceCandidate:semanticCandidate(baseline),alternativeCandidate:semanticCandidate(alternative)});
  }
  const recordedSeats={};
  let abort=()=>{};
  try{
    await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
    game.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
    installed=await installStrategies(game,{workers:limits.workers,observe(batch,key,policy,timing){
      strategyWallMs+=timing.wallMs;strategyCpuUs+=timing.cpuUs.user+timing.cpuUs.system;
      if(!packages.some(item=>item.side===batch.side))selected(batch,key,policy.id,timing);
    }});
    game.context.runtimeLevel=plain(level);
    const config=await game.run('GoblinEditorDraft.prepare(runtimeLevel)');
    assert.equal(level.objective,'eliminate-opponent','AI_CORE_FORCE_OBJECTIVE_REQUIRED');
    game.context.runtimeConfig=config;
    const selections=Object.fromEntries(['player','enemy'].map(side=>[side,policyId(side,seats[side])]));
    // Qualify the declared native seating before registering any experimental wrapper.
    installed.owner.nativeSetup(config,selections);
    const spec=intervention?{...plain(intervention),caseId}:null;
    if(spec||model)assert.ok(['player','enemy'].includes((spec??model).side));
    for(const side of ['player','enemy'])if(spec?.side===side||model?.side===side){
      packages.push(await createPolicyPackage({root:runRoot,binding,manifestSha256:manifestRef.sha256,side,base:seats[side],
        intervention:spec?.side===side?spec:undefined,model:model?.side===side?model:undefined}));
    }
    if(packages.length){
      experiment={entries:packages.flatMap(item=>item.entries),policies:packages.map(({id,side,mode})=>({id,side,mode}))};
      catalog=await prepareFullExperimentCatalog({artifactRoot:runRoot,entries:experiment.entries,runtimeCommit:binding.runtimeCommit,
        engineArchivePath:resolve(runRoot,binding.engineArchivePath)});
    }
    for(const policy of packages){
      const side=policy.side;
      const native=installed.baseSelector(selections[side]);
      registrations.push(await registerFullExperimentController({catalog,id:policy.id,
        full:game.context.GoblinCatalogFullRuntime,root:game.context,
        baseSelector:{id:native.id,async select(...args){
          const start=performance.now(),cpu=process.cpuUsage();const value=await native.select(...args);
          selectionTiming={wallMs:performance.now()-start,cpuUs:process.cpuUsage(cpu)};
          strategyWallMs+=selectionTiming.wallMs;strategyCpuUs+=selectionTiming.cpuUs.user+selectionTiming.cpuUs.system;return value;
        }},onDecision:decision=>selected(decision.batch,decision.result.key,policy.id,selectionTiming),
        onError:caught=>{selectionError={name:caught.name,message:caught.message,stack:caught.stack};}}));
      selections[side]=policy.id;
    }
    for(const side of ['player','enemy'])recordedSeats[side]={controller:'ai',policy:selections[side],
      difficulty:model?.side===side?null:difficulty(seats[side])};
    const expectation={version:'goblin-full-capture-expectation-v1',caseId,runtimeCommit:binding.runtimeCommit,
      engineArchiveSha256:binding.engineArchiveSha256,nativeSourcesSha256:binding.nativeSourcesSha256,
      runManifestRef:'manifest.json',runManifestSha256:manifestRef.sha256,recorderArtifacts:binding.recorderArtifacts,
      seed,level:{id:'editor-draft',digest:config.catalog.levelDigest},seats:recordedSeats};
    const expectationBytes=jsonBytes(expectation);expectationRef=await save('expectation.json',expectationBytes);
    handle=await prepareFullTrainingCapture({expectationBytes,expectedExpectationSha256:expectationRef.sha256,
      artifactRoot:runRoot,engineArchivePath:resolve(runRoot,binding.engineArchivePath),runtimeCommit:binding.runtimeCommit,experimentCatalog:catalog});
    const setup=installed.owner.nativeSetup(config,selections);
    game.context.controls={...setup,seed};port=game.run('loadEditorDraft(runtimeConfig,controls)');
    host=installed.owner.bind(game.run('legacySession'),selections,{refresh(){}},port);
    const full=game.context.GoblinCatalogFullRuntime;
    const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
    abort=()=>host.pause();signal?.addEventListener('abort',abort,{once:true});
    while(!port.state().ended&&decisions.length<limits.commandLimit&&game.run('turn')<=limits.roundLimit&&
      (limits.wallMs===null||performance.now()-started<limits.wallMs)){
      if(signal?.aborted){completion='stopped';break;}
      frame=fullTrainingDecisionFrame(port,player);row=null;selectionTiming=null;
      const start=performance.now(),beforeStrategy=strategyWallMs;
      const applied=await host.advance();
      if(signal?.aborted&&!applied.ok){completion='stopped';break;}
      assert.equal(applied.ok,true,JSON.stringify(applied));assert.ok(row,'AI_CORE_DECISION_NOT_RECORDED');
      engineWallMs+=Math.max(0,performance.now()-start-(strategyWallMs-beforeStrategy));
      const replay=port.state().ended?port.trainingArchive().replay:port.simulationSnapshot(port.ticket('ai')).replay;
      assert.deepEqual(plain(replay.entries.at(-1).command),row.candidates[row.selected].command,'AI_CORE_ACCEPTED_COMMAND');
      decisions.push(row);
      if(signal?.aborted){completion='stopped';break;}
    }
    if(port.state().ended)completion='native';
    for(const registration of registrations)registration.finish(completion==='stopped'?'technical-limit':completion);
  }catch(caught){completion=signal?.aborted?'stopped':'error';error=selectionError??{name:caught.name,message:caught.message};}
  try{
    const traceBytes=jsonBytes({version:'goblin-full-decision-trace-v1',caseId,decisions});
    await save('trace.json',traceBytes);
    const timing={wallMs:performance.now()-started,cpuUs:process.cpuUsage(cpuStart),strategyWallMs,strategyCpuUs,
      engineWallMs,recordingAndSetupWallMs:Math.max(0,performance.now()-started-strategyWallMs-engineWallMs),animationMs:0,workers:limits.workers};
    const result={version:'ai-training-core-result-v1',caseId,caseRoot:runRoot,completion,
      outcome:completion==='native'?outcome(port.state().outcome):null,commands:decisions.length,seed,level:level.id??null,
      levelDigest:expectationRef?JSON.parse(await readFile(resolve(runRoot,'expectation.json'))).level.digest:null,
      seats:plain(seats),recordedSeats:plain(recordedSeats),timing,error,sampled:completion==='native'?sampled:[],
      samplingUnsupported:Object.entries(seats).filter(([,id])=>id==='trained').map(([side])=>({side,reason:'native-trained-policy-scope'})),
      intervention:intervention?{...plain(intervention),caseId}:null,model:model?{side:model.side,sha256:model.sha256}:null,
      experiment:experiment??null,
      binding,manifestSha256:manifestRef.sha256,artifactRefs};
    if(completion==='native'){
      // The first serialization retains native command member order.
      const archiveBytes=Buffer.from(JSON.stringify(plain(port.trainingArchive()))+'\n');
      await save('archive.json',archiveBytes);
      result.receipt=await save('receipt.json',sealFullTrainingCapture(handle,{archiveBytes,traceBytes}));
      const verifyStarted=performance.now();
      const imported=await importFullTrainingArchive(JSON.parse(archiveBytes),{createGame:createRecordingGame,experimentCatalog:catalog,
        capture:{handle,receiptBytes:await readFile(resolve(runRoot,'receipt.json')),expectedReceiptSha256:result.receipt.sha256,archiveBytes,traceBytes}});
      assert.equal(imported.provenance.status,'verified-local-capture');assert.deepEqual(imported.demonstrations,[]);
      result.provenance=imported.provenance;
      timing.verificationWallMs=performance.now()-verifyStarted;
    }
    timing.wallMs=performance.now()-caseStarted;timing.cpuUs=process.cpuUsage(caseCpu);
    timing.recordingAndSetupWallMs=Math.max(0,timing.wallMs-strategyWallMs-engineWallMs-(timing.verificationWallMs??0));
    await save('diagnostics.json',jsonBytes({completion,error,diagnostics,timing}));
    // final ref is returned to the trusted job journal, not self-embedded.
    result.artifactRefs={...artifactRefs};
    const final=await writeOnce(runRoot,'core-result.json',jsonBytes(result));
    return {...result,artifactRefs:{...result.artifactRefs,final}};
  }finally{
    signal?.removeEventListener('abort',abort);host?.leave();await installed?.dispose();game.dispose();
  }
}

export async function verifyCase({engineRoot,caseRoot,result,manifest}){
  const current=await getBinding({engineRoot});
  assert.ok(result?.artifactRefs?.final,'AI_CORE_TRUSTED_RESULT_REFERENCE_REQUIRED');
  const final=JSON.parse(await readArtifact(caseRoot,result.artifactRefs.final.path,result.artifactRefs.final.sha256));
  const expected={...result,artifactRefs:{...result.artifactRefs}};delete expected.artifactRefs.final;
  delete expected.verified;
  assert.deepEqual(final,expected,'AI_CORE_RESULT_DRIFT');assert.deepEqual(final.binding,current,'AI_CORE_RUN_BINDING');
  for(const ref of Object.values(final.artifactRefs))await readArtifact(caseRoot,ref.path,ref.sha256);
  const originalManifest=await readArtifact(caseRoot,'manifest.json',final.manifestSha256);
  if(manifest)assert.deepEqual(JSON.parse(originalManifest),manifest,'AI_CORE_MANIFEST_DRIFT');
  matchBinding(JSON.parse(originalManifest),current);
  if(final.completion!=='native'){assert.equal(final.outcome,null);return {...result,verified:true};}
  const expectationRef=final.artifactRefs['expectation.json'];
  const expectationBytes=await readArtifact(caseRoot,expectationRef.path,expectationRef.sha256);
  const catalog=final.experiment?await prepareFullExperimentCatalog({artifactRoot:caseRoot,entries:final.experiment.entries,
    runtimeCommit:current.runtimeCommit,engineArchivePath:resolve(caseRoot,current.engineArchivePath)}):undefined;
  // Copies of recorder code are checked against the currently executing code,
  // not just against an archive-provided digest.
  const snapshot=await bindingSnapshot({engineRoot});
  for(const file of snapshot.files)await readArtifact(caseRoot,'code/'+file.path,file.sha256,{text:true});
  const handle=await prepareFullTrainingCapture({expectationBytes,expectedExpectationSha256:expectationRef.sha256,
    artifactRoot:caseRoot,engineArchivePath:resolve(caseRoot,current.engineArchivePath),runtimeCommit:current.runtimeCommit,experimentCatalog:catalog});
  const archiveRef=final.artifactRefs['archive.json'],traceRef=final.artifactRefs['trace.json'],receiptRef=final.receipt;
  const archiveBytes=await readArtifact(caseRoot,archiveRef.path,archiveRef.sha256),traceBytes=await readArtifact(caseRoot,traceRef.path,traceRef.sha256),
    receiptBytes=await readArtifact(caseRoot,receiptRef.path,receiptRef.sha256);
  const imported=await importFullTrainingArchive(JSON.parse(archiveBytes),{createGame:createRecordingGame,experimentCatalog:catalog,
    capture:{handle,receiptBytes,expectedReceiptSha256:receiptRef.sha256,archiveBytes,traceBytes}});
  assert.equal(imported.provenance.status,'verified-local-capture');assert.equal(imported.acceptedCommands,final.commands);
  assert.equal(outcome(imported.outcome==='draw'?'draw':imported.outcome==='player'),final.outcome);
  return {...result,verified:true,provenance:imported.provenance};
}
