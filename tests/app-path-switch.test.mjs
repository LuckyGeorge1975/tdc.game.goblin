import test from 'node:test';
import assert from 'node:assert/strict';
import { modeFromSearch, pathFor } from '../src/app/path-switch.mjs';

test('local path switch exposes terrain preview, both Core fixtures and unchanged legacy entry', () => {
  assert.equal(pathFor('core'), './reference.html');
  assert.equal(pathFor('phase'), './reference.html?scenario=phase-v2&harness=1');
  assert.equal(pathFor('terrain'), './reference.html?terrain=study');
  assert.equal(pathFor('legacy'), '../../index.html');
  assert.equal(modeFromSearch('?path=legacy'), 'legacy');
  assert.equal(modeFromSearch('?path=core'), 'core');
  assert.equal(modeFromSearch('?path=phase'), 'phase');
  assert.equal(modeFromSearch('?path=terrain'), 'terrain');
  assert.equal(modeFromSearch('?path=unknown'), 'core');
  assert.throws(() => pathFor('unknown'), RangeError);
});
