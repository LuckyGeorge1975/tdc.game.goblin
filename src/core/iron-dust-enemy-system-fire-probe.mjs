import {createIronDustFireContractProbe, validateIronDustFireContractProbe,
  queryIronDustFireContractProbe} from './iron-dust-fire-contract-probe.mjs';
import {createIronDustSystemProbe, validateIronDustSystemProbe,
  queryIronDustSystemProbe, dispatchIronDustSystemProbe} from './iron-dust-system-probe.mjs';

export const IRON_DUST_ENEMY_SYSTEM_FIRE_VERSION = 'iron-dust-enemy-system-fire-v1';
const enemyActors = ['guard', 'raider'];
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const reject = code => {throw Object.assign(new Error(code), {code})};
const deny = code => ({available: false, error: {code}});

export function createIronDustEnemySystemFireProbe(seed, options = {}) {
  const {fixture = 'adjacent', side = 'enemy', phase = side === 'enemy' ? 'enemy' : 'fire',
    turn = 1, systemState = createIronDustSystemProbe(seed)} = options ?? {};
  if (!['source', 'adjacent'].includes(fixture)) reject('ENEMY_SYSTEM_SETUP_INVALID');
  validateIronDustSystemProbe(systemState);
  if (systemState.rng.seed !== seed) reject('ENEMY_SYSTEM_SETUP_INVALID');
  const contract = clone(createIronDustFireContractProbe(seed, {fixture, side, phase, turn}));
  contract.units.find(unit => unit.id === 'ogre').hp = systemState.unit.hp;
  return freeze({
    probeVersion: IRON_DUST_ENEMY_SYSTEM_FIRE_VERSION,
    executable: false,
    contract,
    systemState: clone(systemState),
    firedActorIds: []
  });
}

export function validateIronDustEnemySystemFireProbe(state) {
  if (!state || Object.keys(state).length !== 5 ||
      state.probeVersion !== IRON_DUST_ENEMY_SYSTEM_FIRE_VERSION || state.executable !== false ||
      !Array.isArray(state.firedActorIds) ||
      state.firedActorIds.some((id, index) => id !== enemyActors.filter(actor =>
        state.firedActorIds.includes(actor))[index])) reject('ENEMY_SYSTEM_MISMATCH');
  validateIronDustFireContractProbe(state.contract);
  validateIronDustSystemProbe(state.systemState);
  if (!['source', 'adjacent'].includes(state.contract.fixture) ||
      state.contract.rng.seed !== state.systemState.rng.seed ||
      state.contract.units.find(unit => unit.id === 'ogre').hp !== state.systemState.unit.hp)
    reject('ENEMY_SYSTEM_MISMATCH');
  return state;
}

export function queryIronDustEnemySystemFireProbe(state, command) {
  validateIronDustEnemySystemFireProbe(state);
  const direction = queryIronDustFireContractProbe(state.contract, command);
  if (!direction.available) return direction;
  if (command.type !== 'EnemySystemAttack') return deny('ENEMY_SYSTEM_COMMAND_INVALID');
  if (state.firedActorIds.includes(command.attackerId)) return deny('ACTION_SPENT');
  const systems = queryIronDustSystemProbe(state.systemState);
  if (!systems.targets.includes(command.targetKey)) return deny('SYSTEM_TARGET_INVALID');
  return {...direction, availableSystemTargets: systems.targets};
}

export function preflightIronDustEnemySystemFireProbe(state, command) {
  return queryIronDustEnemySystemFireProbe(state, command);
}

// The attacker and system are explicit. No AI, target choice, phase transition or Core registration.
export function dispatchIronDustEnemySystemFireProbe(state, command) {
  const query = queryIronDustEnemySystemFireProbe(state, command);
  if (!query.available) return {error: query.error};
  const resolved = dispatchIronDustSystemProbe(state.systemState,
    {type: 'ResolveSystemAttack', attackerId: command.attackerId, targetKey: command.targetKey});
  const next = clone(state);
  next.systemState = clone(resolved.state);
  next.contract.units.find(unit => unit.id === 'ogre').hp = resolved.state.unit.hp;
  next.firedActorIds.push(command.attackerId);
  next.firedActorIds.sort((a, b) => enemyActors.indexOf(a) - enemyActors.indexOf(b));
  validateIronDustEnemySystemFireProbe(next);
  const outcome = resolved.events[0];
  return {state: freeze(next), events: [{type: 'EnemySystemFireResolved',
    attackerId: outcome.attackerId, targetId: 'ogre', targetKey: outcome.targetKey,
    ratio: outcome.ratio, roll: outcome.roll, result: outcome.result,
    loss: outcome.loss, remaining: outcome.remaining, movement: outcome.movement,
    hp: outcome.hp, helpless: outcome.helpless, turn: next.contract.turn}]};
}
