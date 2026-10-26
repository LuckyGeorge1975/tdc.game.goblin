import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function scene(runtime='core'){
  const node=tag=>({tag,children:[],attributes:{},classList:{add(){}},
    setAttribute(k,v){this.attributes[k]=String(v);},
    appendChild(child){this.children.push(child);return child;},replaceWith(child){this.replacement=child;}});
  const context=vm.createContext({document:{createElementNS:(_,tag)=>node(tag)}});
  for(const file of ['presentation-state.js','unit-visuals.js'])
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  const owner=context.GoblinPresentation,art=context.UnitVisuals;
  const unit={id:'actor',name:'GUARD TANK',type:'heavy-tank',team:'player',x:2,y:2,hp:3,visualKey:'guard-tank'};
  const state={units:[unit],turn:1,phase:'movement'};
  const binding={runtime,scenarioId:'wreck-test',scenarioVersion:1,ruleProfileId:'TEST',sourceStateVersion:1,sessionId:1};
  owner.bind(binding,state);
  return {context,owner,art,node,state,binding,unit};
}

for(const runtime of ['core','legacy'])test(`${runtime}: death keeps last facing, stable identity and authoritative immutable state`,()=>{
  const {owner,state,unit}=scene(runtime),saved=owner.read();
  const moved={...state,units:[{...unit,x:2,y:3}]};
  let ticket=owner.begin({type:'Move'},state);
  owner.confirm(ticket,moved,[{type:'UnitMoved'}],[{kind:'move',actorId:unit.id,
    from:{x:2,y:2},to:{x:2,y:3},path:[{x:2,y:3}],sourceEventIndex:0}]);
  const dead={...moved,units:[{...moved.units[0],hp:0}]},serialized=JSON.stringify(dead);
  ticket=owner.begin({type:'PlayerFire'},moved);owner.confirm(ticket,dead,[{type:'PlayerFireResolved'}],[]);
  const wreck=owner.read().wrecks[0];
  assert.ok(Math.abs(wreck.facingDegrees-60)<1e-8);
  assert.equal(wreck.origin,'confirmed-end-state');assert.equal(wreck.destructionRef.source,'accepted-command');
  assert.equal(owner.read().wreckMappingVersion,'static-wreck-v1');
  owner.synchronize(dead);owner.synchronize(dead);
  assert.equal(owner.read().wrecks.length,1);assert.equal(owner.read().wrecks[0].wreckId,wreck.wreckId);
  assert.equal(JSON.stringify(dead),serialized);assert.equal(owner.events().length,1,'no invented fire effect');
  assert.equal(owner.rewind(saved,state),true);assert.equal(owner.read().wrecks.length,0);
  ticket=owner.begin({type:'PlayerFire'},state);owner.confirm(ticket,{...state,units:[{...unit,hp:0}]},[],[]);
  assert.notEqual(owner.read().wrecks[0].wreckId,wreck.wreckId,'Undo/reissue belongs to a new branch');
});

test('dead baselines reconstruct quietly, multiple wrecks share one hex, new sessions discard them',()=>{
  const {owner,state,binding,unit}=scene();
  const dead={...state,units:[{...unit,hp:0},{...unit,id:'other',team:'enemy',hp:0}]};
  owner.bind({...binding,sessionId:2},dead);
  const wrecks=owner.read().wrecks;
  assert.equal(wrecks.length,2);assert.equal(new Set(wrecks.map(w=>w.wreckId)).size,2);
  assert.deepEqual(Array.from(wrecks,w=>w.facingDegrees),[0,180]);
  assert.ok(wrecks.every(w=>w.origin==='reconstructed-default'&&w.destructionRef===null));
  assert.equal(owner.events().length,0);
  owner.bind({...binding,sessionId:3},state);assert.equal(owner.read().wrecks.length,0);
});

