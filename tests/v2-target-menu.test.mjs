import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createIronDustBrowserSession} from '../iron-dust-browser-v2.mjs';
import {buildIronDustV2View} from '../iron-dust-v2-view.mjs';
import {queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {lifeGlobals} from './helpers/unit-life-context.mjs';
import {targetOptionsSource} from './helpers/target-options-source.mjs';
import {trainingScene} from './training-product-harness.mjs';
import {read} from './artillery-product-harness.mjs';

const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const revealTargetControl = ui.slice(ui.indexOf('    function revealTargetControl('), ui.indexOf('    const COMMAND_ICONS'));
const targetCard = revealTargetControl + ui.slice(ui.indexOf('    function targetMenuRows('), ui.indexOf('    function chooseActor('));

test('target choices and cancel issue no commands, and a Core weapon switch requires two confirmations', async () => {
  function el(tag, className = '', text = '') {
    return {tag, className, text, children: [], append(...nodes) { this.children.push(...nodes); },
      replaceChildren() { this.children = []; }, setAttribute(key,value) { this[key]=value; }, focus() {}};
  }
  const card = el('section');
  const nodes = (root = card) => [root, ...(root.children || []).flatMap(node => nodes(node))];
  const execute = () => nodes().find(node => node.id === 'v2-action-execute');
  const rows = () => nodes().filter(node => node.className === 'v2-target-row');
  const actor = {id: 'ogre'}, occupant = {id: 'enemy', name: 'Guard', team: 'enemy'};
  const state = {revision: 1, cells: [], units: [actor, occupant]};
  const target = {x: 4, y: 3};
  const view = {target, intentRevision: state.revision};
  const clearContext = () => Object.assign(view, {target: null, intentRevision: null, targetOption: null, afterWeaponSwitch: false});
  const fire = weaponKey => ({command: {type: 'PlayerFire', weaponKey}, label: weaponKey, attack:{name:weaponKey,shortName:'Hpt',icon:weaponKey,shots:1}});
  const secondary = {command: {type: 'SelectWeapon', weaponKey: 'secondary'}, label: 'switch to secondary',
    attack:{name:'switch to secondary',shortName:'Sek ↔',icon:'secondary',shots:4}};
  const select = {command: {type: 'SelectWeapon', weaponKey: 'missiles'}, label: 'switch to missiles',
    attack:{name:'switch to missiles',shortName:'Rak ↔',icon:'missiles',shots:2}};
  const dispatched = [];
  const query = () => ({ok: true});
  const context = {
    at: selector => selector === '#v2-target-card' ? card : selector === '#v2-action-execute' ? execute() : el('button'),
    GameDialogs: {isOpen: () => false}, document: {body: {classList: {contains: () => false}}, createTextNode: text => el('#text', '', text)},
    state, actor, view, el, core: () => true, targetOccupant: () => occupant, unitAlive: () => true, hexLabel: () => 'E-04',
    entriesAt: () => state.revision === 1 ? [fire('main'), secondary, select] : [fire('missiles')],
    entryResult: query, query, commandIcon: () => 'fire', commandKey: entry => JSON.stringify(entry.command), entryChance: () => null,
    t: (key,params) => params?.count ?? key, svgIcon: name => name, placeNearHex() {}, clearContext, revision: () => state.revision,
    dispatch(command, revision) { dispatched.push([command.type, revision]); state.revision++; return {ok: true}; }
  };
  runInNewContext(targetCard + '\nfunction render() { renderTargetCard(state, actor); }', context);

  context.render();
  assert.deepEqual(rows().map(row => row.children[0].children[1].text), ['Hpt', 'Sek ↔', 'Rak ↔']);
  assert.ok(rows().every(row => row.title && row.title === row['aria-label']));
  assert.match(rows()[0].title, /Guard · E-04.*v2.target.executeRow/);
  assert.match(rows()[2].title, /switch to missiles.*v2.target.switchOnly/);
  const menuFacts = () => rows().map(row => [row.title, row.children[0].children[1].text, row.children[2].text]);
  const before = menuFacts();
  state.scenario = 'different-mission-with-the-same-effective-rules';
  context.render();
  assert.deepEqual(menuFacts(), before);
  assert.equal(nodes().some(node => node.id === 'v2-target-cancel'), false);
  assert.deepEqual(dispatched, []);

  const outside = ui.slice(ui.indexOf('    function dismissTargetOnOutsideClick('),
    ui.indexOf("    document.addEventListener('click', dismissTargetOnOutsideClick"));
  runInNewContext(outside, context);
  let prevented = false, stopped = false;
  context.dismissTargetOnOutsideClick({
    target: {closest: () => null},
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  });
  assert.equal(prevented && stopped, true);
  assert.equal(card.hidden, true);
  assert.deepEqual(dispatched, []);

  Object.assign(view, {target, intentRevision: state.revision});
  context.render();
  await rows()[2].onclick();
  assert.deepEqual(dispatched, [['SelectWeapon', 1]]);
  assert.equal(view.target, target);
  assert.equal(rows().length, 1);
  assert.notDeepEqual(menuFacts(), before);
  assert.equal(execute().children[2].text, '✓');
  const stale = execute().onclick;
  view.target = {...target};
  await stale();
  assert.deepEqual(dispatched, [['SelectWeapon', 1]]);
  context.render();
  await execute().onclick();
  assert.deepEqual(dispatched, [['SelectWeapon', 1], ['PlayerFire', 2]]);
  assert.equal(card.hidden, true);
});

test('target odds follow the CRT and distinguish disabled units, infantry, components and tracks', () => {
  const band = ['NE', 'NE', 'D', 'D', 'D', 'X'];
  const context = {COMBAT_RULES: {crt: {'2-1': band}}};
  const odds = ui.slice(ui.indexOf('    function hitChance('), ui.indexOf('    function trainingFirePreview('));
  runInNewContext(odds, context);
  const result = (target, component = false) => ({...context.hitChance({ratioCategory:'2-1'}, target, component)});
  assert.deepEqual(result({hp: 2}), {ratio:'2:1', hit:4/6, disable:3/6, destroy:1/6});
  assert.deepEqual(result({hp: 2, disabled: true}), {ratio:'2:1', hit:4/6, disable:null, destroy:4/6});
  assert.deepEqual(result({hp: 2, infantry: true}), {ratio:'2:1', hit:4/6, disable:null, destroy:1/6});
  assert.deepEqual(result({hp: 2}, true), {ratio:'2:1', hit:1/6, destroy:1/6});
  assert.deepEqual({...context.hitChance({meaning:'tread-roll-5-6'}, null, true)}, {ratio:'5–6', hit:2/6, destroy:null});
});

test('the same live fire rules yield the same menu across T02 and T03, then react to a changed target', async () => {
  const snapshots = [];
  const odds = ui.slice(ui.indexOf('    function hitChance('), ui.indexOf('    function trainingFirePreview('));
  const rows = ui.slice(ui.indexOf('    function targetMenuRows('), ui.indexOf('    function missileWarning('));
  for (const mission of ['training-t02', 'training-t03']) {
    const game = await trainingScene(mission);
    game.run(`
      const GoblinLanguage={current:'de'};
      ${targetOptionsSource}
      ${odds}
      ${rows}
      const tank=units.find(unit=>unit.id===currentScenario+'-tank');
      const guard=units.find(unit=>unit.id===currentScenario+'-hostile');
      tank.x=3;
      terrain.clear(); terrainTypes.clear();
      turnPhase='fire';
      const menu=()=>{
        const state={scenario:currentScenario,revision:revision(),phase,turnPhase,gameOver,units};
        const legal=entriesAt(state,tank,{x:guard.x,y:guard.y}).filter(entry=>entryResult(entry).ok);
        return targetMenuRows(legal).map(row=>({label:row.label,icon:row.icon,odds:entryChance(row.entry,guard)}));
      };
    `);
    const world = game.state(), rng = game.rng();
    const snapshot = read(game, 'menu()');
    assert.equal(snapshot.length, 1, mission);
    assert.equal(game.state(), world);
    assert.deepEqual(game.rng(), rng);
    snapshots.push(snapshot);
    game.run('guard.disabled=true');
    const changed = read(game, 'menu()');
    assert.equal(changed[0].odds.disable, null);
    assert.ok(changed[0].odds.destroy > snapshot[0].odds.destroy);
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
});

const warningSource = ui.slice(ui.indexOf('    function missileWarning('), ui.indexOf('    function targetRowFacts('));
const runCommand = warningSource + ui.slice(ui.indexOf('    async function runCommand('), ui.indexOf('    function chooseActor('));

for (const [profile, type] of [['FULL U13', 'CatalogHexFire'], ['Legacy', 'Fire']]) {
  test(`${profile} missile warns of attack 6 direct and 3 adjacent before dispatch`, async () => {
    const target = {x: 4, y: 0};
    const view = {target, intentRevision: 1};
    const state = {units: []};
    const warnings = [];
    const context = {
      view, state, URL, URLSearchParams, location: {href: import.meta.url}, document: {readyState: 'loading', addEventListener() {}},
      phaseCanAct() {}, phaseDoneLabel() {}, weaponTargetAllowed() {}, showUnitInfo() {}, attack() {},
      revision: () => 1, query: () => ({ok: true}), hexLabel: () => 'E-01', render() {},
      GameDialogs: {confirm(warning) { warnings.push(warning); return false; }},
      dispatch() { assert.fail('Cancel must not dispatch a missile strike'); }
    };
    for (const file of ['strategic-missile.js', 'localization.js']) {
      runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
    }
    context.t = (key, params) => context.GoblinLanguage.t(key, params, 'de');
    runInNewContext(runCommand, context);

    await context.runCommand(state, {command: {type, ...target}, confirmSplash: true});
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].title, context.t('v2.ui.missile'));
    assert.match(warnings[0].message, /E-01.*Angriff 6 direkt, 3 auf Nachbarfeldern/);
    assert.equal(view.target, target);
  });
}

