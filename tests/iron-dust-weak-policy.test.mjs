import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameManager,createPlayerController} from '../src/core/game-manager.mjs';
import {createIronDustAiAdapter} from '../src/core/iron-dust-ai-adapter.mjs';
import {createIronDustCommitRecorder,playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {createIronDustProfile,dispatchIronDustProfile,queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {selectWeakIronDustAttack} from '../src/core/iron-dust-weak-policy.mjs';
import {createIronDustBrowserSession,createIronDustDecisionHost} from '../iron-dust-browser-v2.mjs';

const end={type:'EndPhase',playerId:'player'};

test('Weak uses the complete native movement offer, including after an action and during GEV',()=>{
  let state=createIronDustProfile(8);
  const optimized=createIronDustAiAdapter(()=>({state,generation:1}),{weakAttack:true});
  const standard=createIronDustAiAdapter(()=>({state,generation:1}));
  const shape=({kind,actorId,target,weaponRef})=>({kind,actorId,target,weaponRef});
  function compare() {
    const left=optimized.open('player'),right=standard.open('player');
    assert.deepEqual(left.candidates.map(shape),right.candidates.map(shape));
    for (const move of left.candidates.filter(candidate=>candidate.kind==='move')) {
      const {x,y}=move.target;
      const query=queryIronDustProfile(state,{type:'Move',playerId:'player',unitId:move.actorId,to:{x,y}});
      assert.equal(move.facts.cost,query.cost);
    }
  }
  compare();
  state=dispatchIronDustProfile(state,{type:'Move',playerId:'player',unitId:'ogre',to:{x:3,y:2}}).profile;
  compare();
  for (let i=0;i<2;i++) state=dispatchIronDustProfile(state,end).profile;
  assert.equal(state.entry.payload.phase,'gev');
  compare();
});

test('Weak holds without sight and chooses the closest available shot before movement',()=>{
  const hold={key:'phase',kind:'end-phase',facts:{}};
  const move={key:'legal-move',kind:'move',facts:{cost:2}};
  assert.equal(selectWeakIronDustAttack({candidates:[move,hold]}),'phase');
  move.facts.weakApproach={distance:4,remaining:2,inRange:true};
  const distant={key:'distant',kind:'fire',facts:{weakFireDistance:3}};
  const near={key:'near',kind:'fire',facts:{weakFireDistance:2}};
  const alternate={key:'select',kind:'select-weapon',facts:{weakFireDistance:2}};
  assert.equal(selectWeakIronDustAttack({candidates:[hold,move,distant,alternate,near]}),'near');
  assert.equal(selectWeakIronDustAttack({candidates:[hold,move]}),'legal-move');
});

test('an assigned native Weak attacker plans once per accepted action and records a deterministic replay',async()=>{
  const manager=createGameManager({maxSeats:2,seatIds:['player','enemy']},{
    player:{human:true,ai:[{id:'weak',difficulty:'weak'}]},enemy:{human:true,ai:[]}
  });
  const [assignment]=manager.assign({player:'weak',enemy:null});
  const controller=createPlayerController(assignment.seatId,selectWeakIronDustAttack);
  let session=createIronDustBrowserSession();
  const recorder=createIronDustCommitRecorder(session.profile),events=[],actions=[];
  let calls=0;
  const host=createIronDustDecisionHost({weakAttack:true,spectator:true,readSession:()=>session,readEpoch:()=>1,
    select(decision,report) {
      assert.equal(decision.side,'player');
      assert.equal(session.projection.state.activeTeam,'player');
      assert.equal(calls++,actions.length);
      return controller.nextCommand(decision,report);
    },
    install(next,action,evidence) {
      assert.match(evidence.explanationKey,/^v2\.round\.(approach|rulePass|nearestFire)$/);
      recorder.accept(session.profile,{action,profile:next.profile,events:next.projection.events});
      session=next;
      actions.push(action);
      events.push(next.projection.events);
    }
  });
  while (session.projection.mode==='player') {
    assert.ok(calls<20);
    assert.deepEqual(await host.advance(),{ok:true});
  }
  assert.equal(session.projection.mode,'enemy');
  assert.deepEqual(await host.advance(),{ok:false,code:'AI_HOST_WRONG_SIDE'});
  assert.equal(calls,actions.length);
  assert.equal(actions.find(action=>action.type==='PlayerFire').targetId,'guard');
  assert.ok(actions.some(action=>action.type==='SelectWeapon'));
  const encoded=JSON.stringify(recorder.snapshot());
  const replay=playIronDustProfileReplay(JSON.parse(encoded));
  assert.deepEqual(replay,playIronDustProfileReplay(JSON.parse(encoded)));
  assert.deepEqual(replay.steps.map(step=>step.events),events);
  assert.deepEqual(replay.finalState.state,session.projection.state);
  assert.equal(replay.checkpoints.at(-1).rngState,session.projection.state.rng.state);
  host.stop();
});
