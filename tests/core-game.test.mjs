import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, queryAreas, replayReference, referenceScenario, referenceCommands, REFERENCE_SEED } from '../src/core/game-core.mjs';
import { hasLineOfSight, hexDistance, movementPaths } from '../src/core/hex.mjs';

const start = () => createGame(referenceScenario, REFERENCE_SEED);
const point = (cells, x, y) => cells.some(cell => cell.x === x && cell.y === y);

test('ARCH-01 fixture is JSON-only, 12x8 and reproducible including events', () => {
  assert.equal(start().map.width, 12);
  assert.equal(start().map.height, 8);
  assert.equal(start().units.length, 4);
  function replay() {
    let state = start(); const trace = [];
    for (const command of referenceCommands) {
      const result = dispatch(state, command); trace.push(result);
      if (result.state) state = result.state;
    }
    return { state, trace };
  }
  const first = replay(), second = replay();
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.equal(first.trace[1].error.code, 'ACTION_SPENT');
  assert.equal(first.trace[2].events[0].type, 'PhaseChanged');
  assert.equal(first.trace[3].events[0].type, 'ShotResolved');
  assert.equal(first.trace[4].events.at(-1).type, 'GameEnded');
  assert.equal(first.state.victory.winner, 'player');
  assert.deepEqual(replayReference().finalState, first.state);
  assert.equal(replayReference().steps[1].result.error.code, 'ACTION_SPENT');
});

test('selection has no core command; rejected commands preserve state and seed', () => {
  const state = start(), original = JSON.stringify(state);
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-1', to: { x: 11, y: 7 } }).error.code, 'UNREACHABLE');
  assert.equal(dispatch(state, { type: 'Move', playerId: 'enemy', unitId: 'p-1', to: { x: 2, y: 4 } }).error.code, 'NOT_ACTIVE_TEAM');
  assert.equal(dispatch(state, { type: 'Load', playerId: 'player', unitId: 'p-1' }).error.code, 'UNSUPPORTED_COMMAND');
  assert.equal(JSON.stringify(state), original);
});

test('movement respects blocked terrain, occupied cells, cover cost and edges', () => {
  const state = start(), unit = state.units[0], area = queryAreas(state, unit.id);
  assert.ok(point(area.movementReachable, 2, 4));
  assert.ok(!point(area.movementReachable, 4, 3), 'enemy occupied');
  assert.ok(!point(area.movementReachable, 1, 5), 'friendly occupied');
  assert.equal(movementPaths(state, unit).get('2,3')?.cost, 2, 'mountain costs two');
  const water = structuredClone(state); water.units[0].x = 5; water.units[0].y = 3;
  assert.ok(!point(queryAreas(water, 'p-1').movementReachable, 6, 3), 'tracked vehicle cannot enter water');
  assert.ok(area.movementReachable.every(p => p.x >= 0 && p.x < 12 && p.y >= 0 && p.y < 8));
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-1', to: { x: -1, y: 3 } }).error.code, 'OUT_OF_BOUNDS');
});

test('range, LOS and targets are distinct and phase-dependent', () => {
  const state = start(), unit = state.units[0], movement = queryAreas(state, unit.id);
  assert.equal(hexDistance({ x: 1, y: 3 }, { x: 2, y: 4 }), 1);
  assert.ok(point(movement.fireRange, 4, 3));
  assert.equal(movement.attackableTargets.length, 0, 'not fire phase');
  assert.equal(hasLineOfSight(state, { x: 1, y: 3 }, { x: 3, y: 3 }), false, 'mountain blocks beyond itself');
  assert.equal(hasLineOfSight(state, { x: 1, y: 3 }, { x: 2, y: 3 }), true, 'mountain cell itself is visible');
  const fire = dispatch(state, { type: 'EndPhase', playerId: 'player' }).state;
  const areas = queryAreas(fire, unit.id);
  assert.deepEqual(areas.movementReachable, [], 'movement is not legal in fire phase');
  assert.ok(point(areas.fireRange, 4, 3));
  assert.ok(!point(areas.lineOfSight, 3, 3));
  assert.ok(!areas.attackableTargets.includes('e-1'), 'blocked target is not attackable');
  assert.ok(queryAreas(fire, 'p-2').attackableTargets.includes('e-core'));
});

test('cover increases defense while fire command spends the deterministic roll', () => {
  const state = start();
  state.map.terrain.push({ x: 4, y: 5, type: 'crater' });
  const fire = dispatch(state, { type: 'EndPhase', playerId: 'player' }).state;
  const shot = dispatch(fire, { type: 'Fire', playerId: 'player', unitId: 'p-2', targetId: 'e-core' });
  assert.equal(shot.events[0].ratio, '2-1');
  assert.notEqual(shot.state.rng.state, fire.rng.state);
  assert.equal(fire.units.find(u => u.id === 'e-core').hp, 1);
});

test('phase order and team switch are deterministic', () => {
  let state = start();
  for (const phase of ['fire', 'gev', 'movement']) {
    const result = dispatch(state, { type: 'EndPhase', playerId: 'player' });
    state = result.state;
    assert.equal(state.phase, phase);
  }
  assert.equal(state.activeTeam, 'enemy');
  assert.equal(state.turn, 1);
});
