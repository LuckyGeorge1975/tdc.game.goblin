import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createGameManager,createPlayerController} from '../src/core/game-manager.mjs';
import {commitFullHumanCommand,createFullGameManager,fullNativeSetup,fullSeatFallback}
  from '../full-standard-seat-owner.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
import {selectWeakFullCatalog} from '../src/core/full-catalog-difficulty.mjs';
import {prepareFullAttack2a,FULL_ATTACK_2A_ENGINE,FULL_ATTACK_2A_ID} from '../src/core/full-attack-2a.mjs';
import {createIronDustBrowserSession,createIronDustDecisionHost,dispatchIronDustBrowserAction}
  from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile,IRON_DUST_ENEMY_DIFFICULTIES} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder,playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {IRON_DUST_LEVEL_V3} from '../src/levels/iron-dust.v3.mjs';
import {fullShell} from './catalog-full-harness.mjs';
import {queryBridge} from './artillery-product-harness.mjs';

const atlas='catalog-full-atlas';
const readJson=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const modelBytes=Buffer.from(readJson('assets/ai/full-attack-2a.json').base64,'base64');
const endPhase={type:'EndPhase'};

async function atlasMatch(selection,minimumDifficulty) {
  const game=fullShell(7);
  const data=readJson('assets/unit-art/levels/catalog-full-levels.v3.json');
  if(minimumDifficulty) data.levels.find(level=>level.id===atlas).minimumDifficulty=minimumDifficulty;
  game.context.dataV3=data;
  await game.run("GoblinCatalogFullModel.initialize(data,dataV3,{profile:'FULL_CATALOG_v1'})");
  game.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
  queryBridge(game);
  const full=game.context.GoblinCatalogFullRuntime;
  const plans=[];
  for(const side of ['player','enemy']){
    full.registerQualifiedController({side,id:side+'-weak',difficulty:'weak',select(batch,report){
      assert.equal(batch.view.side,side);
      plans.push({side,phase:batch.phase});
      return selectWeakFullCatalog(batch,report);
    }});
  }
  const trained=await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes});
  full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select(batch,port,report){
    assert.equal(batch.view.side,'player');
    plans.push({side:'player',phase:batch.phase});
    return trained(batch,port,report);
  }});
  const config=game.run(`scenarioCatalog['${atlas}']`);
  const manager=createFullGameManager(config,full);
  assert.equal(manager.maxSeats,2);
  assert.deepEqual(manager.seats.map(seat=>seat.id),['player','enemy']);
  const native=fullNativeSetup(manager,selection);
  const handoffs=[], accepted=[];
  game.context.control={...native,ui:{handoff:(seat,take)=>handoffs.push({seat,take})}};
  const port=game.run(`loadScenario('${atlas}',control)`);
  const session=game.run('legacySession');
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  const host=createOwnedFullCatalogSessionHost({port,player,select:fullSeatFallback(session,selection,port),
    onCommit({action},before){accepted.push({action,side:before.side});}});
  return {game,manager,port,host,handoffs,plans,accepted,player};
}

function take({port,handoffs},side){
  const offer=handoffs.at(-1);
  assert.equal(offer.seat.side,side);
  assert.equal(port.project('human'),null);
  assert.equal(offer.take(),true);
  assert.equal(offer.take(),false);
  assert.equal(port.project('human').view.side,side);
}

function humanCommit({port,player},command){
  const offer=port.open('human');
  const view=port.project('human').view;
  const chosen=command??offer.entries.find(option=>option.baseline).command;
  return commitFullHumanCommand(port,offer.permit,view,chosen,player.dispatch);
}

async function advanceSide({port,host},side) {
  for(let steps=0; port.state().side===side && !port.state().ended && steps<96; steps++)
    assert.deepEqual(await host.advance(),{ok:true});
  assert.notEqual(port.state().side,side,'native controller did not reach the opposing seat');
}

test('Atlas native human/human keeps both seats with an unmet AI minimum and revokes foreign views',async()=>{
  const match=await atlasMatch({player:null,enemy:null},'strong');
  const {manager,port,host,plans,player}=match;
  assert.equal(manager.maxSeats,2);
  assert.deepEqual(manager.seats.map(seat=>seat.ai.length),[0,0]);
  take(match,'player');
  const old=port.open('human').permit, openingRng=match.game.rng();
  assert.equal(commitFullHumanCommand(port,old,{side:'enemy'},endPhase,player.dispatch).code,'FULL_CONTROL_STALE');
  assert.deepEqual(match.game.rng(),openingRng);
  for(let phase=0;phase<3;phase++) assert.equal(humanCommit(match,endPhase).ok,true);
  assert.equal(port.state().side,'enemy');
  take(match,'enemy');
  assert.equal(commitFullHumanCommand(port,old,{side:'player'},endPhase,player.dispatch).code,'FULL_CONTROL_STALE');
  assert.equal(humanCommit(match).ok,true);
  assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
  assert.deepEqual(plans,[]);
});

