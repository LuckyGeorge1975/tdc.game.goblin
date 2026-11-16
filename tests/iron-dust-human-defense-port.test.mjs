import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustHumanDefensePort} from '../src/core/iron-dust-human-defense-port.mjs';
import {createIronDustBrowserSession,dispatchIronDustBrowserAction} from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile,dispatchIronDustProfile,projectIronDustProfile}
  from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder,playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from './iron-dust-source-victory-trace.v2.mjs';
import {IRON_DUST_SOURCE_DEFEAT_TRACE_V2 as defeat} from './iron-dust-source-defeat-trace.v2.mjs';

const automatic = {type:'AutoEnemyAdvance',playerId:'enemy'};
const rng = profile=>projectIronDustProfile(profile).state.rng.state;

function owner(commands,seed=victory.seed) {
  const start=createIronDustProfile(seed), replay=createIronDustCommitRecorder(start);
  let session=createIronDustBrowserSession(start,seed);
  for (const action of commands) {
    const result=dispatchIronDustBrowserAction(session,action);
    assert.ok(result.session);
    replay.accept(session.profile,{action,profile:result.session.profile,events:result.session.projection.events});
    session=result.session;
  }
  const context={session,epoch:1,
    defenderIsHuman:true,defenderSeat:Object.freeze({})};
  const receipts=[];
  const port=createIronDustHumanDefensePort({read:()=>context,install(before,result) {
    assert.equal(before,context.session);
    replay.accept(before.profile,result);
    receipts.push(result);
    context.session={...before,profile:result.profile,projection:projectIronDustProfile(result.profile,result.events)};
  }});
  return {context,port,replay,receipts};
}

test('the authorized seat receives its stable side projection and commits a single baseline move explicitly',()=>{
  const {context,port,replay,receipts}=owner(victory.commands.slice(0,4));
  const seat=context.defenderSeat, before=context.session.profile;
  assert.equal(port.suppressesAutomaticDefense,true);
  assert.equal(port.open(Object.freeze({})).code,'IRON_DUST_DEFENDER_NOT_AUTHORIZED');
  const offer=port.open(seat);
  assert.equal(port.open(seat),offer);
  assert.equal(offer.view.units.find(unit=>unit.id==='guard').relation,'own');
  assert.equal(offer.view.units.find(unit=>unit.id==='ogre').relation,'opponent');
  assert.doesNotMatch(JSON.stringify(offer),/"(?:baseline|command|profile|rng|digest|seed)"/);
  const expected=dispatchIronDustProfile(before,automatic);
  const moved=expected.events.find(event=>event.type==='EnemyMoved');
  const candidate=offer.candidates.find(item=>item.kind==='move'&&
    item.target.x===moved.to.x&&item.target.y===moved.to.y);
  assert.equal(port.advanceMechanical(seat,offer.ticket).code,'IRON_DUST_DEFENDER_WRONG_STEP');
  assert.equal(port.commit(seat,offer.ticket,'forged').code,'AI_UNKNOWN_CANDIDATE');
  assert.deepEqual(port.commit(seat,offer.ticket,candidate.key),{ok:true});
  assert.equal(receipts[0].action.type,'EnemyMove');
  assert.deepEqual(receipts[0].profile,expected.profile);
  assert.equal(rng(before),rng(receipts[0].profile));
  assert.equal(port.commit(seat,offer.ticket,candidate.key).code,'IRON_DUST_DEFENDER_STALE');
  assert.notEqual(port.open(seat).ticket,offer.ticket);
  const envelope=replay.snapshot();
  assert.deepEqual(playIronDustProfileReplay(envelope).checkpoints,envelope.checkpoints);
});

