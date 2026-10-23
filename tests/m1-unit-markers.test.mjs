import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createIronDustBrowserSession} from '../iron-dust-browser-v2.mjs';
import {buildIronDustV2View} from '../iron-dust-v2-view.mjs';

const source=readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8');
function adapter(document){
  const context=vm.createContext({document});
  for(const file of ['assets/unit-art/marker-geometry.js','unit-visuals.js'])
    vm.runInContext(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
  vm.runInContext(source,context);
  vm.runInContext(readFileSync(new URL('../scenario-profile-manifest.js',import.meta.url),'utf8'),context);
  return {markers:context.M1UnitMarkers,visuals:context.UnitVisuals,context,session(config){
    context.config=config;
    return vm.runInContext("ScenarioRuleProfiles.beginSession('relay-run',config)",context);
  }};
}
const raw=()=>structuredClone(createIronDustBrowserSession().projection.state.units);
function config(units){
  return {scenarioVersion:1,objectiveVersion:1,objective:'core-and-escort',
    ruleProfileId:'FIELD_TEST_LEGACY_v1',terrain:[],units:units.map(unit=>({...unit,
      move:unit.move??3,range:unit.range??3,damage:unit.damage??4}))};
}
function coreView(units=raw()){
  const session=createIronDustBrowserSession();
  return buildIronDustV2View({...session.projection,state:{...session.projection.state,units}},
    session.profile.header.ruleProfileId);
}

test('Core read projection keeps infantry and all separate system counts without changing source',()=>{
  const session=createIronDustBrowserSession(),before=JSON.stringify(session.projection);
  const view=buildIronDustV2View(session.projection,session.profile.header.ruleProfileId);
  const infantry=view.units.find(unit=>unit.id==='infantry');
  const ogre=view.units.find(unit=>unit.id==='ogre');
  assert.equal(infantry.infantry,true);
  assert.equal(ogre.maxTreads,45);
  assert.equal(ogre.weapons.main.count,1);
  assert.equal(ogre.weapons.main.destroyed,0);
  assert.equal(ogre.weapons.missiles.remaining,2);
  assert.equal(ogre.weapons.main.firedThisPhase,0);
  ogre.ogreSystems.treads=39;
  assert.equal(JSON.stringify(session.projection),before);
});

test('proportional three-segment HP/SP supports real maxima and partial segments',()=>{
  const {markers}=adapter();
  for(const maximum of [1,2,3,4,5,6]){
    const units=raw(),unit=units.find(unit=>unit.id==='guard');
    unit.maxHp=maximum;unit.hp=maximum;
    let data=markers.core(coreView(units),7,'core:7:same');
    let value=markers.damage(data.units.find(item=>item.unitId==='guard'));
    assert.deepEqual(Array.from(value.segments),[1,1,1]);
    unit.hp=maximum/2;unit.disabled=true;
    data=markers.core(coreView(units),7,'core:7:changed');
    value=markers.damage(data.units.find(item=>item.unitId==='guard'));
    assert.deepEqual(Array.from(value.segments),[1,.5,0]);
    assert.equal(data.units.find(item=>item.unitId==='guard').status,'disabled');
  }
  const units=raw(),infantry=units.find(unit=>unit.id==='infantry');
  infantry.hp=1;
  const data=markers.core(coreView(units),7,'core:7:sp');
  const projected=data.units.find(unit=>unit.unitId==='infantry');
  assert.equal(projected.vitality.kind,'infantry-strength');
  assert.equal(projected.vitality.current,1);
  assert.equal(projected.vitality.maximum,2);
  assert.deepEqual(Array.from(markers.damage(projected).segments),[1,.5,0]);
});

test('system display uses treads and destroyed weapons, never fired or consumed ammunition',()=>{
  const {markers}=adapter(),units=raw(),ogre=units.find(unit=>unit.id==='ogre');
  ogre.ogreSystems.treads=39;
  ogre.ogreSystems.weapons.main.firedThisPhase=1;
  ogre.ogreSystems.weapons.missiles.remaining=1;
  let data=markers.core(coreView(units),2,'bound');
  let value=markers.damage(data.units.find(unit=>unit.unitId==='ogre'));
  assert.equal(value.current,39);assert.equal(value.maximum,45);
  assert.equal(value.destroyedWeapons,0);
  assert.equal(value.kind,'treads');
  ogre.ogreSystems.weapons.main.destroyed=1;
  data=markers.core(coreView(units),2,'bound2');
  const projected=data.units.find(unit=>unit.unitId==='ogre');
  value=markers.damage(projected);
  assert.equal(projected.vitality.current,5);
  assert.equal(value.destroyedWeapons,1);
  projected.systems.weapons.main.destroyed=0;
  assert.equal(ogre.ogreSystems.weapons.main.destroyed,1);
});

test('bound objectives include all escorts; disabled stays pending, destroyed stays in status',()=>{
  const {markers,session}=adapter(),units=raw(),rules=config(units),bound=session(rules);
  const before=JSON.stringify({bound,units});
  let data=markers.legacy(bound,units,'legacy:session1',null);
  assert.equal(JSON.stringify({bound,units}),before);
  assert.equal(data.binding.revision,'legacy:session1');
  assert.equal(data.objective.members.length,3);
  rules.objective='core';rules.units=[];
  units.find(unit=>unit.id==='guard').disabled=true;
  units.find(unit=>unit.id==='core').hp=0;
  data=markers.legacy(bound,units,'legacy:session1:changed',false);
  assert.equal(data.objective.code,'core-and-escort');
  assert.equal(data.objective.members.find(member=>member.unitId==='guard').state,'pending');
  assert.equal(data.objective.members.find(member=>member.unitId==='core').state,'satisfied');
  assert.equal(data.objective.outcome,false);
  const core=markers.core(coreView(units),9,'core:9:new');
  assert.equal(core.objective.members.length,1);
  assert.equal(core.objective.members[0].unitId,'core');
  assert.equal(core.objective.members[0].state,'satisfied');
  assert.equal(core.binding.epoch,9);
});

test('unknown profile and missing maxima remain unsupported instead of inventing health',()=>{
  const {markers}=adapter();
  assert.equal(markers.core({...coreView(),ruleProfileId:'unknown'},1,'unknown').supported,false);
  assert.equal(markers.legacy({},raw(),'unknown',null).supported,false);
  const view=coreView();view.units.find(unit=>unit.id==='guard').maxHp=null;
  const unit=markers.core(view,1,'missing').units.find(unit=>unit.unitId==='guard');
  assert.equal(unit.vitality.maximum,null);
  assert.equal(markers.damage(unit).segments,null);
});

function scene(){
  class Node{
    constructor(tag){this.tag=tag;this.attrs={};this.children=[];}
    setAttribute(key,value){this.attrs[key]=String(value)}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node)}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this)}
    all(){return this.children.flatMap(node=>[node,...node.all()])}
    querySelector(selector){return this.all().find(node=>node.attrs.id===selector.slice(1))||null}
  }
  const document={createElementNS:(_,tag)=>new Node(tag)};
  return {document,map:new Node('svg')};
}
test('shared renderer places interaction rings above the pin and keeps picking transparent',()=>{
  const {document,map}=scene(),{markers}=adapter(document),units=raw();
  units.find(unit=>unit.id==='core').y=0;
  const data=markers.core(coreView(units),1,'same-revision');
  const actor=units.find(unit=>unit.id==='ogre'),target=units.find(unit=>unit.id==='core');
  const t=(key,params)=>key+JSON.stringify(params||{});
  markers.render(map,data,{actor,target,focus:{x:3,y:3},t});
  let all=map.all();
  assert.equal(map.children.length,1);
  assert.equal(map.children[0].attrs['data-revision'],'same-revision');
  assert.equal(map.querySelector('#v2-actor-marker').children.length,2);
  assert.equal(map.querySelector('#v2-target-marker').children.length,2);
  assert.equal(map.querySelector('#v2-focus-marker').tag,'polygon');
  const pins=all.filter(node=>node.attrs.class==='m1-objective-pin');
  assert.equal(pins.length,1);
  assert.match(pins[0].attrs.href,/objective-pin-below.webp$/);
  const children=map.children[0].children;
  const pinIndex=children.findIndex(node=>node.attrs.class==='m1-objective-pins');
  assert.ok(pinIndex<children.findIndex(node=>node.attrs.id==='v2-actor-marker'));
  assert.ok(pinIndex<children.findIndex(node=>node.attrs.id==='v2-target-marker'));
  assert.ok(pinIndex<children.findIndex(node=>node.attrs.id==='v2-focus-marker'));
  assert.equal(map.children[0].attrs['pointer-events'],'none');
  const layout=markers.pinLayout(data.units.find(unit=>unit.unitId==='core'));
  for(const key of ['x','y','width','height'])assert.equal(Number(pins[0].attrs[key]),layout[key]);
  assert.deepEqual({...markers.obstacles(data)[0]},{...layout.bounds});
  assert.equal(all.filter(node=>node.attrs.class==='m1-damage-empty').length,21);
  const widths=map.querySelector('#v2-actor-marker').children.map(node=>Number(node.attrs['stroke-width']));
  assert.ok(Math.abs(widths[0]/widths[1]-3)<1e-12);
  assert.equal(all.some(node=>/team-own|team-enemy|goal-octagon/.test(node.attrs.class||'')),false);
  target.hp=0;
  markers.render(map,markers.core(coreView(units),1,'next'),{actor,target:actor,t});
  assert.equal(map.children.length,1);
  assert.equal(map.querySelector('#v2-target-marker'),null);
  assert.equal(map.all().filter(node=>node.attrs.class==='m1-objective-pin').length,0);
});

