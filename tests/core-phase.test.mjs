import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, dispatch, queryAreas, replayPhase,
  phaseScenario, phaseCommands, PHASE_SEED, expectedPhaseTrace,
  expectedPhaseReplay,
  enemyDScenario, ENEMY_D_SEED, enemyDCommands,
  secondDScenario, SECOND_D_SEED, secondDCommands,
  infantryDScenario, INFANTRY_D_SEED, infantryDCommands,
  terrainLosScenario, TERRAIN_LOS_SEED, terrainLosCommands,
} from '../src/core/game-core.mjs';
import { movementPaths } from '../src/core/hex.mjs';

const unit = (state, id) => state.units.find(candidate => candidate.id === id);
const end = state => dispatch(state, { type: 'EndPhase', playerId: state.activeTeam });
const has = (cells, x, y) => cells.some(cell => cell.x === x && cell.y === y);
const play = (scenario, seed, commands) => {
  let state = createGame(scenario, seed);
  const steps = commands.map(command => {
    const result = dispatch(state, command);
    if (result.state) state = result.state;
    return result;
  });
  return { steps, state };
};

test('CE-04 versioned fixture matches expected trace and two full deterministic replays', () => {
  const first = replayPhase(), second = replayPhase();
  assert.deepEqual(first, second);
  assert.deepEqual(first, expectedPhaseReplay, 'full fixed oracle includes all states, RNG, errors and event payloads');
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.equal(first.initialState.rulesVersion, 'core-v2');
  assert.equal(first.initialState.scenarioVersion, 'phase-v2');
  assert.equal(first.initialState.rng.seed, PHASE_SEED);
  assert.deepEqual(first.steps.map(({ result }, index) => {
    const state = result.state ?? (index ? first.steps.slice(0, index).reverse().find(step => step.result.state)?.result.state : first.initialState);
    return [result.error?.code ?? result.events.map(event => event.type).join(','), state.phase, state.activeTeam, state.turn];
  }), expectedPhaseTrace);
  assert.equal(first.steps[3].result.events[0].result, 'D');
  assert.equal(first.steps[3].result.events[0].roll, 2);
  assert.equal(first.finalState.rng.state, first.steps[3].result.state.rng.state);
  for (let i = 0; i < phaseCommands.length; i++) {
    if (!first.steps[i].result.error) continue;
    const prior = i ? first.steps.slice(0, i).reverse().find(step => step.result.state)?.result.state : first.initialState;
    const before = JSON.stringify(prior);
    assert.deepEqual(dispatch(prior, phaseCommands[i]), first.steps[i].result);
    assert.equal(JSON.stringify(prior), before, `rejection ${i} changed input or RNG`);
  }
});

test('GEV second move uses the same path budget in query and dispatch, even without a first move', () => {
  let state = createGame(phaseScenario, PHASE_SEED);
  const initial = queryAreas(state, 'p-gev');
  assert.ok(has(initial.movementReachable, 2, 1));
  state = end(state).state;
  assert.deepEqual(queryAreas(state, 'p-gev').movementReachable, []);
  state = end(state).state;
  const area = queryAreas(state, 'p-gev');
  assert.ok(has(area.movementReachable, 3, 1));
  assert.ok(!has(area.movementReachable, 4, 1));
  assert.deepEqual(queryAreas(state, 'p-tank').movementReachable, []);
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-tank', to: { x: 2, y: 4 } }).error.code, 'GEV_ONLY');
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 4, y: 1 } }).error.code, 'UNREACHABLE');
  const moved = dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 3, y: 1 } }).state;
  assert.equal(unit(moved, 'p-gev').moved, false);
  assert.equal(unit(moved, 'p-gev').secondMoved, true);
  assert.deepEqual(queryAreas(moved, 'p-gev').movementReachable, []);
});

test('GEV budget counts terrain costs in both area and command checks', () => {
  const scenario = structuredClone(phaseScenario);
  scenario.map.terrain.push({ x: 2, y: 1, type: 'forest' });
  let state = createGame(scenario, PHASE_SEED);
  state = end(end(state).state).state;
  const skimmer = unit(state, 'p-gev');
  assert.equal(movementPaths(state, skimmer, 2).get('2,1')?.cost, 2);
  assert.ok(has(queryAreas(state, skimmer.id).movementReachable, 2, 1));
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: skimmer.id, to: { x: 2, y: 1 } }).events[0].type, 'UnitMoved');
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: skimmer.id, to: { x: 3, y: 1 } }).error.code, 'UNREACHABLE');
});

test('D against an enemy vehicle disables through its next team activation and resets only the active team', () => {
  const run = replayPhase();
  const shot = run.steps[3].result.state;
  assert.equal(unit(shot, 'e-tank').disabledUntil, 2);
  const enemyStart = run.steps[8].result;
  assert.equal(unit(enemyStart.state, 'e-tank').disabled, true);
  assert.equal(unit(enemyStart.state, 'p-gev').secondMoved, true);
  assert.equal(unit(enemyStart.state, 'p-tank').fired, true);
  assert.equal(enemyStart.events.filter(event => event.type === 'PhaseChanged').length, 1);
  const playerStart = run.steps[12].result;
  assert.equal(playerStart.state.turn, 2);
  assert.equal(unit(playerStart.state, 'p-gev').secondMoved, false);
  assert.equal(unit(playerStart.state, 'p-tank').fired, false);
  assert.equal(unit(playerStart.state, 'e-tank').disabled, true);
  const recovered = run.steps[15].result;
  assert.deepEqual(recovered.events[0], { type: 'UnitRecovered', unitId: 'e-tank', activeTeam: 'enemy', turn: 2 });
  assert.equal(recovered.events.filter(event => event.type === 'PhaseChanged').length, 1);
  assert.equal(unit(recovered.state, 'e-tank').disabled, false);
  assert.equal(unit(recovered.state, 'e-tank').disabledUntil, 0);
});

