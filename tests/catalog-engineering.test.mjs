import test from 'node:test';import assert from 'node:assert/strict';import {specialistsScene,read} from './catalog-specialists-harness.mjs';
const cell=(job,x,y)=>({type:'Engineer',actorId:'engineers',job,target:{kind:'cell',x,y},option:null});
const run=(g,c)=>read(g,`executeSpecialistCommand(${JSON.stringify(c)})`);
function reject(g,c){const before=g.state(),rng=g.rng();assert.equal(read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify(c)})`).ok,false);assert.throws(()=>run(g,c));assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng)}
test('actual clear action consumes material, move and fire, updates rule terrain and Undo restores every value with no RNG',async()=>{
 const g=await specialistsScene('catalog-specialists'),before=read(g,'units'),rng=g.rng();assert.equal(run(g,cell('clear',2,2)).ok,true);
 assert.equal(g.run("terrainTypeAt(2,2)"),'open-ground');assert.deepEqual(read(g,"units.filter(u=>u.id==='engineers').map(u=>[u.material,u.moved,u.fired,u.specialistJournal.length])"),[[2,true,true,1]]);reject(g,cell('clear',2,4));g.run('undoPhaseCommand()');assert.deepEqual(read(g,'units'),before);assert.equal(g.run('terrainTypeAt(2,2)'),'rubble-field');assert.deepEqual(g.rng(),rng);
});
test('forest costs two, occupied terrain and insufficient material reject before mutation',async()=>{
 const g=await specialistsScene('catalog-specialists');reject(g,cell('position',2,3));g.run("units.find(u=>u.id==='engineers').material=1");reject(g,cell('clear',2,4));g.run("units.find(u=>u.id==='engineers').material=3");run(g,cell('clear',2,4));assert.equal(g.run("units.find(u=>u.id==='engineers').material"),1);
});
test('field-position shares canonical terrain cover/LOS/cost; bridge requires opposite passable land',async()=>{
 const g=await specialistsScene('catalog-specialists');run(g,cell('position',3,4));assert.equal(g.run("terrainTypeAt(3,4)"),'field-position');assert.equal(g.run("TerrainRules.coverBonus(terrainTypeAt(3,4))"),1);assert.equal(g.run("TerrainRules.blocksLos(terrainTypeAt(3,4))"),false);g.run('undoPhaseCommand()');run(g,cell('bridge',3,3));assert.equal(g.run('terrainTypeAt(3,3)'),'bridge');assert.equal(g.run("units.find(u=>u.id==='engineers').material"),1);
});
test('system repair restores a destroyed module with next-own-turn readiness and spends all Forge fire budgets',async()=>{
 const g=await specialistsScene('catalog-specialists');g.run("const target=units.find(u=>u.id==='carrier');target.x=2;target.y=2;target.disabled=true");
 const c={type:'Engineer',actorId:'engineers',job:'repair-vehicle',target:{kind:'unit',runtimeUnitId:'carrier'},option:'disabled'};run(g,c);assert.equal(g.run("units.find(u=>u.id==='carrier').disabled"),false);
 const z=await specialistsScene('catalog-specialists');z.run("const forge=units.find(u=>u.id==='forge');forge.catalogSystems=structuredClone(forge.catalogSystems);forge.catalogSystems.components.find(c=>c.id==='tool-1').destroyed=true;const eng=units.find(u=>u.id==='engineers');eng.x=2;eng.y=3");
 const j=await specialistsScene('catalog-specialists');run(j,{...cell('clear',2,4),actorId:'forge'});assert.equal(j.run("units.find(u=>u.id==='forge').material"),4);assert.equal(j.run("units.find(u=>u.id==='forge').catalogSystems.components.filter((c,i)=>units.find(u=>u.id==='forge').catalogSystems.rules.definition.components[i].kind==='weapon').every(c=>c.fired)"),true);
 const repair={type:'Engineer',actorId:'engineers',job:'repair-component',target:{kind:'component',runtimeUnitId:'forge',componentId:'tool-1'},option:null};run(z,repair);assert.deepEqual(read(z,"units.find(u=>u.id==='forge').catalogSystems.components.filter(c=>c.id==='tool-1').map(c=>[c.destroyed,c.readyFromTurn])"),[[false,2]]);
});
test('salvage uses a unique visible logical wreck once and Undo restores material, wreck and journal',async()=>{
 const g=await specialistsScene('catalog-specialists');g.run("const dead=units.find(u=>u.id==='ground-drone');dead.hp=0;dead.x=2;dead.y=2;units.find(u=>u.id==='engineers').material=2");const key=g.run("GoblinSpecialistsRuntime.wreckKey(units.find(u=>u.id==='ground-drone'))"),c={type:'Engineer',actorId:'engineers',job:'salvage',target:{kind:'wreck',wreckId:key},option:null};run(g,c);assert.equal(g.run("units.find(u=>u.id==='ground-drone').salvaged"),true);assert.equal(g.run("units.find(u=>u.id==='engineers').material"),3);g.run('undoPhaseCommand()');assert.equal(g.run("!!units.find(u=>u.id==='ground-drone').salvaged"),false);assert.equal(g.run("units.find(u=>u.id==='engineers').material"),2);
});