test('all 52 measured icon anchors keep exactly four reference pixels to the visible pin tip',()=>{
  const {markers,visuals,context}=adapter();
  const receipt=JSON.parse(readFileSync(new URL('../assets/unit-art/map-icons-source.json',import.meta.url)));
  const scale=Math.sqrt(3)*34/112;
  for(const entry of receipt.icons)for(const y of [0,1,7]){
    assert.deepEqual(Array.from(context.GoblinMarkerGeometry.icons[entry.runtimePath].bounds),entry.runtimeAlphaBounds);
    const unit={unitId:entry.unitId,team:entry.team,position:{x:0,y}};
    const layout=markers.pinLayout(unit),icon=visuals.boundsFor({...unit,id:unit.unitId});
    const cy=48+y*51;
    assert.equal(icon.kind,'asset');
    assert.ok(Math.abs(icon.top/scale-(entry.runtimeAlphaBounds[1]/192-.5)*100)<1e-10);
    assert.ok(Math.abs(icon.bottom/scale-(entry.runtimeAlphaBounds[3]/192-.5)*100)<1e-10);
    const tip=y===0?layout.bounds.top:layout.bounds.bottom;
    const gap=y===0?tip-cy-icon.bottom:cy+icon.top-tip;
    assert.ok(Math.abs(gap/scale-4)<1e-10,`${entry.unitId}/${entry.team}/row${y}`);
    assert.ok(Math.abs(layout.width/scale-200)<1e-10);
    assert.ok(Math.abs(layout.height/scale-260)<1e-10);
  }
  const guard={unitId:'guard-tank',team:'enemy',position:{x:2,y:0}};
  assert.ok(Math.abs((markers.pinLayout(guard).bounds.top-48)/scale-27.4375)<1e-10);
});

