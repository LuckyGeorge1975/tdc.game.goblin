import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fullScene} from './catalog-full-harness.mjs';import {read,enemy} from './artillery-product-harness.mjs';
test('native legacy tile classes and boundaries are independent of hidden Ninja occupancy',async()=>{
 const g=await fullScene(),source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8'),start=source.indexOf('function draw(){'),end=source.indexOf('function renderUnit(',start);
 g.context.__tiles=[];const create=g.context.document.createElementNS;g.context.document.createElementNS=(...args)=>create(...args);
 g.run("units.filter(u=>u.team==='player'&&u.id!=='u3-player-ninja').forEach(u=>u.disabled=true);selected=units.find(u=>u.id==='u3-player-ninja');selected.x=1;selected.y=0;const hidden=units.find(u=>u.catalogId==='U21'&&u.team==='enemy');hidden.x=4;hidden.y=0;terrain.clear();terrainTypes.clear();viewMode='movement';svg.appendChild=node=>__tiles.push(node);renderUnit=()=>{};drawTerrainArtwork=()=>false;drawGrid=()=>{};drawFocusMarker=()=>{};updateRoster=()=>{};showCarrierCargo=()=>{}");g.run(source.slice(start,end));
 const hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id");assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),false);
 g.run('draw()');const flags=()=>g.context.__tiles.filter(n=>n.dataset.x!==undefined).map(n=>[n.dataset.x,n.dataset.y,n.classList.contains('movement-fill'),n.classList.contains('attack')]);const occupied=flags();
 g.run("units.find(u=>u.catalogId==='U21'&&u.team==='enemy').x=11;units.find(u=>u.catalogId==='U21'&&u.team==='enemy').y=0;__tiles.length=0;draw()");assert.deepEqual(occupied,flags());
});
test('actual enemy movement chooses only its own known-roster targets before moving',async()=>{
 const g=await fullScene();g.context.__targets=[];g.run("const ownNinja=units.find(u=>u.id==='u3-player-ninja');ownNinja.x=6;ownNinja.y=2;terrain.clear();terrainTypes.clear();const originalStep=findEnemyStep;findEnemyStep=function(foe,target){__targets.push({foeId:foe.id,targetId:target.id});return originalStep(foe,target)}");
 assert.equal(read(g,"GoblinCatalogFullRuntime.known('u3-player-ninja','enemy')"),false);enemy(g);
 const ninja=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id"),choice=g.context.__targets.find(t=>t.foeId===ninja);assert.ok(choice);assert.notEqual(choice.targetId,'u3-player-ninja');
});
test('exported focus entry refuses a hidden live ID before coordinates, selection or centering',async()=>{
 const g=await fullScene(),source=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8'),start=source.indexOf('    function focusUnit(id)'),end=source.indexOf('    function chooseHex',start);g.context.__centers=[];g.context.__lookups=[];
 g.run(`const at=()=>({focus(){}}),nativeMap={querySelector(selector){__lookups.push(selector);return {selector}}},centerOnHex=value=>__centers.push(value),clearContext=()=>{},chooseActor=id=>{view.actorId=id};view.focusCell={x:0,y:0};view.infoCell={x:0,y:0};${source.slice(start,end)}`);
 const hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id"),before=g.state(),rng=g.rng();g.run(`focusUnit(${JSON.stringify(hidden)})`);assert.deepEqual(read(g,'view.focusCell'),{x:0,y:0});assert.equal(g.context.__centers.length,0);assert.equal(g.context.__lookups.length,0);assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);
 g.run("focusUnit('core')");assert.deepEqual(read(g,'view.focusCell'),{x:10,y:3});assert.equal(g.context.__centers.length,1);
});
