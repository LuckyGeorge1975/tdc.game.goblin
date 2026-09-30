import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAdapter } from '../src/app/adapter.mjs';
import { createReferenceState, referenceMockCore } from '../src/app/mock-core.mjs';
import { AREA_MODE, derivePresentation, UNIT_STATUS } from '../src/app/presentation.mjs';

const setup = () => createGameAdapter({ core: referenceMockCore, initialState: createReferenceState() });
const show = (app) => derivePresentation(app.snapshot().state, referenceMockCore);

test('phase counters and unit statuses are derived from Core state', () => {
  const app = setup();
  assert.deepEqual([show(app).counts.ready, show(app).counts.total], [2, 2]);
  app.selectUnit('p-1');
  app.clickCell({ x: 2, y: 4 });
  assert.equal(show(app).byUnitId['p-1'].status, UNIT_STATUS.spent);
  assert.equal(show(app).counts.ready, 1);
  assert.equal(show(app).phaseButton.pendingActions, 1);
  app.endPhase();
  assert.equal(show(app).byUnitId['p-1'].status, UNIT_STATUS.ready);
  assert.equal(show(app).counts.ready, 2);
  assert.equal(show(app).phaseButton.label, 'Zum Skimmer-Manöver →');
  assert.equal(app.snapshot().view.areaMode, 'fire');
  app.clickCell({ x: 4, y: 3 });
  assert.equal(show(app).byUnitId['p-1'].status, UNIT_STATUS.spent);
  assert.equal(show(app).counts.ready, 1);
});

test('destroyed, disabled, unavailable and spent remain distinct', () => {
  const state = createReferenceState();
  state.units.find((unit) => unit.id === 'p-1').hp = 0;
  state.units.find((unit) => unit.id === 'p-2').disabled = true;
  state.units.find((unit) => unit.id === 'e-1').moved = true;
  const view = derivePresentation(state, referenceMockCore);
  assert.equal(view.byUnitId['p-1'].status, UNIT_STATUS.destroyed);
  assert.equal(view.byUnitId['p-2'].status, UNIT_STATUS.disabled);
  assert.equal(view.byUnitId['e-1'].status, UNIT_STATUS.unavailable);
  assert.deepEqual([view.counts.destroyed, view.counts.disabled, view.counts.ready], [1, 1, 0]);
});

test('area modes remain separate, and rejected commands preserve all display counters', () => {
  const app = setup();
  app.selectUnit('p-1');
  const areas = app.snapshot().areas;
  assert.equal(AREA_MODE.movement, 'movementReachable');
  assert.equal(AREA_MODE.fire, 'fireRange');
  assert.equal(AREA_MODE.sight, 'lineOfSight');
  assert.notDeepEqual(areas.movementReachable, areas.fireRange);
  assert.notDeepEqual(areas.fireRange, areas.lineOfSight);
  const before = show(app);
  const result = app.dispatch({ type: 'Move', playerId: 'player', unitId: 'p-1', to: { x: 11, y: 7 } });
  assert.ok(result.error);
  assert.deepEqual(show(app), before);
});
