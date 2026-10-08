import test from 'node:test';
import assert from 'node:assert/strict';
import {createIronDustUnifiedStateProbe, createIronDustZeroTreadsUnifiedStateProbe,
  validateIronDustUnifiedStateProbe,
  IRON_DUST_ZERO_TREADS_STATE_VERSION, IRON_DUST_ZERO_TREADS_POLICY_VERSION}
  from '../src/core/iron-dust-unified-state-probe.mjs';
import {queryIronDustEnemyIntent, IRON_DUST_ENEMY_INTENT_VERSION,
  IRON_DUST_ZERO_TREADS_ENEMY_INTENT_VERSION}
  from '../src/core/iron-dust-enemy-intent-probe.mjs';
import {queryIronDustB3aAction, dispatchIronDustB3aAction}
  from '../src/core/iron-dust-b3a-action-probe.mjs';
import {createIronDustEnemyTurnController, queryIronDustEnemyTurnController,
  dispatchIronDustEnemyTurnController,
  IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION}
  from '../src/core/iron-dust-enemy-turn-controller-probe.mjs';
import {createIronDustSourceActionEntry, createIronDustZeroTreadsSourceActionEntry,
  validateIronDustSourceActionEntry, dispatchIronDustSourceActionEntry,
  IRON_DUST_SOURCE_ACTION_ENTRY_VERSION,
  IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION}
  from '../src/core/iron-dust-source-action-entry-probe.mjs';

const clone = value => structuredClone(value);
const unit = (state, id) => state.units.find(item => item.id === id);
const intent = {type: 'EnemyIntent', playerId: 'enemy', actorId: 'guard',
  stage: 'first-fire', claim: 'auto'};
const advance = {type: 'AdvanceEnemyTurn', playerId: 'enemy'};
const systemFire = targetKey => ({type: 'EnemySystemAttack', playerId: 'enemy',
  attackerId: 'guard', targetId: 'ogre', targetKey});

function sourceAtZero(seed, corrected) {
  const state = clone(corrected ? createIronDustZeroTreadsUnifiedStateProbe(seed) :
    createIronDustUnifiedStateProbe(seed, {fixture: 'source'}));
  state.activeTeam = 'enemy';
  state.phase = 'enemy';
  const ogre = unit(state, 'ogre');
  ogre.ogreSystems.treads = 0;
  for (const [key, weapon] of Object.entries(ogre.ogreSystems.weapons))
    if (key !== 'antipersonnel') weapon.destroyed = weapon.count;
  unit(state, 'guard').x = 1;
  unit(state, 'guard').y = 4;
  unit(state, 'raider').x = 2;
  unit(state, 'raider').y = 5;
  validateIronDustUnifiedStateProbe(state);
  return state;
}

test('versioned source entry carries corrected rule through the enemy controller', () => {
  const historical = createIronDustSourceActionEntry(2);
  const corrected = createIronDustZeroTreadsSourceActionEntry(2);
  assert.equal(historical.entryVersion, IRON_DUST_SOURCE_ACTION_ENTRY_VERSION);
  assert.equal(corrected.entryVersion,
    IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION);
  assert.equal(corrected.executable, false);
  assert.equal(corrected.payload.capabilityVersion, IRON_DUST_ZERO_TREADS_STATE_VERSION);
  assert.equal(corrected.payload.targetPolicyVersion,
    IRON_DUST_ZERO_TREADS_POLICY_VERSION);
  let entry = corrected;
  for (let i = 0; i < 3; i++) {
    const result = dispatchIronDustSourceActionEntry(entry,
      {type: 'EndPhase', playerId: 'player'});
    assert.ok(result.entry);
    entry = result.entry;
    assert.equal(entry.entryVersion, IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION);
    validateIronDustSourceActionEntry(entry);
  }
  assert.equal(entry.mode, 'enemy');
  assert.equal(entry.payload.controllerVersion,
    IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION);
  const step = dispatchIronDustSourceActionEntry(entry,
    {type: 'AutoEnemyAdvance', playerId: 'enemy'});
  assert.ok(step.entry);
  assert.equal(step.entry.entryVersion,
    IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION);
  validateIronDustSourceActionEntry(step.entry);
});

