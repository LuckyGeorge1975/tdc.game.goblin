import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{trainingScene}from './training-product-harness.mjs';
function observeArtwork(g){g.run("globalThis.rendered=[];svg.appendChild=node=>rendered.push(node);document.createElementNS=()=>({attrs:{},setAttribute(key,value){this.attrs[key]=value},classList:{add(){}}})")}
const state=g=>({world:g.state(),ambient:g.rng(),training:g.run('JSON.stringify(GoblinTrainingRuntime.rng())')});
test('actual training open-ground renderer uses only the existing asset and leaves World/RNG unchanged',async()=>{
 for(const id of ['training-t01','training-t02','training-t03']){const g=await trainingScene(id);observeArtwork(g);const before=state(g);assert.equal(g.run('drawTerrainArtwork(0,0)'),true);
  const image=JSON.parse(g.run('JSON.stringify(rendered[0].attrs)'));assert.equal(image.href,g.run("UnitVisuals.terrainAssetFor('open-ground')"));assert.ok(fs.existsSync(new URL('../'+image.href,import.meta.url)));assert.equal(image.width,72);assert.equal(image.height,72);assert.equal(image['pointer-events'],'none');assert.deepEqual(state(g),before);
 }
});
test('actual render guard preserves historical Atlas and excludes ordinary, foreign and mismatched training IDs',async()=>{
 const g=await trainingScene();observeArtwork(g);const before=state(g);
 for(const [id,expected]of [['atlas-proving-grounds',true],['iron-dust',false],['relay-run',false],['unit-trial',false],['catalog-full-atlas',false],['training-t04',false],['training-t02',false]]){
  g.context.probeId=id;assert.equal(g.run("(()=>{const previous=currentScenario;try{currentScenario=probeId;return drawTerrainArtwork(0,0)}finally{currentScenario=previous}})()"),expected,id);
 }
 assert.deepEqual(state(g),before);assert.equal(g.run('currentScenario'),'training-t01');
});
