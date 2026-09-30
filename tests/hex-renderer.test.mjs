import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, queryAreas, referenceScenario, REFERENCE_SEED } from '../src/core/game-core.mjs';
import { createHexRenderer, layerOrder } from '../src/hex-renderer/renderer.mjs';
import { outerBoundary } from '../src/hex-renderer/geometry.mjs';

class Node {
  constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.attrs = {}; this.children = []; this.listeners = {}; }
  setAttribute(key, value) { this.attrs[key] = value; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  click() { let stopped = false; this.listeners.click?.({ stopPropagation() { stopped = true; } }); return stopped; }
}
const doc = { createElementNS(_ns, tag) { return new Node(tag, doc); } };
const svg = () => new Node('svg', doc);

test('renderer has the contractual layer order and no gameplay mutation', () => {
  const state = createGame(referenceScenario, REFERENCE_SEED), original = JSON.stringify(state), target = svg(), picks = [];
  const renderer = createHexRenderer({ svg: target, onPick: pick => picks.push(pick) });
  renderer.render({ state, view: { focusedCell: { x: 1, y: 3 }, selectedUnitId: 'p-1', areaMode: 'movement', gridVisible: true }, areas: queryAreas(state, 'p-1') });
  assert.deepEqual(target.children.map(layer => layer.attrs['data-layer']), layerOrder);
  assert.equal(target.children[0].children.length, 96);
  assert.equal(target.children[1].children.length, 96);
  assert.equal(target.children[5].children[0].attrs['data-focus'], 'true');
  assert.equal(target.children[5].children[0].attrs['pointer-events'], 'none');
  assert.equal(JSON.stringify(state), original);
  target.children[0].children[0].click();
  target.children[4].children.find(unit => unit.attrs['data-unit-id'] === 'p-1').click();
  assert.deepEqual(picks, [{ type: 'hex', cell: { x: 0, y: 0 } }, { type: 'unit', unitId: 'p-1', cell: { x: 1, y: 3 } }]);
});

test('area boundary omits shared edges and attack targets get strong outlines', () => {
  assert.equal((outerBoundary([{ x: 0, y: 0 }, { x: 1, y: 0 }]).match(/M/g) ?? []).length, 10);
  const state = createGame(referenceScenario, REFERENCE_SEED), target = svg();
  const renderer = createHexRenderer({ svg: target });
  renderer.render({ state, view: { areaMode: 'fire', focusedCell: { x: 4, y: 3 } }, areas: { fireRange: [{ x: 4, y: 3 }], attackableTargets: ['e-1'] }, events: [{ type: 'ShotResolved', targetId: 'e-1' }] });
  const area = target.children[2].children;
  assert.equal(area.length, 2);
  assert.equal(area[0].attrs.stroke, 'none');
  assert.equal(area[1].attrs['stroke-width'], '3');
  const enemy = target.children[4].children.find(unit => unit.attrs['data-unit-id'] === 'e-1');
  assert.equal(enemy.children[0].attrs['stroke-width'], '5');
  assert.equal(target.children[6].children[0].attrs['data-event'], 'ShotResolved');
});

test('wrecks remain below active units at the same hex', () => {
  const state = createGame(referenceScenario, REFERENCE_SEED), target = svg();
  state.units[2].hp = 0; state.units[2].x = 1; state.units[2].y = 3;
  createHexRenderer({ svg: target }).render({ state });
  assert.equal(target.children[3].children[0].attrs['data-wreck-id'], 'e-1');
  assert.equal(target.children[4].children.find(u => u.attrs['data-unit-id'] === 'p-1')?.attrs['data-unit-id'], 'p-1');
});
