import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OGRE_SYSTEMS} from '../rules.mjs';
import {PLATFORM_SYSTEM_DRAFT_V1, validatePlatformSystemDraftV1} from '../src/levels/platform-system-draft.v1.mjs';

const profiles = JSON.parse(readFileSync(new URL('../assets/unit-art/rules/unit-profiles.v1.json', import.meta.url), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

test('both inactive platform drafts contain only the sourced target fields', () => {
  const draft = PLATFORM_SYSTEM_DRAFT_V1;
  assert.equal(draft.schemaVersion, 1);
  assert.equal(draft.dataProfile, profiles.targetProfile);
  assert.equal(draft.active, profiles.targetActive);
  assert.deepEqual(Object.keys(draft.platforms).sort(), ['forge-engineer', 'goblin-dreadnaught']);
  for (const [id, system] of [['goblin-dreadnaught', 'mkV'], ['forge-engineer', 'vulcan']]) {
    const actual = plain(draft.platforms[id]);
    assert.deepEqual(actual, profiles.units[id].target, id);
    const source = OGRE_SYSTEMS[system];
    assert.equal(actual.source, `OGRE_SYSTEMS.${system}`);
    assert.equal(actual.system, system);
    for (const key of Object.keys(actual).filter(key => !['source', 'system'].includes(key)))
      assert.deepEqual(actual[key], source[key], `${id}.${key}`);
  }
  assert.deepEqual(plain(draft.platforms['goblin-dreadnaught']), {
    source: 'OGRE_SYSTEMS.mkV', system: 'mkV', tread: 60, movement: [3, 2, 1, 0],
    mainBatteries: 2, secondaryBatteries: 6, missiles: 6, antipersonnel: 12
  });
  assert.deepEqual(plain(draft.platforms['forge-engineer']), {
    source: 'OGRE_SYSTEMS.vulcan', system: 'vulcan', tread: 45,
    movement: [3, 2, 1, 0], engineering: true, drones: true
  });
  for (const platform of Object.values(draft.platforms))
    for (const unsupported of ['hp', 'infantry', 'transportCapacity', 'attack', 'range',
      'defense', 'weaponStats', 'components', 'treadThresholds'])
      assert.equal(Object.hasOwn(platform, unsupported), false, unsupported);
});

test('a validated JSON copy resolves to the deeply frozen canonical draft', () => {
  const draft = PLATFORM_SYSTEM_DRAFT_V1;
  assert.equal(validatePlatformSystemDraftV1(plain(draft)), draft);
  for (const value of [draft, draft.platforms, ...Object.values(draft.platforms),
    draft.platforms['goblin-dreadnaught'].movement,
    draft.platforms['forge-engineer'].movement]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {draft.platforms['forge-engineer'].tread = 44}, TypeError);
});

test('version, profile, missing inventories and invented system data fail closed', () => {
  for (const [change, message] of [
    [value => {value.schemaVersion = 2}, 'UNSUPPORTED_PLATFORM_DRAFT_VERSION'],
    [value => {value.dataProfile = 'FIELD_TEST_LEGACY_v1'}, 'UNSUPPORTED_PLATFORM_DRAFT_PROFILE'],
    [value => {value.active = true}, 'UNSUPPORTED_PLATFORM_DRAFT_PROFILE'],
    [value => {value.platforms['goblin-dreadnaught'].missiles = 5}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {delete value.platforms['goblin-dreadnaught'].secondaryBatteries}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['goblin-dreadnaught'].tread = 45}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['forge-engineer'].movement[1] = 1}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['forge-engineer'].infantry = true}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['forge-engineer'].hp = 2}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['forge-engineer'].mainBatteries = 1}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['forge-engineer'].treadThresholds = [31, 16, 1, 0]}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {delete value.platforms['forge-engineer']}, 'PLATFORM_DRAFT_MISMATCH'],
    [value => {value.platforms['goblin-siegebreaker'] = {}}, 'PLATFORM_DRAFT_MISMATCH']
  ]) {
    const candidate = plain(PLATFORM_SYSTEM_DRAFT_V1);
    change(candidate);
    const before = plain(candidate);
    assert.throws(() => validatePlatformSystemDraftV1(candidate), {message});
    assert.deepEqual(candidate, before);
  }
});

test('hidden string keys, symbols and non-enumerable fields fail closed at every depth', () => {
  for (const change of [
    value => Object.defineProperty(value, 'hidden', {value: true}),
    value => Object.defineProperty(value.platforms, 'hidden', {value: true}),
    value => Object.defineProperty(value.platforms['forge-engineer'], 'hidden', {value: true}),
    value => Object.defineProperty(value.platforms['goblin-dreadnaught'].movement, 'hidden', {value: true}),
    value => {value[Symbol('hidden')] = true},
    value => {value.platforms['forge-engineer'][Symbol('hidden')] = true},
    value => {value.platforms['goblin-dreadnaught'].movement[Symbol('hidden')] = true},
    value => Object.defineProperty(value.platforms['forge-engineer'], 'drones', {value: true, enumerable: false})
  ]) {
    const candidate = structuredClone(PLATFORM_SYSTEM_DRAFT_V1);
    change(candidate);
    const keysBefore = Reflect.ownKeys(candidate);
    assert.throws(() => validatePlatformSystemDraftV1(candidate), {message: 'PLATFORM_DRAFT_MISMATCH'});
    assert.deepEqual(Reflect.ownKeys(candidate), keysBefore);
  }
});
