import {createFullCatalogAiHost} from './src/core/full-catalog-ai-adapter.mjs?v=4';
import {createOwnedFullCatalogSessionHost} from './src/core/full-catalog-session-host.mjs?v=4';
import {createGameManager,createPlayerController} from './src/core/game-manager.mjs?v=1';
import {selectWeakFullCatalog, selectMediumFullCatalog} from './src/core/full-catalog-difficulty.mjs?v=3';
import {prepareFullAttack2a, FULL_ATTACK_2A_ENGINE, FULL_ATTACK_2A_ID} from './src/core/full-attack-2a.mjs?v=2';

const standardDefender = 'full-native-standard-defender';

export function createFullGameManager(config,full) {
  const capabilities=full.controllerCapabilities(config);
  if (!capabilities) return null;
  const {level,seats}=capabilities;
  return createGameManager(level,{...seats,enemy:{...seats.enemy,
    ai:[{id:standardDefender,difficulty:null},...seats.enemy.ai]}});
}

export function fullNativeSetup(manager,selection) {
  const assignments=manager.assign(selection);
  return Object.freeze({
    roles:Object.freeze(Object.fromEntries(assignments.map(({seatId,controller})=>[seatId,controller]))),
    policyIds:Object.freeze(Object.fromEntries(assignments.flatMap(({seatId,policyId})=>
      policyId && policyId!==standardDefender?[[seatId,policyId]]:[])))
  });
}

export function commitFullHumanCommand(port,permit,view,command,dispatchPlayer) {
  const player=createPlayerController(permit.side,()=>command);
  const selected=player.nextCommand({side:permit.side,view});
  return selected ? port.commit('human',permit,selected,dispatchPlayer) : {ok:false,code:'FULL_CONTROL_STALE'};
}

function allowsStandardDefender(config) {
  return config?.ruleProfileId === 'FULL_CATALOG_v1' && config.aiAllowed !== false &&
    !('minimumDifficulty' in config);
}

export function standardFullSeatOffers(config, label) {
  if (!allowsStandardDefender(config)) return null;
  return {player:[], enemy:[{id:standardDefender, label}]};
}

export function selectStandardFullDefender(decision,report) {
  if (decision.side !== 'enemy') return undefined;
  const key=decision.candidates.find(candidate=>candidate.facts.baseline === true)?.key;
  if (key!==undefined) report?.({key,explanationKey:'v2.round.standardAction'});
  return key;
}

export function fullSeatFallback(session,selection,port) {
  const binding=port.controlBinding();
  if (!binding || port.state()?.sessionId!==session.sessionId) throw Error('FULL_CONTROLLER_NOT_OFFERED');
  const select={};
  for (const side of ['player','enemy']) {
    const id=selection[side];
    const sameHuman=id===null&&binding.roles[side]==='human';
    const sameQualified=binding.roles[side]==='ai'&&binding.policyIds[side]===id&&typeof id==='string';
    if (sameHuman||sameQualified) continue;
    if (side!=='enemy'||id!==standardDefender||binding.roles.enemy!=='ai'||binding.policyIds.enemy!==undefined||
        !allowsStandardDefender(session.config)) throw Error('FULL_CONTROLLER_NOT_OFFERED');
    select.enemy=selectStandardFullDefender;
  }
  return select;
}

if (typeof document !== 'undefined' && globalThis.GoblinV2Flow) {
  const full = globalThis.GoblinCatalogFullRuntime;
  const specialists = globalThis.GoblinSpecialistsRuntime;
  for (const side of ['player', 'enemy']) {
    full.registerQualifiedController({side, id:side + '-weak', difficulty:'weak', select:selectWeakFullCatalog});
    full.registerQualifiedController({side, id:side + '-medium', difficulty:'medium', select:selectMediumFullCatalog});
  }
  const player = createFullCatalogAiHost(full, globalThis.GoblinSpecialistsUI, full.nativePlayerGateway,
    () => full.controllerPort()?.state()?.side, specialists);

  globalThis.GoblinFullSeatOwner = Object.freeze({
    offers:config => standardFullSeatOffers(config, GoblinLanguage.t('v2.full.standardDefender')),
    configure:config=>createFullGameManager(config,full),
    nativeSetup:(config,selection)=>fullNativeSetup(createFullGameManager(config,full),selection),
    commitHuman:(port,permit,view,command)=>commitFullHumanCommand(port,permit,view,command,player.dispatch),
    bind(session, selection, ui, port) {
      const select=fullSeatFallback(session,selection,port);
      return createOwnedFullCatalogSessionHost({port,player,select,onCommit:ui.refresh});
    },
    playerCommands: port => player.humanPlayerOptions(port).map(entry=>entry.command),
    dispatchPlayer: player.dispatch
  });

  void (async () => {
    const response = await fetch(new URL('./assets/ai/full-attack-2a.json?v=1',import.meta.url));
    if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
    const {base64} = await response.json();
    const modelBytes = Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
    const select = await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes});
    full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select});
  })().catch(error => console.warn('Trained FULL attacker unavailable:',error.message));
}
