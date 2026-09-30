import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { center, vertices } from '../src/hex-renderer/geometry.mjs';
import { createHexRenderer } from '../src/hex-renderer/renderer.mjs';
import { visibleFeatures } from '../src/hex-renderer/visual-map.mjs';
import {
  createGame, dispatch, referenceScenario, referenceCommands, REFERENCE_SEED,
  phaseScenario, phaseCommands, PHASE_SEED, replayReference, expectedPhaseReplay,
} from '../src/core/game-core.mjs';

const asset = async path => JSON.parse(await readFile(new URL(`../assets/terrain-map-study/portable/${path}`, import.meta.url)));
const map = await asset('visual-map.json');
const styles = await Promise.all(['verdant', 'dryland', 'natural', 'field-atlas'].map(async id => asset(`styles/${id}.json`)));
const viewports = [
  { x: 0, y: 0, width: 900, height: 960 },
  { x: 900, y: 0, width: 540, height: 960 },
];

class Node {
  constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.attrs = {}; this.children = []; this.listeners = {}; this.parent = null; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  click() {
    const event = { stopped: false, stopPropagation() { this.stopped = true; } };
    for (let node = this; node && !event.stopped; node = node.parent) for (const listener of node.listeners.click ?? []) listener(event);
  }
}
const doc = { createElementNS(_ns, tag) { return new Node(tag, doc); } };
const svg = () => new Node('svg', doc);
const layer = (root, name) => root.children.find(node => node.attrs['data-layer'] === name);
const round3 = value => Math.round(value * 1000) / 1000;
const insideBox = (outer, inner, label) => {
  const epsilon = 0.002;
  assert.ok(inner.minX >= outer.x - epsilon, `${label}: left ${inner.minX} < ${outer.x}`);
  assert.ok(inner.maxX <= outer.x + outer.width + epsilon, `${label}: right ${inner.maxX} > ${outer.x + outer.width}`);
  assert.ok(inner.minY >= outer.y - epsilon, `${label}: top ${inner.minY} < ${outer.y}`);
  assert.ok(inner.maxY <= outer.y + outer.height + epsilon, `${label}: bottom ${inner.maxY} > ${outer.y + outer.height}`);
};

// Exact cubic extrema, including SVG's reflected S control point. The portable map
// uses only absolute M/L/H/V/C/S/Z commands; an unfamiliar command fails closed.
function pathBounds(d) {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = ({ x, y }) => { bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y); };
  const point = () => {
    const value = { x: Number(tokens.shift()), y: Number(tokens.shift()) };
    assert.ok(Number.isFinite(value.x) && Number.isFinite(value.y), 'incomplete SVG path segment');
    return value;
  };
  let current = { x: 0, y: 0 }, start = current, previousControl = null, previousCommand = '';
  const cubic = (p0, p1, p2, p3) => {
    const at = t => {
      const u = 1 - t;
      return { x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
        y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y };
    };
    add(p0); add(p3);
    for (const axis of ['x', 'y']) {
      const a = -p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis];
      const b = 2 * (p0[axis] - 2 * p1[axis] + p2[axis]);
      const c = p1[axis] - p0[axis];
      const roots = Math.abs(a) < 1e-12 ? (Math.abs(b) < 1e-12 ? [] : [-c / b])
        : [(-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a), (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)];
      for (const t of roots) if (t > 0 && t < 1 && Number.isFinite(t)) add(at(t));
    }
  };
  while (tokens.length) {
    const command = /^[A-Za-z]$/.test(tokens[0]) ? tokens.shift() : previousCommand === 'M' ? 'L' : previousCommand;
    assert.match(command, /^[MLHVCSZ]$/, `unsupported portable path command ${command}`);
    if (command === 'M') { current = point(); start = current; add(current); }
    else if (command === 'L') { current = point(); add(current); }
    else if (command === 'H') { current = { x: Number(tokens.shift()), y: current.y }; add(current); }
    else if (command === 'V') { current = { x: current.x, y: Number(tokens.shift()) }; add(current); }
    else if (command === 'C' || command === 'S') {
      const first = command === 'C' ? point() : previousCommand === 'C' || previousCommand === 'S'
        ? { x: 2 * current.x - previousControl.x, y: 2 * current.y - previousControl.y } : current;
      const second = point(), end = point();
      cubic(current, first, second, end);
      current = end; previousControl = second;
    } else { current = start; add(current); }
    if (command !== 'C' && command !== 'S') previousControl = null;
    previousCommand = command;
  }
  return bounds;
}

