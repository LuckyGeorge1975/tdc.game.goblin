import test from 'node:test';
import assert from 'node:assert/strict';
import {createIronDustUnifiedStateProbe, queryIronDustUnifiedUnit,
  validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {dispatchIronDustB1Action} from '../src/core/iron-dust-b1-action-probe.mjs';
import {IRON_DUST_PLAYER_MOVE_PROBE_VERSION, queryIronDustPlayerMove,
  preflightIronDustPlayerMove, dispatchIronDustPlayerMove} from
  '../src/core/iron-dust-player-move-probe.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const move = (unitId, x, y) => ({type: 'Move', playerId: 'player', unitId, to: {x, y}});
const unit = (state, id) => state.units.find(value => value.id === id);
const phase = state => dispatchIronDustB1Action(state,
  {type: 'EndPhase', playerId: state.activeTeam}).state;

test('all four normal first moves use the same inactive seven-unit state and Legacy budgets', () => {
  let state = createIronDustUnifiedStateProbe(17);
  const cases = [
    ['ogre', 2, 5, 3], ['gev', 2, 7, 3],
    ['missile', 4, 6, 1], ['infantry', 0, 6, 2]
  ];
  for (const [id, x, y, allowance] of cases) {
    const command = move(id, x, y), query = queryIronDustPlayerMove(state, command);
    assert.deepEqual(preflightIronDustPlayerMove(state, command), query);
    assert.equal(query.available, true, id);
    assert.equal(query.resolverVersion, IRON_DUST_PLAYER_MOVE_PROBE_VERSION);
    assert.equal(query.allowance, allowance);
    assert.ok(query.cost <= allowance);
    const beforeRng = plain(state.rng), result = dispatchIronDustPlayerMove(state, command);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, 'UnitMoved');
    assert.deepEqual(result.events[0].path, query.path);
    assert.deepEqual(plain(result.state.rng), beforeRng);
    assert.equal(result.state.executable, false);
    assert.equal(Object.isFrozen(result.state), true);
    assert.equal(unit(result.state, id).moved, true);
    state = result.state;
  }
  assert.doesNotThrow(() => validateIronDustUnifiedStateProbe(state));
  assert.deepEqual(state.units.filter(value => value.team === 'player').map(value =>
    [value.id, value.x, value.y]),
    [['ogre', 2, 5], ['gev', 2, 7], ['missile', 4, 6], ['infantry', 0, 6]]);
});

