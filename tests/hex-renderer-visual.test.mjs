import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, phaseScenario, PHASE_SEED } from '../src/core/game-core.mjs';
import { center, points, outerBoundary } from '../src/hex-renderer/geometry.mjs';
import { createHexRenderer, visualLayerOrder, layerOrder } from '../src/hex-renderer/renderer.mjs';
import { validateVisualMap, validateStyleSet, visibleFeatures, safeDetailPath } from '../src/hex-renderer/visual-map.mjs';

class Node {
  constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.attrs = {}; this.children = []; this.listeners = {}; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  click() { let stopped = false; this.listeners.click?.({ stopPropagation() { stopped = true; } }); return stopped; }
}
const doc = { createElementNS(_ns, tag) { return new Node(tag, doc); } };
const svg = () => new Node('svg', doc);
const byLayer = (root, name) => root.children.find(child => child.attrs['data-layer'] === name);

const visualMap = Object.freeze({
  schemaVersion: 1, mapId: 'synthetic-world',
  bounds: { x: 0, y: 0, width: 500, height: 400 },
  hexLayout: { orientation: 'pointy-top', offset: 'odd-row', radius: 62, origin: { x: 100, y: 100 } },
  detailSeed: 91,
  features: [
    { id: 'grain', kind: 'grain', layer: 'ground-grain', zOrder: 1, bounds: { x: 25, y: 20, width: 40, height: 40 }, geometry: { type: 'polygon', points: [{ x: 25, y: 20 }, { x: 65, y: 20 }, { x: 45, y: 60 }] } },
    { id: 'woods', kind: 'forest', layer: 'forest', zOrder: 4, bounds: { x: 120, y: 180, width: 120, height: 70 }, geometry: { type: 'path', d: 'M120 180L240 180L240 250L120 250Z' } },
    { id: 'river', kind: 'river', layer: 'water', zOrder: 10, bounds: { x: 180, y: 50, width: 150, height: 280 }, geometry: { type: 'path', d: 'M180 50C220 140 290 240 330 330', fillRule: 'evenodd' } },
    { id: 'road', kind: 'road', layer: 'routes', zOrder: 11, bounds: { x: 100, y: 270, width: 340, height: 20 }, geometry: { type: 'path', d: 'M100 280L440 280' } },
  ],
});
const verdant = Object.freeze({ schemaVersion: 1, setId: 'verdant', name: 'Verdant', mapId: 'synthetic-world', tokens: {
  layers: { ground: { fill: '#ccd8b6' }, 'ground-grain': { fill: '#91a587', opacity: 0.3 }, water: { fill: 'none', stroke: '#2980a5', strokeWidth: 12 } },
  kinds: { forest: { fill: '#295e39', detail: { density: 50, seedMode: 'feature-id+world-coordinate' } }, road: { stroke: '#918677', strokeWidth: 8 } },
} });
const dryland = Object.freeze({ schemaVersion: 1, setId: 'dryland', name: 'Dryland', mapId: 'synthetic-world', tokens: {
  layers: { ground: { fill: '#b9b18b' }, water: { fill: 'none', stroke: '#557c96', strokeWidth: 12 } },
  kinds: { forest: { fill: '#817b53' }, road: { stroke: '#a99572', strokeWidth: 8 } },
} });

