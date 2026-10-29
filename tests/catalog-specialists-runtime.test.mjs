import test from 'node:test';import assert from 'node:assert/strict';import {specialistsScene,read} from './catalog-specialists-harness.mjs';
const shot=(actorId,componentId,weaponId='main-1')=>({type:'CatalogFire',actorId,target:{kind:'component',runtimeUnitId:'defender',componentId},weaponId,mode:'direct',spotterId:null});
test('actual session admits component state without platform HP, separate instance owner and initial budgets',async()=>{
 const g=await specialistsScene();assert.equal(g.run('legacySession.ruleProfileId'),'CATALOG_SPECIALISTS_v1');assert.equal(g.run("units.filter(u=>u.catalogSystems).every(u=>unitAlive(u)&&!Object.hasOwn(u,'hp'))"),true);assert.equal(g.run('Object.isFrozen(legacySession.effectiveRules.catalog.registry)'),true);
});
test('typed fire query resolves selected component, separate owner and frozen next capability without RNG or mutation',async()=>{
 const g=await specialistsScene();g.run("units.find(u=>u.id==='defender').x=5;units.find(u=>u.id==='defender').y=3;setTurnPhase('fire')");
 const c=shot('siege','main-1'),before=g.state(),rng=g.rng(),q=read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify(c)})`);assert.equal(q.ok,true);assert.equal(q.weapon.attack,3);assert.equal(q.defense,4);assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);
 const bad={...c,target:{kind:'unit',runtimeUnitId:'defender'}};assert.equal(read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify(bad)})`).ok,false);assert.equal(g.state(),before);
});

test('actual typed component fire consumes one shared resolver roll, binds the exact main target after NE, and Undo retries its cached roll',async()=>{
 const g=await specialistsScene();g.run("units.find(u=>u.id==='defender').x=5;units.find(u=>u.id==='defender').y=3;setTurnPhase('fire')");g.context.rollQueue=[0];const c=shot('siege','main-1');
 assert.equal(read(g,`executeSpecialistCommand(${JSON.stringify(c)})`).ok,true);assert.equal(g.rolls(),1);
 assert.equal(read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify({...c,weaponId:'main-2'})})`).ok,false);
 const event=g.events().at(-1).event;assert.equal(event.weapon.usedWeaponKey,'main-1');assert.equal(event.weapon.targetComponentId,'main-1');assert.equal(event.action.sourceCommand.type,'CatalogFire');
 assert.equal(event.sourceResults[0].result,'NE');assert.equal(event.sourceResults[0].system.id,'main-1');
 g.run('undoPhaseCommand()');assert.equal(read(g,`executeSpecialistCommand(${JSON.stringify(c)})`).ok,true);assert.equal(g.rolls(),1);
});
test('actual component D has no module effect; a tread roll of four stays NE and five applies attack strength',async()=>{
 for(const [componentId,roll,result,loss]of [['main-1',.4,'D',0],['treads',.6,'NE',0],['treads',.7,'X',6]]){const g=await specialistsScene();g.run("units.find(u=>u.id==='defender').x=5;units.find(u=>u.id==='defender').y=3;setTurnPhase('fire')");const before=read(g,"units.find(u=>u.id==='defender').catalogSystems");g.context.rollQueue=[roll];const c=shot('siege',componentId,'main-both');assert.equal(read(g,`executeSpecialistCommand(${JSON.stringify(c)})`).ok,true);const after=read(g,"units.find(u=>u.id==='defender').catalogSystems");assert.equal(g.events().at(-1).event.sourceResults[0].result,result);assert.deepEqual(after.components,before.components);assert.equal(after.treads,before.treads-loss);assert.equal(g.rolls(),1)}
});
