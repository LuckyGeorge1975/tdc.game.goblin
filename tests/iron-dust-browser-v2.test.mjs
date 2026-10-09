import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIronDustBrowserSession, dispatchIronDustBrowserAction,
  createIronDustEnemyFlow,
  ironDustV2StartSeed,
  IRON_DUST_V2_SELECTOR_ID,
  IRON_DUST_V2_START_SEED
} from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile, dispatchIronDustProfile,
  projectIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {buildIronDustV2View, renderIronDustV2View} from '../iron-dust-v2-view.mjs';
import {IRON_DUST_SOURCE_DEFEAT_TRACE_V2 as defeat} from
  './iron-dust-source-defeat-trace.v2.mjs';

test('v2 browser session has a fixed validated identity and rejects a changed header', () => {
  const session = createIronDustBrowserSession();
  const before = JSON.stringify(session.projection);
  const view = buildIronDustV2View(session.projection, session.profile.header.ruleProfileId);
  assert.equal(view.cells.length, 96);
  assert.equal(view.units.length, 7);
  assert.equal(view.cells.filter(cell => cell.type === 'rubble-field').length, 8);
  assert.equal(view.objective.coreHp, 5);
  assert.equal(JSON.stringify(session.projection), before);
  const ended = buildIronDustV2View({...session.projection,
    state:{...session.projection.state, turn:3,
      victory:{status:'ended', winner:'enemy'}},
    events:[{type:'EnemySkipped', actorId:'guard'}]},
    session.profile.header.ruleProfileId);
  assert.equal(ended.turn,3);
  assert.equal(ended.victory.winner,'enemy');
  assert.equal(ended.events[0].actorId,'guard');
  assert.equal(JSON.stringify(session.projection), before);
  assert.equal(IRON_DUST_V2_SELECTOR_ID, 'iron-dust-v2');
  assert.equal(session.profile.header.ruleProfileId, 'CORE_IRON_DUST_v2');
  assert.equal(session.projection.state.rng.seed, IRON_DUST_V2_START_SEED);
  assert.equal(session.projection.mode, 'player');
  assert.equal(session.projection.state.phase, 'movement');
  assert.throws(() => createIronDustBrowserSession({
    ...session.profile,
    header: {...session.profile.header, ruleProfileId: 'FIELD_TEST_LEGACY_v1'}
  }), /IRON_DUST_PROFILE_MISMATCH/);
  assert.throws(() => createIronDustBrowserSession(createIronDustProfile(IRON_DUST_V2_START_SEED + 1)),
    /IRON_DUST_V2_START_INVALID/);
  const defeatStart=createIronDustBrowserSession(createIronDustProfile(2),2);
  assert.equal(defeatStart.projection.state.turn,1);
  assert.equal(defeatStart.projection.mode,'player');
  assert.equal(defeatStart.projection.state.rng.seed,2);
  assert.throws(() => createIronDustBrowserSession(defeatStart.profile),
    /IRON_DUST_V2_START_INVALID/);
});

