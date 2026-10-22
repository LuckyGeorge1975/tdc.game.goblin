import {IRON_DUST_NEAR_CORE_FIXTURE_VERSION, IRON_DUST_REST_OGRE_FIXTURE_VERSION,
  IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION,
  IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION, IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION,
  IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION,
  validateIronDustUnifiedStateProbe,
  queryIronDustFireGeometry} from './iron-dust-unified-state-probe.mjs';
import {queryIronDustB1Action, dispatchIronDustB1Action} from './iron-dust-b1-action-probe.mjs';
import {ironDustCrtRatio} from './iron-dust-crt-ratio.mjs';

export const IRON_DUST_B2_ACTION_VERSION = 'iron-dust-explicit-ogre-fire-v1';
const fixtures = ['source', 'adjacent', IRON_DUST_NEAR_CORE_FIXTURE_VERSION,
  IRON_DUST_REST_OGRE_FIXTURE_VERSION, 'boundary', IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION,
  IRON_DUST_INFANTRY_FIRE_FIXTURE_VERSION, IRON_DUST_CORE_ROSTER_FIRE_FIXTURE_VERSION,
  IRON_DUST_BLOCKED_GEV_FIRE_FIXTURE_VERSION];
const targets = ['guard', 'raider'];
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
const weapons = state => unit(state, 'ogre').ogreSystems.weapons;
const selected = state => unit(state, 'ogre').ogreSystems.selectedWeapon;
const ready = weapon => {
  const remaining = Math.max(0, Math.min(weapon.remaining, weapon.count - weapon.destroyed));
  return weapon.expendable ? remaining : Math.max(0, remaining - weapon.firedThisPhase);
};

function fireTarget(state, weaponKey, targetId) {
  if (!targets.includes(targetId)) return deny('B2_TARGET_UNSUPPORTED');
  const target = unit(state, targetId), weapon = weapons(state)[weaponKey];
  if (target.hp <= 0 || target.embarkedOn) return deny('WEAPON_TARGET_INVALID');
  const geometry = queryIronDustFireGeometry(state, 'ogre', targetId, weapon.range,
    {outOfRange: 'WEAPON_OUT_OF_RANGE', sightBlocked: 'WEAPON_SIGHT_BLOCKED'});
  if (!geometry.available) return geometry;
  if (weapon.infantryOnly && target.infantry !== true && target.engineering !== true)
    return deny('WEAPON_INFANTRY_ONLY');
  return {available: true, attack: weapon.attack, range: weapon.range,
    ready: ready(weapon), losMode: geometry.losMode,
    direction: 'player-to-unit', targetId, defense: target.defense,
    turn: state.turn, passengerIds: target.passengerIds};
}

