import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_NEAR_CORE_FIXTURE_VERSION, createIronDustUnifiedStateProbe,
  queryIronDustUnifiedGeometry, validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {createIronDustPlayerFireProbe, dispatchIronDustPlayerFireProbe,
  queryIronDustPlayerFireProbe} from '../src/core/iron-dust-player-fire-probe.mjs';
import {createIronDustWeaponProbe, dispatchIronDustWeaponProbe} from '../src/core/iron-dust-weapon-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';
import {queryIronDustB2Action, preflightIronDustB2Action,
  dispatchIronDustB2Action} from '../src/core/iron-dust-b2-action-probe.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const unit = (state, id) => state.units.find(value => value.id === id);
const end = playerId => ({type: 'EndPhase', playerId});
const select = weaponKey => ({type: 'SelectWeapon', playerId: 'player', unitId: 'ogre', weaponKey});
const fire = (targetId = 'guard', weaponKey = 'main') =>
  ({type: 'PlayerFire', playerId: 'player', unitId: 'ogre', targetId, weaponKey});
const inFire = (seed, fixture = 'adjacent') =>
  dispatchIronDustB2Action(createIronDustUnifiedStateProbe(seed, {fixture}), end('player')).state;

test('B2 remains technical and near-core fixture is exact, versioned and inactive', () => {
  const sourceBefore = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustUnifiedStateProbe(5,
    {fixture: IRON_DUST_NEAR_CORE_FIXTURE_VERSION});
  assert.equal(state.fixture, 'iron-dust-near-core-fixture-v1');
  assert.deepEqual({x: unit(state, 'ogre').x, y: unit(state, 'ogre').y}, {x: 10, y: 1});
  assert.deepEqual({x: unit(state, 'core').x, y: unit(state, 'core').y}, {x: 10, y: 2});
  assert.equal(queryIronDustUnifiedGeometry(state, 'ogre', 'core').distance, 1);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  const ready = dispatchIronDustB2Action(state, end('player')).state;
  assert.deepEqual(queryIronDustB2Action(ready, fire('core')),
    {available: false, error: {code: 'B2_TARGET_UNSUPPORTED'}});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), sourceBefore);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('one State-A RNG matches checked Legacy NE, D and X vectors and budget fallback', () => {
  for (const [seed, result, hp, disabled, disabledUntil] of [
    [0, 'NE', 3, false, 0], [3, 'D', 3, true, 2], [2, 'X', 0, false, 0]
  ]) {
    const state = inFire(seed), before = JSON.stringify(state);
    const oracle = createIronDustPlayerFireProbe(seed, {fixture: 'adjacent'});
    assert.deepEqual(queryIronDustB2Action(state, fire()), queryIronDustPlayerFireProbe(oracle, fire()));
    assert.deepEqual(preflightIronDustB2Action(state, fire()), queryIronDustB2Action(state, fire()));
    const expected = dispatchIronDustPlayerFireProbe(oracle, fire());
    const actual = dispatchIronDustB2Action(state, fire());
    assert.deepEqual(actual.events, expected.events);
    assert.deepEqual([unit(actual.state, 'guard').hp, unit(actual.state, 'guard').disabled,
      unit(actual.state, 'guard').disabledUntil], [hp, disabled, disabledUntil]);
    assert.equal(actual.events[0].result, result);
    assert.equal(actual.state.rng.state, expected.state.combatRng.state);
    assert.equal(unit(actual.state, 'ogre').ogreSystems.weapons.main.firedThisPhase, 1);
    assert.equal(unit(actual.state, 'ogre').ogreSystems.selectedWeapon, 'secondary');
    assert.equal(JSON.stringify(state), before);
    assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(plain(actual.state)));
  }
});

