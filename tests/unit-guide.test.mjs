import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function guide(units=[{id:'ogre',name:'GOBLIN SIEGEBREAKER',team:'player',x:1,y:5,hp:5,maxHp:5,move:3,range:2,damage:3,defense:5,ogreSystems:{treads:45}}]){
  const nodes=new Map();
  function element(){return {textContent:'',innerHTML:'',disabled:false,scrollTop:0,children:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){},appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]}}}
  const document={querySelector(key){if(!nodes.has(key))nodes.set(key,element());return nodes.get(key)},createElement:element,addEventListener(){}};
  const context=vm.createContext({document,units,
    scenarioCatalog:{'iron-dust':{units:[{name:'GOBLIN SIEGEBREAKER'}]}},currentScenario:'iron-dust',
    isGevUnit:()=>false,phaseCanAct:()=>true,effectiveDefense:unit=>unit.defense,showUnitInfo(){},showFieldInfo(){},updateSelection(){},draw(){}});
  vm.runInContext(readFileSync(new URL('../unit-guide.js',import.meta.url),'utf8'),context);
  return {context,document};
}

test('unit library covers every asset and distinguishes live actions from planned actions',()=>{
  const {context,document}=guide();
  const manifest=JSON.parse(readFileSync(new URL('../assets/unit-art/manifest.json',import.meta.url),'utf8'));
  const names=new Set(vm.runInContext('unitGuideEntries.map(entry=>entry.name)',context));
  assert.equal(names.size,26);
  for(const unit of manifest.units)assert.ok(names.has(unit.name),unit.name);
  assert.equal(vm.runInContext('Object.keys(guideActions).length',context),26);
  vm.runInContext('renderUnitGuide()',context);
  assert.equal(document.querySelector('#guide-status').textContent,'LIVE IN CURRENT SCENARIO');
  assert.equal(document.querySelector('#guide-phase-status').textContent,'READY');
  assert.equal(document.querySelector('#guide-facts').innerHTML.includes('45 TREADS'),true);
  assert.equal(document.querySelector('#guide-find').disabled,false);
  assert.ok(document.querySelector('#guide-action-list').children.length>=2);
  vm.runInContext("guideIndex=unitGuideEntries.findIndex(entry=>entry.name==='PHANTOM PLATFORM');renderUnitGuide()",context);
  assert.equal(document.querySelector('#guide-find').disabled,true);
  assert.ok(document.querySelector('#guide-action-list').children.some(item=>item.textContent.includes('geplant')));
});

test('find-on-map focuses the unit without issuing a gameplay command',()=>{
  const {context,document}=guide();
  let mobileCall;
  context.GoblinMobileViews={show:(...args)=>{mobileCall=args}};
  vm.runInContext("renderUnitGuide();document.querySelector('#guide-find').onclick()",context);
  assert.equal(vm.runInContext('selected.id',context),'ogre');
  assert.equal(vm.runInContext('focusedCell.x',context),1);
  assert.equal(document.querySelector('#unit-guide-modal').classList.contains('hidden'),false);
  assert.equal(mobileCall[0],'map');
  assert.equal(mobileCall[1].focus,true);
});

test('artillery drone describes live Field Test movement separately from catalog movement',()=>{
  const drone={name:'ARTILLERY DRONE',team:'player',x:2,y:3,hp:1,maxHp:1,move:2,range:8,damage:2,defense:1};
  const {context,document}=guide([drone]);
  vm.runInContext("guideIndex=unitGuideEntries.findIndex(entry=>entry.name==='ARTILLERY DRONE');renderUnitGuide()",context);
  assert.match(document.querySelector('#guide-facts').innerHTML,/MOVE<\/span><b>2<\/b>/);
  assert.match(document.querySelector('#guide-copy').textContent,/selbstständig bewegen/);
  assert.ok(document.querySelector('#guide-action-list').children.some(item=>item.textContent.includes('bewegen')));
  context.units=[];
  vm.runInContext('renderUnitGuide()',context);
  assert.match(document.querySelector('#guide-facts').innerHTML,/MOVE<\/span><b>0<\/b>/);
  assert.match(document.querySelector('#guide-copy').textContent,/Katalogregel/);
});
