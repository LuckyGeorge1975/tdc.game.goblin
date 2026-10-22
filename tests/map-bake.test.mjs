import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const [script, manifest, bytes, specialistsManifest, specialistsBytes, atlasManifest, atlasBytes,
  siegeManifest, siegeBytes, supercoverManifest, supercoverBytes, atlasLevel, bundle] = await Promise.all([
  readFile(new URL('map-bake.js', root), 'utf8'),
  readFile(new URL('assets/map-bakes/showcase-terrain-course-192.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/map-bakes/showcase-terrain-course-192.webp', root)),
  readFile(new URL('assets/map-bakes/showcase-specialists-192.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/map-bakes/showcase-specialists-192.webp', root)),
  readFile(new URL('assets/map-bakes/atlas-proving-grounds-192.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/map-bakes/atlas-proving-grounds-192.webp', root)),
  readFile(new URL('assets/map-bakes/showcase-siege-192.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/map-bakes/showcase-siege-192.webp', root)),
  readFile(new URL('assets/map-bakes/los-supercover-showcase-192.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/map-bakes/los-supercover-showcase-192.webp', root)),
  readFile(new URL('assets/unit-art/levels/atlas-proving-grounds.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/unit-art/levels/showcase-levels.json', root), 'utf8').then(JSON.parse)
]);
const level = bundle.levels.find(item => item.id === 'showcase-terrain-course');
const specialistsLevel = bundle.levels.find(item => item.id === 'showcase-specialists');
const siegeLevel = bundle.levels.find(item => item.id === 'showcase-siege');
const supercoverLevel = bundle.levels.find(item => item.id === 'los-supercover-showcase');
const expectedHash = data => createHash('sha256').update(data).digest('hex');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settled = async bake => {
  for (let attempt = 0; attempt < 100 && bake.status().phase === 'loading'; attempt++)
    await new Promise(resolve => setTimeout(resolve, 5));
  assert.notEqual(bake.status().phase, 'loading', 'bake request did not settle');
};

function setup(responses, bitmapSize = [2400, 1386]) {
  const requests = [];
  const revoked = [];
  let nextUrl = 0;
  const context = {
    crypto: webcrypto, TextEncoder, Blob, console: {warn() {}},
    performance: {now: () => 10}, AbortController,
    URL: {createObjectURL: () => `blob:${++nextUrl}`, revokeObjectURL: url => revoked.push(url)},
    createImageBitmap: async () => ({width: bitmapSize[0], height: bitmapSize[1], close() {}}),
    fetch: async (url, options) => {
      requests.push({url, signal: options.signal});
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    }
  };
  const bake = runInNewContext(script + '\nMapBake', context);
  const snapshot = (selectedLevel = level) => {
    const cells = new Map(selectedLevel.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
    const atlas = selectedLevel.id === 'atlas-proving-grounds';
    const road = ['showcase-siege','los-supercover-showcase'].includes(selectedLevel.id);
    const supercover = selectedLevel.id === 'los-supercover-showcase';
    const profile = supercover ? 'FIELD_TEST_SUPERCOVER_v1' : 'FIELD_TEST_LEGACY_v1';
    return bake.snapshot(selectedLevel.id,
    {scenarioVersion: 1, ruleProfileId: profile,
      ...(atlas || road ? {ruleProfile: 'field-test-atlas-v1'} : {}),
      ...(supercover ? {losMode: 'strict-supercover'} : {})},
    {scenarioId: selectedLevel.id, scenarioVersion: 1, ruleProfileId: profile,
      ...(atlas || road ? {effectiveRules: {unitDataProfile: 'field-test-atlas-v1',
        ...(supercover ? {losMode: 'strict-supercover'} : {})}} : {})},
    selectedLevel, 12, 8, 34, 58, 48, (x, y) => cells.get(`${x},${y}`) || 'open-ground');
  };
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

test('Specialists is pinned, lazy and switches both ways with the unchanged course', async () => {
  const fixture = setup([json(specialistsManifest), image(specialistsBytes), json(manifest), image(bytes),
    json(specialistsManifest), image(specialistsBytes)]);
  const specialists = fixture.snapshot(specialistsLevel);
  const course = fixture.snapshot();
  assert.equal(JSON.stringify(specialists), specialistsManifest.key);
  assert.equal(expectedHash(specialistsManifest.key), specialistsManifest.keySha256);
  assert.equal(expectedHash(specialistsBytes), specialistsManifest.imageSha256);
  assert.equal(specialists.visualCells[3][6][1].join(','), '0,3');
  assert.equal(specialists.visualCells[3][6][2].join(','), '2');
  assert.equal(fixture.bake.select(specialists, () => {}), null);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(specialists, () => {}), 'blob:1');
  assert.equal(fixture.bake.select(course, () => {}), null);
  assert.deepEqual(fixture.revoked, ['blob:1']);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(course, () => {}), 'blob:2');
  assert.equal(fixture.bake.select(specialists, () => {}), null);
  assert.deepEqual(fixture.revoked, ['blob:1', 'blob:2']);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(specialists, () => {}), 'blob:3');
  assert.deepEqual(fixture.requests.map(request => request.url), [
    'assets/map-bakes/showcase-specialists-192.json',
    'assets/map-bakes/showcase-specialists-192.webp',
    'assets/map-bakes/showcase-terrain-course-192.json',
    'assets/map-bakes/showcase-terrain-course-192.webp',
    'assets/map-bakes/showcase-specialists-192.json',
    'assets/map-bakes/showcase-specialists-192.webp']);
});

