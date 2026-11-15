import {createFullCatalogAiHost} from './src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from './src/core/full-catalog-session-host.mjs';

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

if (typeof document !== 'undefined' && globalThis.GoblinV2Flow) {
  const full = globalThis.GoblinCatalogFullRuntime;
  const specialists = globalThis.GoblinSpecialistsRuntime;
  const player = createFullCatalogAiHost(full, globalThis.GoblinSpecialistsUI, {
    query(command) {
      if (command.type === 'Move') return full.moveQuery(command);
      if (command.type === 'CatalogHexFire') return full.hexQuery(command);
      return specialists.query(command);
    },
    dispatch(command, revision) {
      if (full.commandRevision() !== revision) return {ok:false};
      try {
        executeSpecialistCommand(command);
        return {ok:full.commandRevision() !== revision};
      } catch (error) {
        return {ok:false,code:error.code ?? error.message};
      }
    }
  }, () => full.controllerPort()?.state()?.side, specialists);

  globalThis.GoblinFullSeatOwner = Object.freeze({
    offers:config => standardFullSeatOffers(config, GoblinLanguage.t('v2.full.standardDefender')),
    bind(session, selection, ui, port, policyIds = {}) {
      const standard = selection.enemy === standardDefender;
      if ((selection.player !== null && selection.player !== policyIds.player) ||
          (selection.enemy !== null && selection.enemy !== policyIds.enemy && !standard) ||
          (standard && !allowsStandardDefender(session.config))) throw Error('FULL_CONTROLLER_NOT_OFFERED');
      const select = standard ? {enemy:selectStandardFullDefender} : {};
      return createOwnedFullCatalogSessionHost({port,player,select,onCommit:ui.refresh});
    },
    playerCommands: () => player.playerOptions().map(entry=>entry.command),
    dispatchPlayer: player.dispatch
  });
}
