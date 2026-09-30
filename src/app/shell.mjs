import { createSafeGameAdapter } from './safe-adapter.mjs';
import { createPhaseState, createReferenceState, referenceMockCore } from './mock-core.mjs';
import { derivePresentation } from './presentation.mjs';
import { createShellText } from './shell-text.mjs';
import { createHexRenderer } from '../hex-renderer/renderer.mjs';
import { loadTerrainPackage } from './terrain-assets.mjs';
import { createQaProbe } from './qa-probe.mjs';

const $ = id => document.getElementById(id);
const language = globalThis.GoblinLanguage;
await language.ready;
const t = createShellText(language);
const missions = ['reference-v1', 'phase-v2'];
let route = 'start', returnRoute = 'start', mission = 'reference-v1', app = null;
let terrain = null, terrainMode = 'hex', detail = 'units', rememberPhase = false;
let preferredTerrainMode = 'hex', preferredGridVisible = false, confirmPhaseEnabled = true;
let dialogAction = null, dialogOrigin = null, dialogCopy = null, log = [];
const qaProbe = new URLSearchParams(location.search).has('qa') ? createQaProbe() : null;
if (qaProbe) Object.defineProperty(globalThis, '__GOBLIN_QA__', { value: qaProbe, writable: false, configurable: false });
const map = $('battle-map');
const viewport = $('map-viewport');
const sameCell = (a, b) => a?.x === b?.x && a?.y === b?.y;
const hasCell = (cells, cell) => cells?.some(candidate => sameCell(candidate, cell));
function mapState(cell, unit, { view, areas }) {
  const states = [];
  if (unit?.id === view.selectedUnitId) states.push(t('ui.map.selected'));
  if (sameCell(cell, view.focusedCell)) states.push(t('ui.map.focused'));
  if (hasCell(areas?.movementReachable, cell)) states.push(t('ui.map.reachable'));
  if (unit && areas?.attackableTargets?.includes(unit.id)) states.push(t('ui.map.target'));
  if (unit?.disabled) states.push(t('ui.map.disabled'));
  return states.length ? ` · ${states.join(' · ')}` : '';
}
const renderer = createHexRenderer({
  svg: map,
  onPick: ({ cell }) => { if (route === 'game' && !$('confirm-dialog').open && !$('objective-dialog').open && !$('details-dialog').open) app?.pickCell(cell); },
  accessibility: {
    cellLabel: (cell, context) => {
      const unit = context.state.units.find(candidate => candidate.hp > 0 && !candidate.embarkedOn && sameCell(candidate, cell));
      const base = unit ? t('ui.hud.cellUnit', { x: cell.x + 1, y: cell.y + 1, unitId: unit.id, hp: unit.hp }) : t('ui.hud.cell', { x: cell.x + 1, y: cell.y + 1 });
      return base + mapState(cell, unit, context);
    },
    unitLabel: (unit, context) => `${t('ui.hud.unitSummary', { unitId: unit.id, unitType: unitType(unit.type), hp: unit.hp, maxHp: unit.maxHp })} · ${teamText(unit.team)} · ${t('ui.hud.cell', { x: unit.x + 1, y: unit.y + 1 })}${mapState(unit, unit, context)}`,
  },
});
try { terrain = await loadTerrainPackage(); }
catch (error) { console.warn('Terrain package unavailable; using hex map:', error); }

