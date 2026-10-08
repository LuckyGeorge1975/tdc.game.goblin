import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';
import {IRON_DUST_REST_OGRE_FIXTURE_VERSION, createIronDustUnifiedStateProbe,
  queryIronDustUnifiedGeometry, validateIronDustUnifiedStateProbe} from
  '../src/core/iron-dust-unified-state-probe.mjs';
import {queryIronDustB3aAction, preflightIronDustB3aAction,
  dispatchIronDustB3aAction} from '../src/core/iron-dust-b3a-action-probe.mjs';

const end = playerId => ({type: 'EndPhase', playerId});
const attack = (attackerId, targetKey) => ({type: 'EnemySystemAttack',
  playerId: 'enemy', attackerId, targetId: 'ogre', targetKey});
const apply = (state, command) => {
  const result = dispatchIronDustB3aAction(state, command);
  assert.ok(result.state, JSON.stringify(result.error));
  return result;
};
const ogre = state => state.units.find(unit => unit.id === 'ogre');
const remaining = weapon => weapon.count - weapon.destroyed;

test('a separate starting roster leaves the original Iron Dust data and replay inactive', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustUnifiedStateProbe(2,
    {fixture: IRON_DUST_REST_OGRE_FIXTURE_VERSION});
  assert.equal(state.fixture, 'iron-dust-rest-ogre-fixture-v1');
  assert.deepEqual(state.units.filter(unit => unit.team === 'player' && unit.hp > 0)
    .map(unit => unit.id), ['ogre']);
  assert.equal(ogre(state).ogreSystems.treads, 45);
  assert.equal(ogre(state).hp, 5);
  for (const id of ['guard', 'raider']) {
    const geometry = queryIronDustUnifiedGeometry(state, id, 'ogre');
    assert.equal(geometry.lineOfSight, true);
    assert.ok(geometry.distance <= state.units.find(unit => unit.id === id).range);
  }
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(state));
  assert.throws(() => createGame(state, 2), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 2, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('only real enemy system commands destroy the last player and end in defeat', () => {
  let state = createIronDustUnifiedStateProbe(2,
    {fixture: IRON_DUST_REST_OGRE_FIXTURE_VERSION});
  let hits = 0;
  for (let turn = 0; state.victory.status === 'ongoing' && turn < 300; turn++) {
    for (let step = 0; step < 3; step++) state = apply(state, end('player')).state;
    for (const actorId of ['guard', 'raider']) {
      if (state.victory.status !== 'ongoing') break;
      const systems = ogre(state).ogreSystems;
      const targetKey = systems.treads > 0 ? 'treads' :
        Object.keys(systems.weapons).find(key => remaining(systems.weapons[key]) > 0);
      assert.ok(targetKey);
      const command = attack(actorId, targetKey), before = JSON.stringify(state);
      assert.deepEqual(preflightIronDustB3aAction(state, command),
        queryIronDustB3aAction(state, command));
      assert.equal(queryIronDustB3aAction(state, command).available, true);
      const result = apply(state, command);
      assert.equal(JSON.stringify(state), before);
      assert.equal(result.events[0].type, 'EnemySystemFireResolved');
      assert.equal(result.state.rng.state,
        (Math.imul(1664525, state.rng.state) + 1013904223) >>> 0);
      state = result.state;
      hits++;
    }
    if (state.victory.status === 'ongoing') state = apply(state, end('enemy')).state;
  }
  assert.ok(hits > 0);
  assert.deepEqual(state.victory, {status: 'ended', winner: 'enemy'});
  assert.equal(ogre(state).hp, 0);
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(state));
  for (const command of [end('enemy'), attack('guard', 'treads')]) {
    const before = JSON.stringify(state);
    assert.deepEqual(queryIronDustB3aAction(state, command),
      {available: false, error: {code: 'GAME_ENDED'}});
    assert.deepEqual(dispatchIronDustB3aAction(state, command),
      {error: {code: 'GAME_ENDED'}});
    assert.equal(JSON.stringify(state), before);
  }
});
