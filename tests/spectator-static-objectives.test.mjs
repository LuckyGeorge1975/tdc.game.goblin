import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustSpectatorMatch,createSpectatorSession} from '../spectator-session.mjs';
import {playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as trace} from './iron-dust-source-victory-trace.v2.mjs';

const advancePhase=batch=>batch.candidates.find(item=>item.kind==='end-phase');

test('both Core controllers read their current authorized static objectives through real terminal',async()=>{
  const selections={player:0,enemy:0};
  let cursor=0;
  function inspect(side, batch) {
    selections[side]++;
    assert.equal(batch.side,side);
    assert.equal(batch.view.side,side);
    const goals=batch.view.objectives;
    assert.ok(Object.isFrozen(goals)&&Object.isFrozen(goals[0]));
    const roster=batch.view.units;
    const core=roster.find(unit=>unit.id==='core');
    const attackerSurvives=roster.some(unit=>unit.relation===(side==='player'?'own':'opponent')&&unit.hp>0);
    assert.deepEqual(goals.map(goal=>goal.kind),side==='player'?['destroy-core','survive']:['destroy-player-force','protect-core']);
    assert.deepEqual(goals.map(goal=>goal.satisfied),side==='player'?[core.hp===0,attackerSurvives]:[!attackerSurvives,core.hp>0]);
    assert.equal(Object.hasOwn(batch,'board'),false);
    assert.equal(Object.hasOwn(batch.view,'rng'),false);
  }
  const match=createIronDustSpectatorMatch({
    player(batch){
      inspect('player',batch);
      const command=trace.commands[cursor++];
      assert.equal(command.playerId,'player');
      if(command.type==='EndPhase')return advancePhase(batch).key;
      if(command.type==='Move')return batch.candidates.find(candidate=>candidate.kind==='move'&&
        candidate.actorId===command.unitId&&candidate.target.x===command.to.x&&candidate.target.y===command.to.y).key;
      const goal=batch.view.objectives.find(item=>item.kind==='destroy-core');
      return batch.candidates.find(candidate=>candidate.kind==='fire'&&candidate.actorId===command.unitId&&
        candidate.target.unitId===goal.target.unitId&&candidate.weaponRef===command.weaponKey).key;
    },
    enemy(batch){
      inspect('enemy',batch);
      assert.equal(trace.commands[cursor++].type,'AutoEnemyAdvance');
      const baseline=batch.candidates.find(item=>item.facts.automatic||item.facts.baseline);
      assert.ok(baseline);return baseline.key;
    }
  },{recordReplay:true});
  const queue=new Map();let handle=0;
  const viewer=createSpectatorSession(match,{schedule(fn){queue.set(++handle,fn);return handle;},cancel:id=>queue.delete(id)});
  viewer.resume();
  while(viewer.status==='running'){
    assert.ok(cursor<trace.commands.length,'fixed Core run did not terminate');
    const work=queue.entries().next().value;
    assert.ok(work);queue.delete(work[0]);await work[1]();
  }
  assert.equal(viewer.status,'ended');
  assert.equal(cursor,trace.commands.length);
  assert.ok(selections.player>0&&selections.enemy>0);
  const final=viewer.board(), history=viewer.view();
  assert.equal(final.ended,true);
  assert.equal(history.terminalPartial.roundNumber,final.roundNumber);
  assert.equal(final.units.some(unit=>unit.id==='core'),false);
  const replay=JSON.stringify(match.replay());
  const playback=playIronDustProfileReplay(JSON.parse(replay));
  assert.deepEqual(playIronDustProfileReplay(JSON.parse(replay)),playback);
  const state=playback.finalState.state;
  assert.equal(state.victory.winner,'player');
  assert.equal(state.turn,final.roundNumber);
  assert.deepEqual(state.units.filter(unit=>unit.hp>0&&!unit.embarkedOn).map(unit=>unit.id),final.units.map(unit=>unit.id));
  const liveShots=history.trace.flatMap(round=>round.rows).filter(row=>row.kind==='fire');
  const nativeShots=playback.steps.flatMap(step=>step.events).filter(event=>/FireResolved$/.test(event.type));
  assert.deepEqual(liveShots.map(row=>[row.side,row.actor.labelKey,row.target.labelKey,row.resultKey]),
    nativeShots.map(event=>[event.type==='PlayerFireResolved'?'player':'enemy',
      `v2.unit.${event.attackerId}`,`v2.unit.${event.targetId}`,event.result]));
  assert.equal(liveShots.filter(row=>row.side==='player').length,1);
  assert.ok(liveShots.some(row=>row.side==='enemy'));
  console.log(JSON.stringify({selections,round:final.roundNumber,winner:state.victory.winner,shots:nativeShots.length,rng:state.rng.state}));
  viewer.leave();
});
