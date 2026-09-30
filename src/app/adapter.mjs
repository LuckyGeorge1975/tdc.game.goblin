// ARCH-01 boundary: only dispatch may replace GameState. Everything else is view state.
const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y;
const hasCell = (cells, cell) => cells?.some((candidate) => sameCell(candidate, cell));

export function createGameAdapter({ core, initialState }) {
  if (!core?.dispatch || !core?.queryAreas) throw new TypeError('Core requires dispatch and queryAreas');
  let state = initialState;
  let view = { selectedUnitId: null, focusedCell: null, hoverCell: null, areaMode: 'movement', cargoMode: null, styleSetId: 'verdant', gridVisible: false, mapPan: { x: 0, y: 0 }, mapZoom: 1, pendingIntent: null, intentError: null };
  let events = [];
  let error = null;
  const listeners = new Set();
  const commandListeners = new Set();
  const emit = () => {
    // Core events are a one-time delta, not persistent ViewState. A command may
    // be followed by a focus/selection render; that render must not replay it.
    const change = snapshot();
    events = [];
    listeners.forEach((listener) => listener(change));
  };
  const getUnit = (id) => state.units.find((unit) => unit.id === id);
  const liveAt = (cell) => state.units.find((unit) => unit.hp > 0 && sameCell(unit, cell));
  const playerId = () => state.activeTeam ?? state.currentTeam ?? 'player';
  const selected = () => getUnit(view.selectedUnitId);

  function snapshot() {
    const unit = selected();
    return {
      state,
      view: { ...view },
      selectedUnit: unit ?? null,
      focusedUnit: view.focusedCell ? liveAt(view.focusedCell) ?? null : null,
      areas: unit ? core.queryAreas(state, unit.id) : null,
      events,
      error,
    };
  }

  function updateView(patch) {
    view = { ...view, ...patch };
    error = null;
    emit();
    return snapshot();
  }

  function send(command) {
    view = { ...view, pendingIntent: null, intentError: null };
    const result = core.dispatch(state, command);
    if (result.error) {
      error = result.error;
      events = [];
    } else {
      state = result.state;
      events = result.events ?? [];
      error = null;
      if (events.some((event) => event.type === 'PhaseChanged')) {
        view = { ...view, areaMode: state.phase === 'fire' ? 'fire' : 'movement' };
      }
      // Keep focused intel, but never retain an invalid unit selection.
      if (view.selectedUnitId) {
        const chosen = getUnit(view.selectedUnitId);
        if (!chosen || chosen.hp <= 0 || chosen.team !== playerId() || state.phase === 'gev' && chosen.movementMode !== 'gev') {
          view = { ...view, selectedUnitId: null, cargoMode: null };
        }
      }
    }
    emit();
    commandListeners.forEach((listener) => listener({ command, result }));
    return result;
  }

  function selectUnit(id) {
    const unit = getUnit(id);
    if (!unit) return updateView({ selectedUnitId: null, cargoMode: null });
    const selectedUnitId = view.selectedUnitId === id ? null : id;
    return updateView({ selectedUnitId, focusedCell: { x: unit.x, y: unit.y }, cargoMode: null, pendingIntent: null, intentError: null });
  }

  function clickCell(cell) {
    const occupant = liveAt(cell);
    const unit = selected();
    if (view.cargoMode?.type === 'unload') {
      const command = { type: 'Unload', playerId: playerId(), unitId: view.cargoMode.unitId, carrierId: view.cargoMode.carrierId, to: cell };
      const result = send(command);
      if (!result.error) updateView({ cargoMode: null, focusedCell: cell });
      return result;
    }
    if (view.cargoMode?.type === 'load' && occupant) {
      const command = { type: 'Load', playerId: playerId(), unitId: occupant.id, carrierId: view.cargoMode.carrierId };
      const result = send(command);
      if (!result.error) updateView({ cargoMode: null, focusedCell: cell });
      return result;
    }
    if (unit && occupant?.team !== unit.team && occupant && state.phase === 'fire') {
      updateView({ focusedCell: cell });
      const result = send({ type: 'Fire', playerId: playerId(), unitId: unit.id, targetId: occupant.id });
      return result;
    }
    if (occupant) return selectUnit(occupant.id);
    if (unit?.team === playerId() && (state.phase === 'movement' || state.phase === 'gev')) {
      const areas = core.queryAreas(state, unit.id);
      if (hasCell(areas.movementReachable, cell)) {
        updateView({ focusedCell: cell });
        const result = send({ type: 'Move', playerId: playerId(), unitId: unit.id, to: cell });
        return result;
      }
    }
    return updateView({ selectedUnitId: null, focusedCell: cell, cargoMode: null });
  }

  return {
    snapshot,
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    subscribeCommand(listener) { commandListeners.add(listener); return () => commandListeners.delete(listener); },
    selectUnit,
    clickRoster: selectUnit,
    clickCell,
    focusCell(cell) { return updateView({ focusedCell: cell }); },
    setPendingIntent(pendingIntent, intentError = null) { return updateView({ pendingIntent, intentError }); },
    setHover(cell) { return updateView({ hoverCell: cell }); },
    setAreaMode(areaMode) { return updateView({ areaMode }); },
    setStyleSet(styleSetId) { return updateView({ styleSetId }); },
    setGridVisible(gridVisible) { return updateView({ gridVisible: Boolean(gridVisible) }); },
    setMapTransform(mapPan, mapZoom) { return updateView({ mapPan: { x: mapPan.x, y: mapPan.y }, mapZoom }); },
    beginLoad(carrierId) { return updateView({ cargoMode: { type: 'load', carrierId } }); },
    beginUnload(carrierId, unitId) { return updateView({ cargoMode: { type: 'unload', carrierId, unitId } }); },
    endPhase() { return send({ type: 'EndPhase', playerId: playerId() }); },
    dispatch: send,
  };
}
