import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';

export const IRON_DUST_ENEMY_PHASE_PROBE_VERSION = 'iron-dust-explicit-enemy-pass-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const enemyActors = source.units.filter(unit => unit.team === 'enemy' &&
  unit.hp > 0 && !unit.core).map(unit => unit.id);
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const reject = code => {throw Object.assign(new Error(code), {code})};
const error = code => ({error: {code}});

export function createIronDustEnemyPhaseProbe(seed) {
  if (!u32(seed)) reject('ENEMY_PHASE_SEED_INVALID');
  return freeze({
    probeVersion: IRON_DUST_ENEMY_PHASE_PROBE_VERSION,
    executable: false,
    sourceDataVersion: source.dataContractVersion,
    sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId,
    side: 'player',
    phase: 'movement',
    turn: 1,
    enemyPassed: [],
    rng: {seed, state: seed}
  });
}

export function validateIronDustEnemyPhaseProbe(state) {
  if (!state || Object.keys(state).length !== 10 ||
      state.probeVersion !== IRON_DUST_ENEMY_PHASE_PROBE_VERSION || state.executable !== false ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceScenarioId !== source.scenarioId || state.sourceRuleProfileId !== source.ruleProfileId ||
      !Number.isSafeInteger(state.turn) || state.turn < 1 ||
      !state.rng || Object.keys(state.rng).length !== 2 ||
      !u32(state.rng.seed) || state.rng.state !== state.rng.seed ||
      !Array.isArray(state.enemyPassed) ||
      state.enemyPassed.some((id, index) => id !== enemyActors.filter(actor =>
        state.enemyPassed.includes(actor))[index]) ||
      (state.side === 'player'
        ? !['movement', 'fire', 'gev'].includes(state.phase) || state.enemyPassed.length !== 0
        : state.side !== 'enemy' || state.phase !== 'enemy')) reject('ENEMY_PHASE_MISMATCH');
  return state;
}

export function queryIronDustEnemyPhaseProbe(state, command) {
  validateIronDustEnemyPhaseProbe(state);
  if (!command || typeof command.type !== 'string') return {available: false, error: {code: 'ENEMY_COMMAND_INVALID'}};
  if (command.playerId !== state.side) return {available: false, error: {code: 'NOT_ACTIVE_TEAM'}};
  if (command.type === 'EndPhase') {
    if (state.phase === 'enemy' && state.enemyPassed.length !== enemyActors.length)
      return {available: false, error: {code: 'ENEMY_COMMANDS_PENDING'}};
    if (state.phase === 'enemy' && state.turn === Number.MAX_SAFE_INTEGER)
      return {available: false, error: {code: 'ENEMY_TURN_LIMIT'}};
    return {available: true};
  }
  if (command.type === 'EnemyPass') {
    if (state.phase !== 'enemy') return {available: false, error: {code: 'WRONG_PHASE'}};
    if (!enemyActors.includes(command.actorId))
      return {available: false, error: {code: command.actorId === 'core' ?
        'ENEMY_ACTOR_FORBIDDEN' : 'ENEMY_ACTOR_INVALID'}};
    if (state.enemyPassed.includes(command.actorId))
      return {available: false, error: {code: 'ACTION_SPENT'}};
    return {available: true};
  }
  return {available: false, error: {code: 'UNSUPPORTED_COMMAND'}};
}

// Only the explicit no-action branch is represented. No AI, Move or Fire runs.
export function dispatchIronDustEnemyPhaseProbe(state, command) {
  const query = queryIronDustEnemyPhaseProbe(state, command);
  if (!query.available) return error(query.error.code);
  const next = clone(state);
  if (command.type === 'EnemyPass') {
    next.enemyPassed.push(command.actorId);
    next.enemyPassed.sort((a, b) => enemyActors.indexOf(a) - enemyActors.indexOf(b));
    return {state: freeze(next), events: [{type: 'EnemyPassRecorded',
      actorId: command.actorId, turn: next.turn, pendingActorIds: enemyActors.filter(id =>
        !next.enemyPassed.includes(id))}]};
  }
  const from = state.phase;
  if (from === 'movement') next.phase = 'fire';
  else if (from === 'fire') next.phase = 'gev';
  else if (from === 'gev') {next.phase = 'enemy'; next.side = 'enemy'}
  else {
    next.phase = 'movement';
    next.side = 'player';
    next.turn++;
    next.enemyPassed = [];
  }
  return {state: freeze(next), events: [{type: 'PhaseChanged',
    from, to: next.phase, side: next.side, turn: next.turn}]};
}
