import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {artilleryScene,read} from './artillery-product-harness.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url),'utf8'));
const loader=fs.readFileSync(new URL('../catalog-base-loader.js',import.meta.url),'utf8');
for(const valid of [true,false])test('actual catalogue boot loader '+(valid?'registers both validated missions':'fails closed without changing the prior session'),async()=>{
 const g=artilleryScene();g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;g.context.console={error(){}};
 g.context.fetch=async url=>{assert.equal(url,'assets/unit-art/rules/unit-profiles.catalog-approved.v1.json');return {ok:true,json:async()=>valid?data:{...data,targetActive:true}}};
 const before=g.state();await g.run(loader);assert.equal(g.run("Object.hasOwn(scenarioCatalog,'catalog-transport')"),valid);assert.equal(g.run("Object.hasOwn(scenarioCatalog,'catalog-maneuver')"),valid);assert.equal(g.state(),before);
 if(valid){g.run("loadScenario('catalog-transport')");assert.equal(read(g,'legacySession.ruleProfileId'),'CATALOG_BASE_TRANSPORT_v1')}
});
