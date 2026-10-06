import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import TerrainRules from '../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createIronDustWeaponProbe, dispatchIronDustWeaponProbe} from '../src/core/iron-dust-weapon-probe.mjs';
import {createIronDustPlayerFireProbe, validateIronDustPlayerFireProbe,
  queryIronDustPlayerFireProbe, preflightIronDustPlayerFireProbe,
  dispatchIronDustPlayerFireProbe} from '../src/core/iron-dust-player-fire-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const fire = (targetId = 'guard', weaponKey = 'main') =>
  ({type: 'PlayerFire', playerId: 'player', unitId: 'ogre', targetId, weaponKey});
const unit = (state, id) => state.contract.units.find(value => value.id === id);
const weapon = (state, key) => state.contract.weaponState.weapons[key];

function extract(text, name) {
  const start = text.lastIndexOf(`function ${name}(`), opening = text.indexOf('{', start);
  assert.ok(start >= 0 && opening > start, name);
  let depth = 0;
  for (let i = opening; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`unclosed ${name}`);
}

function legacy() {
  const text = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  const crtStart = text.indexOf('const COMBAT_RULES='), crtEnd = text.indexOf(';const units', crtStart);
  const map = IRON_DUST_CORE_DATA_V1.map;
  const context = vm.createContext({TerrainRules, turn: 1, carrierCargo: () => [],
    terrainTypeAt: (x, y) => map.terrain.find(cell => cell.x === x && cell.y === y)?.type ??
      map.defaultTerrain,
    Math: Object.assign(Object.create(Math), {random: () => 0})});
  vm.runInContext(`${text.slice(crtStart, crtEnd + 1)}\n${['combatRatio', 'effectiveDefense',
    'applyCombatRoll', 'combatOutcome'].map(name => extract(text, name)).join('\n')}`, context);
  return context;
}

test('inactive PlayerFire probe stays outside Core, replay and original data', () => {
  const before = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = createIronDustPlayerFireProbe(5, {fixture: 'adjacent'});
  assert.equal(validateIronDustPlayerFireProbe(plain(state)).probeVersion, state.probeVersion);
  assert.equal(state.executable, false);
  assert.equal(Object.hasOwn(state, 'rulesVersion'), false);
  assert.throws(() => createGame(state, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), before);
});

test('fixed seed NE, D and X vectors match Legacy roll, target state and weapon budget', () => {
  const context = legacy();
  for (const [seed, roll, result, hp, disabled, disabledUntil] of [
    [0, 1, 'NE', 3, false, 0],
    [3, 4, 'D', 3, true, 2],
    [2, 5, 'X', 0, false, 0]
  ]) {
    const initial = createIronDustPlayerFireProbe(seed, {fixture: 'adjacent'});
    const command = fire(), before = JSON.stringify(initial);
    const query = queryIronDustPlayerFireProbe(initial, command);
    assert.deepEqual(preflightIronDustPlayerFireProbe(initial, command), query);
    assert.equal(query.available, true);
    const {state, events: [event]} = dispatchIronDustPlayerFireProbe(initial, command);
    const legacyTarget = plain(unit(initial, 'guard'));
    context.Math.random = () => roll / 6;
    const legacyAttacker = {team: 'player', damage: query.attack};
    const actual = context.combatOutcome(legacyAttacker, legacyTarget);
    assert.deepEqual([event.ratio, event.roll, event.result],
      [actual.ratio, actual.roll, actual.result]);
    assert.deepEqual([event.hp, event.disabled, event.disabledUntil],
      [legacyTarget.hp, legacyTarget.disabled, legacyTarget.disabledUntil]);
    assert.deepEqual([event.roll, event.result, event.hp, event.disabled, event.disabledUntil],
      [roll, result, hp, disabled, disabledUntil]);
    assert.deepEqual(event, {type: 'PlayerFireResolved', attackerId: 'ogre',
      targetId: 'guard', weaponKey: 'main', ratio: '1-1', roll, result,
      effectiveDefense: 3, hp, disabled, disabledUntil, passengerIds: [],
      readyBefore: 1, readyAfter: 0, selectedWeaponAfter: 'secondary', turn: 1});
    assert.equal(event.readyBefore, 1);
    assert.equal(event.readyAfter, 0);
    assert.equal(event.selectedWeaponAfter, 'secondary');
    assert.equal(weapon(state, 'main').firedThisPhase, 1);
    assert.equal(state.combatRng.state, (Math.imul(1664525, seed) + 1013904223) >>> 0);
    assert.equal(state.contract.rng.state, seed);
    assert.equal(JSON.stringify(initial), before);
  }
});

