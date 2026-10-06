import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from '../src/core/iron-dust-legacy-los-probe.mjs';
import {createIronDustWeaponProbe, dispatchIronDustWeaponProbe} from '../src/core/iron-dust-weapon-probe.mjs';
import {createIronDustAttackPreflightProbe, validateIronDustAttackPreflightProbe,
  queryIronDustAttackProbe, queryIronDustAttackSurface,
  preflightIronDustFireProbe} from '../src/core/iron-dust-attack-preflight-probe.mjs';
import {hexDistance} from '../src/core/hex.mjs';
import {supercoverIntermediateHexes} from '../src/core/supercover-line.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const target = (x, y, extras = {}) => ({x, y, team: 'enemy', hp: 2, ...extras});
const fire = (weaponKey, targetValue) => ({type: 'Fire', playerId: 'player',
  unitId: 'ogre', weaponKey, target: targetValue});

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`), opening = text.indexOf('{', start);
  assert.ok(start >= 0 && opening > start, name);
  let depth = 0;
  for (let i = opening; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`unclosed Legacy function ${name}`);
}

function legacyAllowed(state, command) {
  const context = vm.createContext({dist: hexDistance,
    lineOfSight: (from, to) => hasIronDustLegacyLineOfSight(
      IRON_DUST_LEGACY_LOS_PROBE_V1, from, to)});
  vm.runInContext(readFileSync(new URL('../ogre-systems.js', import.meta.url), 'utf8'), context);
  const code = readFileSync(new URL('../siegebreaker-weapons.js', import.meta.url), 'utf8');
  vm.runInContext(['stateFor', 'targetAllowed'].map(name =>
    extractFunction(code, name)).join('\n'), context);
  const attacker = {...plain(state.attacker), ogreSystems: {
    selectedWeapon: state.weaponState.selectedWeapon,
    weapons: plain(state.weaponState.weapons)
  }};
  return !!vm.runInContext('targetAllowed', context)(attacker, command.target, command.weaponKey);
}

function selectedState(key, seed = 5) {
  const initial = createIronDustWeaponProbe(seed);
  return key === 'main' ? initial : dispatchIronDustWeaponProbe(initial,
    {type: 'SelectWeapon', weaponKey: key}).state;
}

test('the integrated header is inactive and preserves both source probes', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustAttackPreflightProbe(5);
  assert.equal(validateIronDustAttackPreflightProbe(plain(state)).probeVersion,
    state.probeVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.equal(state.losProbeVersion, IRON_DUST_LEGACY_LOS_PROBE_V1.probeVersion);
  assert.equal(state.weaponProbeVersion, state.weaponState.probeVersion);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
});

test('per-weapon Query and Fire preflight equal Legacy readiness, range, LOS and class', () => {
  const vectors = [
    ['main', target(2, 5), true],
    ['main', target(10, 2), false],
    ['secondary', target(2, 5), true],
    ['secondary', target(0, 4), false],
    ['missiles', target(2, 5), true],
    ['antipersonnel', target(1, 4, {infantry: true}), true],
    ['antipersonnel', target(1, 4, {engineering: true}), true],
    ['antipersonnel', target(1, 4, {infantry: false}), false],
    ['main', target(2, 5, {team: 'player'}), false],
    ['main', target(2, 5, {hp: 0}), false]
  ];
  for (const [key, goal, expected] of vectors) {
    const state = createIronDustAttackPreflightProbe(5,
      {weaponState: selectedState(key)});
    const command = fire(key, goal), before = JSON.stringify(state);
    const query = queryIronDustAttackProbe(state, command);
    const preflight = preflightIronDustFireProbe(state, command);
    assert.deepEqual(preflight, query, key);
    assert.equal(query.available, expected, key);
    assert.equal(legacyAllowed(state, command), expected, key);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.weaponState.rng.state, 5);
  }
  const blocked = createIronDustAttackPreflightProbe(5,
    {weaponState: selectedState('secondary')});
  assert.equal(queryIronDustAttackProbe(blocked,
    fire('secondary', target(0, 4))).error.code, 'WEAPON_SIGHT_BLOCKED');
  assert.equal(queryIronDustAttackProbe(blocked,
    fire('secondary', target(10, 2))).error.code, 'WEAPON_OUT_OF_RANGE');
  const candidates = [target(2, 5), target(0, 4), target(10, 2)];
  assert.deepEqual(queryIronDustAttackSurface(blocked, candidates), {
    weaponKey: 'secondary', entries: candidates.map((goal, index) => ({index,
      ...preflightIronDustFireProbe(blocked, fire('secondary', goal))}))
  });
  assert.equal(queryIronDustAttackProbe(createIronDustAttackPreflightProbe(5,
    {weaponState: selectedState('antipersonnel')}),
  fire('antipersonnel', target(1, 4))).error.code, 'WEAPON_INFANTRY_ONLY');
});

test('Legacy boundary LOS remains free although strict supercover blocks it', () => {
  const state = createIronDustAttackPreflightProbe(5,
    {fixture: 'boundary', weaponState: selectedState('missiles')});
  const goal = target(6, 1), command = fire('missiles', goal);
  const before = JSON.stringify(state);
  assert.equal(hexDistance(state.attacker, goal), 5);
  assert.equal(legacyAllowed(state, command), true);
  assert.equal(hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1,
    state.attacker, goal), true);
  const blocked = new Set(IRON_DUST_LEGACY_LOS_PROBE_V1.map.terrain
    .map(cell => `${cell.x},${cell.y}`));
  assert.ok(supercoverIntermediateHexes(state.attacker, goal)
    .some(cell => blocked.has(`${cell.x},${cell.y}`)));
  assert.deepEqual(queryIronDustAttackProbe(state, command),
    {available: true, attack: 6, range: 5, ready: 2,
      losMode: 'legacy-pixel-sample-8-v1'});
  assert.deepEqual(preflightIronDustFireProbe(state, command),
    queryIronDustAttackProbe(state, command));
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(queryIronDustAttackSurface(state, [goal]), {
    weaponKey: 'missiles', entries: [{index: 0,
      ...preflightIronDustFireProbe(state, command)}]
  });
});

test('depleted budgets, phase and actor errors reject without state or RNG mutation', () => {
  const spentMain = dispatchIronDustWeaponProbe(createIronDustWeaponProbe(5),
    {type: 'SpendWeaponBudget', weaponKey: 'main'}).state;
  const spent = createIronDustAttackPreflightProbe(5, {weaponState: spentMain});
  const base = createIronDustAttackPreflightProbe(5);
  const movement = createIronDustAttackPreflightProbe(5, {phase: 'movement'});
  for (const [state, command, code] of [
    [spent, fire('main', target(2, 5)), 'WEAPON_NOT_READY'],
    [base, fire('secondary', target(2, 5)), 'WEAPON_NOT_SELECTED'],
    [movement, fire('main', target(2, 5)), 'WRONG_PHASE'],
    [base, {...fire('main', target(2, 5)), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM'],
    [base, {...fire('main', target(2, 5)), unitId: 'gev'}, 'ATTACK_ACTOR_INVALID'],
    [base, {type: 'Move', playerId: 'player', unitId: 'ogre'}, 'ATTACK_COMMAND_INVALID'],
    [base, fire('main', target(-1, 5)), 'WEAPON_TARGET_INVALID']
  ]) {
    const before = JSON.stringify(state);
    assert.deepEqual(queryIronDustAttackProbe(state, command), {available: false, error: {code}});
    assert.deepEqual(preflightIronDustFireProbe(state, command),
      queryIronDustAttackProbe(state, command));
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.weaponState.rng.state, 5);
  }
  assert.deepEqual(queryIronDustAttackSurface(base, null),
    {error: {code: 'ATTACK_TARGET_SET_INVALID'}});
});

test('tampered composition rejects before any Fire preflight', () => {
  assert.throws(() => createIronDustAttackPreflightProbe(-1),
    {code: 'ATTACK_PREFLIGHT_SETUP_INVALID'});
  assert.throws(() => createIronDustAttackPreflightProbe(5, {fixture: 'unknown'}),
    {code: 'ATTACK_PREFLIGHT_SETUP_INVALID'});
  for (const change of [
    state => {state.probeVersion = 'other'},
    state => {state.losProbeVersion = 'strict-supercover'},
    state => {state.attacker.x = 8},
    state => {state.weaponState.weapons.main.attack = 99},
    state => {state.weaponState.rng.state++}
  ]) {
    const state = plain(createIronDustAttackPreflightProbe(5));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => preflightIronDustFireProbe(state, fire('main', target(2, 5))),
      /MISMATCH/);
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
