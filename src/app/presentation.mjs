// Display-only projection. Rules and legal areas remain exclusively in Core.
export const UNIT_STATUS = Object.freeze({
  destroyed: 'destroyed',
  disabled: 'disabled',
  unavailable: 'no-action-this-phase',
  spent: 'action-spent',
  ready: 'ready',
});

export const AREA_MODE = Object.freeze({
  movement: 'movementReachable',
  fire: 'fireRange',
  sight: 'lineOfSight',
});

const nextPhaseLabel = (next) => next?.phase === 'fire' ? 'Zur Fire Phase →'
  : next?.phase === 'gev' ? 'Zum Skimmer-Manöver →'
    : next ? `Zur ${next.activeTeam === 'player' ? 'Player' : 'Enemy'} Movement →` : 'Partie beendet';

export function derivePresentation(state, core) {
  const actionSummary = core.queryActions(state);
  const byUnitId = {};
  const counts = { ready: 0, total: 0, destroyed: 0, disabled: 0, unavailable: 0, spent: 0 };
  for (const unit of state.units) {
    const areas = core.queryAreas(state, unit.id);
    const actions = actionSummary.units[unit.id];
    let status;
    if (unit.hp <= 0) status = UNIT_STATUS.destroyed;
    else if (unit.disabled) status = UNIT_STATUS.disabled;
    else if (unit.team !== state.activeTeam || state.victory?.status === 'ended') status = UNIT_STATUS.unavailable;
    else {
      const action = state.phase === 'fire' ? actions.fire : actions.move;
      status = action.available ? UNIT_STATUS.ready
        : action.reason === 'ACTION_SPENT' ? UNIT_STATUS.spent : UNIT_STATUS.unavailable;
    }
    byUnitId[unit.id] = { status, areas, actions };
    if (unit.team === state.activeTeam) {
      counts.total++;
      if (status === UNIT_STATUS.ready) counts.ready++;
      else if (status === UNIT_STATUS.destroyed) counts.destroyed++;
      else if (status === UNIT_STATUS.disabled) counts.disabled++;
      else if (status === UNIT_STATUS.spent) counts.spent++;
      else counts.unavailable++;
    }
  }
  return {
    byUnitId,
    counts,
    phaseLabel: `${state.activeTeam === 'player' ? 'Player' : 'Enemy'} · ${state.phase === 'gev' ? 'Skimmer-Manöver' : `${state.phase} phase`}`,
    phaseButton: {
      label: nextPhaseLabel(actionSummary.endPhase.next),
      disabled: !actionSummary.endPhase.available,
      pendingActions: actionSummary.endPhase.pendingUnitIds.length,
    },
    defaultAreaMode: state.phase === 'fire' ? 'fire' : 'movement',
  };
}
