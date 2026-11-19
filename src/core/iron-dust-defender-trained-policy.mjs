import {createAiPolicyRegistry} from './ai-policy-registry.mjs';
import {IRON_DUST_DEFENDER_FIRE_FEATURE_VERSION as feature,
  IRON_DUST_DEFENDER_FIRE_FEATURES as fields} from './iron-dust-ai-adapter.mjs';

export const IRON_DUST_DEFENDER_MODEL_ID='iron-dust-defender-bpn-v1';
export const IRON_DUST_DEFENDER_MODEL_SHA256='92b476f0c2d46283b3d9ed8db4f8760f21ef93edf64ba60a4c68b78d8e2337dd';
export const IRON_DUST_DEFENDER_MODEL_ENGINE='74bc4a69fce86cf0b8bf0b3b937abf0a78c6ec41';
const profile='CORE_IRON_DUST_v2';
const scopes=['first','retry'].map(slot=>Object.freeze({
  engine:IRON_DUST_DEFENDER_MODEL_ENGINE,profile,side:'enemy',slot,feature
}));
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const vector=(values,length)=>Array.isArray(values)&&values.length===length&&values.every(Number.isFinite);

function compile(bytes) {
  const model=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(model.version!==IRON_DUST_DEFENDER_MODEL_ID||model.engineCommit!==IRON_DUST_DEFENDER_MODEL_ENGINE||
      model.profile!==profile||model.side!=='enemy'||model.team!=='enemy'||
      model.featureVersion!==feature||!same(model.features,fields)||
      !same(model.slots,['first','retry'])||!same(model.actions,['EnemyUnitAttack','EnemySystemAttack'])||
      !same(model.architecture,[20,8,1])||model.activation!=='tanh'||model.outputActivation!=='linear'||
      model.featureScaling!=='raw-native-features'||!Array.isArray(model.hidden)||model.hidden.length!==8||
      !model.hidden.every(node=>vector(node.weights,20)&&Number.isFinite(node.bias))||
      !vector(model.output?.weights,8)||!Number.isFinite(model.output.bias))
    throw Error('IRON_DUST_DEFENDER_MODEL_INVALID');
  const score=features=>model.hidden.reduce((sum,node,index)=>sum+model.output.weights[index]*
    Math.tanh(node.weights.reduce((value,weight,column)=>value+weight*features[column],node.bias)),model.output.bias);
  return (batch,report)=>{
    const baseline=batch.candidates.find(candidate=>candidate.key===batch.baselineKey);
    if(!batch.ok||batch.view?.side!=='enemy'||!baseline||
        !batch.candidates.every(candidate=>candidate.kind==='fire'&&candidate.actorId===baseline.actorId&&
          candidate.weaponRef===null&&['unit','component'].includes(candidate.target?.kind)&&
          candidate.facts.featureVersion===feature&&vector(candidate.facts.features,20)))
      throw Error('IRON_DUST_DEFENDER_SCOPE_INVALID');
    let selected=baseline,value=score(baseline.facts.features);
    const options=[];
    for(const candidate of batch.candidates) {
      const prediction=score(candidate.facts.features);
      options.push({key:candidate.key,baseline:candidate===baseline,scores:{model:prediction}});
      if(prediction>value) {selected=candidate;value=prediction;}
    }
    report?.({key:selected.key,explanationKey:selected===baseline?'v2.round.modelBaseline':'v2.round.modelTarget',options});
    return selected.key;
  };
}

export async function prepareIronDustDefenderTrainedPolicy(bytes,crypto) {
  const registry=createAiPolicyRegistry([{id:IRON_DUST_DEFENDER_MODEL_ID,label:'Trainiert',
    sha256:IRON_DUST_DEFENDER_MODEL_SHA256,schemaVersion:1,
    evaluation:'Native missions and independent seeds; strength comparison negative',scopes}],crypto);
  await registry.install(IRON_DUST_DEFENDER_MODEL_ID,bytes,compile);
  const policy=registry.bind(IRON_DUST_DEFENDER_MODEL_ID,scopes);
  return Object.freeze({select(batch,baselineKey,report) {
    return policy.select({engine:IRON_DUST_DEFENDER_MODEL_ENGINE,profile,feature},
      {...batch,baselineKey},report);
  }});
}
