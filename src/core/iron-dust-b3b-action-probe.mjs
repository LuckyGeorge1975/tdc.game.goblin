import {IRON_DUST_NEAR_CORE_FIXTURE_VERSION, IRON_DUST_FIRE_GEOMETRY_VERSION,
  validateIronDustUnifiedStateProbe,
  queryIronDustFireGeometry} from './iron-dust-unified-state-probe.mjs';
import {queryIronDustB3aAction, dispatchIronDustB3aAction} from './iron-dust-b3a-action-probe.mjs';
import {ironDustCrtRatio} from './iron-dust-crt-ratio.mjs';

export const IRON_DUST_B3B_ACTION_VERSION = 'iron-dust-explicit-core-v2';
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
const deny = code => ({available: false, error: {code}});
const exact = (value, keys) => value && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const unit = (state, id) => state.units.find(item => item.id === id);
const ready = weapon => {
  const remaining = Math.max(0, Math.min(weapon.remaining, weapon.count - weapon.destroyed));
  return weapon.expendable ? remaining : Math.max(0, remaining - weapon.firedThisPhase);
};

export function queryIronDustB3bAction(state, command) {
  validateIronDustUnifiedStateProbe(state);
  if (command?.type !== 'PlayerFire' || command.targetId !== 'core')
    return queryIronDustB3aAction(state, command);
  if (!exact(command, ['type', 'playerId', 'unitId', 'targetId', 'weaponKey']))
    return deny('B3B_COMMAND_INVALID');
  if (!['source', IRON_DUST_NEAR_CORE_FIXTURE_VERSION].includes(state.fixture))
    return deny('B3B_CORE_FIXTURE_UNSUPPORTED');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (state.phase !== 'fire') return deny('WRONG_PHASE');
  if (command.unitId !== 'ogre') return deny('ATTACK_ACTOR_INVALID');
  const actor = unit(state, 'ogre'), target = unit(state, 'core');
  if (actor.hp <= 0 || actor.disabled) return deny('ATTACK_ACTOR_UNAVAILABLE');
  const systems = actor.ogreSystems;
  if (!Object.hasOwn(systems.weapons, command.weaponKey)) return deny('WEAPON_UNKNOWN');
  if (command.weaponKey !== systems.selectedWeapon) return deny('WEAPON_NOT_SELECTED');
  const weapon = systems.weapons[command.weaponKey];
  if (ready(weapon) === 0) return deny('WEAPON_NOT_READY');
  if (target.hp <= 0) return deny('WEAPON_TARGET_INVALID');
  const geometry = queryIronDustFireGeometry(state, 'ogre', 'core', weapon.range,
    {outOfRange: 'WEAPON_OUT_OF_RANGE', sightBlocked: 'WEAPON_SIGHT_BLOCKED'});
  if (!geometry.available) return geometry;
  if (weapon.infantryOnly) return deny('WEAPON_INFANTRY_ONLY');
  return {available: true, attack: weapon.attack, range: weapon.range,
    ready: ready(weapon), losMode: geometry.losMode,
    direction: 'player-to-unit', targetId: 'core', defense: target.defense,
    turn: state.turn, passengerIds: target.passengerIds};
}

export function preflightIronDustB3bAction(state, command) {
  return queryIronDustB3bAction(state, command);
}

export function queryIronDustB3bAttackSurface(state, commands) {
  validateIronDustUnifiedStateProbe(state);
  if (!Array.isArray(commands) || commands.some(command =>
    !['PlayerFire', 'EnemySystemAttack'].includes(command?.type)))
    return {error: {code: 'B3B_ATTACK_SURFACE_INVALID'}};
  return {resolverVersion: IRON_DUST_FIRE_GEOMETRY_VERSION,
    entries: commands.map((command, index) =>
      ({index, ...queryIronDustB3bAction(state, command)}))};
}

// The source roster may reach the core through legal movement; other
// diagnostic fixtures retain their original scope.
export function dispatchIronDustB3bAction(state, command) {
  const query = queryIronDustB3bAction(state, command);
  if (!query.available) return {error: query.error};
  if (command.type !== 'PlayerFire' || command.targetId !== 'core')
    return dispatchIronDustB3aAction(state, command);
  const next = clone(state), actor = unit(next, 'ogre'), target = unit(next, 'core');
  const systems = actor.ogreSystems, weapon = systems.weapons[command.weaponKey];
  const readyBefore = ready(weapon);
  next.rng.state = (Math.imul(1664525, next.rng.state) + 1013904223) >>> 0;
  const roll = next.rng.state % 6;
  const geometry = queryIronDustFireGeometry(next, 'ogre', 'core', weapon.range,
    {outOfRange: 'WEAPON_OUT_OF_RANGE', sightBlocked: 'WEAPON_SIGHT_BLOCKED'});
  const effectiveDefense = target.defense + geometry.cover;
  const combatRatio = ironDustCrtRatio(query.attack, effectiveDefense);
  const result = combatRatio === '5-1' ? 'X' : crt[combatRatio][roll];
  if (result === 'D') {
    if (target.disabled) target.hp = 0;
    else {target.disabled = true; target.disabledUntil = next.turn + 1}
  }
  if (result === 'X') target.hp = 0;
  if (weapon.expendable) weapon.remaining--;
  else weapon.firedThisPhase++;
  actor.fired = true;
  if (target.hp === 0) next.victory = {status: 'ended', winner: 'player'};
  if (ready(weapon) === 0) {
    const keys = Object.keys(systems.weapons);
    const available = keys.filter(key => ready(systems.weapons[key]) > 0);
    const withTarget = available.find(key => {
      const trial = clone(next);
      unit(trial, 'ogre').ogreSystems.selectedWeapon = key;
      return queryIronDustB3bAction(trial,
        {...command, weaponKey: key}).available;
    });
    systems.selectedWeapon = withTarget ?? available[0] ?? 'main';
  }
  const event = {type: 'PlayerFireResolved', attackerId: 'ogre', targetId: 'core',
    weaponKey: command.weaponKey, ratio: combatRatio, roll, result, effectiveDefense,
    hp: target.hp, disabled: target.disabled, disabledUntil: target.disabledUntil,
    passengerIds: target.passengerIds, readyBefore, readyAfter: ready(weapon),
    selectedWeaponAfter: systems.selectedWeapon, turn: next.turn};
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events: [event]};
}
