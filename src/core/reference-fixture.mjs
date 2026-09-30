// Shared, browser-independent ARCH-01 fixture. UI selection is deliberately absent.
export const REFERENCE_SEED = 0x0b11a1;

export const referenceScenario = Object.freeze({
  rulesVersion: 'core-v1',
  scenarioVersion: 'reference-v1',
  map: {
    width: 12,
    height: 8,
    terrain: [{ x: 2, y: 3, type: 'mountain' }, { x: 6, y: 3, type: 'water' }],
  },
  units: [
    { id: 'p-1', type: 'tank', team: 'player', x: 1, y: 3, hp: 3, maxHp: 3, defense: 3, move: 3, range: 3, damage: 5, movementMode: 'tracked' },
    { id: 'p-2', type: 'tank', team: 'player', x: 1, y: 5, hp: 3, maxHp: 3, defense: 3, move: 3, range: 4, damage: 5, movementMode: 'tracked' },
    { id: 'e-1', type: 'tank', team: 'enemy', x: 4, y: 3, hp: 2, maxHp: 2, defense: 2, move: 3, range: 2, damage: 2, movementMode: 'tracked' },
    { id: 'e-core', type: 'core', team: 'enemy', x: 4, y: 5, hp: 1, maxHp: 1, defense: 1, move: 0, range: 0, damage: 0, movementMode: 'fixed', core: true },
  ],
});

export const referenceCommands = Object.freeze([
  { type: 'Move', playerId: 'player', unitId: 'p-1', to: { x: 2, y: 4 } },
  { type: 'Move', playerId: 'player', unitId: 'p-1', to: { x: 11, y: 7 } }, // rejected, no state/RNG change
  { type: 'EndPhase', playerId: 'player' },
  { type: 'Fire', playerId: 'player', unitId: 'p-1', targetId: 'e-1' },
  { type: 'Fire', playerId: 'player', unitId: 'p-2', targetId: 'e-core' },
]);
