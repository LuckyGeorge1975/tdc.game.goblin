import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION, IRON_DUST_FIRE_GEOMETRY_VERSION,
  createIronDustUnifiedStateProbe, queryIronDustFireGeometry,
  validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {queryIronDustB3bAction, preflightIronDustB3bAction,
  queryIronDustB3bAttackSurface, dispatchIronDustB3bAction} from
  '../src/core/iron-dust-b3b-action-probe.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const playerFire = (targetId = 'guard', weaponKey = 'main') =>
  ({type: 'PlayerFire', playerId: 'player', unitId: 'ogre', targetId, weaponKey});
const enemyFire = (targetId = 'ogre', targetKey = 'missiles') =>
  ({type: 'EnemySystemAttack', playerId: 'enemy', attackerId: 'guard', targetId, targetKey});
const phase = (fixture, side, seed = 2) => {
  const state = clone(createIronDustUnifiedStateProbe(seed, {fixture}));
  state.activeTeam = side;
  state.phase = side === 'enemy' ? 'enemy' : 'fire';
  validateIronDustUnifiedStateProbe(state);
  return state;
};
const check = (state, command, code) => {
  const before = JSON.stringify(state);
  const expected = {available: false, error: {code}};
  assert.deepEqual(queryIronDustB3bAction(state, command), expected);
  assert.deepEqual(preflightIronDustB3bAction(state, command), expected);
  assert.deepEqual(queryIronDustB3bAttackSurface(state, [command]),
    {resolverVersion: IRON_DUST_FIRE_GEOMETRY_VERSION,
      entries: [{index: 0, ...expected}]});
  assert.deepEqual(dispatchIronDustB3bAction(state, command), {error: {code}});
  assert.equal(JSON.stringify(state), before);
};

test('versioned Legacy geometry keeps boundary and blocked vectors symmetric', () => {
  for (const [fixture, available] of [['boundary', true],
    [IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION, false]]) {
    const state = phase(fixture, 'player');
    for (const [from, to] of [['ogre', 'guard'], ['guard', 'ogre']]) {
      const result = queryIronDustFireGeometry(state, from, to, 5,
        {outOfRange: 'OUT_OF_RANGE', sightBlocked: 'SIGHT_BLOCKED'});
      assert.equal(result.available, available);
      if (available) {
        assert.equal(result.resolverVersion, IRON_DUST_FIRE_GEOMETRY_VERSION);
        assert.equal(result.losMode, 'legacy-pixel-sample-8-v1');
        assert.equal(result.distance, 5);
      } else assert.deepEqual(result, {available: false, error: {code: 'SIGHT_BLOCKED'}});
    }
    assert.equal(state.executable, false);
    assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  }
});

test('surface, preflight and dispatch agree for both fire directions and rejects', () => {
  const blocked = IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION;
  check(phase(blocked, 'player'), playerFire(), 'WEAPON_SIGHT_BLOCKED');
  check(phase(blocked, 'enemy'), enemyFire(), 'SYSTEM_SIGHT_BLOCKED');
  check(phase('boundary', 'enemy'), enemyFire(), 'SYSTEM_OUT_OF_RANGE');
  check(phase('source', 'player'), playerFire(), 'WEAPON_OUT_OF_RANGE');
  check(phase('adjacent', 'player'), playerFire('ghost'), 'B2_TARGET_UNSUPPORTED');
  check(createIronDustUnifiedStateProbe(2, {fixture: 'adjacent'}),
    playerFire(), 'WRONG_PHASE');
  check(phase('adjacent', 'enemy'), enemyFire('gev'), 'SYSTEM_TARGET_INVALID');

  const boundary = phase('boundary', 'player');
  boundary.units.find(unit => unit.id === 'ogre').ogreSystems.selectedWeapon = 'missiles';
  validateIronDustUnifiedStateProbe(boundary);
  for (const [state, command] of [[boundary, playerFire('guard', 'missiles')],
    [phase('adjacent', 'player'), playerFire()],
    [phase('adjacent', 'enemy'), enemyFire()]]) {
    const before = JSON.stringify(state), query = queryIronDustB3bAction(state, command);
    assert.equal(query.available, true);
    assert.deepEqual(preflightIronDustB3bAction(state, command), query);
    assert.deepEqual(queryIronDustB3bAttackSurface(state, [command]).entries,
      [{index: 0, ...query}]);
    const result = dispatchIronDustB3bAction(state, command);
    assert.ok(result.state);
    assert.equal(result.events.length, 1);
    assert.equal(result.state.rng.state,
      (Math.imul(1664525, state.rng.state) + 1013904223) >>> 0);
    assert.equal(JSON.stringify(state), before);
  }

  const spent = dispatchIronDustB3bAction(phase('adjacent', 'player'), playerFire()).state;
  check(spent, playerFire(), 'WEAPON_NOT_SELECTED');
  const spentMain = clone(spent);
  spentMain.units.find(unit => unit.id === 'ogre').ogreSystems.selectedWeapon = 'main';
  validateIronDustUnifiedStateProbe(spentMain);
  check(spentMain, playerFire(), 'WEAPON_NOT_READY');
  const spentEnemy = dispatchIronDustB3bAction(phase('adjacent', 'enemy'), enemyFire()).state;
  check(spentEnemy, enemyFire(), 'ACTION_SPENT');
  assert.deepEqual(queryIronDustB3bAttackSurface(spent, [{}]),
    {error: {code: 'B3B_ATTACK_SURFACE_INVALID'}});
});
