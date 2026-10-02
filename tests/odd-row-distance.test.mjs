import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { hexDistance, movementPaths } from '../src/core/hex.mjs';

function legacy() {
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
    'combat-feedback.js', 'siegebreaker-weapons.js', 'strategic-missile.js', 'scenario.js', 'command-history.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run("draw=()=>{};updateSelection=()=>{};loadScenario('unit-trial');terrain.clear();terrainTypes.clear();document.querySelector('#auto-end-turn').checked=false");
  return run;
}

test('legacy distance agrees with core on every board pair and edge/radius vectors', () => {
  const run = legacy();
  const vectors = [
    [[2, 2], [2, 3], 1], [[2, 2], [1, 1], 1], [[2, 2], [3, 1], 2],
    [[2, 3], [3, 4], 1], [[2, 3], [1, 4], 2], [[0, 1], [1, 2], 1], [[1, 1], [0, 2], 2],
    [[0, 0], [1, 2], 2], [[2, 0], [0, 2], 3], [[0, 0], [2, 2], 3], [[3, 0], [0, 2], 4],
    [[0, 0], [7, 2], 8], [[6, 0], [0, 6], 9],
  ];
  for (const [[ax, ay], [bx, by], expected] of vectors) {
    assert.equal(run(`dist({x:${ax},y:${ay}},{x:${bx},y:${by}})`), expected, `${ax},${ay} -> ${bx},${by}`);
  }
  for (let ay = 0; ay < 8; ay++) for (let ax = 0; ax < 12; ax++) {
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 12; bx++) {
      const a = { x: ax, y: ay }, b = { x: bx, y: by };
      assert.equal(run(`dist({x:${ax},y:${ay}},{x:${bx},y:${by}})`), hexDistance(a, b));
    }
  }
});

test('movement paths still match the core on open even and odd rows', () => {
  const run = legacy();
  for (const start of [{ x: 2, y: 2 }, { x: 2, y: 3 }]) {
    run(`units.splice(0,units.length,{id:'mover',x:${start.x},y:${start.y},hp:1,move:2,movementMode:'tracked',team:'player'})`);
    const core = movementPaths({ map: { width: 12, height: 8, terrain: [] }, units: [{ id: 'mover', ...start, hp: 1, move: 2, movementMode: 'tracked' }] },
      { id: 'mover', ...start, hp: 1, move: 2, movementMode: 'tracked' });
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const legacyReachable = !!run(`findMovementPath({x:${start.x},y:${start.y}},{x:${x},y:${y}},2,units[0])`);
      assert.equal(legacyReachable, (x === start.x && y === start.y) || core.has(`${x},${y}`), `${start.x},${start.y} -> ${x},${y}`);
    }
  }
});

test('the range fix retains legacy LOS pixel sampling at a boundary', () => {
  const run = legacy();
  assert.equal(run('dist({x:0,y:0},{x:4,y:3})'), 6);
  assert.equal(run('legacyLosSampleCount({x:0,y:0},{x:4,y:3})'), 56);
  run("terrain.add('2,1')");
  assert.equal(run('lineOfSight({x:0,y:0},{x:4,y:3})'), false);
});

test('fire and unload accept real neighbors and reject apparent ones', () => {
  const run = legacy();
  run("units.splice(0,units.length,{id:'shooter',name:'SHOOTER',x:2,y:3,hp:2,range:1,move:2,damage:1,team:'player'}, {id:'target',name:'TARGET',x:3,y:4,hp:2,defense:2,team:'enemy'});setTurnPhase('fire');selected=units[0]");
  assert.equal(run("phaseCanAct(units[0],'fire')"), true);
  run('handleHex(3,4)');
  assert.equal(run('units[0].fired'), true);

  run("units[0].fired=false;units[1].x=1;units[1].y=4;selected=units[0]");
  assert.equal(run("phaseCanAct(units[0],'fire')"), false);
  run('handleHex(1,4)');
  assert.equal(run('units[0].fired'), false);

  run("units.splice(0,units.length,{id:'carrier',x:2,y:3,hp:2,team:'player',transportCapacity:3}, {id:'cargo',x:2,y:3,hp:1,team:'player',infantry:true,embarkedOn:'carrier'});setTurnPhase('movement')");
  assert.equal(run('canUnloadTo(units[0],units[1],3,4)'), true);
  assert.equal(run('canUnloadTo(units[0],units[1],1,4)'), false);
  run("units[1].embarkedOn=null;units[1].x=3;units[1].y=4");
  assert.equal(run('canEmbark(units[0],units[1])'), true);
  run('units[1].x=1;units[1].y=4');
  assert.equal(run('canEmbark(units[0],units[1])'), false);
});

test('missile R8 gate and splash include only true neighbors, including friendly fire', () => {
  const run = legacy();
  run("units.splice(0,units.length,{id:'carrier',name:'CARRIER',x:6,y:0,hp:2,team:'player',strategicMissile:true,missilesRemaining:1,range:8,damage:6}, {id:'target',name:'TARGET',x:0,y:6,hp:2,defense:2,team:'enemy'});setTurnPhase('fire');attack(units[0],units[1])");
  assert.equal(run('units[0].missilesRemaining'), 1, 'distance nine is outside missile range');
  run('units[0].x=0;units[0].y=0;units[1].x=7;units[1].y=2;attack(units[0],units[1])');
  assert.equal(run('units[0].missilesRemaining'), 0, 'distance eight is inside missile range');

  const splash = legacy();
  splash("units.splice(0,units.length,{id:'carrier',name:'CARRIER',x:0,y:1,hp:2,team:'player',strategicMissile:true,missilesRemaining:1,range:8,damage:6}, {id:'target',name:'TARGET',x:2,y:3,hp:2,defense:2,team:'enemy'}, {id:'adjacent',name:'ADJACENT',x:3,y:4,hp:2,defense:2,team:'player'}, {id:'distant',name:'DISTANT',x:1,y:4,hp:2,defense:2,team:'player'});setTurnPhase('fire');attack(units[0],units[1])");
  assert.match(splash('logEl.innerHTML'), /ADJACENT \(EIGENE EINHEIT\)/);
  assert.doesNotMatch(splash('logEl.innerHTML'), /DISTANT \(EIGENE EINHEIT\)/);
});
