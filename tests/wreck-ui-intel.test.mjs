import {lifeGlobals} from './helpers/unit-life-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the active UI's real field intel renderer (shared by Core and Legacy), not the hidden legacy intel panel.
const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const begin="    const el = (tag, className = '', text = '') => {";
const end='    function targetObstacles(';
const renderer=source.slice(source.indexOf(begin),source.indexOf(end));
assert.ok(source.indexOf(begin)>=0&&renderer.includes('function renderFieldInfo(state, actor, terrainAt)'));
const terrainAt={core:'cell=>state.cells.find(item=>item.x===cell.x&&item.y===cell.y)?.type',legacy:'cell=>terrainTypeAt(cell.x,cell.y)'};
const textOf=node=>[node.textContent,...node.children.map(textOf)].filter(Boolean).join(' ');

async function scene(lang,runtime){
  let currentLang=lang;
  const node=()=>({children:[],textContent:'',style:{},dataset:{},attributes:{},replaceChildren(){this.children=[];},setAttribute(key,value){this.attributes[key]=value;},
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

test('Siegebreaker intel uses localized compact weapon names and exposes full labels beside unchanged values', async () => {
  const {context, intel, live, setLanguage} = await scene('de', 'legacy');
  const main = {range: 4, ready: 1, remaining: 1, count: 2, destroyed: 1};
  const antipersonnel = {range: 1, ready: 3, remaining: 3, count: 4, destroyed: 0};
  live.ogreSystems = {treads: 12, maxTreads: 16, selectedWeapon: 'main', weapons: {main, antipersonnel}};
  context.state.systems = [{id: live.id, summary: {weapons: {main: 1, antipersonnel: 3}}}];
  const all = (node, className) => [node, ...node.children.flatMap(child => all(child, className))]
    .filter(item => item.className === className);
  const expected = {de: ['Hpt', 'Inf'], en: ['Main', 'AP'], es: ['Ppal', 'AP'], fr: ['Princ', 'AP']};
  for (const [language, [mainShort, apShort]] of Object.entries(expected)) {
    setLanguage(language);
    vm.runInContext(`{${renderer}renderFieldInfo(state, actor, ${terrainAt.legacy});}`, context);
    const mainFull = context.t('v2.ui.weapon.main');
    const apFull = context.t('v2.ui.weapon.antipersonnel');
    const range = weapon => context.t('v2.intel.weaponRange', {weapon});
    const [rangeLabel, mainLabel, apLabel] = all(intel, 'v2-intel-compact-label');
    for (const [label, short, full] of [[rangeLabel, range(mainShort), range(mainFull)], [mainLabel, mainShort, mainFull], [apLabel, apShort, apFull]]) {
      assert.equal(label.title, full);
      assert.equal(label.children[0].textContent, short);
      assert.equal(label.children[0].attributes['aria-hidden'], 'true');
      assert.equal(label.children[1].className, 'v2-sr');
      assert.equal(label.children[1].textContent, full);
    }
    assert.equal(all(intel, 'v2-intel-stat').find(cell => cell.children[0] === rangeLabel).children[1].textContent, '4');
    assert.deepEqual(all(intel, 'v2-system-row').map(row => row.children[1].textContent),
      [`1/2 · ${context.t('v2.ui.weaponDamage', {count: 1})}`, `3/4 · ${context.t('v2.ui.weaponDamage', {count: 0})}`]);
  }
});

for(const runtime of ['core','legacy'])test(`active ${runtime} intel uses exact contextual names across language changes, repeats and Undo`,async()=>{
  const {context,intel,live,setLanguage}=await scene('de',runtime),before=JSON.stringify(context.state);
  const expected={de:['Wrack: Raider-Skimmer','Wrack: Belagerungspanzer','Wrack: Scout Alpha'],
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
  assert.equal(label({unitId:'raider',nameKeyOrRuntimeName:'RAIDER SKIMMER',visualKey:'raider-skimmer'}),'Wrack: Raider-Skimmer');
  assert.equal(label({id:'raider',name:'RAIDER SKIMMER',visualKey:'siege-tank'}),'Wrack: RAIDER SKIMMER');
  assert.equal(label({id:'raider',name:'Custom Falcon',visualKey:'raider-skimmer'}),'Wrack: Custom Falcon');
  assert.equal(label({id:'unknown',name:'Custom Beacon',visualKey:'unmapped'}),'Wrack: Custom Beacon');
  assert.equal(label({id:'unknown'}),'Wrack: unknown');
  context.GoblinLanguage={t:key=>key,translate:value=>value};
  assert.equal(label({id:'raider',name:'RAIDER SKIMMER',visualKey:'raider-skimmer'}),'RAIDER SKIMMER');
});
