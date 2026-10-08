import { hasLineOfSight, hexDistance, inside, movementPaths, queryAreas, terrainAt } from './hex.mjs';
import TerrainRules from '../../terrain-rules.js';
import { referenceScenario, referenceCommands, REFERENCE_SEED } from './reference-fixture.mjs';
import { phaseScenario, phaseCommands, PHASE_SEED, expectedPhaseTrace } from './phase-fixture.mjs';
import {profileContractError, freezeEffectiveRules,
  CORE_IRON_DUST_GEV_PROBE_CONTRACT, CORE_SIEGE_TANK_PROBE_CONTRACT} from './profile-contract.mjs';
import {ironDustGevProbeScenarioError} from './iron-dust-gev-probe.mjs';
import {siegeTankProbeBudget, siegeTankProbeScenarioError} from './siege-tank-probe.mjs';
import {resolveSiegeTankFire, resetSiegeTankFireBudget,
  validateSiegeTankFireBudget} from '../../siege-tank-fire-budget.mjs';

export { queryAreas } from './hex.mjs';
export { referenceScenario, referenceCommands, REFERENCE_SEED } from './reference-fixture.mjs';
export { phaseScenario, phaseCommands, PHASE_SEED, expectedPhaseTrace } from './phase-fixture.mjs';
export { expectedPhaseReplay } from './phase-expected.mjs';
export {
  enemyDScenario, ENEMY_D_SEED, enemyDCommands,
  secondDScenario, SECOND_D_SEED, secondDCommands,
  infantryDScenario, INFANTRY_D_SEED, infantryDCommands,
  terrainLosScenario, TERRAIN_LOS_SEED, terrainLosCommands,
} from './phase-branches.mjs';

const CRT = Object.freeze({
  '1-2': ['NE', 'NE', 'NE', 'NE', 'D', 'X'],
  '1-1': ['NE', 'NE', 'D', 'D', 'D', 'X'],
  '2-1': ['NE', 'D', 'D', 'X', 'X', 'X'],
  '3-1': ['D', 'D', 'X', 'X', 'X', 'X'],
  '4-1': ['D', 'X', 'X', 'X', 'X', 'X'],
});
const clone = value => JSON.parse(JSON.stringify(value));
const reject = (code, details = {}) => ({ error: { code, details } });
const findUnit = (state, id) => state.units.find(u => u.id === id);

export function createGame(scenario, seed) {
  const profileError = profileContractError(scenario);
  if (profileError) throw Object.assign(new Error(profileError.code), profileError);
  const gevProbe = scenario.rulesVersion === CORE_IRON_DUST_GEV_PROBE_CONTRACT.rulesVersion;
  if (gevProbe) {
    const scenarioError = ironDustGevProbeScenarioError(scenario);
    if (scenarioError) throw Object.assign(new Error(scenarioError.code), scenarioError);
  }
  const siegeProbe = scenario.rulesVersion === CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion;
  if (siegeProbe) {
    const scenarioError = siegeTankProbeScenarioError(scenario);
    if (scenarioError) throw Object.assign(new Error(scenarioError.code), scenarioError);
  }
  if (!Number.isInteger(seed)) throw new TypeError('seed must be an integer');
  if (!scenario?.map || !Array.isArray(scenario?.units)) throw new TypeError('invalid scenario');
  const map = clone(scenario.map), units = clone(scenario.units).map(u => ({ ...u, moved: false, fired: false, secondMoved: false, disabled: false, disabledUntil: 0 }));
  if (gevProbe) units.find(u => u.id === 'gev').movementMode = 'gev';
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1 || !Array.isArray(map.terrain)) throw new TypeError('invalid map');
  if (new Set(units.map(u => u.id)).size !== units.length || units.some(u => !inside(map, u))) throw new TypeError('invalid units');
  return freezeEffectiveRules({ rulesVersion: scenario.rulesVersion, scenarioVersion: scenario.scenarioVersion,
    ...(scenario.scenarioId ? {scenarioId: scenario.scenarioId} : {}),
    ...(scenario.ruleProfileId ? {ruleProfileId: scenario.ruleProfileId} : {}),
    ...(scenario.effectiveRules ? {effectiveRules: clone(scenario.effectiveRules)} : {}), map, units,
    activeTeam: 'player', phase: 'movement', turn: 1, victory: { status: 'ongoing', winner: null },
    rng: { seed: seed >>> 0, state: seed >>> 0 },
    ...(siegeProbe ? {siegeTankFire: siegeTankProbeBudget(1)} : {}) });
}

