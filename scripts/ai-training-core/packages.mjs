import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {jsonBytes,sha256,writeOnce} from './sealed-artifacts.mjs';
import {engineRoot,normalize} from './sources.mjs';
import {policyId} from './binding.mjs';
import {FULL_EXPERIMENT_FEATURE_SCHEMA,FULL_EXPERIMENT_OUTCOME_SCHEMA,prepareFullExperimentCatalog} from '../full-experiment-policies.mjs';
export async function createPolicyPackage({root,binding,manifestSha256,side,base,intervention,model}){
  const mode=intervention?'single-fire-intervention':'frozen-fire-model';
  const files={'feature.json':jsonBytes(FULL_EXPERIMENT_FEATURE_SCHEMA),'outcome.json':jsonBytes(FULL_EXPERIMENT_OUTCOME_SCHEMA),
    'selection.json':jsonBytes({version:'goblin-full-fire-selection-v1',mode,side,basePolicyId:policyId(side,base),
      targetScope:'same-actor-and-weapon',tieBreak:'native-base-then-offer-order',maxInterventions:intervention?1:0})};
  const selectorArtifacts=[];
  for(const item of binding.recorderArtifacts){
    const path=item.path.slice(5);
    selectorArtifacts.push({path:'engine/'+path,sha256:item.sha256});
  }
  for(const name of ['experimental-fire-selector.mjs','fire-network.mjs','sealed-artifacts.mjs']){
    files[name]=Buffer.from(normalize(await readFile(resolve(engineRoot,'scripts/ai-training-core',name),'utf8')));
    selectorArtifacts.push({path:name,sha256:sha256(files[name])});
  }
  const entry={version:'goblin-full-experiment-policy-v1',mode,profile:'FULL_CATALOG_v1',side,basePolicyId:policyId(side,base),
    runtimeCommit:binding.runtimeCommit,engineArchiveSha256:binding.engineArchiveSha256,nativeSourcesSha256:binding.nativeSourcesSha256,
    runManifestSha256:manifestSha256,selectorArtifacts,
    featureSchemaRef:'feature.json',featureSchemaSha256:sha256(files['feature.json']),
    outcomeSchemaRef:'outcome.json',outcomeSchemaSha256:sha256(files['outcome.json']),
    selectionConfigRef:'selection.json',selectionConfigSha256:sha256(files['selection.json'])};
  if(intervention){files['intervention.json']=jsonBytes(intervention);Object.assign(entry,
    {interventionSpecRef:'intervention.json',interventionSpecSha256:sha256(files['intervention.json'])});}
  else if(model){files['model.json']=await readFile(model.path);Object.assign(entry,
    {modelRef:'model.json',modelRawSha256:sha256(files['model.json']),trainingDataSha256:model.trainingDataSha256});
    if(entry.modelRawSha256!==model.sha256)throw Error('AI_CORE_FROZEN_MODEL_HASH');}
  const bytes=jsonBytes(entry),id=sha256(bytes),directory='packages/'+id;
  await mkdir(resolve(root,directory),{recursive:true});
  for(const [path,data]of Object.entries(files))await writeOnce(root,directory+'/'+path,data);
  await writeOnce(root,directory+'/policy.json',bytes);
  const entries=[{path:directory+'/policy.json',sha256:id}];
  const catalog=await prepareFullExperimentCatalog({artifactRoot:root,entries,
    runtimeCommit:binding.runtimeCommit,engineArchivePath:resolve(root,binding.engineArchivePath)});
  return {id:'full-experiment:'+id,side,mode,entries,catalog};
}
