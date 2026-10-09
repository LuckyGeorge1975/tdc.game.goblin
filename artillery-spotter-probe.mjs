// Inactive U08/U09 rule probe; not imported by a game, Core, UI, or replay path.
export const ARTILLERY_SPOTTER_PROBE_VERSION = 'artillery-spotter-v1';
const DATA_PROFILE = 'full-catalog-v1-draft';
const UNITS = Object.freeze({
  'long-range-battery': Object.freeze({source: 'UNIT_CATALOG.howitzer',
    range: 8, defense: 1, movement: 0, mode: 'fixed'}),
  'mobile-siege-gun': Object.freeze({source: 'UNIT_CATALOG.mobileHowitzer',
    range: 6, defense: 2, movement: 1, mode: 'tracked'})
});

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function stateFor(unitId, turn, fired = false) {
  return Object.freeze({version: ARTILLERY_SPOTTER_PROBE_VERSION,
    dataProfileId: DATA_PROFILE, unitId, turn, fired, forceBudgetValue: 2});
}

function validState(state) {
  return exactKeys(state, ['version', 'dataProfileId', 'unitId', 'turn', 'fired', 'forceBudgetValue']) &&
    state.version === ARTILLERY_SPOTTER_PROBE_VERSION && state.dataProfileId === DATA_PROFILE &&
    Object.hasOwn(UNITS, state.unitId) && Number.isSafeInteger(state.turn) && state.turn > 0 &&
    typeof state.fired === 'boolean' && state.forceBudgetValue === 2;
}

export function validateArtillerySpotterProbe(state) {
  if (!validState(state)) reject('INVALID_ARTILLERY_STATE');
  return true;
}

export function createArtillerySpotterProbe(registry, dataProfileId, unitId, turn = 1) {
  if (dataProfileId !== DATA_PROFILE || registry?.schemaVersion !== 1 ||
      registry.legacyProfile !== 'field-test-atlas-v1' ||
      registry.targetProfile !== DATA_PROFILE || registry.targetActive !== false)
    reject('UNSUPPORTED_UNIT_DATA_PROFILE');
  if (typeof unitId !== 'string' || !Object.hasOwn(UNITS, unitId))
    reject('UNSUPPORTED_ARTILLERY_UNIT');
  const expected = UNITS[unitId], target = registry.units?.[unitId]?.target;
  if (target?.source !== expected.source || target.attack !== 6 ||
      target.range !== expected.range || target.defense !== expected.defense ||
      target.mode !== expected.mode || target.setupValue !== 2 ||
      !Array.isArray(target.movement) || target.movement.length !== 1 ||
      target.movement[0] !== expected.movement)
    reject('INVALID_ARTILLERY_PROFILE');
  if (!Number.isSafeInteger(turn) || turn < 1) reject('INVALID_TURN');
  return stateFor(unitId, turn);
}

export function resolveArtilleryFire(state, request) {
  if (!validState(state)) reject('INVALID_ARTILLERY_STATE');
  if (!exactKeys(request, ['phase', 'mode', 'actor', 'target', 'spotter']) ||
      request.phase !== 'fire' || !['direct', 'indirect'].includes(request.mode))
    reject('INVALID_FIRE_MODE');
  const {actor, target, spotter, mode} = request;
  if (!exactKeys(actor, ['id', 'team', 'hp', 'disabled', 'hasLineOfSight']) ||
      actor.id !== state.unitId || !['player', 'enemy'].includes(actor.team) ||
      !Number.isSafeInteger(actor.hp) || actor.hp <= 0 ||
      typeof actor.disabled !== 'boolean' || actor.disabled ||
      typeof actor.hasLineOfSight !== 'boolean') reject('ACTOR_CANNOT_FIRE');
  if (!exactKeys(target, ['id', 'team', 'hp', 'distance']) ||
      typeof target.id !== 'string' || !target.id || target.id === actor.id ||
      !['player', 'enemy'].includes(target.team) || target.team === actor.team ||
      !Number.isSafeInteger(target.hp) || target.hp <= 0 ||
      !Number.isSafeInteger(target.distance) || target.distance < 1)
    reject('INVALID_FIRE_TARGET');
  if (target.distance > UNITS[state.unitId].range) reject('TARGET_OUT_OF_RANGE');
  if (state.fired) reject('WEAPON_SPENT');
  if (mode === 'direct') {
    if (spotter !== null || !actor.hasLineOfSight) reject('DIRECT_LOS_REQUIRED');
  } else if (!exactKeys(spotter, ['id', 'team', 'hp', 'disabled', 'hasLineOfSight']) ||
      typeof spotter.id !== 'string' || !spotter.id || spotter.id === actor.id ||
      spotter.id === target.id ||
      spotter.team !== actor.team || !Number.isSafeInteger(spotter.hp) ||
      spotter.hp <= 0 || typeof spotter.disabled !== 'boolean' || spotter.disabled ||
      spotter.hasLineOfSight !== true) reject('VALID_SPOTTER_REQUIRED');
  const next = stateFor(state.unitId, state.turn, true);
  return Object.freeze({state: next, attack: Object.freeze({mode, targetId: target.id,
    spotterId: mode === 'indirect' ? spotter.id : null, attack: 6,
    range: UNITS[state.unitId].range, rolls: 1})});
}

export function resetArtillerySpotterProbe(state, nextTurn) {
  if (!validState(state)) reject('INVALID_ARTILLERY_STATE');
  if (!Number.isSafeInteger(nextTurn) || nextTurn !== state.turn + 1)
    reject('INVALID_TURN');
  return stateFor(state.unitId, nextTurn);
}
