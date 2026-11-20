import {encodeFullFireEffects,scoreFullFireEffects} from './full-attack-2a.mjs?v=3';

const sourceEngine='8e9adbd284d9dd7b5fb0c5c4a873325fd3242313';
export const defenderTrials=Object.freeze({
  'full-defender-control-trial':{arm:'control',sha:'f927687bd0a3916aea2cb3ccbade08fe1ee753d7ea7988b2298d984334a7b813'},
  'full-defender-auxiliary-trial':{arm:'auxiliary',sha:'b565b2a26804a7c27cdf50cbf2cbcd2e249ea14d01e1d00df9565e0c7e71c134'}
});
const fire=candidate=>['fire','hex-fire'].includes(candidate.kind);

export async function prepareDefenderTrial(id,bytes,crypto=globalThis.crypto) {
  if(!Object.hasOwn(defenderTrials,id))throw Error('FULL_DEFENDER_TRIAL_ID');
  const {arm,sha}=defenderTrials[id];
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
    .map(byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==sha)throw Error('FULL_DEFENDER_TRIAL_SHA');
  const fixture=JSON.parse(new TextDecoder().decode(bytes));
  const model=fixture.model;
  if(fixture.commit!==sourceEngine||fixture.arm!==arm||model.featureVersion!=='goblin-full-fire-effects-v1'||
     model.rewardVersion!=='goblin-mission-win-pair-v1'||!model.hidden.every(node=>
       node.weights.length===19&&node.weights.every(Number.isFinite)&&Number.isFinite(node.bias))||
     model.output.weights.length!==model.hidden.length||!model.output.weights.every(Number.isFinite)||
     !Number.isFinite(model.output.bias))throw Error('FULL_DEFENDER_TRIAL_CONTRACT');

  return function select(batch,report) {
    if(!batch?.ok||batch.side!=='enemy'||!['movement','fire','gev'].includes(batch.phase)||batch.slot!==batch.phase)
      throw Error('FULL_DEFENDER_TRIAL_SCOPE');
    const baseline=batch.candidates.find(candidate=>candidate.facts.baseline===true)??
      batch.candidates.find(candidate=>candidate.kind==='end-phase');
    if(!baseline)throw Error('FULL_DEFENDER_REFERENCE_UNAVAILABLE');
    const start=fire(baseline)?encodeFullFireEffects(batch,baseline):null;
    if(!start){
      if(fire(baseline))throw Error('FULL_DEFENDER_FEATURES_UNAVAILABLE');
      report?.({key:baseline.key,explanationKey:'v2.round.standardAction'});
      return baseline.key;
    }
    let selected=baseline, highest=scoreFullFireEffects(model,start);
    const options=[];
    for(const candidate of batch.candidates){
      if(!fire(candidate)||candidate.actorId!==baseline.actorId||candidate.weaponRef!==baseline.weaponRef)continue;
      const input=encodeFullFireEffects(batch,candidate);
      if(!input)continue;
      const value=scoreFullFireEffects(model,input);
      options.push({key:candidate.key,baseline:candidate===baseline,scores:{model:value}});
      if(value>highest){selected=candidate;highest=value;}
    }
    report?.({key:selected.key,explanationKey:selected===baseline?'v2.round.modelBaseline':'v2.round.modelTarget',options});
    return selected.key;
  };
}
