import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {catalogScene,read,execute} from './catalog-product-harness.mjs';
test('M1 recognizes the frozen catalogue session, objective and hidden cargo',async()=>{
 const g=await catalogScene();g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const m=read(g,"M1UnitMarkers.legacy(legacySession,units,'r',null)");assert.equal(m.supported,true);assert.deepEqual(m.objective.members.map(m=>m.unitId),['core']);assert.equal(m.units.find(u=>u.unitId==='drone').mapVisible,false);
 assert.equal(g.run("M1UnitMarkers.legacy(Object.freeze({...legacySession,effectiveRules:Object.freeze({...legacySession.effectiveRules,catalog:Object.freeze({...legacySession.effectiveRules.catalog,dataDigest:'bad'})})}),units,'r',null).supported"),false);
});
test('movement readiness includes stationary drone loading and infantry unload after carrier moved',async()=>{
 const g=await catalogScene();g.run("units[1].embarkedOn=null;units[1].x=2");assert.equal(g.run('phaseCanAct(units[1])'),true);
 execute(g,{type:'Embark',actorId:'squad',carrierId:'carrier-infantry',x:1,y:5});g.run("const c=units.find(u=>u.id==='carrier-infantry'),s=units.find(u=>u.id==='squad');s.embarkedThisTurn=false;c.moved=true");assert.equal(g.run('phaseCanAct(c)'),true);
});
test('all 42 translated keys match approved copy and primary names use asset IDs',()=>{
 // Approved root handoff SHA9331eef5932cc43c16854eb3fd8fc236ef2454a34ea74b3a70f77c109d7f523c; CI needs no admin root.
 const hashes={"de":"70de7789b2fa231ae22a1212bca9351f48441b26f7c0fe4a7807db39743153e6","en":"d78c6a60a07bcde5d95556dc403d3b7f6366d06acde43f08fe9dc77cb9454a58","es":"cf9950d02f0a8674e0dd8e55bf37eefad485ad3c777ae644035b691a6f823116","fr":"bc3788198a353e196073639f678331d2bc8eedd4b35e01c8b870b45000eecf2f"};
 for(const lang of ['de','en','es','fr']){const messages=JSON.parse(fs.readFileSync(new URL(`../assets/ui-copy/briefing-01.${lang}.json`,import.meta.url),'utf8')).messages;const keys=Object.keys(messages).filter(k=>(k.startsWith('mission.catalog-transport.')||k.startsWith('mission.catalog-maneuver.'))||k.includes('.catalog.')).sort();assert.equal(keys.length,42);assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(keys.map(k=>[k,messages[k]])))).digest('hex'),hashes[lang])}
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');assert.match(ui,/catalogId\?GoblinCatalogRuntime.name\(\{id\}\)/);assert.match(ui,/v2.ui.catalog.deployDrone/);
});
test('fire reasons distinguish aboard, deployment delay, spent and no weapon',async()=>{
 const g=await catalogScene();g.run("setTurnPhase('fire')");const shot=()=>read(g,"GoblinCatalogRuntime.fireQuery(units[1],units.find(u=>u.id==='core'))");
 assert.equal(shot().code,'ABOARD_FIRE');g.run("units[1].embarkedOn=null;units[1].droneReadyTurn=2");assert.equal(shot().code,'DRONE_NOT_READY');g.run('units[1].fired=true');assert.equal(shot().code,'FIRE_SPENT');
 const h=await catalogScene('catalog-maneuver');h.run("setTurnPhase('fire');units.find(u=>u.id==='hub').team='player'");assert.equal(read(h,"GoblinCatalogRuntime.fireQuery(units.find(u=>u.id==='hub'),units.find(u=>u.id==='core')).code"),'NO_WEAPON');
});

test('projected intel uses projected attack, SP and cargo rather than a future canonical state',async()=>{
 const g=await catalogScene();g.run("const display=structuredClone(units);for(const u of display){u.attack=u.damage;delete u.damage}units[1].embarkedOn=null");
 const before=g.rng();assert.equal(g.run("GoblinCatalogRuntime.loadWeight(display[0],display)"),3);
 assert.match(g.run("GoblinCatalogRuntime.summary(display[1],display)"),/A2/);
 assert.doesNotMatch(g.run("GoblinCatalogRuntime.summary(display[1],display)"),/undefined/);assert.deepEqual(g.rng(),before);
});
