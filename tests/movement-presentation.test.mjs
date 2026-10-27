import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import movement from '../movement-presentation.js';
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
  for(const file of ['presentation-state.js','unit-visuals.js','assets/unit-art/marker-geometry.js','m1-unit-markers.js','movement-presentation.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
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
  return {context,owner,map,body,c,move,observers,listeners};
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