test('browser player commands use the profile and preserve rejected state', () => {
  let session = createIronDustBrowserSession();
  const apply = command => {
    const result = dispatchIronDustBrowserAction(session, command);
    assert.ok(result.session, JSON.stringify(result.error));
    session = result.session;
    return result;
  };
  const move = (unitId, x, y) => ({type:'Move', playerId:'player', unitId, to:{x, y}});
  const end = {type:'EndPhase', playerId:'player'};
  for (const [id, x, y] of [['ogre', 2, 5], ['gev', 2, 7],
    ['missile', 4, 6], ['infantry', 0, 6]]) apply(move(id, x, y));
  assert.equal(session.projection.state.units.filter(unit =>
    unit.team === 'player' && unit.moved).length, 4);
  const beforeReject = JSON.stringify(session);
  assert.deepEqual(dispatchIronDustBrowserAction(session, move('ogre', 3, 5)),
    {error:{code:'ACTION_SPENT'}});
  assert.equal(JSON.stringify(session), beforeReject);
  assert.deepEqual(dispatchIronDustBrowserAction(session,
    {type:'AutoEnemyAdvance', playerId:'enemy'}),
  {error:{code:'WRONG_PHASE'}});
  apply(end);
  assert.equal(session.projection.state.phase, 'fire');
  apply({type:'SelectWeapon', playerId:'player', unitId:'ogre', weaponKey:'secondary'});
  assert.equal(session.projection.state.units.find(unit => unit.id === 'ogre')
    .ogreSystems.selectedWeapon, 'secondary');
  apply(end);
  assert.equal(session.projection.state.phase, 'gev');
  const second = [move('gev', 3, 7), move('gev', 2, 8), move('gev', 3, 6)]
    .find(command => dispatchIronDustBrowserAction(session, command).session);
  assert.ok(second);
  apply(second);
  assert.equal(session.projection.state.units.find(unit => unit.id === 'gev').secondMoved, true);
  apply(end);
  assert.equal(session.projection.mode, 'enemy');
  assert.equal(session.projection.events.length > 0, true);
  const steps = [];
  while (session.projection.mode === 'enemy') {
    const cursor = session.projection.cursor;
    apply({type:'AutoEnemyAdvance', playerId:'enemy'});
    steps.push({pass:cursor.pass, index:cursor.index,
      event:session.projection.events[0].type});
  }
  assert.deepEqual(steps.map(step => step.pass),
    ['first','first','retry','retry','finish']);
  assert.equal(session.projection.mode, 'player');
  assert.equal(session.projection.state.turn,2);
});

test('browser fire and ram use the same reachable source commands', () => {
  const end = {type:'EndPhase', playerId:'player'};
  const advance = {type:'AutoEnemyAdvance', playerId:'enemy'};
  const move = (unitId, x, y) => ({type:'Move', playerId:'player', unitId, to:{x,y}});
  function setup(seed) {
    let profile = createIronDustProfile(seed);
    return {
      get session() {return {profile, projection:projectIronDustProfile(profile)};},
      apply(command) {
        const result = dispatchIronDustProfile(profile, command);
        assert.ok(result.profile, JSON.stringify(result.error));
        profile = result.profile;
      },
      enemy() {while (profile.entry.mode === 'enemy') this.apply(advance);}
    };
  }
  const missile = setup(1);
  missile.apply(move('missile',4,6));
  for (let i=0;i<3;i++) missile.apply(end);
  missile.enemy();
  missile.apply(move('missile',4,5));
  missile.apply(end);
  const shot = dispatchIronDustBrowserAction(missile.session,
    {type:'PlayerFire', playerId:'player', unitId:'missile', targetId:'guard'});
  assert.equal(shot.session.projection.events[0].type,'PlayerFireResolved');
  assert.equal(shot.session.projection.state.units.find(unit => unit.id === 'missile').fired,true);

  const ram = setup(1);
  for (const x of [3,6]) {
    ram.apply(move('ogre',x,2));
    for (let i=0;i<3;i++) ram.apply(end);
    ram.enemy();
  }
  const impact = dispatchIronDustBrowserAction(ram.session,
    {type:'Ram', playerId:'player', unitId:'ogre', targetId:'guard'});
  assert.equal(impact.session.projection.events[0].type,'RamResolved');
  assert.equal(impact.session.projection.state.units.find(unit => unit.id === 'guard').hp,0);

  const ogre = setup(8);
  for (const x of [3,6,9]) {
    ogre.apply(move('ogre',x,2));
    ogre.apply(end);
    if (x === 9) break;
    ogre.apply(end);
    ogre.apply(end);
    ogre.enemy();
  }
  const coreShot = dispatchIronDustBrowserAction(ogre.session,
    {type:'PlayerFire', playerId:'player', unitId:'ogre', targetId:'core', weaponKey:'main'});
  assert.equal(coreShot.session.projection.mode,'ended');
  assert.equal(coreShot.session.projection.state.victory.winner,'player');
});

