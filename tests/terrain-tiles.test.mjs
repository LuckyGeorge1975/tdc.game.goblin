import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/terrain-tiles/manifest.json', root), 'utf8'));
const context = {};
context.globalThis = context;
runInNewContext(readFileSync(new URL('terrain-tiles.js', root), 'utf8'), context);
const {place} = context.TerrainTiles;
const layers = (...args) => JSON.parse(JSON.stringify(context.TerrainTiles.layers(...args)));

const board = rows => (x, y) => rows[y]?.[x] ?? null;
const sides = (file, rotate, mirror) => manifest.tiles[file].edges.map(side => place(side, rotate, mirror)).sort();
const maskOf = (file, rotate, mirror) => [0, 1, 2, 3, 4, 5]
  .filter(side => manifest.tiles[file].mask & 1 << side)
  .reduce((mask, side) => mask | 1 << place(side, rotate, mirror), 0);
// Neighbour positions for the centre cell (1,1) of a 3x3 odd-row-right board, sides E..NE.
const around = [[2, 1], [2, 2], [1, 2], [0, 1], [1, 0], [2, 0]];
function centre(type, neighbour, open) {
  const rows = [[null, null, null], [null, type, null], [null, null, null]];
  around.forEach(([x, y], side) => { rows[y][x] = open.includes(side) ? 'open-ground' : neighbour; });
  return layers(board(rows), 1, 1);
}

test('every shipped tile is hash-pinned to the Content source set', () => {
  assert.equal(Object.keys(manifest.tiles).length, 35);
  assert.equal(manifest.contentPin, 'c01ecb80bcdd813772d1433d9ae63b39e54ef050');
  let total = 0;
  for (const tile of Object.values(manifest.tiles)) {
    const bytes = readFileSync(new URL(`assets/terrain-tiles/${tile.file}`, root));
    assert.equal(bytes.length, tile.bytes, tile.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), tile.sha256, tile.file);
    total += bytes.length;
  }
  assert.equal(total, manifest.webpTotalBytes);
});

test('all 64 forest neighbourhoods resolve to an oriented edge tile with matching open sides', () => {
  for (let mask = 0; mask < 64; mask++) {
    const open = [0, 1, 2, 3, 4, 5].filter(side => mask & 1 << side);
    const [ground] = centre('forest', 'forest', open);
    if (mask === 0) { assert.equal(ground.file, 'forest'); continue; }
    assert.match(ground.file, /^forest-edge-w\d\d$/);
    assert.equal(maskOf(ground.file, ground.rotate, ground.mirror), mask, `mask ${mask}`);
  }
});

test('roads use straight, curve and junction tiles in the orientation of their connections', () => {
  for (const [connected, file] of [[[0, 3], 'road-straight'], [[1, 4], 'road-straight'], [[2, 0], 'road-curve-120'],
    [[4, 5], 'road-curve-60'], [[0, 3, 1], 'road-y'], [[2, 5, 4], 'road-y']]) {
    const cell = centre('road', 'road', [0, 1, 2, 3, 4, 5].filter(side => !connected.includes(side)));
    assert.equal(cell[0].file, 'open-ground');
    assert.equal(cell.length, 2);
    assert.equal(cell[1].file, file);
    assert.deepEqual(sides(file, cell[1].rotate, cell[1].mirror), [...connected].sort());
  }
});

test('road caps and symmetric junctions fall back to clipped half-straights per side', () => {
  const cap = centre('road', 'road', [0, 1, 3, 4, 5]);
  assert.deepEqual(cap.slice(1).map(item => [item.file, item.rotate, item.clip]), [['road-straight', 2, 'half']]);
  const star = centre('road', 'road', [1, 3, 5]);
  assert.deepEqual(star.slice(1).map(item => item.rotate), [0, 2, 4]);
  assert.ok(star.slice(1).every(item => item.clip === 'half'));
});

test('rivers connect to water, and bridges draw the river below a rotated deck', () => {
  const mouth = centre('river', 'water', [0, 1, 2, 4, 5]);
  assert.deepEqual(mouth.slice(1).map(item => [item.file, item.rotate, item.clip]), [['river-straight', 3, 'half']]);
  const rows = [[null, null, 'river'], ['road', 'bridge', 'road'], [null, 'river', null]];
  const bridge = layers(board(rows), 1, 1);
  assert.deepEqual(bridge.map(item => item.file), ['open-ground', 'river-straight', 'bridge']);
  assert.deepEqual(sides('river-straight', bridge[1].rotate, bridge[1].mirror), [2, 5]);
  assert.equal(bridge[2].clip, 'deck');
  assert.equal(bridge[2].rotate, 0);
});

test('urban variants follow the bake hash and unknown types keep the caller fallback', () => {
  const urban = layers(board([['urban', 'urban'], ['urban', 'urban']]), 1, 1);
  assert.equal(urban[0].file, `urban-s${[3, 1, 2, 3, 4, 0, 5][(5 + 3) % 7]}`);
  assert.equal(layers(board([['field-position']]), 0, 0), null);
  for (const type of ['open-ground', 'rubble-field', 'mountain', 'ridge', 'water', 'marsh', 'crater'])
    assert.equal(layers(board([[type]]), 0, 0)[0].file, type);
});
