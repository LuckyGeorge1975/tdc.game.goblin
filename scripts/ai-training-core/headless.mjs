// Supported Node recording host. Engine scripts and their entrypoint order own
// every rule, action, phase and RNG; this module supplies only an inert DOM/clock.
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {gameplaySourceHashes} from './sources.mjs';
const files=[
  'unit-life.js','unit-visuals.js','terrain-rules.js','ogre-systems.js','legacy-supercover.js',
  'artillery-spotter-rules.js','assets/unit-art/rules/artillery-pilot.v1.js','siege-tank-fire-budget.js',
  'assets/unit-art/rules/siege-pilot.v1.js','skimmer-budget.js','assets/unit-art/rules/skimmer-pilot.v1.js',
  'catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js','scenario-profile-manifest.js',
  'game.js','ogre-runtime.js','combat-feedback.js','siegebreaker-weapons.js','strategic-missile.js',
  'siege-pilot-runtime.js','artillery-pilot-runtime.js','catalog-base-runtime.js','catalog-specialists-runtime.js',
  'catalog-specialists-ui.js','scenario.js','command-history.js','catalog-full-model.js','catalog-waves.js',
  'catalog-visibility.js','catalog-full-runtime.js','training-director.js','training-model.js','training-runtime.js',
  'level-events.js','editor-draft.js'];
const source=path=>fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8');
function documentStub(){
  const nodes=new Map();
  function element(){
    const classes=new Set(),attributes=new Map();
    return {innerHTML:'',textContent:'',checked:false,disabled:false,style:{},dataset:{},children:[],
      classList:{add(...items){items.forEach(x=>classes.add(x));},remove(...items){items.forEach(x=>classes.delete(x));},
        contains:x=>classes.has(x),toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);}},
      setAttribute(k,v){attributes.set(k,String(v));},getAttribute:k=>attributes.get(k)??null,removeAttribute(k){attributes.delete(k);},
      addEventListener(){},removeEventListener(){},appendChild(child){this.children.push(child);return child;},
      append(...items){this.children.push(...items);},before(){},remove(){},querySelector(){return null;},querySelectorAll(){return [];},
      animate(){return {finished:Promise.resolve(),cancel(){}};},insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}};
  }
  const buttons=['movement','fire','los'].map(view=>Object.assign(element(),{dataset:{view}}));
  return {querySelector(key){if(!nodes.has(key))nodes.set(key,element());return nodes.get(key);},
    querySelectorAll:key=>key==='.view-option:not(#grid-toggle)'?buttons:[],createElement:element,createElementNS:element,
    addEventListener(){},removeEventListener(){}};
}
export function createRecordingGame(){
  const timers=new Map();let serial=0;
  const context=vm.createContext({document:documentStub(),Math:Object.create(Math),structuredClone,console,
    URLSearchParams,URL,TextEncoder,TextDecoder,crypto:webcrypto,performance,location:{search:'?ui=classic'},
    localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true,warn:async()=>true},
    setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);},
    scheduleGameTask(fn){timers.set(++serial,fn);return serial;},
    requestAnimationFrame(){return ++serial;},cancelAnimationFrame(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}});
  context.window=context;
  const run=text=>vm.runInContext(text,context);
  const order=[...source('index.html').matchAll(/<script[^>]+src="([^"?]+)(?:[^"]*)"/g)]
    .map(match=>match[1]).filter(path=>files.includes(path));
  for(const path of files)if(!order.includes(path))order.push(path);
  for(const path of order)run(source(path));
  run('draw=()=>{};updateSelection=()=>{};');
  context.data=JSON.parse(source('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json'));
  context.levelData=JSON.parse(source('assets/unit-art/levels/catalog-full-levels.v3.json'));
  const sources=Object.freeze(gameplaySourceHashes());
  context.GoblinFullTrainingSources=Object.freeze({current:()=>sources});
  return {context,run,animations:()=>0,dispose(){timers.clear();context.GoblinCatalogFullRuntime.controllerPort()?.leave();}};
}
