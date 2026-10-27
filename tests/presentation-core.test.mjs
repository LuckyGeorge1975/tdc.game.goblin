import test from 'node:test';
import assert from 'node:assert/strict';
import presentation from '../presentation-state.js';
import {createCorePresentationObserver} from '../core-presentation.mjs';
import {createIronDustBrowserSession,dispatchIronDustBrowserAction} from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile,queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {recordIronDustProfileReplay,validateIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';

const move=(unitId,x,y)=>({type:'Move',playerId:'player',unitId,to:{x,y}});
const end={type:'EndPhase',playerId:'player'},enemy={type:'AutoEnemyAdvance',playerId:'enemy'};
function pair(seed=8){
  let control=createIronDustBrowserSession(createIronDustProfile(seed),seed),current=control;
  const owner=presentation.createOwner(),observer=createCorePresentationObserver(owner);
  observer.sync(current);const commands=[];
  function apply(command){
    const before=JSON.stringify(current);
    const baseline=dispatchIronDustBrowserAction(control,command);
    const observed=dispatchIronDustBrowserAction(current,command,observer);
    assert.deepEqual(observed,baseline,'observer cannot alter state/RNG/profile/events/digests');
    if(observed.session){control=baseline.session;current=observed.session;commands.push(command);}
    else assert.equal(JSON.stringify(current),before);
    return observed;
  }
  return {owner,observer,apply,commands,get session(){return current;},
    enemy(){let steps=0;while(current.projection.mode==='enemy'){
      assert.ok(++steps<20);apply(enemy);
    }}};
}

test('accepted Core route is exact and immutable; rejected, query and redraw are event-free',()=>{
  const game=pair(),before=JSON.stringify(game.session);
  const command=move('ogre',3,3);
  const query=queryIronDustProfile(game.session.profile,command);
  assert.equal(query.available,true);
  assert.equal(game.owner.events().length,0);
  game.apply(move('ogre',11,0));assert.equal(game.owner.events().length,0);
  assert.equal(JSON.stringify(game.session),before);
  game.apply(command);
  const event=game.owner.events()[0].event;
  assert.deepEqual(event.path,game.session.projection.events[0].path);
  assert.deepEqual(event.path,query.path);
  assert.equal(event.path.length>1,true);
  assert.equal(new Set(event.path.map((cell,index)=>{
    const prev=index?event.path[index-1]:event.actor.positionBefore;
    return presentation.direction(prev,cell).toFixed(4);
  })).size>1,true,'route turns rather than using a direct endpoint segment');
  assert.equal(Object.isFrozen(event.before.units),true);
  for(let i=0;i<3;i++)game.observer.sync(game.session);
  assert.equal(game.owner.events().length,1);
  game.apply(command);assert.equal(game.owner.events().length,1,'spent move rejected');
  assert.deepEqual(game.owner.endState(),game.session.projection.state.units?{
    ...game.session.projection.state,units:game.session.projection.state.units.map(u=>({...u,visualKey:null}))
  }:null);
});

test('terrain-cost movement retains authoritative steps rather than inventing cost-length travel',()=>{
  const game=pair(),command=move('ogre',0,3);
  const query=queryIronDustProfile(game.session.profile,command);
  assert.equal(query.available,true);assert.equal(query.cost,3);assert.equal(query.path.length,2);
  game.apply(command);
  assert.deepEqual(game.owner.events()[0].event.path,query.path);
});

test('automatic enemy movement retains result order, cursor and already-resolved subcommand',()=>{
  const game=pair();
  for(let i=0;i<3;i++)game.apply(end);
  game.enemy();
  const events=game.owner.events().map(item=>item.event);
  const moves=events.filter(event=>event.actor.team==='enemy');
  assert.ok(moves.length>0);
  for(const event of moves){
    assert.equal(event.action.sourceCommand.type,'AutoEnemyAdvance');
    assert.equal(event.action.resolvedCommand.type,'EnemyMove');
    assert.ok(event.action.sourceCursor);
    assert.deepEqual(event.path,event.sourceResults[event.sourceEventIndex].path);
  }
  assert.equal(new Set(events.map(e=>e.eventId)).size,events.length);
  const replay=recordIronDustProfileReplay(8,game.commands);
  assert.deepEqual(validateIronDustProfileReplay(replay),replay);
  assert.equal(JSON.stringify(replay).includes('presentation-'),false);
});

test('real Core Ram keeps the accepted path and destroyed target in immutable after-state',()=>{
  const game=pair(1);
  for(const x of [3,6]){
    game.apply(move('ogre',x,2));for(let i=0;i<3;i++)game.apply(end);game.enemy();
  }
  const result=game.apply({type:'Ram',playerId:'player',unitId:'ogre',targetId:'guard'});
  assert.ok(result.session);
  const event=game.owner.events().at(-1).event;
  assert.equal(event.kind,'ram');
  assert.deepEqual(event.path,result.session.projection.events[0].path);
  assert.equal(event.after.units.find(u=>u.id==='guard').hp,0);
  assert.equal(event.before.units.find(u=>u.id==='guard').hp>0,true);
  assert.deepEqual(event.effects,[],'no invented fire/damage effects');
  const wreck=game.owner.read().wrecks.find(wreck=>wreck.unitId==='guard');
  assert.ok(wreck);assert.equal(wreck.destructionRef.source,'accepted-command');
  assert.equal(wreck.facingDegrees,game.owner.read().facingByUnit.find(unit=>unit.unitId==='guard').angleDegrees);
});

test('actual Core fire projects wrecks exactly for authoritative HP0 without changing canonical events',()=>{
  const game=pair(1);
  game.apply(move('missile',4,6));for(let i=0;i<3;i++)game.apply(end);game.enemy();
  game.apply(move('missile',4,5));game.apply(end);
  const result=game.apply({type:'PlayerFire',playerId:'player',unitId:'missile',targetId:'guard'});
  assert.equal(result.session.projection.events[0].type,'PlayerFireResolved');
  const dead=game.session.projection.state.units.filter(unit=>unit.hp<=0).map(unit=>unit.id).sort();
  assert.deepEqual(game.owner.read().wrecks.map(w=>w.unitId).sort(),dead);
  const fire=game.owner.events().at(-1).event;
  assert.equal(fire.kind,'fire');assert.equal(fire.targetId,'guard');
  assert.deepEqual(fire.effects[0].after,fire.after.units.find(unit=>unit.id==='guard'));
  assert.equal(fire.weapon.usedWeaponKey,null);
});

test('observer errors never retry or block an otherwise accepted gameplay action',()=>{
  const session=createIronDustBrowserSession();
  const expected=dispatchIronDustBrowserAction(session,move('ogre',4,5));
  const actual=dispatchIronDustBrowserAction(session,move('ogre',4,5),{
    begin(){throw Error('capture failure');},confirm(){throw Error('capture failure');}
  });
  assert.deepEqual(actual,expected);
});

test('actual Core system weapon fire preserves used key, confirmed effects and replay through enemy responses',()=>{
  const game=pair(1);game.apply(move('ogre',3,2));for(let i=0;i<3;i++)game.apply(end);game.enemy();
  game.apply(move('ogre',6,2));game.apply(end);
  const command=game.session.projection.state.units.filter(unit=>unit.team==='enemy').map(target=>({
    type:'PlayerFire',playerId:'player',unitId:'ogre',targetId:target.id,weaponKey:'main'}))
    .find(command=>queryIronDustProfile(game.session.profile,command).available);
  assert.ok(command);game.apply(command);
  const fire=game.owner.events().at(-1).event;assert.equal(fire.kind,'fire');assert.equal(fire.weapon.usedWeaponKey,'main');
  assert.equal(fire.weapon.attack,fire.before.units.find(unit=>unit.id==='ogre').ogreSystems.weapons.main.attack);
  assert.equal(fire.effects.length,1);assert.equal(fire.effects[0].result,fire.sourceResults[0].result);
  game.apply(end);game.apply(end);game.enemy();
  for(const {event}of game.owner.events().filter(item=>item.event.kind==='fire')){
    assert.equal(Object.isFrozen(event.effects[0].before),true);
    assert.deepEqual(event.effects[0].after,event.after.units.find(unit=>unit.id===event.targetId));
    if(event.sourceResults[0].type==='EnemySystemFireResolved'){
      assert.equal(event.weapon.usedWeaponKey,null);assert.equal(event.effects[0].targetKey,event.sourceResults[0].targetKey);
    }
  }
  assert.deepEqual(validateIronDustProfileReplay(recordIronDustProfileReplay(1,game.commands)),recordIronDustProfileReplay(1,game.commands));
});
