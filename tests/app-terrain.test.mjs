import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGameAdapter } from '../src/app/adapter.mjs';
import { createReferenceState, referenceMockCore } from '../src/app/mock-core.mjs';
import { loadTerrainPackage } from '../src/app/terrain-assets.mjs';

const fileFetch = async (url) => ({ ok: true, json: async () => JSON.parse(await readFile(url, 'utf8')) });

test('local terrain package loads both styles against one validated VisualMap', async () => {
  const { visualMap, styleSets } = await loadTerrainPackage(fileFetch);
  assert.equal(visualMap.mapId, 'terrain-study-02');
  assert.equal(visualMap.features.length, 29);
  assert.deepEqual(Object.keys(styleSets), ['verdant', 'dryland']);
  assert.equal(styleSets.verdant.mapId, visualMap.mapId);
  assert.equal(styleSets.dryland.mapId, visualMap.mapId);
  for (const set of Object.values(styleSets)) {
    for (const detail of Object.values(set.detailAssets)) {
      assert.match(detail.path, /^assets\/terrain-map-study\/portable\/details\/[^/]+\.svg$/);
      await readFile(new URL(`../${detail.path}`, import.meta.url));
    }
  }
  assert.deepEqual(styleSets.verdant.detailAssets.forest.bounds, styleSets.dryland.detailAssets.forest.bounds);
  assert.deepEqual(styleSets.verdant.detailAssets['ground-grain'].bounds, styleSets.dryland.detailAssets['ground-grain'].bounds);
});

test('style and grid switches stay in ViewState without commands, RNG or selection changes', () => {
  const app = createGameAdapter({ core: referenceMockCore, initialState: createReferenceState() });
  const commands = [];
  app.subscribeCommand(({ command }) => commands.push(command));
  app.selectUnit('p-1');
  const before = structuredClone(app.snapshot());
  app.setStyleSet('dryland');
  app.setGridVisible(true);
  assert.equal(app.snapshot().view.styleSetId, 'dryland');
  assert.equal(app.snapshot().view.gridVisible, true);
  assert.equal(app.snapshot().view.selectedUnitId, 'p-1');
  assert.deepEqual(app.snapshot().state, before.state);
  assert.deepEqual(app.snapshot().areas, before.areas);
  assert.deepEqual(commands, []);
  app.setStyleSet('verdant');
  app.setGridVisible(false);
  assert.deepEqual(app.snapshot().state, before.state);
  assert.deepEqual(commands, []);
});
