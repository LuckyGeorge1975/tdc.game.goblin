import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const flow = readFileSync(new URL('../ui-v2-flow.js', import.meta.url), 'utf8');
const functions = flow.slice(flow.indexOf('    function chooseFullSeats('),
  flow.indexOf('    function acquireSpectatorInput('));

function scene() {
  const dialogs = [];
  const screens = [];
  function element(tag) {
    return {tag, value:'', children:[], append(...nodes) { this.children.push(...nodes); },
      setAttribute() {}, remove() {}, showModal() {},
      addEventListener(name, listener) { this[name] = listener; }};
  }
  const context = {
    document:{createElement:element,body:{append:node=>dialogs.push(node)}},
    heading:()=>element('h2'), actions:(...nodes)=>nodes,
    t:key=>key, ScenarioRuleProfiles:{aiAllowed:config=>config.aiAllowed !== false},
    fullSeatBinding:null, fullHandoff:null, fullSetupDialog:null, legacySession:null,
    GoblinUIV2:{cancelMapPointers() {}}, show:screen=>screens.push(screen)
  };
  runInNewContext(functions, context);
  return {context, dialogs, screens};
}

test('FULL start distinguishes standard play from explicit seats and limits offers by side', async () => {
  const {context, dialogs} = scene();
  const config = {ruleProfileId:'FULL_CATALOG_v1'};
  context.GoblinFullSeatOwner = {offers:()=>({player:[{id:'test',label:'Test'}],enemy:[]})};
  assert.equal(context.chooseFullSeats({...config,aiAllowed:false}), null);
  const standard = context.chooseFullSeats(config);
  dialogs[0].returnValue = 'standard';
  dialogs[0].close();
  assert.equal(await standard, null);
  const configured = context.chooseFullSeats(config);
  const dialog = dialogs[1];
  const [, player, enemy] = dialog.children[0].children;
  assert.deepEqual(player.children[0].children.map(option=>option.value), ['', 'test']);
  assert.deepEqual(enemy.children[0].children.map(option=>option.value), ['']);
  dialog.returnValue = 'configured';
  dialog.close();
  assert.equal((await configured).selection.player, null);
  const forged = context.chooseFullSeats(config);
  dialogs[2].children[0].children[2].children[0].value = 'test';
  dialogs[2].returnValue = 'configured';
  dialogs[2].close();
  assert.equal(await forged, false);
});

test('handoff reveals play only after a single successful authorized takeover', () => {
  const {context, screens} = scene();
  let ui;
  const owner = {bind(session, selection, hooks) { ui = hooks; }};
  context.GoblinFullSeatOwner = owner;
  context.legacySession = {sessionId:1,ruleProfileId:'FULL_CATALOG_v1',config:{}};
  context.bindFullSeats({owner, selection:{player:null,enemy:null}});
  const seat = {sessionId:1,generation:2,side:'enemy'};
  assert.equal(ui.handoff({...seat,sessionId:2},()=>true), false);
  for (const generation of [undefined, -1, 1.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(ui.handoff({...seat,generation},()=>true), false);
  let calls = 0;
  assert.equal(ui.handoff(seat,()=>{calls++;return true}), true);
  assert.equal(ui.handoff(seat,()=>true), false);
  assert.equal(ui.handoff({...seat,generation:1},()=>true), false);
  assert.deepEqual(screens, ['full-handoff']);
  context.takeFullSeat();
  context.takeFullSeat();
  assert.equal(calls, 1);
  assert.deepEqual(screens, ['full-handoff','play']);
  assert.equal(ui.handoff(seat,()=>true), false);
  assert.equal(ui.handoff({...seat,generation:1},()=>true), false);
  assert.equal(ui.handoff({...seat,generation:3},()=>false), true);
  context.takeFullSeat();
  assert.equal(screens.at(-1), 'full-handoff');
  const previousUi = ui;
  context.legacySession = {...context.legacySession,sessionId:2};
  context.bindFullSeats({owner, selection:{player:null,enemy:null}});
  assert.equal(previousUi.handoff({...seat,generation:4},()=>true), false);
  assert.equal(ui.handoff({...seat,sessionId:2,generation:1},()=>true), true);
  context.takeFullSeat();
  assert.equal(screens.at(-1), 'play');
});

test('owned presentation reads only the assigned channel, including after revocation', () => {
  const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
  const context = {
    GoblinMovement:{projectedState(){ assert.fail('legacy presentation must not be read'); }},
    GoblinCatalogFullRuntime:{ownsPresentation:()=>true,controllerPort:()=>context.port}
  };
  runInNewContext(ui.slice(ui.indexOf('    function fullSeatPresentation('),
    ui.indexOf('    function query(')), context);
  assert.equal(context.project(), null);
  const view = {side:'enemy'};
  context.port = {project(mode) {
    assert.equal(mode, 'human');
    return {view,log:[]};
  }};
  assert.equal(context.project(), view);
  context.port = {spectator:()=>({read:()=>null}),project() {
    assert.fail('closed spectator channel must not fall back to human projection');
  }};
  assert.equal(context.project(), null);
});
