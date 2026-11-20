// Local opt-in package verification. Replay resolution never imports selector code.
import {readFile,realpath} from 'node:fs/promises';
import {dirname,basename,resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {encodeFullFireEffects} from '../src/core/full-attack-2a.mjs';
import {describeFullCatalogOptions} from '../src/core/full-catalog-ai-adapter.mjs';
import {artifact,artifactList,canonicalBytes,check,currentSourcesHash,engineRoot,exact,freeze,hash,isCommit,isHash,json,text,textHash} from './full-training-artifacts.mjs';

const catalogs=new WeakMap(), bridges=new WeakMap();
const nativePaths=['full-standard-seat-owner.mjs','src/core/full-catalog-difficulty.mjs',
 'src/core/full-exploration-policy.mjs','src/core/full-attack-2a.mjs','src/core/hex.mjs'];
const shared=['version','mode','profile','side','basePolicyId','runtimeCommit','engineArchiveSha256',
 'nativeSourcesSha256','runManifestSha256','selectorArtifacts','featureSchemaRef','featureSchemaSha256',
 'outcomeSchemaRef','outcomeSchemaSha256','selectionConfigRef','selectionConfigSha256'];
export const FULL_EXPERIMENT_MODEL_VERSION='goblin-full-symmetric-fire-bpn-v1';
export const FULL_EXPERIMENT_FEATURE_VERSION='goblin-full-fire-effects-v1';
export const FULL_EXPERIMENT_REWARD_VERSION='goblin-native-mission-points-pair-v1';
export const FULL_EXPERIMENT_FEATURE_SCHEMA=freeze({version:FULL_EXPERIMENT_FEATURE_VERSION,inputs:19,
 fields:['unit-crt','component-crt','tread-roll-5-6','area','1-2','1-1','2-1','3-1','4-1','5-1',
  'attack/8','range/8','objectiveTarget','disabledTarget','indirect','ownCenter','ownNear/6','enemyCenter','enemyNear/6']});
export const FULL_EXPERIMENT_OUTCOME_SCHEMA=freeze({version:FULL_EXPERIMENT_REWARD_VERSION,win:1,draw:0.5,loss:0,
 pair:'alternative-reference',technicalLimit:null,error:null,lossFunction:'squared-pair'});

function modelCheck(model,entry){
 check(exact(model,['version','side','featureVersion','rewardVersion','runtimeCommit','engineArchiveSha256',
  'nativeSourcesSha256','runManifestSha256','trainingDataSha256','hidden','output']));
 check(model.version===FULL_EXPERIMENT_MODEL_VERSION&&model.side===entry.side&&
  model.featureVersion===FULL_EXPERIMENT_FEATURE_VERSION&&model.rewardVersion===FULL_EXPERIMENT_REWARD_VERSION);
 for(const field of ['runtimeCommit','engineArchiveSha256','nativeSourcesSha256','runManifestSha256','trainingDataSha256'])
  check(model[field]===entry[field]);
 const vector=(value,n)=>Array.isArray(value)&&value.length===n&&Array.from({length:n},(_,i)=>value[i]).every(Number.isFinite);
 check(Array.isArray(model.hidden)&&model.hidden.length===8&&model.hidden.every(node=>
  exact(node,['weights','bias'])&&vector(node.weights,19)&&Number.isFinite(node.bias))&&
  exact(model.output,['weights','bias'])&&vector(model.output.weights,8)&&Number.isFinite(model.output.bias));
}

export async function prepareFullExperimentCatalog({artifactRoot,entries,runtimeCommit,engineArchivePath}){
 check(isCommit(runtimeCommit));artifactList(entries);
 artifactRoot=await realpath(artifactRoot);engineArchivePath=await realpath(engineArchivePath);
 const engineArchiveSha256=hash(await readFile(engineArchivePath));
 const policies=new Map();
 for(const reference of entries){
  const original=await artifact(artifactRoot,reference.path,reference.sha256);
  const entry=json(original.data), id='full-experiment:'+reference.sha256;
  const usesModel=entry.mode==='frozen-fire-model';
  check(exact(entry,[...shared,...(usesModel?['modelRef','modelRawSha256','trainingDataSha256']:
   ['interventionSpecRef','interventionSpecSha256'])]));
  check(entry.version==='goblin-full-experiment-policy-v1'&&entry.profile==='FULL_CATALOG_v1'&&
   ['player','enemy'].includes(entry.side)&&['single-fire-intervention','frozen-fire-model'].includes(entry.mode)&&
   entry.basePolicyId===entry.side+'-medium'&&entry.runtimeCommit===runtimeCommit&&
   entry.engineArchiveSha256===engineArchiveSha256&&entry.nativeSourcesSha256===currentSourcesHash()&&isHash(entry.runManifestSha256));
  const packageRoot=dirname(original.absolute);
  // Each identity has its own immutable module paths, including transitive imports.
  check(basename(packageRoot)===reference.sha256,'FULL_EXPERIMENT_PACKAGE_ID_PATH');
  artifactList(entry.selectorArtifacts);
  const code=new Map();
  for(const item of entry.selectorArtifacts){
   const native=item.path.startsWith('engine/');
   const loaded=await artifact(native?engineRoot:packageRoot,native?item.path.slice(7):item.path,item.sha256);
   code.set(item.path,{...loaded,sha256:item.sha256,native});
  }
  for(const path of nativePaths)check(code.has('engine/'+path),'FULL_EXPERIMENT_NATIVE_DEPENDENCY');
  for(const path of ['experimental-fire-selector.mjs','fire-network.mjs','sealed-artifacts.mjs'])check(code.has(path));
  // All non-native module imports must stay in this identity and be inventoried.
  for(const [path,item] of code){
   if(item.native)continue;
   const source=text(item.data);
   check(!/\bimport\s*\(/.test(source),'FULL_EXPERIMENT_DYNAMIC_IMPORT');
   const imports=[...source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]);
   for(const specifier of imports){
    if(specifier.startsWith('node:'))continue;
    check(specifier.startsWith('./')||specifier.startsWith('../'));
    const dependency=relative(packageRoot,resolve(dirname(item.absolute),specifier)).replaceAll('\\','/');
    check(code.has(dependency)&&!code.get(dependency).native,'FULL_EXPERIMENT_UNBOUND_DEPENDENCY');
   }
  }
  const load=async(name,raw=false)=>json((await artifact(packageRoot,entry[name+'Ref'],entry[name+(raw?'RawSha256':'Sha256')],{raw})).data);
  const featureSchema=await load('featureSchema'), outcomeSchema=await load('outcomeSchema');
  const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(canonical):
   Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))):value;
  check(JSON.stringify(canonical(featureSchema))===JSON.stringify(canonical(FULL_EXPERIMENT_FEATURE_SCHEMA)));
  check(JSON.stringify(canonical(outcomeSchema))===JSON.stringify(canonical(FULL_EXPERIMENT_OUTCOME_SCHEMA)));
  const selectionConfig=await load('selectionConfig');
  check(exact(selectionConfig,['version','basePolicyId','mode','side','targetScope','tieBreak','maxInterventions'])&&
   selectionConfig.version==='goblin-full-fire-selection-v1'&&selectionConfig.basePolicyId===entry.basePolicyId&&
   selectionConfig.mode===entry.mode&&selectionConfig.side===entry.side&&selectionConfig.targetScope==='same-actor-and-weapon'&&
   selectionConfig.tieBreak==='native-base-then-offer-order'&&selectionConfig.maxInterventions===(usesModel?0:1));
  const model=usesModel?await load('model',true):undefined;
  const intervention=usesModel?undefined:await load('interventionSpec');
  if(usesModel){check(isHash(entry.trainingDataSha256));modelCheck(model,entry);}
  else {
   check(exact(intervention,['version','caseId','seed','side','turn','phase','slot','commandIndex','actorId','weaponRef',
    'referenceCommandSha256','offerSha256','referenceSha256','alternativeSha256','prefixSha256',
    'referenceFeatures','alternativeFeatures','referenceCandidate','alternativeCandidate']));
   check(intervention.version==='goblin-full-fire-intervention-v1'&&typeof intervention.caseId==='string'&&intervention.caseId.length>0&&
    Number.isInteger(intervention.seed)&&intervention.seed>=0&&intervention.seed<=0xffffffff&&
    Number.isSafeInteger(intervention.turn)&&intervention.turn>0&&intervention.side===entry.side&&
    intervention.phase==='fire'&&intervention.slot==='fire'&&Number.isSafeInteger(intervention.commandIndex)&&intervention.commandIndex>=0);
   for(const name of ['referenceCommandSha256','offerSha256','referenceSha256','alternativeSha256','prefixSha256'])check(isHash(intervention[name]));
   for(const name of ['referenceFeatures','alternativeFeatures'])check(Array.isArray(intervention[name])&&
    intervention[name].length===19&&intervention[name].every(Number.isFinite));
   for(const name of ['reference','alternative']){
    const candidate=intervention[name+'Candidate'];
    check(exact(candidate,['kind','actorId','target','weaponRef','facts'])&&['fire','hex-fire'].includes(candidate.kind)&&
     candidate.actorId===intervention.actorId&&candidate.weaponRef===intervention.weaponRef&&
     hash(canonicalBytes(candidate))===intervention[name+'Sha256']);
   }
   check(intervention.referenceSha256!==intervention.alternativeSha256&&
    hash(canonicalBytes(intervention.referenceFeatures))!==hash(canonicalBytes(intervention.alternativeFeatures)));
  }
  check(!policies.has(id));
  policies.set(id,{id,entry:freeze(entry),difficulty:usesModel?null:'medium',packageRoot,code,
   model:freeze(model),intervention:freeze(intervention),selectionConfig:freeze(selectionConfig),reference:freeze({...reference}),artifactRoot});
 }
 const handle=Object.freeze({});catalogs.set(handle,{policies,runtimeCommit,engineArchiveSha256,engineArchivePath});return handle;
}

