import { createGame, dispatch, queryAreas, referenceScenario, REFERENCE_SEED } from '../core/game-core.mjs';
import { createHexRenderer } from './renderer.mjs';

let state = createGame(referenceScenario, REFERENCE_SEED);
let selectedUnitId = null, focusedCell = null, areaMode = 'movement', gridVisible = false, events = [];
const $ = selector => document.querySelector(selector);
const same = (a, b) => a?.x === b?.x && a?.y === b?.y;

function issue(command) {
  const result = dispatch(state, { playerId: state.activeTeam, ...command });
  if (result.error) $('#status').textContent = `Abgelehnt: ${result.error.code}`;
  else {
    state = result.state; events = result.events;
    $('#log').prepend(Object.assign(document.createElement('div'), { textContent: result.events.map(e => e.type).join(', ') }));
    $('#status').textContent = result.events.map(e => e.type).join(', ');
  }
  render();
}
const renderer = createHexRenderer({ svg: $('#map'), onPick(pick) {
  focusedCell = pick.cell;
  const clicked = pick.type === 'unit' ? state.units.find(u => u.id === pick.unitId) : state.units.find(u => u.hp > 0 && same(u, pick.cell));
  const selected = state.units.find(u => u.id === selectedUnitId);
  if (selected && clicked?.team !== state.activeTeam && clicked && state.phase === 'fire') {
    issue({ type: 'Fire', unitId: selected.id, targetId: clicked.id }); return;
  }
  if (clicked?.team === state.activeTeam) selectedUnitId = clicked.id;
  else if (selected && !clicked && (state.phase === 'movement' || state.phase === 'gev')) {
    issue({ type: 'Move', unitId: selected.id, to: pick.cell }); return;
  } else selectedUnitId = null;
  $('#status').textContent = selectedUnitId ? `${selectedUnitId} gewählt` : `Feld ${pick.cell.x},${pick.cell.y}`;
  render();
} });

function render() {
  const selected = state.units.find(u => u.id === selectedUnitId);
  renderer.render({ state, view: { selectedUnitId, focusedCell, areaMode, gridVisible }, areas: selected ? queryAreas(state, selected.id) : {}, events });
  $('#phase').textContent = `${state.activeTeam} · ${state.phase} · Zug ${state.turn}`;
  if (state.victory.status === 'ended') $('#status').textContent = `Partie beendet · ${state.victory.winner} gewinnt`;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === areaMode)));
  $('#grid').setAttribute('aria-pressed', String(gridVisible));
}
$('#next').addEventListener('click', () => { selectedUnitId = null; issue({ type: 'EndPhase' }); });
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { areaMode = button.dataset.mode; render(); }));
$('#grid').addEventListener('click', () => { gridVisible = !gridVisible; render(); });
render();