function nextRoll(rng) {
  rng.state = (Math.imul(1664525, rng.state) + 1013904223) >>> 0;
  return rng.state % 6;
}
function combatRatio(attack, defense) {
  const strength = Math.max(0, attack), guarded = Math.max(1, defense);
  if (strength >= guarded * 5) return '5-1';
  if (strength * 2 < guarded) return '1-2';
  return `${Math.min(4, Math.max(1, Math.floor(strength / guarded)))}-1`;
}
function updateVictory(state, events) {
  const playerAlive = state.units.some(u => u.team === 'player' && u.hp > 0);
  const enemyCoreAlive = state.units.some(u => u.team === 'enemy' && u.core && u.hp > 0);
  if (playerAlive && enemyCoreAlive) return;
  const winner = playerAlive ? 'player' : 'enemy';
  state.victory = { status: 'ended', winner };
  events.push({ type: 'GameEnded', winner });
}
function validateActor(state, command) {
  const unit = findUnit(state, command.unitId);
  if (!unit) return reject('UNIT_NOT_FOUND', { unitId: command.unitId });
  if (unit.team !== command.playerId) return reject('UNIT_NOT_OWNED', { unitId: unit.id });
  if (unit.hp <= 0) return reject('UNIT_DESTROYED', { unitId: unit.id });
  if (unit.disabled) return reject('UNIT_DISABLED', { unitId: unit.id });
  if (unit.embarkedOn) return reject('UNIT_EMBARKED', { unitId: unit.id });
  return { unit };
}

function nextPhaseInfo(state) {
  if (state.phase === 'movement') return { phase: 'fire', activeTeam: state.activeTeam, turn: state.turn };
  if (state.phase === 'fire') return { phase: 'gev', activeTeam: state.activeTeam, turn: state.turn };
  const activeTeam = state.activeTeam === 'player' ? 'enemy' : 'player';
  return { phase: 'movement', activeTeam, turn: state.turn + (activeTeam === 'player' ? 1 : 0) };
}

// One non-mutating preflight for both the UI query and the authoritative command.
function preflight(state, command) {
  if (!state || !command || typeof command.type !== 'string') return reject('INVALID_COMMAND');
  const profileError = profileContractError(state);
  if (profileError) return {error: profileError};
  const siegeProbe = state.rulesVersion === CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion;
  if (siegeProbe) {
    try {
      validateSiegeTankFireBudget(state.siegeTankFire);
      if (state.siegeTankFire.turn !== state.turn) return reject('INVALID_SIEGE_TANK_STATE');
    } catch (error) { return reject(error.code ?? 'INVALID_SIEGE_TANK_STATE'); }
  }
  if (command.type === 'FireWeapon' && !siegeProbe ||
      command.type === 'Fire' && siegeProbe)
    return reject('UNSUPPORTED_COMMAND', {type: command.type, rulesVersion: state.rulesVersion});
  if (state.rulesVersion === CORE_IRON_DUST_GEV_PROBE_CONTRACT.rulesVersion &&
      (command.type === 'Fire' || command.type === 'Move' && command.unitId !== 'gev'))
    return reject('UNSUPPORTED_COMMAND', {type: command.type, rulesVersion: state.rulesVersion});
  if (state.victory.status !== 'ongoing') return reject('GAME_ENDED');
  if (command.playerId !== state.activeTeam) return reject('NOT_ACTIVE_TEAM', { activeTeam: state.activeTeam });
  if (command.type === 'Load' || command.type === 'Unload') return reject('UNSUPPORTED_COMMAND', { type: command.type, rulesVersion: state.rulesVersion });
  if (!['Move', 'Fire', 'FireWeapon', 'EndPhase'].includes(command.type)) return reject('UNKNOWN_COMMAND', { type: command.type });
  if (command.type === 'EndPhase') return {};
  const actor = validateActor(state, command);
  if (actor.error) return actor;
  const unit = actor.unit;
  if (command.type === 'FireWeapon') {
    if (Object.keys(command).length !== 5 ||
        !['type', 'playerId', 'unitId', 'targetId', 'weaponId'].every(key => Object.hasOwn(command, key)) ||
        command.unitId !== 'siege-tank' || typeof command.targetId !== 'string' ||
        !command.targetId || typeof command.weaponId !== 'string')
      return reject('INVALID_COMMAND');
    if (state.phase !== 'fire') return reject('WRONG_PHASE', {phase: state.phase});
    const target = findUnit(state, command.targetId);
    if (!target || target.hp <= 0 || target.team === unit.team || target.embarkedOn)
      return reject('INVALID_TARGET', {targetId: command.targetId});
    try {
      const resolved = resolveSiegeTankFire(state.siegeTankFire, {
        phase: state.phase, weapon: command.weaponId,
        actor: {id: unit.id, team: unit.team, hp: unit.hp, disabled: unit.disabled},
        target: {id: target.id, team: target.team, hp: target.hp,
          infantry: target.infantry === true || target.type === 'infantry',
          distance: hexDistance(unit, target), hasLineOfSight: hasLineOfSight(state, unit, target)}
      });
      return {unit, target, resolved};
    } catch (error) { return reject(error.code ?? 'INVALID_COMMAND'); }
  }
  if (command.type === 'Move') {
    if (state.phase !== 'movement' && state.phase !== 'gev') return reject('WRONG_PHASE', { phase: state.phase });
    if (state.phase === 'gev' && unit.movementMode !== 'gev') return reject('GEV_ONLY', { unitId: unit.id });
    if (state.phase === 'movement' && unit.moved || state.phase === 'gev' && unit.secondMoved) return reject('ACTION_SPENT', { unitId: unit.id });
    if (!inside(state.map, command.to)) return reject('OUT_OF_BOUNDS', { to: command.to });
    const path = movementPaths(state, unit, state.phase === 'gev' ? 2 : unit.move).get(`${command.to.x},${command.to.y}`)?.path;
    if (!path) return reject('UNREACHABLE', { to: command.to });
    return { unit, path };
  }
  if (state.phase !== 'fire') return reject('WRONG_PHASE', { phase: state.phase });
  if (unit.fired) return reject('ACTION_SPENT', { unitId: unit.id });
  const target = findUnit(state, command.targetId);
  if (!target || target.hp <= 0 || target.team === unit.team) return reject('INVALID_TARGET', { targetId: command.targetId });
  if (hexDistance(unit, target) > unit.range || !hasLineOfSight(state, unit, target)) return reject('TARGET_NOT_ATTACKABLE', { targetId: target.id });
  return { unit, target };
}

