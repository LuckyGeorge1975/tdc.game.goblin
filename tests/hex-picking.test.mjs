import test from 'node:test';
import assert from 'node:assert/strict';
import { center, pickCellAt, vertices } from '../src/hex-renderer/geometry.mjs';
import { createHexRenderer } from '../src/hex-renderer/renderer.mjs';
import { createGame, phaseScenario, PHASE_SEED } from '../src/core/game-core.mjs';

const layout = { orientation: 'pointy-top', offset: 'odd-row', radius: 62, origin: { x: 0, y: 0 } };
const map = { width: 12, height: 8 };
const edge = vertices({ x: 0, y: 0 }, layout);
const shared = { x: (edge[0].x + edge[5].x) / 2, y: (edge[0].y + edge[5].y) / 2 };

test('T-U02: exact shared edge uses smallest row then column; both sides use their own hex', () => {
  assert.deepEqual(pickCellAt(shared, map, layout), { x: 0, y: 0 });
  assert.deepEqual(pickCellAt({ x: shared.x - 0.001, y: shared.y }, map, layout), { x: 0, y: 0 });
  assert.deepEqual(pickCellAt({ x: shared.x + 0.001, y: shared.y }, map, layout), { x: 1, y: 0 });
  assert.deepEqual(pickCellAt(center({ x: 0, y: 1 }, layout), map, layout), { x: 0, y: 1 });
  assert.equal(pickCellAt({ x: -500, y: -500 }, map, layout), null);
  assert.deepEqual(pickCellAt(edge[1], map, layout), { x: 0, y: 0 });
});

class Node {
  constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.attrs = {}; this.children = []; this.listeners = {}; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
}
const doc = { createElementNS(_ns, tag) { return new Node(tag, doc); } };

test('T-U02: pointer world transform overrides arbitrary SVG edge target after pan/zoom', () => {
  const state = createGame(phaseScenario, PHASE_SEED), original = JSON.stringify(state), picks = [];
  const svg = new Node('svg', doc);
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: (this.x - 17) / 2, y: (this.y + 23) / 2 }; } });
  const visualMap = { schemaVersion: 1, mapId: 'test', bounds: { x: 0, y: 0, width: 1440, height: 960 }, hexLayout: layout,
    detailSeed: 1, features: [] };
  createHexRenderer({ svg, onPick: pick => picks.push(pick) }).render({ state, visualMap });
  const picking = svg.children.find(layer => layer.attrs['data-layer'] === 'picking');
  const target = picking.children.find(node => node.attrs['data-x'] === '1' && node.attrs['data-y'] === '0');
  const clickAt = world => target.listeners.click({ clientX: 17 + world.x * 2, clientY: -23 + world.y * 2 });
  clickAt(shared);
  clickAt({ x: shared.x + 0.001, y: shared.y });
  assert.deepEqual(picks, [{ type: 'hex', cell: { x: 0, y: 0 } }, { type: 'hex', cell: { x: 1, y: 0 } }]);
  assert.equal(JSON.stringify(state), original);
});
