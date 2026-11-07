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
    libraryTab: 'range', terrainIds: ['open-ground', 'rubble-field'], unitGuideEntries: ['first', 'second'],
    libraryTarget: entry => ({unit: {id: entry}}), GameDialogs: {isOpen: () => false},
    GoblinUIV2: {project: () => ({})}, matchMedia: () => ({matches: false}), renderScreen() {},
    button: (textContent, onclick) => ({...node('button'), textContent, onclick}),
    paragraph: textContent => ({...node('p'), textContent}),
    show: screen => { context.screen = screen; }
  };
  runInNewContext(readFileSync(new URL('../localization.js', import.meta.url), 'utf8'), context);
  runInNewContext(slice('    function libraryKindSwitch(', '    function findUnit('), context);
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
  assert.equal(context.libraryTab, 'values');
});
