// Commands remain reversible only until the current phase is committed.
const phaseCommands = [];
let commandDepth = 0, autoPhaseTimer = null, commandEpoch = 0;
let commandUndoRevision = 0;
let phaseHasCommittedCommand = false;
let phaseRolls = [], phaseRollCursor = 0;

function updateBackButton() {
  const button = document.querySelector('#undo-command');
  if (!button) return;
  button.disabled = !phaseCommands.length || phase !== 'player' || gameOver;
  button.textContent = phaseCommands.length ? `BACK (${phaseCommands.length})` : 'BACK';
  button.title = phaseCommands.length ? `${phaseCommands.at(-1).label} rückgängig machen` : 'Keine Befehle in dieser Phase';
}

function clearPhaseCommands() {
  clearTimeout(autoPhaseTimer);
  autoPhaseTimer = null;
  commandEpoch++;
  phaseCommands.length = 0;
  phaseHasCommittedCommand = false;
  phaseRolls = [];
  phaseRollCursor = 0;
  updateBackButton();
}

function commandSnapshot(label) {
  const snapshot = { label, units: structuredClone(units), terrain: [...terrain], terrainTypes: [...terrainTypes],
    selectedId: selected?.id, focus: focusedCell && {...focusedCell},
    log: fullOwnsPresentation()?'':logEl.innerHTML, rollCursor: phaseRollCursor };
  if(globalThis.GoblinCatalogFullRuntime?.active())snapshot.catalogFull=GoblinCatalogFullRuntime.snapshot();
  globalThis.GoblinLegacyPresentation?.checkpoint(snapshot);
  globalThis.GoblinFullRoundSource?.checkpoint(snapshot);
  globalThis.GoblinCatalogFullRuntime?.checkpointMission?.(snapshot);
  return snapshot;
}

function commandStateKey(list) {
  return JSON.stringify(list.map(({moveFrom, justHit, ...unit}) => unit));
}

function reversibleCommand(action, label, actorId = () => selected?.id) {
  return function(...args) {
    const full=globalThis.GoblinCatalogFullRuntime;
    if(full?.controllerPort?.()&&!full.nativeCommitActive())return {ok:false,code:'FULL_CONTROL_STALE'};
    const ownPhase=full?.active()?['player','enemy'].includes(phase):phase==='player';
    if (commandDepth || !ownPhase || gameOver) return action(...args);
    const before = commandSnapshot(label), epoch = commandEpoch;
    const events = globalThis.GoblinLevelEvents;
    const work = events?.begin(legacySession, actorId(...args));
    let completed = false;
    commandDepth++;
    try { const result = action(...args); completed = true; return result; }
    finally {
      commandDepth--;
      const changed = (work || epoch === commandEpoch) && commandStateKey(before.units) !== commandStateKey(units);
      const hits = events?.finish(work, legacySession, before.units, units, completed && changed, dist, unitAlive);
      const deadlineRemoved = before.catalogFull?.deadlineRemoved === false &&
        globalThis.GoblinCatalogFullRuntime.deadlineRemoved();
      if (hits?.length || deadlineRemoved) {
        // Commit history through the event without resetting the phase's cached dice.
        phaseCommands.length = 0;
        if (epoch === commandEpoch) phaseHasCommittedCommand = true;
        if (hits?.length) events.show(hits,legacySession);
      } else if (epoch === commandEpoch && changed) {
        phaseCommands.push(before);
      }
      updateBackButton();
      if (deadlineRemoved && !gameOver) globalThis.GoblinUIV2?.refresh?.();
    }
  };
}

function undoPhaseCommand() {
  const full=globalThis.GoblinCatalogFullRuntime,port=full?.controllerPort?.();
  if (!phaseCommands.length || (full?.active()?!['player','enemy'].includes(phase):phase!=='player') || gameOver ||
      port&&(!port.canUndo()||!full.nativeUndoActive())) return;
  clearTimeout(autoPhaseTimer);
  autoPhaseTimer = null;
  closePhaseConfirm(false);
  const before = phaseCommands.pop();
  commandUndoRevision++;
  globalThis.GoblinLegacyPresentation?.beforeUndo();
  units.splice(0, units.length, ...structuredClone(before.units));
  units.forEach(unit => { unit.moveFrom = null; unit.justHit = false; });
  terrain = new Set(before.terrain);
  terrainTypes = new Map(before.terrainTypes);
  if(globalThis.GoblinCatalogFullRuntime?.active())GoblinCatalogFullRuntime.restore(before.catalogFull);
  globalThis.GoblinSpecialistsRuntime?.validateRestoredState();
  selected = units.find(unit => unit.id === before.selectedId) || null;
  focusedCell = before.focus;
  transportLoadMode = null;
  transportUnloadMode = null;
  phaseRollCursor = before.rollCursor;
  if(!fullOwnsPresentation())logEl.innerHTML = before.log;
  globalThis.GoblinLegacyPresentation?.afterUndo(before);
  globalThis.GoblinFullRoundSource?.rewind(before);
  globalThis.GoblinCatalogFullRuntime?.rewindMission?.(before);
  updateSelection();
  if (focusedCell) showFieldInfo(focusedCell.x, focusedCell.y);
  if (selected) showUnitInfo(selected);
  draw();
  updateBackButton();
  setToast(`${before.label.toUpperCase()} ZURÜCKGENOMMEN`);
}

