import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustFireContractProbe, validateIronDustFireContractProbe,
  queryIronDustFireContractProbe} from '../src/core/iron-dust-fire-contract-probe.mjs';
import {createIronDustWeaponProbe, dispatchIronDustWeaponProbe} from '../src/core/iron-dust-weapon-probe.mjs';
import {createIronDustAttackPreflightProbe, queryIronDustAttackProbe} from '../src/core/iron-dust-attack-preflight-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const fire = (targetId = 'guard', weaponKey = 'main') =>
  ({type: 'PlayerFire', playerId: 'player', unitId: 'ogre', targetId, weaponKey});
const system = (attackerId = 'guard', targetKey = 'main') =>
  ({type: 'EnemySystemAttack', playerId: 'enemy', attackerId, targetId: 'ogre', targetKey});
const unit = (state, id) => state.units.find(value => value.id === id);

test('contract is versioned, inactive, fully identified and keeps the source snapshot', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustFireContractProbe(5, {fixture: 'adjacent', turn: 2});
  assert.equal(validateIronDustFireContractProbe(plain(state)).probeVersion, state.probeVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.deepEqual(state.units.map(value => value.id), IRON_DUST_CORE_DATA_V1.units.map(value => value.id));
  for (const value of state.units) {
    assert.ok(Number.isInteger(value.defense));
    assert.ok(Number.isInteger(value.hp));
    assert.equal(value.disabled, false);
    assert.equal(value.disabledUntil, 0);
    assert.deepEqual(value.passengerIds, []); // IRON DUST has no carriers or passengers.
  }
  assert.deepEqual({x: unit(state, 'guard').x, y: unit(state, 'guard').y}, {x: 2, y: 5});
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
});

test('identified player Fire agrees with the existing Legacy pixel LOS and weapon preflight', () => {
  for (const fixture of ['source', 'adjacent', 'boundary']) {
    const weaponState = fixture === 'boundary' ? dispatchIronDustWeaponProbe(
      createIronDustWeaponProbe(5), {type: 'SelectWeapon', weaponKey: 'missiles'}).state :
      createIronDustWeaponProbe(5);
    const state = createIronDustFireContractProbe(5, {fixture, weaponState});
    const command = fire('guard', weaponState.selectedWeapon);
    const target = unit(state, 'guard');
    const oldState = createIronDustAttackPreflightProbe(5, {
      fixture: fixture === 'boundary' ? 'boundary' : 'source', weaponState
    });
    const oldQuery = queryIronDustAttackProbe(oldState, {type: 'Fire', playerId: 'player',
      unitId: 'ogre', weaponKey: command.weaponKey, target});
    const before = JSON.stringify(state);
    const current = queryIronDustFireContractProbe(state, command);
    assert.equal(current.available, oldQuery.available, fixture);
    assert.equal(current.error?.code, oldQuery.error?.code, fixture);
    assert.equal(current.available, fixture !== 'source', fixture);
    if (current.available) {
      assert.equal(current.targetId, 'guard');
      assert.equal(current.defense, target.defense);
      assert.equal(current.turn, 1);
      assert.equal(current.direction, 'player-to-unit');
    }
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
});

test('incoming system attack has a distinct enemy phase and known system target', () => {
  const enemy = createIronDustFireContractProbe(7,
    {fixture: 'adjacent', side: 'enemy', phase: 'enemy', turn: 3});
  assert.deepEqual(queryIronDustFireContractProbe(enemy, system()), {
    available: true, direction: 'enemy-to-system', attackerId: 'guard',
    targetId: 'ogre', targetKey: 'main', turn: 3
  });
  const source = createIronDustFireContractProbe(7,
    {side: 'enemy', phase: 'enemy'});
  assert.equal(queryIronDustFireContractProbe(source, system()).error.code,
    'SYSTEM_OUT_OF_RANGE');
  assert.equal(queryIronDustFireContractProbe(enemy, fire()).error.code,
    'NOT_ACTIVE_TEAM');
  assert.equal(queryIronDustFireContractProbe(createIronDustFireContractProbe(7,
    {fixture: 'adjacent'}), system()).error.code, 'NOT_ACTIVE_TEAM');
});

test('free targets, missing state fields, wrong direction and invalid phases reject before RNG', () => {
  const state = createIronDustFireContractProbe(5, {fixture: 'adjacent'});
  const before = JSON.stringify(state);
  for (const [command, code] of [
    [fire('ghost'), 'WEAPON_TARGET_INVALID'],
    [fire('ogre'), 'WEAPON_TARGET_INVALID'],
    [{...fire(), target: {id: 'ghost', x: 2, y: 5, hp: 2, team: 'enemy'}},
      'FIRE_CONTRACT_COMMAND_INVALID'],
    [{...fire(), unitId: 'gev'}, 'ATTACK_ACTOR_INVALID'],
    [{...fire(), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM'],
    [{...fire(), weaponKey: 'missiles'}, 'WEAPON_NOT_SELECTED'],
    [{...system(), playerId: 'player'}, 'WRONG_PHASE'],
    [{type: 'Fire', playerId: 'player', unitId: 'ogre'}, 'FIRE_CONTRACT_COMMAND_INVALID']
  ]) {
    const result = queryIronDustFireContractProbe(state, command);
    assert.equal(result.error.code, code);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, 5);
  }
  const movement = createIronDustFireContractProbe(5, {phase: 'movement', fixture: 'adjacent'});
  assert.equal(queryIronDustFireContractProbe(movement, fire()).error.code, 'WRONG_PHASE');
  const secondD = plain(state);
  unit(secondD, 'guard').hp = 0;
  unit(secondD, 'guard').disabled = true;
  unit(secondD, 'guard').disabledUntil = 2;
  assert.doesNotThrow(() => validateIronDustFireContractProbe(secondD));
  assert.equal(queryIronDustFireContractProbe(secondD, fire()).error.code,
    'WEAPON_TARGET_INVALID');
  assert.throws(() => createIronDustFireContractProbe(5, {side: 'enemy', phase: 'fire'}),
    {code: 'FIRE_CONTRACT_SETUP_INVALID'});
  for (const change of [
    value => {delete unit(value, 'guard').defense},
    value => {delete value.turn},
    value => {delete unit(value, 'guard').disabled},
    value => {delete unit(value, 'guard').disabledUntil},
    value => {delete unit(value, 'guard').passengerIds},
    value => {unit(value, 'guard').id = 'ghost'},
    value => {unit(value, 'guard').x = 5},
    value => {value.sourceRuleProfileId = 'other'},
    value => {value.rng.state++}
  ]) {
    const changed = plain(state); change(changed);
    const unchanged = JSON.stringify(changed);
    assert.throws(() => queryIronDustFireContractProbe(changed, fire()),
      {code: 'FIRE_CONTRACT_MISMATCH'});
    assert.equal(JSON.stringify(changed), unchanged);
  }
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
