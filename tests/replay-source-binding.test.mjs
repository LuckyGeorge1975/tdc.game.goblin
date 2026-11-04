import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {bindReplaySources, bindingManifest, gameplaySourceHashes, readSource, verifyGameplay} from './helpers/replay-source-binding.mjs';

const manifest = bindingManifest();
const fixture = path => fs.readFileSync(new URL('./fixtures/' + path, import.meta.url));
const training = JSON.parse(gunzipSync(fixture('training-t01.game-teaching.v1.json.gz'))).header.sourceHashes;
const artillery = JSON.parse(fixture('artillery-product-traces.v1.json')).traces.victory;

test('current gameplay sources match the binding and every bound path is classified once', () => {
  verifyGameplay();
  assert.deepEqual(gameplaySourceHashes(), manifest.gameplaySources);
  assert.equal(Object.keys(manifest.gameplaySources).filter(path => Object.hasOwn(manifest.ignoredPaths, path)).length, 0);
  assert.equal(Object.keys(manifest.traces).length, 31);
  for (const path of ['terrain-rules.js', 'unit-life.js', 'game.js', 'catalog-full-runtime.js', 'assets/unit-art/rules/unit-profiles.v1.json'])
    assert.ok(Object.hasOwn(manifest.gameplaySources, path), path);
  for (const path of ['ui-v2.js', 'ui-v2.css', 'ui-v2-flow.js', 'index.html', 'localization.js', 'assets/ui-copy/briefing-01.de.json'])
    assert.ok(Object.hasOwn(manifest.ignoredPaths, path), path);
});

test('a changed gameplay source fails, whichever file it is', () => {
  for (const path of Object.keys(manifest.gameplaySources))
    assert.throws(() => verifyGameplay(candidate => candidate === path ? readSource(candidate) + '\n// changed' : readSource(candidate)), new RegExp('gameplay source drift: ' + path.replaceAll('.', '\\.')));
});

test('UI, presentation and harness files are never read by the binding', () => {
  const read = path => { assert.ok(!Object.hasOwn(manifest.ignoredPaths, path), 'unbound path read: ' + path); return readSource(path); };
  verifyGameplay(read);
  assert.equal(bindReplaySources(training, 'training-t01', read), training);
});

test('recorded headers bind unchanged; foreign references and forged headers reject', () => {
  assert.equal(bindReplaySources(training, 'training-t01'), training);
  assert.equal(bindReplaySources(artillery.header.sources, artillery.traceDigest), artillery.header.sources);
  assert.throws(() => bindReplaySources(training, 'foreign'), /foreign trace reference/);
  assert.throws(() => bindReplaySources(artillery.header.sources, 'training-t01'), /forged recorded header/);
  for (const path of ['game.js', 'ui-v2.js']) assert.throws(() => bindReplaySources({...training, [path]: 'forged'}, 'training-t01'), /forged recorded header/);
  const missing = {...training}; delete missing['terrain-rules.js'];
  assert.throws(() => bindReplaySources(missing, 'training-t01'), /forged recorded header/);
});
