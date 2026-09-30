import { center, points, outerBoundary, viewBox, cellKey, DEFAULT_HEX_LAYOUT } from './geometry.mjs';
import { validateVisualMap, validateStyleSet, validateViewport, visibleFeatures, intersectsBounds } from './visual-map.mjs';

const NS = 'http://www.w3.org/2000/svg';
const LAYERS = Object.freeze(['terrain', 'grid', 'areas', 'wrecks', 'units', 'focus', 'effects']);
const VISUAL_LAYERS = Object.freeze(['ground', 'groundTexture', 'elevation', 'forest', 'water', 'routes', 'objects', 'picking', 'grid', 'areas', 'wrecks', 'units', 'focus', 'effects']);
const FEATURE_LAYER = Object.freeze({
  ground: 'ground', 'ground-grain': 'groundTexture', elevation: 'elevation',
  forest: 'forest', water: 'water', routes: 'routes', objects: 'objects',
});
const NEUTRAL = Object.freeze({
  ground: { fill: '#293634' }, groundTexture: { fill: '#7d8b78', opacity: 0.18 },
  elevation: { fill: '#697268', stroke: 'none' }, forest: { fill: '#3d5848', stroke: 'none' },
  water: { fill: '#386578', stroke: 'none' }, routes: { fill: 'none', stroke: '#a6a090', strokeWidth: 8 },
  objects: { fill: '#777c72', stroke: 'none' },
});
const MATERIAL_ATTRS = Object.freeze({ strokeWidth: 'stroke-width' });
let rendererId = 0;
const COLORS = Object.freeze({
  'open-ground': '#101b20', mountain: '#30464a', 'rubble-field': '#30464a', water: '#174151', river: '#174151',
  forest: '#243e37', marsh: '#384632', road: '#34414a', bridge: '#4c5152', urban: '#39404b', crater: '#424141', ridge: '#45504a',
});
const AREA_STYLES = Object.freeze({
  movement: { fill: '#9dcf6650', stroke: '#a7db79' },
  fire: { fill: '#da796050', stroke: '#e78b73' },
  sight: { fill: '#72d2e441', stroke: '#9ee4ee' },
});

export const layerOrder = LAYERS;
export const visualLayerOrder = VISUAL_LAYERS;

