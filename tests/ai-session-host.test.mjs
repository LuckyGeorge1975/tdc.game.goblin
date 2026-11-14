import assert from 'node:assert/strict';
import test from 'node:test';
import {createIronDustBrowserSession, createIronDustDecisionHost} from '../iron-dust-browser-v2.mjs';

test('Core spectator commits real movement and pause invalidates a waiting decision', async () => {
  let session = createIronDustBrowserSession();
  const start = session;
  let resolve;
  const host = createIronDustDecisionHost({readSession:()=>session,readEpoch:()=>1,spectator:true,
    select:decision => new Promise(done => { resolve=()=>done(decision.candidates.find(c=>c.kind==='move').key); }),
    install:next => { session = next; }});
  const pending = host.advance();
  assert.equal((await host.advance()).code,'AI_HOST_UNAVAILABLE');
  host.pause();
  host.resume();
  resolve();
  assert.equal((await pending).code,'AI_HOST_STALE');
  assert.equal(session,start);
  const next = host.advance();
  resolve();
  assert.deepEqual(await next,{ok:true});
  assert.notEqual(session,start);
  assert.ok(session.projection.events.some(event=>event.type==='UnitMoved'));
  host.stop();
  assert.equal((await host.advance()).code,'AI_HOST_UNAVAILABLE');
});
