import {createAiPolicyRegistry} from './ai-policy-registry.mjs';
import {IRON_DUST_TARGET_FEATURES, IRON_DUST_TARGET_FEATURE_VERSION} from './iron-dust-ai-adapter.mjs?v=5';

export const IRON_DUST_TRAINED_SCOPE = Object.freeze({
  engine:'9c6e349bec42f134240b81db84827404a9e2cb6e',
  profile:'CORE_IRON_DUST_v2',side:'player',slot:'fire-target',feature:IRON_DUST_TARGET_FEATURE_VERSION
});
const sha256 = 'a0ffb2beb9f3fe49a45c9e24ee4f184f1da083eb392a8b54a5a3e14499ef6627';
const id = IRON_DUST_TRAINED_SCOPE.feature;

function compile(bytes) {
  const model = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const weights = values => Array.isArray(values) && values.length === 8 && values.every(Number.isFinite);
  if (model.version !== id || model.profile !== IRON_DUST_TRAINED_SCOPE.profile ||
      JSON.stringify(model.features) !== JSON.stringify(IRON_DUST_TARGET_FEATURES) ||
      !Array.isArray(model.hidden) || model.hidden.length !== 8 ||
      !model.hidden.every(node => weights(node.weights) && Number.isFinite(node.bias)) ||
      !weights(model.output?.weights) || !Number.isFinite(model.output?.bias))
    throw Error('IRON_DUST_TRAINED_MODEL_INVALID');
  const score = input => model.hidden.reduce((sum,node,index) => sum + model.output.weights[index] * Math.tanh(
    node.weights.reduce((value,weight,column) => value + weight * input[column],node.bias)),model.output.bias);
  return ({candidates, baseline}) => {
    if (!candidates.every(candidate => candidate.kind==='fire' && candidate.target?.kind==='unit' &&
        candidate.actorId===baseline.unitId && candidate.weaponRef===(baseline.weaponKey??null) &&
        candidate.facts.featureVersion===id && weights(candidate.facts.features)))
      throw Error('IRON_DUST_TRAINED_SCOPE_INVALID');
    let selected = candidates.find(candidate => candidate.target.unitId===baseline.targetId);
    if (!selected) throw Error('IRON_DUST_TRAINED_BASELINE_MISSING');
    let value = score(selected.facts.features);
    for (const candidate of candidates) {
      const next = score(candidate.facts.features);
      if (next>value) { selected=candidate; value=next; }
    }
    return selected.key;
  };
}

export async function prepareIronDustTrainedPolicy(bytes, crypto) {
  const scope = IRON_DUST_TRAINED_SCOPE;
  const registry = createAiPolicyRegistry([{id,label:'Trainiert',schemaVersion:1,sha256,
    evaluation:'Iron Dust holdout, qualified engine basis',scopes:[scope]}],crypto);
  await registry.install(id,bytes,compile);
  return registry.bind(id,[scope]);
}
