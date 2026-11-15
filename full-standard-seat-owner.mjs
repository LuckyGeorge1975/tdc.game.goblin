import {createFullCatalogAiHost} from './src/core/full-catalog-ai-adapter.mjs?v=3';
import {createOwnedFullCatalogSessionHost} from './src/core/full-catalog-session-host.mjs?v=2';
import {selectWeakFullCatalog, selectMediumFullCatalog} from './src/core/full-catalog-difficulty.mjs?v=2';

const standardDefender = 'full-native-standard-defender';

function allowsStandardDefender(config) {
  return config?.ruleProfileId === 'FULL_CATALOG_v1' && config.aiAllowed !== false &&
    !('minimumDifficulty' in config);
}

export function standardFullSeatOffers(config, label) {
  if (!allowsStandardDefender(config)) return null;
  return {player:[], enemy:[{id:standardDefender, label}]};
}

export function selectStandardFullDefender(decision) {
  if (decision.side !== 'enemy') return undefined;
  return decision.candidates.find(candidate=>candidate.facts.baseline === true)?.key;
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
    bind(session, selection, ui, port) {
      const select=fullSeatFallback(session,selection,port);
      return createOwnedFullCatalogSessionHost({port,player,select,onCommit:ui.refresh});
    },
    playerCommands: port => player.humanPlayerOptions(port).map(entry=>entry.command),
    dispatchPlayer: player.dispatch
  });
}