export function queryCommand(state, command) {
  const check = preflight(state, command);
  return check.error ? { available: false, error: check.error } : { available: true };
}

export function queryWeaponActions(state, unitId) {
  if (state?.rulesVersion !== CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion ||
      unitId !== 'siege-tank' || !Array.isArray(state.units)) return [];
  const unit = findUnit(state, unitId);
  if (!unit) return [];
  const weapons = ['main-1', 'main-2', 'main-both', 'ap-1', 'ap-2'];
  return state.units.filter(target => target.id !== unitId).flatMap(target =>
    weapons.map(weaponId => {
      const probe = queryCommand(state, {type: 'FireWeapon',
        playerId: unit.team, unitId, targetId: target.id, weaponId});
      return {weaponId, targetId: target.id, available: probe.available,
        reason: probe.error?.code ?? null};
    }));
}

function summarizeUnitActions(state, unitId) {
  const unit = findUnit(state, unitId);
  const playerId = unit?.team ?? state.activeTeam;
  const areas = queryAreas(state, unitId);
  const siegeProbe = state.rulesVersion === CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion;
  const movementTargets = areas.movementReachable;
  const weaponActions = siegeProbe ? queryWeaponActions(state, unitId) : [];
  const fireTargetIds = siegeProbe
    ? [...new Set(weaponActions.filter(action => action.available).map(action => action.targetId))]
    : areas.attackableTargets;
  const moveProbe = queryCommand(state, {
    type: 'Move', playerId, unitId, to: movementTargets[0] ?? { x: unit?.x ?? 0, y: unit?.y ?? 0 },
  });
  const fireProbe = siegeProbe
    ? queryCommand(state, {type: 'FireWeapon', playerId, unitId,
      targetId: weaponActions.find(action => action.available)?.targetId ?? unitId,
      weaponId: weaponActions.find(action => action.available)?.weaponId ?? 'main-1'})
    : queryCommand(state, {
    type: 'Fire', playerId, unitId, targetId: fireTargetIds[0] ?? unitId,
  });
  const reason = (probe, emptyCode, fallbackCode) => probe.available ? null
    : probe.error.code === fallbackCode ? emptyCode : probe.error.code;
  return {
    move: { available: moveProbe.available && movementTargets.length > 0,
      reason: reason(moveProbe, 'NO_REACHABLE_HEX', 'UNREACHABLE'), targets: moveProbe.available ? movementTargets : [] },
    fire: { available: fireProbe.available && fireTargetIds.length > 0,
      reason: reason(fireProbe, 'NO_ATTACKABLE_TARGET', 'INVALID_TARGET'), targetIds: fireProbe.available ? fireTargetIds : [],
      ...(siegeProbe ? {weaponActions} : {}) },
  };
}