test('selection, second D and missiles match Legacy spending with one RNG', () => {
  let state = inFire(10);
  let oracle = createIronDustPlayerFireProbe(10, {fixture: 'adjacent'});
  const first = dispatchIronDustB2Action(state, fire());
  state = first.state;
  oracle = dispatchIronDustPlayerFireProbe(oracle, fire()).state;
  const selected = dispatchIronDustB2Action(state, select('secondary'));
  assert.deepEqual(selected.events, [{type: 'WeaponSelected', weaponKey: 'secondary',
    attack: 3, range: 2, ready: 4}]);
  state = selected.state;
  const second = dispatchIronDustB2Action(state, fire('guard', 'secondary'));
  const oldSecond = dispatchIronDustPlayerFireProbe(oracle, fire('guard', 'secondary'));
  assert.deepEqual(second.events, oldSecond.events);
  assert.equal(second.events[0].result, 'D');
  assert.equal(unit(second.state, 'guard').hp, 0);
  assert.equal(second.state.rng.state, oldSecond.state.combatRng.state);

  state = dispatchIronDustB2Action(inFire(2), select('missiles')).state;
  const missile = dispatchIronDustB2Action(state, fire('guard', 'missiles'));
  const oldWeapons = dispatchIronDustWeaponProbe(createIronDustWeaponProbe(2),
    {type: 'SelectWeapon', weaponKey: 'missiles'}).state;
  const oldMissile = dispatchIronDustPlayerFireProbe(createIronDustPlayerFireProbe(2,
    {fixture: 'adjacent', weaponState: oldWeapons}), fire('guard', 'missiles'));
  assert.deepEqual(missile.events, oldMissile.events);
  assert.equal(missile.state.rng.state, oldMissile.state.combatRng.state);
  assert.equal(unit(missile.state, 'ogre').ogreSystems.weapons.missiles.remaining, 1);
  assert.equal(unit(missile.state, 'ogre').ogreSystems.selectedWeapon, 'missiles');
});

test('unsupported actions and killed-guard enemy followup reject with identical preflight and no mutation', () => {
  const base = inFire(5), source = inFire(5, 'source');
  const movement = createIronDustUnifiedStateProbe(5, {fixture: 'adjacent'});
  const near = inFire(5, IRON_DUST_NEAR_CORE_FIXTURE_VERSION);
  const boundary = createIronDustUnifiedStateProbe(5, {fixture: 'boundary'});
  const spent = dispatchIronDustB2Action(base, fire()).state;
  let dead = dispatchIronDustB2Action(inFire(2), fire()).state;
  dead = dispatchIronDustB2Action(dead, end('player')).state;
  dead = dispatchIronDustB2Action(dead, end('player')).state;
  for (const [state, command, code] of [
    [base, fire('ghost'), 'B2_TARGET_UNSUPPORTED'],
    [base, fire('core'), 'B2_TARGET_UNSUPPORTED'],
    [near, fire('core'), 'B2_TARGET_UNSUPPORTED'],
    [near, fire('guard'), 'WEAPON_SIGHT_BLOCKED'],
    [base, fire('guard', 'missiles'), 'WEAPON_NOT_SELECTED'],
    [movement, select('main'), 'WRONG_PHASE'],
    [movement, fire(), 'WRONG_PHASE'],
    [base, {...select('main'), unitId: 'gev'}, 'ATTACK_ACTOR_INVALID'],
    [base, select('unknown'), 'WEAPON_UNKNOWN'],
    [source, fire(), 'WEAPON_OUT_OF_RANGE'],
    [spent, fire(), 'WEAPON_NOT_SELECTED'],
    [spent, select('main'), 'WEAPON_NOT_READY'],
    [base, {...fire(), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM'],
    [base, {...fire(), unitId: 'gev'}, 'ATTACK_ACTOR_INVALID'],
    [base, {type: 'EnemySystemAttack', playerId: 'enemy', attackerId: 'guard',
      targetId: 'ogre', targetKey: 'main'}, 'B1_COMMAND_UNSUPPORTED'],
    [boundary, select('main'), 'B2_FIXTURE_UNSUPPORTED'],
    [dead, {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'},
      'B2_ENEMY_FOLLOWUP_UNSUPPORTED'],
    [dead, end('enemy'), 'B2_ENEMY_FOLLOWUP_UNSUPPORTED']
  ]) {
    const before = JSON.stringify(state);
    const expected = {available: false, error: {code}};
    assert.deepEqual(queryIronDustB2Action(state, command), expected);
    assert.deepEqual(preflightIronDustB2Action(state, command), expected);
    assert.deepEqual(dispatchIronDustB2Action(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
  }
});
