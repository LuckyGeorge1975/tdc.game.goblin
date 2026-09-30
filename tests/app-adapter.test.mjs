import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAdapter } from '../src/app/adapter.mjs';
import { createReferenceState, referenceMockCore } from '../src/app/mock-core.mjs';

const setup = () => createGameAdapter({ core: referenceMockCore, initialState: createReferenceState() });

test('unit and field selection are view-only', () => {
  const app = setup();
  const initial = structuredClone(app.snapshot().state);
  app.clickRoster('p-1');
  assert.equal(app.snapshot().view.selectedUnitId, 'p-1');
  app.clickRoster('p-1');
  assert.equal(app.snapshot().view.selectedUnitId, null);
  app.clickCell({ x: 6, y: 3 });
  assert.deepEqual(app.snapshot().view.focusedCell, { x: 6, y: 3 });
  assert.deepEqual(app.snapshot().state, initial);
});

test('legal movement dispatches and rejected movement changes neither state nor seed', () => {
  const app = setup();
  app.selectUnit('p-1');
  const legal = app.clickCell({ x: 2, y: 4 });
  assert.equal(legal.events[0].type, 'UnitMoved');
  assert.deepEqual({ x: app.snapshot().state.units[0].x, y: app.snapshot().state.units[0].y }, { x: 2, y: 4 });
  const before = structuredClone(app.snapshot().state);
  const illegal = app.dispatch({ type: 'Move', playerId: 'player', unitId: 'p-1', to: { x: 11, y: 7 } });
  assert.equal(illegal.error.code, 'ACTION_SPENT');
  assert.deepEqual(app.snapshot().state, before);
});

test('phase button, fire and deterministic win use commands only', () => {
  const run = () => {
    const app = setup();
    app.selectUnit('p-1');
    app.clickCell({ x: 2, y: 4 });
    app.endPhase();
    assert.equal(app.snapshot().state.phase, 'fire');
    app.clickCell({ x: 4, y: 3 });
    app.selectUnit('p-2');
    app.clickCell({ x: 4, y: 5 });
    return app.snapshot().state;
  };
  const result = run();
  assert.equal(result.victory.winner, 'player');
  assert.deepEqual(run(), result);
});

test('independent area queries remain distinct', () => {
  const app = setup();
  app.selectUnit('p-1');
  const { movementReachable, fireRange, lineOfSight, attackableTargets } = app.snapshot().areas;
  assert.ok(movementReachable.length > 0);
  assert.ok(fireRange.length > 0);
  assert.ok(lineOfSight.length > 0);
  assert.deepEqual(attackableTargets, []);
  assert.ok(!movementReachable.some(({ x, y }) => x === 4 && y === 3));
});

test('Core events are delivered once, not replayed by later view updates', () => {
  const app = setup();
  const batches = [];
  app.subscribe((change) => { if (change.events.length) batches.push(change.events.map((event) => event.type)); });
  app.selectUnit('p-1');
  app.clickCell({ x: 2, y: 4 });
  assert.deepEqual(batches, [['UnitMoved']]);
  assert.deepEqual(app.snapshot().events, []);
  app.setAreaMode('sight');
  app.setHover({ x: 3, y: 4 });
  app.clickRoster('p-2');
  assert.deepEqual(batches, [['UnitMoved']]);
  app.endPhase();
  assert.deepEqual(batches, [['UnitMoved'], ['PhaseChanged']]);
  app.selectUnit('p-1');
  assert.deepEqual(batches, [['UnitMoved'], ['PhaseChanged']]);
});

test('a rejected target click retains the structured Core error after focus changes', () => {
  const app = setup();
  app.selectUnit('p-1');
  app.endPhase();
  const before = structuredClone(app.snapshot().state);
  const result = app.clickCell({ x: 4, y: 5 });
  assert.equal(result.error.code, 'TARGET_NOT_ATTACKABLE');
  assert.equal(app.snapshot().error.code, result.error.code);
  assert.deepEqual(app.snapshot().view.focusedCell, { x: 4, y: 5 });
  assert.deepEqual(app.snapshot().state, before);
});
