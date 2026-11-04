import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// The Atlas level is the test level: it holds every catalog unit and every terrain type, so its recorded
// victory and defeat routes stand in for replaying every level (catalog-full-trace replays only these two).
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const atlas = JSON.parse(read('assets/unit-art/levels/catalog-full-levels.v1.json')).levels.find(level => level.id === 'catalog-full-atlas');
const context = {}; context.globalThis = context;
vm.runInNewContext(read('terrain-display.js') + '\nglobalThis.display = TerrainDisplay;', context);

test('test level catalog-full-atlas contains every catalog unit', () => {
  const units = Object.keys(JSON.parse(read('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json')).units);
  const placed = new Set(JSON.stringify([atlas.units, atlas.waves, atlas.waveTemplates]).match(/"assetId":"[^"]+"/g).map(entry => entry.slice(11, -1)));
  assert.equal(units.length, 26);
  assert.deepEqual(units.filter(unit => !placed.has(unit)), []);
});

test('test level catalog-full-atlas contains every terrain type', () => {
  const types = Object.keys(context.display.types), used = new Set(atlas.terrain.map(cell => cell.type));
  assert.equal(types.length, 12);
  assert.deepEqual(types.filter(type => !used.has(type)), []);
});

test('test level catalog-full-atlas keeps its recorded victory and defeat routes', () => {
  const index = JSON.parse(read('tests/fixtures/catalog-full/index.v2.json'));
  for (const outcome of ['victory', 'defeat']) assert.equal(index.traces[`catalog-full-atlas-${outcome}`].outcome, outcome === 'victory');
});
