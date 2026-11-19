import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustTrainingArchive,importIronDustTrainingArchive} from '../training-archive.mjs';
import {createIronDustProfile,queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder,dispatchIronDustCommittedCommand} from '../src/core/iron-dust-profile-replay.mjs';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2} from './iron-dust-source-victory-trace.v2.mjs';

function recordedMatch(humanDefense) {
  let profile=createIronDustProfile(8);
  const recorder=createIronDustCommitRecorder(profile);
  for(const original of IRON_DUST_SOURCE_VICTORY_TRACE_V2.commands) {
    const before=profile;
    let action=original;
    if(humanDefense&&original.type==='AutoEnemyAdvance') {
      const reference=queryIronDustProfile(profile,original).action;
      if(['EnemyMove','EnemyHold','EnemyUnitAttack','EnemySystemAttack'].includes(reference.command?.type))
        action=reference.command;
    }
    const result=dispatchIronDustCommittedCommand(profile,action);
    assert.ok(result.profile,result.error?.code);
    profile=result.profile;
    recorder.accept(before,{action,profile,events:result.events});
  }
  assert.equal(profile.entry.mode,'ended');
  return recorder.snapshot();
}

test('new Iron Dust player policies retain their names through validated training archive import',async()=>{
  const replay=recordedMatch(true);
  for(const attacker of ['weak','medium','strong','trained']) {
    const archive=createIronDustTrainingArchive(replay,{attacker,defender:'human',outcome:'player'});
    assert.equal(archive.seats.player.policy,attacker);
    const imported=await importIronDustTrainingArchive(archive);
    assert.equal(imported.outcome,'player');
    assert.ok(imported.demonstrations.every(row=>row.side==='enemy'));
  }
});

test('trained defender metadata keeps its native medium movement header and rejects a forged rule policy',async()=>{
  const replay=recordedMatch(false);
  const archive=createIronDustTrainingArchive(replay,{attacker:'human',defender:'trained',outcome:'player'});
  assert.equal(archive.seats.enemy.policy,'trained');
  assert.equal((await importIronDustTrainingArchive(archive)).outcome,'player');
  await assert.rejects(()=>importIronDustTrainingArchive({...archive,seats:{
    ...archive.seats,enemy:{controller:'ai',policy:'weak'}
  }}),{code:'TRAINING_ARCHIVE_INVALID'});
});
