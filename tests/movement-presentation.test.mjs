import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import movement from '../movement-presentation.js';
import '../fire-anchors.js';
import '../fire-presentation.js';
import '../wreck-klassen.js';
import presentation from '../presentation-state.js';
import {createCorePresentationObserver} from '../core-presentation.mjs';
import {createIronDustBrowserSession,dispatchIronDustBrowserAction} from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';

function clock(){
  let time=0,id=0;const callbacks=new Map();
  return {now:()=>time,request:fn=>{callbacks.set(++id,fn);return id;},cancel:id=>callbacks.delete(id),
    advance(ms){time+=ms;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time));},
    callbacks};
}
const sidecar=(angle=0)=>({facingByUnit:[{unitId:'a',team:'player',visualKey:'guard-tank',angleDegrees:angle}],wrecks:[]});
function item({path=[{x:3,y:2}],from={x:2,y:2},angle=0,mode='normal',team='player',key='guard-tank',id='move'}={}){
  const unit={id:'a',name:'Guard Tank',visualKey:key,team,...from,hp:3,maxHp:3};
  const before={units:[unit]},after={units:[{...unit,...path.at(-1)}]};
  const event={eventId:id,kind:'move',actor:{unitId:'a',visualKey:key,team,positionBefore:from,positionAfter:path.at(-1)},
    path,before,after,action:{animationPreference:{schemaVersion:1,mode}}};
  return {event,after,beforeSidecar:sidecar(angle),sidecar:sidecar(movement.plan(event,angle).finalHeading)};
}
function queue(){const c=clock(),frames=[],finished=[],diagnostics=[];
  return {c,frames,finished,diagnostics,q:movement.createQueue({...c,render:x=>frames.push(x),finish:x=>finished.push(x),diagnostic:x=>diagnostics.push(x)})};}

test('turns use shortest route and clockwise 180; real hex waypoint corners are never shortcut',()=>{
  for(const [to,degrees,duration]of [[{x:2,y:3},60,110],[{x:1,y:3},120,160],[{x:1,y:2},180,210]]){
    const value=item({path:[to]}),p=movement.plan(value.event,0),turn=p.segments[0];
    assert.equal(turn.kind,'turn');assert.equal(turn.end-turn.start,duration);assert.equal(turn.delta,degrees);
    const middle=movement.sample(p,duration/2,{x:2,y:2},0);
    assert.deepEqual(middle.point,movement.center({x:2,y:2}));assert.equal(middle.angle,degrees/2);
  }
  assert.equal(movement.shortest(300),-60);assert.equal(movement.shortest(-180),180);
  const value=item({path:[{x:3,y:2},{x:3,y:3},{x:4,y:3}]}),p=movement.plan(value.event,0);
  const drives=p.segments.filter(s=>s.kind==='drive');assert.equal(drives.length,3);
  for(const drive of drives){
    assert.deepEqual(movement.sample(p,drive.end,value.event.actor.positionBefore,0).point,movement.center(drive.to));
  }
});

test('class tempos, acceleration/braking, travel-only cap and enemy visual factor match reference',()=>{
  const guard=movement.plan(item().event,0),hover=movement.plan(item({key:'skimmer-scout'}).event,0);
  assert.ok(hover.duration<guard.duration);
  const drive=guard.segments[0],start=movement.center({x:2,y:2}),end=movement.center({x:3,y:2});
  const at=ratio=>movement.sample(guard,drive.end*ratio,{x:2,y:2},0).point.x;
  assert.ok(at(.1)-start.x<(end.x-start.x)*.1);
  assert.ok(end.x-at(.9)<(end.x-start.x)*.1);
  const path=Array.from({length:20},(_,i)=>({x:3+i,y:2}));
  const long=movement.plan(item({path}).event,0);assert.ok(Math.abs(long.duration-2500)<1e-8);assert.ok(long.scale<1);
  const enemy=movement.plan(item({team:'enemy'}).event,0);assert.ok(Math.abs(enemy.duration*1.3-guard.duration)<1e-8);
  for(const key of ['combat-skimmer','light-skimmer','skimmer-carrier','artillery-drone'])assert.equal(movement.plan(item({key}).event,0).duration,hover.duration);
  for(const key of ['infantry-platoon','amphibious-infantry','field-engineers','forge-engineer'])assert.equal(movement.plan(item({key}).event,0).kind,'foot');
  assert.equal(movement.plan(item({key:'unknown'}).event,0).kind,'none','unmapped artwork never invents track dust');
  assert.equal(movement.particles(guard,119,item().event).length,0);
  assert.equal(movement.particles(guard,120,item().event).length,1);
  assert.equal(movement.particles(guard,195,item().event).length,2);
  assert.equal(movement.particles(guard,guard.duration+550,item().event).length,0);
  const zigzag=Array.from({length:20},(_,i)=>({x:i%2?2:3,y:2}));
  const impossible=movement.plan(item({path:zigzag}).event,0);
  assert.equal(impossible.diagnostic,'FIXED_MOVEMENT_BUDGET_EXCEEDED');assert.ok(impossible.fixed>=2500);
});