export function queryActions(state, unitId) {
  if (!state?.map || !Array.isArray(state.units)) throw new TypeError('serializable game state required');
  const ids = unitId === undefined ? state.units.map(unit => unit.id) : [unitId];
  const units = Object.fromEntries(ids.map(id => [id, summarizeUnitActions(state, id)]));
  const pendingUnitIds = state.units.filter(unit => unit.team === state.activeTeam)
    .filter(unit => {
      const actions = units[unit.id] ?? summarizeUnitActions(state, unit.id);
      return state.phase === 'fire' ? actions.fire.available : actions.move.available;
    }).map(unit => unit.id).sort();
  const phase = queryCommand(state, { type: 'EndPhase', playerId: state.activeTeam });
  return {
    units,
    endPhase: { available: phase.available, reason: phase.error?.code ?? null,
      pendingUnitIds, next: phase.available ? nextPhaseInfo(state) : null },
  };
}

export function dispatch(state, command) {
  const check = preflight(state, command);
  if (check.error) return check;

  if (command.type === 'EndPhase') {
    const next = freezeEffectiveRules(clone(state)), previous = next.phase, events = [];
    const transition = nextPhaseInfo(state);
    next.phase = transition.phase;
    next.activeTeam = transition.activeTeam;
    next.turn = transition.turn;
    if (previous === 'gev') {
      for (const u of next.units.filter(u => u.team === next.activeTeam)) {
        u.moved = false; u.fired = false; u.secondMoved = false;
        if (u.hp > 0 && u.disabled && u.disabledUntil <= next.turn) {
          u.disabled = false;
          u.disabledUntil = 0;
          events.push({ type: 'UnitRecovered', unitId: u.id, activeTeam: next.activeTeam, turn: next.turn });
        }
      }
      if (next.rulesVersion === CORE_SIEGE_TANK_PROBE_CONTRACT.rulesVersion &&
          next.activeTeam === 'player')
        next.siegeTankFire = resetSiegeTankFireBudget(next.siegeTankFire, next.turn);
    }
    events.push({ type: 'PhaseChanged', from: previous, to: next.phase, activeTeam: next.activeTeam, turn: next.turn });
    return { state: next, events };
  }

  const unit = check.unit;
  if (command.type === 'Move') {
    const path = check.path;
    const next = freezeEffectiveRules(clone(state)), moving = findUnit(next, unit.id), from = { x: moving.x, y: moving.y };
    moving.x = command.to.x; moving.y = command.to.y;
    if (state.phase === 'gev') moving.secondMoved = true; else moving.moved = true;
    return { state: next, events: [{ type: 'UnitMoved', unitId: unit.id, from, to: clone(command.to), path, phase: state.phase }] };
  }

  const target = check.target;
  const next = freezeEffectiveRules(clone(state)), attacker = findUnit(next, unit.id), defender = findUnit(next, target.id), events = [];
  if (command.type === 'FireWeapon') next.siegeTankFire = check.resolved.state;
  else attacker.fired = true;
  const defense = defender.defense + TerrainRules.coverBonus(terrainAt(next, defender));
  const ratio = combatRatio(command.type === 'FireWeapon'
    ? check.resolved.attack.attack : attacker.damage, defense);
  const roll = nextRoll(next.rng), result = ratio === '5-1' ? 'X' : CRT[ratio][roll];
  if (result === 'X') defender.hp = 0;
  else if (result === 'D') {
    if (defender.infantry === true || defender.type === 'infantry') defender.hp = Math.max(0, defender.hp - 1);
    else if (defender.disabled) defender.hp = 0;
    else {
      defender.disabled = true;
      defender.disabledUntil = next.turn + (attacker.team === 'enemy' ? 2 : 1);
    }
  }
  events.push({ type: 'ShotResolved', attackerId: unit.id, targetId: target.id, roll, ratio, result, hpBefore: target.hp, hpAfter: defender.hp, disabled: defender.disabled,
    ...(command.type === 'FireWeapon' ? {weaponId: command.weaponId,
      slots: check.resolved.attack.slots, attack: check.resolved.attack.attack} : {}) });
  updateVictory(next, events);
  return { state: next, events };
}

// Single source of truth for the Developer's mock-vs-core comparison.
export function replayReference() {
  const initialState = createGame(referenceScenario, REFERENCE_SEED);
  let state = initialState;
  const steps = referenceCommands.map(command => {
    const result = dispatch(state, command);
    if (result.state) state = result.state;
    return { command: clone(command), result };
  });
  return { initialState, steps, finalState: state };
}

export function replayPhase() {
  const initialState = createGame(phaseScenario, PHASE_SEED);
  let state = initialState;
  const steps = phaseCommands.map(command => {
    const result = dispatch(state, command);
    if (result.state) state = result.state;
    return { command: clone(command), result };
  });
  return { initialState, steps, finalState: state };
}
