import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openFullTrainingReplay} from '../../scripts/full-training-import.mjs';
import {gameplaySourceHashes} from './replay-source-binding.mjs';
import {bytes,canonicalBytes,currentSourcesHash,engineRoot,hash,textHash} from '../../scripts/full-training-artifacts.mjs';
import {encodeFullFireEffects} from '../../src/core/full-attack-2a.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from '../../src/core/full-catalog-ai-adapter.mjs';
import {FULL_EXPERIMENT_FEATURE_SCHEMA,FULL_EXPERIMENT_OUTCOME_SCHEMA} from '../../scripts/full-experiment-policies.mjs';
import {fullTrainingDecisionTraceRow} from '../../scripts/full-training-capture.mjs';
import {fullShell} from '../catalog-full-harness.mjs';

export const commit='1'.repeat(40);
export async function environment(){
 const base=fileURLToPath(new URL('../../../provenance-fixtures/',import.meta.url));await mkdir(base,{recursive:true});
 const root=await mkdtemp(resolve(base,'case-'));
 await writeFile(resolve(root,'engine.tar'),'synthetic engine-archive fixture; not a release archive');
 await writeFile(resolve(root,'run.json'),'{}\n');
 await writeFile(resolve(root,'recorder.mjs'),'// synthetic capture contract fixture\n');
 return {root,runtimeCommit:commit,engineArchivePath:resolve(root,'engine.tar')};
}
export async function level(){
 const draft={id:'capture-fixture',version:'goblin-level-v3',scenarioVersion:1,width:6,height:5,
  objective:'core-and-escort',ruleProfile:'FULL_CATALOG_v1',terrain:[],
  units:[{id:'lead',assetId:'assault-tank',team:'player',x:1,y:1},
   {id:'own-skimmer',assetId:'combat-skimmer',team:'player',x:2,y:2},
   {id:'guard',assetId:'guard-tank',team:'enemy',x:1,y:2},
   {id:'core',assetId:'command-core',team:'enemy',x:2,y:1}],goals:[{type:'enemy-turn-limit',turns:1}]};
 const game=fullShell();await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
 game.run(await readFile(new URL('../../editor-draft.js',import.meta.url),'utf8'));
 const config=await game.context.GoblinEditorDraft.prepare(draft);
 return {id:'editor-draft',digest:config.catalog.levelDigest,draft};
}
export const aiSeats=()=>Object.fromEntries(['player','enemy'].map(side=>[side,{controller:'ai',policy:side+'-medium',difficulty:'medium'}]));
export const humanSeats=()=>({player:{controller:'human'},enemy:{controller:'human'}});
export async function play(level,seats,options={}){
 const host=await openFullTrainingReplay({seats,replay:{version:'full-native-journal-v1',sources:gameplaySourceHashes(),
  seed:7,level,initial:'',entries:[]}},options), decisions=[];
 while(!host.port.state().ended){
  const frame=host.inspect({record:true}), command=options.commands?.get(decisions.length)??{type:'EndPhase'};
  decisions.push(fullTrainingDecisionTraceRow(frame,decisions.length,command,seats[frame.state.side]));
  if(!host.commit(frame,command).ok)throw Error('fixture commit rejected');
 }
 const archive=JSON.parse(JSON.stringify(host.port.trainingArchive()));
 return {archive,archiveBytes:bytes(archive),traceBytes:bytes({version:'goblin-full-decision-trace-v1',caseId:'case',decisions}),host};
}
export async function expectation(env,level,seats){
 const value={version:'goblin-full-capture-expectation-v1',caseId:'case',runtimeCommit:env.runtimeCommit,
  engineArchiveSha256:hash(await readFile(env.engineArchivePath)),nativeSourcesSha256:currentSourcesHash(),
  runManifestRef:'run.json',runManifestSha256:textHash(await readFile(resolve(env.root,'run.json'))),
  recorderArtifacts:[{path:'recorder.mjs',sha256:textHash(await readFile(resolve(env.root,'recorder.mjs')))}],
  seed:7,level:{id:level.id,digest:level.digest},seats};
 const expectationBytes=bytes(value);
 return {...env,artifactRoot:env.root,expectationBytes,expectedExpectationSha256:textHash(expectationBytes)};
}
export async function fireIntervention(map,side){
 const seats=humanSeats();seats[side]={controller:'ai',policy:side+'-medium',difficulty:'medium'};
 const host=await openFullTrainingReplay({seats,replay:{version:'full-native-journal-v1',sources:gameplaySourceHashes(),
  seed:7,level:map,initial:'',entries:[]}});
 let commandIndex=0;
 while(host.port.state().side!==side||host.port.state().slot!=='fire'){
  if(!host.commit(host.inspect(),{type:'EndPhase'}).ok)throw Error('reference setup');commandIndex++;
 }
 const full=host.game.context.GoblinCatalogFullRuntime;
 const player=createFullCatalogAiHost(full,host.game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
  ()=>host.port.state().side,host.game.context.GoblinSpecialistsRuntime);
 const adapter=createOwnedFullCatalogAiAdapter(host.port,player), batch=adapter.open(side), packet=adapter.captureStrongDecision(batch);
 const candidates=batch.candidates.map(({key,...candidate})=>JSON.parse(JSON.stringify(candidate)));
 const rows=candidates.map((candidate,index)=>({candidate,index,features:encodeFullFireEffects(batch,candidate)}))
  .filter(row=>['fire','hex-fire'].includes(row.candidate.kind)&&row.features!==null);
 let reference,alternative;
 for(const a of rows)for(const b of rows)if(!reference&&a.candidate.actorId===b.candidate.actorId&&
  a.candidate.weaponRef===b.candidate.weaponRef&&JSON.stringify(a.features)!==JSON.stringify(b.features)){
  reference=a;alternative=b;
 }
 if(!reference)throw Error('reference needs two feature-distinct legal fire targets');
 const spec={version:'goblin-full-fire-intervention-v1',caseId:'case',seed:7,side,turn:batch.view.turn,
  phase:'fire',slot:'fire',commandIndex,actorId:reference.candidate.actorId,weaponRef:reference.candidate.weaponRef,
  referenceCommandSha256:hash(canonicalBytes(packet.actions[reference.index].action)),
  offerSha256:hash(canonicalBytes(candidates)),referenceSha256:hash(canonicalBytes(reference.candidate)),
  alternativeSha256:hash(canonicalBytes(alternative.candidate)),prefixSha256:hash(canonicalBytes(packet.snapshot.replay)),
  referenceFeatures:reference.features,alternativeFeatures:alternative.features,
  referenceCandidate:reference.candidate,alternativeCandidate:alternative.candidate};
 return {spec,command:packet.actions[alternative.index].action};
}

