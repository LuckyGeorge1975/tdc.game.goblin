import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';

const source = fs.readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const language = fs.readFileSync(new URL('../localization.js', import.meta.url), 'utf8');

test('phase notice preference persists and applies to the next phase without reannouncing a render', () => {
  const start = source.indexOf("    const phaseNotice = at('#v2-phase-notice');");
  const end = source.indexOf('    function renderCore(', start);
  const button = {}, title = {}, badge = {dataset: {}}, storage = new Map();
  const notice = {hidden: true, dataset: {}, querySelector: tag => tag === 'button' ? button : title};
  const body = new Set();
  let focused = false;
  const map = {focus: () => { focused = true; }};
  const elements = {'#v2-phase-notice': notice, '#v2-phase': badge, '#v2-map': map};
  const context = vm.createContext({at: key => elements[key], t: key => key, GameDialogs: {isOpen: () => false},
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    document: {body: {classList: {contains: name => body.has(name)}}},
    setTimeout: fn => { context.expire = fn; return 1; }, clearTimeout: () => {}});
  vm.runInContext(`${source.slice(start, end)}\nglobalThis.renderNotice = renderPhaseNotice; globalThis.enable = setPhaseNoticeEnabled;`, context);
  const state = {scenario: 'atlas', turn: 1, phase: 'player', turnPhase: 'movement', markers: {binding: {sessionId: 1}}};
  context.renderNotice(state);
  assert.equal(notice.hidden, false);
  assert.equal(title.textContent, 'v2.phase.movement');
  button.onclick();
  assert.equal(storage.get('goblin.v2.phaseNotice'), 'off');
  assert.equal(focused, true);
  assert.equal(notice.hidden, true);
  state.turnPhase = 'fire';
  context.renderNotice(state);
  assert.equal(notice.hidden, true);
  assert.equal(badge.dataset.phase, 'fire');
  context.enable(true);
  context.renderNotice(state);
  assert.equal(notice.hidden, true);
  state.turnPhase = 'gev';
  context.renderNotice(state);
  assert.equal(notice.hidden, false);
  body.add('v2-screen-open');
  context.renderNotice(state);
  assert.equal(notice.hidden, true);
});

test('native SVG hover names use only the viewer roster and remove contacts once lost', async () => {
  const game = await fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
  const visible = read(game, 'GoblinCatalogFullRuntime.roster()');
  const hidden = read(game, "units.find(unit => unit.team === 'enemy' && !GoblinCatalogFullRuntime.known(unit.id))");
  const own = visible.find(unit => unit.team === 'player' && !unit.embarkedOn);
  const cell = unit => ({dataset: {x: unit.x, y: unit.y}, title: null,
    querySelector() { return this.title; }, prepend(title) { this.title = title; title.remove = () => { this.title = null; }; }});
  const ownHex = cell(own), hiddenHex = cell(hidden);
  const start = source.indexOf('    function renderUnitHoverNames(');
  const end = source.indexOf('    function revision()', start);
  const context = vm.createContext({NS: 'svg', unitAlive: unit => unit.hp > 0 || !!unit.catalogSystems,
    nativeMap: {querySelectorAll: () => [ownHex, hiddenHex]},
    document: {createElementNS: () => ({textContent: '', setAttribute() {}})}});
  vm.runInContext(`${source.slice(start, end)}\nglobalThis.renderNames = renderUnitHoverNames;`, context);
  context.renderNames(visible);
  assert.equal(ownHex.title?.textContent, own.name);
  assert.equal(hiddenHex.title, null);
  context.renderNames([...visible, hidden]);
  assert.equal(hiddenHex.title?.textContent, hidden.name);
  context.renderNames(visible);
  assert.equal(hiddenHex.title, null);
});

test('new map and phase copy supplies all four locales', () => {
  const labels = [...language.matchAll(/'v2\.(?:overlayHint|phaseNotice)\.[^']+': (\{[^\n]+\}),/g)];
  assert.equal(labels.length, 8);
  for (const [, value] of labels) {
    const translations = vm.runInNewContext(`(${value})`);
    assert.deepEqual(Object.keys(translations), ['de', 'en', 'es', 'fr']);
    assert.ok(Object.values(translations).every(text => text.trim().length > 0));
  }
});

test('overlay toggle can clear the phase default with an inactive unit selected', () => {
  const start = source.indexOf('    function activeAreaMode(');
  const end = source.indexOf('    function areaQuery(', start);
  const toggle = source.match(/button\.onclick = \(\) => \{ view\.areaMode = activeAreaMode\(project\(\)\).*?\};/)[0];
  const button = {dataset: {area: 'movement'}};
  const view = {actorId: 'spent', areaMode: null};
  const state = {turnPhase: 'movement', units: [{id: 'spent', disabled: true}]};
  const context = vm.createContext({view, button, project: () => state, render() {}});
  vm.runInContext(`${source.slice(start, end)}\n${toggle}`, context);
  button.onclick();
  assert.equal(view.areaMode, 'none');
  button.onclick();
  assert.equal(view.areaMode, 'movement');
});
