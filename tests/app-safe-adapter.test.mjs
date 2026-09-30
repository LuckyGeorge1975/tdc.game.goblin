import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeGameAdapter } from '../src/app/safe-adapter.mjs';
import { createReferenceState, referenceMockCore } from '../src/app/mock-core.mjs';

const setup = () => createSafeGameAdapter({ core: referenceMockCore, initialState: createReferenceState() });

test('first map pick previews a Core-validated intent; only explicit confirmation dispatches', () => {
  const app = setup();
  const commands = [];
  app.subscribeCommand(({ command }) => commands.push(command));
  const initial = structuredClone(app.snapshot().state);
  app.pickCell({ x: 1, y: 3 });
  assert.equal(app.snapshot().view.selectedUnitId, 'p-1');
  app.pickCell({ x: 2, y: 4 });
  assert.equal(app.snapshot().view.pendingIntent.type, 'Move');
  assert.deepEqual(app.snapshot().state, initial);
  assert.deepEqual(commands, []);
  const result = app.confirmIntent();
  assert.equal(result.events[0].type, 'UnitMoved');
  assert.equal(commands.length, 1);
  assert.equal(app.snapshot().view.pendingIntent, null);
  assert.equal(app.snapshot().state.units.find(unit => unit.id === 'p-1').x, 2);
  assert.equal(app.confirmIntent().error.code, 'NO_PENDING_INTENT');
  assert.equal(commands.length, 1);
});

test('invalid map intent reports the exact Core refusal without dispatch or RNG change', () => {
  const app = setup();
  const commands = [];
  app.subscribeCommand(({ command }) => commands.push(command));
  app.pickCell({ x: 1, y: 3 });
  const before = structuredClone(app.snapshot().state);
  app.pickCell({ x: 4, y: 3 });
  assert.equal(app.snapshot().view.pendingIntent, null);
  assert.equal(app.snapshot().view.intentError.code, 'WRONG_PHASE');
  assert.deepEqual(app.snapshot().state, before);
  assert.deepEqual(commands, []);
});

test('style, grid and overlay changes preserve a pending intent and all rule state', () => {
  const app = setup();
  app.pickCell({ x: 1, y: 3 });
  app.pickCell({ x: 2, y: 4 });
  const before = structuredClone(app.snapshot().state);
  app.setStyleSet('dryland');
  app.setGridVisible(true);
  app.setAreaMode('sight');
  app.setMapTransform({ x: 35, y: -12 }, 1.5);
  assert.equal(app.snapshot().view.pendingIntent.type, 'Move');
  assert.equal(app.snapshot().view.selectedUnitId, 'p-1');
  assert.deepEqual(app.snapshot().view.mapPan, { x: 35, y: -12 });
  assert.equal(app.snapshot().view.mapZoom, 1.5);
  assert.deepEqual(app.snapshot().state, before);
  assert.deepEqual(app.actions().endPhase.pendingUnitIds, ['p-1', 'p-2']);
  app.cancelIntent();
  assert.equal(app.snapshot().view.pendingIntent, null);
  assert.deepEqual(app.snapshot().state, before);
});