export function resolveFullExperimentPolicy(catalog,id,side,difficulty){
 const policy=catalogs.get(catalog)?.policies.get(id);
 check(policy&&policy.entry.side===side&&policy.difficulty===difficulty,'FULL_EXPERIMENT_NOT_TRUSTED');
 return policy.entry;
}

export async function revalidateFullExperimentCatalog(catalog){
 const state=catalogs.get(catalog);check(state,'FULL_EXPERIMENT_NOT_TRUSTED');
 for(const policy of state.policies.values())await prepareFullExperimentCatalog({artifactRoot:policy.artifactRoot,
  entries:[policy.reference],runtimeCommit:state.runtimeCommit,engineArchivePath:state.engineArchivePath});
}

export function validateFullExperimentRecording(catalog,id,{seed,caseId,acceptedCommands}){
 const policy=catalogs.get(catalog)?.policies.get(id);check(policy,'FULL_EXPERIMENT_NOT_TRUSTED');
 const spec=policy.intervention;if(!spec)return;
 check(spec.seed===seed&&(caseId===undefined||spec.caseId===caseId),'FULL_EXPERIMENT_RECORDING_SCOPE');
 if(acceptedCommands!==undefined)check(acceptedCommands>spec.commandIndex,'FULL_EXPERIMENT_INTERVENTION_MISSED');
}

