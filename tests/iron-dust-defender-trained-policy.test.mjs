import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {prepareIronDustDefenderTrainedPolicy} from '../src/core/iron-dust-defender-trained-policy.mjs';
import {createIronDustProfile,dispatchIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustAiAdapter} from '../src/core/iron-dust-ai-adapter.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from './iron-dust-source-victory-trace.v2.mjs';
import {createIronDustDecisionHost} from '../iron-dust-browser-v2.mjs';
import {projectIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
const bytes=readFileSync(new URL('../assets/ai/iron-dust-defender-bpn.json',import.meta.url));
const source=()=>victory.commands.slice(0,13).reduce((profile,command)=>
  dispatchIronDustProfile(profile,command).profile,createIronDustProfile(8));

test('the trained browser defender receives fire features while retaining native medium movement',async()=>{
  const policy=await prepareIronDustDefenderTrainedPolicy(bytes);
  let session={profile:source()};
  session.projection=projectIronDustProfile(session.profile);
  let evidence,accepted;
  const host=createIronDustDecisionHost({readSession:()=>session,readEpoch:()=>1,
    side:'enemy',spectator:true,explicitEnemyMovement:false,explicitEnemyFireFeatures:true,
    select(batch,report){
      const baseline=batch.candidates.find(candidate=>candidate.facts.baseline||candidate.facts.automatic);
      assert.ok(baseline);
      return policy.select(batch,baseline.key,report);
    },
    install(next,command,reason){session=next;accepted=command;evidence=reason;}
  });
  assert.deepEqual(await host.advance(),{ok:true});
  assert.ok(['EnemyUnitAttack','EnemySystemAttack'].includes(accepted.type));
  assert.ok(evidence.options.length>0);
  assert.ok(evidence.options.every(option=>Number.isFinite(option.scores.model)));
  assert.ok(session.projection.events.some(event=>event.targetId===accepted.targetId));
  const movement=victory.commands.slice(0,4).reduce((profile,command)=>
    dispatchIronDustProfile(profile,command).profile,createIronDustProfile(8));
  const read=()=>({state:movement,generation:1});
  const original=createIronDustAiAdapter(read).open('enemy');
  const enriched=createIronDustAiAdapter(read,{explicitEnemyFireFeatures:true}).open('enemy');
  const choices=batch=>batch.candidates.map(({key,...candidate})=>candidate);
  assert.deepEqual(choices(enriched),choices(original));
});

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
