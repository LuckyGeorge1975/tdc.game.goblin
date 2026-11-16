import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';

const source = fs.readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const language = fs.readFileSync(new URL('../localization.js', import.meta.url), 'utf8');

test('phase modal times out, migrates off preference and yields to safety dialogs', () => {
  const start = source.indexOf("    const phaseNotice = at('#v2-phase-notice');");
  const end = source.indexOf('    function renderCore(', start);
  const state = {scenario:'atlas', turn:1, phase:'player', turnPhase:'movement', markers:{binding:{sessionId:1}}};
  const setup = (storage = new Map()) => {
    const input = {}, title = {}, label = {}, badge = {dataset:{}}, events = {};
    const notice = {hidden:true, open:false, style:{}, dataset:{},
      querySelector: tag => ({input, strong:title, span:label})[tag],
      addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; }};
    const map = {getBoundingClientRect: () => ({top:50,bottom:850,left:300,right:1300})};
    const elements = {'#v2-phase-notice':notice, '#v2-phase':badge, '#v2-map':map};
    const context = vm.createContext({view:{}, at:key=>elements[key], t:key=>key, innerHeight:900, innerWidth:1500,
      GameDialogs:{isOpen:()=>false}, core:()=>false,
      localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
      document:{body:{classList:{contains:()=>false}},addEventListener:(name,fn)=>{events[name]=fn}},
      setTimeout:(fn,ms)=>{context.expire=fn;context.delay=ms;return 1;},clearTimeout(){}});
    vm.runInContext(source.slice(start,end) + '\nglobalThis.renderNotice=renderPhaseNotice;globalThis.setSeconds=setPhaseNoticeSeconds;',context);
    return {context, notice, title, input, events, storage};
  };
  const {context, notice, title, input, events, storage} = setup();
  context.renderNotice(state);
  assert.equal(notice.open,true);
  assert.equal(title.textContent,'v2.phase.movement');
  assert.equal(context.delay,1000);
  assert.equal(notice.style.inset,'150px 300px 150px 400px');
  context.expire();
  context.renderNotice(state);
  assert.equal(notice.open,false);
  context.setSeconds(5);
  state.turnPhase='fire';
  context.renderNotice(state);
  assert.equal(context.delay,5000);
  events['goblin-game-dialog-opening']();
  assert.equal(notice.open,false);
  state.turnPhase='gev';
  context.renderNotice(state);
  input.checked=true;
  input.onchange();
  assert.equal(storage.get('goblin.v2.phaseNoticeSeconds'),'0');
  assert.equal(notice.open,false);
  const migrated=setup(new Map([['goblin.v2.phaseNotice','off']]));
  migrated.context.renderNotice(state);
  assert.equal(migrated.notice.open,false);
  migrated.context.setSeconds(2);
  state.markers.binding.sessionId=2;
  migrated.context.renderNotice(state);
  assert.equal(migrated.context.delay,2000);
});

test('own unit and invalid hex deselect, and automatic selection needs a ready candidate', () => {
  const cut = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const units = [{id:'tank',x:1,y:3,team:'player'},{id:'scout',x:2,y:1,team:'player'}];
  const state = {units,phase:'player',turnPhase:'movement'};
  const view = {actorId:'tank'};
  const context = vm.createContext({units,view,core:()=>false,unitAlive:()=>true,
    project:()=>state,render(){},clearContext(){view.target=null;},inspectTrainingTarget(){},
    targetOccupant:(_,cell)=>units.find(unit=>unit.x===cell.x&&unit.y===cell.y),
    entriesAt:()=>[],nextReadyUnit:()=>context.candidate,readyUnitIds:()=>context.ready??[]});
  vm.runInContext([
    'let startZoomPending;',
    cut('    function chooseActor(', '    function focusUnit('),
    cut('    function chooseHex(', '    const areaCache'),
    cut('    function selectReadyActor(', '    function hidePhaseNotice('),
    'globalThis.pick=()=>selectReadyActor(project(),true);'
  ].join('\n'),context);
  context.chooseHex(1,3);
  assert.equal(view.actorId,null);
  context.chooseActor('tank');
  context.chooseHex(9,6);
  assert.equal(view.actorId,null);
  context.chooseActor('tank');
  context.candidate='scout';
  context.ready=['tank','scout'];
  context.pick();
  assert.equal(view.actorId,'tank');
  context.ready=['scout'];
  context.pick();
  assert.equal(view.actorId,'scout');
  context.candidate=undefined;
  context.ready=[];
  context.pick();
  assert.equal(view.actorId,null);
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