test('Iron Dust Core D-04 opens the legal move confirmation after pointer hover', () => {
  const session = createIronDustBrowserSession();
  const source = buildIronDustV2View(session.projection, session.profile.header.ruleProfileId);
  const slice = (start, end) => ui.slice(ui.indexOf(start), ui.indexOf(end));
  const node = (tag, className = '', text = '') => ({
    tag, className, text, children: [], append(...nodes) { this.children.push(...nodes); },
    replaceChildren() { this.children = []; }, setAttribute(key,value) { this[key]=value; }, focus() {}
  });
  const card = node('section');
  const children = (root = card) => [root, ...(root.children || []).flatMap(child => children(child))];
  const calls = [];
  const context = {
    ...lifeGlobals, view: {}, core: () => true,
    IronDustBrowserV2: {
      epoch: 1, session, view: source, formatError: code => code,
      query(command) { const result = queryIronDustProfile(session.profile, command); calls.push({command, result}); return result; }
    },
    GoblinLanguage: {current: 'de', translate: key => key}, GameDialogs: {isOpen: () => false},
    document: {body: {classList: {contains: () => false}}},
    M1UnitMarkers: {core() {}}, TerrainDisplay: {label: type => type},
    S: 5, hexCenter: (x, y) => ({x: x * 10, y: y * 10}),
    nativeMap: {
      createSVGPoint: () => ({matrixTransform() { return this; }}),
      getScreenCTM: () => ({inverse() {}})
    },
    el: node, svgIcon: () => '', t: key => key, placeNearHex() {},
    at: selector => selector === '#v2-target-card' ? card : children().find(child => '#' + child.id === selector)
  };
  runInNewContext([
    slice('    function revision(', '    function legacyLogEntries('),
    slice('    let idleCoreLog=', '    function previewFire('),
    slice('    function clearContext(', '    function coreOpenCount('),
    slice('    function coreOpenCount(', '    // Own units'),
    targetOptionsSource,
    revealTargetControl,
    slice('    function inspectTrainingTarget(', '    const areaCache'),
    slice('    function cellAt(', '    function clearMapHover('),
    'let startZoomPending; function render() { const state = project(); renderTargetCard(state, state.units.find(unit => unit.id === view.actorId)); }'
  ].join('\n'), context);
  context.chooseActor('ogre');
  calls.length = 0;
  const projected = context.project();
  const actor = projected.units.find(unit => unit.id === context.view.actorId);
  const hovered = context.cellAt(30.5, 30);
  const [option] = context.entriesAt(projected, actor, hovered);
  context.entryResult(option);
  context.chooseHex(3, 3);
  const move = calls.find(({command}) => command.type === 'Move' && command.unitId === 'ogre' && command.to.x === 3 && command.to.y === 3);
  assert.equal(move?.result.available, true, JSON.stringify(move));
  assert.equal(move.result.cost, 3);
  assert.deepEqual(Object.keys(move.command.to).sort(), ['x', 'y']);
  assert.equal(card.hidden, false);
  assert.ok(children().some(child => child.id === 'v2-action-execute'));
  assert.ok(children().some(child => child.title?.includes('MOVE COST 3')));
});

