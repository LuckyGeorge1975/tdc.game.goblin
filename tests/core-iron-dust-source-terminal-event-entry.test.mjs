import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_DUST_SOURCE_VICTORY_TRACE_V1 as oracle} from
  './iron-dust-source-victory-trace.v1.mjs';
import {IRON_DUST_SOURCE_TERMINAL_EVENT_DELTA_V1 as delta} from
  './iron-dust-source-terminal-event-delta.v1.mjs';
import {createIronDustSourceActionEntry, dispatchIronDustSourceActionEntry} from
  '../src/core/iron-dust-source-action-entry-probe.mjs';
import {createIronDustSourceTerminalEventEntry as create,
  validateIronDustSourceTerminalEventEntry as validate,
  queryIronDustSourceTerminalEventEntry as query,
  preflightIronDustSourceTerminalEventEntry as preflight,
  dispatchIronDustSourceTerminalEventEntry as dispatch} from
  '../src/core/iron-dust-source-terminal-event-entry-probe.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const stateOf = entry => entry.mode === 'enemy' ? entry.payload.state : entry.payload;
const deny = (entry, command, code) => {
  const before = JSON.stringify(entry);
  assert.deepEqual(query(entry, command), {available: false, error: {code}});
  assert.deepEqual(preflight(entry, command), {available: false, error: {code}});
  assert.deepEqual(dispatch(entry, command), {error: {code}});
  assert.equal(JSON.stringify(entry), before);
};

function run() {
  let entry = create(oracle.seed);
  let legacy = createIronDustSourceActionEntry(oracle.seed);
  assert.equal(entry.terminalEntryVersion, delta.terminalEntryVersion);
  assert.deepEqual(entry.inner, legacy);
  assert.equal(entry.executable, false);
  const steps = [];
  for (const [index, command] of oracle.commands.entries()) {
    const before = JSON.stringify(entry);
    const q = query(entry, command);
    assert.equal(q.available, true, `${index}: ${JSON.stringify(q.error)}`);
    assert.deepEqual(preflight(entry, command), q);
    const invalid = entry.inner.mode === 'enemy'
      ? {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'}
      : {type: 'AutoEnemyAdvance', playerId: 'enemy'};
    deny(entry, invalid, entry.inner.mode === 'enemy'
      ? 'SOURCE_ENTRY_COMMAND_UNSUPPORTED' : 'WRONG_PHASE');
    assert.equal(JSON.stringify(entry), before);
    const old = dispatchIronDustSourceActionEntry(legacy, command);
    const result = dispatch(entry, command);
    assert.ok(result.entry, `${index}: ${JSON.stringify(result.error)}`);
    assert.doesNotThrow(() => validate(result.entry));
    assert.deepEqual(result.entry.inner, old.entry);
    assert.deepEqual(result.entry.inner.digest, oracle.steps[index].state.digest);
    assert.deepEqual(stateOf(result.entry.inner).rng.state,
      oracle.steps[index].state.rngState);
    assert.deepEqual(old.events, oracle.steps[index].events);
    const expectedEvents = index === delta.terminalStep
      ? [...old.events, delta.terminalEvent] : old.events;
    assert.deepEqual(result.events, expectedEvents);
    steps.push({events: result.events, inner: result.entry.inner});
    entry = result.entry;
    legacy = old.entry;
  }
  assert.equal(steps.flatMap(step => step.events)
    .filter(event => event.type === 'IronDustGameEnded').length, 1);
  assert.deepEqual(steps.at(-1).events,
    [...oracle.steps.at(-1).events, delta.terminalEvent]);
  assert.equal(entry.inner.digest, delta.finalInnerDigest);
  assert.equal(stateOf(entry.inner).rng.state, delta.finalRngState);
  assert.deepEqual(stateOf(entry.inner).victory,
    {status: 'ended', winner: 'player'});
  for (const command of [oracle.commands.at(-1),
    {type: 'EndPhase', playerId: 'player'},
    {type: 'AutoEnemyAdvance', playerId: 'enemy'}])
    deny(entry, command, 'GAME_ENDED');
  return JSON.stringify(steps);
}

test('opt-in Seed8 terminal event appends once without changing any v1 step', () => {
  assert.equal(oracle.commands.length, 21);
  assert.equal(run(), run());
});

test('forged terminal envelope rejects before command or RNG changes', () => {
  const entry = create(8);
  const command = oracle.commands[0];
  const version = copy(entry);
  version.terminalEntryVersion = 'old';
  deny(version, command, 'TERMINAL_ENTRY_STATE_MISMATCH');
  const digest = copy(entry);
  digest.digest = 'fnv1a64:0000000000000000';
  deny(digest, command, 'TERMINAL_ENTRY_STATE_MISMATCH');
  const state = copy(entry);
  state.inner.payload.rng.state++;
  deny(state, command, 'TERMINAL_ENTRY_STATE_MISMATCH');
  const extra = {...entry, state: entry.inner.payload};
  deny(extra, command, 'TERMINAL_ENTRY_STATE_MISMATCH');
});
