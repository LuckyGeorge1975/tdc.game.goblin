import test from 'node:test';
import assert from 'node:assert/strict';
import {createIronDustSourceActionEntry, validateIronDustSourceActionEntry,
  queryIronDustSourceActionEntry as query, preflightIronDustSourceActionEntry as preflight,
  dispatchIronDustSourceActionEntry as dispatch} from
  '../src/core/iron-dust-source-action-entry-probe.mjs';
import {queryIronDustB1Action} from '../src/core/iron-dust-b1-action-probe.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const unit = (entry, id) => (entry.mode === 'enemy' ? entry.payload.state : entry.payload)
  .units.find(value => value.id === id);
const state = entry => entry.mode === 'enemy' ? entry.payload.state : entry.payload;
const end = {type: 'EndPhase', playerId: 'player'};
const advance = {type: 'AutoEnemyAdvance', playerId: 'enemy'};
const move = (unitId, x, y) => ({type: 'Move', playerId: 'player', unitId,
  to: {x, y}});
const fire = (unitId, targetId, weaponKey) => ({type: 'PlayerFire',
  playerId: 'player', unitId, targetId,
  ...(weaponKey ? {weaponKey} : {})});
function apply(entry, command) {
  const q = query(entry, command);
  assert.deepEqual(preflight(entry, command), q);
  assert.equal(q.available, true, JSON.stringify(q.error));
  const result = dispatch(entry, command);
  assert.ok(result.entry, JSON.stringify(result.error));
  assert.doesNotThrow(() => validateIronDustSourceActionEntry(result.entry));
  return result;
}
function reject(entry, command, code) {
  const before = JSON.stringify(entry);
  const q = query(entry, command);
  assert.deepEqual(q, {available: false, error: {code}});
  assert.deepEqual(preflight(entry, command), q);
  assert.deepEqual(dispatch(entry, command), {error: {code}});
  assert.equal(JSON.stringify(entry), before);
}
function enterEnemy(entry) {
  for (let i = 0; i < 3; i++) entry = apply(entry, end).entry;
  assert.equal(entry.mode, 'enemy');
  return entry;
}
function finishEnemy(entry) {
  const actions = [];
  while (entry.mode === 'enemy') {
    const q = query(entry, advance);
    actions.push(q.action);
    entry = apply(entry, advance).entry;
  }
  return {entry, actions};
}

test('one source state carries all four player moves and the five-step enemy controller', () => {
  let entry = createIronDustSourceActionEntry(1);
  assert.equal(entry.executable, false);
  assert.equal(entry.mode, 'player');
  for (const [actor, x, y] of [['ogre', 2, 5], ['gev', 2, 7],
    ['missile', 4, 6], ['infantry', 0, 6]]) {
    entry = apply(entry, move(actor, x, y)).entry;
    assert.deepEqual([unit(entry, actor).x, unit(entry, actor).y], [x, y]);
  }
  entry = enterEnemy(entry);
  assert.equal(Object.hasOwn(entry, 'state'), false);
  assert.equal(entry.payload.cursor.pass, 'first');
  const {entry: next, actions} = finishEnemy(entry);
  assert.deepEqual(actions.map(action => action.kind),
    ['move', 'move', 'pass', 'pass', 'end-phase']);
  assert.deepEqual(actions.slice(0, 2).map(action => action.to),
    [{x: 8, y: 4}, {x: 8, y: 6}]);
  assert.deepEqual([next.mode, state(next).turn, state(next).phase,
    state(next).rng.state], ['player', 2, 'movement', 1]);
  reject(next, advance, 'WRONG_PHASE');
});

