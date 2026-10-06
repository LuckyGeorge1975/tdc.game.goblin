import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import TerrainRules from '../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_NEAR_CORE_FIXTURE_VERSION, createIronDustUnifiedStateProbe,
  validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {createGame, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';
import {queryIronDustB3bAction, preflightIronDustB3bAction,
  dispatchIronDustB3bAction} from '../src/core/iron-dust-b3b-action-probe.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const unit = (state, id) => state.units.find(value => value.id === id);
const end = playerId => ({type: 'EndPhase', playerId});
const fire = (weaponKey = 'main') => ({type: 'PlayerFire', playerId: 'player',
  unitId: 'ogre', targetId: 'core', weaponKey});
const near = seed => createIronDustUnifiedStateProbe(seed,
  {fixture: IRON_DUST_NEAR_CORE_FIXTURE_VERSION});
const inFire = seed => dispatchIronDustB3bAction(near(seed), end('player')).state;

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

test('near-core X is a real Legacy-parity hit and ends only the technical game', () => {
  const sourceBefore = JSON.stringify(IRON_DUST_CORE_DATA_V1);
  const state = inFire(2), before = JSON.stringify(state);
  assert.equal(state.fixture, 'iron-dust-near-core-fixture-v1');
  assert.deepEqual({x: unit(state, 'ogre').x, y: unit(state, 'ogre').y}, {x: 10, y: 1});
  assert.deepEqual({x: unit(state, 'core').x, y: unit(state, 'core').y}, {x: 10, y: 2});
  assert.equal(state.executable, false);
  assert.throws(() => createGame(state, 2), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(state, 2, []), {code: 'REPLAY_PROFILE_MISMATCH'});
  const query = queryIronDustB3bAction(state, fire());
  assert.deepEqual(preflightIronDustB3bAction(state, fire()), query);
  assert.deepEqual(query, {available: true, attack: 4, range: 3, ready: 1,
    losMode: 'legacy-pixel-sample-8-v1', direction: 'player-to-unit', targetId: 'core',
    defense: 5, turn: 1, passengerIds: []});
  const context = legacy(), legacyCore = plain(unit(state, 'core'));
  context.Math.random = () => 5 / 6;
  const actual = context.combatOutcome({team: 'player', damage: query.attack}, legacyCore);
  const resolved = dispatchIronDustB3bAction(state, fire());
  assert.deepEqual([resolved.events[0].ratio, resolved.events[0].roll,
    resolved.events[0].result], [actual.ratio, actual.roll, actual.result]);
  assert.deepEqual([resolved.events[0].hp, resolved.events[0].disabled,
    resolved.events[0].disabledUntil],
  [legacyCore.hp, legacyCore.disabled, legacyCore.disabledUntil]);
  assert.deepEqual(resolved.events, [{type: 'PlayerFireResolved', attackerId: 'ogre',
    targetId: 'core', weaponKey: 'main', ratio: '1-1', roll: 5, result: 'X',
    effectiveDefense: 6, hp: 0, disabled: false, disabledUntil: 0,
    passengerIds: [], readyBefore: 1, readyAfter: 0,
    selectedWeaponAfter: 'secondary', turn: 1}]);
  assert.deepEqual(resolved.state.victory, {status: 'ended', winner: 'player'});
  assert.equal(unit(resolved.state, 'core').hp, 0);
  assert.equal(unit(resolved.state, 'guard').hp, 3);
  assert.equal(unit(resolved.state, 'raider').hp, 2);
  assert.equal(resolved.state.rng.state, (Math.imul(1664525, 2) + 1013904223) >>> 0);
  assert.equal(JSON.stringify(state), before);
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(plain(resolved.state)));
  assert.equal(JSON.stringify(IRON_DUST_CORE_DATA_V1), sourceBefore);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});

test('a real D leaves play ongoing and a second D can destroy the core', () => {
  let state = inFire(10);
  const context = legacy(), legacyCore = plain(unit(state, 'core'));
  context.Math.random = () => 3 / 6;
  const oldFirst = context.combatOutcome({team: 'player', damage: 4}, legacyCore);
  const first = dispatchIronDustB3bAction(state, fire());
  assert.equal(first.events[0].result, 'D');
  assert.deepEqual([first.events[0].ratio, first.events[0].roll, first.events[0].result,
    first.events[0].hp, first.events[0].disabledUntil],
  [oldFirst.ratio, oldFirst.roll, oldFirst.result, legacyCore.hp, legacyCore.disabledUntil]);
  assert.equal(first.state.victory.status, 'ongoing');
  assert.equal(unit(first.state, 'core').disabled, true);
  state = first.state;
  context.Math.random = () => 2 / 6;
  const oldSecond = context.combatOutcome({team: 'player', damage: 3}, legacyCore);
  const second = dispatchIronDustB3bAction(state, fire('secondary'));
  assert.equal(second.events[0].result, 'D');
  assert.equal(second.events[0].roll, 2);
  assert.deepEqual([second.events[0].ratio, second.events[0].roll, second.events[0].result,
    second.events[0].hp, second.events[0].disabledUntil],
  [oldSecond.ratio, oldSecond.roll, oldSecond.result, legacyCore.hp, legacyCore.disabledUntil]);
  assert.equal(unit(second.state, 'core').hp, 0);
  assert.deepEqual(second.state.victory, {status: 'ended', winner: 'player'});
  assert.equal(second.state.rng.state,
    (Math.imul(1664525, state.rng.state) + 1013904223) >>> 0);
});

test('core fire is fixture-bound and every command rejects after terminal victory without mutation', () => {
  const source = dispatchIronDustB3bAction(createIronDustUnifiedStateProbe(2), end('player')).state;
  const movement = near(2), fireState = inFire(2);
  const ended = dispatchIronDustB3bAction(fireState, fire()).state;
  for (const [state, command, code] of [
    [source, fire(), 'B3B_CORE_FIXTURE_UNSUPPORTED'],
    [movement, fire(), 'WRONG_PHASE'],
    [fireState, {...fire(), unitId: 'gev'}, 'ATTACK_ACTOR_INVALID'],
    [fireState, {...fire(), weaponKey: 'missiles'}, 'WEAPON_NOT_SELECTED'],
    [ended, fire(), 'GAME_ENDED'],
    [ended, end('player'), 'GAME_ENDED'],
    [ended, {type: 'SelectWeapon', playerId: 'player', unitId: 'ogre',
      weaponKey: 'secondary'}, 'GAME_ENDED'],
    [ended, {type: 'Move', playerId: 'player', unitId: 'gev',
      to: {x: 2, y: 7}}, 'GAME_ENDED']
  ]) {
    const before = JSON.stringify(state), rng = state.rng.state;
    const expected = {available: false, error: {code}};
    assert.deepEqual(queryIronDustB3bAction(state, command), expected);
    assert.deepEqual(preflightIronDustB3bAction(state, command), expected);
    assert.deepEqual(dispatchIronDustB3bAction(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.rng.state, rng);
  }
});
