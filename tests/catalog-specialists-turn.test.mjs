import test from 'node:test';import assert from 'node:assert/strict';import {specialistsScene,read} from './catalog-specialists-harness.mjs';import {enemy} from './artillery-product-harness.mjs';
test('actual enemy sequence fires each ready legal platform slot in stable order and preserves spent missiles across resets',async()=>{
 const g=await specialistsScene();g.run("units.find(u=>u.id==='alpha').x=6;units.find(u=>u.id==='alpha').y=1");g.context.rollQueue=Array(40).fill(0);enemy(g);
 const shots=g.events().filter(e=>e.event.kind==='fire'&&e.event.actor.unitId==='defender').map(e=>e.event.weapon.usedWeaponKey);assert.deepEqual(shots,['missiles-1','missiles-2','main-1']);
 assert.equal(g.run("units.find(u=>u.id==='defender').catalogSystems.components.filter(c=>c.spent).length"),2);assert.equal(g.run("units.find(u=>u.id==='alpha').catalogSystems.turn"),2);enemy(g);
 assert.equal(g.run("units.find(u=>u.id==='defender').catalogSystems.turn"),2);assert.equal(g.run("units.find(u=>u.id==='defender').catalogSystems.components.filter(c=>c.spent).length"),2);
});
test('new Ram accepts only conventional enemy vehicles, uses actual terrain path, no RNG, and Undo restores both actors',async()=>{
 const g=await specialistsScene();g.run("units.find(u=>u.id==='guard').x=2;units.find(u=>u.id==='guard').y=1");const c={type:'CatalogRam',actorId:'alpha',targetId:'guard',x:2,y:1},before=read(g,'units'),rng=g.rng();assert.equal(read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify(c)})`).ok,true);assert.equal(read(g,`executeSpecialistCommand(${JSON.stringify(c)})`).ok,true);assert.equal(g.run("units.find(u=>u.id==='guard').hp"),0);assert.equal(g.events().at(-1).event.action.sourceCommand.type,'CatalogRam');g.run('undoPhaseCommand()');assert.deepEqual(read(g,'units'),before);assert.deepEqual(g.rng(),rng);
 const bad={...c,targetId:'defender',x:9,y:1};assert.equal(read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify(bad)})`).ok,false);
});