test('direct enemy diagnostics never cross the source entry', () => {
  let entry = enterEnemy(createIronDustSourceActionEntry(1));
  const direct = {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'};
  assert.equal(queryIronDustB1Action(entry.payload.state, direct).available, true);
  for (const command of [direct,
    {type: 'EnemySystemAttack', playerId: 'enemy'},
    {type: 'EnemyUnitAttack', playerId: 'enemy'},
    {type: 'EnemyMove', playerId: 'enemy'},
    {type: 'EnemyHold', playerId: 'enemy'},
    {type: 'EnemyIntent', playerId: 'enemy'},
    {type: 'AdvanceEnemyTurn', playerId: 'enemy'},
    {type: 'EndPhase', playerId: 'enemy'}]) {
    reject(entry, command, command.type === 'EndPhase'
      ? 'NOT_ACTIVE_TEAM' : 'SOURCE_ENTRY_COMMAND_UNSUPPORTED');
  }
  for (const command of [move('ogre', 2, 5), fire('ogre', 'core', 'main'), end])
    reject(entry, command, 'WRONG_PHASE');
  const before = JSON.stringify(entry);
  entry = apply(entry, advance).entry;
  assert.notEqual(JSON.stringify(entry), before);
});

test('source Ogre core fire reaches terminal state through this entry', () => {
  let entry = createIronDustSourceActionEntry(8);
  for (const x of [3, 6, 9]) {
    entry = apply(entry, move('ogre', x, 2)).entry;
    entry = apply(entry, end).entry;
    if (x === 9) break;
    entry = apply(entry, end).entry;
    entry = apply(entry, end).entry;
    assert.equal(entry.mode, 'enemy');
    entry = finishEnemy(entry).entry;
  }
  assert.deepEqual([entry.mode, state(entry).turn, state(entry).phase,
    unit(entry, 'ogre').x, unit(entry, 'ogre').y], ['player', 3, 'fire', 9, 2]);
  const beforeRng = state(entry).rng.state;
  const result = apply(entry, fire('ogre', 'core', 'main'));
  assert.deepEqual([result.events[0].roll, result.events[0].result,
    result.events[0].hp, result.events[0].readyAfter], [5, 'X', 0, 0]);
  assert.equal(result.entry.mode, 'ended');
  assert.deepEqual(state(result.entry).victory, {status: 'ended', winner: 'player'});
  assert.equal(state(result.entry).rng.state,
    (Math.imul(1664525, beforeRng) + 1013904223) >>> 0);
  for (const command of [end, advance, fire('ogre', 'core', 'main')])
    reject(result.entry, command, 'GAME_ENDED');
});

test('schema, actor, phase and drift gates reject without changing RNG', () => {
  const entry = createIronDustSourceActionEntry(2);
  for (const [command, code] of [
    [advance, 'WRONG_PHASE'],
    [move('core', 2, 5), 'SOURCE_ENTRY_ACTOR_INVALID'],
    [{...move('ogre', 2, 5), extra: true}, 'SOURCE_ENTRY_COMMAND_INVALID'],
    [{...move('ogre', 2, 5), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM'],
    [move('ogre', 10, 2), 'UNREACHABLE'],
    [move('ogre', 2, 6), 'UNREACHABLE'],
    [fire('ogre', 'core', 'main'), 'WRONG_PHASE'],
    [{type: 'Ram', playerId: 'player', unitId: 'ogre', targetId: 'gev'},
      'RAM_TARGET_INVALID'],
    [{type: 'Ram', playerId: 'player', unitId: 'ogre', targetId: 'core'},
      'RAM_CORE_FORBIDDEN']
  ]) reject(entry, command, code);
  const altered = copy(entry);
  altered.payload.rng.state++;
  reject(altered, move('ogre', 2, 5), 'SOURCE_ENTRY_STATE_MISMATCH');
  const version = {...entry, entryVersion: 'old'};
  reject(version, end, 'SOURCE_ENTRY_STATE_MISMATCH');
  const fixture = copy(entry);
  fixture.payload.fixture = 'adjacent';
  reject(fixture, end, 'SOURCE_ENTRY_STATE_MISMATCH');
  const enemy = enterEnemy(entry);
  const cursor = copy(enemy);
  cursor.payload.cursor.index = 1;
  reject(cursor, advance, 'SOURCE_ENTRY_STATE_MISMATCH');
  const fireEntry = apply(entry, end).entry;
  for (const [command, code] of [
    [fire('ogre', 'guard', 'bogus'), 'WEAPON_UNKNOWN'],
    [fire('ogre', 'gev', 'main'), 'B2_TARGET_UNSUPPORTED'],
    [fire('ogre', 'core', 'main'), 'WEAPON_OUT_OF_RANGE'],
    [fire('missile', 'core'), 'STANDARD_FIRE_OUT_OF_RANGE'],
    [{type: 'SelectWeapon', playerId: 'player', unitId: 'ogre',
      weaponKey: 'bogus'}, 'WEAPON_UNKNOWN']
  ]) reject(fireEntry, command, code);
});

test('source weapon selection and GEV second move use the same state', () => {
  let entry = createIronDustSourceActionEntry(1);
  entry = apply(entry, move('gev', 2, 7)).entry;
  entry = apply(entry, end).entry;
  assert.equal(state(entry).phase, 'fire');
  const selection = {type: 'SelectWeapon', playerId: 'player',
    unitId: 'ogre', weaponKey: 'secondary'};
  entry = apply(entry, selection).entry;
  assert.equal(unit(entry, 'ogre').ogreSystems.selectedWeapon, 'secondary');
  reject(entry, fire('ogre', 'core', 'main'), 'WEAPON_NOT_SELECTED');
  entry = apply(entry, end).entry;
  assert.equal(state(entry).phase, 'gev');
  const second = [move('gev', 3, 7), move('gev', 2, 8), move('gev', 3, 6)]
    .find(command => query(entry, command).available);
  assert.ok(second, 'a source GEV second move remains reachable');
  entry = apply(entry, second).entry;
  assert.equal(unit(entry, 'gev').secondMoved, true);
  reject(entry, second, 'ACTION_SPENT');
});

test('source non-Ogre fire and Ogre ram are reachable player actions', () => {
  let fireEntry = createIronDustSourceActionEntry(1);
  fireEntry = apply(fireEntry, move('missile', 4, 6)).entry;
  fireEntry = enterEnemy(fireEntry);
  fireEntry = finishEnemy(fireEntry).entry;
  fireEntry = apply(fireEntry, move('missile', 4, 5)).entry;
  fireEntry = apply(fireEntry, end).entry;
  const missileFire = apply(fireEntry, fire('missile', 'guard'));
  assert.equal(missileFire.events[0].type, 'PlayerFireResolved');
  assert.equal(unit(missileFire.entry, 'missile').fired, true);
  reject(missileFire.entry, fire('missile', 'guard'), 'ACTION_SPENT');

  let ramEntry = createIronDustSourceActionEntry(1);
  for (const x of [3, 6]) {
    ramEntry = apply(ramEntry, move('ogre', x, 2)).entry;
    ramEntry = enterEnemy(ramEntry);
    ramEntry = finishEnemy(ramEntry).entry;
  }
  const ram = {type: 'Ram', playerId: 'player', unitId: 'ogre',
    targetId: 'guard'};
  const result = apply(ramEntry, ram);
  assert.equal(result.events[0].type, 'RamResolved');
  assert.equal(unit(result.entry, 'guard').hp, 0);
  assert.deepEqual([unit(result.entry, 'ogre').x, unit(result.entry, 'ogre').y],
    [7, 3]);
});
