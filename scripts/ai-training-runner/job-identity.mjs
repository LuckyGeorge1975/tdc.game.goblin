import {resolve,dirname,relative,sep} from 'node:path';
import {canonical,hash,read,events} from './files.mjs';
const equal=(a,b,field)=>{if(canonical(a)!==canonical(b))throw Error('JOB_IDENTITY_'+field);};
export function assertPlannedRequest(request,trustedManifest=request.manifest,jobId=request.caseId){
 equal(request.manifest,trustedManifest,'TRUSTED_MANIFEST');equal(request.caseId,jobId,'JOB_SLOT');
 const {manifest,caseId}=request;let matched;
 for(const family of manifest.plan.data)for(const kind of ['reference','alternative-player','alternative-enemy'])
  if(caseId===family.id+'-'+kind)matched={family,kind,test:false};
 for(const family of manifest.plan.evaluation)for(const kind of ['reference',...family.sides.map(side=>'candidate-'+side)])
  if(caseId===family.id+'-'+kind)matched={family,kind,test:true};
 if(!matched)throw Error('JOB_IDENTITY_UNPLANNED_CASE');
 const {family,kind,test}=matched,level=manifest.pool.levels.find(item=>item.id===family.levelId);
 if(!level)throw Error('JOB_IDENTITY_LEVEL_MISSING');
 equal(request.seed,family.seed,'SEED');equal(request.seats,family.seats,'SEATS');equal(request.level,level.level,'LEVEL');
 equal(request.limits,{commandLimit:manifest.config.commandLimit,roundLimit:manifest.config.roundLimit,wallMs:null,workers:1},'LIMITS');
 if(kind==='reference'){equal(request.intervention,null,'REFERENCE_INTERVENTION');equal(request.model,null,'REFERENCE_MODEL');}
 else if(test){
  equal(request.intervention,null,'MODEL_INTERVENTION');equal(request.model?.side,kind.slice('candidate-'.length),'MODEL_SIDE');
  if(!/^[a-f0-9]{64}$/.test(request.model?.sha256??''))throw Error('JOB_IDENTITY_MODEL_HASH');
 }else{
  equal(request.model,null,'INTERVENTION_MODEL');equal(request.intervention?.side,kind.slice('alternative-'.length),'INTERVENTION_SIDE');
  equal(request.intervention?.caseId,family.id+'-reference','REFERENCE_CASE');equal(request.intervention?.seed,family.seed,'INTERVENTION_SEED');
 }
 return matched;
}
export async function assertBoundJob(request,requestPath){
 const root=resolve(dirname(requestPath),'../..'),manifest=await read(resolve(root,'manifest.json')),rows=await events(root);
 const attempt=relative(root,dirname(requestPath)).split(sep).join('/');
 const start=rows.find(row=>row.type==='game-start'&&row.attempt===attempt);
 if(!start||rows.find(row=>row.type==='manifest-bound')?.manifestDigest!==hash(canonical(manifest)))throw Error('JOB_IDENTITY_UNBOUND_SLOT');
 const planned=assertPlannedRequest(request,manifest,start.jobId);
 equal(start.split,planned.family.split,'SPLIT');
 equal(hash(canonical(request)),start.requestSha256,'BOUND_REQUEST');
 if(planned.test){
  const frozen=rows.find(row=>row.type==='models-frozen'&&row.sequence<start.sequence);
  if(!frozen||start.modelFreezeSha256!==frozen.sha256||hash(canonical(frozen.freeze))!==frozen.sha256)throw Error('JOB_IDENTITY_FREEZE');
  equal(frozen.freeze.manifestDigest,hash(canonical(manifest)),'FREEZE_MANIFEST');
  if(request.model&&!frozen.freeze.models.some(item=>canonical(item.model)===canonical(request.model)))throw Error('JOB_IDENTITY_FROZEN_MODEL');
 }
}
export function assertResultIdentity(request,result){
 assertPlannedRequest(request);
 for(const field of ['caseId','seed','seats'])equal(result[field],request[field],field.toUpperCase());
 equal(result.level,request.level.id,'RESULT_LEVEL');
 equal(resolve(result.caseRoot),resolve(request.runRoot),'CASE_ROOT');
 equal(result.manifestSha256,hash(canonical(request.manifest)),'MANIFEST');
 equal(result.binding,request.manifest.binding,'CODE_BINDING');
 const intervention=request.intervention?{...request.intervention,caseId:request.caseId}:null;
 equal(result.intervention,intervention,'RESULT_INTERVENTION');
 equal(result.model,request.model?{side:request.model.side,sha256:request.model.sha256}:null,'RESULT_MODEL');
 if(['native','technical-limit'].includes(result.completion)){
  const level=request.manifest.pool.levels.find(item=>item.id===request.level.id);
  equal(result.levelDigest,level.validation.levelDigest,'LEVEL_DIGEST');
 }
}
