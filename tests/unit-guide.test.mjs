import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function guide(units=[{id:'ogre',name:'GOBLIN SIEGEBREAKER',team:'player',x:1,y:5,hp:5,maxHp:5,move:3,range:2,damage:3,defense:5,ogreSystems:{treads:45}}]){
  const nodes=new Map();
  function element(){return {textContent:'',innerHTML:'',disabled:false,scrollTop:0,children:[],attributes:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){},setAttribute(key,value){this.attributes[key]=value},appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]},scrollIntoView(){this.scrolled=true},focus(){this.focused=true}}}
  const document={querySelector(key){if(!nodes.has(key))nodes.set(key,element());return nodes.get(key)},createElement:element,addEventListener(){}};
  const context=vm.createContext({document,units,
    scenarioCatalog:{'iron-dust':{units:[{name:'GOBLIN SIEGEBREAKER'}]}},currentScenario:'iron-dust',
    isGevUnit:()=>false,phaseCanAct:()=>true,effectiveDefense:unit=>unit.defense,showUnitInfo(){},showFieldInfo(){},updateSelection(){},draw(){}});
  vm.runInContext(readFileSync(new URL('../unit-guide-range.js',import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('../unit-guide-voice.js',import.meta.url),'utf8'),context);
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

test('each of 26 units has a schematic hex preview with movement and attack modes',()=>{
  const {context,document}=guide([]);
  for(let i=0;i<26;i++){
    vm.runInContext(`guideIndex=${i};renderUnitGuide()`,context);
    assert.match(document.querySelector('#guide-range-map').innerHTML,/<svg/);
    assert.equal(document.querySelector('#guide-range-move').attributes['aria-pressed'],'true');
    document.querySelector('#guide-range-attack').onclick();
    assert.equal(document.querySelector('#guide-range-attack').attributes['aria-pressed'],'true');
    assert.match(document.querySelector('#guide-range-map').innerHTML,/guide-range-cell/);
    document.querySelector('#guide-range-move').onclick();
  }
});

test('preview distinguishes stationary, skimmer, weapon and spent missile reach',()=>{
  const {context,document}=guide([]);
  const profile=name=>vm.runInContext(`UnitGuideRange.profile(unitGuideEntries.find(item=>item.name==='${name}'),null)`,context);
  assert.equal(profile('LONG-RANGE BATTERY').movement,0);
  assert.equal(profile('LONG-RANGE BATTERY').range,8);
  assert.equal(profile('COMMAND HUB').range,0);
  assert.equal(profile('COMBAT SKIMMER').bonus,3);
  assert.equal(profile('RAIDER SKIMMER').bonus,0);
  assert.equal(profile('GOBLIN SIEGEBREAKER').range,5);
  const liveSkimmer={name:'COMBAT SKIMMER',move:4,range:2};
  context.liveSkimmer=liveSkimmer;
  assert.equal(vm.runInContext('UnitGuideRange.profile(unitGuideEntries.find(item=>item.name===\'COMBAT SKIMMER\'),liveSkimmer)',context).bonus,2);
  context.units=[{name:'STRATEGIC MISSILE CARRIER',move:1,range:8,missilesRemaining:0,hp:2,maxHp:2,team:'player',damage:6,defense:2}];
  vm.runInContext("guideIndex=unitGuideEntries.findIndex(item=>item.name==='STRATEGIC MISSILE CARRIER');renderUnitGuide()",context);
  document.querySelector('#guide-range-attack').onclick();
  assert.match(document.querySelector('#guide-range-summary').textContent,/Kein Angriff/);
  assert.match(document.querySelector('#guide-range-note').textContent,/Rakete verbraucht/);
});

test('destroyed Siegebreaker systems no longer contribute to live attack preview',()=>{
  const {context,document}=guide([]);
  const entry="unitGuideEntries.find(item=>item.name==='GOBLIN SIEGEBREAKER')";
  const weapons={
    missiles:{range:5,count:2,remaining:2,destroyed:2},
    main:{range:3,count:1,remaining:1,destroyed:0},
    secondary:{range:2,count:4,remaining:4,destroyed:0},
  };
  context.siegebreaker={name:'GOBLIN SIEGEBREAKER',move:3,ogreSystems:{weapons}};
  assert.equal(vm.runInContext(`UnitGuideRange.profile(${entry},siegebreaker).range`,context),3);
  context.units=[context.siegebreaker];
  vm.runInContext("guideIndex=unitGuideEntries.findIndex(item=>item.name==='GOBLIN SIEGEBREAKER');renderUnitGuide()",context);
  document.querySelector('#guide-range-attack').onclick();
  assert.match(document.querySelector('#guide-range-summary').textContent,/Max\. Reichweite intakter Waffen: 3 Hex/);
  weapons.main.destroyed=1;
  assert.equal(vm.runInContext(`UnitGuideRange.profile(${entry},siegebreaker).range`,context),2);
  weapons.secondary.destroyed=4;
  assert.equal(vm.runInContext(`UnitGuideRange.profile(${entry},siegebreaker).range`,context),0);
});

test('missile preview explains target cells and splash beyond them in every language',()=>{
  const {context,document}=guide([]);
  for(const [lang,fragment] of [['de','außerhalb des roten Bereichs'],['en','outside the red area'],['es','fuera de la zona roja'],['fr','hors de la zone rouge']]){
    context.GoblinLanguage={current:lang};
    vm.runInContext("guideIndex=unitGuideEntries.findIndex(item=>item.name==='STRATEGIC MISSILE CARRIER');renderUnitGuide()",context);
    document.querySelector('#guide-range-attack').onclick();
    assert.match(document.querySelector('#guide-range-note').textContent,new RegExp(fragment),lang);
  }
});

test('mobile details jump exposes the facts and general note without changing the guide entry',()=>{
  const {context,document}=guide();
  vm.runInContext('renderUnitGuide()',context);
  document.querySelector('#guide-details-jump').onclick();
  assert.equal(document.querySelector('#guide-name').scrolled,true);
  assert.equal(document.querySelector('#guide-name').focused,true);
  assert.equal(vm.runInContext('guideIndex',context),0);
});

test('every guide entry has a distinct general note in all supported languages',()=>{
  const {context,document}=guide([]);
  const entries=vm.runInContext('unitGuideEntries.map(item=>item.name)',context);
  const notes=vm.runInContext('UnitGuideVoice.lines',context);
  assert.deepEqual(Object.keys(notes).sort(),[...entries].sort());
  for(const lang of ['de','en','es','fr']){
    context.GoblinLanguage={current:lang};
    const seen=new Set();
    for(let i=0;i<entries.length;i++){
      vm.runInContext(`guideIndex=${i};renderUnitGuide()`,context);
      const note=document.querySelector('#guide-voice-copy').textContent;
      assert.ok(note.length>=40,`${lang}: ${entries[i]}`);
      seen.add(note);
    }
    assert.equal(seen.size,26,lang);
  }
  context.GoblinLanguage={current:'de'};
  vm.runInContext("guideIndex=unitGuideEntries.findIndex(item=>item.name==='SKIMMER SCOUT');renderUnitGuide()",context);
  assert.match(document.querySelector('#guide-voice-copy').textContent,/bevor der Gegner an der Reihe ist/);
  assert.match(document.querySelector('#guide-copy').textContent,/zusätzlicher Manöverschritt/);
});
