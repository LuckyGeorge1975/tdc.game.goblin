import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAdapter } from '../src/app/adapter.mjs';
import { createPhaseState, referenceMockCore } from '../src/app/mock-core.mjs';
import { phaseCommands } from '../src/core/game-core.mjs';
import { derivePresentation, UNIT_STATUS } from '../src/app/presentation.mjs';

const setup = () => createGameAdapter({ core: referenceMockCore, initialState: createPhaseState() });
const display = (app) => derivePresentation(app.snapshot().state, referenceMockCore);

test('the shared phase fixture drives movement, fire and GEV displays', () => {
  const app = setup();
  const original = structuredClone(app.snapshot().state);
  app.selectUnit('p-gev');
  assert.deepEqual(app.snapshot().state, original);
  assert.deepEqual([display(app).counts.ready, display(app).counts.total], [2, 2]);

  assert.equal(app.clickCell({ x: 2, y: 1 }).events[0].type, 'UnitMoved');
  assert.equal(display(app).byUnitId['p-gev'].status, UNIT_STATUS.spent);
  assert.equal(display(app).counts.ready, 1);
  assert.equal(app.endPhase().events[0].type, 'PhaseChanged');
  assert.equal(display(app).phaseButton.label, 'Zur GEV Phase →');
  assert.equal(app.snapshot().view.areaMode, 'fire');

  app.selectUnit('p-tank');
  assert.equal(app.clickCell({ x: 4, y: 4 }).events[0].type, 'ShotResolved');
  assert.equal(display(app).byUnitId['e-tank'].status, UNIT_STATUS.disabled);
  app.endPhase();
  assert.match(display(app).phaseLabel, /gev phase/);
  assert.equal(display(app).byUnitId['p-gev'].status, UNIT_STATUS.ready);
  assert.equal(display(app).byUnitId['p-tank'].status, UNIT_STATUS.unavailable);
  assert.deepEqual([display(app).counts.ready, display(app).counts.total], [1, 2]);
  app.selectUnit('p-gev');
  assert.equal(app.snapshot().view.areaMode, 'movement');
  assert.ok(app.snapshot().areas.movementReachable.some(({ x, y }) => x === 4 && y === 1));
  assert.ok(!app.snapshot().areas.movementReachable.some(({ x, y }) => x === 5 && y === 1));
  assert.equal(app.clickCell({ x: 4, y: 1 }).events[0].phase, 'gev');
  assert.equal(display(app).byUnitId['p-gev'].status, UNIT_STATUS.spent);
  assert.equal(display(app).counts.ready, 0);
});

test('the shared command sequence shows disabled and recovered states once', () => {
  const app = setup();
  const eventBatches = [];
  const commandTrace = [];
  app.subscribe(({ events }) => { if (events.length) eventBatches.push(events.map(({ type }) => type)); });
  app.subscribeCommand(({ command, result }) => commandTrace.push({ command, result }));
  app.selectUnit('p-gev');
  app.setAreaMode('sight');
  assert.equal(commandTrace.length, 0);
  for (const command of phaseCommands) {
    const previous = structuredClone(app.snapshot().state);
    const result = app.dispatch(command);
    if (result.error) {
      assert.deepEqual(app.snapshot().state, previous);
      assert.equal(app.snapshot().error.code, result.error.code);
    }
    if (command.type === 'Fire') {
      assert.equal(display(app).byUnitId['e-tank'].status, UNIT_STATUS.disabled);
    }
  }
  assert.equal(app.snapshot().state.activeTeam, 'enemy');
  assert.equal(app.snapshot().state.turn, 2);
  assert.equal(display(app).byUnitId['e-tank'].status, UNIT_STATUS.ready);
  assert.deepEqual(commandTrace.map(({ command }) => command), phaseCommands);
  assert.equal(commandTrace.filter(({ result }) => result.error).length, 4);
  assert.deepEqual(eventBatches.at(-1), ['UnitRecovered', 'PhaseChanged']);
  const delivered = eventBatches.length;
  app.setAreaMode('sight');
  app.setHover({ x: 4, y: 4 });
  assert.equal(eventBatches.length, delivered);
  assert.deepEqual(app.snapshot().events, []);
});
