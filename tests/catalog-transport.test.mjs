import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogScene,read,execute,enemy} from './catalog-product-harness.mjs';
const cmd=(type,actorId,x,y,extra={})=>({type,actorId,x,y,...extra});
const state=g=>g.state();
function reject(g,c){const before=state(g),rng=g.rng(),events=g.events();const result=execute(g,c);assert.equal(result.ok,false,JSON.stringify(c));assert.equal(state(g),before);assert.deepEqual(g.rng(),rng);assert.deepEqual(g.events(),events);return result}
test('exact adopted data and frozen digests, reject modified configuration before session mutation',async()=>{
 const g=await catalogScene();assert.equal(read(g,'legacySession.effectiveRules.catalog.scope.length'),17);
 for(const name of ['dataDigest','mechanicsDigest','levelDigest','terrainDigest','rosterDigest'])assert.match(read(g,`legacySession.effectiveRules.catalog.${name}`),/^[a-f0-9]{64}$/);
 assert.equal(g.run('Object.isFrozen(legacySession.effectiveRules.catalog.records.drone.rules)'),true);
 const before=state(g);assert.throws(()=>g.run("const bad=structuredClone(scenarioCatalog['catalog-transport']);bad.units[0].hp=99;ScenarioRuleProfiles.beginSession('catalog-transport',bad)"),/CATALOG_PROFILE_MISMATCH/);assert.equal(state(g),before);
 await assert.rejects(g.run('GoblinCatalogBase.initialize({...catalogData,targetActive:true})'),/CATALOG_DATA_DIGEST_MISMATCH/);
});
test('drone deployment consumes carrier main, retains GEV second, blocks same-turn fire and reload; Undo restores identity and flags',async()=>{
 const g=await catalogScene();assert.equal(g.run("carrierLoad(units.find(u=>u.id==='carrier-drone'))"),3);
 reject(g,cmd('Unload','carrier-drone',0,0,{cargoId:'drone'}));
 const before=read(g,'units');assert.equal(execute(g,cmd('Unload','carrier-drone',2,2,{cargoId:'drone'})).ok,true);
 assert.equal(read(g,"units.find(u=>u.id==='carrier-drone').moved"),true);
 assert.equal(read(g,"units.find(u=>u.id==='carrier-drone').secondMoved"),false);
 assert.equal(read(g,"units.find(u=>u.id==='drone').droneReadyTurn"),2);
 reject(g,cmd('Embark','drone',1,2,{carrierId:'carrier-drone'}));
 g.run('undoPhaseCommand()');assert.deepEqual(read(g,'units'),before);
 assert.equal(execute(g,cmd('Unload','carrier-drone',2,2,{cargoId:'drone'})).ok,true);
 g.run("setTurnPhase('fire')");reject(g,cmd('Fire','drone',8,2));
 g.run("setTurnPhase('gev')");assert.equal(execute(g,cmd('Move','carrier-drone',2,1)).ok,true);
 enemy(g);g.run("setTurnPhase('fire')");assert.equal(g.run("GoblinCatalogRuntime.fireQuery(units.find(u=>u.id==='drone'),units.find(u=>u.id==='militia')).ok"),true);
});
test('infantry load consumes cargo movement only; no mixing and no same-turn unload',async()=>{
 const g=await catalogScene();const c=cmd('Embark','squad',1,5,{carrierId:'carrier-infantry'});assert.equal(execute(g,c).ok,true);
 assert.equal(g.run("units.find(u=>u.id==='carrier-infantry').moved"),false);
 assert.equal(g.run("carrierLoad(units.find(u=>u.id==='carrier-infantry'))"),3);
 reject(g,cmd('Unload','carrier-infantry',2,5,{cargoId:'squad'}));
 assert.equal(execute(g,cmd('Move','carrier-infantry',3,5)).ok,true);
 assert.deepEqual(read(g,"units.filter(u=>['squad','carrier-infantry'].includes(u.id)).map(u=>[u.x,u.y])"),[[3,5],[3,5]]);
 enemy(g);
 assert.equal(execute(g,cmd('Unload','carrier-infantry',2,5,{cargoId:'squad'})).ok,true);
 assert.equal(g.run("units.find(u=>u.id==='carrier-infantry').moved"),false);
 reject(g,cmd('Move','squad',1,5));reject(g,c);
});
test('all four GEV budgets; U26 hover terrain but no second movement; halfUnit is metadata',async()=>{
 const g=await catalogScene('catalog-maneuver');
 assert.deepEqual(read(g,"['scout','combat','light','carrier','raider'].map(id=>{const u=units.find(u=>u.id===id);return [movementBudget(u),movementBudget(u,true),isGevUnit(u)]})"),[[3,2,true],[4,3,true],[4,3,true],[3,2,true],[2,0,false]]);
 assert.deepEqual(read(g,"units.filter(u=>u.id==='light').map(u=>[u.hp,u.damage,u.halfUnit,u.forceBudgetWeight])"),[[1,1,true,0.5]]);
 assert.equal(g.run("movementCost(units.find(u=>u.id==='raider'),'3,2')"),1);
 g.run("setTurnPhase('gev')");reject(g,cmd('Move','marines',3,2));
});
test('variable SP scales A/D after one D; fixed militia/platoon retain canonical A/D; X destroys counter',async()=>{
 const g=await catalogScene('catalog-maneuver');
 const results=read(g,"(()=>{const a={damage:1,team:'enemy'},m=units.find(u=>u.id==='marines'),p=units.find(u=>u.id==='platoon');return [applyCombatRoll(a,m,4),[m.hp,m.squads,m.damage,m.defense],applyCombatRoll(a,p,2),[p.hp,p.damage,p.defense]]})()");
 assert.equal(results[0].result,'D');assert.deepEqual(results[1],[2,2,2,2]);assert.equal(results[2].result,'D');assert.deepEqual(results[3],[1,1,2]);
 g.run("applyCombatRoll({damage:50,team:'enemy'},units.find(u=>u.id==='marines'),0)");assert.equal(g.run("units.find(u=>u.id==='marines').hp"),0);
});
test('carrier and drone use exactly one shared roll; carrier death destroys surviving mechanical cargo without second damage roll',async()=>{
 const g=await catalogScene();g.context.rollQueue=[0];const before=g.rolls();
 const out=read(g,"combatOutcome({damage:10,team:'enemy'},units.find(u=>u.id==='carrier-drone'))");
 assert.equal(g.rolls()-before,1);assert.equal(out.passengers.length,1);assert.equal(out.passengers[0].outcome.result,'X');
 assert.deepEqual(read(g,"units.filter(u=>['drone','carrier-drone'].includes(u.id)).map(u=>[u.hp,u.embarkedOn??null])"),[[0,null],[0,'carrier-drone']]);
});
test('strict commands reject extra fields/unknown types without RNG or state mutation, views use no RNG',async()=>{
 const g=await catalogScene();reject(g,cmd('Move','assault',3,3,{weaponKey:'anything'}));reject(g,cmd('Ram','assault',3,3));
 reject(g,cmd('FireArtillery','drone',8,2,{mode:'indirect',spotterId:'assault'}));
 const before=state(g),rng=g.rng();g.run("for(const u of units){GoblinCatalogRuntime.summary(u);movementBudget(u,true)}");assert.equal(state(g),before);assert.deepEqual(g.rng(),rng);
});
