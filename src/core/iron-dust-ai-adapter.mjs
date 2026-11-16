import {createAiDecisionAdapter} from './ai-decision-adapter.mjs';
import {dispatchIronDustProfile, dispatchIronDustProfileEnemyFireChoice, dispatchIronDustProfileEnemyMoveChoice, queryIronDustCrtPreview,
  queryIronDustProfile, validateIronDustProfile} from './iron-dust-executable-profile.mjs?v=3';
import {listIronDustEnemyMoveChoices,queryIronDustEnemyFireChoice} from './iron-dust-enemy-turn-controller-probe.mjs?v=2';
import {ironDustCrtRatio} from './iron-dust-crt-ratio.mjs';

export const IRON_DUST_TARGET_FEATURE_VERSION = 'iron-dust-target-bpn-v1';
const ratios = ['1-2', '1-1', '2-1', '3-1', '4-1', '5-1'];
export const IRON_DUST_TARGET_FEATURES = Object.freeze([
  ...ratios.map(ratio => `ratio:${ratio}`), 'objective-target', 'disabled-target'
]);
const automaticEnemy = {type: 'AutoEnemyAdvance', playerId: 'enemy'};
const unavailable = code => ({ok: false, code});
const unitTarget = unitId => ({kind: 'unit', unitId});
const cellTarget = ({x, y}) => ({kind: 'cell', x, y});
const stateOf = profile => profile.entry.mode === 'enemy' ? profile.entry.payload.state : profile.entry.payload;

// Iron Dust v2's current rules expose the roster and terrain to both teams.
// This explicit DTO excludes engine state, seed, replay, journals and cursors.
function project(state, side) {
  const core=state.units.find(unit=>unit.id==='core');
  const playerSurvives=state.units.some(unit=>unit.team==='player'&&unit.hp>0);
  return {
    turn: state.turn, side, phase: state.phase,
    objectives:side==='player'?[
      {kind:'destroy-core',target:unitTarget(core.id),satisfied:core.hp===0},
      {kind:'survive',satisfied:playerSurvives}
    ]:[
      {kind:'destroy-player-force',satisfied:!playerSurvives},
      {kind:'protect-core',target:unitTarget(core.id),satisfied:core.hp>0}
    ],
    terrain: {width: state.map.width, height: state.map.height, defaultTerrain: state.map.defaultTerrain,
      cells: state.map.terrain.map(({x, y, type}) => ({x, y, type}))},
    units: state.units.map(({id, team, x, y, hp, maxHp, disabled, embarkedOn, ogreSystems}) => ({
      id, relation: team === side ? 'own' : 'opponent', x, y, hp, maxHp, disabled,
      embarkedOn, objectiveTarget: id === 'core',
      ...(ogreSystems ? {systems: {treads: ogreSystems.treads,
        weapons: Object.entries(ogreSystems.weapons).map(([id, weapon]) => ({
          id, destroyed: weapon.destroyed, remaining: weapon.remaining, firedThisPhase: weapon.firedThisPhase
        }))}} : {})
    }))
  };
}

function option(command, kind, actorId, target = null, weaponRef = null, facts = {}, executeKind = 'native') {
  return {command, executeKind, candidate: {kind, actorId, target, weaponRef, facts}};
}

function playerFireOptions(profile, state, scope) {
  const options = [];
  for (const actor of state.units.filter(unit => unit.team === 'player')) {
    const weaponRef = actor.ogreSystems?.selectedWeapon ?? null;
    if (scope && (actor.id !== scope.actorId || weaponRef !== scope.weaponRef)) continue;
    for (const target of state.units.filter(unit => unit.team === 'enemy')) {
      const command = {type: 'PlayerFire', playerId: 'player', unitId: actor.id, targetId: target.id,
        ...(weaponRef !== null ? {weaponKey: weaponRef} : {})};
      const preview = queryIronDustCrtPreview(profile, command);
      if (!preview) continue;
      const {ratioCategory} = preview;
      const facts = {ratioCategory, objectiveTarget: target.id === 'core', disabledTarget: target.disabled};
      if (ratios.includes(ratioCategory) && typeof target.disabled === 'boolean') {
        facts.featureVersion = IRON_DUST_TARGET_FEATURE_VERSION;
        facts.features = [...ratios.map(ratio => Number(ratio === ratioCategory)),
          Number(facts.objectiveTarget), Number(target.disabled)];
      }
      options.push(option(command, 'fire', actor.id, unitTarget(target.id), weaponRef, facts));
    }
  }
  return options;
}