test('disable, individual system loss and missing HP never become wrecks',()=>{
  const {owner,state,unit}=scene();
  for(const change of [{disabled:true},{ogreSystems:{treads:0,weapons:{main:{destroyed:1}}}},{hp:undefined}]){
    owner.synchronize({...state,units:[{...unit,...change}]});assert.equal(owner.read().wrecks.length,0);
  }
});

test('cargo casualty preserves hidden relation and its serial record without inventing an unload',()=>{
  const {owner,state,unit}=scene('legacy');
  const before={...state,units:[{...unit,embarkedOn:'carrier'}]};owner.synchronize(before);
  const after={...state,units:[{...unit,hp:0,embarkedOn:null}]};
  owner.synchronize(after,{source:'legacy-combatOutcome',beforeRevision:'before',afterRevision:'after'});
  assert.equal(owner.read().wrecks[0].cargoRelation.carrierId,'carrier');
  assert.equal(after.units[0].embarkedOn,null,'no gameplay relation rewrite');
});

test('wreck restore rejects stale versions, bindings, membership, duplicates and positions',()=>{
  const {owner,state,unit}=scene(),dead={...state,units:[{...unit,hp:0}]};owner.synchronize(dead);
  const saved=JSON.parse(JSON.stringify(owner.read()));
  assert.equal(owner.restore(saved,dead),true);
  for(const mutate of [s=>s.wreckMappingVersion='old',s=>s.wrecks[0].binding.sessionInstanceId='old',
    s=>s.wrecks[0].position.x++,s=>s.wrecks.push(s.wrecks[0]),s=>s.wrecks[0].unitId='unknown',
    s=>s.wrecks[0].wreckId='ghost']){
    const bad=JSON.parse(JSON.stringify(owner.read()));mutate(bad);
    assert.equal(owner.restore(bad,dead),false);assert.equal(owner.read().wrecks.length,1);
    assert.equal(owner.read().wrecks[0].origin,'reconstructed-default');
  }
});

test('wreck map draw is lazy, centered, separately shadowed and never draws live fallback or pins',()=>{
  const {owner,state,unit,art,node}=scene();
  const liveGroup=node('g');assert.equal(art.drawWreck(liveGroup,unit,{x:70,y:80}),null);
  assert.equal(liveGroup.children.length,0);
  const dead={...unit,hp:0};owner.synchronize({...state,units:[dead]});
  const before=JSON.stringify(owner.read()),group=node('g'),image=art.drawWreck(group,dead,{x:70,y:80});
  assert.match(image.attributes.href,/wrecks\/own\/guard-tank.webp$/);
  assert.equal(image.attributes.transform,'rotate(0 70 80)');
  assert.equal(group.children[0].attributes.transform,undefined);
  assert.match(group.children[0].attributes.style,/rgba\(8,10,14,.35\)/);
  assert.equal(group.children[0].children.some(child=>child.tag==='rect'),false,'no HP bar');
  image.onerror();
  const fallback=group.children[0].replacement;
  assert.deepEqual(fallback.children.map(child=>child.tag),['title','text']);
  assert.equal(fallback.children[0].textContent,'GUARD TANK');
  assert.equal(fallback.children[1].textContent,'×');
  assert.equal(art.drawWreck(node('g'),dead,{x:70,y:80}).tag,'g');
  assert.equal(JSON.stringify(owner.read()),before,'draw and fallback do not change presentation/game state');
});

test('hidden cargo has fieldinfo but no separate map image; missing sidecar stays neutral',()=>{
  const {owner,state,unit,art,node,context}=scene('legacy'),dead={...unit,hp:0,embarkedOn:'carrier'};
  owner.synchronize({...state,units:[dead]});
  assert.equal(art.wrecksAt(2,2).length,1);
  const group=node('g');assert.equal(art.drawWreck(group,dead,{x:0,y:0}),null);assert.equal(group.children.length,0);
  context.GoblinPresentation=undefined;
  const neutral=art.drawWreck(node('g'),{...dead,embarkedOn:null},{x:0,y:0});
  assert.equal(neutral.tag,'g');assert.equal(neutral.children[1].textContent,'×');
});
