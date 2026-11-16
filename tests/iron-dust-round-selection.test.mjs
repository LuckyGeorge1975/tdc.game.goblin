import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createIronDustBrowserSession,createIronDustDecisionHost,dispatchIronDustBrowserAction}
  from '../iron-dust-browser-v2.mjs';
import {captureIronDustRoundCommit,createIronDustRoundRecorder} from '../iron-dust-round-source.mjs';
import {IRON_DUST_TRAINED_SCOPE as scope,prepareIronDustTrainedPolicy} from '../src/core/iron-dust-trained-policy.mjs';
import {choosePlayerAction} from '../src/core/iron-dust-objective-policy.mjs';
import {createIronDustProfile,dispatchIronDustProfile,queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder,playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {hexDistance} from '../src/core/hex.mjs';

const {base64}=JSON.parse(readFileSync(new URL('../assets/ai/iron-dust-target-bpn.json',import.meta.url)));
const seed=390729996;

async function match(reporting,mode='spectator') {
  let session=createIronDustBrowserSession(createIronDustProfile(seed,{difficulty:'strong'}),seed);
  const rounds=createIronDustRoundRecorder(session.profile,()=>session?.profile,mode);
  const replay=createIronDustCommitRecorder(session.profile);
  const policy=await prepareIronDustTrainedPolicy(Buffer.from(base64,'base64'));
  let shot,epoch=0;
  const commits=[];
  function accept(next,action,evidence) {
    const before=session.profile;
    const commit=rounds.beginCommit();
    session=next;
    const {profile,projection:{events}}=next;
    captureIronDustRoundCommit(commit,before,{profile,events,action,evidence});
    replay.accept(before,{profile,events,action});
    commits.push(next);
  }
  const host=createIronDustDecisionHost({readSession:()=>session,readEpoch:()=>epoch,spectator:true,
    feature:scope.feature,fireTarget:{engine:scope.engine,
      scope:()=>shot&&{actorId:shot.unitId,weaponRef:shot.weaponKey??null}},
    policy:{select:(context,batch,report)=>policy.select(context,{...batch,baseline:shot},reporting?report:undefined)},
    install:accept
  });
  function step() {
    const {profile,projection:{state,mode}}=session;
    const plan=mode==='enemy' ? {command:{type:'AutoEnemyAdvance',playerId:'enemy'}} :
      choosePlayerAction({state,hexDistance,query:command=>queryIronDustProfile(profile,command),
        queryWithWeapon(command,fire) {
          const next=dispatchIronDustProfile(profile,command);
          return next.profile?queryIronDustProfile(next.profile,fire):{available:false,error:next.error};
        }});
    if (plan.command.type==='PlayerFire') {
      shot=plan.command;
      return host.advance();
    }
    const result=dispatchIronDustBrowserAction(session,plan.command);
    assert.ok(result.session);
    const evidence=reporting&&plan.explanation?.reason==='advance-toward-objective'
      ? {explanationKey:'v2.round.objectiveMove'} : undefined;
    accept(result.session,plan.command,evidence);
    return {ok:true};
  }
  return {step,host,rounds,commits,replay,replace(){epoch++;},get session(){return session;}};
}

test('native Iron Dust captures retained and changed targets with existing model values and the original replay',async()=>{
  const control=await match(false);
  const trained=await match(true);
  const humanControl=await match(false,'player');
  const humanPolicy=await match(true,'player');
  for (let index=0; trained.session.projection.mode!=='ended' && index<50; index++) {
    for (const run of [control,trained,humanControl,humanPolicy]) assert.equal((await run.step()).ok,true);
    if (humanPolicy.session.projection.mode!=='ended')
      assert.equal(JSON.stringify(humanPolicy.rounds.view()),JSON.stringify(humanControl.rounds.view()));
  }
  assert.equal(trained.session.projection.mode,'ended');
  assert.equal(trained.commits.length,39);
  assert.deepEqual(trained.commits,control.commits);
  const replay=trained.replay.snapshot();
  assert.deepEqual(replay,control.replay.snapshot());
  assert.deepEqual(playIronDustProfileReplay(replay).checkpoints,replay.checkpoints);
  assert.deepEqual([replay.commands[20].unitId,replay.commands[20].weaponKey,replay.commands[20].targetId],
    ['ogre','missiles','raider']);
  const trace=trained.rounds.view().trace;
  const shots=trace.flatMap(round=>round.rows).filter(row=>row.explanationKey?.startsWith('v2.round.model'));
  assert.equal(shots.length,8);
  for (const shot of shots) {
    assert.ok(shot.options.every(option=>!('basis' in option.scores) && Number.isFinite(option.scores.model)));
    const baseline=shot.options.find(option=>option.baseline);
    const selected=shot.options.find(option=>option.selected);
    assert.ok(baseline&&selected);
    assert.equal(selected.target.labelKey,shot.target.labelKey);
    assert.equal(selected.scores.model>baseline.scores.model,shot.explanationKey==='v2.round.modelTarget');
  }
  const changed=shots.find(shot=>shot.explanationKey==='v2.round.modelTarget');
  assert.equal(changed.options.find(option=>option.baseline).target.labelKey,'v2.unit.guard');
  assert.equal(changed.options.find(option=>option.selected).target.labelKey,'v2.unit.raider');
  assert.equal(JSON.stringify(trace).includes('decision:'),false);
});

test('Iron Dust rejects a chosen reason from the old session revision before recording fire',async()=>{
  const run=await match(true);
  for (let index=0;index<20;index++) assert.equal((await run.step()).ok,true);
  const before=run.session, replay=run.replay.snapshot(), rounds=run.rounds.view();
  const inFlight=run.step();
  run.replace();
  assert.equal((await inFlight).code,'AI_HOST_STALE');
  assert.equal(run.session,before);
  assert.deepEqual(run.replay.snapshot(),replay);
  assert.deepEqual(run.rounds.view(),rounds);
});