test('Atlas native human/weak and weak/human switch sides through the existing owner',async()=>{
  const humanFirst=await atlasMatch({player:null,enemy:'enemy-weak'});
  take(humanFirst,'player');
  assert.equal((await humanFirst.host.advance()).code,'AI_HOST_WRONG_SIDE');
  for(let phase=0;phase<3;phase++) assert.equal(humanCommit(humanFirst,endPhase).ok,true);
  assert.equal(humanFirst.port.state().side,'enemy');
  assert.deepEqual(await humanFirst.host.advance(),{ok:true});
  assert.deepEqual(humanFirst.accepted.map(({side})=>side),['enemy']);

  const aiFirst=await atlasMatch({player:'player-weak',enemy:null});
  await advanceSide(aiFirst,'player');
  assert.ok(aiFirst.accepted.length>0 && aiFirst.accepted.every(({side})=>side==='player'));
  take(aiFirst,'enemy');
  assert.equal(humanCommit(aiFirst).ok,true);
  const previous=aiFirst.plans.length;
  assert.equal((await aiFirst.host.advance()).code,'AI_HOST_WRONG_SIDE');
  assert.equal(aiFirst.plans.length,previous);
});

test('Atlas trained attacker hands off to weak AI; the inverse qualification is rejected',async()=>{
  const match=await atlasMatch({player:FULL_ATTACK_2A_ID,enemy:'enemy-weak'});
  assert.throws(()=>fullNativeSetup(match.manager,{player:'player-weak',enemy:FULL_ATTACK_2A_ID}),
    {code:'AI_SEAT_NOT_QUALIFIED'});
  assert.equal(match.port.state().policyId,FULL_ATTACK_2A_ID);
  await advanceSide(match,'player');
  assert.equal(match.port.state().policyId,'enemy-weak');
  assert.deepEqual(await match.host.advance(),{ok:true});
  assert.equal(match.accepted.at(-1).side,'enemy');
  assert.ok(match.plans.some(plan=>plan.side==='player'&&plan.phase==='fire'));
  assert.equal(match.handoffs.length,0);
});

test('Iron Dust reuses the contract for existing defender DTOs without exposing a human browser command',async()=>{
  const {aiAllowed,minimumDifficulty}=IRON_DUST_LEVEL_V3;
  const manager=createGameManager({maxSeats:2,seatIds:['player','enemy'],aiAllowed,minimumDifficulty},{
    player:{human:true,ai:[{id:'trained',difficulty:null}]},
    enemy:{human:false,ai:IRON_DUST_ENEMY_DIFFICULTIES.map(id=>({id,difficulty:id}))}
  });
  assert.equal(manager.assign({player:null,enemy:'weak'})[1].controller,'ai');
  assert.equal(manager.assign({player:'trained',enemy:'weak'})[0].controller,'ai');
  assert.throws(()=>manager.assign({player:null,enemy:null}),{code:'HUMAN_SEAT_UNAVAILABLE'});
  assert.throws(()=>manager.assign({player:'trained',enemy:null}),{code:'HUMAN_SEAT_UNAVAILABLE'});
  assert.throws(()=>manager.assign({player:null,enemy:'trained'}),{code:'AI_SEAT_NOT_QUALIFIED'});

  let session=createIronDustBrowserSession(createIronDustProfile(8,{difficulty:'weak'}),8);
  const replay=createIronDustCommitRecorder(session.profile);
  function install(next,action){
    const before=session.profile;
    session=next;
    replay.accept(before,{action,profile:next.profile,events:next.projection.events});
  }
  const player=createPlayerController('enemy',batch=>{
    assert.equal(batch.view.side,'enemy');
    assert.ok(batch.view.units.some(unit=>unit.relation==='own'&&unit.id==='guard'));
    const hold=batch.candidates.find(candidate=>candidate.kind==='hold');
    assert.equal(dispatchIronDustBrowserAction(session,{type:'EnemyHold',playerId:'enemy',actorId:hold.actorId}).error.code,
      'BROWSER_ACTION_UNSUPPORTED');
    return hold.key;
  });
  const host=createIronDustDecisionHost({readSession:()=>session,readEpoch:()=>0,
    select:player.nextCommand,install});
  assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
  for(let phase=0;phase<3;phase++){
    const action={...endPhase,playerId:'player'};
    install(dispatchIronDustBrowserAction(session,action).session,action);
  }
  assert.deepEqual(await host.advance(),{ok:true});
  assert.equal(session.projection.events[0].type,'EnemyHeld');
  const recorded=replay.snapshot();
  assert.equal(recorded.commands.at(-1).type,'EnemyHold');
  assert.deepEqual(playIronDustProfileReplay(recorded).checkpoints,recorded.checkpoints);
});