export function validateFullExperimentDecision(catalog,id,frame,port,commandIndex,command){
 const policy=catalogs.get(catalog)?.policies.get(id);check(policy,'FULL_EXPERIMENT_NOT_TRUSTED');
 const spec=policy.intervention;if(!spec||commandIndex!==spec.commandIndex)return;
 const replay=port.simulationSnapshot(port.ticket('ai'))?.replay;
 check(replay&&spec.turn===frame.view.turn&&spec.phase===frame.state.slot&&
  hash(canonicalBytes(replay))===spec.prefixSha256,'FULL_EXPERIMENT_PREFIX_DRIFT');
 const options=describeFullCatalogOptions(frame.candidates,frame.state.side), candidates=options.map(item=>item.candidate);
 check(hash(canonicalBytes(candidates))===spec.offerSha256,'FULL_EXPERIMENT_OFFER_DRIFT');
 const reference=candidates.findIndex(item=>hash(canonicalBytes(item))===spec.referenceSha256);
 const alternative=candidates.findIndex(item=>hash(canonicalBytes(item))===spec.alternativeSha256);
 check(reference>=0&&alternative>=0&&reference!==alternative&&
  hash(canonicalBytes(frame.candidates[reference].command))===spec.referenceCommandSha256&&
  hash(canonicalBytes(frame.candidates[alternative].command))===hash(canonicalBytes(command)),'FULL_EXPERIMENT_COMMAND_DRIFT');
 for(const [name,index] of [['reference',reference],['alternative',alternative]])check(
  hash(canonicalBytes(encodeFullFireEffects({view:frame.view},candidates[index])))===hash(canonicalBytes(spec[name+'Features'])),
  'FULL_EXPERIMENT_FEATURE_DRIFT');
}