test('queue hides future after states, serializes non-move results, consumes current skip exactly once',()=>{
  const s=queue(),first=item(),second=item({from:{x:3,y:2},path:[{x:3,y:3}],id:'second'});
  s.q.enqueue(first);s.q.enqueue(second);
  const final={units:[{...second.after.units[0],hp:0}]};
  s.q.enqueue({after:final,sidecar:sidecar(60)});
  assert.equal(s.frames.at(-1).state.units[0].x,2);
  assert.equal(s.q.read().queued,2);
  assert.equal(s.q.skip(),true);assert.equal(s.q.read().active,'second');
  assert.equal(s.frames.at(-1).state.units[0].hp,3);
  assert.equal(s.frames.at(-1).state.units[0].y,2);
  assert.equal(s.q.skip(),true);assert.equal(s.q.skip(),false);
  assert.equal(s.frames.at(-1).state.units[0].hp,0);
  s.c.advance(100);assert.equal(s.frames.at(-1).overlayOpacity,0);
  s.c.advance(60);assert.equal(s.frames.at(-1).overlayOpacity,.5);
  s.c.advance(60);assert.equal(s.q.busy(),false);assert.deepEqual(s.finished,[true]);
});

test('mode snapshot, dust, OFF immediate and reset invalidate even already delivered callbacks',()=>{
  const s=queue(),first=item({mode:'high'});s.q.enqueue(first);s.c.advance(160);
  assert.equal(s.frames.at(-1).dust,true);
  const stale=[...s.c.callbacks.values()][0],count=s.frames.length;
  s.q.clear();stale();assert.equal(s.frames.length,count);assert.equal(s.q.busy(),false);
  s.q.enqueue(item({mode:'off'}));assert.equal(s.frames.length,count);assert.equal(s.c.callbacks.size,0);
  s.q.enqueue(item({mode:'normal'}));assert.equal(s.frames.at(-1).dust,false);
  s.q.clear();s.q.enqueue(item({mode:'high',key:'skimmer-scout'}));assert.equal(s.frames.at(-1).dust,false);
});

test('actual Core player/enemy commits remain byte-identical with a running visual queue',()=>{
  let control=createIronDustBrowserSession(createIronDustProfile(8),8),current=control;
  const owner=presentation.createOwner(),observer=createCorePresentationObserver(owner),s=queue(),tickets=new WeakMap();
  owner.subscribe((type,value)=>{
    if(type==='cancel')s.q.clear();
    if(type==='begin')tickets.set(value.ticket,value.sidecar);
    if(type==='confirm'){
      if(!value.events.length)s.q.enqueue(value);
      for(const event of value.events)s.q.enqueue({...value,event,beforeSidecar:tickets.get(value.ticket)});
    }
  });
  observer.sync(current);
  const apply=command=>{
    const expected=dispatchIronDustBrowserAction(control,command),actual=dispatchIronDustBrowserAction(current,command,observer);
    assert.deepEqual(actual,expected);
    if(actual.session){control=expected.session;current=actual.session;}
  };
  apply({type:'Move',playerId:'player',unitId:'ogre',to:{x:3,y:3}});
  assert.equal(s.q.busy(),true);
  for(let i=0;i<3;i++)apply({type:'EndPhase',playerId:'player'});
  let count=0;while(current.projection.mode==='enemy'){assert.ok(count++<20);apply({type:'AutoEnemyAdvance',playerId:'enemy'});}
  assert.ok(s.q.read().queued>0);
  const authoritative=JSON.stringify(current);
  while(s.q.read().active)s.q.skip();s.c.advance(220);
  assert.equal(JSON.stringify(current),authoritative);
  assert.equal(s.q.busy(),false);
  assert.deepEqual(s.frames.at(-1).state,owner.endState());
});

