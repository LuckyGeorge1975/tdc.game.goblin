import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustSpectatorMatch,createSpectatorSession} from '../spectator-session.mjs';

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
  assert.equal(spectator.pause(),true);
  assert.equal(spectator.status,'pausing');
  release();
  await first;
  assert.equal(spectator.status,'paused');
  assert.equal(spectator.resume(),true);
  const second = scheduled();
  spectator.leave();
  release();
  await second;
  assert.equal(spectator.status,'closed');
  assert.equal(spectator.view(),null);
  assert.equal(spectator.resume(),false);
  assert.equal(spectator.dispatch,undefined);
});
