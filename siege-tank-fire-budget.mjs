// Inactive U07 rule capability. No scenario, Core, Legacy, or UI path imports it.
export const SIEGE_TANK_FIRE_BUDGET_VERSION = 'siege-tank-fire-budget-v1';
const DATA_PROFILE = 'full-catalog-v1-draft';
const UNIT_ID = 'siege-tank';
const WEAPONS = Object.freeze({
  'main-1': Object.freeze({attack: 3, range: 3, infantryOnly: false}),
  'main-2': Object.freeze({attack: 3, range: 3, infantryOnly: false}),
  'main-both': Object.freeze({attack: 6, range: 3, infantryOnly: false}),
  'ap-1': Object.freeze({attack: 1, range: 1, infantryOnly: true}),
  'ap-2': Object.freeze({attack: 1, range: 1, infantryOnly: true})
});
const slots = ['main-1', 'main-2', 'ap-1', 'ap-2'];

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function stateFor(turn, used = [], mainTargets = []) {
  return Object.freeze({version: SIEGE_TANK_FIRE_BUDGET_VERSION,
    dataProfileId: DATA_PROFILE, unitId: UNIT_ID, turn,
    used: Object.freeze([...used]), mainTargets: Object.freeze([...mainTargets])});
}

function validState(state) {
  const mainCount = Array.isArray(state?.used)
    ? state.used.filter(slot => slot === 'main-1' || slot === 'main-2').length : -1;
  return exactKeys(state, ['version', 'dataProfileId', 'unitId', 'turn', 'used', 'mainTargets']) &&
    state.version === SIEGE_TANK_FIRE_BUDGET_VERSION && state.dataProfileId === DATA_PROFILE &&
    state.unitId === UNIT_ID && Number.isSafeInteger(state.turn) && state.turn > 0 &&
    Array.isArray(state.used) && state.used.length <= slots.length &&
    state.used.every((slot, index) => slots.includes(slot) && state.used.indexOf(slot) === index) &&
    Array.isArray(state.mainTargets) && state.mainTargets.length <= 2 &&
    state.mainTargets.every(id => typeof id === 'string' && id.length > 0) &&
    (mainCount === 0 && state.mainTargets.length === 0 ||
      mainCount === 1 && state.mainTargets.length === 1 ||
      mainCount === 2 && [1, 2].includes(state.mainTargets.length)) &&
    (state.mainTargets.length !== 2 || state.mainTargets[0] !== state.mainTargets[1]);
}

export function validateSiegeTankFireBudget(state) {
  if (!validState(state)) reject('INVALID_SIEGE_TANK_STATE');
  return true;
}

export function createSiegeTankFireBudget(registry, dataProfileId, unitId, turn = 1) {
  if (dataProfileId !== DATA_PROFILE || registry?.schemaVersion !== 1 ||
      registry.legacyProfile !== 'field-test-atlas-v1' ||
      registry.targetProfile !== DATA_PROFILE || registry.targetActive !== false)
    reject('UNSUPPORTED_UNIT_DATA_PROFILE');
  if (unitId !== UNIT_ID) reject('UNSUPPORTED_UNIT');
  const target = registry.units?.[UNIT_ID]?.target;
  if (target?.source !== 'UNIT_CATALOG.superheavyTank' || target.attack !== 6 ||
      target.range !== 3 || target.splitFire !== true || target.antipersonnel !== 2)
    reject('INVALID_SIEGE_TANK_PROFILE');
  if (!Number.isSafeInteger(turn) || turn < 1) reject('INVALID_TURN');
  return stateFor(turn);
}

export function resolveSiegeTankFire(state, request) {
  if (!validState(state)) reject('INVALID_SIEGE_TANK_STATE');
  if (!exactKeys(request, ['phase', 'weapon', 'actor', 'target']) ||
      request.phase !== 'fire') reject('INVALID_FIRE_PHASE');
  const {actor, target, weapon} = request;
  if (!exactKeys(actor, ['id', 'team', 'hp', 'disabled']) || actor.id !== UNIT_ID ||
      !['player', 'enemy'].includes(actor.team) || !Number.isSafeInteger(actor.hp) ||
      typeof actor.disabled !== 'boolean' || actor.hp <= 0 || actor.disabled)
    reject('ACTOR_CANNOT_FIRE');
  if (!exactKeys(target, ['id', 'team', 'hp', 'infantry', 'distance', 'hasLineOfSight']) ||
      typeof target.id !== 'string' || !target.id || target.id === actor.id ||
      !['player', 'enemy'].includes(target.team) || target.team === actor.team ||
      !Number.isSafeInteger(target.hp) || target.hp <= 0 ||
      typeof target.infantry !== 'boolean' ||
      !Number.isSafeInteger(target.distance) || target.distance < 1 ||
      typeof target.hasLineOfSight !== 'boolean') reject('INVALID_FIRE_TARGET');
  if (typeof weapon !== 'string' || !Object.hasOwn(WEAPONS, weapon))
    reject('INVALID_WEAPON');
  const spec = WEAPONS[weapon];
  if (target.distance > spec.range || !target.hasLineOfSight ||
      (spec.infantryOnly && !target.infantry)) reject('TARGET_NOT_ATTACKABLE');
  const spent = weapon === 'main-both' ? ['main-1', 'main-2'] : [weapon];
  if (spent.some(slot => state.used.includes(slot))) reject('WEAPON_SPENT');
  if (weapon.startsWith('main-') && state.mainTargets.includes(target.id))
    reject('MAIN_TARGET_ALREADY_FIRED');
  const next = stateFor(state.turn, [...state.used, ...spent],
    weapon.startsWith('main-') ? [...state.mainTargets, target.id] : state.mainTargets);
  return Object.freeze({state: next, attack: Object.freeze({targetId: target.id,
    attack: spec.attack, range: spec.range, rolls: 1,
    slots: Object.freeze(spent)})});
}

export function resetSiegeTankFireBudget(state, nextTurn) {
  if (!validState(state)) reject('INVALID_SIEGE_TANK_STATE');
  if (!Number.isSafeInteger(nextTurn) || nextTurn !== state.turn + 1)
    reject('INVALID_TURN');
  return stateFor(nextTurn);
}