test('enemy flow is single-run and discards stale callbacks after restart', () => {
  const enemySession = () => {
    let current = createIronDustBrowserSession();
    for (let i=0;i<3;i++) current = dispatchIronDustBrowserAction(current,
      {type:'EndPhase', playerId:'player'}).session;
    assert.equal(current.projection.mode,'enemy');
    return current;
  };
  let current = enemySession(), calls = 0;
  const pending = [];
  const flow = createIronDustEnemyFlow({getSession:() => current,
    advance:() => {
      calls++;
      const result = dispatchIronDustBrowserAction(current,
        {type:'AutoEnemyAdvance',playerId:'enemy'});
      if (result.session) current = result.session;
      return result;
    },
    schedule:callback => {const task = {callback,canceled:false}; pending.push(task); return task;},
    clear:task => {task.canceled = true;}});
  assert.equal(flow.start(),true);
  assert.equal(flow.start(),false);
  pending.shift().callback();
  assert.equal(calls,1);
  const stale = pending.shift();
  flow.cancel();
  current = enemySession();
  const before = JSON.stringify(current);
  stale.callback();
  assert.equal(JSON.stringify(current),before);
  assert.equal(calls,1);
  assert.equal(flow.start(),true);
  while (flow.running) pending.shift().callback();
  assert.equal(calls,6);
  assert.equal(current.projection.mode,'player');
  assert.equal(current.projection.state.turn,2);
  assert.equal(flow.start(),false);
});

test('browser adapter reaches terminal enemy defeat without an extra turn', () => {
  let profile = createIronDustProfile(defeat.seed);
  for (const step of defeat.steps.slice(0,-1)) {
    const command = step.command === 'E'
      ? {type:'AutoEnemyAdvance',playerId:'enemy'}
      : {type:'EndPhase',playerId:'player'};
    const result = dispatchIronDustProfile(profile,command);
    assert.ok(result.profile,JSON.stringify(result.error));
    profile = result.profile;
  }
  const session = {profile,projection:projectIronDustProfile(profile)};
  assert.equal(session.projection.mode,'enemy');
  const final = dispatchIronDustBrowserAction(session,
    {type:'AutoEnemyAdvance',playerId:'enemy'});
  assert.equal(final.session.projection.mode,'ended');
  assert.equal(final.session.projection.state.victory.winner,'enemy');
  assert.equal(final.session.projection.state.turn,
    session.projection.state.turn);
  assert.equal(JSON.stringify(session.profile),JSON.stringify(profile));
  assert.deepEqual(dispatchIronDustBrowserAction(final.session,
    {type:'AutoEnemyAdvance',playerId:'enemy'}),{error:{code:'GAME_ENDED'}});
});

test('public host enables v2 without a test flag while seed override stays local', async () => {
  const option = {disabled:true};
  const previous = {document:globalThis.document,location:globalThis.location,
    bridge:globalThis.IronDustBrowserV2,draw:globalThis.draw};
  globalThis.document = {querySelector:() => option};
  globalThis.location = {hostname:'luckygeorge1975.github.io',
    pathname:'/tdc.game.goblin/',search:'?iron-dust-v2-seed=2'};
  globalThis.draw = () => {};
  try {
    await import('../iron-dust-browser-v2.mjs?public-gate=1');
    assert.equal(option.disabled,false);
    assert.equal(globalThis.IronDustBrowserV2.available,true);
    assert.equal(globalThis.IronDustBrowserV2.active,false);
  } finally {
    globalThis.document = previous.document;
    globalThis.location = previous.location;
    globalThis.IronDustBrowserV2 = previous.bridge;
    globalThis.draw = previous.draw;
  }
});

test('development defeat seed is restricted to local hosts', () => {
  assert.equal(ironDustV2StartSeed('luckygeorge1975.github.io','?iron-dust-v2-seed=2'),8);
  assert.equal(ironDustV2StartSeed('example.com','?iron-dust-v2-seed=2'),8);
  assert.equal(ironDustV2StartSeed('localhost','?iron-dust-v2-seed=2'),2);
  assert.equal(ironDustV2StartSeed('127.0.0.1','?iron-dust-v2-seed=2'),2);
  assert.equal(ironDustV2StartSeed('localhost',''),8);
});

