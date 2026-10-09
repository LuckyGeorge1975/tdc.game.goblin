import {createIronDustSourceActionEntry, validateIronDustSourceActionEntry,
  queryIronDustSourceActionEntry, dispatchIronDustSourceActionEntry} from
  './iron-dust-source-action-entry-probe.mjs';

// Opt-in terminal event layer. The unchanged v1 entry owns the only rule state.
export const IRON_DUST_SOURCE_TERMINAL_ENTRY_VERSION =
  'iron-dust-source-terminal-entry-v1';
export const IRON_DUST_TERMINAL_EVENT_VERSION = 'iron-dust-terminal-event-v1';
const causalTypes = ['PlayerFireResolved', 'EnemyUnitFireResolved',
  'EnemySystemFireResolved'];
const terminalTypes = ['GameEnded', 'IronDustGameEnded'];
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const exact = (value, keys) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const deny = code => ({available: false, error: {code}});
const error = code => Object.assign(new Error(code), {code});
const stateOf = entry => entry.mode === 'enemy' ? entry.payload.state : entry.payload;
const digest = value => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
};
const stamp = inner => digest({
  terminalEntryVersion: IRON_DUST_SOURCE_TERMINAL_ENTRY_VERSION, inner
});
const wrap = inner => {
  const copy = clone(inner);
  return freeze({terminalEntryVersion: IRON_DUST_SOURCE_TERMINAL_ENTRY_VERSION,
    executable: false, inner: copy, digest: stamp(copy)});
};

export function createIronDustSourceTerminalEventEntry(seed) {
  return wrap(createIronDustSourceActionEntry(seed));
}

export function validateIronDustSourceTerminalEventEntry(entry) {
  try {
    if (!exact(entry, ['terminalEntryVersion', 'executable', 'inner', 'digest']) ||
        entry.terminalEntryVersion !== IRON_DUST_SOURCE_TERMINAL_ENTRY_VERSION ||
        entry.executable !== false || entry.digest !== stamp(entry.inner))
      throw error('TERMINAL_ENTRY_STATE_MISMATCH');
    validateIronDustSourceActionEntry(entry.inner);
  } catch {
    throw error('TERMINAL_ENTRY_STATE_MISMATCH');
  }
  return entry;
}

export function queryIronDustSourceTerminalEventEntry(entry, command) {
  try {validateIronDustSourceTerminalEventEntry(entry)}
  catch {return deny('TERMINAL_ENTRY_STATE_MISMATCH')}
  return queryIronDustSourceActionEntry(entry.inner, command);
}

export function preflightIronDustSourceTerminalEventEntry(entry, command) {
  return queryIronDustSourceTerminalEventEntry(entry, command);
}

function terminalEvent(before, after, events) {
  if (after.victory.status !== 'ended' ||
      events.some(event => terminalTypes.includes(event.type)))
    throw error('TERMINAL_EVENT_CONTRACT_MISMATCH');
  const causal = events.at(-1);
  if (!causal || !causalTypes.includes(causal.type) ||
      events.filter(event => causalTypes.includes(event.type)).length !== 1 ||
      causal.turn !== before.turn || after.turn !== before.turn ||
      after.phase !== before.phase || after.activeTeam !== before.activeTeam)
    throw error('TERMINAL_EVENT_CONTRACT_MISMATCH');
  const survivors = after.units.some(unit => unit.team === 'player' && unit.hp > 0);
  const core = after.units.find(unit => unit.id === 'core');
  const winner = !survivors ? 'enemy' : core.hp === 0 ? 'player' : null;
  if (winner !== after.victory.winner ||
      (winner === 'player' && (causal.type !== 'PlayerFireResolved' ||
        causal.targetId !== 'core' || before.phase !== 'fire')) ||
      (winner === 'enemy' && (causal.type === 'PlayerFireResolved' ||
        before.phase !== 'enemy')))
    throw error('TERMINAL_EVENT_CONTRACT_MISMATCH');
  return {type: 'IronDustGameEnded', eventVersion: IRON_DUST_TERMINAL_EVENT_VERSION,
    winner, reason: winner === 'player' ? 'core-destroyed' :
      'all-player-units-destroyed', turn: before.turn, phase: before.phase,
    causedBy: {type: causal.type, attackerId: causal.attackerId,
      targetId: causal.targetId, eventIndex: events.length - 1}};
}

export function dispatchIronDustSourceTerminalEventEntry(entry, command) {
  const query = queryIronDustSourceTerminalEventEntry(entry, command);
  if (!query.available) return {error: query.error};
  const before = stateOf(entry.inner);
  if (before.victory.status !== 'ongoing') return {error: {code: 'GAME_ENDED'}};
  const result = dispatchIronDustSourceActionEntry(entry.inner, command);
  if (!result.entry) return {error: result.error};
  try {
    validateIronDustSourceActionEntry(result.entry);
    const after = stateOf(result.entry);
    const events = clone(result.events);
    if (after.victory.status === 'ended') events.push(terminalEvent(before, after, events));
    else if (after.victory.status !== 'ongoing' ||
        events.some(event => terminalTypes.includes(event.type)))
      throw error('TERMINAL_EVENT_CONTRACT_MISMATCH');
    const next = wrap(result.entry);
    validateIronDustSourceTerminalEventEntry(next);
    return {entry: next, events: freeze(events)};
  } catch {
    return {error: {code: 'TERMINAL_EVENT_CONTRACT_MISMATCH'}};
  }
}
