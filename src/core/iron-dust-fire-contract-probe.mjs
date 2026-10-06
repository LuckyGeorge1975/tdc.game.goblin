import {hexDistance} from './hex.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from './iron-dust-legacy-los-probe.mjs';
import {createIronDustAttackPreflightProbe, queryIronDustAttackProbe} from './iron-dust-attack-preflight-probe.mjs';
import {createIronDustWeaponProbe, validateIronDustWeaponProbe} from './iron-dust-weapon-probe.mjs';

export const IRON_DUST_FIRE_CONTRACT_VERSION = 'iron-dust-fire-directions-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const byId = Object.fromEntries(source.units.map(unit => [unit.id, unit]));
const ids = source.units.map(unit => unit.id);
const fixtures = Object.freeze({
  source: {},
  adjacent: {guard: {x: 2, y: 5}},
  boundary: {ogre: {x: 2, y: 0}, guard: {x: 6, y: 1}}
});
const systemKeys = [...Object.keys(byId.ogre.ogreSystems.weapons), 'treads'];
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
const deny = code => ({available: false, error: {code}});
const reject = code => {throw Object.assign(new Error(code), {code})};

function initialUnit(unit, fixture) {
  return {...clone(unit), ...(fixtures[fixture][unit.id] ?? {}),
    disabled: false, disabledUntil: 0, embarkedOn: null, passengerIds: []};
}

export function createIronDustFireContractProbe(seed, options = {}) {
  if (!u32(seed)) reject('FIRE_CONTRACT_SETUP_INVALID');
  const {fixture = 'source', side = 'player', phase = 'fire', turn = 1,
    weaponState = createIronDustWeaponProbe(seed)} = options ?? {};
  if (!Object.hasOwn(fixtures, fixture) ||
      !Number.isSafeInteger(turn) || turn < 1 ||
      !(side === 'enemy' ? phase === 'enemy' :
        side === 'player' && ['movement', 'fire', 'gev'].includes(phase)))
    reject('FIRE_CONTRACT_SETUP_INVALID');
  validateIronDustWeaponProbe(weaponState);
  if (weaponState.rng.seed !== seed) reject('FIRE_CONTRACT_SETUP_INVALID');
  return freeze({
    probeVersion: IRON_DUST_FIRE_CONTRACT_VERSION,
    executable: false,
    sourceDataVersion: source.dataContractVersion,
    sourceScenarioId: source.scenarioId,
    sourceRuleProfileId: source.ruleProfileId,
    fixture, side, phase, turn,
    units: source.units.map(unit => initialUnit(unit, fixture)),
    weaponState: clone(weaponState),
    rng: {seed, state: seed}
  });
}

export function validateIronDustFireContractProbe(state) {
  if (!state || Object.keys(state).length !== 12 ||
      state.probeVersion !== IRON_DUST_FIRE_CONTRACT_VERSION || state.executable !== false ||
      state.sourceDataVersion !== source.dataContractVersion ||
      state.sourceScenarioId !== source.scenarioId ||
      state.sourceRuleProfileId !== source.ruleProfileId ||
      !Object.hasOwn(fixtures, state.fixture) ||
      !(state.side === 'enemy' ? state.phase === 'enemy' :
        state.side === 'player' && ['movement', 'fire', 'gev'].includes(state.phase)) ||
      !Number.isSafeInteger(state.turn) || state.turn < 1 ||
      !state.rng || !same(state.rng, {seed: state.rng.seed, state: state.rng.seed}) ||
      !u32(state.rng.seed) || !Array.isArray(state.units) || state.units.length !== ids.length ||
      !state.units.every((unit, index) => {
        const baseline = initialUnit(source.units[index], state.fixture);
        return unit?.id === ids[index] && Number.isInteger(unit.hp) &&
          unit.hp >= 0 && unit.hp <= baseline.hp &&
          typeof unit.disabled === 'boolean' &&
          Number.isSafeInteger(unit.disabledUntil) && unit.disabledUntil >= 0 &&
          (unit.disabled ? unit.disabledUntil > 0 : unit.disabledUntil === 0) &&
          same(unit, {...baseline, hp: unit.hp, disabled: unit.disabled,
            disabledUntil: unit.disabledUntil});
      })) reject('FIRE_CONTRACT_MISMATCH');
  validateIronDustWeaponProbe(state.weaponState);
  if (state.weaponState.rng.seed !== state.rng.seed) reject('FIRE_CONTRACT_MISMATCH');
  return state;
}

// The two commands only check eligibility. Neither direction resolves damage or consumes RNG.
export function queryIronDustFireContractProbe(state, command) {
  validateIronDustFireContractProbe(state);
  if (!command || !['PlayerFire', 'EnemySystemAttack'].includes(command.type))
    return deny('FIRE_CONTRACT_COMMAND_INVALID');
  const keys = command.type === 'PlayerFire' ?
    ['type', 'playerId', 'unitId', 'targetId', 'weaponKey'] :
    ['type', 'playerId', 'attackerId', 'targetId', 'targetKey'];
  if (!same(Object.keys(command).sort(), [...keys].sort()))
    return deny('FIRE_CONTRACT_COMMAND_INVALID');
  if (command.playerId !== state.side) return deny('NOT_ACTIVE_TEAM');
  if (command.type === 'PlayerFire') {
    if (state.phase !== 'fire') return deny('WRONG_PHASE');
    if (command.unitId !== 'ogre') return deny('ATTACK_ACTOR_INVALID');
    const actor = state.units[ids.indexOf('ogre')];
    if (actor.hp <= 0 || actor.disabled) return deny('ATTACK_ACTOR_UNAVAILABLE');
    if (!Object.hasOwn(byId, command.targetId)) return deny('WEAPON_TARGET_INVALID');
    const target = state.units[ids.indexOf(command.targetId)];
    if (target.team !== 'enemy' || target.embarkedOn) return deny('WEAPON_TARGET_INVALID');
    const preflight = createIronDustAttackPreflightProbe(state.rng.seed, {
      fixture: state.fixture === 'boundary' ? 'boundary' : 'source',
      phase: state.phase, weaponState: state.weaponState
    });
    const result = queryIronDustAttackProbe(preflight, {type: 'Fire', playerId: 'player',
      unitId: command.unitId, weaponKey: command.weaponKey, target});
    return result.available ? {...result, direction: 'player-to-unit',
      targetId: target.id, defense: target.defense, turn: state.turn,
      passengerIds: target.passengerIds} : result;
  }
  if (state.phase !== 'enemy') return deny('WRONG_PHASE');
  if (!Object.hasOwn(byId, command.attackerId) ||
      byId[command.attackerId].team !== 'enemy' || byId[command.attackerId].core)
    return deny('SYSTEM_ATTACKER_INVALID');
  if (command.targetId !== 'ogre') return deny('SYSTEM_TARGET_INVALID');
  if (!systemKeys.includes(command.targetKey)) return deny('SYSTEM_TARGET_INVALID');
  const actor = state.units[ids.indexOf(command.attackerId)];
  const target = state.units[ids.indexOf('ogre')];
  if (actor.hp <= 0 || actor.disabled || target.hp <= 0 || target.embarkedOn)
    return deny('SYSTEM_ACTOR_OR_TARGET_UNAVAILABLE');
  if (hexDistance(actor, target) > actor.range) return deny('SYSTEM_OUT_OF_RANGE');
  if (!hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, actor, target))
    return deny('SYSTEM_SIGHT_BLOCKED');
  return {available: true, direction: 'enemy-to-system', attackerId: actor.id,
    targetId: target.id, targetKey: command.targetKey, turn: state.turn};
}
