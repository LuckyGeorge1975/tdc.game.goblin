import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';

export const IRON_DUST_OBJECTIVE_PROBE_VERSION = 'iron-dust-core-objective-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const originalUnits = source.units.map(unit => ({id: unit.id, team: unit.team,
  core: unit.core === true, hp: unit.hp, maxHp: unit.maxHp}));
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const reject = code => {throw Object.assign(new Error(code), {code})};

function snapshot(units) {
  const core = units.find(unit => unit.team === 'enemy' && unit.core);
  const enemies = units.filter(unit => unit.team === 'enemy');
  const enemyAlive = enemies.filter(unit => unit.hp > 0).length;
  const playerAlive = units.some(unit => unit.team === 'player' && unit.hp > 0);
  const outcome = !playerAlive ? false : core.hp > 0 ? null : true;
  return {coreHp: core.hp, enemyAlive, playerAlive, outcome};
}

export function createIronDustObjectiveProbe(seed) {
  if (!u32(seed)) reject('OBJECTIVE_PROBE_SEED_INVALID');
  return freeze({
    probeVersion: IRON_DUST_OBJECTIVE_PROBE_VERSION,
    executable: false,
    sourceDataVersion: source.dataContractVersion,
    sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId,
    objectiveVersion: source.objectiveVersion,
    objective: source.objective,
    units: clone(originalUnits),
    rng: {seed, state: seed}
  });
}

export function validateIronDustObjectiveProbe(state) {
  if (!state || Object.keys(state).length !== 9 ||
      state.probeVersion !== IRON_DUST_OBJECTIVE_PROBE_VERSION || state.executable !== false ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceScenarioId !== source.scenarioId || state.sourceRuleProfileId !== source.ruleProfileId ||
      state.objectiveVersion !== 1 || state.objective !== 'core' ||
      !state.rng || Object.keys(state.rng).length !== 2 ||
      !u32(state.rng.seed) || state.rng.state !== state.rng.seed ||
      !Array.isArray(state.units) || state.units.length !== originalUnits.length ||
      !state.units.every((unit, index) => {
        const initial = originalUnits[index];
        return unit && Number.isInteger(unit.hp) && unit.hp >= 0 && unit.hp <= initial.maxHp &&
          same({...unit, hp: initial.hp}, initial);
      })) reject('OBJECTIVE_PROBE_MISMATCH');
  return state;
}

export function queryIronDustObjectiveProbe(state) {
  validateIronDustObjectiveProbe(state);
  return snapshot(state.units);
}

// Observations are external facts, not damage, Fire, Ram or phase actions.
export function dispatchIronDustObjectiveProbe(state, command) {
  validateIronDustObjectiveProbe(state);
  if (!command || typeof command.type !== 'string')
    return {error: {code: 'OBJECTIVE_COMMAND_INVALID'}};
  if (snapshot(state.units).outcome !== null)
    return {error: {code: 'OBJECTIVE_ALREADY_ENDED'}};
  if (command.type === 'ObservePhase') {
    if (!['movement', 'fire', 'gev', 'enemy'].includes(command.phase))
      return {error: {code: 'OBJECTIVE_PHASE_INVALID'}};
    return {state, events: [{type: 'ObjectivePhaseObserved', phase: command.phase,
      outcome: null}]};
  }
  if (command.type !== 'ObserveHpBatch')
    return {error: {code: 'OBJECTIVE_COMMAND_UNSUPPORTED'}};
  if (!Array.isArray(command.changes) || command.changes.length < 1 ||
      new Set(command.changes.map(change => change?.unitId)).size !== command.changes.length ||
      !command.changes.every(change => {
        const current = state.units.find(unit => unit.id === change?.unitId);
        return current && Number.isInteger(change.hp) && change.hp >= 0 && change.hp <= current.hp;
      })) return {error: {code: 'OBJECTIVE_OBSERVATION_INVALID'}};
  const next = clone(state);
  for (const change of command.changes)
    next.units.find(unit => unit.id === change.unitId).hp = change.hp;
  const observed = snapshot(next.units);
  return {state: freeze(next), events: [{type: 'ObjectiveRosterObserved',
    changes: clone(command.changes), outcome: observed.outcome,
    playerAlive: observed.playerAlive, coreHp: observed.coreHp}]};
}