test('T-D02: all feature bounds cover geometry and every style stroke; no shadow paint is defined', () => {
  assert.equal(map.features.length, 29);
  const failures = [];
  for (const feature of map.features) {
    let geometry;
    try { geometry = feature.geometry.type === 'polygon'
      ? { minX: Math.min(...feature.geometry.points.map(p => p.x)), maxX: Math.max(...feature.geometry.points.map(p => p.x)),
        minY: Math.min(...feature.geometry.points.map(p => p.y)), maxY: Math.max(...feature.geometry.points.map(p => p.y)) }
      : pathBounds(feature.geometry.d); }
    catch (error) { failures.push(`${feature.id}: ${error.message}`); continue; }
    for (const style of styles) {
      const paint = { ...(style.tokens.layers[feature.layer] ?? {}), ...(style.tokens.kinds[feature.kind] ?? {}) };
      if (Object.keys(paint).some(key => /shadow|filter/i.test(key))) failures.push(`${style.setId}/${feature.id}: shadow or filter needs explicit extent`);
      const stroke = paint.stroke && paint.stroke !== 'none' ? (paint.strokeWidth ?? 1) / 2 : 0;
      try { insideBox(feature.bounds, { minX: geometry.minX - stroke, maxX: geometry.maxX + stroke,
        minY: geometry.minY - stroke, maxY: geometry.maxY + stroke }, `${style.setId}/${feature.id}`); }
      catch (error) { failures.push(error.message); }
    }
  }
  assert.deepEqual(failures, []);
});

test('T-D04: radius 62 odd-row contract vectors and translated origin', () => {
  const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
  assert.deepEqual(cells.map(cell => Object.values(center(cell, map.hexLayout)).map(round3)),
    [[0, 0], [107.387, 0], [53.694, 93], [161.081, 93]]);
  const shifted = { ...map.hexLayout, origin: { x: 17, y: -23 } };
  for (const cell of cells) {
    assert.deepEqual(Object.values(center(cell, shifted)).map(round3),
      [round3(center(cell, map.hexLayout).x + 17), round3(center(cell, map.hexLayout).y - 23)]);
  }
});

test('T-V03: A/B rendering order preserves global feature paths, image anchors and clipping in four styles', () => {
  const state = createGame(phaseScenario, PHASE_SEED), initial = JSON.stringify(state);
  for (const style of styles) {
    const render = (viewport, target) => {
      createHexRenderer({ svg: target }).render({ state, visualMap: map, styleSet: style, viewport });
      return {
        viewBox: target.attrs.viewBox,
        clip: target.children[0].children[0].children[0].attrs,
        features: Object.fromEntries(map.features.map(feature => [feature.id,
          layer(target, { 'ground-grain': 'groundTexture' }[feature.layer] ?? feature.layer)?.children
            .find(node => node.attrs['data-feature-id'] === feature.id)?.attrs ?? null])),
        images: ['groundTexture', 'forest'].flatMap(name => layer(target, name).children.filter(node => node.tag === 'image').map(node => node.attrs)),
      };
    };
    const a = svg(), b = svg();
    const forward = [render(viewports[0], a), render(viewports[1], b)];
    const reverse = [render(viewports[1], b), render(viewports[0], a)];
    assert.deepEqual(forward, [reverse[1], reverse[0]], style.setId);
    assert.deepEqual(forward[0].images.map(image => [image.x, image.y, image.width, image.height]),
      forward[1].images.map(image => [image.x, image.y, image.width, image.height]), style.setId);
    for (const viewport of viewports) assert.deepEqual(visibleFeatures(map, viewport).map(f => f.id),
      map.features.filter(f => forward[viewports.indexOf(viewport)].features[f.id]).sort((a, b) => a.zOrder - b.zOrder || a.id.localeCompare(b.id)).map(f => f.id));
  }
  assert.equal(JSON.stringify(state), initial);
});