// Minimal SVG tree, real presentation owner + real sprite/wreck/marker renderers.
function browserScene(runtime='core',team='player'){
  const listeners=new Map(),observers=[];const c=clock();
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.parentNode=null;
      const classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
      this.style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};}
    setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')this.id=String(v);}
    getAttribute(k){return this.attributes[k]??null;}
    appendChild(x){x.remove();this.children.push(x);x.parentNode=this;return x;}
    append(...xs){xs.forEach(x=>this.appendChild(x));}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
    replaceChildren(...xs){this.children.forEach(x=>x.parentNode=null);this.children=[];this.append(...xs);}
    addEventListener(){}
    querySelectorAll(selector){const matches=x=>selector[0]==='#'?x.id===selector.slice(1):selector[0]==='.'?x.classList.contains(selector.slice(1)):
      selector==='[data-unit-id]'?x.getAttribute('data-unit-id')!==null:false;
      return this.children.flatMap(x=>[...(matches(x)?[x]:[]),...x.querySelectorAll(selector)]);}
    querySelector(s){return this.querySelectorAll(s)[0]??null;}
  }
  const map=new Element('svg');map.id='battlefield-map';const body=new Element('body');body.append(map);
  const add=(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);};
  const document={body,hidden:false,createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag),
    querySelector:s=>body.querySelector(s),addEventListener:add};
  const context=vm.createContext({document,console,performance:{now:c.now},requestAnimationFrame:c.request,cancelAnimationFrame:c.cancel,
    addEventListener:add,dispatchEvent:event=>(listeners.get(event.type)??[]).forEach(fn=>fn(event)),Event:class{constructor(type){this.type=type;}},
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
    MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}});
  for(const file of ['presentation-state.js','unit-visuals.js','assets/unit-art/marker-geometry.js','m1-unit-markers.js','fire-anchors.js','wreck-klassen.js','fire-presentation.js','movement-presentation.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  const owner=context.GoblinPresentation,unit={id:'a',name:'Guard Tank',visualKey:'guard-tank',team,x:2,y:2,hp:3,maxHp:3};
  const core={id:'core',name:'Command Core',visualKey:'command-core',team:'enemy',x:8,y:2,hp:3,maxHp:3};
  const victory={status:'ongoing',winner:null};
  if(runtime==='core')context.IronDustBrowserV2={mode:'ready',epoch:1,view:{profileVersion:'core-iron-dust-profile-v1',ruleProfileId:'CORE_IRON_DUST_v2',victory,units:[unit,core]}};
  else vm.runInContext(`const legacySession=Object.freeze({scenarioId:'test',ruleProfileId:'FIELD_TEST_LEGACY_v1',
    sessionId:1,effectiveRules:Object.freeze({objectiveVersion:1,objective:'core',units:[{id:'core',core:true,team:'enemy'}]})});`,context);
  owner.bind({runtime,scenarioId:'test'}, {units:[unit,core],victory});
  function move(mode='normal'){
    context.GoblinPresentationPreferences={read:()=>({schemaVersion:1,mode})};
    const before={units:[unit,core],victory},after={units:[{...unit,x:3},core],victory},ticket=owner.begin({type:'Move'},before);
    owner.confirm(ticket,after,[],[{actorId:'a',kind:'move',from:{x:2,y:2},to:{x:3,y:2},path:[{x:3,y:2}],sourceEventIndex:0}]);
    return after;
  }
  function fire(mode='normal',result='D'){
    context.GoblinPresentationPreferences={read:()=>({schemaVersion:1,mode})};
    const before={units:[unit,core],victory},after={units:[unit,{...core,disabled:result==='D',hp:result==='X'?0:3}],victory};
    const ticket=owner.begin({type:'Fire'},before);
    return owner.confirm(ticket,after,[{result}],[],[{actorId:'a',targetId:'core',result,sourceEventIndex:0}])[0];
  }
  function rocket(mode='high',strategic=false,{targetVisual='command-core',passenger=false,result='X'}={}){
    context.GoblinPresentationPreferences={read:()=>({schemaVersion:1,mode})};
    const actor={...unit,visualKey:strategic?'strategic-missile-carrier':'rocket-artillery'};
    const target={...core,visualKey:targetVisual},crew={id:'crew',name:'Infantry',visualKey:'infantry-squad',team:'enemy',x:8,y:2,hp:2,maxHp:2,embarkedOn:'core'};
    const before={units:[actor,target,...(passenger?[crew]:[])],victory};
    const after={units:[actor,{...target,hp:result==='X'?0:3,disabled:result==='D'},...(passenger?[{...crew,hp:0}]:[])],victory};
    const ticket=owner.begin({type:'Fire'},before);
    const event=owner.confirm(ticket,after,[{result}],[],[{actorId:'a',targetId:'core',result,passengerIds:passenger?['crew']:[],sourceEventIndex:0}])[0];
    return {event,plan:context.GoblinFirePresentation.plan(event,0)};
  }
  return {context,owner,map,body,c,move,fire,rocket,observers,listeners};
}
test('dust reference uses scaled cubic ease-out growth/drift, alpha power 1.4 and existing 550ms lifetime',()=>{
  const value=item(),plan=movement.plan(value.event,0),scale=Math.sqrt(3)*34/112;
  const born=movement.particles(plan,120,value.event)[0],half=movement.particles(plan,395,value.event)[0];
  assert.ok(Math.abs(born.radius-5*scale)<1e-10);assert.equal(born.opacity,.34);
  assert.ok(Math.abs(half.radius-13.75*scale)<1e-10);
  assert.ok(Math.abs(half.opacity-.34*Math.pow(.5,1.4))<1e-10);
  assert.ok(Math.abs((born.x-half.x)-14*.875*scale)<1e-10);
  assert.equal(born.y,half.y);
  assert.deepEqual(movement.particles(plan,plan.duration+550,value.event),[]);
});
test('dust gradients soften center to transparent rim, stay layer-local and disappear on settle/reset',()=>{
  const s=browserScene();s.move('high');s.c.advance(180);
  const dust=()=>s.map.querySelector('#goblin-movement-layer').children[0];
  const gradient=dust().children[0].children[0],puff=dust().children[1],id=gradient.getAttribute('id');
  assert.equal(gradient.tagName,'radialGradient');assert.equal(gradient.getAttribute('r'),'50%');
  assert.deepEqual(gradient.children.map(stop=>[stop.getAttribute('offset'),stop.getAttribute('stop-color'),stop.getAttribute('stop-opacity')]),
    [['0%','#9e8a6c','1'],['100%','#9e8a6c','0']]);
  assert.equal(puff.getAttribute('fill'),`url(#${id})`);
  s.c.advance(30);assert.equal(dust().children.filter(child=>child.tagName==='defs').length,1);
  assert.equal(dust().children[0].children[0].getAttribute('id'),id);
  s.owner.cancel();assert.equal(s.body.querySelector(`#${id}`),null);
  s.move('high');s.c.advance(180);
  const nextId=dust().children[0].children[0].getAttribute('id');assert.notEqual(nextId,id);
  s.context.GoblinMovement.skip();s.c.advance(220);assert.equal(s.body.querySelector(`#${nextId}`),null);
  for(const mode of ['normal','off']){
    s.move(mode);s.c.advance(180);
    const layer=s.map.querySelector('#goblin-movement-layer');
    assert.ok(!layer||layer.children[0].children.length===0);
    s.owner.cancel();
  }
});
test('real SVG driver shows before-position, reattaches after map rebuild, pointer skip consumes click; reset removes layer',()=>{
  const s=browserScene(),after=s.move('high');
  assert.ok(s.body.classList.contains('goblin-moving'));
  assert.ok(s.map.querySelector('#goblin-movement-layer'));
  assert.ok(s.map.querySelector('#goblin-movement-layer').querySelector('#movement-v2-m1-markers'),'real frozen M1 marker projection');
  s.c.advance(180);
  assert.ok(s.map.querySelector('#goblin-movement-layer').querySelector('.unit-artwork').getAttribute('transform').startsWith('rotate(0 '));
  assert.ok(s.map.querySelector('#goblin-movement-layer').children[0].children.length>0,'HIGH track dust');
  s.map.replaceChildren();s.observers.forEach(fn=>fn());assert.ok(s.map.querySelector('#goblin-movement-layer'));
  let prevented=0,stopped=0;
  const input={target:{closest:()=>true},preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}};
  s.listeners.get('pointerdown').forEach(fn=>fn(input));
  s.listeners.get('click').forEach(fn=>fn(input));
  assert.equal(prevented,2);assert.equal(stopped,2);assert.equal(s.context.GoblinMovement.read().active,null);
  assert.deepEqual(JSON.parse(JSON.stringify(s.owner.endState())),after);
  s.c.advance(220);assert.equal(s.map.querySelector('#goblin-movement-layer'),null);
  s.move();const pending=[...s.c.callbacks.values()];s.owner.cancel();pending.forEach(fn=>fn());
  assert.equal(s.map.querySelector('#goblin-movement-layer'),null);assert.equal(s.body.classList.contains('goblin-moving'),false);
});