test('GEV alone gets a second move in gev phase; next turn resets budgets', () => {
  const start = createIronDustUnifiedStateProbe(21);
  const first = dispatchIronDustPlayerMove(start, move('gev', 2, 7)).state;
  assert.deepEqual(queryIronDustPlayerMove(first, move('gev', 3, 7)),
    {available: false, error: {code: 'ACTION_SPENT'}});
  const gevPhase = phase(phase(first));
  assert.equal(gevPhase.phase, 'gev');
  const secondCommand = move('gev', 3, 7);
  const query = queryIronDustPlayerMove(gevPhase, secondCommand);
  assert.equal(query.available, true);
  assert.equal(query.allowance, 2);
  const second = dispatchIronDustPlayerMove(gevPhase, secondCommand).state;
  assert.equal(unit(second, 'gev').secondMoved, true);
  assert.deepEqual(queryIronDustPlayerMove(second, move('gev', 4, 7)),
    {available: false, error: {code: 'ACTION_SPENT'}});
  assert.deepEqual(queryIronDustPlayerMove(gevPhase, move('ogre', 2, 5)),
    {available: false, error: {code: 'WRONG_PHASE'}});
  const enemy = phase(second);
  const passedGuard = dispatchIronDustB1Action(enemy,
    {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'}).state;
  const passed = dispatchIronDustB1Action(passedGuard,
    {type: 'EnemyPass', playerId: 'enemy', actorId: 'raider'}).state;
  const next = phase(passed);
  assert.equal(next.turn, 2);
  assert.equal(next.phase, 'movement');
  assert.equal(unit(next, 'gev').moved, false);
  assert.equal(unit(next, 'gev').secondMoved, false);
  assert.equal(queryIronDustPlayerMove(next, move('gev', 2, 7)).available, true);
});

test('Ogre tread damage changes movement budget without changing source values', () => {
  const start = plain(createIronDustUnifiedStateProbe(31));
  const ogre = unit(start, 'ogre');
  ogre.ogreSystems.treads = 30;
  assert.equal(queryIronDustUnifiedUnit(start, 'ogre').firstMove, 2);
  assert.deepEqual([queryIronDustPlayerMove(start, move('ogre', 1, 4)).available,
    queryIronDustPlayerMove(start, move('ogre', 1, 4)).cost], [true, 2]);
  ogre.ogreSystems.treads = 15;
  assert.deepEqual(queryIronDustPlayerMove(start, move('ogre', 1, 4)),
    {available: false, error: {code: 'UNREACHABLE'}});
  assert.equal(queryIronDustPlayerMove(start, move('ogre', 2, 5)).allowance, 1);
  ogre.ogreSystems.treads = 0;
  assert.deepEqual(queryIronDustPlayerMove(start, move('ogre', 2, 5)),
    {available: false, error: {code: 'UNREACHABLE'}});
});

test('multi-cell paths respect Legacy cost and occupied detours', () => {
  const source = createIronDustUnifiedStateProbe(37);
  const ogre = queryIronDustPlayerMove(source, move('ogre', 3, 5));
  assert.equal(ogre.available, true);
  assert.equal(ogre.cost, 2);
  assert.deepEqual(ogre.path, [{x: 2, y: 5}, {x: 3, y: 5}]);
  const gev = queryIronDustPlayerMove(source, move('gev', 4, 7));
  assert.equal(gev.available, true);
  assert.equal(gev.cost, 3);
  assert.deepEqual(gev.path.at(-1), {x: 4, y: 7});
  assert.equal(gev.path.some(cell => cell.x === 3 && cell.y === 6), false);
});

test('occupied, blocked, out-of-budget and wrong-phase requests reject identically without mutation', () => {
  const source = createIronDustUnifiedStateProbe(47);
  const wrongPhase = phase(source);
  const spent = dispatchIronDustPlayerMove(source, move('missile', 4, 6)).state;
  const gevMoved = dispatchIronDustPlayerMove(source, move('gev', 2, 7)).state;
  const cases = [
    [source, move('ogre', 1, 6), 'UNREACHABLE'], // infantry occupies destination
    [gevMoved, move('missile', 2, 6), 'UNREACHABLE'], // rubble costs 2, budget is 1
    [source, move('infantry', 9, 7), 'UNREACHABLE'],
    [source, move('gev', 12, 6), 'OUT_OF_BOUNDS'],
    [source, move('ogre', 1, 5), 'UNREACHABLE'],
    [spent, move('missile', 5, 6), 'ACTION_SPENT'],
    [wrongPhase, move('ogre', 2, 5), 'WRONG_PHASE'],
    [source, {...move('ogre', 2, 5), playerId: 'enemy'}, 'NOT_ACTIVE_TEAM'],
    [source, move('guard', 7, 3), 'MOVE_UNIT_UNSUPPORTED'],
    [source, {...move('ogre', 2, 5), extra: true}, 'MOVE_COMMAND_INVALID']
  ];
  for (const [state, command, code] of cases) {
    const before = JSON.stringify(state), rng = JSON.stringify(state.rng);
    const query = queryIronDustPlayerMove(state, command);
    assert.deepEqual(query, {available: false, error: {code}}, `${code}: ${command.unitId}`);
    assert.deepEqual(preflightIronDustPlayerMove(state, command), query);
    assert.deepEqual(dispatchIronDustPlayerMove(state, command), {error: {code}});
    assert.equal(JSON.stringify(state), before);
    assert.equal(JSON.stringify(state.rng), rng);
  }
  const disabled = plain(source);
  unit(disabled, 'infantry').disabled = true;
  unit(disabled, 'infantry').disabledUntil = 2;
  assert.deepEqual(queryIronDustPlayerMove(disabled, move('infantry', 0, 6)),
    {available: false, error: {code: 'UNIT_UNAVAILABLE'}});
  const dead = plain(source);
  unit(dead, 'missile').hp = 0;
  assert.deepEqual(queryIronDustPlayerMove(dead, move('missile', 4, 6)),
    {available: false, error: {code: 'UNIT_UNAVAILABLE'}});
});

test('identical command sequences repeat exact states, events and RNG', () => {
  const run = () => {
    let state = createIronDustUnifiedStateProbe(91);
    const events = [];
    for (const command of [move('ogre', 2, 5), move('gev', 2, 7),
      move('missile', 4, 6), move('infantry', 0, 6)]) {
      const result = dispatchIronDustPlayerMove(state, command);
      state = result.state;
      events.push(...result.events);
    }
    return {state, events};
  };
  assert.equal(JSON.stringify(run()), JSON.stringify(run()));
});
