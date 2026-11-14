import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustSpectatorMatch,createSpectatorSession} from '../spectator-session.mjs';
import {createIronDustRoundRecorder,captureIronDustRoundCommit} from '../iron-dust-round-source.mjs';
import {createIronDustProfile,dispatchIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as trace} from './iron-dust-source-victory-trace.v2.mjs';

test('spectator pause stops at a native commit and leave invalidates a waiting policy',async()=>{
  let release, scheduled;
  const match = createIronDustSpectatorMatch(batch => new Promise(resolve => {
    release = () => resolve(batch.candidates.find(candidate => candidate.kind === 'move').key);
  }));
  const spectator = createSpectatorSession(match,{
    schedule(callback) { scheduled = callback; return callback; },
    cancel() { scheduled = null; }
  });
  assert.equal(spectator.resume(),true);
  assert.equal(spectator.resume(),false);
  const first = scheduled();
  const startingBoard=spectator.board();
  assert.equal(spectator.pause(),true);
  assert.equal(spectator.status,'pausing');
  release();
  await first;
  assert.equal(spectator.status,'paused');
  assert.notStrictEqual(spectator.board(),startingBoard);
  assert.equal(spectator.resume(),true);
  const second = scheduled();
  spectator.leave();
  release();
  await second;
  assert.equal(spectator.status,'closed');
  assert.equal(spectator.view(),null);
  assert.equal(spectator.board(),null);
  assert.equal(spectator.resume(),false);
  assert.equal(spectator.dispatch,undefined);
});

test('a successful selection publishes one new board to changed; rejection leaves its identity intact',async()=>{
  let queued, candidate;
  const views=[];
  const match=createIronDustSpectatorMatch(batch=>{
    assert.equal(Object.hasOwn(batch,'board'),false);
    assert.equal(batch.view.side,'player');
    if(candidate)return 'invalid';
    candidate=batch.candidates.find(item=>item.kind==='move');
    return candidate.key;
  });
  const viewer=createSpectatorSession(match,{schedule(fn){queued=fn;return fn},changed(){views.push(viewer.board())}});
  const old=viewer.board();
  assert.ok(Object.isFrozen(old.units[0].cell));
  assert.deepEqual(Object.keys(old).sort(),['defaultTerrain','ended','height','phase','roundNumber','side','terrain','units','width']);
  assert.deepEqual(Object.keys(old.units[0]).sort(),['cell','id','labelKey']);
  viewer.resume();await queued();
  assert.deepEqual(views.at(-1).units.find(u=>u.id===candidate.actorId).cell,{x:candidate.target.x,y:candidate.target.y});
  assert.equal(viewer.view().latestComplete,null);
  const committed=viewer.board();
  await queued();
  assert.equal(viewer.status,'failed');
  assert.strictEqual(viewer.board(),committed);
});

test('the live board refreshes at every accepted native action through rollover and terminal',()=>{
  let profile=createIronDustProfile(trace.seed);
  const recorder=createIronDustRoundRecorder(profile,()=>profile,'spectator');
  const player=createIronDustRoundRecorder(profile,()=>profile);
  assert.equal(player.board,undefined);
  let last=recorder.board(), rounds=0;
  for(const command of trace.commands){
    const before=profile, commit=recorder.beginCommit();
    const result=dispatchIronDustProfile(before,command);
    profile=result.profile;
    assert.strictEqual(recorder.board(),last);
    captureIronDustRoundCommit(commit,before,result);
    const board=recorder.board();
    assert.notStrictEqual(board,last);
    if(board.roundNumber!==last.roundNumber)rounds++;
    last=board;
  }
  assert.equal(rounds,2);
  assert.equal(last.ended,true);
  assert.strictEqual(recorder.board(),last);
  profile=null;
  assert.equal(recorder.board(),null);
});
