import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustSpectatorMatch,createSpectatorSession} from '../spectator-session.mjs';
import {IRON_DUST_COMMIT_REPLAY_VERSION,createIronDustCommitRecorder,playIronDustProfileReplay}
  from '../src/core/iron-dust-profile-replay.mjs';
import {createIronDustProfile,dispatchIronDustProfile,dispatchIronDustProfileEnemyFireChoice,
  projectIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as trace} from './iron-dust-source-victory-trace.v2.mjs';

test('the accepted sequence holds and retreats, captures AutoEnemyAdvance once and plays with no policy',async()=>{
  let calls=0, allow=false;
  const match=createIronDustSpectatorMatch(batch=>{
    if(!allow)return 'invalid';
    calls++;
    if(calls<=3)return batch.candidates.find(c=>c.kind==='end-phase').key;
    if(calls===4)return batch.candidates.find(c=>c.kind==='hold').key;
    if(calls===5)return batch.candidates.find(c=>c.kind==='move'&&c.target.x===10&&c.target.y===5).key;
    return batch.candidates.find(c=>c.facts.automatic).key;
  },{recordReplay:true});
  assert.equal((await match.advance()).ok,false);
  assert.deepEqual(match.replay().commands,[]);
  allow=true;
  for(let i=0;i<8;i++)assert.deepEqual(await match.advance(),{ok:true});
  const snapshot=match.replay();
  assert.equal(snapshot.replayVersion,IRON_DUST_COMMIT_REPLAY_VERSION);
  assert.deepEqual(snapshot.commands.map(command=>command.type),
    ['EndPhase','EndPhase','EndPhase','EnemyHold','EnemyMove',...Array(3).fill('AutoEnemyAdvance')]);
  assert.equal(snapshot.checkpoints.length,calls);
  assert.ok(Object.isFrozen(snapshot.commands[4].to));
  const encoded=JSON.stringify(snapshot);
  const playback=playIronDustProfileReplay(JSON.parse(encoded));
  assert.deepEqual(playIronDustProfileReplay(JSON.parse(encoded)),playback);
  assert.equal(calls,8);
  assert.deepEqual(playback.checkpoints,snapshot.checkpoints);
  assert.equal(playback.steps[3].events[0].type,'EnemyHeld');
  assert.deepEqual(playback.steps[4].events[0].to,{x:10,y:5});
  assert.equal(playback.finalState.state.turn,2);
  assert.equal(playback.finalState.state.rng.state,snapshot.checkpoints.at(-1).rngState);
  assert.throws(()=>playIronDustProfileReplay({...snapshot,replayVersion:'iron-dust-profile-replay-v1'}),
    {code:'IRON_DUST_REPLAY_MISMATCH'});
  match.stop();assert.equal(match.replay(),null);
});

test('the recorder binds root actions, state, events and RNG through actual component fire and the round transition',()=>{
  let profile=createIronDustProfile(trace.seed);
  const recorder=createIronDustCommitRecorder(profile), recorded=[];
  trace.commands.slice(0,18).forEach((original,index)=>{
    const before=profile;
    const action=index===13?{type:'EnemySystemAttack',playerId:'enemy',attackerId:'guard',targetId:'ogre',targetKey:'treads'}:original;
    const dispatch=index===13?dispatchIronDustProfileEnemyFireChoice:dispatchIronDustProfile;
    const result=dispatch(before,action);
    assert.ok(result.profile);
    profile=result.profile;
    recorder.accept(before,{action,...result});
    assert.throws(()=>recorder.accept(before,{action,...result}),{code:'IRON_DUST_REPLAY_RECEIPT_INVALID'});
    recorded.push({action,events:result.events,state:projectIronDustProfile(profile)});
  });
  const snapshot=recorder.snapshot(), playback=playIronDustProfileReplay(snapshot);
  assert.deepEqual(playback.steps.map(({command,events,state})=>({action:command,events,state})),recorded);
  assert.equal(playback.steps[13].events[0].targetKey,'treads');
  const tampered=structuredClone(snapshot);
  tampered.checkpoints[13].rngState++;
  assert.throws(()=>playIronDustProfileReplay(tampered),{code:'IRON_DUST_REPLAY_MISMATCH'});
});

test('leave drops a pending choice and the viewer surface has no replay access',async()=>{
  let answer, queued;
  const match=createIronDustSpectatorMatch(batch=>new Promise(resolve=>{
    answer=()=>resolve(batch.candidates[0].key);
  }),{recordReplay:true});
  const viewer=createSpectatorSession(match,{schedule(fn){queued=fn;return fn},cancel(){}});
  assert.equal(viewer.replay,undefined);
  viewer.resume();
  const pending=queued();
  assert.deepEqual(match.replay().commands,[]);
  viewer.leave();answer();await pending;
  assert.equal(match.replay(),null);
  assert.equal(viewer.status,'closed');
});

test('only literal true opts the private match owner into recording',()=>{
  const select=()=>{};
  for(const options of [undefined,{},...[undefined,false,'false',1,{},[],null,'true'].map(recordReplay=>({recordReplay}))]){
    const match=createIronDustSpectatorMatch(select,options);
    assert.equal(Object.hasOwn(match,'replay'),false);
    match.stop();
  }
  const match=createIronDustSpectatorMatch(select,{recordReplay:true});
  assert.deepEqual(match.replay().commands,[]);
  match.stop();
});
