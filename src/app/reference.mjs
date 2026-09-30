import { createGameAdapter } from './adapter.mjs';
import { createPhaseState, createReferenceState, referenceMockCore } from './mock-core.mjs';
import { AREA_MODE, derivePresentation } from './presentation.mjs';
import { phaseCommands } from '../core/game-core.mjs';
import { createHexRenderer } from '../hex-renderer/renderer.mjs';
import { loadTerrainPackage } from './terrain-assets.mjs';

const params = new URLSearchParams(location.search);
const phaseFixture = params.get('scenario') === 'phase-v2';
const terrainStudy = params.get('terrain') === 'study';
const adapter = createGameAdapter({ core: referenceMockCore, initialState: phaseFixture ? createPhaseState() : createReferenceState() });
if (phaseFixture && params.has('harness')) {
  const trace = [];
  adapter.subscribeCommand(({ command, result }) => {
    trace.push(structuredClone({ command, result, state: adapter.snapshot().state }));
  });
  globalThis.__goblinHarness = Object.freeze({
    snapshot: () => structuredClone(adapter.snapshot()),
    dispatch: (command) => adapter.dispatch(command),
    trace: () => structuredClone(trace),
    fixtureCommands: () => structuredClone(phaseCommands),
  });
}
const $ = (id) => document.getElementById(id);
const cellKey = ({ x, y }) => `${x},${y}`;
const statusLabel = { ready: 'bereit', 'action-spent': 'Aktion verbraucht', 'no-action-this-phase': 'keine Aktion in dieser Phase', disabled: 'DISABLED', destroyed: 'zerstört' };
let terrainAssets = null;
let terrainError = null;
if (terrainStudy) {
  try { terrainAssets = await loadTerrainPackage(); }
  catch (error) { terrainError = error; }
}
const terrainRenderer = terrainAssets ? createHexRenderer({ svg: $('terrain-map'), onPick: ({ cell }) => adapter.clickCell(cell) }) : null;
if (terrainAssets) {
  $('map').hidden = true;
  $('terrain-map').removeAttribute('hidden');
  $('terrain-controls').hidden = false;
  for (const option of $('terrain-set').options) option.textContent = terrainAssets.styleSets[option.value].name;
}

$('scenario').textContent = terrainStudy ? 'ARCH-03 · TERRAIN-VORSCHAU' : phaseFixture ? 'ARCH-02 · PHASENPARTIE' : 'ARCH-01 · REFERENZPARTIE';
$('instructions').textContent = terrainStudy
  ? 'Gleiche Core-v1-Partie, zwei Materialsets. Stilset und Hexraster ändern nur die Ansicht. Einheit oder Feld auf der Karte wählen.'
  : phaseFixture
  ? 'Beide Teams werden von Hand gesteuert. Skimmer wählen → bewegen → Fire Phase → GEV Phase → erneut bewegen. Das deaktivierte Fahrzeug erholt sich zu seinem festgelegten Teamstart.'
  : 'Einheit wählen → erreichbares Feld anklicken → Phase wechseln → Ziel anklicken.';

function eventLabel(event) {
  if (event.type === 'UnitRecovered') return `${event.unitId}: wieder einsatzbereit (Team ${event.activeTeam}, Zug ${event.turn})`;
  if (event.type === 'ShotResolved' && event.result === 'D' && event.disabled) return `${event.targetId}: DISABLED (${event.type})`;
  return `${event.type}: ${JSON.stringify(event)}`;
}