test('T-U02/T-U03: neighboring hex points and overlay/unit callback exclusivity in four styles', () => {
  const state = createGame(phaseScenario, PHASE_SEED), before = JSON.stringify(state);
  const left = { x: 0, y: 0 }, right = { x: 1, y: 0 };
  const edge = vertices(left, map.hexLayout);
  const middle = { x: (edge[0].x + edge[5].x) / 2, y: (edge[0].y + edge[5].y) / 2 };
  const nudge = (toward, distance = 0.001) => ({ x: middle.x + Math.sign(toward.x - middle.x) * distance, y: middle.y });
  const inside = (cell, point) => {
    const corners = vertices(cell, map.hexLayout);
    return corners.every((a, i) => {
      const b = corners[(i + 1) % corners.length];
      return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -1e-8;
    });
  };
  assert.equal(inside(left, nudge(center(left, map.hexLayout))), true);
  assert.equal(inside(right, nudge(center(left, map.hexLayout))), false);
  assert.equal(inside(right, nudge(center(right, map.hexLayout))), true);
  assert.equal(inside(left, nudge(center(right, map.hexLayout))), false);
  for (const style of styles) for (const gridVisible of [false, true]) {
    const target = svg(), picks = [];
    createHexRenderer({ svg: target, onPick: pick => picks.push(pick) }).render({
      state, visualMap: map, styleSet: style,
      view: { gridVisible, focusedCell: left, selectedUnitId: 'p-gev', areaMode: 'movement' },
      areas: { movementReachable: [left, right], attackableTargets: ['e-tank'] },
      events: [{ type: 'UnitMoved', to: left }],
    });
    for (const name of ['ground', 'groundTexture', 'elevation', 'forest', 'water', 'routes', 'objects', 'grid', 'areas', 'focus', 'effects']) {
      const decorative = layer(target, name);
      if (decorative) for (const node of decorative.children) assert.equal(node.attrs['pointer-events'] ?? decorative.attrs['pointer-events'], 'none', `${style.setId}/${name}`);
    }
    const unit = layer(target, 'units').children.find(node => node.attrs['data-unit-id'] === 'p-gev');
    unit.click();
    assert.deepEqual(picks.splice(0), [{ type: 'unit', unitId: 'p-gev', cell: { x: 1, y: 1 } }]);
    const free = layer(target, 'picking').children.find(node => node.attrs['data-x'] === '0' && node.attrs['data-y'] === '0');
    free.click();
    assert.deepEqual(picks.splice(0), [{ type: 'hex', cell: left }]);
  }
  assert.equal(JSON.stringify(state), before);
});

test('T-S03: two complete Core-v1/phase-v2 replays per style and viewport match fixed traces', () => {
  const fixtures = [
    { name: 'core-v1', scenario: referenceScenario, seed: REFERENCE_SEED, commands: referenceCommands, oracle: replayReference() },
    { name: 'phase-v2', scenario: phaseScenario, seed: PHASE_SEED, commands: phaseCommands, oracle: expectedPhaseReplay },
  ];
  for (const style of styles) for (const viewport of viewports) for (const fixture of fixtures) for (let repeat = 1; repeat <= 2; repeat++) {
    const initialState = createGame(fixture.scenario, fixture.seed), target = svg();
    const renderer = createHexRenderer({ svg: target });
    let state = initialState;
    const steps = fixture.commands.map(command => {
      const unchanged = JSON.stringify(state);
      renderer.render({ state, visualMap: map, styleSet: style, viewport, view: { gridVisible: repeat === 2 } });
      assert.equal(JSON.stringify(state), unchanged, `${style.setId}/${fixture.name}/render`);
      const result = dispatch(state, command);
      if (result.state) state = result.state;
      return { command: structuredClone(command), result };
    });
    renderer.render({ state, visualMap: map, styleSet: style, viewport });
    assert.deepEqual({ initialState, steps, finalState: state }, fixture.oracle,
      `${style.setId}/${fixture.name}/viewport-${viewport.x}/repeat-${repeat}`);
  }
});