test('late Specialists manifest cannot fetch its image after switching to Course', async () => {
  let deliver;
  const pending = new Promise(resolve => { deliver = resolve; });
  const fixture = setup([pending, json(manifest), image(bytes)]);
  fixture.bake.select(fixture.snapshot(specialistsLevel), () => assert.fail('stale redraw'));
  await tick();
  fixture.bake.select(fixture.snapshot(), () => {});
  deliver(json(specialistsManifest));
  await settled(fixture.bake);
  assert.equal(fixture.bake.status().phase, 'ready');
  assert.deepEqual(fixture.requests.map(request => request.url), [
    'assets/map-bakes/showcase-specialists-192.json',
    'assets/map-bakes/showcase-terrain-course-192.json',
    'assets/map-bakes/showcase-terrain-course-192.webp']);
});

test('Specialists wrong route, profile or image falls back', async () => {
  for (const alter of [
    data => { data.cells[3][6] = 'river'; },
    data => { data.visualCells[3][6][2] = [2, 4]; },
    data => { data.profileId = 'FIELD_TEST_SUPERCOVER_v1'; }
  ]) {
    const fixture = setup([json(specialistsManifest)]);
    const data = fixture.snapshot(specialistsLevel); alter(data);
    fixture.bake.select(data, () => {});
    await settled(fixture.bake);
    assert.equal(fixture.bake.status().phase, 'fallback');
    assert.equal(fixture.requests.length, 1);
  }
  for (const response of [new Error('missing image'), image(Buffer.from(specialistsBytes.map((value, index) => index === 50 ? value ^ 1 : value)))]) {
    const fixture = setup([json(specialistsManifest), response]);
    fixture.bake.select(fixture.snapshot(specialistsLevel), () => {});
    await settled(fixture.bake);
    assert.equal(fixture.bake.status().phase, 'fallback');
  }
});

test('Atlas is the third explicit bake with effective profile and disconnected eastern road', async () => {
  const fixture = setup([json(atlasManifest), image(atlasBytes), json(specialistsManifest),
    image(specialistsBytes), json(manifest), image(bytes)]);
  for (const id of ['showcase-advance', 'showcase-siege', 'los-supercover-showcase'])
    assert.equal(fixture.bake.snapshot(id, {}, {}, atlasLevel, 12, 8, 34, 58, 48, () => 'road'), null);
  assert.equal(fixture.requests.length, 0);
  const atlas = fixture.snapshot(atlasLevel);
  assert.equal(JSON.stringify(atlas), atlasManifest.key);
  assert.equal(expectedHash(atlasManifest.key), atlasManifest.keySha256);
  assert.equal(expectedHash(atlasBytes), atlasManifest.imageSha256);
  assert.equal(atlas.unitDataProfile, 'field-test-atlas-v1');
  assert.deepEqual(Array.from(atlas.visualCells[3][6][1]), [3]);
  assert.deepEqual(Array.from(atlas.visualCells[3][6][2]), [2, 4]);
  assert.equal(atlas.cells[3][7], 'ridge');
  assert.deepEqual(Array.from(atlas.visualCells[5][7][1]), [0]);
  assert.deepEqual(Array.from(atlas.visualCells[5][8][1]), [3]);
  assert.deepEqual(Array.from(atlas.visualCells[1][6][2]), [2, 4, 5]);
  assert.deepEqual(Array.from(atlas.visualCells[5][6][2]), [4]);
  assert.equal(fixture.bake.select(atlas, () => {}), null);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(atlas, () => {}), 'blob:1');
  const specialists = fixture.snapshot(specialistsLevel);
  fixture.bake.select(specialists, () => {});
  assert.deepEqual(fixture.revoked, ['blob:1']);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(specialists, () => {}), 'blob:2');
  fixture.bake.select(fixture.snapshot(), () => {});
  assert.deepEqual(fixture.revoked, ['blob:1', 'blob:2']);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(fixture.snapshot(), () => {}), 'blob:3');
  assert.deepEqual(fixture.requests.map(request => request.url), [
    'assets/map-bakes/atlas-proving-grounds-192.json',
    'assets/map-bakes/atlas-proving-grounds-192.webp',
    'assets/map-bakes/showcase-specialists-192.json',
    'assets/map-bakes/showcase-specialists-192.webp',
    'assets/map-bakes/showcase-terrain-course-192.json',
    'assets/map-bakes/showcase-terrain-course-192.webp']);
});

