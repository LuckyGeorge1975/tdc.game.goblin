import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createHash}from 'node:crypto';
import{fullScene,fullShell}from './catalog-full-harness.mjs';import{trainingScene}from './training-product-harness.mjs';import{groundBasisHash,groundBasisSources}from './helpers/full-ground-source-compatibility.mjs';
const ids=['atlas','terrain-course','advance','siege','specialists'].map(s=>'catalog-full-'+s),profiles=['FULL_CATALOG_v1','CATALOG_FULL_CANDIDATE_v1'];
const facts=g=>({world:g.state(),rng:g.rng(),history:g.run('JSON.stringify(phaseCommands)')});
function observe(g){g.run("globalThis.rendered=[];svg.appendChild=n=>rendered.push(n);document.createElementNS=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v},classList:{add(){}}})")}
test('five FULL missions in both exact profiles render existing ground with no World RNG History change',async()=>{
 for(const id of ids)for(const profile of profiles){const g=await fullScene(id,7,false,profile);observe(g);const before=facts(g);assert.equal(g.run('drawTerrainArtwork(0,0)'),true);const image=JSON.parse(g.run('JSON.stringify(rendered[0].attrs)'));assert.equal(image.href,g.run("UnitVisuals.terrainAssetFor('open-ground')"));assert.ok(fs.existsSync(new URL('../'+image.href,import.meta.url)));assert.equal(image.width,72);assert.equal(image.height,72);assert.equal(image['pointer-events'],'none');assert.deepEqual(facts(g),before)}
});
test('FULL rendering fails closed for absent uninitialized foreign or mismatched admissions',async()=>{
 const g=await fullScene('catalog-full-atlas');observe(g);const before=facts(g);
 for(const change of ["currentScenario='catalog-full-foreign'","legacySession={...legacySession,scenarioId:'foreign'}","legacySession={...legacySession,ruleProfileId:'foreign'}","legacySession={...legacySession,ruleProfileId:'FULL_CATALOG_v1'}","globalThis.GoblinCatalogFullModel=undefined","globalThis.GoblinCatalogFullModel={profile:'CATALOG_FULL_CANDIDATE_v1',has:()=>false}"]){g.context.change=change;assert.equal(g.run("(()=>{const oldId=currentScenario,oldSession=legacySession,oldModel=globalThis.GoblinCatalogFullModel;try{eval(change);return drawTerrainArtwork(0,0)}finally{currentScenario=oldId;legacySession=oldSession;globalThis.GoblinCatalogFullModel=oldModel}})()"),false,change);assert.deepEqual(facts(g),before)}
 const shell=fullShell();observe(shell);assert.equal(shell.run("(()=>{currentScenario='catalog-full-atlas';legacySession={scenarioId:currentScenario,ruleProfileId:'FULL_CATALOG_v1'};return drawTerrainArtwork(0,0)})()"),false);
});
test('historical Atlas Training3 and ordinary Legacy exceptions are retained',async()=>{
 for(const id of ['training-t01','training-t02','training-t03']){const g=await trainingScene(id);observe(g);assert.equal(g.run('drawTerrainArtwork(0,0)'),true);for(const probe of ['iron-dust','relay-run','unit-trial',...ids,'training-t04']){g.context.probe=probe;assert.equal(g.run('(()=>{const old=currentScenario;try{currentScenario=probe;return drawTerrainArtwork(0,0)}finally{currentScenario=old}})()'),false)}assert.equal(g.run("(()=>{currentScenario='atlas-proving-grounds';return drawTerrainArtwork(0,0)})()"),true)}
});
test('exact render provenance rejects forged sources and foreign references',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('./fixtures/full-ground-source-compatibility.v1.json',import.meta.url))),hash=p=>createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex'),current=Object.fromEntries(Object.keys(m.sourcePairs).map(p=>[p,hash(p)]));
 assert.deepEqual(groundBasisSources(current,'training-t01'),Object.fromEntries(Object.entries(m.sourcePairs).map(([p,v])=>[p,v.from])));assert.throws(()=>groundBasisSources(current,'foreign'));for(const p of Object.keys(current))assert.throws(()=>groundBasisHash(p,'forged','training-t01'));
});
