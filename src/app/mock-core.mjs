// Compatibility wrapper for the isolated reference UI. The Core is now the only rule source.
import { createGame, dispatch, queryAreas, queryActions, queryCommand, referenceScenario, REFERENCE_SEED, phaseScenario, PHASE_SEED } from '../core/game-core.mjs';

export function createReferenceState() {
  return createGame(referenceScenario, REFERENCE_SEED);
}

export function createPhaseState() {
  return createGame(phaseScenario, PHASE_SEED);
}

export { dispatch, queryAreas, queryActions, queryCommand };
export const referenceMockCore = { dispatch, queryAreas, queryActions, queryCommand };
