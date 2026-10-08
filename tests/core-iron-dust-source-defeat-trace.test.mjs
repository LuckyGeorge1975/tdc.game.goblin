import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IRON_DUST_SOURCE_DEFEAT_TRACE_V2 as oracle} from
  './iron-dust-source-defeat-trace.v2.mjs';
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

function summarize(entry, index, events) {
  const state = stateOf(entry), ogre = state.units.find(u => u.id === 'ogre');
  return {index, turn: state.turn, mode: entry.mode, phase: state.phase,
    cursor: entry.mode === 'enemy' ? entry.payload.cursor : null,
    victory: state.victory, rng: state.rng.state,
    hp: Object.fromEntries(state.units.map(u => [u.id, u.hp])),
    treads: ogre.ogreSystems.treads,
    destroyed: Object.fromEntries(Object.entries(ogre.ogreSystems.weapons)
      .map(([key, weapon]) => [key, weapon.destroyed])),
    events};
}

function run() {
  let entry = create(oracle.seed);
  assert.equal(entry.entryVersion, oracle.entryVersion);
  assert.equal(entry.executable, false);
  assert.equal(stateOf(entry).fixture, 'source');
  const trace = {traceVersion: oracle.traceVersion,
    entryVersion: oracle.entryVersion, seed: oracle.seed,
    unitOrder: oracle.unitOrder, weaponOrder: oracle.weaponOrder,
    initialHash: hash(entry), steps: [], milestones: []};
  let previous = summarize(entry, -1, []);
  for (const [index, expected] of oracle.steps.entries()) {
    const command = expected.command === 'E'
      ? {type: 'AutoEnemyAdvance', playerId: 'enemy'}
      : {type: 'EndPhase', playerId: 'player'};
    assert.equal(entry.mode, expected.command === 'E' ? 'enemy' : 'player',
      `mode at step ${index}`);
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
    const next = summarize(entry, index, result.events);
    const step = {command: expected.command,
      actionKind: allowed.action?.kind ?? null,
      events: result.events, state: snapshot(entry),
      hash: hash({command, allowed, events: result.events, entry})};
    assert.deepEqual(step, expected, `golden step ${index}`);
    trace.steps.push(step);
    if (next.treads !== previous.treads ||
        JSON.stringify(next.destroyed) !== JSON.stringify(previous.destroyed) ||
        JSON.stringify(next.hp) !== JSON.stringify(previous.hp) ||
        next.victory.status === 'ended')
      trace.milestones.push(next);
    previous = next;
  }
  assert.equal(entry.mode, 'ended');
  assert.deepEqual(stateOf(entry).victory, {status: 'ended', winner: 'enemy'});
  assert.equal(stateOf(entry).units.filter(u => u.team === 'player' && u.hp > 0).length, 0);
  assert.ok(stateOf(entry).units.find(u => u.id === 'core').hp > 0);
  assert.equal(trace.steps.filter(step => step.state.victory.status === 'ended').length, 1);
  const terminal = JSON.stringify(entry);
  for (const command of [{type: 'EndPhase', playerId: 'player'},
    {type: 'AutoEnemyAdvance', playerId: 'enemy'}]) {
    assert.deepEqual(query(entry, command), {available: false, error: {code: 'GAME_ENDED'}});
    assert.deepEqual(preflight(entry, command), {available: false, error: {code: 'GAME_ENDED'}});
    assert.deepEqual(dispatch(entry, command), {error: {code: 'GAME_ENDED'}});
  }
  assert.equal(JSON.stringify(entry), terminal);
  trace.final = summarize(entry, oracle.steps.length - 1, []);
  return trace;
}

test('versioned Seed 2 source defeat has 989 exact legal steps and replays byte-equal', () => {
  assert.equal(oracle.traceVersion, 'iron-dust-source-defeat-trace-v2');
  assert.equal(oracle.steps.length, 989);
  assert.equal(oracle.final.turn, 124);
  assert.equal(oracle.final.treads, 0);
  assert.equal(oracle.final.destroyed.antipersonnel, 8);
  const first = run(), second = run();
  assert.deepEqual(first, oracle);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