test('enemy D on a player vehicle recovers only at player turn three', () => {
  const first = play(enemyDScenario, ENEMY_D_SEED, enemyDCommands);
  const second = play(enemyDScenario, ENEMY_D_SEED, enemyDCommands);
  assert.deepEqual(first, second);
  const shot = first.steps[4];
  assert.equal(shot.events[0].result, 'D');
  assert.equal(unit(shot.state, 'p-tank').disabledUntil, 3);
  const state = first.steps[6].state;
  assert.equal(state.turn, 2);
  assert.equal(state.activeTeam, 'player');
  assert.equal(unit(state, 'p-tank').disabled, true);
  assert.deepEqual(queryAreas(state, 'p-tank').movementReachable, []);
  assert.equal(dispatch(state, { type: 'Move', playerId: 'player', unitId: 'p-tank', to: { x: 2, y: 4 } }).error.code, 'UNIT_DISABLED');
  assert.deepEqual(first.steps[12].events[0], { type: 'UnitRecovered', unitId: 'p-tank', activeTeam: 'player', turn: 3 });
  assert.equal(unit(first.state, 'p-tank').disabled, false);
});

test('a second D destroys a disabled vehicle; infantry D loses one HP without a recovery deadline', () => {
  const vehicle = play(secondDScenario, SECOND_D_SEED, secondDCommands);
  const secondD = vehicle.steps[8];
  assert.equal(vehicle.steps[1].events[0].result, 'D');
  assert.equal(secondD.events[0].result, 'D');
  assert.equal(unit(secondD.state, 'e-tank').hp, 0);
  const infantryD = play(infantryDScenario, INFANTRY_D_SEED, infantryDCommands).steps[1];
  assert.equal(infantryD.events[0].result, 'D');
  assert.equal(unit(infantryD.state, 'e-tank').hp, 2);
  assert.equal(unit(infantryD.state, 'e-tank').disabled, false);
  assert.equal(unit(infantryD.state, 'e-tank').disabledUntil, 0);
});

test('terrain and LOS branch separates geometric range, visibility and legal fire', () => {
  const first = play(terrainLosScenario, TERRAIN_LOS_SEED, terrainLosCommands);
  assert.deepEqual(first, play(terrainLosScenario, TERRAIN_LOS_SEED, terrainLosCommands));
  const fire = first.steps[0].state;
  const areas = queryAreas(fire, 'p-tank');
  assert.ok(has(areas.fireRange, 3, 3));
  assert.ok(has(areas.lineOfSight, 2, 3));
  assert.ok(!has(areas.lineOfSight, 3, 3));
  assert.deepEqual(areas.attackableTargets, []);
  assert.equal(first.steps[1].error.code, 'TARGET_NOT_ATTACKABLE');
  assert.deepEqual(first.state.rng, { seed: TERRAIN_LOS_SEED, state: TERRAIN_LOS_SEED });
});

test('rejected v2 commands preserve the complete input and every offered move is accepted', () => {
  const initial = createGame(phaseScenario, PHASE_SEED);
  const disabled = structuredClone(initial);
  unit(disabled, 'p-tank').disabled = true;
  unit(disabled, 'p-tank').disabledUntil = 3;
  const destroyed = structuredClone(initial);
  unit(destroyed, 'p-tank').hp = 0;
  const cases = [
    [initial, { type: 'Move', playerId: 'enemy', unitId: 'p-tank', to: { x: 2, y: 4 } }, 'NOT_ACTIVE_TEAM'],
    [disabled, { type: 'Move', playerId: 'player', unitId: 'p-tank', to: { x: 2, y: 4 } }, 'UNIT_DISABLED'],
    [destroyed, { type: 'Move', playerId: 'player', unitId: 'p-tank', to: { x: 2, y: 4 } }, 'UNIT_DESTROYED'],
    [initial, { type: 'Move', playerId: 'player', unitId: 'p-tank', to: { x: -1, y: 4 } }, 'OUT_OF_BOUNDS'],
    [initial, { type: 'Move', playerId: 'player', unitId: 'p-tank', to: { x: 4, y: 4 } }, 'UNREACHABLE'],
  ];
  for (const [state, command, code] of cases) {
    const before = JSON.stringify(state);
    const result = dispatch(state, command);
    assert.equal(result.error.code, code);
    assert.deepEqual(Object.keys(result), ['error']);
    assert.equal(JSON.stringify(state), before);
  }
  for (const target of queryAreas(initial, 'p-gev').movementReachable) {
    assert.equal(dispatch(initial, { type: 'Move', playerId: 'player', unitId: 'p-gev', to: target }).events[0].type, 'UnitMoved');
  }
});