function text(id, value) { $(id).textContent = value; }
function show(name) {
  route = name;
  document.querySelectorAll('.screen').forEach(screen => { screen.hidden = screen.id !== `screen-${name}`; });
  if (name === 'game') renderGame();
  else renderScreen();
  document.querySelector(`#screen-${name} button:not([hidden])`)?.focus();
}
function title(id) { return language.t(`mission.${id}.title`); }
function missionText(id, part) { return language.t(`mission.${id}.${part}`); }
function phaseText(phase) { return language.t(`phase.${phase}.label`); }
function errorText(error) {
  const key = `ui.error.${error?.code}`;
  return language.t(key) === key ? t('ui.error.unknown') : t(key);
}
function unitType(type) { return t(`ui.unit.${type}`); }
function teamText(team) { return t(`ui.team.${team}`); }
function eventText(event) {
  switch (event.type) {
    case 'UnitMoved': return t('ui.log.UnitMoved', { unitId: event.unitId, x: event.to.x + 1, y: event.to.y + 1 });
    case 'PhaseChanged': return t('ui.log.PhaseChanged', { turn: event.turn, team: teamText(event.activeTeam), phase: phaseText(event.to) });
    case 'ShotResolved': return t('ui.log.ShotResolved', { attackerId: event.attackerId, targetId: event.targetId, result: t(`ui.log.result.${event.result}`) });
    case 'UnitRecovered': return t('ui.log.UnitRecovered', { unitId: event.unitId });
    case 'GameEnded': return t('ui.log.GameEnded', { team: teamText(event.winner) });
    default: return t('ui.error.unknown');
  }
}
function setText() {
  document.title = t('ui.shell.title');
  document.querySelector('.build').textContent = t('ui.build.internal');
  $('battle-map').setAttribute('aria-label', t('ui.hud.map'));
  $('zoom-in').setAttribute('aria-label', t('ui.hud.zoomIn'));
  $('zoom-out').setAttribute('aria-label', t('ui.hud.zoomOut'));
  $('terrain-set').setAttribute('aria-label', t('ui.hud.terrain'));
  $('terrain-set').querySelector('option[value="hex"]').textContent = t('ui.hud.hex');
  text('start-eyebrow', t('ui.start.eyebrow'));
  text('start-title', t('ui.start.title')); text('start-subtitle', t('ui.start.subtitle'));
  text('choose-mission', t('ui.start.choose')); text('start-settings', t('ui.nav.settings')); text('start-help', t('ui.nav.help'));
  text('levels-title', t('ui.levels.title')); text('begin-mission', t('ui.briefing.start'));
  text('pause', t('ui.nav.pause')); text('pause-title', t('ui.nav.pause')); text('resume', t('ui.nav.resume'));
  text('objective-toggle', t('ui.hud.objective')); text('objective-title', t('ui.hud.objective'));
  text('objective-close', t('ui.nav.close'));
  text('details-toggle', t('ui.hud.details')); text('details-close', t('ui.nav.close'));
  $('details-dialog').setAttribute('aria-label', t('ui.hud.details'));
  text('pause-settings', t('ui.nav.settings')); text('pause-help', t('ui.nav.help'));
  text('restart', t('ui.nav.restart')); text('missions', t('ui.nav.missions'));
  text('settings-title', t('ui.nav.settings')); text('settings-language-label', t('ui.settings.language'));
  text('settings-terrain-label', t('ui.hud.terrain')); text('settings-grid-label', t('ui.settings.grid'));
  text('settings-phase-label', t('ui.settings.confirmPhase'));
  text('settings-note', t('ui.settings.note')); text('help-title', language.t('screen.help.title'));
  text('retry', language.t('screen.missionEnd.action.retry')); text('end-missions', language.t('screen.missionEnd.action.chooseMission'));
  text('end-log', language.t('screen.missionEnd.action.log'));
  text('recenter', t('ui.hud.recenter')); text('grid', t('ui.hud.grid'));
  text('cancel-intent', t('ui.hud.intent.cancel')); text('confirm-intent', t('ui.hud.intent.confirm'));
  text('dialog-cancel', t('ui.dialog.cancel')); text('remember-label', language.t('dialog.phaseAdvance.remember'));
  document.querySelectorAll('.back').forEach(button => { button.textContent = t('ui.nav.back'); });
  document.querySelectorAll('[data-area]').forEach(button => { button.textContent = t(`ui.hud.overlay.${button.dataset.area === 'movement' ? 'move' : button.dataset.area}`); });
  document.querySelectorAll('[data-detail]').forEach(button => { button.textContent = t(`ui.details.${button.dataset.detail}`); });
  $('language').value = language.current;
  $('settings-terrain').querySelector('option[value="hex"]').textContent = t('ui.hud.hex');
}
function renderScreen() {
  setText();
  if (route === 'settings') {
    $('settings-terrain').value = app ? terrainMode : preferredTerrainMode;
    $('settings-grid').checked = preferredGridVisible;
    $('settings-phase').checked = confirmPhaseEnabled;
    for (const option of $('settings-terrain').options) option.disabled = option.value !== 'hex' && (!terrain || app && mission !== 'reference-v1');
  }
  if (route === 'levels') {
    $('mission-list').replaceChildren(...missions.map(id => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'mission-card';
      const name = document.createElement('strong'); name.textContent = title(id);
      const objective = document.createElement('span'); objective.textContent = missionText(id, 'objective.short');
      button.append(name, objective); button.onclick = () => { mission = id; show('briefing'); };
      return button;
    }));
  }
  if (route === 'briefing') {
    text('briefing-label', t('ui.levels.select')); text('briefing-title', title(mission));
    text('briefing-objective', missionText(mission, 'objective.full'));
    text('briefing-copy', missionText(mission, 'briefing.full'));
  }
  if (route === 'help') text('help-copy', language.t(`screen.help.${mission}.full`));
  if (route === 'end' && app) {
    const winner = app.snapshot().state.victory.winner;
    text('end-title', language.t(winner === 'player' ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title'));
    text('end-copy', winner === 'player' ? missionText(mission, 'end.victory') : language.t('screen.missionEnd.defeat.allUnits'));
  }
}
function startGame() {
  app = createSafeGameAdapter({ core: referenceMockCore, initialState: mission === 'phase-v2' ? createPhaseState() : createReferenceState() });
  qaProbe?.attach(app);
  terrainMode = mission === 'reference-v1' && terrain ? preferredTerrainMode : 'hex';
  detail = 'units'; log = []; rememberPhase = false;
  app.setStyleSet(terrainMode);
  app.setGridVisible(preferredGridVisible);
  app.subscribe(({ events, state }) => {
    if (events.length) log.unshift(...events);
    if (state.victory.status === 'ended' && route === 'game') { show('end'); return; }
    if (route === 'game') renderGame();
  });
  show('game');
}
function progress(state) {
  const core = state.units.find(unit => unit.team === 'enemy' && unit.type === 'core');
  return language.t('hud.objective.progress.core', { currentHp: core?.hp ?? 0, maxHp: core?.maxHp ?? 1 });
}
function applyTransform(view) { map.style.transform = `translate(${view.mapPan.x}px, ${view.mapPan.y}px) scale(${view.mapZoom})`; }
function renderGame() {
  if (!app || route !== 'game') return;
  setText();
  const { state, view, selectedUnit, focusedUnit, areas, events, error } = app.snapshot();
  const presentation = derivePresentation(state, referenceMockCore);
  text('game-mission', title(mission)); text('game-objective', missionText(mission, 'objective.short'));
  text('game-progress', progress(state)); text('game-phase', `${state.activeTeam === 'enemy' ? language.t('phase.enemy.label') + ' · ' : ''}${phaseText(state.phase)}`);
  if ($('objective-dialog').open) { text('objective-body', missionText(mission, 'objective.full')); text('objective-progress', progress(state)); }
  text('game-turn', t('ui.hud.turn', { turn: state.turn }));
  text('game-ready', t(presentation.counts.ready === 1 ? 'ui.hud.ready.one' : 'ui.hud.ready.other', { count: presentation.counts.ready }));
  text('selection-title', selectedUnit ? t('ui.hud.selected', { unitId: selectedUnit.id, hp: selectedUnit.hp }) : t('ui.hud.noSelection'));
  text('selection-detail', view.focusedCell ? t(focusedUnit ? 'ui.hud.cellUnit' : 'ui.hud.cell', { x: view.focusedCell.x + 1, y: view.focusedCell.y + 1, unitId: focusedUnit?.id, hp: focusedUnit?.hp }) : t('ui.hud.noIntent'));
  text('intent-detail', view.pendingIntent ? t(view.pendingIntent.type === 'Move' ? 'ui.hud.intent.move' : 'ui.hud.intent.fire', { x: view.pendingIntent.to?.x + 1, y: view.pendingIntent.to?.y + 1, targetId: view.pendingIntent.targetId }) : view.intentError || error ? t('ui.hud.blocked', { reason: errorText(view.intentError ?? error) }) : t('ui.hud.noIntent'));
  $('confirm-intent').hidden = !view.pendingIntent; $('cancel-intent').hidden = !view.pendingIntent;
  $('end-phase').disabled = !app.actions().endPhase.available;
  const next = app.actions().endPhase.next;
  const nextKey = next?.phase === 'fire' ? 'toFire' : next?.phase === 'gev' ? 'toGev' : next?.activeTeam === 'enemy' ? 'toEnemy' : 'toMovement';
  text('end-phase', language.t(`dialog.phaseAdvance.confirm.${nextKey}`));
  document.querySelectorAll('[data-area]').forEach(button => button.setAttribute('aria-pressed', String(view.areaMode === button.dataset.area)));
  document.querySelectorAll('[data-detail]').forEach(button => button.setAttribute('aria-pressed', String(detail === button.dataset.detail)));
  for (const name of ['units','intel','log']) $(`detail-${name}`).hidden = detail !== name;
  $('detail-units').replaceChildren(...state.units.map(unit => {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = t('ui.hud.unitSummary', { unitId: unit.id, unitType: unitType(unit.type), hp: unit.hp, maxHp: unit.maxHp });
    button.setAttribute('aria-pressed', String(view.selectedUnitId === unit.id));
    button.onclick = () => { app.selectUnit(unit.id); if ($('details-dialog').open) $('details-dialog').close(); }; return button;
  }));
  text('detail-intel', view.focusedCell ? t(focusedUnit ? 'ui.hud.unitIntel' : 'ui.hud.cell', { x: view.focusedCell.x + 1, y: view.focusedCell.y + 1, unitId: focusedUnit?.id, team: focusedUnit && teamText(focusedUnit.team), hp: focusedUnit?.hp }) : t('ui.hud.noIntent'));
  $('detail-log').replaceChildren(...log.map(entry => { const li = document.createElement('li'); li.textContent = eventText(entry); return li; }));
  $('grid').setAttribute('aria-pressed', String(view.gridVisible)); $('terrain-set').value = terrainMode;
  for (const option of $('terrain-set').options) option.disabled = option.value !== 'hex' && (!terrain || mission !== 'reference-v1');
  renderer.render({ state, view, areas: areas ?? {}, events, visualMap: terrainMode !== 'hex' ? terrain.visualMap : undefined, styleSet: terrainMode !== 'hex' ? terrain.styleSets[terrainMode] : undefined });
  applyTransform(view);
}
function renderDialog() {
  if (!dialogCopy) return;
  text('dialog-title', t(dialogCopy.titleKey));
  text('dialog-body', t(dialogCopy.bodyKey, dialogCopy.bodyParams));
  text('dialog-confirm', t(dialogCopy.confirmKey));
  text('dialog-cancel', t(dialogCopy.cancelKey));
}
function openDialog({ titleKey, bodyKey, bodyParams = {}, confirmKey, cancelKey, action, remember = false }) {
  const dialog = $('confirm-dialog'); if (dialog.open) return;
  dialogOrigin = document.activeElement; dialogAction = action;
  dialogCopy = { titleKey, bodyKey, bodyParams, confirmKey, cancelKey };
  renderDialog();
  $('remember-row').hidden = !remember; $('remember-phase').checked = false;
  dialog.showModal(); $('dialog-cancel').focus();
}
function closeDialog() { $('confirm-dialog').close(); dialogAction = null; dialogCopy = null; dialogOrigin?.focus(); }
function confirmPhase() {
  const { pendingUnitIds, next } = app.actions().endPhase;
  const key = next?.phase === 'fire' ? 'toFire' : next?.phase === 'gev' ? 'toGev' : next?.activeTeam === 'enemy' ? 'toEnemy' : 'toMovement';
  if (!confirmPhaseEnabled || rememberPhase) { app.endPhase(); return; }
  const pendingCount = pendingUnitIds.length;
  const bodyKey = pendingCount === 0 ? 'dialog.phaseAdvance.pending.none' : pendingCount === 1 ? 'dialog.phaseAdvance.pending.one' : 'dialog.phaseAdvance.pending.other';
  openDialog({ titleKey: 'dialog.phaseAdvance.title', bodyKey, bodyParams: { pendingCount }, confirmKey: `dialog.phaseAdvance.confirm.${key}`, cancelKey: 'dialog.phaseAdvance.cancel', remember: true, action: () => { rememberPhase = $('remember-phase').checked; app.endPhase(); } });
}
function confirmRestart() { openDialog({ titleKey: 'dialog.restart.title', bodyKey: 'dialog.restart.body', confirmKey: 'dialog.restart.confirm', cancelKey: 'dialog.restart.cancel', action: startGame }); }
function confirmMissionChange() { openDialog({ titleKey: 'dialog.changeMission.title', bodyKey: 'ui.dialog.leaveMission.body', confirmKey: 'dialog.changeMission.confirm', cancelKey: 'dialog.changeMission.cancel', action: () => { app = null; qaProbe?.attach(null); show('levels'); } }); }

$('choose-mission').onclick = () => show('levels');
document.querySelectorAll('[data-route]').forEach(button => { button.onclick = () => show(button.dataset.route); });
$('begin-mission').onclick = startGame;
$('pause').onclick = () => show('pause'); $('resume').onclick = () => show('game');
$('start-settings').onclick = () => { returnRoute = 'start'; show('settings'); };
$('pause-settings').onclick = () => { returnRoute = 'pause'; show('settings'); };
$('start-help').onclick = () => { returnRoute = 'start'; show('help'); };
$('pause-help').onclick = () => { returnRoute = 'pause'; show('help'); };
$('settings-back').onclick = () => show(returnRoute); $('help-back').onclick = () => show(returnRoute);
$('objective-toggle').onclick = () => {
  if (!app) return;
  text('objective-body', missionText(mission, 'objective.full'));
  text('objective-progress', progress(app.snapshot().state));
  $('objective-dialog').showModal(); $('objective-close').focus();
};
$('objective-close').onclick = () => $('objective-dialog').close();
$('objective-dialog').addEventListener('close', () => $('objective-toggle').focus());
$('details-toggle').onclick = () => {
  $('details-portal').append($('details'));
  $('details-dialog').showModal();
  $('details-close').focus();
};
$('details-close').onclick = () => $('details-dialog').close();
$('details-dialog').addEventListener('close', () => {
  document.querySelector('.game-layout').insertBefore($('details'), document.querySelector('.map-column'));
  $('details-toggle').focus();
});
$('restart').onclick = confirmRestart; $('missions').onclick = confirmMissionChange;
$('retry').onclick = startGame; $('end-missions').onclick = () => show('levels');
$('end-log').onclick = () => { detail = 'log'; show('game'); };
$('language').onchange = event => language.choose(event.target.value);
$('settings-terrain').onchange = event => {
  const mode = event.target.value;
  if (mode !== 'hex' && (!terrain || app && mission !== 'reference-v1')) { event.target.value = preferredTerrainMode; return; }
  preferredTerrainMode = mode;
  if (app) { terrainMode = mode; app.setStyleSet(mode); }
};
$('settings-grid').onchange = event => { preferredGridVisible = event.target.checked; app?.setGridVisible(preferredGridVisible); };
$('settings-phase').onchange = event => { confirmPhaseEnabled = event.target.checked; if (confirmPhaseEnabled) rememberPhase = false; };
window.addEventListener('goblin-language-change', () => { if (route === 'game') renderGame(); else renderScreen(); renderDialog(); });
$('confirm-intent').onclick = () => app.confirmIntent(); $('cancel-intent').onclick = () => app.cancelIntent();
$('end-phase').onclick = confirmPhase;
document.querySelectorAll('[data-area]').forEach(button => { button.onclick = () => app.setAreaMode(button.dataset.area); });
document.querySelectorAll('[data-detail]').forEach(button => { button.onclick = () => { detail = button.dataset.detail; renderGame(); }; });
$('grid').onclick = () => { preferredGridVisible = !app.snapshot().view.gridVisible; app.setGridVisible(preferredGridVisible); };
$('terrain-set').onchange = event => { terrainMode = event.target.value; preferredTerrainMode = terrainMode; app.setStyleSet(terrainMode); };
$('zoom-in').onclick = () => { const { view } = app.snapshot(); app.setMapTransform(view.mapPan, Math.min(2.5, view.mapZoom + .2)); };
$('zoom-out').onclick = () => { const { view } = app.snapshot(); app.setMapTransform(view.mapPan, Math.max(.6, view.mapZoom - .2)); };
$('recenter').onclick = () => app.setMapTransform({ x: 0, y: 0 }, 1);
$('dialog-cancel').onclick = closeDialog;
$('dialog-confirm').onclick = () => { const action = dialogAction; closeDialog(); action?.(); };
$('confirm-dialog').addEventListener('close', () => { dialogAction = null; dialogCopy = null; dialogOrigin?.focus(); });

const pointers = new Map();
let gesture = null, suppressClick = false;
function point(event) { return { x: event.clientX, y: event.clientY }; }
function pair() {
  const [a, b] = [...pointers.values()];
  return { midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}
function suppressGestureClick() { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
viewport.addEventListener('pointerdown', event => {
  if (event.button !== 0 || route !== 'game' || $('confirm-dialog').open || $('objective-dialog').open || $('details-dialog').open || event.target.closest('.map-tools')) return;
  pointers.set(event.pointerId, point(event));
  if (pointers.size === 1) {
    const { view } = app.snapshot();
    gesture = { type: 'pan', pointerId: event.pointerId, start: point(event), pan: view.mapPan, moved: false };
  } else if (pointers.size === 2) {
    const { view } = app.snapshot(), start = pair();
    gesture = { type: 'pinch', ...start, pan: view.mapPan, zoom: view.mapZoom };
    for (const id of pointers.keys()) viewport.setPointerCapture(id);
    viewport.classList.add('dragging');
  }
});
viewport.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, point(event));
  if (gesture?.type === 'pinch' && pointers.size >= 2) {
    const current = pair();
    const zoom = Math.max(.6, Math.min(2.5, gesture.zoom * current.distance / Math.max(1, gesture.distance)));
    const ratio = zoom / gesture.zoom;
    const rect = viewport.getBoundingClientRect(), center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const pan = {
      x: gesture.pan.x + current.midpoint.x - gesture.midpoint.x + (1 - ratio) * (gesture.midpoint.x - center.x - gesture.pan.x),
      y: gesture.pan.y + current.midpoint.y - gesture.midpoint.y + (1 - ratio) * (gesture.midpoint.y - center.y - gesture.pan.y),
    };
    app.setMapTransform(pan, zoom);
  } else if (gesture?.type === 'pan' && gesture.pointerId === event.pointerId) {
    const dx = event.clientX - gesture.start.x, dy = event.clientY - gesture.start.y;
    if (!gesture.moved && Math.hypot(dx, dy) > 6) {
      gesture.moved = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('dragging');
    }
    if (gesture.moved) app.setMapTransform({ x: gesture.pan.x + dx, y: gesture.pan.y + dy }, app.snapshot().view.mapZoom);
  }
});
function finishPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  if (gesture?.type === 'pinch' || gesture?.moved) suppressGestureClick();
  pointers.delete(event.pointerId);
  if (pointers.size < 2) gesture = null;
  if (!pointers.size) viewport.classList.remove('dragging');
}
viewport.addEventListener('pointerup', finishPointer);
viewport.addEventListener('pointercancel', finishPointer);
map.addEventListener('click', event => { if (suppressClick) { event.stopImmediatePropagation(); event.preventDefault(); suppressClick = false; } }, true);
viewport.addEventListener('wheel', event => { if (route !== 'game') return; event.preventDefault(); const { view } = app.snapshot(); app.setMapTransform(view.mapPan, Math.max(.6, Math.min(2.5, view.mapZoom + (event.deltaY < 0 ? .1 : -.1)))); }, { passive: false });

show('start');
