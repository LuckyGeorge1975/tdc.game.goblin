const finite = value => typeof value === 'number' && Number.isFinite(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const featureLayers = Object.freeze(['ground', 'ground-grain', 'elevation', 'forest', 'water', 'routes', 'objects']);

function checkBounds(bounds, label) {
  if (!record(bounds) || !finite(bounds.x) || !finite(bounds.y) || !finite(bounds.width) || !finite(bounds.height)
    || bounds.width <= 0 || bounds.height <= 0) throw new TypeError(`${label} must be a positive finite rectangle`);
  return bounds;
}

export function validateViewport(viewport) {
  return checkBounds(viewport, 'viewport');
}

export function validateVisualMap(visualMap) {
  if (!record(visualMap) || visualMap.schemaVersion !== 1 || typeof visualMap.mapId !== 'string' || !visualMap.mapId)
    throw new TypeError('VisualMap schemaVersion 1 and mapId required');
  checkBounds(visualMap.bounds, 'VisualMap bounds');
  const layout = visualMap.hexLayout;
  if (!record(layout) || layout.orientation !== 'pointy-top' || layout.offset !== 'odd-row'
    || !finite(layout.radius) || layout.radius <= 0 || !record(layout.origin)
    || !finite(layout.origin.x) || !finite(layout.origin.y)) throw new TypeError('invalid odd-row hexLayout');
  if (!Number.isInteger(visualMap.detailSeed) || !Array.isArray(visualMap.features))
    throw new TypeError('VisualMap detailSeed and features required');
  const ids = new Set();
  for (const feature of visualMap.features) {
    if (!record(feature) || typeof feature.id !== 'string' || !feature.id || ids.has(feature.id)
      || typeof feature.kind !== 'string' || !feature.kind || !featureLayers.includes(feature.layer)
      || !finite(feature.zOrder)) throw new TypeError('invalid or duplicate VisualMap feature');
    ids.add(feature.id);
    checkBounds(feature.bounds, `feature ${feature.id} bounds`);
    if (!intersectsBounds(feature.bounds, visualMap.bounds)) throw new TypeError(`feature ${feature.id} lies outside VisualMap bounds`);
    const geometry = feature.geometry;
    if (!record(geometry)) throw new TypeError(`feature ${feature.id} geometry required`);
    if (geometry.type === 'path') {
      if (typeof geometry.d !== 'string' || !geometry.d.trim() || !/^[\s\d.,+\-eEMmLlHhVvCcSsQqTtAaZz]+$/.test(geometry.d))
        throw new TypeError(`feature ${feature.id} needs SVG path data`);
      if (geometry.fillRule !== undefined && !['nonzero', 'evenodd'].includes(geometry.fillRule))
        throw new TypeError(`feature ${feature.id} has invalid fillRule`);
    } else if (geometry.type === 'polygon') {
      if (!Array.isArray(geometry.points) || geometry.points.length < 3
        || geometry.points.some(point => !record(point) || !finite(point.x) || !finite(point.y)))
        throw new TypeError(`feature ${feature.id} needs polygon points`);
    } else throw new TypeError(`unsupported geometry for feature ${feature.id}`);
  }
  return visualMap;
}

export function validateStyleSet(styleSet, visualMap) {
  if (!record(styleSet) || styleSet.schemaVersion !== 1 || typeof styleSet.setId !== 'string' || !styleSet.setId
    || typeof styleSet.name !== 'string' || !styleSet.name || typeof styleSet.mapId !== 'string' || !styleSet.mapId
    || (visualMap && styleSet.mapId !== visualMap.mapId) || !record(styleSet.tokens))
    throw new TypeError('StyleSet schemaVersion 1, setId, name, matching mapId and tokens required');
  for (const group of ['layers', 'kinds']) {
    if (styleSet.tokens[group] !== undefined && !record(styleSet.tokens[group])) throw new TypeError(`StyleSet tokens.${group} must be an object`);
    for (const token of Object.values(styleSet.tokens[group] ?? {})) {
      if (!record(token) || Object.entries(token).some(([key, value]) =>
        !['fill', 'stroke', 'strokeWidth', 'opacity', 'detail'].includes(key)
        || (key === 'detail' ? !record(value)
          : ['strokeWidth', 'opacity'].includes(key) ? !finite(value) || value < 0 : typeof value !== 'string')))
        throw new TypeError('invalid StyleSet material token');
    }
  }
  if (styleSet.detailAssets !== undefined) {
    if (!record(styleSet.detailAssets)) throw new TypeError('StyleSet detailAssets must be an object');
    for (const [layer, asset] of Object.entries(styleSet.detailAssets)) {
      if (!['ground-grain', 'forest'].includes(layer) || !record(asset) || !safeDetailPath(asset.path))
        throw new TypeError('detail asset must use a local project-relative SVG path');
      checkBounds(asset.bounds, `detail asset ${layer} bounds`);
      if (visualMap && !intersectsBounds(asset.bounds, visualMap.bounds))
        throw new TypeError(`detail asset ${layer} lies outside VisualMap bounds`);
    }
  }
  return styleSet;
}

export function safeDetailPath(path) {
  return typeof path === 'string' && path.startsWith('assets/') && path.endsWith('.svg')
    && /^[A-Za-z0-9._/-]+$/.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export function intersectsBounds(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function visibleFeatures(visualMap, viewport = visualMap.bounds) {
  validateViewport(viewport);
  return visualMap.features.filter(feature => intersectsBounds(feature.bounds, viewport))
    .sort((a, b) => a.zOrder - b.zOrder || a.id.localeCompare(b.id));
}
