import TerrainRules from '../../terrain-rules-module.mjs';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1} from '../levels/iron-dust-core-data.v1.mjs';
import {createIronDustFireContractProbe, validateIronDustFireContractProbe,
  queryIronDustFireContractProbe} from './iron-dust-fire-contract-probe.mjs';
import {dispatchIronDustWeaponProbe, queryIronDustWeapon} from './iron-dust-weapon-probe.mjs';

export const IRON_DUST_PLAYER_FIRE_VERSION = 'iron-dust-player-fire-dispatch-v1';
const source = validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1);
const weaponKeys = Object.keys(source.units.find(unit => unit.id === 'ogre').ogreSystems.weapons);
const crt = {
  '1-2': ['NE', 'NE', 'NE', 'NE', 'D', 'X'],
  '1-1': ['NE', 'NE', 'D', 'D', 'D', 'X'],
  '2-1': ['NE', 'D', 'D', 'X', 'X', 'X'],
  '3-1': ['D', 'D', 'X', 'X', 'X', 'X'],
  '4-1': ['D', 'X', 'X', 'X', 'X', 'X']
};
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

function ratio(attack, defense) {
  const strength = Math.max(0, attack), guarded = Math.max(1, defense);
  if (strength >= guarded * 5) return '5-1';
  if (strength * 2 < guarded) return '1-2';
  return `${Math.min(4, Math.max(1, Math.floor(strength / guarded)))}-1`;
}

const terrainAt = (x, y) => source.map.terrain.find(cell => cell.x === x && cell.y === y)?.type ??
  source.map.defaultTerrain;

export function createIronDustPlayerFireProbe(seed, options = {}) {
  if (!u32(seed)) reject('PLAYER_FIRE_SETUP_INVALID');
  const contract = createIronDustFireContractProbe(seed, options);
  if (contract.side !== 'player') reject('PLAYER_FIRE_SETUP_INVALID');
  return freeze({
    probeVersion: IRON_DUST_PLAYER_FIRE_VERSION,
    executable: false,
    contract: clone(contract),
    combatRng: {seed, state: seed}
  });
}

export function validateIronDustPlayerFireProbe(state) {
  if (!state || Object.keys(state).length !== 4 ||
      state.probeVersion !== IRON_DUST_PLAYER_FIRE_VERSION || state.executable !== false ||
      !state.combatRng || Object.keys(state.combatRng).length !== 2 ||
      !u32(state.combatRng.seed) || !u32(state.combatRng.state))
    reject('PLAYER_FIRE_MISMATCH');
  validateIronDustFireContractProbe(state.contract);
  if (state.contract.side !== 'player' || state.contract.rng.seed !== state.combatRng.seed)
    reject('PLAYER_FIRE_MISMATCH');
  return state;
}

export function queryIronDustPlayerFireProbe(state, command) {
  validateIronDustPlayerFireProbe(state);
  return queryIronDustFireContractProbe(state.contract, command);
}

export function preflightIronDustPlayerFireProbe(state, command) {
  return queryIronDustPlayerFireProbe(state, command);
}

// Isolated Legacy diagnostic: no Core command registration, replay or browser path.
export function dispatchIronDustPlayerFireProbe(state, command) {
  const query = queryIronDustPlayerFireProbe(state, command);
  if (!query.available) return {error: query.error};
  const next = clone(state);
  const target = next.contract.units.find(unit => unit.id === command.targetId);
  const weaponBefore = queryIronDustWeapon(next.contract.weaponState, command.weaponKey);
  next.combatRng.state = (Math.imul(1664525, next.combatRng.state) + 1013904223) >>> 0;
  const roll = next.combatRng.state % 6;
  const effectiveDefense = target.defense + TerrainRules.coverBonus(terrainAt(target.x, target.y));
  const combatRatio = ratio(query.attack, effectiveDefense);
  const result = combatRatio === '5-1' ? 'X' : crt[combatRatio][roll];
  if (result === 'D') {
    if (target.infantry === true || target.engineering === true || target.id === 'infantry')
      target.hp = Math.max(0, target.hp - 1);
    else if (target.disabled) target.hp = 0;
    else {target.disabled = true; target.disabledUntil = next.contract.turn + 1}
  }
  if (result === 'X') target.hp = 0;
  const spent = dispatchIronDustWeaponProbe(next.contract.weaponState,
    {type: 'SpendWeaponBudget', weaponKey: command.weaponKey});
  next.contract.weaponState = clone(spent.state);
  if (!queryIronDustWeapon(next.contract.weaponState, command.weaponKey).available) {
    const readyKeys = weaponKeys.filter(key =>
      queryIronDustWeapon(next.contract.weaponState, key).available);
    const withTarget = readyKeys.find(key => {
      const trial = clone(next.contract);
      trial.weaponState = clone(dispatchIronDustWeaponProbe(trial.weaponState,
        {type: 'SelectWeapon', weaponKey: key}).state);
      return trial.units.some(unit => unit.team === 'enemy' &&
        queryIronDustFireContractProbe(trial, {type: 'PlayerFire', playerId: 'player',
          unitId: 'ogre', targetId: unit.id, weaponKey: key}).available);
    });
    const fallback = withTarget ?? readyKeys[0];
    if (fallback) next.contract.weaponState = clone(dispatchIronDustWeaponProbe(
      next.contract.weaponState, {type: 'SelectWeapon', weaponKey: fallback}).state);
    else next.contract.weaponState.selectedWeapon = 'main';
  }
  const weaponAfter = queryIronDustWeapon(next.contract.weaponState, command.weaponKey);
  validateIronDustPlayerFireProbe(next);
  return {state: freeze(next), events: [{type: 'PlayerFireResolved',
    attackerId: 'ogre', targetId: target.id, weaponKey: command.weaponKey,
    ratio: combatRatio, roll, result, effectiveDefense,
    hp: target.hp, disabled: target.disabled, disabledUntil: target.disabledUntil,
    passengerIds: target.passengerIds, readyBefore: weaponBefore.ready,
    readyAfter: weaponAfter.ready, selectedWeaponAfter: next.contract.weaponState.selectedWeapon,
    turn: next.contract.turn}]};
}
