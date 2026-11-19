import assert from 'node:assert/strict';
import test from 'node:test';
import {createPlayerController} from '../src/core/game-manager.mjs';
import {createIronDustAiAdapter} from '../src/core/iron-dust-ai-adapter.mjs';
import {selectMediumIronDustAttack} from '../src/core/iron-dust-attack-difficulty.mjs';
import {selectWeakIronDustAttack} from '../src/core/iron-dust-weak-policy.mjs';
import {choosePlayerAction} from '../src/core/iron-dust-objective-policy.mjs';
import {createIronDustProfile,dispatchIronDustProfile,queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder,playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {hexDistance} from '../src/core/hex.mjs';

const stateOf=profile=>profile.entry.mode==='enemy'?profile.entry.payload.state:profile.entry.payload;
const automatic={type:'AutoEnemyAdvance',playerId:'enemy'};
function reference(profile) {
  return choosePlayerAction({state:stateOf(profile),hexDistance,
    query:command=>queryIronDustProfile(profile,command),
    queryWithWeapon(select,fire) {
      const permitted=queryIronDustProfile(profile,select);
      if(!permitted.available) return permitted;
      const next=dispatchIronDustProfile(profile,select);
      return next.profile?queryIronDustProfile(next.profile,fire):{available:false,error:next.error};
    }
  }).command;
}
const request=(batch,key)=>({schemaVersion:batch.schemaVersion,decisionId:batch.decisionId,revision:batch.revision,key});

test('Medium and Weak select different real legal commands at the initial Iron Dust position',()=>{
  const profile=createIronDustProfile(8);
  const adapter=createIronDustAiAdapter(()=>({state:profile,generation:1}),{weakAttack:true,objectiveAttack:true});
  const initial=JSON.stringify(profile);
  const batch=adapter.open('player');
  assert.equal(JSON.stringify(profile),initial);
  const medium=selectMediumIronDustAttack(batch);
  const weak=selectWeakIronDustAttack(batch);
  assert.ok(medium&&weak);
  assert.notEqual(medium,weak);
  assert.equal(selectMediumIronDustAttack({...batch,side:'enemy'}),undefined);
  assert.equal(adapter.open('enemy').code,'NOT_ACTIVE_TEAM');
});

for(const seed of [8,19]) test('Medium follows the established objective rule through a complete native game, seed '+seed,()=>{
  let profile=createIronDustProfile(seed);
  const recorder=createIronDustCommitRecorder(profile);
  const adapter=createIronDustAiAdapter(()=>({state:profile,generation:1}),{objectiveAttack:true});
  let plans=0,playerSteps=0,enemySteps=0;
  const controller=createPlayerController('player',(batch,report)=>{
    plans++;
    return selectMediumIronDustAttack(batch,report);
  });
  for(let count=0;profile.entry.mode!=='ended'&&count<300;count++) {
    const before=profile;
    let result,action;
    if(stateOf(profile).activeTeam==='enemy') {
      action=automatic;
      result=dispatchIronDustProfile(profile,action);
      assert.equal(controller.nextCommand({side:'enemy',view:{side:'enemy'}}),undefined);
      enemySteps++;
    } else {
      const expected=reference(profile);
      const initial=JSON.stringify(profile);
      const batch=adapter.open('player');
      assert.equal(batch.ok,true);
      assert.equal(JSON.stringify(profile),initial);
      const key=controller.nextCommand(batch);
      assert.ok(batch.candidates.some(candidate=>candidate.key===key));
      result=adapter.execute(request(batch,key));
      assert.equal(result.ok,true);
      assert.deepEqual(result.action,expected);
      action=result.action;
      assert.equal(adapter.execute(request(batch,key)).code,'AI_STALE_DECISION');
      playerSteps++;
    }
    assert.ok(result.profile,JSON.stringify(result));
    recorder.accept(before,{action,...result});
    profile=result.profile;
  }
  assert.equal(profile.entry.mode,'ended');
  assert.equal(stateOf(profile).victory.winner,'player');
  assert.equal(plans,playerSteps);
  assert.ok(enemySteps>0&&playerSteps>1);
  const replay=playIronDustProfileReplay(recorder.snapshot());
  assert.equal(replay.finalState.state.victory.winner,'player');
  assert.equal(replay.finalState.state.rng.state,stateOf(profile).rng.state);
});
