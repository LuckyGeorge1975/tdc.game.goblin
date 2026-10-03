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
  for (const file of ['unit-visuals.js', 'terrain-rules.js', 'ogre-systems.js', 'scenario-profile-manifest.js', 'game.js', 'ogre-runtime.js',
    'combat-feedback.js', 'siegebreaker-weapons.js', 'scenario.js', 'command-history.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run("draw=()=>{}; updateSelection=()=>{}; loadScenario('unit-trial');");
  const atlas = JSON.parse(readFileSync(new URL('../assets/unit-art/levels/atlas-proving-grounds.json', import.meta.url), 'utf8'));
  const showcases = JSON.parse(readFileSync(new URL('../assets/unit-art/levels/showcase-levels.json', import.meta.url), 'utf8')).levels;
  for (const level of [atlas, ...showcases]) {
    const objective = level.id === 'atlas-proving-grounds' ? 'core-and-escort' : level.objective;
    run(`scenarioCatalog[${JSON.stringify(level.id)}]={objectiveVersion:${level.schemaVersion},objective:${JSON.stringify(objective)}}`);
  }
  return { run };
}

test('versioned objective profiles cover every Legacy level and reject unknown contracts', () => {
  const { run } = legacyTrial();
  const ids = ['iron-dust', 'relay-run', 'unit-trial', 'atlas-proving-grounds',
    'showcase-terrain-course', 'showcase-advance', 'showcase-siege', 'showcase-specialists'];
  for (const id of ids) {
    assert.equal(run(`victoryProfile(scenarioCatalog[${JSON.stringify(id)}]).version`), 1, id);
    assert.equal(run(`victoryProfile(scenarioCatalog[${JSON.stringify(id)}]).requiresAllEnemies`), id !== 'iron-dust', id);
    assert.equal(run(`victoryProfile(scenarioCatalog[${JSON.stringify(id)}]).requiresPlayerSurvival`), true, id);
  }
  assert.throws(() => run("victoryProfile({objectiveVersion:2,objective:'core'})"), /Unsupported objective contract version/);
  assert.throws(() => run("victoryProfile({objectiveVersion:1,objective:'unknown'})"), /Unsupported objective/);
  assert.throws(() => run("victoryProfile({objective:'core'})"), /Unsupported objective contract version/);
});

test('a later scenario start rejects profile mismatch before changing the active party', () => {
  const { run } = legacyTrial();
  const before=run("JSON.stringify({scenario:currentScenario,units:units.map(u=>[u.id,u.x,u.y,u.hp])})");
  run("scenarioCatalog['relay-run'].scenarioVersion=2");
  assert.throws(()=>run("loadScenario('relay-run')"),/SCENARIO_PROFILE_MISMATCH/);
  assert.equal(run("JSON.stringify({scenario:currentScenario,units:units.map(u=>[u.id,u.x,u.y,u.hp])})"),before);
});

test('objective profiles distinguish core-only and escort without changing defeat priority', () => {
  const { run } = legacyTrial();
  for (const [id, withEscort] of [['iron-dust', false], ['unit-trial', true]]) {
    const profile = `victoryProfile(scenarioCatalog['${id}'])`;
    const roster = (player, core, escort) => `[{team:'player',hp:${player}},{team:'enemy',core:true,hp:${core}},{team:'enemy',hp:${escort}}]`;
    assert.equal(run(`victoryOutcome(${profile},${roster(1, 0, 1)})`), withEscort ? null : true);
    assert.equal(run(`victoryOutcome(${profile},${roster(1, 0, 0)})`), true);
    assert.equal(run(`victoryOutcome(${profile},${roster(1, 1, 0)})`), null);
    assert.equal(run(`victoryOutcome(${profile},${roster(0, 0, 0)})`), false);
    assert.equal(run(`victoryOutcome(${profile},${roster(0, 1, 1)})`), false);
  }
});

test('all eight Legacy profiles keep the mission active until their own goal is met', () => {
  const { run } = legacyTrial();
  const ids = Object.entries(content.missions).filter(([, mission]) => mission.scope.startsWith('legacy-playable')).map(([id]) => id);
  for (const id of ids) {
    const profile = `victoryProfile(scenarioCatalog[${JSON.stringify(id)}])`;
    const roster = (player, core, escort) => `[{team:'player',hp:${player}},{team:'enemy',core:true,hp:${core},maxHp:2},{team:'enemy',hp:${escort}}]`;
    const escortGoal = id !== 'iron-dust';
    assert.equal(run(`objectiveSnapshot(${profile},${roster(1, 0, 1)}).outcome`), escortGoal ? null : true, id);
    assert.equal(run(`objectiveSnapshot(${profile},${roster(1, 0, 1)}).remaining`), escortGoal ? 1 : 0, id);
    assert.equal(run(`objectiveSnapshot(${profile},${roster(1, 0, 0)}).outcome`), true, id);
    assert.equal(run(`objectiveSnapshot(${profile},${roster(0, 0, 0)}).outcome`), false, id);
  }
});

test('Legacy session survives catalog changes and resets only on a new start', () => {
  const { run } = legacyTrial();
  const sessionId = run('legacySession.sessionId');
  assert.equal(run('legacySession.scenarioId'), 'unit-trial');
  assert.equal(run('legacySession.ruleProfileId'), 'FIELD_TEST_LEGACY_v1');
  run("scenarioCatalog['unit-trial'].objective='core';scenarioCatalog['unit-trial'].units[0].hp=0");
  run("units.find(unit=>unit.core).hp=0;updateRoster();renderScenarioObjective()");
  assert.equal(run("document.querySelector('#objective-text').textContent"), 'HOSTILES 2/3');
  assert.equal(run('checkVictory()'), false, 'the bound escort goal remains active');
  assert.equal(run('legacySession.effectiveRules.objective'), 'core-and-escort');
  assert.ok(run('Object.isFrozen(legacySession.effectiveRules.units[0])'));
  assert.throws(()=>run("loadScenario('unit-trial')"), /SCENARIO_PROFILE_MISMATCH/);
  assert.equal(run('legacySession.sessionId'), sessionId, 'rejected start preserves the active session');
  run("loadScenario('relay-run')");
  assert.ok(run('legacySession.sessionId') > sessionId);
  assert.equal(run('legacySession.scenarioId'), 'relay-run');
  const switchedId = run('legacySession.sessionId');
  run('reset()');
  assert.ok(run('legacySession.sessionId') > switchedId, 'restart creates a fresh session');
  assert.equal(run('legacySession.scenarioId'), 'relay-run');
});

test('Legacy objective counters use the same profile and roster as the end condition', () => {
  const trial = legacyTrial();
  trial.run("loadScenario('unit-trial');updateRoster()");
  assert.equal(trial.run("document.querySelector('#objective-text').textContent"), 'HOSTILES 3/3');
  assert.equal(trial.run("document.querySelector('#objective-progress').style.width"), '0%');
  trial.run("units.find(unit => unit.core).hp=0;updateRoster()");
  assert.equal(trial.run("document.querySelector('#objective-text').textContent"), 'HOSTILES 2/3');
  assert.equal(trial.run("document.querySelector('#objective-progress').style.width"), '33%');
  assert.equal(trial.run('checkVictory()'), false);
  trial.run("units.filter(unit => unit.team==='enemy').forEach(unit => unit.hp=0);updateRoster()");
  assert.equal(trial.run("document.querySelector('#objective-text').textContent"), 'HOSTILES 0/3');
  assert.equal(trial.run("document.querySelector('#objective-progress').style.width"), '100%');
  assert.equal(trial.run('checkVictory()'), true);
  assert.equal(trial.run("document.querySelector('#phase-title').textContent"), 'MISSION COMPLETE');

  const iron = legacyTrial();
  iron.run("loadScenario('iron-dust');updateRoster()");
  assert.equal(iron.run("document.querySelector('#objective-text').textContent"), 'CORE OPERATIONAL · DAMAGE 0/2');
  iron.run("units.find(unit => unit.core).disabled=true;updateRoster()");
  assert.equal(iron.run("document.querySelector('#objective-text').textContent"), 'CORE DISABLED · DAMAGE 1/2');
  assert.equal(iron.run("document.querySelector('#objective-progress').style.width"), '50%');
  iron.run("units.find(unit => unit.core).hp=0;updateRoster()");
  assert.equal(iron.run("document.querySelector('#objective-text').textContent"), 'CORE OFFLINE');
  assert.equal(iron.run("document.querySelector('#objective-progress').style.width"), '100%');
  assert.equal(iron.run('checkVictory()'), true);
});

test('all four Legacy language catalogs and source metadata match objective profiles', () => {
  const { run } = legacyTrial();
  for (const [id, mission] of Object.entries(content.missions).filter(([, value]) => value.scope.startsWith('legacy-playable'))) {
    const profile = run(`victoryProfile(scenarioCatalog[${JSON.stringify(id)}])`);
    assert.equal(mission.sourceObjectiveCode, profile.objectiveCode, id);
    assert.equal(mission.winCondition, profile.requiresAllEnemies
      ? 'enemy-core-and-all-enemies-destroyed-and-player-survives'
      : 'enemy-core-destroyed-and-player-survives', id);
    for (const locale of ['de', 'en', 'fr', 'es']) {
      const catalog = JSON.parse(readFileSync(new URL(`../assets/ui-copy/content-02.${locale}.json`, import.meta.url), 'utf8'));
      for (const key of [mission.keys.objectiveShort, mission.keys.objectiveFull, mission.keys.victorySummary]) {
        assert.ok(catalog.messages[key]?.trim(), `${locale}: ${key}`);
      }
    }
  }
});

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