function playerOptions(profile, state, scope) {
  if (scope) return playerFireOptions(profile, state, scope);
  const options = [];
  const add = candidate => {
    if (queryIronDustProfile(profile, candidate.command).available) options.push(candidate);
  };
  if (state.phase === 'movement' || state.phase === 'gev') {
    for (const actor of state.units.filter(unit => unit.team === 'player' && unit.hp > 0)) {
      for (let y = 0; y < state.map.height; y++) for (let x = 0; x < state.map.width; x++) {
        const to = {x, y};
        add(option({type: 'Move', playerId: 'player', unitId: actor.id, to}, 'move', actor.id, cellTarget(to)));
      }
      if (actor.id === 'ogre') for (const target of state.units.filter(unit => unit.team === 'enemy')) {
        add(option({type: 'Ram', playerId: 'player', unitId: actor.id, targetId: target.id},
          'ram', actor.id, unitTarget(target.id)));
      }
    }
  }
  if (state.phase === 'fire') {
    options.push(...playerFireOptions(profile, state));
    const ogre = state.units.find(unit => unit.id === 'ogre');
    for (const weaponKey of Object.keys(ogre.ogreSystems.weapons)) {
      add(option({type: 'SelectWeapon', playerId: 'player', unitId: 'ogre', weaponKey},
        'select-weapon', 'ogre', null, weaponKey));
    }
  }
  add(option({type: 'EndPhase', playerId: 'player'}, 'end-phase', null));
  return options;
}

function enemyOptions(profile, state, explicitMovement) {
  const {action} = queryIronDustProfile(profile, automaticEnemy);
  if (action.kind==='move'||action.kind==='hold') {
    return listIronDustEnemyMoveChoices(profile.entry.payload).map(({command,path,cost,baseline})=>{
      const automatic = baseline && !explicitMovement;
      return option(automatic?automaticEnemy:command,command.type==='EnemyMove'?'move':'hold',command.actorId,
        command.to?cellTarget(command.to):null,null,
        {...(path?{path,cost}:{}),...(baseline?{baseline:true}:{}),...(automatic?{automatic:true}:{})},
        automatic?'native':'enemy-move');
    });
  }
  if (action.kind !== 'fire') {
    return [option(automaticEnemy,action.kind,action.actorId??null,null,null,{automatic:true})];
  }
  const options = [];
  for (const target of state.units.filter(unit => unit.team === 'player')) {
    const common = {playerId: 'enemy', attackerId: action.actorId, targetId: target.id};
    if (target.ogreSystems) {
      for (const targetKey of [...Object.keys(target.ogreSystems.weapons), 'treads']) {
        const command = {type: 'EnemySystemAttack', ...common, targetKey};
        if (queryIronDustEnemyFireChoice(profile.entry.payload, command).available) {
          options.push(option(command, 'fire', action.actorId,
            {kind: 'component', unitId: target.id, componentId: targetKey}, null, {}, 'enemy-fire'));
        }
      }
    } else {
      const command = {type: 'EnemyUnitAttack', ...common};
      const query = queryIronDustEnemyFireChoice(profile.entry.payload, command);
      if (query.available) options.push(option(command, 'fire', action.actorId, unitTarget(target.id), null,
        {ratioCategory: ironDustCrtRatio(query.attack, query.effectiveDefense), disabledTarget: target.disabled},
        'enemy-fire'));
    }
  }
  const baseline = options.find(entry => entry.command.type === action.command.type &&
    entry.command.targetId === action.command.targetId && entry.command.targetKey === action.command.targetKey);
  if (baseline) baseline.candidate.facts.baseline = true;
  return options;
}

function describe(profile, side, scope, explicitEnemyMovement) {
  try {validateIronDustProfile(profile)}
  catch {return unavailable('IRON_DUST_PROFILE_MISMATCH')}
  if (profile.entry.mode === 'ended') return unavailable('GAME_ENDED');
  const state = stateOf(profile);
  if (side !== state.activeTeam) return unavailable('NOT_ACTIVE_TEAM');
  if (scope !== undefined && (!scope || typeof scope !== 'object' || Array.isArray(scope) ||
      Object.keys(scope).length !== 2 || !Object.hasOwn(scope, 'actorId') || !Object.hasOwn(scope, 'weaponRef') ||
      side !== 'player' || state.phase !== 'fire' || typeof scope.actorId !== 'string' ||
      !(scope.weaponRef === null || typeof scope.weaponRef === 'string')))
    return unavailable('AI_SCOPE_UNAVAILABLE');
  const options = side === 'player' ? playerOptions(profile, state, scope) : enemyOptions(profile, state, explicitEnemyMovement);
  return {ok: true, phase: state.phase, slot: side === 'enemy' ? profile.entry.payload.cursor.pass :
    scope ? 'fire-target' : state.phase, view: project(state, side), options};
}

export function createIronDustAiAdapter(read, {explicitEnemyMovement = false} = {}) {
  return createAiDecisionAdapter({read,
    describe: (profile, side, scope) => describe(profile, side, scope, explicitEnemyMovement),
    apply(profile,{command,executeKind}) {
    const dispatch=executeKind==='enemy-fire'?dispatchIronDustProfileEnemyFireChoice:
      executeKind==='enemy-move'?dispatchIronDustProfileEnemyMoveChoice:dispatchIronDustProfile;
    const result=dispatch(profile,command);
    return result.profile?{...result,action:structuredClone(command)}:result;
  }});
}
