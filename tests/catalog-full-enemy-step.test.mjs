import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeSession} from './helpers/full-native-test-session.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
const enemy=async()=>{const f=await nativeSession();for(let i=0;i<3;i++)f.endPhase();return f;};

test('Atlas native movement rejects invalid actors, paths and destinations without state or RNG effects',async()=>{
  const f=await enemy(),move={type:'Move',actorId:'catalog-full-atlas-20',x:8,y:1};
  assert.equal(f.full.moveQuery(move).ok,true);
  const before=f.facts();
  for(const command of [{...move,actorId:'catalog-full-atlas-1'},{...move,x:-1},{...move,x:0,y:0},{...move,path:[]},
    {type:'EnemyMove',actorId:move.actorId,x:8,y:1},{type:'EnemyHold',actorId:move.actorId}])
    assert.equal(f.commit(command).ok,false);
  assert.deepEqual(f.facts(),before);assert.equal(f.commit(move).ok,true);
  assert.deepEqual(JSON.parse(f.game.run('JSON.stringify(units.filter(u=>u.id==="catalog-full-atlas-20").map(u=>[u.x,u.y,u.moveCount]))')),[[8,1,1]]);
  assert.equal(f.commit(move).ok,false);assert.deepEqual(f.game.rng(),before[2]);
});

test('movement previews are revalidated against changed visible occupancy',async()=>{
  const f=await enemy(),move={type:'Move',actorId:'catalog-full-atlas-20',x:8,y:1};
  assert.equal(f.full.moveQuery(move).ok,true);
  f.game.run("{const blocker=units.find(u=>u.id==='catalog-full-atlas-21');blocker.x=8;blocker.y=1;GoblinCatalogFullRuntime.refresh()}");
  const before=f.facts();assert.equal(f.commit(move).ok,false);assert.deepEqual(f.facts(),before);
});

test('dead and disabled own actors are rechecked before each common phase choice',async()=>{
  const f=await enemy();f.game.run(`units.find(u=>u.id==='catalog-full-atlas-20').alive=false;
    units.find(u=>u.id==='catalog-full-atlas-20').hp=0;units.find(u=>u.id==='catalog-full-atlas-21').disabled=true;
    GoblinCatalogFullRuntime.refresh()`);
  for(let phase=0;phase<2;phase++){
    const batch=f.adapter.open('enemy');assert.ok(batch.ok);
    assert.ok(!batch.candidates.some(c=>['catalog-full-atlas-20','catalog-full-atlas-21'].includes(c.actorId)));
    f.endPhase();
  }
});

test('replacement during a choice revokes the old native decision without fallback or turn end',async()=>{
  const f=await enemy();let after,calls=0;
  const session=createOwnedFullCatalogSessionHost({port:f.port,player:f.host,select:{enemy:batch=>{
    calls++;f.game.run('loadScenario(currentScenario,controls)');after=f.facts();return batch.candidates[0].key;
  }}});
  assert.equal((await session.advance()).code,'AI_HOST_STALE');assert.equal(calls,1);assert.deepEqual(f.facts(),after);
});

test('choice exceptions do not create an automatic move or retry at the same native permission',async()=>{
  const f=await enemy(),before=f.facts();let calls=0;
  const session=createOwnedFullCatalogSessionHost({port:f.port,player:f.host,select:{enemy:()=>{calls++;throw Error('failed');}}});
  assert.equal((await session.advance()).code,'AI_HOST_SELECTION_FAILED');
  assert.equal((await session.advance()).code,'AI_FULL_NO_NEW_ACTION');assert.equal(calls,1);assert.deepEqual(f.facts(),before);
});

test('a failing native dispatch propagates once without fallback, retry or duplicate movement',async()=>{
  const f=await enemy(),error=Error('commit failed after mutation');let calls=0;
  const player={...f.host,dispatch(...args){calls++;f.host.dispatch(...args);throw error;}};
  const session=createOwnedFullCatalogSessionHost({port:f.port,player,select:{enemy:batch=>batch.candidates.find(c=>c.kind==='move').key}});
  await assert.rejects(()=>session.advance(),error);const after=f.facts();
  assert.equal((await session.advance()).code,'AI_FULL_NO_NEW_ACTION');assert.equal(calls,1);assert.deepEqual(f.facts(),after);
});

test('ending movement does not consume a weapon or schedule a legacy retry',async()=>{
  const f=await enemy(),before=f.game.run('JSON.stringify(units.find(u=>u.id==="catalog-full-atlas-20").catalogSystems)');
  f.endPhase();
  assert.equal(f.game.run('JSON.stringify(units.find(u=>u.id==="catalog-full-atlas-20").catalogSystems)'),before);
  assert.ok(![...f.game.timers.values()].some(callback=>String(callback).includes('const foes=')));
  assert.equal(f.port.state().phase,'fire');
});

test('hidden occupancy is omitted from a native preview and real movement stops at contact',async()=>{
  const f=await nativeSession('catalog-full-specialists');for(let i=0;i<3;i++)f.endPhase();
  const actorId='catalog-full-specialists-8';
  f.game.run(`{const actor=units.find(u=>u.id==='${actorId}'),ninja=units.find(u=>u.id==='u3-player-ninja');
    actor.x=1;actor.y=0;ninja.x=4;ninja.y=0;GoblinCatalogFullRuntime.refresh()}`);
  assert.equal(f.full.known('u3-player-ninja','enemy'),false);
  const command={type:'Move',actorId,x:4,y:0},before=f.facts();
  const query=f.full.moveQuery(command);assert.equal(query.ok,true);
  assert.equal(JSON.stringify(query).includes('u3-player-ninja'),false);assert.deepEqual(f.facts(),before);
  assert.equal(f.commit(command).ok,true);assert.equal(f.game.run(`units.find(u=>u.id==='${actorId}').x`),3);
  assert.equal(f.full.known('u3-player-ninja','enemy'),true);assert.deepEqual(f.game.rng(),before[2]);
});
