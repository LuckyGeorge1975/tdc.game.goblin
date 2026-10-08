import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARTILLERY_SPOTTER_PROBE_VERSION, createArtillerySpotterProbe,
  resolveArtilleryFire, resetArtillerySpotterProbe} from '../artillery-spotter-probe.mjs';

const registry = JSON.parse(readFileSync(new URL(
  '../assets/unit-art/rules/unit-profiles.v1.json', import.meta.url), 'utf8'));
const battery = 'long-range-battery', mobile = 'mobile-siege-gun';
const fresh = (unitId = battery) => createArtillerySpotterProbe(
  registry, 'full-catalog-v1-draft', unitId);
const target = (changes = {}) => ({id: 'enemy-tank', team: 'enemy', hp: 3,
  distance: 8, ...changes});
const actor = (unitId, changes = {}) => ({id: unitId, team: 'player', hp: 2,
  disabled: false, hasLineOfSight: true, ...changes});
const spotter = (changes = {}) => ({id: 'scout', team: 'player', hp: 1,
  disabled: false, hasLineOfSight: true, ...changes});
const request = (unitId, changes = {}) => ({phase: 'fire', mode: 'direct',
  actor: actor(unitId), target: target({distance: unitId === battery ? 8 : 6}),
  spotter: null, ...changes});

test('both U08 and U09 accept a direct A6 shot at their exact range with own LOS', () => {
  for (const [unitId, range] of [[battery, 8], [mobile, 6]]) {
    const state = fresh(unitId);
    assert.equal(state.version, ARTILLERY_SPOTTER_PROBE_VERSION);
    assert.equal(state.forceBudgetValue, 2);
    assert.equal(Object.hasOwn(state, 'setupTurnsRemaining'), false);
    const shot = resolveArtilleryFire(state, request(unitId));
    assert.deepEqual(shot.attack, {mode: 'direct', targetId: 'enemy-tank',
      spotterId: null, attack: 6, range, rolls: 1});
    assert.equal(shot.state.fired, true);
    assert.throws(() => resolveArtilleryFire(shot.state, request(unitId)),
      {code: 'WEAPON_SPENT'});
    assert.equal(resetArtillerySpotterProbe(shot.state, 2).fired, false);
  }
});

test('indirect fire needs a live allied spotter with direct LOS, not shooter LOS', () => {
  for (const unitId of [battery, mobile]) {
    const indirect = request(unitId, {mode: 'indirect',
      actor: actor(unitId, {hasLineOfSight: false}), spotter: spotter()});
    const shot = resolveArtilleryFire(fresh(unitId), indirect);
    assert.equal(shot.attack.attack, 6);
    assert.equal(shot.attack.spotterId, 'scout');
    for (const bad of [null, spotter({hp: 0}), spotter({disabled: true}),
      spotter({team: 'enemy'}), spotter({id: unitId}),
      spotter({id: 'enemy-tank'}),
      spotter({hasLineOfSight: false})])
      assert.throws(() => resolveArtilleryFire(fresh(unitId),
        {...indirect, spotter: bad}), {code: 'VALID_SPOTTER_REQUIRED'});
    assert.throws(() => resolveArtilleryFire(fresh(unitId),
      {...indirect, mode: 'direct', spotter: null}), {code: 'DIRECT_LOS_REQUIRED'});
  }
});

test('empty, friendly, dead and out-of-range targets reject without firing', () => {
  for (const unitId of [battery, mobile]) {
    const state = fresh(unitId), base = request(unitId);
    for (const [bad, expected] of [[null, 'INVALID_FIRE_TARGET'],
      [target({id: ''}), 'INVALID_FIRE_TARGET'],
      [target({team: 'player'}), 'INVALID_FIRE_TARGET'],
      [target({hp: 0}), 'INVALID_FIRE_TARGET'],
      [target({distance: unitId === battery ? 9 : 7}), 'TARGET_OUT_OF_RANGE']]) {
      assert.throws(() => resolveArtilleryFire(state, {...base, target: bad}),
        {code: expected});
    }
    assert.equal(state.fired, false);
  }
});

test('phase, actor, profile and malformed requests fail closed without state/RNG mutation', () => {
  for (const profile of ['FIELD_TEST_LEGACY_v1', 'FULL_CATALOG_v1', 'field-test-atlas-v1'])
    assert.throws(() => createArtillerySpotterProbe(registry, profile, battery),
      {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});
  assert.throws(() => createArtillerySpotterProbe(registry, 'full-catalog-v1-draft',
    'siege-tank'), {code: 'UNSUPPORTED_ARTILLERY_UNIT'});
  const changed = structuredClone(registry);
  changed.units[mobile].target.setupValue = 3;
  assert.throws(() => createArtillerySpotterProbe(changed, 'full-catalog-v1-draft',
    mobile), {code: 'INVALID_ARTILLERY_PROFILE'});
  changed.units[mobile].target.setupValue = 2;
  changed.targetActive = true;
  assert.throws(() => createArtillerySpotterProbe(changed, 'full-catalog-v1-draft',
    mobile), {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});

  const state = fresh(), before = structuredClone(state), rng = {seed: 7, state: 23};
  const rngBefore = structuredClone(rng), base = request(battery);
  const cases = [
    [{...base, phase: 'movement'}, 'INVALID_FIRE_MODE'],
    [{...base, mode: 'blind'}, 'INVALID_FIRE_MODE'],
    [{...base, actor: actor(battery, {hp: 0})}, 'ACTOR_CANNOT_FIRE'],
    [{...base, actor: actor(battery, {disabled: true})}, 'ACTOR_CANNOT_FIRE'],
    [{...base, actor: actor('wrong')}, 'ACTOR_CANNOT_FIRE'],
    [{...base, mode: 'direct', actor: actor(battery, {hasLineOfSight: false})},
      'DIRECT_LOS_REQUIRED']
  ];
  for (const [candidate, code] of cases) {
    const input = structuredClone(candidate);
    assert.throws(() => resolveArtilleryFire(state, candidate), {code});
    assert.deepEqual(candidate, input);
    assert.deepEqual(state, before);
    assert.deepEqual(rng, rngBefore);
  }
  assert.throws(() => resolveArtilleryFire({...state, fired: 'yes'}, base),
    {code: 'INVALID_ARTILLERY_STATE'});
  assert.throws(() => resetArtillerySpotterProbe(state, 3), {code: 'INVALID_TURN'});
});