test('real SVG OFF creates no layer; NORMAL drives without particles and exact endpoint after skip',()=>{
  const s=browserScene();s.move('off');assert.equal(s.map.querySelector('#goblin-movement-layer'),null);
  s.move('normal');s.c.advance(180);
  const layer=s.map.querySelector('#goblin-movement-layer');assert.equal(layer.children[0].children.length,0);
  s.context.GoblinMovement.skip();assert.equal(s.context.GoblinMovement.read().active,null);
  s.c.advance(220);assert.equal(s.body.classList.contains('goblin-moving'),false);
});

test('both runtime/player/enemy SVG projections use real marker records; hiding the tab cancels frames',()=>{
  for(const runtime of ['core','legacy'])for(const team of ['player','enemy']){
    const s=browserScene(runtime,team);s.move();
    const markers=s.map.querySelector('#goblin-movement-layer').querySelector('#movement-v2-m1-markers');
    assert.ok(markers);assert.ok(markers.children.length>0);
    const stale=[...s.c.callbacks.values()];
    // Dispatch the actual browser boundary, then invoke stale frames deliberately.
    vm.runInContext('document.hidden=true',s.context);
    s.listeners.get('visibilitychange').forEach(fn=>fn());stale.forEach(fn=>fn());
    assert.equal(s.context.GoblinMovement.busy(),false);assert.equal(s.map.querySelector('#goblin-movement-layer'),null);
    s.move();assert.equal(s.context.GoblinMovement.busy(),false,'hidden commits stay instant');
  }
});