export function createHexRenderer({ svg, onPick = () => {}, accessibility = null }) {
  if (!svg?.ownerDocument || typeof svg.replaceChildren !== 'function') throw new TypeError('svg element required');
  const doc = svg.ownerDocument;
  const element = (tag, attrs = {}) => {
    const node = doc.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    return node;
  };
  const polygon = (cell, layout, attrs = {}) => element('polygon', { points: points(cell, layout), ...attrs });
  const clipId = `hex-renderer-clip-${++rendererId}`;

  function material(styleSet, feature) {
    const layer = FEATURE_LAYER[feature.layer];
    const token = {
      ...NEUTRAL[layer],
      ...(styleSet?.tokens.layers?.[feature.layer] ?? {}),
      ...(styleSet?.tokens.kinds?.[feature.kind] ?? {}),
    };
    const attrs = {};
    for (const [key, value] of Object.entries(token)) {
      if (key !== 'detail') attrs[MATERIAL_ATTRS[key] ?? key] = value;
    }
    return attrs;
  }

  function render({ state, view = {}, areas = {}, events = [], visualMap, styleSet, viewport }) {
    if (!state?.map || !Array.isArray(state.units)) throw new TypeError('serializable game state required');
    const visual = visualMap !== undefined && visualMap !== null;
    if (visual) {
      validateVisualMap(visualMap);
      if (styleSet !== undefined && styleSet !== null) validateStyleSet(styleSet, visualMap);
      if (viewport) validateViewport(viewport);
    } else if (styleSet || viewport) throw new TypeError('visualMap required for styleSet or viewport');
    const layout = visual ? visualMap.hexLayout : DEFAULT_HEX_LAYOUT;
    const active = doc.activeElement;
    const focused = svg.contains?.(active) ? (active?.dataset?.unitId ? { unitId: active.dataset.unitId } : active?.dataset?.x !== undefined ? { x: active.dataset.x, y: active.dataset.y } : null) : null;
    const focusTargets = new Map();
    const box = visual ? (viewport ?? visualMap.bounds) : null;
    svg.setAttribute('viewBox', visual ? `${box.x} ${box.y} ${box.width} ${box.height}` : viewBox(state.map));
    const names = visual ? VISUAL_LAYERS : LAYERS;
    const layers = Object.fromEntries(names.map(name => [name, element('g', { 'data-layer': name })]));
    function accessible(node, key, label, cell, pick) {
      if (!accessibility) return;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', label);
      focusTargets.set(key, node);
      node.addEventListener('keydown', event => {
        if (event.repeat || event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        pick();
      });
      node.addEventListener('focus', () => {
        const ring = polygon(cell, layout, { fill: 'none', stroke: '#f5f7a4', 'stroke-width': 5, 'pointer-events': 'none', 'data-keyboard-focus': 'true' });
        layers.focus.appendChild(ring);
      });
      node.addEventListener('blur', () => layers.focus.querySelector?.('[data-keyboard-focus]')?.remove());
    }
    let defs;
    if (visual) {
      const mapBox = visualMap.bounds;
      const left = Math.max(box.x, mapBox.x), top = Math.max(box.y, mapBox.y);
      const right = Math.min(box.x + box.width, mapBox.x + mapBox.width);
      const bottom = Math.min(box.y + box.height, mapBox.y + mapBox.height);
      if (right <= left || bottom <= top) throw new RangeError('viewport must intersect VisualMap bounds');
      defs = element('defs');
      const clip = element('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(element('rect', { x: left, y: top, width: right - left, height: bottom - top }));
      defs.appendChild(clip);
      for (const layer of Object.values(layers)) layer.setAttribute('clip-path', `url(#${clipId})`);
      layers.ground.setAttribute('pointer-events', 'none');
      layers.groundTexture.setAttribute('pointer-events', 'none');
      for (const name of ['elevation', 'forest', 'water', 'routes', 'objects']) layers[name].setAttribute('pointer-events', 'none');
      const ground = material(styleSet, { layer: 'ground', kind: 'ground' });
      layers.ground.appendChild(element('rect', { x: mapBox.x, y: mapBox.y, width: mapBox.width, height: mapBox.height, ...ground }));
      for (const feature of visibleFeatures(visualMap, box)) {
        const attrs = { ...material(styleSet, feature), 'data-feature-id': feature.id, 'data-kind': feature.kind, 'data-z-order': feature.zOrder, 'pointer-events': 'none' };
        if (feature.geometry.type === 'path') {
          attrs.d = feature.geometry.d;
          if (feature.geometry.fillRule) attrs['fill-rule'] = feature.geometry.fillRule;
        } else attrs.points = feature.geometry.points.map(point => `${point.x},${point.y}`).join(' ');
        layers[FEATURE_LAYER[feature.layer]].appendChild(element(feature.geometry.type, attrs));
      }
      for (const [sourceLayer, asset] of Object.entries(styleSet?.detailAssets ?? {})) {
        if (!intersectsBounds(asset.bounds, box)) continue;
        const image = element('image', {
          x: asset.bounds.x, y: asset.bounds.y, width: asset.bounds.width, height: asset.bounds.height,
          href: new URL(`../../${asset.path}`, import.meta.url).href,
          preserveAspectRatio: 'none', 'pointer-events': 'none', 'data-detail-layer': sourceLayer,
        });
        layers[FEATURE_LAYER[sourceLayer]].appendChild(image);
      }
    }
    const terrain = visual ? null : new Map(state.map.terrain.map(cell => [cellKey(cell), cell.type]));
    for (let y = 0; y < state.map.height; y++) for (let x = 0; x < state.map.width; x++) {
      const cell = { x, y };
      if (visual) {
        const pick = polygon(cell, layout, { fill: 'transparent', stroke: 'none', 'pointer-events': 'all', 'data-x': x, 'data-y': y, cursor: 'pointer' });
        const activate = () => onPick({ type: 'hex', cell });
        pick.addEventListener('click', activate);
        accessible(pick, `cell:${x}:${y}`, accessibility?.cellLabel(cell, { state, view, areas }), cell, activate);
        if (accessibility) pick.setAttribute('aria-pressed', String(view.focusedCell?.x === x && view.focusedCell?.y === y));
        layers.picking.appendChild(pick);
      } else {
        const type = terrain.get(cellKey(cell)) ?? 'open-ground';
        const base = polygon(cell, layout, { fill: COLORS[type] ?? COLORS['open-ground'], stroke: '#19282d', 'stroke-width': 0.6, 'data-x': x, 'data-y': y, 'data-terrain': type, cursor: 'pointer' });
        const activate = () => onPick({ type: 'hex', cell });
        base.addEventListener('click', activate);
        accessible(base, `cell:${x}:${y}`, accessibility?.cellLabel(cell, { state, view, areas }), cell, activate);
        if (accessibility) base.setAttribute('aria-pressed', String(view.focusedCell?.x === x && view.focusedCell?.y === y));
        layers.terrain.appendChild(base);
      }
      if (view.gridVisible) layers.grid.appendChild(polygon(cell, layout, { fill: 'none', stroke: '#53717a', 'stroke-width': 0.7, opacity: 0.4, 'pointer-events': 'none' }));
    }

    const mode = view.areaMode === 'fire' ? 'fire' : view.areaMode === 'sight' || view.areaMode === 'los' ? 'sight' : 'movement';
    const cells = areas[mode === 'movement' ? 'movementReachable' : mode === 'fire' ? 'fireRange' : 'lineOfSight'] ?? [];
    const style = AREA_STYLES[mode];
    for (const cell of cells) layers.areas.appendChild(polygon(cell, layout, { fill: style.fill, stroke: 'none', 'pointer-events': 'none' }));
    if (cells.length) layers.areas.appendChild(element('path', { d: outerBoundary(cells, layout), fill: 'none', stroke: style.stroke, 'stroke-width': 3, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));

    const targets = new Set(areas.attackableTargets ?? []);
    for (const unit of state.units.filter(u => u.hp <= 0 && !u.embarkedOn)) {
      const c = center(unit, layout), wreck = element('g', { 'data-wreck-id': unit.id, 'pointer-events': 'none' });
      wreck.appendChild(element('path', { d: `M${c.x - 10},${c.y - 10}L${c.x + 10},${c.y + 10}M${c.x + 10},${c.y - 10}L${c.x - 10},${c.y + 10}`, stroke: '#99665d', 'stroke-width': 4, opacity: 0.6 }));
      layers.wrecks.appendChild(wreck);
    }
    for (const unit of state.units.filter(u => u.hp > 0 && !u.embarkedOn)) {
      const c = center(unit, layout), group = element('g', { 'data-unit-id': unit.id, cursor: 'pointer' });
      const selected = view.selectedUnitId === unit.id, target = targets.has(unit.id);
      group.appendChild(polygon(unit, layout, { fill: unit.team === 'player' ? '#174950' : '#5a302d', stroke: selected ? '#d7e96c' : target ? '#ef7c6d' : unit.team === 'player' ? '#75cfde' : '#e28b83', 'stroke-width': selected || target ? 5 : 2.5, opacity: unit.disabled ? 0.55 : 1 }));
      const label = element('text', { x: c.x, y: c.y + 5, 'text-anchor': 'middle', fill: '#f2f5e8', 'font-size': 17, 'font-weight': 700, 'pointer-events': 'none' });
      label.textContent = unit.type === 'core' ? '◆' : unit.type === 'tank' ? 'T' : (unit.icon ?? '●');
      group.appendChild(label);
      const activate = () => onPick({ type: 'unit', unitId: unit.id, cell: { x: unit.x, y: unit.y } });
      group.addEventListener('click', event => { event.stopPropagation(); activate(); });
      accessible(group, `unit:${unit.id}`, accessibility?.unitLabel(unit, { state, view, areas }), unit, activate);
      if (accessibility) group.setAttribute('aria-pressed', String(selected));
      layers.units.appendChild(group);
    }

    if (view.focusedCell) layers.focus.appendChild(polygon(view.focusedCell, layout, { fill: 'none', stroke: '#eef0b0', 'stroke-width': 5, 'pointer-events': 'none', 'data-focus': 'true' }));
    for (const event of events) {
      const position = event.type === 'UnitMoved' ? event.to : event.type === 'ShotResolved' ? state.units.find(u => u.id === event.targetId) : null;
      if (!position) continue;
      const c = center(position, layout);
      layers.effects.appendChild(element('circle', { cx: c.x, cy: c.y, r: event.type === 'ShotResolved' ? 17 : 11, fill: 'none', stroke: event.type === 'ShotResolved' ? '#ffb073' : '#bfe685', 'stroke-width': 3, 'pointer-events': 'none', 'data-event': event.type }));
    }
    svg.replaceChildren(...(defs ? [defs] : []), ...names.map(name => layers[name]));
    if (focused) focusTargets.get(focused.unitId ? `unit:${focused.unitId}` : `cell:${focused.x}:${focused.y}`)?.focus({ preventScroll: true });
  }

  return { render };
}
