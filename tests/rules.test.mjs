import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_RULES, TERRAIN_RULES, applyCombatResult, combatRatio, hexDistance, terrainCost } from '../rules.mjs';

test('unit matrix contains the four player archetypes', () => {
  assert.deepEqual(Object.keys(UNIT_RULES), ['goblin', 'gev', 'missile', 'infantry']);
  assert.equal(UNIT_RULES.gev.secondMove, 2);
  assert.equal(UNIT_RULES.goblin.ram, true);
});

test('hex distance uses the offset-grid coordinate rule', () => {
  assert.equal(hexDistance({ x: 2, y: 2 }, { x: 4, y: 3 }), 3);
  assert.equal(hexDistance({ x: 2, y: 2 }, { x: 2, y: 2 }), 0);
});

test('terrain costs and visibility flags match the matrix', () => {
  assert.equal(terrainCost(false), TERRAIN_RULES.open.cost);
  assert.equal(terrainCost(true), 2);
  assert.equal(TERRAIN_RULES.cover.blocksLos, true);
  assert.equal(TERRAIN_RULES.open.blocksLos, false);
});

test('combat ratio follows the current CRT input bands', () => {
  assert.equal(combatRatio(3, 5), '1-1');
  assert.equal(combatRatio(10, 2), '5-1');
  assert.equal(combatRatio(1, 4), '1-2');
});

test('D disables vehicles, damages infantry, and destroys disabled vehicles', () => {
  assert.equal(applyCombatResult({ hp: 3, infantry: false }, 'D').disabled, true);
  assert.equal(applyCombatResult({ hp: 2, infantry: true }, 'D').hp, 1);
  assert.equal(applyCombatResult({ hp: 3, disabled: true }, 'D').hp, 0);
  assert.equal(applyCombatResult({ hp: 3 }, 'X').hp, 0);
});