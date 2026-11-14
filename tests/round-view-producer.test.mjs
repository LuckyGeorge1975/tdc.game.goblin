import assert from 'node:assert/strict';
import test from 'node:test';
import {createRoundRecorder} from '../round-view-producer.mjs';
import {createIronDustRoundHost} from '../iron-dust-round-source.mjs';
import {createIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from './iron-dust-source-victory-trace.v2.mjs';

const cell=x=>({x,y:0});
const entity=(id,x)=>({id,labelKey:id,cell:cell(x)});
const board=(...units)=>({width:12,height:8,defaultTerrain:'open-ground',terrain:[],units});
const own=entity('visible-guard',0);

function fixture(mode='player', owner={}) {
  const authority={session:owner,mode,round:1,side:'player',phase:'movement',ended:false};
  const recorder=createRoundRecorder({session:owner,mode,initialRound:1,readAuthority:()=>authority});
  const begin=()=>{
    const batch=recorder.beginCommit(), roundNumber=authority.round;
    return {...batch,add:(...events)=>batch.accept({roundNumber,events})};
  };
  const capture=(...args)=>{const batch=begin();batch.add(batch.captureRoundEvent(...args))};
  const captureFull=(...args)=>{const batch=begin();batch.add(batch.captureFullRoundEvent(...args))};
  const close=()=>{
    const batch=begin();
    authority.round++;authority.side='player';authority.phase='movement';
    batch.accept({roundNumber:authority.round-1,events:[],boundary:'complete'});
  };
  const end=()=>{
    const batch=begin();
    authority.ended=true;
    batch.accept({roundNumber:authority.round,events:[],boundary:'terminal-partial'});
  };
  return {recorder,authority,begin,capture,captureFull,close,end};
}

test('hidden rows, alternatives, identities, time and scores cannot shift the player DTO',()=>{
  function replay(secret, score, extraHidden) {
    const f=fixture();
    const phantom=entity(secret,9);
    const hidden={kind:'move',side:'enemy',actor:phantom,elapsed:923};
    for(let n=0;n<extraHidden;n++)f.captureFull(hidden,{});
    const fire={kind:'fire',side:'player',actor:own,target:phantom,result:'D',
      options:[{kind:'fire',target:phantom,score,selected:true}]};
    f.captureFull(fire,{before:board(own),after:board(own),
      disclosure:{actor:'before',boardVisible:true}});
    const later=entity('now-visible',3);
    f.captureFull({kind:'fire',side:'enemy',actor:later,target:own,result:'NE'},
      {before:board(own,later),after:board(own,later),disclosure:{actor:'before',target:'after',resultVisible:true}});
    f.close();
    return f.recorder.view();
  }
  const first=replay('phantom-a',1,1), second=replay('phantom-b',999,5);
  assert.deepEqual(first,second);
  assert.equal(first.latestComplete.rows.length,2);
  assert.equal(first.latestComplete.rows[0].target,undefined);
  assert.equal(first.latestComplete.rows[0].resultKey,undefined);
  assert.equal(first.latestComplete.rows[0].options,undefined);
  assert.equal(first.trace,undefined);
  assert.ok(Object.isFrozen(first.latestComplete.rows));
});

test('authorized effect excludes hidden source; reveal admits only released steps',()=>{
  const f=fixture(), concealed=entity('old-position',10);
  f.captureFull({kind:'fire',side:'enemy',actor:concealed,target:own,result:'D'},
    {before:board(own),after:board(own),disclosure:{target:'after',resultVisible:true}});
  const path=[0,1,2,3,4,5].map(cell), phantom=entity('phantom',5);
  f.captureFull({kind:'move',side:'enemy',actor:phantom,
    snapshot:{...board(phantom),paths:[{id:'phantom',cells:path}]}},
  {before:board(own),after:board(own,phantom),disclosure:{actor:'after',boardVisible:true,
    visibleSteps:[true,true,false,false,true,true]}});
  f.captureFull({kind:'move',side:'enemy',actor:phantom,
    snapshot:{...board(phantom),paths:[{id:'phantom',cells:path}]}},
  {before:board(own),after:board(own,phantom),disclosure:{actor:'after',boardVisible:true}});
  f.close();
  const [effect,reveal,unknownPath]=f.recorder.view().latestComplete.rows;
  assert.equal(effect.kind,'observed-effect');
  assert.equal(effect.actor,undefined);
  assert.equal(effect.resultKey,'D');
  assert.deepEqual(reveal.snapshot.visiblePathSegments.map(s=>s.cells),[[cell(0),cell(1)],[cell(4),cell(5)]]);
  assert.deepEqual(unknownPath.snapshot.visiblePathSegments,[]);
  assert.notEqual(reveal.actor.token,unknownPath.actor.token);
});

test('round seal, undo branch and replacement session protect captured history',()=>{
  const f=fixture();
  const notice=(kind)=>f.capture({kind,side:'player',actor:own},{observable:true,actor:own});
  const root=f.recorder.checkpoint();
  notice('move');
  const discarded=f.recorder.checkpoint();
  assert.equal(f.recorder.view().latestComplete,null);
  assert.equal(f.recorder.rewind(root),true);
  assert.throws(()=>f.begin().add({}),/ROUND_EVENT_INVALID/);
  notice('fire');
  assert.equal(f.recorder.rewind(discarded),false);
  assert.throws(()=>f.begin().accept({roundNumber:1,boundary:'complete',events:[]}),/ROUND_BOUNDARY_INVALID/);
  f.close();
  const last=f.recorder.view().latestComplete;
  assert.deepEqual(last.rows.map(row=>row.kind),['fire']);
  assert.equal(f.recorder.rewind(root),false);
  notice('ram');
  assert.strictEqual(f.recorder.view().latestComplete,last);
  f.authority.mode='spectator';
  assert.equal(f.recorder.view(),null);
  f.authority.mode='player';
  f.authority.session={};
  assert.equal(f.recorder.view(),null);
  assert.throws(()=>notice('fire'),/ROUND_RECEIPT_STALE/);
  assert.equal(fixture().recorder.view().latestComplete,null);
});

test('capture belongs only to its issuing commit in its recorder and session',()=>{
  const owner={}, a=fixture('spectator',owner);
  const sameSession=fixture('spectator',owner), replacement=fixture('spectator');
  const batch=a.begin();
  const captured=batch.captureFullRoundEvent({kind:'fire',side:'enemy',actor:own},{});
  assert.deepEqual(captured,{});
  assert.ok(Object.isFrozen(captured));
  for (const other of [a,sameSession,replacement]) {
    const wrong=other.begin();
    assert.throws(()=>wrong.add(captured),/ROUND_EVENT_INVALID/);
    assert.deepEqual(other.recorder.spectatorCurrent().rows,[]);
  }
  assert.throws(()=>batch.add(captured,captured),/ROUND_EVENT_INVALID/);
  batch.add(captured);
  assert.throws(()=>batch.add(captured),/ROUND_RECEIPT_STALE/);
  assert.throws(()=>replacement.begin().add(captured),/ROUND_EVENT_INVALID/);
  const pending=a.begin(), oldSession=pending.captureRoundEvent({kind:'phase',side:'enemy'});
  a.authority.session={};
  assert.throws(()=>pending.add(oldSession),/ROUND_RECEIPT_STALE/);
});

test('rewind revokes unused captures even when their parent becomes current again',()=>{
  const f=fixture('spectator'), row={kind:'move',side:'enemy',actor:own};
  const root=f.recorder.checkpoint(), original=f.begin();
  const old=original.captureRoundEvent(row);
  f.capture(row);
  assert.throws(()=>original.add(old),/ROUND_RECEIPT_STALE/);
  const branch=f.begin(), discarded=branch.captureRoundEvent(row);
  assert.equal(f.recorder.rewind(root),true);
  assert.throws(()=>original.add(old),/ROUND_RECEIPT_STALE/);
  assert.throws(()=>branch.add(discarded),/ROUND_RECEIPT_STALE/);
  const next=f.begin();
  const fresh=next.captureRoundEvent({kind:'fire',side:'enemy'});
  assert.throws(()=>next.add(fresh,discarded),/ROUND_EVENT_INVALID/);
  assert.deepEqual(f.recorder.spectatorCurrent().rows,[]);
  next.add(fresh);
  const oldRound=f.begin(), unused=oldRound.captureRoundEvent(row);
  f.close();
  assert.throws(()=>oldRound.add(unused),/ROUND_RECEIPT_STALE/);
  assert.deepEqual(f.recorder.view().latestComplete.rows.map(row=>row.kind),['fire']);
});

test('full trace requires real terminal or a separately bound spectator session',()=>{
  const secret=entity('private-only',8);
  const row={kind:'fire',side:'enemy',actor:secret,
    options:[{kind:'fire',target:own,selected:true,score:42}]};
  const f=fixture();
  f.capture(row);f.close();
  assert.deepEqual(f.recorder.view().latestComplete.rows,[]);
  assert.equal(f.recorder.spectatorCurrent(),null);
  f.capture(row);
  assert.throws(()=>f.begin().accept({roundNumber:2,boundary:'terminal-partial',events:[]}),/ROUND_BOUNDARY_INVALID/);
  f.end();
  const final=f.recorder.view();
  assert.equal(final.trace.length,2);
  assert.equal(final.latestComplete.perspective,'post-mission');
  assert.equal(final.terminalPartial.completion,'terminal-partial');
  assert.equal(final.terminalPartial.rows[0].options[0].score,42);
  const spectator=fixture('spectator');
  spectator.capture(row);
  assert.equal(spectator.recorder.spectatorCurrent().rows[0].options[0].score,42);
  spectator.close();
  assert.equal(spectator.recorder.view().latestComplete.rows[0].actor.labelKey,'private-only');
  assert.equal(spectator.recorder.view().latestComplete.perspective,'spectator');
});

test('real Iron Dust Seed 8 uses native enemy-end and terminal profile receipts',()=>{
  const host=createIronDustRoundHost(createIronDustProfile(victory.seed));
  let previous=null, transitions=0;
  for(const [index,command] of victory.commands.entries()) {
    const result=host.dispatch(command);
    assert.ok(result.profile);
    assert.deepEqual(result.events,victory.steps[index].events);
    const view=host.view();
    const boundary=result.events.some(e=>e.type==='PhaseChanged'&&e.from==='enemy'&&e.to==='movement');
    if(boundary)transitions++;
    if(!boundary&&result.profile.entry.mode!=='ended')assert.equal(view.latestComplete,previous);
    previous=view.latestComplete;
  }
  assert.equal(transitions,2);
  assert.equal(host.view().latestComplete.roundNumber,2);
  assert.equal(host.view().terminalPartial.roundNumber,3);
  assert.ok(host.view().terminalPartial.rows.some(row=>row.kind==='fire'&&row.target?.labelKey==='v2.unit.core'));
  for(const record of host.view().trace)assert.ok(!JSON.stringify(record).includes('fnv1a64'));
});
