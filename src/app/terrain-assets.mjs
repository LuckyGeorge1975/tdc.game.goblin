import { validateStyleSet, validateVisualMap } from '../hex-renderer/visual-map.mjs';

const packageUrl = new URL('../../assets/terrain-map-study/portable/', import.meta.url);

function localPath(path) {
  if (typeof path !== 'string' || !/^[a-z0-9][a-z0-9/.-]*\.json$/i.test(path)
    || path.startsWith('/') || path.split('/').includes('..') || path.split('/').includes('.')) {
    throw new TypeError(`Invalid terrain package path: ${path}`);
  }
  return new URL(path, packageUrl);
}

export async function loadTerrainPackage(fetcher = fetch) {
  async function read(path) {
    const response = await fetcher(localPath(path));
    if (!response.ok) throw new Error(`Terrain package ${path}: HTTP ${response.status}`);
    return response.json();
  }
  const manifest = await read('manifest.json');
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.styleSets)) throw new TypeError('Invalid terrain package manifest');
  const visualMap = await read(manifest.visualMap);
  validateVisualMap(visualMap);
  const styleSets = {};
  for (const entry of manifest.styleSets) {
    const styleSet = await read(entry.path);
    validateStyleSet(styleSet, visualMap);
    if (entry.setId !== styleSet.setId || styleSets[styleSet.setId]) throw new TypeError('Invalid terrain style entry');
    styleSets[styleSet.setId] = styleSet;
  }
  if (!styleSets.verdant || !styleSets.dryland) throw new TypeError('Both terrain style sets are required');
  return { visualMap, styleSets };
}
