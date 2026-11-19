import {createFullCatalogAiHost} from './src/core/full-catalog-ai-adapter.mjs?v=5';
import {createOwnedFullCatalogSessionHost} from './src/core/full-catalog-session-host.mjs?v=5';
import {createGameManager,createPlayerController} from './src/core/game-manager.mjs?v=2';
import {selectWeakFullCatalog, selectMediumFullCatalog} from './src/core/full-catalog-difficulty.mjs?v=3';
import {prepareFullAttack2a, FULL_ATTACK_2A_ENGINE, FULL_ATTACK_2A_ID} from './src/core/full-attack-2a.mjs?v=3';
import {prepareDefenderTrial} from './src/core/full-defender-trial.mjs?v=1';
import {createStrongSearchController} from './src/core/strong-search-controller.mjs?v=1';

const standardDefender = 'full-native-standard-defender';

export function createFullGameManager(config,full) {
  const capabilities=full.controllerCapabilities(config);
  if (!capabilities) return null;
  const {level,seats}=capabilities;
  return createGameManager(level,seats);
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
  const searches = new WeakMap();
  const computing = new WeakSet(), hooks = new WeakMap();
  async function selectStrong(batch,port,report,capture) {
    let search = searches.get(port);
    if (!search) {
      search = createStrongSearchController({profile:'FULL_CATALOG_v1',capture,reference:selectMediumFullCatalog,
        onSearch({side,wallMs,workers}) {
          const end=performance.now();
          performance.measure('goblin-ai-search',{start:end-wallMs,end,
            detail:{profile:'FULL_CATALOG_v1',side,workers}});
        }});
      searches.set(port,search);
    }
    computing.add(port);
    hooks.get(port)?.refresh();
    try {return await search.select(batch,report);}
    finally {computing.delete(port);hooks.get(port)?.refresh();}
  }
  for (const side of ['player', 'enemy']) {
    full.registerQualifiedController({side, id:side + '-weak', difficulty:'weak', select:selectWeakFullCatalog});
    full.registerQualifiedController({side, id:side + '-medium', difficulty:'medium', select:selectMediumFullCatalog});
    full.registerQualifiedController({side, id:side + '-strong', difficulty:'strong', select:selectStrong});
  }
  const player = createFullCatalogAiHost(full, globalThis.GoblinSpecialistsUI, full.nativePlayerGateway,
    () => full.controllerPort()?.state()?.side, specialists);

  let readyState = false;
  const unavailable = [];
  const ready = Promise.allSettled([
    (async () => {
      const response = await fetch(new URL('./assets/ai/full-attack-2a.json?v=1',import.meta.url));
      if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
      const {base64} = await response.json();
      const modelBytes = Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
      const select = await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes});
      full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select});
    })(),
    (async () => {
      const id = 'full-defender-control-trial';
      const response = await fetch(new URL('./assets/ai/'+id+'.json',import.meta.url));
      if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
      const select = await prepareDefenderTrial(id,await response.arrayBuffer());
      full.registerQualifiedController({side:'enemy',id,difficulty:null,
        select:(batch,_port,report)=>select(batch,report)});
    })()
  ]).then(results => {
    for (const [index,result] of results.entries()) {
      if (result.status !== 'rejected') continue;
      unavailable.push(index === 0 ? 'player' : 'enemy');
      console.warn('Trained FULL player unavailable:',result.reason.message);
    }
    readyState = true;
  });

  globalThis.GoblinFullSeatOwner = Object.freeze({
    ready,
    get readyState() { return readyState; },
    get unavailable() { return [...unavailable]; },
    computing:port=>computing.has(port),
    offers:config => standardFullSeatOffers(config, GoblinLanguage.t('v2.full.standardDefender')),
    configure:config=>createFullGameManager(config,full),
    nativeSetup:(config,selection)=>fullNativeSetup(createFullGameManager(config,full),selection),
    commitHuman:(port,permit,view,command)=>commitFullHumanCommand(port,permit,view,command,player.dispatch),
    bind(session, selection, ui, port) {
      hooks.set(port,ui);
      const select=fullSeatFallback(session,selection,port);
      const host=createOwnedFullCatalogSessionHost({port,player,select,onCommit:ui.refresh});
      return Object.freeze({...host,
        pause(){searches.get(port)?.invalidate();host.pause();},
        leave(){searches.get(port)?.stop();searches.delete(port);hooks.delete(port);host.leave();}
      });
    },
    playerCommands: port => player.humanPlayerOptions(port).map(entry=>entry.command),
    dispatchPlayer: player.dispatch
  });

}
