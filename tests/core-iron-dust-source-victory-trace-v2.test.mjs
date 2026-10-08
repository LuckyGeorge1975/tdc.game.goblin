import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V2 as oracle} from
  './iron-dust-source-victory-trace.v2.mjs';
import {createIronDustZeroTreadsSourceActionEntry as create,
  validateIronDustSourceActionEntry as validate,
  queryIronDustSourceActionEntry as query,
  preflightIronDustSourceActionEntry as preflight,
  dispatchIronDustSourceActionEntry as dispatch} from
  '../src/core/iron-dust-source-action-entry-probe.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stateOf = entry => entry.mode === 'enemy' ? entry.payload.state : entry.payload;
function snapshot(entry) {
  const state = stateOf(entry);
  const systems = state.units.find(unit => unit.id === 'ogre').ogreSystems;
  assert.deepEqual(state.units.map(unit => unit.id), oracle.unitOrder);
  assert.deepEqual(Object.keys(systems.weapons), oracle.weaponOrder);
  return {mode: entry.mode, turn: state.turn, phase: state.phase,
    team: state.activeTeam, victory: state.victory,
    units: state.units.map(unit => [unit.x, unit.y, unit.hp, unit.disabled,
      unit.disabledUntil, unit.moved, unit.fired, unit.secondMoved]),
    enemyPassed: state.enemyPassed, firedActorIds: state.firedActorIds,
    ogre: [systems.treads, systems.selectedWeapon,
      ...oracle.weaponOrder.map(key => {
        const weapon = systems.weapons[key];
        return [weapon.destroyed, weapon.remaining, weapon.firedThisPhase];
      })],
    rngState: state.rng.state,
    cursor: entry.mode === 'enemy' ? entry.payload.cursor : null,
    digest: entry.digest,
    controllerDigest: entry.mode === 'enemy' ? entry.payload.digest : null};
}

function run() {
  let entry = create(oracle.seed);
  assert.equal(entry.entryVersion, oracle.entryVersion);
  assert.equal(entry.executable, false);
  assert.equal(stateOf(entry).fixture, 'source');
  const trace = {traceVersion: oracle.traceVersion, entryVersion: oracle.entryVersion,
    seed: oracle.seed, unitOrder: oracle.unitOrder, weaponOrder: oracle.weaponOrder,
    commands: oracle.commands, initial: snapshot(entry), initialHash: hash(entry), steps: []};
  for (const [index, command] of oracle.commands.entries()) {
    assert.ok(['Move', 'EndPhase', 'AutoEnemyAdvance', 'PlayerFire'].includes(command.type));
    const before = JSON.stringify(entry);
    const rejected = entry.mode === 'enemy'
      ? {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'}
      : {type: 'AutoEnemyAdvance', playerId: 'enemy'};
    const code = entry.mode === 'enemy' ? 'SOURCE_ENTRY_COMMAND_UNSUPPORTED' : 'WRONG_PHASE';
    assert.deepEqual(query(entry, rejected), {available: false, error: {code}});
    assert.deepEqual(preflight(entry, rejected), {available: false, error: {code}});
    assert.deepEqual(dispatch(entry, rejected), {error: {code}});
    const allowed = query(entry, command);
    assert.equal(allowed.available, true, `${index}: ${JSON.stringify(allowed.error)}`);
    assert.deepEqual(preflight(entry, command), allowed);
    assert.equal(JSON.stringify(entry), before, `query/reject step ${index}`);
    const result = dispatch(entry, command);
    assert.ok(result.entry, `${index}: ${JSON.stringify(result.error)}`);
    entry = result.entry;
    assert.doesNotThrow(() => validate(entry));
    assert.equal(entry.executable, false);
    assert.equal(stateOf(entry).executable, false);
    assert.equal(stateOf(entry).fixture, 'source');
    trace.steps.push({index, actionKind: allowed.action?.kind ?? null,
      events: result.events, state: snapshot(entry),
      hash: hash({command, allowed, events: result.events, entry})});
  }
  assert.equal(entry.mode, 'ended');
  assert.deepEqual(stateOf(entry).victory, {status: 'ended', winner: 'player'});
  assert.equal(stateOf(entry).units.find(unit => unit.id === 'core').hp, 0);
  assert.ok(stateOf(entry).units.some(unit => unit.team === 'player' && unit.hp > 0));
  assert.equal(trace.steps.filter(step => step.state.victory.status === 'ended').length, 1);
  assert.deepEqual([trace.steps.at(-1).events[0].ratio,
    trace.steps.at(-1).events[0].roll, trace.steps.at(-1).events[0].result],
  ['1-1', 5, 'X']);
  const terminal = JSON.stringify(entry);
  for (const command of [oracle.commands.at(-1),
    {type: 'EndPhase', playerId: 'player'},
    {type: 'AutoEnemyAdvance', playerId: 'enemy'}]) {
    assert.deepEqual(query(entry, command), {available: false, error: {code: 'GAME_ENDED'}});
    assert.deepEqual(preflight(entry, command), {available: false, error: {code: 'GAME_ENDED'}});
    assert.deepEqual(dispatch(entry, command), {error: {code: 'GAME_ENDED'}});
  }
  assert.equal(JSON.stringify(entry), terminal);
  return trace;
}

test('versioned Seed 8 v2 source victory has exact commands, events, state and RNG twice', () => {
  assert.equal(oracle.traceVersion, 'iron-dust-source-victory-trace-v2');
  assert.equal(oracle.entryVersion, 'iron-dust-source-action-entry-v2');
  assert.equal(oracle.commands.length, 21);
  const first = run(), second = run();
  assert.deepEqual(first, oracle);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
