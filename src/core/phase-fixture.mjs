// Browser-independent second-slice fixture. Every command is explicit, including rejections.
export const PHASE_SEED = 5;

export const phaseScenario = Object.freeze({
  rulesVersion: 'core-v2',
  scenarioVersion: 'phase-v2',
  map: { width: 8, height: 6, terrain: [] },
  units: [
    { id: 'p-gev', type: 'tank', team: 'player', x: 1, y: 1, hp: 3, maxHp: 3, defense: 3, move: 3, range: 2, damage: 1, movementMode: 'gev' },
    { id: 'p-tank', type: 'tank', team: 'player', x: 1, y: 4, hp: 3, maxHp: 3, defense: 3, move: 2, range: 4, damage: 2, movementMode: 'tracked' },
    { id: 'e-tank', type: 'tank', team: 'enemy', x: 4, y: 4, hp: 3, maxHp: 3, defense: 2, move: 2, range: 2, damage: 2, movementMode: 'tracked' },
    { id: 'e-core', type: 'core', team: 'enemy', x: 7, y: 5, hp: 3, maxHp: 3, defense: 3, move: 0, range: 0, damage: 0, movementMode: 'fixed', core: true },
  ],
});

export const phaseCommands = Object.freeze([
  { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 2, y: 1 } },
  { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 3, y: 1 } },
  { type: 'EndPhase', playerId: 'player' },
  { type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId: 'e-tank' },
  { type: 'EndPhase', playerId: 'player' },
  { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 5, y: 1 } },
  { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 4, y: 1 } },
  { type: 'Move', playerId: 'player', unitId: 'p-gev', to: { x: 5, y: 1 } },
  { type: 'EndPhase', playerId: 'player' },
  { type: 'Move', playerId: 'enemy', unitId: 'e-tank', to: { x: 3, y: 4 } },
  { type: 'EndPhase', playerId: 'enemy' },
  { type: 'EndPhase', playerId: 'enemy' },
  { type: 'EndPhase', playerId: 'enemy' },
  { type: 'EndPhase', playerId: 'player' },
  { type: 'EndPhase', playerId: 'player' },
  { type: 'EndPhase', playerId: 'player' },
]);

// Expected per-command event names or rejection, followed by resulting phase/team/turn.
// The core test also compares full events, states and RNG across two complete replays.
export const expectedPhaseTrace = Object.freeze([
  ['UnitMoved', 'movement', 'player', 1],
  ['ACTION_SPENT', 'movement', 'player', 1],
  ['PhaseChanged', 'fire', 'player', 1],
  ['ShotResolved', 'fire', 'player', 1],
  ['PhaseChanged', 'gev', 'player', 1],
  ['UNREACHABLE', 'gev', 'player', 1],
  ['UnitMoved', 'gev', 'player', 1],
  ['ACTION_SPENT', 'gev', 'player', 1],
  ['PhaseChanged', 'movement', 'enemy', 1],
  ['UNIT_DISABLED', 'movement', 'enemy', 1],
  ['PhaseChanged', 'fire', 'enemy', 1],
  ['PhaseChanged', 'gev', 'enemy', 1],
  ['PhaseChanged', 'movement', 'player', 2],
  ['PhaseChanged', 'fire', 'player', 2],
  ['PhaseChanged', 'gev', 'player', 2],
  ['UnitRecovered,PhaseChanged', 'movement', 'enemy', 2],
]);
