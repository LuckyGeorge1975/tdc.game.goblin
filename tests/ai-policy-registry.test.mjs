import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createAiPolicyRegistry} from '../src/core/ai-policy-registry.mjs';
import {createAiSessionHost} from '../src/core/ai-session-host.mjs';

const artifact = Uint8Array.of(1,2,3);
const scope = {engine:'engine-v1',profile:'FULL',side:'enemy',feature:'feature-v1',slot:'first'};
const pin = {id:'test',label:'Test',sha256:createHash('sha256').update(artifact).digest('hex'),
  evaluation:'test-evaluation',schemaVersion:1,scopes:[scope]};

test('only pinned bytes and complete engine, profile, side, slot and feature coverage appear in choices',async()=>{
  const registry=createAiPolicyRegistry([pin]);
  const compile=()=>decision=>decision.candidates[0].key;
  assert.deepEqual(registry.choices([scope]),[]);
  await assert.rejects(registry.install('foreign',artifact,compile),/UNPINNED/);
  await assert.rejects(registry.install(pin.id,Uint8Array.of(4),compile),/HASH_MISMATCH/);
  await registry.install(pin.id,artifact,compile);
  assert.deepEqual(registry.choices([scope]),[{id:'test',label:'Test'}]);
  assert.deepEqual(registry.choices([scope,{...scope,side:'player'}]),[]);
  assert.equal(registry.bind(pin.id,[{...scope,slot:'retry'}]),null);
  const policy=registry.bind(pin.id,[scope]);
  assert.throws(()=>policy.select(scope,{schemaVersion:1,side:'player',slot:'first'}),/SCOPE_MISMATCH/);
  assert.throws(()=>policy.select({...scope,feature:'unknown'},{schemaVersion:1,side:'enemy',slot:'first'}),/SCOPE_MISMATCH/);
});

test('qualification binds the actual decision side and stale session results cannot commit',async()=>{
  const registry=createAiPolicyRegistry([pin]);
  let release;
  await registry.install(pin.id,artifact,()=>()=>new Promise(resolve=>{release=resolve;}));
  let state={...scope,session:1}, commits=0;
  const adapter={open:side=>({ok:true,schemaVersion:1,side,slot:'first',candidates:[{key:'shot'}]}),
    execute:()=>({ok:true}),invalidate(){}};
  const host=createAiSessionHost({adapter,read:()=>state,policy:registry.bind(pin.id,[scope]),commit:()=>commits++});
  const old=host.advance();
  state={...state,session:2};
  release('shot');
  assert.equal((await old).code,'AI_HOST_STALE');
  const bad=host.advance();
  release('foreign');
  assert.equal((await bad).code,'AI_UNKNOWN_CANDIDATE');
  const valid=host.advance();
  release('shot');
  assert.deepEqual(await valid,{ok:true});
  assert.equal(commits,1);
});
