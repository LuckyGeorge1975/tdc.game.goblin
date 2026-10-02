import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const content = JSON.parse(readFileSync(new URL('../assets/ui-copy/content-02.de.json', import.meta.url), 'utf8'));

function legacyTrial() {
  const nodes = new Map();
  const element = () => ({
    innerHTML: '', textContent: '', checked: false, disabled: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, addEventListener() {}, appendChild() {}, before() {}, querySelector() { return null; }, animate() {},
    insertAdjacentHTML(_, html) { this.innerHTML = html + this.innerHTML; },
  });
  const document = {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); },
    querySelectorAll() { return []; }, createElement: element, createElementNS: element, addEventListener() {},
  };
  const context = vm.createContext({
    document, structuredClone, console, window: {},
    GameDialogs: { isOpen: () => false, cancel() {}, confirm: async () => true },
    localStorage: { getItem() { return null; } }, setTimeout() { return 1; }, clearTimeout() {},
  });
  const run = source => vm.runInContext(source, context);
  for (const file of ['unit-visuals.js', 'terrain-rules.js', 'ogre-systems.js', 'game.js', 'ogre-runtime.js',
    'combat-feedback.js', 'siegebreaker-weapons.js', 'scenario.js', 'command-history.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run("draw=()=>{}; updateSelection=()=>{}; loadScenario('unit-trial');");
  return { run };
}

test('Unit Trial objective metadata describes core plus escorts; core alone never ends the mission', () => {
  const { run } = legacyTrial();
  assert.equal(run("scenarioCatalog['unit-trial'].objective"), 'core-and-escort');
  assert.equal(content.missions['unit-trial'].sourceObjectiveCode, 'core-and-escort');
  assert.equal(content.missions['unit-trial'].winCondition, 'enemy-core-and-all-enemies-destroyed-and-player-survives');
  run('units.find(unit => unit.core).hp = 0');
  assert.equal(run('checkVictory()'), false);
  assert.equal(run('gameOver'), false);
  assert.notEqual(run("document.querySelector('#phase-title').textContent"), 'MISSION COMPLETE');
  run("units.filter(unit => unit.team === 'enemy').forEach(unit => unit.hp = 0)");
  assert.equal(run('checkVictory()'), true);
  assert.equal(run("document.querySelector('#phase-title').textContent"), 'MISSION COMPLETE');
});

test('player elimination takes precedence over victory, including simultaneous elimination', () => {
  const defeat = legacyTrial();
  defeat.run("units.filter(unit => unit.team === 'player').forEach(unit => unit.hp = 0)");
  assert.equal(defeat.run('checkVictory()'), true);
  assert.equal(defeat.run("document.querySelector('#phase-title').textContent"), 'MISSION FAILED');

  for (const scenario of ['iron-dust', 'relay-run', 'unit-trial', 'atlas-proving-grounds',
    'showcase-terrain-course', 'showcase-advance', 'showcase-siege', 'showcase-specialists']) {
    const simultaneous = legacyTrial();
    simultaneous.run(`currentScenario=${JSON.stringify(scenario)};units.forEach(unit => unit.hp = 0)`);
    assert.equal(simultaneous.run('checkVictory()'), true, scenario);
    assert.equal(simultaneous.run("document.querySelector('#phase-title').textContent"), 'MISSION FAILED', scenario);
  }
});

test('Iron Dust keeps its core-only objective when a player survives', () => {
  const ironDust = legacyTrial();
  ironDust.run("loadScenario('iron-dust');units.find(unit => unit.core).hp = 0");
  assert.ok(ironDust.run("units.some(unit => unit.team === 'enemy' && unit.hp > 0)"));
  assert.ok(ironDust.run("units.some(unit => unit.team === 'player' && unit.hp > 0)"));
  assert.equal(ironDust.run('checkVictory()'), true);
  assert.equal(ironDust.run("document.querySelector('#phase-title').textContent"), 'MISSION COMPLETE');

  const relayRun = legacyTrial();
  relayRun.run("loadScenario('relay-run');units.find(unit => unit.core).hp = 0");
  assert.equal(relayRun.run('checkVictory()'), false);
  assert.equal(relayRun.run('gameOver'), false);
});
