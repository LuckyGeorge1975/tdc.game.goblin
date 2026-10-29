import test from 'node:test';import assert from 'node:assert/strict';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';
test('full snapshot rejects foreign session, extra fields, visibility and wave/own-turn drift before mutation',async()=>{
 const g=await fullScene(),before=read(g,'GoblinCatalogFullRuntime.snapshot()');
 for(const mutate of [s=>s.sessionId++,s=>s.extra=true,s=>s.visibility.bindings.pop(),s=>s.visibility.sequence=-1,s=>s.waves.configBinding='foreign',s=>s.ownTurns.enemy++,s=>s.waves.waves[0].status='spawned']){
  const bad=structuredClone(before);mutate(bad);g.context.badSnapshot=bad;assert.throws(()=>g.run('GoblinCatalogFullRuntime.restore(badSnapshot)'));assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);
 }
});
test('full restored roster rejects altered ordinary values, owner teams and system bindings',async()=>{
 for(const expression of ["units.find(u=>u.catalogId==='U13').hp=999","units.find(u=>u.catalogId==='U13').team='enemy'","units.find(u=>u.catalogId==='U21').catalogSystems={...units.find(u=>u.catalogId==='U21').catalogSystems,unitId:'foreign'}"]){const g=await fullScene();g.run(expression);assert.throws(()=>g.run('GoblinSpecialistsRuntime.validateRestoredState()'))}
});