test('zero treads selects Antipersonnel, spends one roll and excludes futile tread fire', () => {
  const state = sourceAtZero(2, true);
  const before = JSON.stringify(state);
  const proposed = queryIronDustEnemyIntent(state, intent);
  assert.equal(proposed.resolverVersion,
    IRON_DUST_ZERO_TREADS_ENEMY_INTENT_VERSION);
  assert.equal(proposed.command.targetKey, 'antipersonnel');
  assert.equal(proposed.targetId, 'ogre');
  assert.equal(JSON.stringify(state), before);
  const query = queryIronDustB3aAction(state, systemFire('antipersonnel'));
  assert.equal(query.available, true);
  assert.equal(query.availableSystemTargets.includes('treads'), false);
  assert.equal(queryIronDustB3aAction(state, systemFire('treads')).error.code,
    'SYSTEM_TARGET_INVALID');
  const controller = createIronDustEnemyTurnController(state);
  assert.equal(controller.controllerVersion,
    IRON_DUST_ZERO_TREADS_ENEMY_TURN_CONTROLLER_VERSION);
  const action = queryIronDustEnemyTurnController(controller, advance);
  assert.equal(action.available, true);
  assert.equal(action.action.command.targetKey, 'antipersonnel');
  assert.equal(JSON.stringify(controller.state), before);
  const resolved = dispatchIronDustEnemyTurnController(controller, advance);
  assert.equal(resolved.events.length, 1);
  assert.equal(resolved.events[0].targetKey, 'antipersonnel');
  assert.equal(resolved.events[0].roll, 5);
  assert.equal(resolved.events[0].result, 'X');
  assert.equal(resolved.controller.state.units.find(u => u.id === 'ogre')
    .ogreSystems.weapons.antipersonnel.destroyed, 1);
  assert.equal(resolved.controller.state.rng.state,
    (Math.imul(1664525, state.rng.state) + 1013904223) >>> 0);
  assert.equal(JSON.stringify(state), before);
});

test('version 1 keeps its historical target choice while version 2 rejects drift', () => {
  const old = sourceAtZero(2, false);
  const historical = queryIronDustEnemyIntent(old, intent);
  assert.equal(historical.resolverVersion, IRON_DUST_ENEMY_INTENT_VERSION);
  assert.equal(historical.command.targetKey, 'treads');
  assert.equal(queryIronDustB3aAction(old, systemFire('treads')).available, true);
  const oldShot = dispatchIronDustB3aAction(old, systemFire('treads'));
  assert.equal(oldShot.events[0].targetKey, 'treads');
  assert.equal(oldShot.events[0].loss, 0);
  const corrected = sourceAtZero(2, true);
  const oneTread = clone(corrected);
  unit(oneTread, 'ogre').ogreSystems.treads = 1;
  validateIronDustUnifiedStateProbe(oneTread);
  assert.equal(queryIronDustEnemyIntent(oneTread, intent).command.targetKey,
    'treads');
  assert.equal(queryIronDustB3aAction(oneTread, systemFire('treads')).available,
    true);
  const before = JSON.stringify(corrected);
  assert.deepEqual(dispatchIronDustB3aAction(corrected, systemFire('treads')),
    {error: {code: 'SYSTEM_TARGET_INVALID'}});
  assert.equal(JSON.stringify(corrected), before);
  const forged = clone(corrected);
  forged.targetPolicyVersion = 'other';
  assert.throws(() => validateIronDustUnifiedStateProbe(forged),
    {code: 'UNIFIED_STATE_MISMATCH'});
  const controller = createIronDustEnemyTurnController(corrected);
  const mismatch = clone(controller);
  mismatch.controllerVersion = 'iron-dust-enemy-turn-controller-v1';
  assert.equal(queryIronDustEnemyTurnController(mismatch, advance).error.code,
    'ENEMY_CONTROLLER_STATE_MISMATCH');
  const oldEntry = createIronDustSourceActionEntry(2);
  const forgedEntry = clone(oldEntry);
  forgedEntry.entryVersion = IRON_DUST_ZERO_TREADS_SOURCE_ACTION_ENTRY_VERSION;
  assert.throws(() => validateIronDustSourceActionEntry(forgedEntry),
    {code: 'SOURCE_ENTRY_STATE_MISMATCH'});
});