test('hold, component fire and unit fire use native commands and replay checkpoints',()=>{
  const unitIndex=defeat.steps.findIndex(step=>step.events.some(event=>event.type==='EnemyUnitFireResolved'));
  const unitPrefix=defeat.steps.slice(0,unitIndex).map(step=>
    step.command==='E'?automatic:{type:'EndPhase',playerId:'player'});
  const cases=[
    {prefix:victory.commands.slice(0,4),seed:victory.seed,select:item=>item.kind==='hold',
      action:'EnemyHold',event:'EnemyHeld',fire:false},
    {prefix:victory.commands.slice(0,13),seed:victory.seed,select:item=>item.target?.componentId==='treads',
      action:'EnemySystemAttack',event:'EnemySystemFireResolved',fire:true},
    {prefix:unitPrefix,seed:defeat.seed,select:item=>item.kind==='fire'&&item.target?.kind==='unit',
      action:'EnemyUnitAttack',event:'EnemyUnitFireResolved',fire:true}
  ];
  for (const entry of cases) {
    const {context,port,replay,receipts}=owner(entry.prefix,entry.seed);
    const seat=context.defenderSeat, before=rng(context.session.profile);
    const offer=port.open(seat);
    const choice=offer.candidates.find(entry.select);
    assert.ok(choice);
    assert.ok(port.commit(seat,offer.ticket,choice.key).ok);
    const [result]=receipts;
    assert.equal(result.action.type,entry.action);
    assert.ok(result.events.some(event=>event.type===entry.event));
    assert.equal(rng(result.profile),entry.fire?(Math.imul(1664525,before)+1013904223)>>>0:before);
    const envelope=replay.snapshot();
    assert.deepEqual(playIronDustProfileReplay(envelope).checkpoints,envelope.checkpoints);
  }
});

test('a pending handoff suppresses automation, restart and replacement seats revoke old tickets',()=>{
  const {context,port,receipts}=owner(victory.commands.slice(0,4));
  const seat=context.defenderSeat;
  const {ticket,candidates:[candidate]}=port.open(seat);
  context.defenderSeat=null;
  assert.equal(port.suppressesAutomaticDefense,true);
  assert.equal(port.commit(seat,ticket,candidate.key).code,'IRON_DUST_DEFENDER_NOT_AUTHORIZED');
  const newSeat=context.defenderSeat=Object.freeze({});
  assert.equal(port.commit(newSeat,ticket,candidate.key).code,'IRON_DUST_DEFENDER_STALE');
  const newOffer=port.open(newSeat);
  const before=context.session;
  context.epoch++;
  assert.equal(port.commit(newSeat,newOffer.ticket,newOffer.candidates[0].key).code,'IRON_DUST_DEFENDER_STALE');
  assert.equal(context.session,before);
  assert.equal(receipts.length,0);
  context.session=createIronDustBrowserSession();
  assert.equal(port.suppressesAutomaticDefense,false);
  assert.equal(port.open(newSeat).code,'IRON_DUST_DEFENDER_NOT_AUTHORIZED');
  context.session=before;
  context.defenderIsHuman=false;
  assert.equal(port.suppressesAutomaticDefense,false);
  assert.equal(port.open(newSeat).code,'IRON_DUST_DEFENDER_NOT_AUTHORIZED');
});

test('only mandatory cursor steps can be advanced mechanically and the finish hands back to the attacker',()=>{
  const first=owner(victory.commands.slice(0,4));
  const {context,port,replay,receipts}=first;
  const seat=context.defenderSeat;
  let mechanical=0;
  for (let step=0;port.suppressesAutomaticDefense&&step<8;step++) {
    const offer=port.open(seat);
    if (offer.kind==='mechanical') {
      assert.deepEqual(offer.candidates,[]);
      assert.equal(port.commit(seat,offer.ticket,'anything').code,'IRON_DUST_DEFENDER_WRONG_STEP');
      assert.ok(port.advanceMechanical(seat,offer.ticket).ok);
      assert.equal(receipts.at(-1).action.type,'AutoEnemyAdvance');
      mechanical++;
    } else {
      const chosen=offer.candidates.find(candidate=>candidate.kind==='hold')??offer.candidates[0];
      assert.ok(port.commit(seat,offer.ticket,chosen.key).ok);
    }
  }
  assert.ok(mechanical>0);
  assert.equal(context.session.projection.mode,'player');
  assert.ok(receipts.at(-1).events.some(event=>event.type==='PhaseChanged'&&event.side==='player'));
  assert.equal(port.open(seat).code,'IRON_DUST_DEFENDER_NOT_AUTHORIZED');
  const envelope=replay.snapshot();
  assert.deepEqual(playIronDustProfileReplay(envelope).checkpoints,envelope.checkpoints);
});
