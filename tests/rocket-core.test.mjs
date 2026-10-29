import test from 'node:test';
import assert from 'node:assert/strict';
import '../unit-visuals.js';
import '../fire-anchors.js';
import '../wreck-klassen.js';
import '../fire-presentation.js';
import presentation from '../presentation-state.js';
import movement from '../movement-presentation.js';
import {createCorePresentationObserver} from '../core-presentation.mjs';
import {createIronDustBrowserSession,dispatchIronDustBrowserAction} from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {recordIronDustProfileReplay,validateIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';

test('actual Core rocket command keeps state/RNG/replay identical through all modes, final impact, natural end and skip',()=>{
  const finals=[];
  for(const mode of ['high','normal','off']){
    globalThis.GoblinPresentationPreferences={read:()=>({schemaVersion:1,mode})};
    let current=createIronDustBrowserSession(createIronDustProfile(1),1),control=current,time=0,id=0;
    const owner=presentation.createOwner(),observer=createCorePresentationObserver(owner),callbacks=new Map(),frames=[],commands=[],tickets=new WeakMap();
    const q=movement.createQueue({now:()=>time,request:fn=>{callbacks.set(++id,fn);return id;},cancel:id=>callbacks.delete(id),
      render:frame=>frames.push(frame),finish(){}});
    const advance=ms=>{time+=ms;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn());};
    owner.subscribe((type,value)=>{
      if(type==='cancel')q.clear();if(type==='begin')tickets.set(value.ticket,value.sidecar);
      if(type==='confirm'){
        if(!value.events.length)q.enqueue(value);
        for(const event of value.events)q.enqueue({...value,event,beforeSidecar:tickets.get(value.ticket)});
      }
    });
    observer.sync(current);
    const apply=command=>{
      const baseline=dispatchIronDustBrowserAction(control,command),observed=dispatchIronDustBrowserAction(current,command,observer);
      assert.deepEqual(observed,baseline);assert.ok(observed.session,JSON.stringify(observed.error));
      control=baseline.session;current=observed.session;commands.push(command);
    };
    const move=(x,y)=>apply({type:'Move',playerId:'player',unitId:'missile',to:{x,y}});
    const end=()=>apply({type:'EndPhase',playerId:'player'});
    move(4,6);for(let i=0;i<3;i++)end();
    let steps=0;while(current.projection.mode==='enemy'){assert.ok(steps++<20);apply({type:'AutoEnemyAdvance',playerId:'enemy'});}
    move(4,5);end();apply({type:'PlayerFire',playerId:'player',unitId:'missile',targetId:'guard'});
    const event=owner.events().at(-1).event,plan=globalThis.GoblinFirePresentation.plan(event,0);
    assert.equal(event.actor.visualKey,'rocket-artillery');assert.equal(plan.rockets.length,3);assert.equal(event.effects.length,1);
    const canonical=JSON.stringify(current);
    const savedRandom=Math.random;
    Math.random=()=>{throw new Error('visual queue must never use gameplay Math.random');};
    try{
      if(mode==='off'){assert.equal(frames.length,0);assert.equal(q.busy(),false);}
      else{
        let skipped=0;while(q.read().active!==event.eventId){assert.ok(skipped++<30);assert.equal(q.skip(),true);}
        advance(plan.arrival-1);assert.equal(frames.at(-1).state.units.find(unit=>unit.id==='guard').hp,event.effects[0].before.hp);
        advance(52);assert.deepEqual(frames.at(-1).state.units.find(unit=>unit.id==='guard'),event.effects[0].after);
        if(mode==='high')q.skip();else advance(plan.duration);
        advance(220);assert.equal(q.busy(),false);assert.equal(callbacks.size,0);
      }
    }finally{Math.random=savedRandom;}
    assert.equal(JSON.stringify(current),canonical);finals.push(canonical);
    const replay=recordIronDustProfileReplay(1,commands);assert.deepEqual(validateIronDustProfileReplay(replay),replay);
  }
  assert.equal(finals[0],finals[1]);assert.equal(finals[1],finals[2]);delete globalThis.GoblinPresentationPreferences;
});
