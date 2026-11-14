import assert from 'node:assert/strict';
import test from 'node:test';
import {captureFullRoundEvent,captureRoundEvent,createRoundRecorder} from '../round-view-producer.mjs';
import {createIronDustRoundHost} from '../iron-dust-round-source.mjs';
import {createIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as victory} from './iron-dust-source-victory-trace.v2.mjs';

const cell=x=>({x,y:0});
const entity=(id,x)=>({id,labelKey:id,cell:cell(x)});
const board=(...units)=>({width:12,height:8,defaultTerrain:'open-ground',terrain:[],units});
const own=entity('visible-guard',0);

function fixture(mode='player') {
  const owner={}, authority={session:owner,mode,round:1,side:'player',phase:'movement',ended:false};
  const recorder=createRoundRecorder({session:owner,mode,initialRound:1,readAuthority:()=>authority});
  const add=(...events)=>recorder.accept({roundNumber:authority.round,events});
  const close=()=>{
    authority.round++;authority.side='player';authority.phase='movement';
    recorder.accept({roundNumber:authority.round-1,events:[],boundary:'complete'});
  };
  const end=()=>{
    authority.ended=true;
    recorder.accept({roundNumber:authority.round,events:[],boundary:'terminal-partial'});
  };
  return {recorder,authority,add,close,end};
}

test('hidden rows, alternatives, identities, time and scores cannot shift the player DTO',()=>{
  function replay(secret, score, extraHidden) {
    const f=fixture();
    const phantom=entity(secret,9);
    const hidden={kind:'move',side:'enemy',actor:phantom,elapsed:923};
    for(let n=0;n<extraHidden;n++)f.add(captureFullRoundEvent(hidden,{}));
    const fire={kind:'fire',side:'player',actor:own,target:phantom,result:'D',
      options:[{kind:'fire',target:phantom,score,selected:true}]};
    f.add(captureFullRoundEvent(fire,{before:board(own),after:board(own),
      disclosure:{actor:'before',boardVisible:true}}));
    const later=entity('now-visible',3);
    f.add(captureFullRoundEvent({kind:'fire',side:'enemy',actor:later,target:own,result:'NE'},
      {before:board(own,later),after:board(own,later),disclosure:{actor:'before',target:'after',resultVisible:true}}));
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
  f.add(captureFullRoundEvent({kind:'fire',side:'enemy',actor:concealed,target:own,result:'D'},
    {before:board(own),after:board(own),disclosure:{target:'after',resultVisible:true}}));
  const path=[0,1,2,3,4,5].map(cell), phantom=entity('phantom',5);
  f.add(captureFullRoundEvent({kind:'move',side:'enemy',actor:phantom,
    snapshot:{...board(phantom),paths:[{id:'phantom',cells:path}]}},
  {before:board(own),after:board(own,phantom),disclosure:{actor:'after',boardVisible:true,
    visibleSteps:[true,true,false,false,true,true]}}));
  f.add(captureFullRoundEvent({kind:'move',side:'enemy',actor:phantom,
    snapshot:{...board(phantom),paths:[{id:'phantom',cells:path}]}},
  {before:board(own),after:board(own,phantom),disclosure:{actor:'after',boardVisible:true}}));
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
  const notice=(kind)=>captureRoundEvent({kind,side:'player',actor:own},{observable:true,actor:own});
  const root=f.recorder.checkpoint();
  const oldEvent=notice('move');
  f.add(oldEvent);
  const discarded=f.recorder.checkpoint();
  assert.equal(f.recorder.view().latestComplete,null);
  assert.equal(f.recorder.rewind(root),true);
  assert.throws(()=>f.add(oldEvent),/ROUND_EVENT_INVALID/);
  assert.throws(()=>f.add({full:oldEvent.full,public:oldEvent.public}),/ROUND_EVENT_INVALID/);
  f.add(notice('fire'));
  assert.equal(f.recorder.rewind(discarded),false);
  assert.throws(()=>f.recorder.accept({roundNumber:1,boundary:'complete',events:[]}),/ROUND_BOUNDARY_INVALID/);
  f.close();
  const last=f.recorder.view().latestComplete;
  assert.deepEqual(last.rows.map(row=>row.kind),['fire']);
  assert.equal(f.recorder.rewind(root),false);
  f.add(notice('ram'));
  assert.strictEqual(f.recorder.view().latestComplete,last);
  f.authority.mode='spectator';
  assert.equal(f.recorder.view(),null);
  f.authority.mode='player';
  f.authority.session={};
  assert.equal(f.recorder.view(),null);
  assert.throws(()=>f.add(notice('fire')),/ROUND_RECEIPT_STALE/);
  assert.equal(fixture().recorder.view().latestComplete,null);
});

test('full trace requires real terminal or a separately bound spectator session',()=>{
  const secret=entity('private-only',8);
  const row={kind:'fire',side:'enemy',actor:secret,
    options:[{kind:'fire',target:own,selected:true,score:42}]};
  const f=fixture();
  f.add(captureRoundEvent(row));f.close();
  assert.deepEqual(f.recorder.view().latestComplete.rows,[]);
  assert.equal(f.recorder.spectatorCurrent(),null);
  f.add(captureRoundEvent(row));
  assert.throws(()=>f.recorder.accept({roundNumber:2,boundary:'terminal-partial',events:[]}),/ROUND_BOUNDARY_INVALID/);
  f.end();
  const final=f.recorder.view();
  assert.equal(final.trace.length,2);
  assert.equal(final.latestComplete.perspective,'post-mission');
  assert.equal(final.terminalPartial.completion,'terminal-partial');
  assert.equal(final.terminalPartial.rows[0].options[0].score,42);
  const spectator=fixture('spectator');
  spectator.add(captureRoundEvent(row));
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