function render({ state, view, selectedUnit, focusedUnit, areas, events, error }) {
  const presentation = derivePresentation(state, referenceMockCore);
  $('phase').textContent = presentation.phaseLabel;
  $('turn').textContent = `Zug ${state.turn}`;
  $('phase-count').textContent = ` · Bereit ${presentation.counts.ready}/${presentation.counts.total}`;
  $('end-phase').textContent = presentation.phaseButton.label;
  $('end-phase').disabled = presentation.phaseButton.disabled;
  $('roster').replaceChildren(...state.units.map((unit) => {
    const button = document.createElement('button');
    button.type = 'button';
    const status = presentation.byUnitId[unit.id].status;
    button.className = `unit ${unit.team === 'enemy' ? 'enemy' : ''} ${status} ${view.selectedUnitId === unit.id ? 'active' : ''}`;
    button.textContent = `${unit.id} · ${unit.type} · ${unit.hp}/${unit.maxHp} HP · ${statusLabel[status]}`;
    button.onclick = () => adapter.clickRoster(unit.id);
    return button;
  }));
  document.querySelectorAll('[data-area]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.area === view.areaMode)));
  const terrain = new Map(state.map.terrain.map((tile) => [cellKey(tile), tile.type]));
  if (terrainRenderer) {
    terrainRenderer.render({ state, view, areas: areas ?? {}, events, visualMap: terrainAssets.visualMap, styleSet: terrainAssets.styleSets[view.styleSetId] });
    $('terrain-set').value = view.styleSetId;
    $('terrain-grid').setAttribute('aria-pressed', String(view.gridVisible));
  } else {
    const highlighted = new Set(areas?.[AREA_MODE[view.areaMode]]?.map(cellKey) ?? []);
    const targets = new Set(areas?.attackableTargets ?? []);
    const cells = [];
    for (let y = 0; y < state.map.height; y++) for (let x = 0; x < state.map.width; x++) {
      const cell = { x, y };
      const unit = state.units.find((candidate) => candidate.hp > 0 && candidate.x === x && candidate.y === y);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = ['hex', terrain.get(cellKey(cell)) ?? '', highlighted.has(cellKey(cell)) ? view.areaMode : '', view.focusedCell?.x === x && view.focusedCell?.y === y ? 'focus' : '', unit?.team === 'player' ? 'friendly' : unit ? 'hostile' : '', unit ? presentation.byUnitId[unit.id].status : '', targets.has(unit?.id) ? 'attackable' : ''].join(' ');
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', `Feld ${x + 1}, ${y + 1}${unit ? `: ${unit.type} ${unit.id}, ${statusLabel[presentation.byUnitId[unit.id].status]}` : ''}`);
      if (unit) {
        const icon = document.createElement('b');
        icon.textContent = unit.type === 'core' ? '◆' : unit.team === 'player' ? '▲' : '▼';
        const label = document.createElement('small');
        label.textContent = unit.id;
        button.append(icon, label);
      } else {
        const label = document.createElement('small');
        label.textContent = `${x + 1}:${y + 1}`;
        button.append(label);
      }
      button.onclick = () => adapter.clickCell(cell);
      cells.push(button);
    }
    $('map').replaceChildren(...cells);
    $('map').style.gridTemplateColumns = `repeat(${state.map.width}, minmax(26px, 1fr))`;
  }
  const tile = view.focusedCell && terrain.get(cellKey(view.focusedCell));
  $('intel').textContent = view.focusedCell ? `Feld ${view.focusedCell.x + 1}, ${view.focusedCell.y + 1} · ${tile ?? 'open'}${focusedUnit ? ` | ${focusedUnit.id}, ${focusedUnit.hp} HP, ${focusedUnit.team}` : ''}` : 'Feld oder Einheit anklicken.';
  $('status').textContent = terrainError ? `Terrainpaket nicht geladen: ${terrainError.message}` : error ? `Abgelehnt: ${error.code}` : state.victory.status === 'ended' ? `Sieg: ${state.victory.winner}` : selectedUnit ? `${selectedUnit.id} gewählt · ${view.areaMode}` : 'Keine Einheit gewählt';
  if (events.length) $('events').replaceChildren(...events.map((event) => { const li = document.createElement('li'); li.textContent = eventLabel(event); return li; }), ...$('events').children);
}

adapter.subscribe(render);
$('end-phase').onclick = () => adapter.endPhase();
document.querySelectorAll('[data-area]').forEach((button) => button.onclick = () => adapter.setAreaMode(button.dataset.area));
$('terrain-set').onchange = ({ target }) => adapter.setStyleSet(target.value);
$('terrain-grid').onclick = () => adapter.setGridVisible(!adapter.snapshot().view.gridVisible);