test('Atlas profile, route, stale request and corrupt image preserve fallback', async () => {
  const guard = setup([]);
  const terrain = new Map(atlasLevel.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
  const at = (x, y) => terrain.get(`${x},${y}`) || 'open-ground';
  assert.equal(guard.bake.snapshot(atlasLevel.id,
    {ruleProfileId: 'FIELD_TEST_LEGACY_v1', ruleProfile: 'wrong'},
    {scenarioId: atlasLevel.id, ruleProfileId: 'FIELD_TEST_LEGACY_v1',
      effectiveRules: {unitDataProfile: 'field-test-atlas-v1'}},
    atlasLevel, 12, 8, 34, 58, 48, at), null);
  assert.equal(guard.requests.length, 0);
  for (const alter of [
    data => { data.cells[3][7] = 'road'; },
    data => { data.visualCells[3][6][1] = [0, 3]; },
    data => { data.unitDataProfile = 'wrong'; },
    data => { data.profileId = 'FIELD_TEST_LEGACY_v2'; }
  ]) {
    const fixture = setup([json(atlasManifest)]);
    const data = fixture.snapshot(atlasLevel); alter(data);
    fixture.bake.select(data, () => {});
    await settled(fixture.bake);
    assert.equal(fixture.bake.status().phase, 'fallback');
    assert.equal(fixture.requests.length, 1);
  }
  const bad = setup([json(atlasManifest), image(Buffer.from(atlasBytes.map((value, index) =>
    index === 50 ? value ^ 1 : value)))]);
  bad.bake.select(bad.snapshot(atlasLevel), () => {});
  await settled(bad.bake);
  assert.equal(bad.bake.status().phase, 'fallback');
  const dimensions = setup([json(atlasManifest), image(atlasBytes)], [2400, 1300]);
  dimensions.bake.select(dimensions.snapshot(atlasLevel), () => {});
  await settled(dimensions.bake);
  assert.equal(dimensions.bake.status().phase, 'fallback');
  let deliver;
  const pending = new Promise(resolve => { deliver = resolve; });
  const stale = setup([pending, json(manifest), image(bytes)]);
  stale.bake.select(stale.snapshot(atlasLevel), () => assert.fail('stale Atlas redraw'));
  await tick();
  stale.bake.select(stale.snapshot(), () => {});
  assert.equal(stale.requests[0].signal.aborted, true);
  deliver(json(atlasManifest));
  await settled(stale.bake);
  assert.equal(stale.bake.status().phase, 'ready');
  assert.deepEqual(stale.requests.map(request => request.url), [
    'assets/map-bakes/atlas-proving-grounds-192.json',
    'assets/map-bakes/showcase-terrain-course-192.json',
    'assets/map-bakes/showcase-terrain-course-192.webp']);
});

test('Siege and Supercover have distinct pinned keys and lazy five-mission selection', async () => {
  const fixture = setup([json(siegeManifest), image(siegeBytes), json(supercoverManifest),
    image(supercoverBytes), json(atlasManifest), image(atlasBytes)]);
  for (const id of ['showcase-advance','relay-run','iron-dust'])
    assert.equal(fixture.bake.snapshot(id, {}, {}, siegeLevel, 12, 8, 34, 58, 48, () => 'road'), null);
  assert.equal(fixture.requests.length, 0);
  const siege = fixture.snapshot(siegeLevel), supercover = fixture.snapshot(supercoverLevel);
  assert.equal(JSON.stringify(siege), siegeManifest.key);
  assert.equal(JSON.stringify(supercover), supercoverManifest.key);
  assert.equal(expectedHash(siegeManifest.key), siegeManifest.keySha256);
  assert.equal(expectedHash(supercoverManifest.key), supercoverManifest.keySha256);
  assert.equal(expectedHash(siegeBytes), siegeManifest.imageSha256);
  assert.equal(expectedHash(supercoverBytes), supercoverManifest.imageSha256);
  assert.equal(siege.profileId, 'FIELD_TEST_LEGACY_v1');
  assert.equal(supercover.profileId, 'FIELD_TEST_SUPERCOVER_v1');
  assert.equal(supercover.losMode, 'strict-supercover');
  assert.equal(siege.unitDataProfile, supercover.unitDataProfile);
  assert.deepEqual(Array.from(siege.visualCells[3][4][1]), [0]);
  assert.deepEqual(Array.from(siege.visualCells[3][7][1]), [3]);
  assert.deepEqual(Array.from(supercover.visualCells[3][6][1]), [0]);
  assert.deepEqual(Array.from(supercover.visualCells[3][7][1]), [3]);
  fixture.bake.select(siege, () => {});
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(siege, () => {}), 'blob:1');
  fixture.bake.select(supercover, () => {});
  assert.deepEqual(fixture.revoked, ['blob:1']);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(supercover, () => {}), 'blob:2');
  fixture.bake.select(fixture.snapshot(atlasLevel), () => {});
  assert.deepEqual(fixture.revoked, ['blob:1', 'blob:2']);
  await settled(fixture.bake);
  assert.equal(fixture.bake.select(fixture.snapshot(atlasLevel), () => {}), 'blob:3');
  fixture.bake.select(null, () => {});
  assert.deepEqual(fixture.revoked, ['blob:1', 'blob:2', 'blob:3']);
  assert.deepEqual(fixture.requests.map(request => request.url), [
    'assets/map-bakes/showcase-siege-192.json',
    'assets/map-bakes/showcase-siege-192.webp',
    'assets/map-bakes/los-supercover-showcase-192.json',
    'assets/map-bakes/los-supercover-showcase-192.webp',
    'assets/map-bakes/atlas-proving-grounds-192.json',
    'assets/map-bakes/atlas-proving-grounds-192.webp']);
});