export function queryIronDustB2Action(state, command) {
  validateIronDustUnifiedStateProbe(state);
  if (!fixtures.includes(state.fixture)) return deny('B2_FIXTURE_UNSUPPORTED');
  if (['boundary', IRON_DUST_BLOCKED_FIRE_FIXTURE_VERSION].includes(state.fixture) &&
      state.phase !== 'fire') return deny('B2_FIXTURE_UNSUPPORTED');
  if (!command || typeof command.type !== 'string') return deny('B2_COMMAND_INVALID');
  if (!['SelectWeapon', 'PlayerFire'].includes(command.type)) {
    // B1 has a fixed two-actor pass trace. A destroyed actor cannot execute that trace.
    if (state.phase === 'enemy' && ['EnemyPass', 'EndPhase'].includes(command.type) &&
        ['guard', 'raider'].some(id => unit(state, id).hp === 0))
      return deny('B2_ENEMY_FOLLOWUP_UNSUPPORTED');
    return queryIronDustB1Action(state, command);
  }
  const keys = command.type === 'SelectWeapon' ?
    ['type', 'playerId', 'unitId', 'weaponKey'] :
    ['type', 'playerId', 'unitId', 'targetId', 'weaponKey'];
  if (!exact(command, keys)) return deny('B2_COMMAND_INVALID');
  if (state.victory.status !== 'ongoing') return deny('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return deny('NOT_ACTIVE_TEAM');
  if (state.phase !== 'fire') return deny('WRONG_PHASE');
  if (command.unitId !== 'ogre') return deny('ATTACK_ACTOR_INVALID');
  const actor = unit(state, 'ogre');
  if (actor.hp <= 0 || actor.disabled) return deny('ATTACK_ACTOR_UNAVAILABLE');
  const weapon = weapons(state)[command.weaponKey];
  if (!weapon) return deny('WEAPON_UNKNOWN');
  if (command.type === 'PlayerFire' && command.weaponKey !== selected(state))
    return deny('WEAPON_NOT_SELECTED');
  const available = ready(weapon);
  if (available === 0) return deny('WEAPON_NOT_READY');
  if (command.type === 'SelectWeapon') return {available: true,
    attack: weapon.attack, range: weapon.range, ready: available};
  return fireTarget(state, command.weaponKey, command.targetId);
}

export function preflightIronDustB2Action(state, command) {
  return queryIronDustB2Action(state, command);
}

// Technical state only: no Core registration, replay, AI or product path.
export function dispatchIronDustB2Action(state, command) {
  const query = queryIronDustB2Action(state, command);
  if (!query.available) return {error: query.error};
  if (!['SelectWeapon', 'PlayerFire'].includes(command.type))
    return dispatchIronDustB1Action(state, command);
  const next = clone(state), events = [];
  const actor = unit(next, 'ogre');
  if (command.type === 'SelectWeapon') {
    actor.ogreSystems.selectedWeapon = command.weaponKey;
    events.push({type: 'WeaponSelected', weaponKey: command.weaponKey,
      attack: query.attack, range: query.range, ready: query.ready});
  } else {
    const target = unit(next, command.targetId);
    const weapon = actor.ogreSystems.weapons[command.weaponKey];
    const readyBefore = ready(weapon);
    next.rng.state = (Math.imul(1664525, next.rng.state) + 1013904223) >>> 0;
    const roll = next.rng.state % 6;
    const geometry = queryIronDustFireGeometry(next, 'ogre', target.id, weapon.range,
      {outOfRange: 'WEAPON_OUT_OF_RANGE', sightBlocked: 'WEAPON_SIGHT_BLOCKED'});
    const effectiveDefense = target.defense + geometry.cover;
    const combatRatio = ironDustCrtRatio(query.attack, effectiveDefense);
    const result = combatRatio === '5-1' ? 'X' : crt[combatRatio][roll];
    if (result === 'D') {
      if (target.infantry === true || target.engineering === true || target.id === 'infantry')
        target.hp = Math.max(0, target.hp - 1);
      else if (target.disabled) target.hp = 0;
      else {target.disabled = true; target.disabledUntil = next.turn + 1}
    }
    if (result === 'X') target.hp = 0;
    if (weapon.expendable) weapon.remaining--;
    else weapon.firedThisPhase++;
    actor.fired = true;
    if (ready(weapon) === 0) {
      const keys = Object.keys(actor.ogreSystems.weapons);
      const available = keys.filter(key => ready(actor.ogreSystems.weapons[key]) > 0);
      const withTarget = available.find(key => targets.some(id =>
        fireTarget(next, key, id).available));
      actor.ogreSystems.selectedWeapon = withTarget ?? available[0] ?? 'main';
    }
    events.push({type: 'PlayerFireResolved', attackerId: 'ogre', targetId: target.id,
      weaponKey: command.weaponKey, ratio: combatRatio, roll, result, effectiveDefense,
      hp: target.hp, disabled: target.disabled, disabledUntil: target.disabledUntil,
      passengerIds: target.passengerIds, readyBefore, readyAfter: ready(weapon),
      selectedWeaponAfter: actor.ogreSystems.selectedWeapon, turn: next.turn});
  }
  validateIronDustUnifiedStateProbe(next);
  return {state: freeze(next), events};
}
