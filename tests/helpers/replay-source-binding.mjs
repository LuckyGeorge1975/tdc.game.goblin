// Recorded product traces stay bound to the gameplay sources they were played with: rules, runtimes,
// level, unit and training data. UI, presentation and test-harness files are deliberately unbound; if
// their behaviour changes, the replayed oracle (state, events, markers, presentation) still fails on its own.
// Replaces the former chain of *-source-compatibility links (see the manifest's "supersedes").
// Re-pin gameplay sources after an intended rules change with: node scripts/update-replay-binding.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const manifest = JSON.parse(fs.readFileSync(new URL('../fixtures/replay-source-binding.v1.json', import.meta.url), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
export const readSource = path => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
export const canonicalSources = sources => JSON.stringify(Object.keys(sources).sort().map(path => [path, sources[path]]));
let verified = false;

// Hashes every bound gameplay source and recorded fixture once per process; an injected reader always checks.
export function verifyGameplay(read = null) {
  if (!read && verified) return;
  assert.equal(manifest.version, 'replay-source-binding-v1');
  for (const [path, expected] of Object.entries(manifest.gameplaySources))
    assert.equal(hash((read ?? readSource)(path)), expected, 'gameplay source drift: ' + path);
  for (const [path, expected] of Object.entries(manifest.immutableFixtures))
    assert.equal(hash(fs.readFileSync(new URL('../fixtures/' + path, import.meta.url))), expected, 'recorded fixture changed: ' + path);
  if (!read) verified = true;
}

// Accepts the recorded source header of a known trace unchanged and returns it as the oracle header.
export function bindReplaySources(recorded, reference, read = null) {
  verifyGameplay(read);
  assert.ok(Object.hasOwn(manifest.traces, reference), 'foreign trace reference');
  assert.equal(hash(canonicalSources(recorded)), manifest.traces[reference], 'forged recorded header');
  for (const path of Object.keys(recorded))
    assert.ok(Object.hasOwn(manifest.gameplaySources, path) !== Object.hasOwn(manifest.ignoredPaths, path), 'unclassified recorded source: ' + path);
  return recorded;
}

// Source header for new recordings: only the bound gameplay sources.
export function gameplaySourceHashes(read = readSource) {
  return Object.fromEntries(Object.keys(manifest.gameplaySources).map(path => [path, hash(read(path))]));
}

export const bindingManifest = () => structuredClone(manifest);