test('Pages path starts v2, can restart, and locks a failed v2 start', async () => {
  const nodes = new Map();
  const classes = new Set();
  const element = () => ({disabled:false, value:'', textContent:'', dataset:{}, style:{}, children:[],listeners:{},
    classList:{add(name){classes.add(name)}, remove(name){classes.delete(name)},
      contains(name){return classes.has(name)},toggle(name,force){if(force)classes.add(name);else classes.delete(name)}},
    removeAttribute(name){delete this.dataset[name]},setAttribute(){},
    addEventListener(name,handler){this.listeners[name]=handler},click(){this.listeners.click?.()},
    append(...items){this.children.push(...items)},appendChild(item){this.children.push(item)},
    replaceChildren(...items){this.children=items}});
  const document = {
    body: element(),
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector, element());return nodes.get(selector)},
    querySelectorAll(){return [element(),element()]},
    createElement:element,createElementNS:element
  };
  const previous = {document:globalThis.document,location:globalThis.location,
    bridge:globalThis.IronDustBrowserV2,draw:globalThis.draw,
    visuals:globalThis.UnitVisuals,language:globalThis.GoblinLanguage,
    addEventListener:globalThis.addEventListener};
  let locale = 'de';
  const languageEvents = new Map();
  const titles = {de:'IRON DUST v2',en:'IRON DUST v2',
    es:'IRON DUST v2',fr:'IRON DUST v2'};
  globalThis.document = document;
  globalThis.location = {hostname:'luckygeorge1975.github.io',
    pathname:'/tdc.game.goblin/',search:'?iron-dust-v2-seed=2'};
  globalThis.draw = () => {};
  globalThis.UnitVisuals = {terrainAssetFor:() => null,draw:() => {}};
  globalThis.GoblinLanguage = {t:key => key === 'mission.iron-dust-v2.title' ? titles[locale] :
    ({'v2.phase.movement':'BEWEGUNG','v2.phase.fire':'FEUER','v2.lose':'MISSION GESCHEITERT',
      'v2.error':'BEFEHL ABGELEHNT','v2.undo':'Rückgängig ist nicht verfügbar.',
      'v2.reject.spent':'Diese Einheit hat ihre Aktion bereits genutzt.',
      'v2.reject.range':'Das Ziel ist außer Reichweite.',
      'v2.reject.target':'Dieses Ziel kann nicht angegriffen werden.',
      'v2.reject.ended':'Die Mission ist beendet.',
      'v2.reject.start':'IRON DUST v2 konnte nicht gestartet werden.',
      'v2.unit.ogre':'GOBLIN SIEGEBREAKER','v2.unit.core':'Kommandokern',
      'v2.ui.coreHp':'CORE HP','v2.ui.critical':'CRITICAL',
      'v2.event.UnitMoved':'Siegebreaker bewegt sich.',
      'v2.event.EnemyPassRecorded':'Gegnerzug wird fortgesetzt.'})[key] ?? key};
  globalThis.addEventListener = (name,handler) => languageEvents.set(name,handler);
  globalThis.selected = null;
  globalThis.focusedCell = null;
  globalThis.phase = 'player';
  globalThis.turnPhase = 'movement';
  globalThis.gameOver = false;
  globalThis.currentScenario = 'iron-dust';
  try {
    await import('../iron-dust-browser-v2.mjs?browser-test=1');
    const bridge = globalThis.IronDustBrowserV2;
    assert.equal(bridge.available,true);
    assert.equal(document.querySelector('#scenario-select option[value="iron-dust-v2"]').disabled,false);
    assert.equal(bridge.start(),true);
    assert.equal(bridge.session.projection.state.rng.seed,8);
    assert.equal(bridge.mode,'ready');
    assert.equal(globalThis.currentScenario,'iron-dust-v2');
    assert.equal(globalThis.gameOver,true);
    assert.equal(document.body.classList.contains('iron-dust-v2-gated'),false);
    assert.equal(document.body.classList.contains('iron-dust-v2-ready'),true);
    assert.equal(document.querySelector('#battlefield-map').children.length,103);
    assert.equal(document.querySelector('#unit-roster').children.length,4);
    assert.equal(document.querySelector('#mission-sub').textContent,'v2.objective');
    assert.equal(document.querySelector('#objective-text').textContent,'CORE HP 5/5 · v2.objective');
    assert.equal(document.querySelector('#phase-title').textContent,'BEWEGUNG');
    assert.equal(document.querySelector('#turn-number').textContent,'01');
    assert.equal(document.querySelector('#combat-log').children.length,1);
    const beforeViewClick = JSON.stringify(bridge.session.projection);
    for (const language of ['de','en','es','fr','de']) {
      locale = language;
      languageEvents.get('goblin-language-change')();
      assert.equal(document.querySelector('#mission-title').textContent,titles[language]);
    }
    assert.equal(JSON.stringify(bridge.session.projection),beforeViewClick);
    document.querySelector('#battlefield-map').children[5 * 12 + 1].click();
    assert.equal(document.querySelector('#unit-intel-title').textContent,'GOBLIN SIEGEBREAKER');
    assert.equal(JSON.stringify(bridge.session.projection),beforeViewClick);
    renderIronDustV2View(buildIronDustV2View({...bridge.session.projection,
      state:{...bridge.session.projection.state, victory:{status:'ended',winner:'enemy'}},
      events:[{type:'EnemySkipped', actorId:'guard'}]},
    bridge.session.profile.header.ruleProfileId));
    assert.equal(document.querySelector('#phase-title').textContent,'MISSION GESCHEITERT');
    assert.equal(document.querySelector('#log-status').textContent,'CRITICAL');
    assert.equal(document.querySelector('#combat-log').children.length,1);
    assert.equal(JSON.stringify(bridge.session.projection),beforeViewClick);
    globalThis.draw();
    assert.equal(document.querySelector('#phase-title').textContent,'BEWEGUNG');
    const first = bridge.session.profile;
    assert.equal(bridge.restart(),true);
    assert.notEqual(bridge.session.profile,first);
    assert.equal(bridge.session.profile.digest,first.digest);
    const clickCell = (x,y) => {
      const polygon = document.querySelector('#battlefield-map').children.find(node =>
        node.dataset.x === String(x) && node.dataset.y === String(y));
      assert.ok(polygon, `${x},${y}`);
      polygon.click();
    };
    document.querySelector('#battlefield-map').children
      .find(node => node.dataset.unitId === 'ogre').click();
    clickCell(2,5);
    assert.equal(bridge.session.projection.state.units.find(unit => unit.id === 'ogre').x,2);
    assert.equal(globalThis.gameOver,true);
    assert.equal(globalThis.selected,null);
    const beforeReject = JSON.stringify(bridge.session);
    assert.deepEqual(bridge.dispatch({type:'Move', playerId:'player', unitId:'ogre',
      to:{x:3,y:5}}),{error:{code:'ACTION_SPENT'}});
    assert.equal(JSON.stringify(bridge.session),beforeReject);
    assert.match(document.querySelector('#map-toast').textContent,/Aktion bereits genutzt/);
    assert.equal(document.querySelector('#undo-command').disabled,true);
    assert.match(document.querySelector('#undo-command').title,/nicht verfügbar/);
    document.querySelector('#end-turn').onclick();
    assert.equal(bridge.session.projection.state.phase,'fire');
    assert.equal(document.querySelector('#weapon-controls').children.length,4);
    document.querySelector('#weapon-controls').children[1].click();
    assert.equal(bridge.session.projection.state.units.find(unit => unit.id === 'ogre')
      .ogreSystems.selectedWeapon,'secondary');
    const beforeBadShot = JSON.stringify(bridge.session);
    clickCell(8,3);
    assert.equal(JSON.stringify(bridge.session),beforeBadShot);
    assert.match(document.querySelector('#map-toast').textContent,/außer Reichweite/);
    assert.equal(bridge.restart(),true);
    for (let i=0;i<3;i++) bridge.dispatch({type:'EndPhase',playerId:'player'});
    assert.equal(bridge.session.projection.mode,'enemy');
    assert.equal(bridge.enemyRunning,true);
    assert.equal(document.querySelector('#end-turn').disabled,true);
    const beforeDouble = JSON.stringify(bridge.session);
    assert.deepEqual(bridge.dispatch({type:'EndPhase',playerId:'player'}),
      {error:{code:'ENEMY_TURN_RUNNING'}});
    assert.equal(JSON.stringify(bridge.session),beforeDouble);
    assert.equal(bridge.restart(),true);
    const restarted = JSON.stringify(bridge.session);
    await new Promise(resolve => setTimeout(resolve,180));
    assert.equal(JSON.stringify(bridge.session),restarted);
    for (let i=0;i<3;i++) bridge.dispatch({type:'EndPhase',playerId:'player'});
    for (let i=0;i<30 && bridge.enemyRunning;i++)
      await new Promise(resolve => setTimeout(resolve,40));
    assert.equal(bridge.enemyRunning,false);
    assert.equal(bridge.session.projection.mode,'player');
    assert.equal(bridge.session.projection.state.turn,2);
    assert.ok(document.querySelector('#combat-log').children.some(line =>
      line.textContent.includes('Gegnerzug wird fortgesetzt')));
    assert.ok(document.querySelector('#combat-log').children.every(line =>
      !/EnemyPassRecorded|FIRST|RETRY|FINISH/.test(line.textContent)));
    const afterEnemy=JSON.stringify(bridge.session);
    for(const language of ['en','es','fr','de']){
      locale=language;
      languageEvents.get('goblin-language-change')();
      assert.equal(JSON.stringify(bridge.session),afterEnemy);
    }
    assert.equal(bridge.restart(),true);
    for (let i=0;i<3;i++) bridge.dispatch({type:'EndPhase',playerId:'player'});
    const abandoned = JSON.stringify(bridge.session);
    bridge.stop();
    await new Promise(resolve => setTimeout(resolve,180));
    assert.equal(bridge.active,false);
    assert.equal(bridge.session,null);
    assert.equal(bridge.enemyRunning,false);
    assert.equal(globalThis.currentScenario,'iron-dust-v2');
    assert.ok(abandoned.includes('"mode":"enemy"'));
    assert.equal(bridge.start(),true);
    for(const x of [3,6,9]){
      document.querySelector('#battlefield-map').children
        .find(node => node.dataset.unitId === 'ogre').click();
      clickCell(x,2);
      assert.equal(bridge.session.projection.state.units.find(unit=>unit.id==='ogre').x,x);
      document.querySelector('#end-turn').onclick();
      if(x===9)break;
      document.querySelector('#end-turn').onclick();
      document.querySelector('#end-turn').onclick();
      for(let i=0;i<30&&bridge.enemyRunning;i++)
        await new Promise(resolve=>setTimeout(resolve,40));
      assert.equal(bridge.session.projection.mode,'player');
    }
    document.querySelector('#battlefield-map').children
      .find(node=>node.dataset.unitId==='core').click();
    assert.equal(bridge.session.projection.mode,'ended');
    assert.equal(bridge.session.projection.state.victory.winner,'player');
    assert.equal(document.querySelector('#end-turn').disabled,true);
    assert.equal(document.querySelector('#weapon-controls').children.length,0);
    assert.equal(bridge.dispatch({type:'EndPhase',playerId:'player'}).error.code,'GAME_ENDED');
    bridge.stop();
    assert.equal(bridge.start({...first, header:{...first.header, ruleProfileId:'BAD'}}),false);
    assert.equal(bridge.mode,'error');
    assert.equal(bridge.session,null);
    assert.match(document.querySelector('#mission-sub').textContent,/konnte nicht gestartet werden/);
    assert.equal(document.body.classList.contains('iron-dust-v2-gated'),true);
    assert.equal(document.body.classList.contains('iron-dust-v2-ready'),false);
    bridge.stop();
    assert.equal(bridge.active,false);
    assert.equal(document.body.classList.contains('iron-dust-v2-gated'),false);
  } finally {
    globalThis.document = previous.document;
    globalThis.location = previous.location;
    globalThis.IronDustBrowserV2 = previous.bridge;
    globalThis.draw = previous.draw;
    globalThis.UnitVisuals = previous.visuals;
    globalThis.GoblinLanguage = previous.language;
    globalThis.addEventListener = previous.addEventListener;
    delete globalThis.selected;
    delete globalThis.focusedCell;
    delete globalThis.phase;
    delete globalThis.turnPhase;
    delete globalThis.gameOver;
    delete globalThis.currentScenario;
  }
});
