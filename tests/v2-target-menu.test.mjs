import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const targetCard = ui.slice(ui.indexOf('    function renderTargetCard('), ui.indexOf('    function chooseActor('));

test('target choices and cancel issue no commands, and a Core weapon switch requires two confirmations', async () => {
  function el(tag, className = '', text = '') {
    return {tag, className, text, children: [], append(...nodes) { this.children.push(...nodes); },
      replaceChildren() { this.children = []; }, setAttribute() {}, focus() {}};
  }
  const card = el('section');
  const nodes = (root = card) => [root, ...(root.children || []).flatMap(node => nodes(node))];
  const execute = () => nodes().find(node => node.id === 'v2-action-execute');
  const cancel = () => nodes().find(node => node.id === 'v2-target-cancel');
  const actor = {id: 'ogre'}, occupant = {id: 'enemy', name: 'Guard', team: 'enemy'};
  const state = {revision: 1, cells: [], units: [actor, occupant]};
  const target = {x: 4, y: 3};
  const view = {target, intentRevision: state.revision};
  const clearContext = () => Object.assign(view, {target: null, intentRevision: null, targetOption: null, afterWeaponSwitch: false});
  const fire = weaponKey => ({command: {type: 'PlayerFire', weaponKey}, label: weaponKey});
  const select = {command: {type: 'SelectWeapon', weaponKey: 'missiles'}, label: 'switch to missiles'};
  const dispatched = [];
  const query = () => ({ok: true});
  const context = {
    at: selector => selector === '#v2-target-card' ? card : selector === '#v2-action-execute' ? execute() : el('button'),
    GameDialogs: {isOpen: () => false}, document: {body: {classList: {contains: () => false}}, createTextNode: text => el('#text', '', text)},
    state, actor, view, el, core: () => true, targetOccupant: () => occupant, unitAlive: () => true, hexLabel: () => 'E-04',
    entriesAt: () => state.revision === 1 ? [fire('main'), select] : [fire('missiles')],
    entryResult: query, query, commandIcon: () => 'fire', commandKey: entry => JSON.stringify(entry.command), entryChance: () => null,
    t: key => key, svgIcon: () => '', placeNearHex() {}, clearContext, revision: () => state.revision,
    dispatch(command, revision) { dispatched.push([command.type, revision]); state.revision++; return {ok: true}; }
  };
  runInNewContext(targetCard + '\nfunction render() { renderTargetCard(state, actor); }', context);

  context.render();
  assert.equal(execute(), undefined);
  const chooseSwitch = () => nodes().find(node => node.tag === 'button' && node.children.some(child => child.text === select.label)).onclick();
  chooseSwitch();
  assert.equal(execute().text, 'v2.target.confirmWeapon');
  cancel().onclick();
  assert.equal(card.hidden, true);
  assert.deepEqual(dispatched, []);

  Object.assign(view, {target, intentRevision: state.revision});
  context.render();
  chooseSwitch();
  await execute().onclick();
  assert.deepEqual(dispatched, [['SelectWeapon', 1]]);
  assert.equal(view.target, target);
  assert.equal(execute().text, 'v2.action.execute');
  await execute().onclick();
  assert.deepEqual(dispatched, [['SelectWeapon', 1], ['PlayerFire', 2]]);
  assert.equal(card.hidden, true);
});

const runCommand = ui.slice(ui.indexOf('    async function runCommand('), ui.indexOf('    function chooseActor('));

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
