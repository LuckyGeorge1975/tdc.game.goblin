import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createGameManager} from '../src/core/game-manager.mjs';
import {fullNativeSetup} from '../full-standard-seat-owner.mjs';

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
    crypto:webcrypto,
    document:{createElement:element,body:{append:node=>dialogs.push(node)}},
    heading:()=>element('h2'), actions:(...nodes)=>nodes,
    t:key=>key, paragraph:()=>element('p'),
    fullSeatBinding:null, fullHandoff:null, fullSetupDialog:null, legacySession:null,
    GoblinUIV2:{cancelMapPointers() {},refresh() {}}, show:screen=>screens.push(screen)
  };
  runInNewContext(functions, context);
  return {context, dialogs, screens};
}

test('FULL start distinguishes standard play from explicit seats and limits offers by side', async () => {
  const {context, dialogs} = scene();
  const config = {ruleProfileId:'FULL_CATALOG_v1'};
  context.GoblinFullSeatOwner = {
    configure:config=>createGameManager({maxSeats:2,seatIds:['player','enemy'],aiAllowed:config.aiAllowed},{
      player:{human:true,ai:[{id:'test',difficulty:'weak'}]},enemy:{human:true,ai:[]}
    }),
    offers:()=>null
  };
  const disabled=context.chooseFullSeats({...config,aiAllowed:false});
  const disabledDialog=dialogs.shift();
  assert.deepEqual(disabledDialog.children[0].children
    .filter(node=>node.tag==='label').map(node=>node.children[0].children.map(option=>option.value)),[[''],['']]);
  disabledDialog.returnValue='configured';
  disabledDialog.close();
  assert.deepEqual({...((await disabled).selection)},{player:null,enemy:null});
  const standard = context.chooseFullSeats(config);
  dialogs[0].returnValue = 'standard';
  dialogs[0].close();
  assert.equal(await standard, false);
  const configured = context.chooseFullSeats(config);
  const dialog = dialogs[1];
  const [player,enemy] = dialog.children[0].children.filter(node=>node.tag==='label');
  assert.deepEqual(player.children[0].children.map(option=>option.value), ['', 'test']);
  assert.deepEqual(enemy.children[0].children.map(option=>option.value), ['']);
  dialog.returnValue = 'configured';
  dialog.close();
  assert.equal((await configured).selection.player, null);
  const forged = context.chooseFullSeats(config);
  dialogs[2].children[0].children.filter(node=>node.tag==='label')[1].children[0].value = 'test';
  dialogs[2].returnValue = 'configured';
  dialogs[2].close();
  assert.equal(await forged, false);
});

test('handoff reveals play only after a single successful authorized takeover', () => {
  const {context, screens} = scene();
  let ui;
  const game=createGameManager({maxSeats:2,seatIds:['player','enemy']},{
    player:{human:true,ai:[]},enemy:{human:true,ai:[]}
  });
  const owner = {nativeSetup:(_,selection)=>fullNativeSetup(game,selection),
    bind(session, selection, hooks) { ui = hooks; }};
  context.GoblinFullSeatOwner = owner;
  context.legacySession = {sessionId:1,ruleProfileId:'FULL_CATALOG_v1',config:{}};
  const start = control => {
    assert.deepEqual(control.roles,{player:'human',enemy:'human'});
    assert.deepEqual(control.policyIds,{});
    return {leave() {}};
  };
  context.bindFullSeats({owner, selection:{player:null,enemy:null}}, start);
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
  assert.deepEqual(screens, ['full-handoff','full-seat']);
  assert.equal(ui.handoff(seat,()=>true), false);
  assert.equal(ui.handoff({...seat,generation:1},()=>true), false);
  assert.equal(ui.handoff({...seat,generation:3},()=>false), true);
  context.takeFullSeat();
  assert.equal(screens.at(-1), 'full-handoff');
  const previousUi = ui;
  context.legacySession = {...context.legacySession,sessionId:2};
  context.bindFullSeats({owner, selection:{player:null,enemy:null}}, start);
  assert.equal(previousUi.handoff({...seat,generation:4},()=>true), false);
  assert.equal(ui.handoff({...seat,sessionId:2,generation:1},()=>true), true);
  context.takeFullSeat();
  assert.equal(screens.at(-1), 'full-seat');
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

test('an internal map binding commits through the admitted human seat',async()=>{
  const {context,dialogs,screens}=scene();
  const config={ruleProfileId:'FULL_CATALOG_v1'};
  const manager=createGameManager({maxSeats:2,seatIds:['player','enemy']},{
    player:{human:true,ai:[]},enemy:{human:true,ai:[{id:'full-native-standard-defender',difficulty:null}]}
  });
  const permit={}, view={side:'player'};
  let authorized=false,committed=0;
  const port={
    ticket:mode=>mode==='human'&&authorized?permit:null,
    project:mode=>mode==='human'&&authorized?{view}:null
  };
  const owner={
    configure:()=>manager,
    offers:()=>({enemy:[{id:'full-native-standard-defender',label:'Standard'}]}),
    nativeSetup:(_,selection)=>fullNativeSetup(manager,selection),
    bind(){},
    commitHuman(actualPort,actualPermit,actualView,command){
      assert.equal(actualPort,port);
      assert.equal(actualPermit,permit);
      assert.equal(actualView,view);
      assert.equal(command.type,'EndPhase');
      committed++;
      return {ok:true};
    }
  };
  context.GoblinFullSeatOwner=owner;
  context.legacySession={sessionId:4};
  context.screen='play';
  context.pauseActive=false;
  const setup={owner,config,selection:{player:null,enemy:'full-native-standard-defender'},mapPresentation:true};
  assert.equal(setup.mapPresentation,true);
  context.bindFullSeats(setup,control=>{
    assert.equal(control.mapPresentation,true);
    assert.equal(control.roles.player,'human');
    assert.equal(control.roles.enemy,'ai');
    assert.equal(control.ui.handoff({side:'player',generation:1,sessionId:4},()=>{
      authorized=true;
      return true;
    }),true);
    return port;
  });
  context.showStartedMission();
  assert.deepEqual(screens,['play']);
  assert.equal(context.commitFullMap({type:'EndPhase'}).ok,true);
  authorized=false;
  assert.equal(context.commitFullMap({type:'EndPhase'}).ok,false);
  assert.equal(committed,1);
});