test('second D destroys a disabled target; missiles expend ammunition and keep Legacy LOS', () => {
  let state = createIronDustPlayerFireProbe(10, {fixture: 'adjacent'});
  const first = dispatchIronDustPlayerFireProbe(state, fire());
  state = first.state;
  assert.equal(unit(state, 'guard').disabled, true);
  const second = dispatchIronDustPlayerFireProbe(state, fire('guard', 'secondary'));
  assert.equal(second.events[0].result, 'D');
  assert.equal(unit(second.state, 'guard').hp, 0);
  assert.equal(second.events[0].disabledUntil, 2);

  const missiles = dispatchIronDustWeaponProbe(createIronDustWeaponProbe(2),
    {type: 'SelectWeapon', weaponKey: 'missiles'}).state;
  const boundary = createIronDustPlayerFireProbe(2, {fixture: 'boundary', weaponState: missiles});
  const shot = dispatchIronDustPlayerFireProbe(boundary, fire('guard', 'missiles'));
  assert.equal(shot.events[0].roll, 5);
  assert.equal(shot.events[0].result, 'X');
  assert.equal(shot.events[0].ratio, '2-1');
  assert.equal(weapon(shot.state, 'missiles').remaining, 1);
  assert.equal(shot.events[0].readyAfter, 1);
  assert.equal(shot.state.contract.weaponState.selectedWeapon, 'missiles');
});

test('Query, preflight and dispatch reject the same target, phase and weapon cases without mutation', () => {
  const base = createIronDustPlayerFireProbe(5, {fixture: 'adjacent'});
  const movement = createIronDustPlayerFireProbe(5, {fixture: 'adjacent', phase: 'movement'});
  const source = createIronDustPlayerFireProbe(5);
  const spentWeapon = dispatchIronDustWeaponProbe(createIronDustWeaponProbe(5),
    {type: 'SpendWeaponBudget', weaponKey: 'main'}).state;
  const spent = createIronDustPlayerFireProbe(5, {fixture: 'adjacent', weaponState: spentWeapon});
  for (const [state, command, code] of [
    [base, fire('ghost'), 'WEAPON_TARGET_INVALID'],
    [base, fire('ogre'), 'WEAPON_TARGET_INVALID'],
    [base, {...fire(), target: {id: 'guard'}}, 'FIRE_CONTRACT_COMMAND_INVALID'],
    [base, fire('guard', 'missiles'), 'WEAPON_NOT_SELECTED'],
    [movement, fire(), 'WRONG_PHASE'],
    [source, fire(), 'WEAPON_OUT_OF_RANGE'],
    [spent, fire(), 'WEAPON_NOT_READY'],
    [base, {...fire(), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM'],
    [base, {type: 'EnemySystemAttack', playerId: 'enemy', attackerId: 'guard',
      targetId: 'ogre', targetKey: 'main'}, 'NOT_ACTIVE_TEAM']
  ]) {
    const before = JSON.stringify(state);
    assert.deepEqual(queryIronDustPlayerFireProbe(state, command),
      {available: false, error: {code}});
    assert.deepEqual(preflightIronDustPlayerFireProbe(state, command),
      queryIronDustPlayerFireProbe(state, command));
    assert.deepEqual(dispatchIronDustPlayerFireProbe(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.combatRng.state, state.combatRng.seed);
  }
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