export async function policyPackage(env,side,mode,{selectorSource,transform,intervention}={}){
 const files={
  'experimental-fire-selector.mjs':Buffer.from(selectorSource??
   "export function createExperimentalFireSelector(){return {select(batch,base){globalThis.__fullFixtureSelectorCalls=(globalThis.__fullFixtureSelectorCalls??0)+1;return {key:base()};},finish(){return {synthetic:true};}};}\n"),
  'fire-network.mjs':Buffer.from('// synthetic package plumbing only\n'),
  'sealed-artifacts.mjs':Buffer.from('// synthetic package plumbing only\n'),
  'feature.json':bytes(FULL_EXPERIMENT_FEATURE_SCHEMA),'outcome.json':bytes(FULL_EXPERIMENT_OUTCOME_SCHEMA),
  'selection.json':bytes({version:'goblin-full-fire-selection-v1',mode,side,basePolicyId:side+'-medium',
   targetScope:'same-actor-and-weapon',tieBreak:'native-base-then-offer-order',maxInterventions:mode==='frozen-fire-model'?0:1})};
 const entry={version:'goblin-full-experiment-policy-v1',mode,profile:'FULL_CATALOG_v1',side,basePolicyId:side+'-medium',
  runtimeCommit:env.runtimeCommit,engineArchiveSha256:hash(await readFile(env.engineArchivePath)),
  nativeSourcesSha256:currentSourcesHash(),runManifestSha256:textHash(await readFile(resolve(env.root,'run.json'))),
  selectorArtifacts:await Promise.all(['full-standard-seat-owner.mjs','src/core/full-catalog-difficulty.mjs',
   'src/core/full-exploration-policy.mjs','src/core/full-attack-2a.mjs','src/core/hex.mjs'].map(async path=>
    ({path:'engine/'+path,sha256:textHash(await readFile(resolve(engineRoot,path)))}))),
  featureSchemaRef:'feature.json',featureSchemaSha256:textHash(files['feature.json']),
  outcomeSchemaRef:'outcome.json',outcomeSchemaSha256:textHash(files['outcome.json']),
  selectionConfigRef:'selection.json',selectionConfigSha256:textHash(files['selection.json'])};
 for(const path of ['experimental-fire-selector.mjs','fire-network.mjs','sealed-artifacts.mjs'])
  entry.selectorArtifacts.push({path,sha256:textHash(files[path])});
 if(mode==='frozen-fire-model'){
  const model={version:'goblin-full-symmetric-fire-bpn-v1',side,featureVersion:FULL_EXPERIMENT_FEATURE_SCHEMA.version,
   rewardVersion:FULL_EXPERIMENT_OUTCOME_SCHEMA.version,runtimeCommit:env.runtimeCommit,
   engineArchiveSha256:entry.engineArchiveSha256,nativeSourcesSha256:entry.nativeSourcesSha256,
   runManifestSha256:entry.runManifestSha256,trainingDataSha256:'2'.repeat(64),
   hidden:Array.from({length:8},()=>({weights:Array(19).fill(0),bias:0})),output:{weights:Array(8).fill(0),bias:0}};
  files['model.json']=bytes(model);Object.assign(entry,{modelRef:'model.json',modelRawSha256:hash(files['model.json']),trainingDataSha256:model.trainingDataSha256});
 }else{
  files['intervention.json']=bytes(intervention??{});
  Object.assign(entry,{interventionSpecRef:'intervention.json',interventionSpecSha256:textHash(files['intervention.json'])});
 }
 transform?.(entry,files);
 const entryBytes=bytes(entry), sha256=textHash(entryBytes), packageRoot=resolve(env.root,sha256);
 await mkdir(packageRoot);for(const [path,data] of Object.entries(files))await writeFile(resolve(packageRoot,path),data);
 await writeFile(resolve(packageRoot,'policy.json'),entryBytes);
 return {id:'full-experiment:'+sha256,entry,packageRoot,entries:[{path:sha256+'/policy.json',sha256}],
  artifactRoot:env.root,runtimeCommit:env.runtimeCommit,engineArchivePath:env.engineArchivePath};
}