test('confirmed fire maps real side anchors, quad pair, explicit GOBLIN fallback and deferred rockets',()=>{
  const api=globalThis.GoblinFirePresentation;
  const event=item().event;event.kind='fire';event.weapon={usedWeaponKey:null};
  for(const team of ['player','enemy']){
    event.actor.team=team;event.actor.visualKey='guard-tank';
    const mapped=api.mapping(event);assert.equal(mapped.kind,'cannon');assert.equal(mapped.fallback,false);
    const anchor=mapped.anchors[0],base=team==='enemy'?180:0;
    const zero=api.muzzle({x:0,y:0},anchor,base,team),rotated=api.muzzle({x:0,y:0},anchor,base+90,team);
    assert.ok(Math.abs(rotated.x+zero.y)<1e-10);assert.ok(Math.abs(rotated.y-zero.x)<1e-10);
  }
  event.actor.visualKey='goblin-dreadnaught';assert.equal(api.mapping(event).anchors.length,2);
  event.actor.visualKey='goblin-siegebreaker';event.weapon.usedWeaponKey='main';
  assert.equal(api.mapping(event).fallback,true);assert.deepEqual(api.mapping(event).anchors,[[0,0]]);
  event.weapon.usedWeaponKey='antipersonnel';assert.equal(api.mapping(event).kind,'light');
  event.weapon.usedWeaponKey='missiles';assert.equal(api.mapping(event).kind,'deferred-rocket');
  event.weapon.usedWeaponKey=null;event.actor.visualKey='rocket-artillery';assert.equal(api.mapping(event).kind,'deferred-rocket');
  event.actor={unitId:'a',team:'player',visualKey:'goblin-dreadnaught',positionBefore:{x:2,y:2}};
  event.targetId='t';event.before={units:[{id:'a',x:2,y:2,team:'player'},{id:'t',x:5,y:3,team:'enemy',hp:3}]};
  event.after=event.before;event.effects=[];
  const plan=api.plan(event,0);
  assert.ok(plan.angle>0&&plan.angle<60,'fire uses exact target angle, not a hex heading');
  assert.equal(plan.shots.length,2);assert.equal(plan.shots[1].at-plan.shots[0].at,70);
  assert.equal(plan.arrival,Math.max(...plan.shots.map(shot=>shot.arrival)));
});

