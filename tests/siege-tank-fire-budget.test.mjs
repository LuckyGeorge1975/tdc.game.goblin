import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSiegeTankFireBudget, resolveSiegeTankFire, resetSiegeTankFireBudget,
  SIEGE_TANK_FIRE_BUDGET_VERSION} from '../siege-tank-fire-budget.mjs';

const registry = JSON.parse(readFileSync(new URL(
  '../assets/unit-art/rules/unit-profiles.v1.json', import.meta.url), 'utf8'));
const fresh = () => createSiegeTankFireBudget(registry, 'full-catalog-v1-draft', 'siege-tank');
const actor = {id: 'siege-tank', team: 'player', hp: 5, disabled: false};
const target = (id, changes = {}) => ({id, team: 'enemy', hp: 3,
  infantry: false, distance: 3, hasLineOfSight: true, ...changes});
const fire = (state, weapon, aim, changes = {}) => resolveSiegeTankFire(state,
  {phase: 'fire', weapon, actor: {...actor, ...changes}, target: aim});

test('two main guns fire separately at different targets, and AP slots remain independent', () => {
  let state = fresh();
  assert.equal(state.version, SIEGE_TANK_FIRE_BUDGET_VERSION);
  let shot = fire(state, 'main-1', target('tank-a'));
  assert.deepEqual(shot.attack, {targetId: 'tank-a', attack: 3, range: 3,
    rolls: 1, slots: ['main-1']});
  state = fire(shot.state, 'main-2', target('tank-b')).state;
  state = fire(state, 'ap-1', target('infantry-a', {infantry: true, distance: 1})).state;
  state = fire(state, 'ap-2', target('infantry-a', {infantry: true, distance: 1})).state;
  assert.deepEqual(state.used, ['main-1', 'main-2', 'ap-1', 'ap-2']);
  for (const weapon of ['main-1', 'main-2', 'main-both', 'ap-1', 'ap-2'])
    assert.throws(() => fire(state, weapon, target('tank-c', {infantry: true, distance: 1})),
      {code: 'WEAPON_SPENT'});
});

test('bundled A6 makes one attack/roll and consumes both main slots, leaving both AP slots', () => {
  const result = fire(fresh(), 'main-both', target('tank-a'));
  assert.deepEqual(result.attack, {targetId: 'tank-a', attack: 6, range: 3,
    rolls: 1, slots: ['main-1', 'main-2']});
  assert.deepEqual(result.state.used, ['main-1', 'main-2']);
  assert.equal(fire(result.state, 'ap-1', target('infantry-a',
    {infantry: true, distance: 1})).attack.attack, 1);
  assert.throws(() => fire(result.state, 'main-1', target('tank-b')), {code: 'WEAPON_SPENT'});
  assert.throws(() => fire(fire(fresh(), 'main-1', target('tank-a')).state,
    'main-both', target('tank-b')), {code: 'WEAPON_SPENT'});
});

test('separate main guns cannot strike the same target twice; AP needs infantry in R1', () => {
  const state = fire(fresh(), 'main-1', target('tank-a')).state;
  assert.throws(() => fire(state, 'main-2', target('tank-a')),
    {code: 'MAIN_TARGET_ALREADY_FIRED'});
  assert.throws(() => fire(fresh(), 'ap-1', target('tank-a', {distance: 1})),
    {code: 'TARGET_NOT_ATTACKABLE'});
  assert.throws(() => fire(fresh(), 'ap-1', target('infantry-a',
    {infantry: true, distance: 2})), {code: 'TARGET_NOT_ATTACKABLE'});
  assert.throws(() => fire(fresh(), 'main-1', target('tank-a', {distance: 4})),
    {code: 'TARGET_NOT_ATTACKABLE'});
  assert.throws(() => fire(fresh(), 'main-1', target('tank-a',
    {hasLineOfSight: false})), {code: 'TARGET_NOT_ATTACKABLE'});
});

test('fail-closed profile, phase, actor and target gates leave input and RNG untouched', () => {
  for (const profile of ['FIELD_TEST_LEGACY_v1', 'FULL_CATALOG_v1', 'field-test-atlas-v1'])
    assert.throws(() => createSiegeTankFireBudget(registry, profile, 'siege-tank'),
      {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});
  assert.throws(() => createSiegeTankFireBudget(registry, 'full-catalog-v1-draft', 'ogre'),
    {code: 'UNSUPPORTED_UNIT'});
  const changed = structuredClone(registry);
  changed.units['siege-tank'].target.antipersonnel = 3;
  assert.throws(() => createSiegeTankFireBudget(changed, 'full-catalog-v1-draft',
    'siege-tank'), {code: 'INVALID_SIEGE_TANK_PROFILE'});
  changed.units['siege-tank'].target.antipersonnel = 2;
  changed.targetActive = true;
  assert.throws(() => createSiegeTankFireBudget(changed, 'full-catalog-v1-draft',
    'siege-tank'), {code: 'UNSUPPORTED_UNIT_DATA_PROFILE'});

  const state = fresh(), rng = {seed: 7, state: 19};
  const before = structuredClone(state), rngBefore = structuredClone(rng);
  const requests = [
    [{phase: 'movement', weapon: 'main-1', actor, target: target('tank-a')}, 'INVALID_FIRE_PHASE'],
    [{phase: 'fire', weapon: 'main-1', actor: {...actor, hp: 0}, target: target('tank-a')}, 'ACTOR_CANNOT_FIRE'],
    [{phase: 'fire', weapon: 'main-1', actor: {...actor, disabled: true}, target: target('tank-a')}, 'ACTOR_CANNOT_FIRE'],
    [{phase: 'fire', weapon: 'main-1', actor, target: target('tank-a', {team: 'player'})}, 'INVALID_FIRE_TARGET'],
    [{phase: 'fire', weapon: 'main-1', actor, target: target('tank-a', {hp: 0})}, 'INVALID_FIRE_TARGET'],
    [{phase: 'fire', weapon: 'laser', actor, target: target('tank-a')}, 'INVALID_WEAPON'],
    [{phase: 'fire', weapon: 'toString', actor, target: target('tank-a')}, 'INVALID_WEAPON']
  ];
  for (const [request, code] of requests) {
    const requestBefore = structuredClone(request);
    assert.throws(() => resolveSiegeTankFire(state, request), {code});
    assert.deepEqual(request, requestBefore);
    assert.deepEqual(state, before);
    assert.deepEqual(rng, rngBefore);
  }
  assert.throws(() => resolveSiegeTankFire({...state, used: ['main-1']},
    requests[0][0]), {code: 'INVALID_SIEGE_TANK_STATE'});
});

test('only the next turn restores all slots; invalid reset cannot mutate state', () => {
  const spent = fire(fresh(), 'main-both', target('tank-a')).state;
  assert.throws(() => resetSiegeTankFireBudget(spent, 1), {code: 'INVALID_TURN'});
  assert.throws(() => resetSiegeTankFireBudget(spent, 3), {code: 'INVALID_TURN'});
  assert.deepEqual(spent.used, ['main-1', 'main-2']);
  const next = resetSiegeTankFireBudget(spent, 2);
  assert.equal(next.turn, 2);
  assert.deepEqual(next.used, []);
  assert.deepEqual(next.mainTargets, []);
  assert.equal(fire(next, 'main-both', target('tank-a')).attack.attack, 6);
});
