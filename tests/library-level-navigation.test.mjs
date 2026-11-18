import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const flow = readFileSync(new URL('../ui-v2-flow.js', import.meta.url), 'utf8');
const slice = (start, end) => flow.slice(flow.indexOf(start), flow.indexOf(end, flow.indexOf(start)));

test('level arrows select one available row and reveal it without opening briefing', () => {
  const calls = [];
  const rows = ['alpha', 'bravo', 'charlie'].map(id => ({id: 'v2-level-' + id,
    focus: options => calls.push(['focus', id, options.preventScroll]),
    scrollIntoView: options => calls.push(['scroll', id, options.block])}));
  const list = {
    contains: row => rows.includes(row),
    querySelectorAll(selector) {
      assert.equal(selector, '.v2-level-choice:not(:disabled)');
      return rows;
    }
  };
  const context = {
    missionId: 'alpha', startError: 'old error', GameDialogs: {isOpen: () => false},
    renderScreen: focus => calls.push(['render', focus]),
    document: {getElementById: id => rows.find(row => row.id === id)}
  };
  runInNewContext(slice('    function selectLevel(', '    function returnToSelectedLevel('), context);
  function press(key, row, modifiers = {}) {
    let prevented = false;
    context.stepLevelSelection({key, currentTarget: list, target: {closest: () => row},
      preventDefault() { prevented = true; }, ...modifiers});
    return prevented;
  }

  assert.equal(press('ArrowDown', rows[0]), true);
  assert.equal(context.missionId, 'bravo');
  assert.equal(context.startError, '');
  assert.deepEqual(calls.splice(0), [['render', false], ['scroll', 'bravo', 'nearest'], ['focus', 'bravo', true]]);
  assert.equal(press('ArrowDown', rows[1]), true);
  assert.equal(context.missionId, 'charlie');
  calls.length = 0;
  assert.equal(press('ArrowDown', rows[2]), true);
  assert.deepEqual(calls, []);
  assert.equal(press('ArrowUp', rows[2]), true);
  assert.equal(context.missionId, 'bravo');

  calls.length = 0;
  assert.equal(press('ArrowUp', null), false);
  assert.equal(press('ArrowUp', rows[1], {altKey: true}), false);
  assert.equal(press('Enter', rows[1]), false);
  assert.deepEqual(calls, []);
  assert.match(flow, /list\.addEventListener\('keydown', stepLevelSelection\)/);
});

