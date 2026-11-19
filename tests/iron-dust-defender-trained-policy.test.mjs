import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {prepareIronDustDefenderTrainedPolicy} from '../src/core/iron-dust-defender-trained-policy.mjs';
import {createIronDustProfile,dispatchIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustAiAdapter} from '../src/core/iron-dust-ai-adapter.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from './iron-dust-source-victory-trace.v2.mjs';
const bytes=readFileSync(new URL('../assets/ai/iron-dust-defender-bpn.json',import.meta.url));
const source=()=>victory.commands.slice(0,13).reduce((profile,command)=>
  dispatchIronDustProfile(profile,command).profile,createIronDustProfile(8));

test('the distinct pinned defender network makes a native component choice with its recorded scores',async()=>{
  const profile=source(),initial=JSON.stringify(profile);
  const adapter=createIronDustAiAdapter(()=>({state:profile,generation:1}),{explicitEnemyMovement:true});
  const batch=adapter.open('enemy');
  const baseline=batch.candidates.find(candidate=>candidate.target.componentId==='missiles');
  const policy=await prepareIronDustDefenderTrainedPolicy(bytes);
  let evidence;
  const key=policy.select(batch,baseline.key,value=>{evidence=value;});
  const selected=batch.candidates.find(candidate=>candidate.key===key);
  assert.equal(selected.target.componentId,'main');
  assert.notEqual(key,baseline.key);
  assert.equal(evidence.options.length,batch.candidates.length);
  assert.ok(Math.abs(evidence.options.find(value=>value.key===key).scores.model-0.09203911107036321)<1e-12);
  assert.equal(JSON.stringify(profile),initial);
  const actual=adapter.execute({schemaVersion:batch.schemaVersion,decisionId:batch.decisionId,revision:batch.revision,key});
  assert.equal(actual.ok,true);
  assert.equal(actual.events[0].targetKey,'main');
  assert.throws(()=>policy.select({...batch,side:'player'},baseline.key),/AI_POLICY_SCOPE_MISMATCH/);
  assert.throws(()=>policy.select({...batch,slot:'movement'},baseline.key),/AI_POLICY_SCOPE_MISMATCH/);
  assert.throws(()=>policy.select(batch,'missing'),/IRON_DUST_DEFENDER_SCOPE_INVALID/);
});

test('a changed defender artifact fails its pinned hash before the model can be selected',async()=>{
  const changed=Uint8Array.from(bytes);
  changed[changed.length-1]^=1;
  await assert.rejects(()=>prepareIronDustDefenderTrainedPolicy(changed),/AI_POLICY_HASH_MISMATCH/);
});