test('real fire SVG freezes target until arrival, applies actual D at +50ms, then cleans all effects',()=>{
  for(const runtime of ['core','legacy']){
    const s=browserScene(runtime),event=s.fire('high');
    const p=s.context.GoblinFirePresentation.plan(event,0);
    assert.ok(p.shots.length===1&&p.shots[0].arrival>p.shots[0].at);
    s.c.advance(p.arrival-1);
    assert.equal(s.context.GoblinMovement.projectedState().units[1].disabled,undefined);
    const read=()=>s.map.querySelector('#goblin-movement-layer').children.at(-1);
    assert.ok(read().children.some(node=>node.tagName==='line'),'visible confirmed tracer');
    s.c.advance(2);assert.equal(s.context.GoblinMovement.projectedState().units[1].disabled,undefined);
    s.c.advance(50);assert.equal(s.context.GoblinMovement.projectedState().units[1].disabled,true);
    assert.ok(read().children.some(node=>node.tagName==='text'),'truthful status caption');
    assert.equal(s.owner.endState().units[1].hp,3,'D never invents HP damage');
    s.context.GoblinMovement.skip();s.c.advance(220);
    assert.equal(s.map.querySelector('#goblin-movement-layer'),null);assert.equal(s.context.GoblinMovement.busy(),false);
  }
});

test('NE has no target reaction; OFF is instant; Normal omits smoke/sparks; target wreck stays hidden until hit',()=>{
  const ne=browserScene();const event=ne.fire('normal','NE'),p=ne.context.GoblinFirePresentation.plan(event,0);
  ne.c.advance(p.arrival+60);
  const fx=ne.map.querySelector('#goblin-movement-layer').children.at(-1);
  assert.equal(fx.children.filter(node=>node.tagName==='text'||node.tagName==='image').length,0);
  const off=browserScene();off.fire('off','X');assert.equal(off.context.GoblinMovement.busy(),false);
  const normal=browserScene(),destroyed=normal.fire('normal','X'),plan=normal.context.GoblinFirePresentation.plan(destroyed,0);
  assert.equal(normal.context.UnitVisuals.wrecksAt(8,2).length,0);
  normal.c.advance(plan.arrival+51);assert.equal(normal.context.UnitVisuals.wrecksAt(8,2).length,1);
  const effects=normal.map.querySelector('#goblin-movement-layer').children.at(-1);
  assert.equal(effects.children.filter(node=>node.tagName==='line').length,0,'no sparks');
  assert.equal(effects.children.filter(node=>node.tagName==='circle').length,0,'no smoke particles');
  const pending=[...normal.c.callbacks.values()];normal.owner.cancel();pending.forEach(fn=>fn());
  assert.equal(normal.map.querySelector('#goblin-movement-layer'),null);
});

test('fire ends naturally without skip and drains its following confirmed move exactly once',()=>{
  const s=browserScene(),event=s.fire('normal'),plan=s.context.GoblinFirePresentation.plan(event,0);
  s.move('normal');assert.equal(s.context.GoblinMovement.read().queued,1);
  s.c.advance(plan.duration);assert.ok(s.context.GoblinMovement.read().active);
  assert.ok(!s.context.GoblinMovement.read().active.includes('fire-'));
  s.c.advance(500);s.c.advance(220);
  assert.equal(s.context.GoblinMovement.busy(),false);assert.equal(s.c.callbacks.size,0);
  assert.equal(s.map.querySelector('#goblin-movement-layer'),null);
  assert.equal(s.owner.events().filter(item=>item.event.kind==='fire').length,1);
});

