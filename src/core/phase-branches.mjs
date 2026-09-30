import { phaseScenario } from './phase-fixture.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const end = playerId => ({ type: 'EndPhase', playerId });

// Enemy D on a player vehicle in turn 1: the player must wait until turn 3.
export const ENEMY_D_SEED = 5;
export const enemyDScenario = (() => {
  const scenario = copy(phaseScenario);
  scenario.scenarioVersion = 'phase-v2-enemy-d';
  Object.assign(scenario.units.find(unit => unit.id === 'e-tank'), { x: 3, y: 4, range: 3 });
  return scenario;
})();
export const enemyDCommands = Object.freeze([
  end('player'), end('player'), end('player'), end('enemy'),
  { type: 'Fire', playerId: 'enemy', unitId: 'e-tank', targetId: 'p-tank' },
  end('enemy'), end('enemy'),
  end('player'), end('player'), end('player'),
  end('enemy'), end('enemy'), end('enemy'),
]);

// Both consecutive 1-1 combat rolls are D (seed 10 yields rolls 3, then 2).
export const SECOND_D_SEED = 10;
export const secondDScenario = (() => {
  const scenario = copy(phaseScenario);
  scenario.scenarioVersion = 'phase-v2-second-d';
  return scenario;
})();
export const secondDCommands = Object.freeze([
  end('player'),
  { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' },
  end('player'), end('player'),
  end('enemy'), end('enemy'), end('enemy'),
  end('player'),
  { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' },
]);

export const INFANTRY_D_SEED = 5;
export const infantryDScenario = (() => {
  const scenario = copy(phaseScenario);
  scenario.scenarioVersion = 'phase-v2-infantry-d';
  scenario.units.find(unit => unit.id === 'e-tank').type = 'infantry';
  return scenario;
})();
export const infantryDCommands = Object.freeze([
  end('player'),
  { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' },
]);

// The mountain is visible itself, but hides the enemy tank immediately behind it.
export const TERRAIN_LOS_SEED = 5;
export const terrainLosScenario = (() => {
  const scenario = copy(phaseScenario);
  scenario.scenarioVersion = 'phase-v2-terrain-los';
  scenario.map.terrain = [{ x: 2, y: 3, type: 'mountain' }];
  Object.assign(scenario.units.find(unit => unit.id === 'p-tank'), { x: 1, y: 3 });
  Object.assign(scenario.units.find(unit => unit.id === 'e-tank'), { x: 3, y: 3 });
  return scenario;
})();
export const terrainLosCommands = Object.freeze([
  end('player'),
  { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' },
]);
