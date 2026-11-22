import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decode} from './helpers/trace-object-table.mjs';
import {replayCurrentTrace,playCurrentCase} from './helpers/current-full-trace.mjs';
import {importFullTrainingArchive} from '../scripts/full-training-import.mjs';

const bytes=fs.readFileSync(new URL('./fixtures/current-full-native.v1.json.gz',import.meta.url));
const sha='5b22bc31b1dff4d58e37de9ec5576da3ee4126e83fc94ba2f66ec3018377793a';
assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,'immutable CURRENT native capture');
const original=decode(JSON.parse(gunzipSync(bytes)));

test('CURRENT native win/loss/draw replays complete offers, world, history, events, presentation and seeded journals',async()=>{
  await replayCurrentTrace(original);
  for(const item of original.cases){
    const commits=item.steps.filter(step=>step.op==='commit');
    for(const side of ['player','enemy'])for(const phase of ['movement','fire','gev'])
      assert.ok(commits.some(step=>step.side===side&&step.phase===phase),side+'/'+phase);
    assert.ok(item.steps[0].after.history.length>0,'movement must create real undo history');
    assert.equal(item.steps[1].after.history.length,0);
    assert.ok(item.steps.some(step=>step.after.events.length>0),'capture must include real presentation events');
    assert.equal((await importFullTrainingArchive(item.archive)).outcome,item.definition.outcome);
  }
});

test('CURRENT full-state oracles reject changed world/history/phase/order/events/RNG independently of historical incompatibility',async()=>{
  const originalCase=original.cases[0];
  for(const corrupt of [
    item=>item.initial.world.units[0].x++,
    item=>item.steps[0].after.history[0].units[0].x++,
    item=>item.steps[2].phase='gev',
    item=>item.steps.reverse(),
    item=>item.steps[0].after.events.push({forged:true}),
    item=>item.archive.replay.entries.at(-1).draws++,
    item=>item.archive.replay.entries.at(-1).digest='00000000'
  ]){
    const changed=structuredClone(originalCase);corrupt(changed);
    await assert.rejects(()=>playCurrentCase(changed.definition,changed),{code:'ERR_ASSERTION'});
  }
  const foreign=structuredClone(original);foreign.sources['game.js']='f'.repeat(64);
  await assert.rejects(()=>replayCurrentTrace(foreign),/current source guard/);
  const old=structuredClone(originalCase.archive);delete old.replay.sources;
  await assert.rejects(()=>importFullTrainingArchive(old),/FULL_TRAINING_ARCHIVE_INVALID/);
  const forged=structuredClone(originalCase.archive);forged.replay.sources['game.js']='f'.repeat(64);
  await assert.rejects(()=>importFullTrainingArchive(forged),/FULL_TRAINING_SOURCE_BINDING/);
});
