import assert from 'node:assert/strict';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';

const atlas='catalog-full-atlas';
const snapshot=game=>read(game,'({units,turn,phase,turnPhase,gameOver,full:GoblinCatalogFullRuntime.snapshot()})');
const baseline=batch=>(batch.candidates.find(candidate=>candidate.facts.baseline)??
  batch.candidates.find(candidate=>candidate.kind==='end-phase')).key;

async function run(select,strong=false) {
  const game=await fullScene(atlas,7,false,'FULL_CATALOG_v1');
  const calls=[], commits=[];
  let port;
  const choose=batch=>{
    calls.push(port.ticket('ai'));
    return select(batch,calls.length);
  };
  if(strong)game.context.GoblinCatalogFullRuntime.registerQualifiedController({
    side:'enemy',id:'test-strong',difficulty:'strong',select:choose});
  port=game.run(strong?
    'loadScenario("catalog-full-atlas",{roles:{player:"ai",enemy:"ai"},policyIds:{enemy:"test-strong"}})':
    'loadScenario("catalog-full-atlas",{roles:{player:"ai",enemy:"ai"}})');
  for(let n=0;n<3;n++)assert.equal(port.commit('ai',port.open('ai').permit,{type:'EndPhase'}).ok,true);
  const player=createFullCatalogAiHost(game.context.GoblinCatalogFullRuntime,game.context.GoblinSpecialistsUI,
    game.context.GoblinCatalogFullRuntime.nativePlayerGateway,()=>game.run('phase'),game.context.GoblinSpecialistsRuntime);
  const host=createOwnedFullCatalogSessionHost({port,player,select:{enemy:choose},
    onCommit:({action},before)=>commits.push({action,generation:before.generation})});
  return {game,port,host,calls,commits};
}

test('a rejected choice stays rejected across pause and resume, with no policy retry or draw',async()=>{
  const {game,port,host,calls,commits}=await run(()=> 'unknown');
  const original=port.ticket('ai'), state=snapshot(game), rng=game.rng();
  assert.equal((await host.advance()).code,'AI_UNKNOWN_CANDIDATE');
  host.pause();
  assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
  host.resume();
  const fresh=port.ticket('ai');
  assert.equal(fresh.slot,original.slot);
  assert.notEqual(fresh.generation,original.generation);
  assert.equal((await host.advance()).code,'AI_FULL_NO_NEW_ACTION');
  assert.equal(calls.length,1);
  assert.equal(commits.length,0);
  assert.deepEqual(game.rng(),rng);
  assert.deepEqual(snapshot(game),state);
});

test('an explicitly paused strong worker attempt can restart its unspent slot after resume',async()=>{
  const deferred=Promise.withResolvers();
  const match=await run((batch,count)=>count===1?deferred.promise:baseline(batch),true);
  const original=match.port.ticket('ai');
  const pending=match.host.advance();
  match.host.pause();
  deferred.reject(Error('STRONG_SEARCH_STOPPED'));
  assert.equal((await pending).code,'AI_HOST_STALE');
  assert.equal(match.commits.length,0);
  match.host.resume();
  assert.equal(match.port.ticket('ai').slot,original.slot);
  assert.deepEqual(await match.host.advance(),{ok:true});
  assert.equal(match.calls.length,2);
  assert.equal(match.commits.length,1);
});

test('a valid choice still running on resume can commit only with fresh permission, then the next action plans normally',async()=>{
  const deferred=Promise.withResolvers();
  const {game,port,host,calls,commits}=await run((batch,count)=>count===1?deferred.promise.then(()=>baseline(batch)):baseline(batch));
  const uncontrolled=await run(baseline);
  const first=port.open('ai');
  assert.equal(first.entries,null);
  const expected=game.context.GoblinCatalogFullRuntime.referenceCommand();
  const pending=host.advance();
  assert.equal((await host.advance()).code,'AI_HOST_UNAVAILABLE');
  host.pause();
  assert.equal(port.commit('ai',first.permit,expected).code,'FULL_CONTROL_STALE');
  host.resume();
  assert.equal(port.commit('ai',first.permit,expected).code,'FULL_CONTROL_STALE');
  const fresh=port.ticket('ai');
  deferred.resolve();
  assert.deepEqual(await pending,{ok:true});
  assert.equal(calls.length,1);
  assert.equal(commits.length,1);
  assert.equal(commits[0].generation,fresh.generation);
  assert.deepEqual(await uncontrolled.host.advance(),{ok:true});
  assert.deepEqual(snapshot(game),snapshot(uncontrolled.game));
  assert.deepEqual(game.rng(),uncontrolled.game.rng());

  assert.deepEqual(await host.advance(),{ok:true});
  assert.deepEqual(await uncontrolled.host.advance(),{ok:true});
  assert.equal(calls.length,2);
  assert.notEqual(calls[0].slot,calls[1].slot);
  assert.equal(commits.length,2);
  assert.deepEqual(game.rng(),uncontrolled.game.rng());
  assert.deepEqual(snapshot(game),snapshot(uncontrolled.game));
});

test('a valid choice that completes during pause waits for resume; a changed revision cannot reuse it',async()=>{
  for(const changed of [false,true]){
    const deferred=Promise.withResolvers();
    const {game,port,host,calls,commits}=await run(batch=>deferred.promise.then(()=>baseline(batch)));
    const pending=host.advance();
    host.pause();
    deferred.resolve();
    assert.equal((await pending).code,'AI_HOST_STALE');
    assert.equal(commits.length,0);
    if(changed)game.run('GoblinCatalogFullRuntime.refresh()');
    const before=snapshot(game), rng=game.rng();
    host.resume();
    const generation=port.ticket('ai').generation;
    const result=await host.advance();
    assert.equal(calls.length,1);
    if(changed){
      assert.equal(result.code,'AI_FULL_NO_NEW_ACTION');
      assert.equal(commits.length,0);
      assert.deepEqual(game.rng(),rng);
      assert.deepEqual(snapshot(game),before);
    }else{
      assert.equal(result.ok,true);
      assert.equal(commits.length,1);
      assert.equal(commits[0].generation,generation);
    }
  }
});
