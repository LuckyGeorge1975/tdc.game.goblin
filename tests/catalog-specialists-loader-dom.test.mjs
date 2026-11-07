import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {artilleryScene,read} from './artillery-product-harness.mjs';import {specialistsScene} from './catalog-specialists-harness.mjs';
const loader=fs.readFileSync(new URL('../catalog-specialists-loader.js',import.meta.url),'utf8'),data=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url),'utf8'));
for(const valid of [true,false])test('actual specialists loader '+(valid?'validates before registering both fixed missions':'fails closed on unapproved data'),async()=>{
 const g=artilleryScene();g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;g.context.console={error(){}};g.context.fetch=async()=>({ok:true,json:async()=>valid?data:{...data,targetActive:true}});const before=g.state();await g.run(loader);assert.equal(g.run("Object.hasOwn(scenarioCatalog,'catalog-siege')"),valid);assert.equal(g.run("Object.hasOwn(scenarioCatalog,'catalog-specialists')"),valid);assert.equal(g.state(),before);
 if(valid){g.run("loadScenario('catalog-specialists')");assert.equal(g.run('legacySession.ruleProfileId'),'CATALOG_SPECIALISTS_v1')}
});
test('target weapon options include distinct ready, spent and destroyed slots without dispatch',async()=>{
 const g=await specialistsScene();
 g.run("const u=units.find(u=>u.id==='alpha'),s=structuredClone(u.catalogSystems);s.components.find(c=>c.id==='missiles-1').spent=true;s.components.find(c=>c.id==='main-1').destroyed=true;u.catalogSystems=s;setTurnPhase('fire')");
 const before=g.state(), rng=g.rng();
 const entries=read(g,"GoblinSpecialistsUI.commands({turnPhase,units},units.find(u=>u.id==='alpha'),units.find(u=>u.id==='guard'))");
 assert.ok(entries.some(entry=>entry.command.weaponId==='secondary-2'));
 assert.ok(entries.find(entry=>entry.command.weaponId==='missiles-1').label.includes('v2.specialists.spent'));
 assert.ok(entries.find(entry=>entry.command.weaponId==='main-1').label.includes('v2.ui.destroyed'));
 assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);
});

test('target options enumerate explicit components, direct fire and observer-specific indirect fire',async()=>{
 const g=await specialistsScene();g.run("setTurnPhase('fire')");
 const entries=read(g,"GoblinSpecialistsUI.commands({turnPhase,units},units.find(u=>u.id==='battery'),units.find(u=>u.id==='defender'))");
 assert.ok(entries.some(({command})=>command.target.componentId==='main-1'&&command.mode==='direct'&&command.spotterId===null));
 assert.ok(entries.some(({command})=>command.target.componentId==='main-1'&&command.mode==='indirect'&&command.spotterId==='observer'));
 assert.ok(entries.every(({command})=>command.weaponId===null&&command.target.componentId));
});