function bridgeFor(root){
 if(bridges.has(root))return bridges.get(root);
 check(!Object.hasOwn(root,'GoblinFullExperimentCatalog'));
 const registered=new WeakMap();
 Object.defineProperty(root,'GoblinFullExperimentCatalog',{value:Object.freeze({qualifies({side,id,difficulty,select}){
  const known=registered.get(select);return !!known&&known.side===side&&known.id===id&&known.difficulty===difficulty;
 }}),writable:false,configurable:false});
 bridges.set(root,registered);return registered;
}

export function registerFullExperimentReplay({catalog,id,side,difficulty,full,root}){
 resolveFullExperimentPolicy(catalog,id,side,difficulty);
 // Import replays only native commands. No package module is loaded here.
 const select=()=>{throw Error('FULL_EXPERIMENT_REPLAY_SELECTOR_FORBIDDEN');};
 bridgeFor(root).set(select,{side,id,difficulty});
 full.registerQualifiedController({side,id,difficulty,select});
}

export async function registerFullExperimentController({catalog,id,full,root,onDecision}){
 const policy=catalogs.get(catalog)?.policies.get(id);check(policy,'FULL_EXPERIMENT_NOT_TRUSTED');
 // Recheck the complete package before executing the explicitly trusted local entry.
 await prepareFullExperimentCatalog({artifactRoot:policy.artifactRoot,entries:[policy.reference],
  runtimeCommit:catalogs.get(catalog).runtimeCommit,engineArchivePath:catalogs.get(catalog).engineArchivePath});
 const module=await import(pathToFileURL(policy.code.get('experimental-fire-selector.mjs').absolute).href+'?policy='+id.slice(16));
 const selector=module.createExperimentalFireSelector({mode:policy.entry.mode,side:policy.entry.side,
  encode:encodeFullFireEffects,model:policy.model,intervention:policy.intervention,selectionConfig:policy.selectionConfig});
 for(const item of policy.code.values())check(textHash(await readFile(item.absolute))===item.sha256);
 const select=(batch,chooseNativeBase,port,_report,capture)=>{
  const replay=port.simulationSnapshot(port.ticket('ai'))?.replay;check(replay);
  const context={commandIndex:replay.entries.length,prefixSha256:hash(canonicalBytes(replay))};
  const choose=()=>{
   const key=chooseNativeBase(), spec=policy.intervention;
   if(spec&&context.commandIndex===spec.commandIndex){
    check(replay.seed===spec.seed,'FULL_EXPERIMENT_RECORDING_SCOPE');
    const packet=capture?.(batch), index=batch.candidates.findIndex(item=>item.key===key);
    check(packet&&index>=0&&hash(canonicalBytes(packet.actions[index].action))===spec.referenceCommandSha256,'FULL_EXPERIMENT_REFERENCE_COMMAND');
   }
   return key;
  };
  const result=selector.select(batch,choose,context);
  onDecision?.({batch,context,result});return result.key;
 };
 bridgeFor(root).set(select,{side:policy.entry.side,id,difficulty:policy.difficulty});
 full.registerQualifiedController({side:policy.entry.side,id,difficulty:policy.difficulty,select});
 return Object.freeze({id,finish:completion=>selector.finish(completion)});
}