test('failed images use existing vector geometry; absent measured metadata creates no guessed pin',()=>{
  const {markers,visuals,context}=adapter();
  const events=[];context.Event=class{constructor(type){this.type=type}};
  context.dispatchEvent=event=>events.push(event.type);
  const unit={unitId:'guard',name:'GUARD TANK',type:'guard',team:'enemy',position:{x:2,y:0}};
  const image={},asset=visuals.assetFor({...unit,id:unit.unitId});
  visuals.watchMapImage(image,asset,()=>{});image.onerror();
  assert.deepEqual(events,['goblin-unit-art-fallback']);
  const layout=markers.pinLayout(unit),bounds=visuals.boundsFor({...unit,id:unit.unitId});
  assert.equal(layout.iconKind,'vector');
  assert.ok(Math.abs(layout.bounds.top-48-bounds.bottom-4*Math.sqrt(3)*34/112)<1e-10);
  assert.equal(bounds.bottom,14.75); // Registered tracked polygon + its existing half-stroke.
  const pinImage={};visuals.watchMapImage(pinImage,layout.asset,()=>{});pinImage.onerror();
  assert.equal(markers.pinLayout(unit),null);
  assert.deepEqual(Array.from(markers.obstacles({supported:true,units:[{...unit,mapVisible:true}],
    objective:{members:[{unitId:unit.unitId,state:'pending'}]}})),[]);
  context.GoblinMarkerGeometry=undefined;
  assert.equal(markers.pinLayout({...unit,position:{x:2,y:1}}),null);
});

test('pin derivatives have fixed provenance, centered full canvas and matching hashes',()=>{
  const receipt=JSON.parse(readFileSync(new URL('../assets/unit-art/objective-pins-source.json',import.meta.url)));
  assert.equal(receipt.sourceCommit,'c01ecb80bcdd813772d1433d9ae63b39e54ef050');
  assert.deepEqual(receipt.export.canvasAnchor,[150,195]);
  assert.deepEqual(receipt.export.referenceCanvas,[200,260]);
  assert.equal(receipt.pins.length,2);
  for(const entry of receipt.pins){
    const bytes=readFileSync(new URL(`../${entry.runtimePath}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.runtimeSha256);
    assert.equal(bytes.length,entry.runtimeBytes);
  }
});