test('library switches between four localized areas and keeps unit and terrain deep links', () => {
  function node(tag) {
    return {tag, children: [], append(...children) { this.children.push(...children); }, setAttribute() {}};
  }
  const context = {
    document: {createElement: node, readyState: 'loading', addEventListener() {}},
    location: {href: import.meta.url}, URL, URLSearchParams,
    libraryKind: 'units', screen: 'play', returnScreen: '', libraryIndex: 0, terrainIndex: 0,
    libraryTab: 'range', libraryLiveId: null, libraryFullRegistry:()=>null, terrainIds: ['open-ground', 'rubble-field'], unitGuideEntries: [{coreUnitId:'first'}, {coreUnitId:'second'}],
    GameDialogs: {isOpen: () => false},
    GoblinUIV2: {project: () => ({scenario: 'iron-dust-v2', units: [{id:'first'}, {id:'second'}]})}, matchMedia: () => ({matches: false}), renderScreen() {},
    button: (textContent, onclick) => ({...node('button'), textContent, onclick}),
    paragraph: textContent => ({...node('p'), textContent}),
    show: screen => { context.screen = screen; }
  };
  runInNewContext(readFileSync(new URL('../localization.js', import.meta.url), 'utf8'), context);
  runInNewContext(slice('    function libraryKindSwitch(', '    globalThis.GoblinV2Flow ='), context);
  for (const lang of context.GoblinLanguage.languages) {
    context.t = key => {
      const text = context.GoblinLanguage.t(key, {}, lang);
      assert.notEqual(text, key, lang + ' ' + key);
      return text;
    };
    const choices = context.libraryKindSwitch().children;
    assert.equal(context.t('v2.library.title').length > 0, true);
    assert.deepEqual(choices.map(choice => choice.id),
      ['v2-library-kind-rules', 'v2-library-kind-units', 'v2-library-kind-terrain', 'v2-library-kind-tips']);
    choices[0].onclick();
    const plan = context.libraryReference(context.libraryKind);
    assert.equal(plan.children.filter(child => child.tag === 'ul').length, 3);
    assert.equal(plan.children.at(-1).children.length, 4);
    choices[3].onclick();
    assert.equal(context.libraryReference(context.libraryKind).children[0].textContent, context.t('v2.library.tips.status'));
  }
  context.openLibrary('terrain', 'rubble-field');
  assert.equal(context.screen, 'catalog');
  assert.equal(context.returnScreen, 'play');
  assert.equal(context.libraryKind, 'terrain');
  assert.equal(context.terrainIndex, 1);
  context.screen = 'play';
  context.openLibrary('unit', 'second');
  assert.equal(context.libraryKind, 'units');
  assert.equal(context.libraryIndex, 1);
  assert.equal(context.libraryTab, 'description');
});
test('FULL reference weapons use approved slots and all four locales contain the linked rules', () => {
  const registry = JSON.parse(readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url),'utf8'));
  const context = {started:false, GoblinCatalogFullModel:{editorProfile:{catalog:{registry}}},
    libraryAssetId:entry=>entry.id};
  runInNewContext(readFileSync(new URL('../ogre-systems.js',import.meta.url),'utf8'),context);
  runInNewContext(readFileSync(new URL('../siege-tank-fire-budget.js',import.meta.url),'utf8'),context);
  runInNewContext(readFileSync(new URL('../library-full-copy.js',import.meta.url),'utf8') +
    slice('    function libraryFullRegistry(', '    function libraryWeaponName(') +
    '\n globalThis.refs={rules:libraryFullRules, units:libraryFullUnitRules};',context);
  const weapons = id => JSON.parse(JSON.stringify(context.libraryReferenceWeapons({id},registry)));
  assert.deepEqual(weapons('goblin-siegebreaker').map(w=>[w.id,w.range]).sort(),
    [['antipersonnel',1],['main',3],['missiles',5],['secondary',2]]);
  assert.deepEqual(weapons('siege-tank').map(w=>w.attack),[3,6,1]);
  assert.deepEqual(weapons('command-hub'),[]);
  assert.equal(weapons('strategic-missile-carrier')[0].range,8);
  assert.equal(context.libraryFullRegistry({}),registry);
  const special = (id, profile) => Array.from(context.librarySpecialRules({id},{profile}) ?? []);
  assert.deepEqual(special('forge-engineer'), ['drones','systems','engineering']);
  assert.deepEqual(special('goblin-dreadnaught'), ['systems','ram']);
  assert.deepEqual(special('phantom-platform'), ['systems','stealth']);
  context.started=true;
  assert.equal(context.libraryFullRegistry({profile:'FIELD_TEST_LEGACY_v1'}),null);
  assert.equal(context.libraryFullRegistry({profile:'FULL_CATALOG_v1'}),registry);
  context.UnitVisuals = {artKey:unit => unit.art};
  context.legacySession = {ruleProfileId:'FIELD_TEST_LEGACY_v1',config:{units:[{id:'ogre',art:'goblin-siegebreaker'},{art:'skimmer-carrier',transportCapacity:3}]}};
  assert.deepEqual(special('goblin-siegebreaker','FIELD_TEST_LEGACY_v1'), ['legacyRam','systems']);
  assert.deepEqual(special('skimmer-carrier','FIELD_TEST_LEGACY_v1'), ['legacyPassengers']);
  context.legacySession = {ruleProfileId:'CATALOG_ARTILLERY_PILOT_v1',config:{units:[{art:'long-range-battery',artilleryFire:{}}]}};
  assert.deepEqual(special('long-range-battery','CATALOG_ARTILLERY_PILOT_v1'), ['spotter']);
  context.legacySession = {ruleProfileId:'CATALOG_SKIMMER_PILOT_v1',config:{movement:{secondary:3},units:[{art:'combat-skimmer',gev:true}]}};
  assert.deepEqual(special('combat-skimmer','CATALOG_SKIMMER_PILOT_v1'), ['gev']);
  context.legacySession = {ruleProfileId:'FULL_CATALOG_v1',config:{catalog:{registry}}};
  assert.deepEqual(special('raider-skimmer','FULL_CATALOG_v1'), ['raider']);
  assert.deepEqual(special('skimmer-carrier','FULL_CATALOG_v1'), ['gev','passengers','drones']);
  for (const id of ['field-engineers','local-defense','infantry-platoon'])
    assert.ok(special(id,'FULL_CATALOG_v1').includes('infantryFixed'));
  context.legacySession = {ruleProfileId:'CATALOG_SPECIALISTS_v1',config:{catalog:{registry}}};
  assert.deepEqual(special('phantom-platform','CATALOG_SPECIALISTS_v1'), ['systems']);
  assert.deepEqual(special('strategic-missile-carrier','CATALOG_SPECIALISTS_v1'), []);
  assert.equal(Object.keys(context.refs.units).length,26);
  assert.equal(context.refs.rules.length,15);
  for (const lang of ['de','en','es','fr']) {
    const {messages} = JSON.parse(readFileSync(new URL(`../assets/ui-copy/library-01.${lang}.json`,import.meta.url),'utf8'));
    for (const id of context.refs.rules)
      assert.ok(messages[`library.rules.${id}.title`] && messages[`library.rules.${id}.body`]);
    for (const [id,rules] of Object.entries(context.refs.units)) {
      assert.ok(messages[`library.unit.${id}.tactics`]);
      assert.ok(rules.every(rule=>context.refs.rules.includes(rule)));
    }
  }
});
