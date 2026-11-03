import {lifeGlobals} from './helpers/unit-life-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the active UI's real field intel renderer (shared by Core and Legacy), not the hidden legacy intel panel.
const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const begin="    const el = (tag, className = '', text = '') => {";
const end="    for (const button of at('#v2-intel-switches').querySelectorAll('[data-section]'))\n      button.onclick";
const renderer=source.slice(source.indexOf(begin),source.indexOf(end));
assert.ok(source.indexOf(begin)>=0&&renderer.includes('function renderFieldInfo(state, actor, terrainAt)'));
const terrainAt={core:'cell=>state.cells.find(item=>item.x===cell.x&&item.y===cell.y)?.type',legacy:'cell=>terrainTypeAt(cell.x,cell.y)'};
const textOf=node=>[node.textContent,...node.children.map(textOf)].filter(Boolean).join(' ');

async function scene(lang,runtime){
  let currentLang=lang;
  const node=()=>({children:[],textContent:'',style:{},dataset:{},replaceChildren(){this.children=[];},setAttribute(){},
    appendChild(child){this.children.push(child);},append(...nodes){this.children.push(...nodes);},prepend(){},
    get childElementCount(){return this.children.length;},querySelectorAll:()=>[]});
  const intel=node(),context=vm.createContext({...lifeGlobals,actor:null,console,URL,URLSearchParams,
    document:{currentScript:{src:'http://127.0.0.1/localization.js'},readyState:'loading',title:'',
      addEventListener(){},createElement:node},
    location:{href:'http://127.0.0.1/',search:''},navigator:{language:'de'},
    localStorage:{getItem:()=>null},fetch:async url=>({ok:true,json:async()=>JSON.parse(readFileSync(
      new URL('../assets/ui-copy/'+new URL(url).pathname.split('/').at(-1),import.meta.url),'utf8'))}),
    view:{target:{x:7,y:5},infoCell:null},at:()=>intel,svgIcon:()=>'',
    hexLabel:()=> 'H-06',terrainTypeAt:()=> 'open',strengthText:()=> 'HP5',
    TerrainDisplay:{label:()=> 'OPEN',icon:()=>null}});
  for(const file of ['localization.js','presentation-state.js','unit-visuals.js','terrain-rules.js'])
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  const language=context.GoblinLanguage;
  await language.ready;
  context.GoblinLanguage={get current(){return currentLang;},
    t:(key,params,requested=currentLang)=>language.t(key,params,requested),
    translate:(text,requested=currentLang)=>language.translate(text,requested)};
  context.t=context.GoblinLanguage.t;
  const live={id:'ogre',name:'GOBLIN SIEGEBREAKER',visualKey:'goblin-siegebreaker',team:'player',x:7,y:5,hp:5};
  const wreck={id:'raider',name:'RAIDER SKIMMER',visualKey:'raider-skimmer',team:'enemy',x:7,y:5,hp:0};
  const alias={...wreck,id:'guard',name:'SIEGE TANK',visualKey:'siege-tank'};
  const custom={...wreck,id:'custom',name:'Scout Alpha'};
  context.state={units:[live,wreck,alias,custom],cells:[{x:7,y:5,type:'open'}]};
  context.GoblinPresentation.bind({runtime,sessionId:1},context.state);
  return {context,intel,live,wreck,setLanguage:lang=>{currentLang=lang;}};
}

for(const runtime of ['core','legacy'])test(`active ${runtime} intel uses exact contextual names across language changes, repeats and Undo`,async()=>{
  const {context,intel,live,setLanguage}=await scene('de',runtime),before=JSON.stringify(context.state);
  const expected={de:['Wrack: Feindlicher Skimmer','Wrack: Belagerungspanzer','Wrack: Scout Alpha'],
    en:['Wreck: Raider Skimmer','Wreck: Siege Tank','Wreck: Scout Alpha'],
    es:['Restos: Deslizador asaltante','Restos: Tanque de asedio','Restos: Scout Alpha'],
    fr:['Épave : Aéroglisseur maraudeur','Épave : Char de siège','Épave : Scout Alpha']};
  for(const lang of ['de','en','es','fr']){
    setLanguage(lang);
    vm.runInContext(`{${renderer}renderFieldInfo(state,actor,${terrainAt[runtime]});}`,context);
    const text=textOf(intel);
    assert.ok(text.includes(live.name));
    for(const label of expected[lang])assert.ok(text.includes(label),`${runtime}/${lang}: ${text}`);
    assert.doesNotMatch(text,/\{name\}|v2\.field\.wreck/);
    assert.equal(JSON.stringify(context.state),before);
    vm.runInContext(`{${renderer}renderFieldInfo(state,actor,${terrainAt[runtime]});}`,context);
    assert.equal(textOf(intel),text);
  }
  context.GoblinPresentation.synchronize({...context.state,units:[live]});
  vm.runInContext(`{${renderer}renderFieldInfo(state,actor,${terrainAt[runtime]});}`,context);
  assert.doesNotMatch(textOf(intel),/Wrack:|Wreck:|Restos:|Épave :/);
});

test('wreck name lookup validates visual context and keeps custom/unknown names without foreign keys',async()=>{
  const {context}=await scene('de','legacy'),label=context.UnitVisuals.wreckLabel;
  assert.equal(label({id:'guard',name:'GUARD TANK',visualKey:'guard-tank'}),'Wrack: Wachpanzer');
  assert.equal(label({id:'guard',name:'SIEGE TANK',visualKey:'siege-tank'}),'Wrack: Belagerungspanzer');
  assert.equal(label({unitId:'raider',nameKeyOrRuntimeName:'RAIDER SKIMMER',visualKey:'raider-skimmer'}),'Wrack: Feindlicher Skimmer');
  assert.equal(label({id:'raider',name:'RAIDER SKIMMER',visualKey:'siege-tank'}),'Wrack: RAIDER SKIMMER');
  assert.equal(label({id:'raider',name:'Custom Falcon',visualKey:'raider-skimmer'}),'Wrack: Custom Falcon');
  assert.equal(label({id:'unknown',name:'Custom Beacon',visualKey:'unmapped'}),'Wrack: Custom Beacon');
  assert.equal(label({id:'unknown'}),'Wrack: unknown');
  context.GoblinLanguage={t:key=>key,translate:value=>value};
  assert.equal(label({id:'raider',name:'RAIDER SKIMMER',visualKey:'raider-skimmer'}),'RAIDER SKIMMER');
});
