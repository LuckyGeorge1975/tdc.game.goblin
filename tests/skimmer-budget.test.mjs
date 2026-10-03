import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {skimmerMovementBudget} from '../skimmer-budget.mjs';

const registry = JSON.parse(readFileSync(
  new URL('../assets/unit-art/rules/unit-profiles.v1.json', import.meta.url), 'utf8'));

test('all four player skimmers retain the Field Test 3+2 budget', () => {
  for (const id of ['skimmer-scout', 'combat-skimmer', 'light-skimmer', 'skimmer-carrier']) {
    const budget = skimmerMovementBudget(registry, registry.legacyProfile, id);
    assert.deepEqual(budget, {primary: 3, secondary: 2}, id);
    assert.equal(Object.isFrozen(budget), true, id);
  }
});

test('target draft data distinguishes 4+3 and 3+2 skimmers', () => {
  const expected = {
    'skimmer-scout': [3, 2],
    'combat-skimmer': [4, 3],
    'light-skimmer': [4, 3],
    'skimmer-carrier': [3, 2]
  };
  for (const [id, [primary, secondary]] of Object.entries(expected))
    assert.deepEqual(skimmerMovementBudget(registry, registry.targetProfile, id),
      {primary, secondary}, id);
});

test('unknown product/data profiles and non-player skimmers cannot obtain a budget', () => {
  for (const profile of [undefined, 'FULL_CATALOG_v1', 'FIELD_TEST_LEGACY_v1', 'unknown'])
    assert.throws(() => skimmerMovementBudget(registry, profile, 'combat-skimmer'),
      {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});
  for (const id of [undefined, 'raider-skimmer', 'recon-tank', 'missing'])
    assert.throws(() => skimmerMovementBudget(registry, registry.targetProfile, id),
      {code: 'NOT_PLAYER_SKIMMER'});
});

test('incomplete or altered draft data is rejected without mutating the registry', () => {
  const changed = structuredClone(registry);
  changed.units['combat-skimmer'].target.movement = [4];
  assert.throws(() => skimmerMovementBudget(changed, changed.targetProfile, 'combat-skimmer'),
    {code: 'INVALID_SKIMMER_BUDGET'});
  changed.units['combat-skimmer'].target.movement = [4, 3];
  changed.units['combat-skimmer'].target.mode = 'tracked';
  assert.throws(() => skimmerMovementBudget(changed, changed.targetProfile, 'combat-skimmer'),
    {code: 'INVALID_SKIMMER_BUDGET'});
  changed.units['combat-skimmer'].target.mode = 'gev';
  changed.targetActive = true;
  assert.throws(() => skimmerMovementBudget(changed, changed.targetProfile, 'combat-skimmer'),
    {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});
  assert.deepEqual(skimmerMovementBudget(registry, registry.targetProfile, 'combat-skimmer'),
    {primary: 4, secondary: 3});
});

test('renaming the registry profile does not authorize FULL_CATALOG', () => {
  const changed = structuredClone(registry);
  changed.targetProfile = 'FULL_CATALOG_v1';
  assert.throws(() => skimmerMovementBudget(changed, changed.targetProfile, 'combat-skimmer'),
    {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});
});
