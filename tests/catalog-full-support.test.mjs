import test from 'node:test';import assert from 'node:assert/strict';
import {fullScene} from './catalog-full-harness.mjs';import {read,execute,enemy} from './artillery-product-harness.mjs';
test('both full engineers execute their real clear job, consume canonical material/action and BACK restores full state',async()=>{
 for(const id of ['U16','U18']){
  const g=await fullScene();g.context.classId=id;g.run("globalThis.actor=units.find(u=>u.catalogId===classId);globalThis.cell=classId==='U16'?{x:2,y:3}:{x:4,y:5};terrainTypes.set(cell.x+','+cell.y,'forest');terrain.add(cell.x+','+cell.y)");
  const command=read(g,"({type:'Engineer',actorId:actor.id,job:'clear',target:{kind:'cell',...cell},option:null})"),before=read(g,'GoblinCatalogFullRuntime.snapshot()'),material=read(g,'actor.material'),query=read(g,`query(${JSON.stringify(command)})`);assert.equal(query.ok,true,id);const rolls=g.rolls();assert.equal(execute(g,command).ok,true);assert.equal(read(g,'actor.material'),material-query.cost);assert.equal(read(g,'actor.moved&&actor.fired'),true);assert.equal(g.rolls(),rolls);
  g.run('undoPhaseCommand()');assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);g.run("globalThis.actor=units.find(u=>u.catalogId===classId);actor.material=0");assert.equal(read(g,`query(${JSON.stringify(command)})`).code,'INSUFFICIENT_MATERIAL');
 }
});
test('full Forge deploy preserves bay identity, delays cargo fire, and restores owner/cargo with BACK',async()=>{
 const g=await fullScene(),command=read(g,"(()=>{const owner=units.find(u=>u.catalogId==='U18'),cargo=carrierCargo(owner)[0];return {type:'CatalogDeploy',actorId:owner.id,cargoId:cargo.id,bayId:cargo.cargoBay,x:4,y:5}})()"),before=read(g,'GoblinCatalogFullRuntime.snapshot()');assert.equal(read(g,`query(${JSON.stringify(command)})`).ok,true);assert.equal(execute(g,command).ok,true);
 assert.deepEqual(read(g,`(()=>{const u=units.find(u=>u.id===${JSON.stringify(command.cargoId)});return [u.embarkedOn,u.droneReadyTurn,u.fired,u.moved]})()`),[null,2,true,true]);assert.equal(g.rolls(),0);g.run('undoPhaseCommand()');assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);assert.equal(read(g,`units.find(u=>u.id===${JSON.stringify(command.cargoId)}).embarkedOn`),command.actorId);
});
test('full conventional carrier uses actual Embark/next-turn Unload, typed feedback and reversible drone readiness',async()=>{
 const g=await fullScene();g.run("const carrier=units.find(u=>u.catalogId==='U12');carrier.x=1;carrier.y=4");
 const load=read(g,"(()=>{const carrier=units.find(u=>u.catalogId==='U12'),cargo=units.find(u=>u.catalogId==='U14'&&!u.embarkedOn);return {type:'Embark',actorId:cargo.id,carrierId:carrier.id,x:carrier.x,y:carrier.y}})()");assert.equal(read(g,`query(${JSON.stringify(load)})`).ok,true);assert.equal(execute(g,load).ok,true);assert.equal(read(g,'GoblinCatalogFullRuntime.snapshot().logs.at(-1).key'),'v2.ui.embark');
 const unload={type:'Unload',actorId:load.carrierId,cargoId:load.actorId,x:0,y:4};assert.equal(read(g,`query(${JSON.stringify(unload)})`).ok,false);enemy(g);const before=read(g,'GoblinCatalogFullRuntime.snapshot()');assert.equal(read(g,`query(${JSON.stringify(unload)})`).ok,true);assert.equal(execute(g,unload).ok,true);assert.equal(read(g,'GoblinCatalogFullRuntime.snapshot().logs.at(-1).key'),'v2.ui.unload');assert.equal(read(g,`units.find(u=>u.id===${JSON.stringify(load.actorId)}).droneReadyTurn`),3);g.run('undoPhaseCommand()');assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);
});