// Keep combat dice stable when a shot is undone and issued again.
const originalCombatOutcome = combatOutcome;
combatOutcome = function(...args) {
  const full=globalThis.GoblinCatalogFullRuntime;
  if ((!full?.active()&&phase!=='player')||full?.hasMissionRandom?.()) return originalCombatOutcome(...args);
  const random = Math.random;
  Math.random = () => {
    if (phaseRollCursor === phaseRolls.length) phaseRolls.push(random());
    return phaseRolls[phaseRollCursor++];
  };
  try { return originalCombatOutcome(...args); }
  finally { Math.random = random; }
};

handleHex = reversibleCommand(handleHex, 'Kartenbefehl');
attack = reversibleCommand(attack, 'Feuerbefehl', unit => unit?.id);
embark = reversibleCommand(embark, 'Verladen', unit => unit?.id);
unloadAt = reversibleCommand(unloadAt, 'Entladen', unit => unit?.id);
if(typeof executeSpecialistCommand==='function')executeSpecialistCommand=reversibleCommand(executeSpecialistCommand,'Spezialistenbefehl', command => command?.actorId);

// Give BACK a short opportunity to cancel the automatic phase change.
const originalAutoAdvance = maybeAutoAdvancePhase;
maybeAutoAdvancePhase = function() {
  const full=globalThis.GoblinCatalogFullRuntime;
  const mapPort=full?.mapPort?.();
  if (full?.controllerPort?.()&&!mapPort) return;
  if (GameDialogs.isOpen()) return;
  if (!document.querySelector('#auto-end-turn')?.checked || phase !== 'player' || gameOver || phaseReadyUnits().length) return;
  if (!mapPort && !commandDepth && !phaseCommands.length) return originalAutoAdvance();
  clearTimeout(autoPhaseTimer);
  const epoch = commandEpoch;
  autoPhaseTimer = setTimeout(() => {
    autoPhaseTimer = null;
    const advance = () => {
      if(epoch!==commandEpoch)return;
      if(!mapPort){originalAutoAdvance();return;}
      if(full.mapPort()!==mapPort||!mapPort.state()?.humanReady||GameDialogs.isOpen()||
        !document.querySelector('#auto-end-turn')?.checked||phaseReadyUnits().length)return;
      const previous=turnPhase;
      if(globalThis.GoblinV2Flow?.commitFullMap({type:'EndPhase'})?.ok)
        globalThis.GoblinUIV2?.notifyPhaseSkip(previous);
    };
    if (globalThis.GoblinLevelEvents?.pending(legacySession)) GameDialogs.whenIdle().then(() => {
      if (epoch !== commandEpoch || autoPhaseTimer !== null) return;
      autoPhaseTimer = setTimeout(() => { autoPhaseTimer = null; advance(); }, 2000);
    });
    else advance();
  }, mapPort&&!phaseCommands.length?0:2000);
};

function commitPhaseBefore(action) {
  return function(...args) { clearPhaseCommands(); return action(...args); };
}
setTurnPhase = commitPhaseBefore(setTurnPhase);
const runEnemyTurn = commitPhaseBefore(enemyTurn);
enemyTurn = function(chooseEnemyAction,chooseEnemyFireTarget) {
  ScenarioRuleProfiles.checkEnemyControllers(legacySession,chooseEnemyAction,chooseEnemyFireTarget);
  return runEnemyTurn(chooseEnemyAction,chooseEnemyFireTarget);
};
finish = commitPhaseBefore(finish);

const backButton = document.createElement('button');
backButton.id = 'undo-command';
backButton.className = 'action-button';
backButton.setAttribute('aria-label', 'Letzten Befehl dieser Phase rückgängig machen');
backButton.onclick = undoPhaseCommand;
document.querySelector('#end-turn').before(backButton);
updateBackButton();
