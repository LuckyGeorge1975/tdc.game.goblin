import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';
test('actual command-menu placement never uses hidden occupancy, including raw resize callers',async()=>{
 const g=await fullScene(),source=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8'),start=source.indexOf('    function positionCommandMenu(state)'),end=source.indexOf('    function renderCommandMenu',start);
 const card={hidden:false,dataset:{},style:{removeProperty(key){delete this[key]}},classList:{add(){},remove(){}},getBoundingClientRect:()=>({width:110,height:80})},map={getBoundingClientRect:()=>({left:0,right:1000,top:0,bottom:600,width:1000,height:600})};
 g.context.__card=card;g.context.__map=map;g.context.innerWidth=1280;g.context.innerHeight=800;
 g.run(`const at=id=>id==='#v2-command-card'?__card:__map,nativeMap={createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y}}}},getScreenCTM(){return {}}};view.target={x:7,y:2};view.actorId=units.find(u=>u.catalogId==='U13').id;${source.slice(start,end)}`);
 const hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id");assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),false);
 const before=g.state(),full=read(g,'GoblinCatalogFullRuntime.snapshot()'),rng=g.rng();g.run('positionCommandMenu({units:GoblinCatalogFullRuntime.roster()})');const known={left:card.style.left,top:card.style.top,placement:card.dataset.placement};
 g.run('positionCommandMenu({units})');assert.deepEqual({left:card.style.left,top:card.style.top,placement:card.dataset.placement},known);assert.equal(g.state(),before);assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),full);assert.deepEqual(g.rng(),rng);
});
