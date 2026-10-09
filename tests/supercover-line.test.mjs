import test from 'node:test';
import assert from 'node:assert/strict';
import {supercoverIntermediateHexes} from '../src/core/supercover-line.mjs';

const A = {x: 2, y: 2}, B = {x: 2, y: 0};
const L = {x: 1, y: 1}, R = {x: 2, y: 1};
const key = ({x, y}) => `${x},${y}`;
const visible = (from, to, blockers) =>
  !supercoverIntermediateHexes(from, to).some(cell => blockers.has(key(cell)));

test('the exact A-B boundary includes both intermediate hexes in either direction', () => {
  assert.deepEqual(supercoverIntermediateHexes(A, B), [L, R]);
  assert.deepEqual(supercoverIntermediateHexes(B, A), [L, R]);
  for (const [blocked, expected] of [
    [[], true], [[L], false], [[R], false], [[L, R], false]
  ]) {
    const blockers = new Set(blocked.map(key));
    assert.equal(visible(A, B, blockers), expected);
    assert.equal(visible(B, A, blockers), expected);
  }
});

test('clear terrain, endpoints, and an ordinary center-crossing line stay visible', () => {
  assert.equal(visible(A, B, new Set()), true);
  assert.equal(visible(A, B, new Set([key(A), key(B)])), true);
  const from = {x: 1, y: 3}, to = {x: 3, y: 3}, middle = {x: 2, y: 3};
  assert.deepEqual(supercoverIntermediateHexes(from, to), [middle]);
  assert.deepEqual(supercoverIntermediateHexes(to, from), [middle]);
  assert.equal(visible(from, to, new Set([key(middle)])), false);
  assert.equal(visible(from, to, new Set()), true);
  assert.deepEqual(supercoverIntermediateHexes(from, middle), []);
  assert.deepEqual(supercoverIntermediateHexes(from, from), []);
});

test('intermediate sets are deterministic and symmetric across odd-row directions', () => {
  const points = Array.from({length: 5}, (_, y) =>
    Array.from({length: 5}, (_, x) => ({x, y}))).flat();
  for (const from of points) for (const to of points) {
    const forward = supercoverIntermediateHexes(from, to);
    assert.deepEqual(forward, supercoverIntermediateHexes(to, from), `${key(from)} -> ${key(to)}`);
    assert.equal(new Set(forward.map(key)).size, forward.length);
    assert.ok(!forward.some(cell => key(cell) === key(from) || key(cell) === key(to)));
  }
  assert.throws(() => supercoverIntermediateHexes({x: 1.5, y: 2}, B), TypeError);
});
