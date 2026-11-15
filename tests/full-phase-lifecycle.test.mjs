import assert from 'node:assert/strict';
import test from 'node:test';
import {createFullPhaseLifecycle} from '../src/core/full-phase-lifecycle.mjs';

function fixture(advance) {
  let state = {sessionId:1, side:'player', controller:'human', paused:false};
  const queue = new Set();
  const lifecycle = createFullPhaseLifecycle({
    port:{state:()=>state},
    host:{advance, pause:()=>{state.paused=true;}, resume:()=>{state.paused=false;},
      leave:()=>{state=null;}},
    schedule:callback=>{queue.add(callback);return callback;},
    cancel:callback=>queue.delete(callback)
  });
  return {lifecycle, queue,
    side(side, controller) { state = {...state,side,controller}; },
    async tick() {
      const callback = queue.values().next().value;
      assert.ok(callback);
      queue.delete(callback);
      await callback();
    }};
}

test('only a native AI turn queues work and each human handoff stops the loop', async () => {
  let calls = 0;
  const f = fixture(() => {
    calls++;
    f.side('player', 'human');
    return {ok:true};
  });
  f.lifecycle.sync();
  assert.equal(f.queue.size, 0);
  for (let turn = 1; turn <= 2; turn++) {
    f.side('enemy','ai');
    f.lifecycle.sync();
    f.lifecycle.sync();
    assert.equal(f.queue.size, 1);
    await f.tick();
    assert.equal(f.queue.size, 0);
    assert.equal(calls, turn);
  }
});

test('pause and resume do not overlap work and leave cancels the queued continuation', async () => {
  let resolve, calls = 0;
  const f = fixture(() => {
    calls++;
    return new Promise(done=>{resolve=done;});
  });
  f.side('enemy','ai');
  f.lifecycle.sync();
  const pending = f.tick();
  f.lifecycle.pause();
  f.lifecycle.resume();
  assert.equal(calls, 1);
  assert.equal(f.queue.size, 0);
  resolve({ok:true});
  await pending;
  assert.equal(f.queue.size, 1);
  f.lifecycle.leave();
  assert.equal(f.queue.size, 0);
  f.lifecycle.sync();
  assert.equal(calls, 1);
});

test('a rejected native choice does not get automatically retried', async () => {
  let calls = 0;
  const f = fixture(() => { calls++; return {ok:false}; });
  f.side('enemy','ai');
  f.lifecycle.sync();
  await f.tick();
  f.lifecycle.sync();
  assert.equal(f.queue.size, 0);
  assert.equal(calls, 1);
});
