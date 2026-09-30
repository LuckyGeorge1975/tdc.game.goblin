import assert from 'node:assert/strict';
import test from 'node:test';
import { createSafeGameAdapter } from '../src/app/safe-adapter.mjs';
import { createReferenceState, referenceMockCore } from '../src/app/mock-core.mjs';
import { createQaProbe } from '../src/app/qa-probe.mjs';

test('QA probe separates view changes from confirmed Core commands and returns copies', () => {
  const app = createSafeGameAdapter({ core: referenceMockCore, initialState: createReferenceState() });
  const probe = createQaProbe();
  assert.equal(probe.snapshot(), null);
  probe.attach(app);
  const before = probe.snapshot();
  app.selectUnit('p-1');
  app.pickCell({ x: 2, y: 4 });
  assert.equal(probe.snapshot().commands.length, 0);
  assert.deepEqual(probe.snapshot().state, before.state);

  const intent = app.snapshot().view.pendingIntent;
  assert.equal(intent?.type, 'Move');
  app.confirmIntent();
  const after = probe.snapshot();
  assert.equal(after.commands.length, 1);
  assert.equal(after.commands[0].accepted, true);
  assert.equal(after.commands[0].command.type, 'Move');
  assert.notDeepEqual(after.state, before.state);

  after.state.units[0].hp = -99;
  after.commands.push({ command: { type: 'Fake' } });
  assert.notEqual(probe.snapshot().state.units[0].hp, -99);
  assert.equal(probe.snapshot().commands.length, 1);
  probe.attach(null);
  assert.equal(probe.snapshot(), null);
});
