import { createGameAdapter } from './adapter.mjs';

const sameCell = (a, b) => a?.x === b?.x && a?.y === b?.y;

// Product input mode: a map pick is only a view update. Confirmation alone dispatches.
export function createSafeGameAdapter({ core, initialState }) {
  if (typeof core?.queryCommand !== 'function' || typeof core?.queryActions !== 'function') {
    throw new TypeError('Core requires queryCommand and queryActions');
  }
  const app = createGameAdapter({ core, initialState });

  function pickCell(cell) {
    const { state, selectedUnit, view } = app.snapshot();
    const occupant = state.units.find(unit => unit.hp > 0 && !unit.embarkedOn && sameCell(unit, cell));
    if (occupant?.team === state.activeTeam && occupant.id !== view.selectedUnitId) return app.selectUnit(occupant.id);
    if (occupant?.id === view.selectedUnitId) return app.selectUnit(occupant.id);
    app.focusCell(cell);
    if (!selectedUnit || selectedUnit.team !== state.activeTeam) return app.setPendingIntent(null);
    const command = occupant
      ? { type: 'Fire', playerId: state.activeTeam, unitId: selectedUnit.id, targetId: occupant.id }
      : { type: 'Move', playerId: state.activeTeam, unitId: selectedUnit.id, to: { x: cell.x, y: cell.y } };
    const probe = core.queryCommand(state, command);
    return app.setPendingIntent(probe.available ? command : null, probe.error ?? null);
  }

  function confirmIntent() {
    const { state, view } = app.snapshot();
    const command = view.pendingIntent;
    if (!command) return { error: { code: 'NO_PENDING_INTENT', details: {} } };
    const probe = core.queryCommand(state, command);
    if (!probe.available) {
      app.setPendingIntent(null, probe.error);
      return { error: probe.error };
    }
    return app.dispatch(command);
  }

  return {
    ...app,
    pickCell,
    confirmIntent,
    cancelIntent() { return app.setPendingIntent(null); },
    actions() { return core.queryActions(app.snapshot().state); },
  };
}