test('road profiles, corrupt assets, dimensions and stale requests fall back', async () => {
  for (const [selectedLevel, approvedManifest, approvedBytes] of [
    [siegeLevel,siegeManifest,siegeBytes],
    [supercoverLevel,supercoverManifest,supercoverBytes]
  ]) {
    const fixture = setup([]);
    const terrain = new Map(selectedLevel.terrain.map(cell => [`${cell.x},${cell.y}`,cell.type]));
    const at = (x,y) => terrain.get(`${x},${y}`) || 'open-ground';
    const wrong = selectedLevel.id === 'showcase-siege' ? 'FIELD_TEST_SUPERCOVER_v1' : 'FIELD_TEST_LEGACY_v1';
    assert.equal(fixture.bake.snapshot(selectedLevel.id,
      {ruleProfileId: wrong, ruleProfile: 'field-test-atlas-v1'},
      {scenarioId: selectedLevel.id, scenarioVersion: 1, ruleProfileId: wrong,
        effectiveRules: {unitDataProfile: 'field-test-atlas-v1'}},
      selectedLevel, 12, 8, 34, 58, 48, at), null);
    assert.equal(fixture.requests.length, 0);
    const alterations = [
      data => { data.visualCells[3][selectedLevel.id === 'showcase-siege' ? 4 : 6][1] = [0,3]; },
      data => { data.profileId = wrong; },
      data => { data.unitDataProfile = 'wrong'; }
    ];
    if (selectedLevel.id === 'los-supercover-showcase')
      alterations.push(data => { data.losMode = 'legacy'; });
    for (const alter of alterations) {
      const bad = setup([json(approvedManifest)]);
      const data = bad.snapshot(selectedLevel); alter(data);
      bad.bake.select(data, () => {});
      await settled(bad.bake);
      assert.equal(bad.bake.status().phase, 'fallback');
      assert.equal(bad.requests.length, 1);
    }
    for (const response of [new Error('missing image'),
      image(Buffer.from(approvedBytes.map((value,index)=>index===50?value^1:value)))]) {
      const bad = setup([json(approvedManifest),response]);
      bad.bake.select(bad.snapshot(selectedLevel), () => {});
      await settled(bad.bake);
      assert.equal(bad.bake.status().phase, 'fallback');
    }
    const dimensions = setup([json(approvedManifest),image(approvedBytes)],[2400,1300]);
    dimensions.bake.select(dimensions.snapshot(selectedLevel), () => {});
    await settled(dimensions.bake);
    assert.equal(dimensions.bake.status().phase, 'fallback');
  }
  let deliver;
  const pending = new Promise(resolve => {deliver=resolve;});
  const stale = setup([pending,json(siegeManifest),image(siegeBytes)]);
  stale.bake.select(stale.snapshot(supercoverLevel),()=>assert.fail('stale Supercover redraw'));
  await tick();
  stale.bake.select(stale.snapshot(siegeLevel),()=>{});
  assert.equal(stale.requests[0].signal.aborted,true);
  deliver(json(supercoverManifest));
  await settled(stale.bake);
  assert.equal(stale.bake.status().phase,'ready');
  assert.deepEqual(stale.requests.map(request=>request.url),[
    'assets/map-bakes/los-supercover-showcase-192.json',
    'assets/map-bakes/showcase-siege-192.json',
    'assets/map-bakes/showcase-siege-192.webp']);
});