test('VisualMap layers and odd-row layout align grid, areas, units, focus, effects and picking', () => {
  const state = createGame(phaseScenario, PHASE_SEED), original = JSON.stringify(state), target = svg(), picks = [];
  const renderer = createHexRenderer({ svg: target, onPick: pick => picks.push(pick) });
  const cell = { x: 1, y: 1 };
  renderer.render({ state, visualMap, styleSet: verdant, view: { gridVisible: true, focusedCell: cell },
    areas: { movementReachable: [cell] }, events: [{ type: 'UnitMoved', to: cell }] });
  assert.deepEqual(target.children.filter(child => child.attrs['data-layer']).map(child => child.attrs['data-layer']), visualLayerOrder);
  assert.equal(target.attrs.viewBox, '0 0 500 400');
  assert.equal(byLayer(target, 'ground').children[0].attrs.fill, '#ccd8b6');
  assert.equal(byLayer(target, 'groundTexture').children[0].attrs['data-feature-id'], 'grain');
  assert.equal(byLayer(target, 'water').children[0].attrs['fill-rule'], 'evenodd');
  assert.equal(byLayer(target, 'water').attrs['pointer-events'], 'none');
  const expected = points(cell, visualMap.hexLayout);
  const pick = byLayer(target, 'picking').children.find(node => node.attrs['data-x'] === '1' && node.attrs['data-y'] === '1');
  assert.equal(pick.attrs.points, expected);
  assert.equal(pick.attrs.fill, 'transparent');
  assert.equal(pick.attrs['pointer-events'], 'all');
  assert.equal(byLayer(target, 'grid').children.find(node => node.attrs.points === expected)?.attrs['pointer-events'], 'none');
  assert.equal(byLayer(target, 'areas').children[0].attrs.points, expected);
  assert.equal(byLayer(target, 'areas').children[1].attrs.d, outerBoundary([cell], visualMap.hexLayout));
  assert.equal(byLayer(target, 'focus').children[0].attrs.points, expected);
  const marker = byLayer(target, 'units').children.find(node => node.attrs['data-unit-id'] === 'p-gev');
  assert.equal(marker.children[0].attrs.points, expected);
  assert.deepEqual([byLayer(target, 'effects').children[0].attrs.cx, byLayer(target, 'effects').children[0].attrs.cy],
    [String(center(cell, visualMap.hexLayout).x), String(center(cell, visualMap.hexLayout).y)]);
  assert.equal(center(cell, visualMap.hexLayout).x, 100 + Math.sqrt(3) * 62 * 1.5);
  assert.equal(center(cell, visualMap.hexLayout).y, 193);
  pick.click(); marker.click();
  assert.deepEqual(picks, [{ type: 'hex', cell }, { type: 'unit', unitId: 'p-gev', cell }]);
  assert.equal(JSON.stringify(state), original);
});

test('adjacent viewports reuse global feature geometry and clip at exactly the shared edge', () => {
  const state = createGame(phaseScenario, PHASE_SEED), target = svg(), renderer = createHexRenderer({ svg: target });
  const left = { x: 0, y: 0, width: 250, height: 400 }, right = { x: 250, y: 0, width: 250, height: 400 };
  renderer.render({ state, visualMap, styleSet: verdant, viewport: left, view: { gridVisible: false } });
  const leftRiver = byLayer(target, 'water').children.find(node => node.attrs['data-feature-id'] === 'river');
  const leftRoad = byLayer(target, 'routes').children.find(node => node.attrs['data-feature-id'] === 'road');
  assert.equal(byLayer(target, 'groundTexture').children.length, 1);
  assert.equal(byLayer(target, 'grid').children.length, 0);
  assert.equal(target.children[0].children[0].children[0].attrs.width, '250');
  assert.equal(target.children[0].children[0].children[0].attrs.x, '0');
  renderer.render({ state, visualMap, styleSet: verdant, viewport: right, view: { gridVisible: false } });
  const rightRiver = byLayer(target, 'water').children.find(node => node.attrs['data-feature-id'] === 'river');
  const rightRoad = byLayer(target, 'routes').children.find(node => node.attrs['data-feature-id'] === 'road');
  assert.equal(byLayer(target, 'groundTexture').children.length, 0);
  assert.equal(rightRiver.attrs.d, leftRiver.attrs.d);
  assert.equal(rightRoad.attrs.d, leftRoad.attrs.d);
  assert.equal(rightRiver.attrs['data-feature-id'], leftRiver.attrs['data-feature-id']);
  assert.equal(rightRiver.attrs.stroke, leftRiver.attrs.stroke);
  assert.equal(target.children[0].children[0].children[0].attrs.x, '250');
  assert.equal(target.children[0].children[0].children[0].attrs.width, '250');
  assert.equal(target.attrs.viewBox, '250 0 250 400');
  assert.deepEqual(visibleFeatures(visualMap, left).map(feature => feature.id), ['grain', 'woods', 'river', 'road']);
  assert.deepEqual(visibleFeatures(visualMap, right).map(feature => feature.id), ['river', 'road']);
});