test('component fire groups weapon and spotter choices before aiming and confirming', async () => {
  function el(tag, className = '', text = '') {
    return {tag, className, text, children: [], append(...nodes) { this.children.push(...nodes); },
      replaceChildren() { this.children = []; }, setAttribute(key,value) { this[key]=value; }, focus() {}};
  }
  const card = el('section');
  const nodes = (root = card) => [root, ...root.children.flatMap(node => nodes(node))];
  const execute = () => nodes().find(node => node.id === 'v2-action-execute');
  const choose = text => nodes().find(node => node.tag === 'button' && node.children[0]?.children[1]?.text === text);
  const actor = {id: 'battery'}, target = {id: 'defender', x: 8, y: 4, team: 'enemy'};
  const view = {target, intentRevision: 1};
  const state = {revision: 1, units: [actor, target]};
  const options = ['Blocked', 'Scout', 'Tank'].flatMap(spotterId =>
    ['Main', 'Treads'].map(componentId => ({
      command: {type: 'CatalogFire', mode: 'indirect', spotterId, weaponId: null, target: {kind: 'component', componentId}},
      label: spotterId + ' · ' + componentId, weaponLabel: spotterId, componentLabel: componentId
    })));
  const dispatched = [], previews = [];
  const query = command => ({ok: command.spotterId !== 'Blocked'});
  const context = {
    at: selector => selector === '#v2-target-card' ? card : selector === '#v2-map' ? el('div') : execute(),
    document: {body: {classList: {contains: () => false}}, createTextNode: text => el('#text', '', text)},
    GameDialogs: {isOpen: () => false}, state, actor, view, el, core: () => false,
    terrainTypeAt: () => null, targetOccupant: () => target, hexLabel: () => 'I-05', unitAlive: () => true,
    entriesAt: () => [{command:{type:'CatalogFire', mode:'direct'}, label:'Direct'}, ...options],
    entryResult: entry => query(entry.command), query, commandIcon: () => 'fire',
    commandKey: entry => JSON.stringify(entry.command), entryChance(entry) { previews.push(entry.command); },
    t: key => key, svgIcon: () => '', placeNearHex() {}, revision: () => 1,
    clearContext() { view.target = null; },
    dispatch(command) { dispatched.push(command); return {ok: true}; }
  };
  runInNewContext(targetCard + '\nfunction render() { renderTargetCard(state, actor); }', context);

  context.render();
  assert.equal(choose('Blocked'), undefined);
  assert.equal(choose('Main'), undefined);
  assert.equal(execute(), choose('Direct'));
  assert.equal(previews.length, 1);
  const indirect = choose('v2.ui.artillery.indirect');
  assert.equal(indirect.children[2].text, '›');
  assert.match(indirect.title, /v2.target.openChoice/);
  indirect.onclick();
  assert.ok(choose('Scout'));
  assert.ok(choose('Tank'));
  assert.equal(choose('Blocked'), undefined);
  choose('Tank').onclick();
  assert.equal(choose('Main').children[2].text, '✓');
  assert.match(choose('Treads').title, /Tank · Treads/);
  assert.deepEqual(dispatched, []);
  await choose('Treads').onclick();
  assert.deepEqual(dispatched, [options[5].command]);
});