test('damage derives only actual HP/SP, system losses and disabled transition, not ammo or CRT letter',()=>{
  const api=globalThis.GoblinFirePresentation;
  const before={hp:5,ogreSystems:{treads:20,weapons:{main:{destroyed:0,remaining:1}}}};
  assert.equal(api.delta({before,after:{...before,ogreSystems:{...before.ogreSystems,weapons:{main:{destroyed:0,remaining:0}}}}}).changed,false);
  assert.equal(api.delta({before,after:{...before,ogreSystems:{...before.ogreSystems,treads:17}}}).treads,3);
  assert.equal(api.delta({before,after:{...before,ogreSystems:{...before.ogreSystems,weapons:{main:{destroyed:1,remaining:0}}}}}).systems,1);
  assert.equal(api.delta({before:{hp:2,infantry:true},after:{hp:1,infantry:true}}).label,'−1 SP');
  assert.equal(api.delta({before:{hp:3,disabled:true},after:{hp:0,disabled:true}}).hp,3);
});

test('system loss caption adds one minus to the existing counted locale text, with a counted neutral fallback',()=>{
  const s=browserScene(),api=s.context.GoblinFirePresentation;
  const dictionary=fs.readFileSync(new URL('../localization.js',import.meta.url),'utf8');
  const template=dictionary.match(/'v2\.ui\.weaponDamage': \{de:'([^']+)'/)[1];
  const before={hp:5,ogreSystems:{weapons:{main:{destroyed:0}}}};
  const after={hp:5,ogreSystems:{weapons:{main:{destroyed:1}}}};
  s.context.GoblinLanguage={t:(key,{count})=>{assert.equal(key,'v2.ui.weaponDamage');return template.replace('{count}',count);}};
  assert.equal(api.delta({before,after}).label,'−1 Waffen zerstört');
  delete s.context.GoblinLanguage;
  assert.equal(api.delta({before,after}).label,'−1 SYSTEM');
});

test('rocket trajectory accelerates, lifts/scales in world space, and applies one result only at the final decorative arrival',()=>{
  const s=browserScene(),{event,plan}=s.rocket('high');
  assert.equal(plan.rockets.length,3);assert.equal(plan.rockets[1].delay,100);
  const rocket=plan.rockets[0],pose=s.context.GoblinFirePresentation.rocketPose(rocket,.5);
  assert.ok(Math.abs(pose.h-1)<1e-12);
  assert.ok(Math.abs((pose.gx-rocket.start.x)/(rocket.end.x-rocket.start.x)-.3875)<1e-10);
  assert.ok(Math.abs(pose.size/Math.sqrt(3)/34*112-rocket.apexScale)<1e-10);
  assert.ok(pose.y<pose.gy);
  assert.equal(plan.arrival,plan.lastArrival);assert.equal(event.effects.length,1);
  const enemy=JSON.parse(JSON.stringify(event));enemy.actor.team='enemy';enemy.before.units[0].team='enemy';
  const enemyPlan=s.context.GoblinFirePresentation.plan(enemy,0);
  assert.ok(Math.abs(enemyPlan.duration*1.3-plan.duration)<1e-8,'enemy factor covers flight and the entire destruction tail');
  s.c.advance(plan.shotAt+rocket.flight+51);
  assert.equal(s.context.GoblinMovement.projectedState().units[1].hp,3,'first decorative impact cannot invent an early partial hit');
  s.c.advance(200);
  assert.equal(s.context.GoblinMovement.projectedState().units[1].hp,0);
  const strategic=browserScene().rocket('normal',true).plan;
  assert.equal(strategic.rockets.length,1,'actual strategic artwork class is sufficient even without a system weapon key');
  assert.equal(strategic.rockets[0].bodyLength,42);assert.ok(strategic.rockets[0].flight<=2000);
});