test('switching StyleSets changes paint only and preserves geometry, picks, GameState and RNG', () => {
  const state = createGame(phaseScenario, PHASE_SEED), original = JSON.stringify(state), target = svg(), picks = [];
  const renderer = createHexRenderer({ svg: target, onPick: pick => picks.push(pick) });
  renderer.render({ state, visualMap, styleSet: verdant });
  const first = {
    river: byLayer(target, 'water').children[0].attrs.d,
    color: byLayer(target, 'water').children[0].attrs.stroke,
    picking: byLayer(target, 'picking').children.map(node => node.attrs.points),
    unit: byLayer(target, 'units').children[0].children[0].attrs.points,
  };
  renderer.render({ state, visualMap, styleSet: dryland });
  assert.equal(byLayer(target, 'water').children[0].attrs.d, first.river);
  assert.notEqual(byLayer(target, 'water').children[0].attrs.stroke, first.color);
  assert.deepEqual(byLayer(target, 'picking').children.map(node => node.attrs.points), first.picking);
  assert.equal(byLayer(target, 'units').children[0].children[0].attrs.points, first.unit);
  byLayer(target, 'picking').children[0].click();
  assert.deepEqual(picks, [{ type: 'hex', cell: { x: 0, y: 0 } }]);
  assert.equal(JSON.stringify(state), original);
  renderer.render({ state });
  assert.deepEqual(target.children.map(node => node.attrs['data-layer']), layerOrder);
  assert.equal(target.attrs.viewBox.startsWith('0 0 '), true);
});

test('VisualMap and StyleSet validation rejects malformed schema before rendering', () => {
  assert.equal(validateVisualMap(visualMap), visualMap);
  assert.equal(validateStyleSet(verdant, visualMap), verdant);
  const duplicate = structuredClone(visualMap);
  duplicate.features[1].id = 'grain';
  assert.throws(() => validateVisualMap(duplicate), /duplicate/);
  const invalidLayer = structuredClone(visualMap);
  invalidLayer.features[1].layer = 'hex-grid';
  assert.throws(() => validateVisualMap(invalidLayer), /invalid/);
  const invalidStyle = structuredClone(verdant);
  invalidStyle.mapId = 'other-map';
  assert.throws(() => validateStyleSet(invalidStyle, visualMap), /matching mapId/);
  const target = svg(), renderer = createHexRenderer({ svg: target });
  assert.throws(() => renderer.render({ state: createGame(phaseScenario, PHASE_SEED), visualMap: duplicate }), /duplicate/);
  assert.equal(target.children.length, 0);
});

test('global detail SVGs share coordinates across viewports and reject nonlocal paths', () => {
  const style = structuredClone(verdant);
  style.detailAssets = {
    'ground-grain': { path: 'assets/terrain-map-study/details/verdant-ground-grain.svg', bounds: { x: 0, y: 0, width: 500, height: 400 } },
    forest: { path: 'assets/terrain-map-study/details/verdant-forest.svg', bounds: { x: 0, y: 0, width: 500, height: 400 } },
  };
  assert.equal(validateStyleSet(style, visualMap), style);
  const state = createGame(phaseScenario, PHASE_SEED), target = svg(), renderer = createHexRenderer({ svg: target });
  const left = { x: 0, y: 0, width: 250, height: 400 }, right = { x: 250, y: 0, width: 250, height: 400 };
  renderer.render({ state, visualMap, styleSet: style, viewport: left });
  const first = byLayer(target, 'forest').children.find(node => node.tag === 'image');
  assert.deepEqual([first.attrs.x, first.attrs.y, first.attrs.width, first.attrs.height], ['0', '0', '500', '400']);
  assert.equal(first.attrs['pointer-events'], 'none');
  assert.equal(first.attrs.href, new URL('../assets/terrain-map-study/details/verdant-forest.svg', import.meta.url).href);
  assert.equal(byLayer(target, 'groundTexture').children.at(-1).attrs['data-detail-layer'], 'ground-grain');
  renderer.render({ state, visualMap, styleSet: style, viewport: right });
  const second = byLayer(target, 'forest').children.find(node => node.tag === 'image');
  assert.deepEqual(second.attrs, first.attrs);
  assert.equal(target.children[0].children[0].children[0].attrs.x, '250');
  for (const bad of ['https://example.com/a.svg', '/assets/a.svg', 'assets/../a.svg', 'assets\\a.svg', 'assets/a.svg?x=1', 'assets/a.svg#x']) {
    assert.equal(safeDetailPath(bad), false);
    const invalid = structuredClone(style);
    invalid.detailAssets.forest.path = bad;
    assert.throws(() => validateStyleSet(invalid, visualMap), /local project-relative SVG path/);
  }
});
