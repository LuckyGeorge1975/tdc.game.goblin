import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const [script, manifest, bytes, bundle] = await Promise.all([
  readFile(new URL('map-bake.js', root), 'utf8'),
  readFile(new URL('assets/map-bakes/showcase-terrain-course-192.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/map-bakes/showcase-terrain-course-192.webp', root)),
  readFile(new URL('assets/unit-art/levels/showcase-levels.json', root), 'utf8').then(JSON.parse)
]);
const level = bundle.levels.find(item => item.id === 'showcase-terrain-course');
const cells = new Map(level.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
const expectedHash = data => createHash('sha256').update(data).digest('hex');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settled = async bake => {
  for (let attempt = 0; attempt < 100 && bake.status().phase === 'loading'; attempt++)
    await new Promise(resolve => setTimeout(resolve, 5));
  assert.notEqual(bake.status().phase, 'loading', 'bake request did not settle');
};

function setup(responses) {
  const requests = [];
  const revoked = [];
  let nextUrl = 0;
  const context = {
    crypto: webcrypto, TextEncoder, Blob, console: {warn() {}},
    performance: {now: () => 10}, AbortController,
    URL: {createObjectURL: () => `blob:${++nextUrl}`, revokeObjectURL: url => revoked.push(url)},
    createImageBitmap: async () => ({width: 2400, height: 1386, close() {}}),
    fetch: async (url, options) => {
      requests.push({url, signal: options.signal});
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    }
  };
  const bake = runInNewContext(script + '\nMapBake', context);
  const snapshot = () => bake.snapshot(level.id,
    {scenarioVersion: 1, ruleProfileId: 'FIELD_TEST_LEGACY_v1'},
    {scenarioVersion: 1, ruleProfileId: 'FIELD_TEST_LEGACY_v1'},
    level, 12, 8, 34, 58, 48, (x, y) => cells.get(`${x},${y}`) || 'open-ground');
  return {bake, snapshot, requests, revoked};
}
const json = value => ({ok: true, json: async () => value});
const image = value => ({ok: true, arrayBuffer: async () => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)});

test('pinned course fingerprint, export bytes and lazy selection', async () => {
  const fixture = setup([json(manifest), image(bytes)]);
  assert.equal(fixture.bake.snapshot('showcase-advance'), null);
  assert.equal(fixture.bake.select(null, () => {}), null);
  assert.equal(fixture.requests.length, 0);
  const data = fixture.snapshot();
  assert.equal(JSON.stringify(data), manifest.key);
  assert.equal(expectedHash(manifest.key), manifest.keySha256);
  assert.equal(expectedHash(bytes), manifest.imageSha256);
  let redraws = 0;
  assert.equal(fixture.bake.select(data, () => redraws++), null);
  await settled(fixture.bake);
  assert.equal(fixture.bake.status().phase, 'ready');
  assert.equal(fixture.bake.select(data, () => redraws++), 'blob:1');
  assert.equal(redraws, 1);
  assert.deepEqual(fixture.requests.map(request => request.url), [
    'assets/map-bakes/showcase-terrain-course-192.json',
    'assets/map-bakes/showcase-terrain-course-192.webp']);
  fixture.bake.select(null, () => {});
  assert.equal(fixture.bake.status().phase, 'idle');
  assert.deepEqual(fixture.revoked, ['blob:1']);
});

test('wrong terrain, profile, visual data and missing or corrupt image fall back', async () => {
  for (const alter of [
    data => { data.cells[3][6] = 'road'; },
    data => { data.profileId = 'FIELD_TEST_LEGACY_v2'; },
    data => { data.visual.metadata.push(['3,3', 'road']); },
    data => { data.geometry[2] = 35; }
  ]) {
    const fixture = setup([json(manifest)]);
    const data = fixture.snapshot(); alter(data);
    assert.equal(fixture.bake.select(data, () => {}), null);
    await settled(fixture.bake);
    assert.equal(fixture.bake.status().phase, 'fallback');
    assert.equal(fixture.requests.length, 1);
  }
  for (const response of [new Error('missing image'), image(Buffer.from(bytes.map((value, index) => index === 50 ? value ^ 1 : value)))]) {
    const fixture = setup([json(manifest), response]);
    fixture.bake.select(fixture.snapshot(), () => {});
    await settled(fixture.bake);
    assert.equal(fixture.bake.status().phase, 'fallback');
    assert.equal(fixture.bake.select(fixture.snapshot(), () => {}), null);
  }
});

test('mission switch discards a late verified image', async () => {
  let deliver;
  const pending = new Promise(resolve => { deliver = resolve; });
  const fixture = setup([json(manifest), pending]);
  fixture.bake.select(fixture.snapshot(), () => assert.fail('stale redraw'));
  await tick();
  fixture.bake.select(null, () => {});
  deliver(image(bytes));
  await tick();
  assert.equal(fixture.bake.status().phase, 'idle');
  assert.equal(fixture.revoked.length, 0);
});