test('new rocket/destruction snapshots settle identically in both runtimes and every mode, after the complete tail',()=>{
  for(const runtime of ['core','legacy'])for(const mode of ['high','normal','off']){
    const s=browserScene(runtime),{event,plan}=s.rocket(mode,true);
    const canonical=JSON.stringify(s.owner.endState());
    if(mode==='off'){assert.equal(s.context.GoblinMovement.busy(),false);assert.equal(s.map.querySelector('#goblin-movement-layer'),null);}
    else{
      if(mode==='high'){
        assert.ok(plan.duration>=plan.arrival+3420);
        s.c.advance(plan.arrival+3000);assert.equal(s.context.GoblinMovement.busy(),true);
        const layer=s.map.querySelector('#goblin-movement-layer');assert.ok(layer.children.at(-1).children.length>1,'after-smoke still present');
        s.c.advance(plan.duration-(plan.arrival+3000));
      }else s.c.advance(plan.duration);
      s.c.advance(220);
      assert.equal(s.context.GoblinMovement.busy(),false);assert.equal(s.c.callbacks.size,0);
      assert.equal(s.map.querySelector('#goblin-movement-layer'),null);
    }
    assert.equal(JSON.stringify(s.owner.endState()),canonical);assert.equal(s.owner.events().length,1);
    assert.equal(s.owner.read().wrecks.length,1);assert.equal(event.effects[0].after.hp,0);
  }
});

test('destruction classes retain reference counts; hidden killed cargo gets facts but no fallback image or explosion',()=>{
  const api=globalThis.GoblinFirePresentation;
  for(const [key,size,count,debris]of [['infantry-squad',.7,1,6],['guard-tank',1,2,11],['goblin-siegebreaker',1.3,2,11],['command-core',1.7,3,18]]){
    const value=api.destruction({after:{visualKey:key}});assert.equal(value.size,size);assert.equal(value.detonations,count);assert.equal(value.debris,debris);
  }
  const s=browserScene('legacy'),{plan}=s.rocket('high',true,{passenger:true});
  s.c.advance(plan.arrival+200);
  const layer=s.map.querySelector('#goblin-movement-layer');
  assert.ok(!layer.querySelectorAll('.unit-wreck-artwork').some(image=>image.getAttribute('href').includes('infantry-squad')));
  assert.equal(s.owner.read().wrecks.find(wreck=>wreck.unitId==='crew').cargoRelation.carrierId,'core');
  const stale=[...s.c.callbacks.values()];s.owner.cancel();s.move();stale.forEach(fn=>fn());
  assert.equal(s.context.GoblinMovement.read().active.includes('fire-'),false);
});

test('an old RAF cannot clear the new generation scheduler; overlays never reappear between queued actions',()=>{
  const s=queue();s.q.enqueue(item());const late=[...s.c.callbacks.values()][0];
  s.q.clear();s.q.enqueue(item({id:'new'}));late();s.q.enqueue(item({id:'next'}));
  assert.equal(s.c.callbacks.size,1,'one RAF owner, including after a stale callback');
  s.c.advance(200);assert.equal(s.frames.at(-1).overlayOpacity,0);
  s.q.skip();assert.equal(s.frames.at(-1).overlayOpacity,0,'next serial action keeps overlays out');
  s.q.skip();s.c.advance(100);assert.equal(s.frames.at(-1).overlayOpacity,0);
  s.c.advance(120);assert.equal(s.q.busy(),false);
});

test('rocket mode is frozen until the next action; hiding a tab settles the tail and rejects late frames',()=>{
  const s=browserScene(),{plan}=s.rocket('high',false,{result:'NE'});
  s.context.GoblinPresentationPreferences.read=()=>({schemaVersion:1,mode:'off'});
  s.rocket('off',false,{result:'X'});
  s.c.advance(plan.shotAt+200);
  assert.equal(s.context.GoblinMovement.read().queued,1);
  const ground=s.map.querySelector('#goblin-movement-layer').children[0];assert.ok(ground.children.length>0,'running HIGH retains particles');
  s.c.advance(plan.duration);s.c.advance(220);
  assert.equal(s.context.GoblinMovement.busy(),false);assert.equal(s.owner.endState().units[1].hp,0);
  const next=s.rocket('high',true);s.c.advance(next.plan.arrival+1000);
  const late=[...s.c.callbacks.values()];s.context.document.hidden=true;s.listeners.get('visibilitychange').forEach(fn=>fn());
  assert.equal(s.context.GoblinMovement.busy(),false);assert.equal(s.map.querySelector('#goblin-movement-layer'),null);
  s.context.document.hidden=false;s.move();late.forEach(fn=>fn());assert.equal(s.c.callbacks.size,1);
  assert.equal(s.context.GoblinMovement.read().active.includes('fire-'),false);
});
