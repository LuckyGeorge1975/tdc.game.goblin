import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from '../src/core/iron-dust-legacy-los-probe.mjs';
import {CORE_IRON_DUST_GEV_PROBE_CONTRACT} from '../src/core/profile-contract.mjs';
import {supercoverIntermediateHexes} from '../src/core/supercover-line.mjs';
import {createIronDustUnifiedStateProbe, validateIronDustUnifiedStateProbe,
  queryIronDustUnifiedPhase, queryIronDustUnifiedUnit,
  queryIronDustUnifiedGeometry} from '../src/core/iron-dust-unified-state-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const unit = (state, id) => state.units.find(value => value.id === id);

test('exact inactive header and one unit/weapon/system authority preserve source and historical gates', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustUnifiedStateProbe(5);
  assert.equal(validateIronDustUnifiedStateProbe(plain(state)).capabilityVersion,
    state.capabilityVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.equal(Object.hasOwn(state, 'effectiveRules'), false);
  assert.deepEqual(state.units.map(value => value.id), IRON_DUST_CORE_DATA_V1.units.map(value => value.id));
  assert.deepEqual(plain(state.map), plain(IRON_DUST_CORE_DATA_V1.map));
  const ogre = unit(state, 'ogre');
  assert.equal(Object.hasOwn(ogre, 'move'), false);
  assert.equal(Object.hasOwn(ogre, 'damage'), false);
  assert.equal(Object.hasOwn(ogre, 'range'), false);
  assert.equal(Object.hasOwn(state, 'weaponState'), false);
  assert.equal(Object.hasOwn(state, 'systemState'), false);
  assert.equal(Object.hasOwn(state, 'combatRng'), false);
  assert.equal(state.rng.seed, state.rng.state);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('GEV 3+2, source terrain and Legacy boundary LOS project without mutation', () => {
  const source = createIronDustUnifiedStateProbe(5);
  const before = JSON.stringify(source);
  assert.deepEqual(queryIronDustUnifiedPhase(source), {
    activeTeam: 'player', phase: 'movement', turn: 1,
    enemyPassed: [], firedActorIds: [], victory: {status: 'ongoing', winner: null},
    rng: {seed: 5, state: 5}
  });
  assert.deepEqual(queryIronDustUnifiedUnit(source, 'gev'), {
    id: 'gev', team: 'player', x: 2, y: 6, hp: 3,
    disabled: false, disabledUntil: 0, moved: false, fired: false,
    secondMoved: false, movement: 3, firstMove: 3, secondMove: 2,
    attack: 1, range: 3
  });
  const gev = queryIronDustUnifiedUnit(source, 'gev');
  assert.deepEqual([gev.firstMove, gev.secondMove],
    [CORE_IRON_DUST_GEV_PROBE_CONTRACT.effectiveRules.movement.gevFirstMove,
      CORE_IRON_DUST_GEV_PROBE_CONTRACT.effectiveRules.movement.gevSecondMove]);
  const terrain = queryIronDustUnifiedGeometry(source, 'ogre', 'core');
  assert.deepEqual([terrain.terrain, terrain.cover, terrain.entryCost],
    ['rubble-field', 1, 2]);
  assert.equal(JSON.stringify(source), before);

  const boundary = createIronDustUnifiedStateProbe(5, {fixture: 'boundary'});
  const line = queryIronDustUnifiedGeometry(boundary, 'ogre', 'guard');
  assert.deepEqual([line.distance, line.lineOfSight, line.terrain],
    [5, true, 'open-ground']);
  assert.equal(hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1,
    unit(boundary, 'ogre'), unit(boundary, 'guard')), line.lineOfSight);
  const rubble = new Set(boundary.map.terrain.map(cell => `${cell.x},${cell.y}`));
  assert.ok(supercoverIntermediateHexes(unit(boundary, 'ogre'), unit(boundary, 'guard'))
    .some(cell => rubble.has(`${cell.x},${cell.y}`)));
  assert.equal(JSON.stringify(boundary.rng), '{"seed":5,"state":5}');
});

test('valid technical follow-up state derives movement, selected weapon and victory from one roster', () => {
  const state = plain(createIronDustUnifiedStateProbe(3));
  const ogre = unit(state, 'ogre'), systems = ogre.ogreSystems;
  systems.treads = 30;
  systems.selectedWeapon = 'missiles';
  systems.weapons.missiles.remaining = 1;
  ogre.moved = true;
  state.rng.state = 123;
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(state));
  const projection = queryIronDustUnifiedUnit(state, 'ogre');
  assert.deepEqual([projection.movement, projection.attack, projection.range,
    projection.systems.weapons.missiles.remaining,
    projection.systems.weapons.missiles.ready], [2, 6, 5, 1, 1]);
  unit(state, 'core').hp = 0;
  state.victory = {status: 'ended', winner: 'player'};
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(state));
  for (const key of Object.keys(systems.weapons))
    systems.weapons[key].destroyed = systems.weapons[key].count;
  systems.treads = 0;
  ogre.hp = 0;
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(state));
  assert.equal(queryIronDustUnifiedUnit(state, 'ogre').movement, 0);
});

test('missing version, stale derived fields, duplicate authorities and invalid statuses fail closed', () => {
  const baseline = createIronDustUnifiedStateProbe(5, {fixture: 'adjacent'});
  assert.throws(() => createIronDustUnifiedStateProbe(-1),
    {code: 'UNIFIED_STATE_SETUP_INVALID'});
  assert.throws(() => createIronDustUnifiedStateProbe(5, {fixture: 'unknown'}),
    {code: 'UNIFIED_STATE_SETUP_INVALID'});
  for (const [index, change] of [
    state => {delete state.capabilityVersion},
    state => {state.ruleProfileId = 'FIELD_TEST_LEGACY_v1'},
    state => {state.sourceDataVersion = 'other'},
    state => {state.map.terrain[0].type = 'open-ground'},
    state => {state.rng.state = -1},
    state => {state.weaponState = {}},
    state => {unit(state, 'ogre').move = 3},
    state => {unit(state, 'ogre').ogreSystems.weapons.main.attack = 99},
    state => {unit(state, 'ogre').ogreSystems.weapons.main.remaining = 0},
    state => {unit(state, 'ogre').ogreSystems.treads = 0; unit(state, 'ogre').hp = 0},
    state => {unit(state, 'guard').disabled = true},
    state => {unit(state, 'guard').hp = 0; state.victory.winner = 'player'},
    state => {unit(state, 'guard').x = unit(state, 'ogre').x;
      unit(state, 'guard').y = unit(state, 'ogre').y},
    state => {state.activeTeam = 'enemy'},
    state => {state.enemyPassed = ['guard']; state.firedActorIds = ['guard']}
  ].entries()) {
    const state = plain(baseline); change(state);
    const before = JSON.stringify(state);
    assert.throws(() => queryIronDustUnifiedPhase(state),
      {code: 'UNIFIED_STATE_MISMATCH'}, `tamper case ${index}`);
    assert.equal(JSON.stringify(state), before);
  }
  assert.deepEqual(queryIronDustUnifiedUnit(baseline, 'ghost'),
    {error: {code: 'UNIFIED_UNIT_UNKNOWN'}});
  assert.deepEqual(queryIronDustUnifiedGeometry(baseline, 'ogre', 'ghost'),
    {error: {code: 'UNIFIED_UNIT_UNKNOWN'}});
});
