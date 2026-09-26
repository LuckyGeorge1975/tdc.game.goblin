// Commands remain reversible only until the current phase is committed.
const phaseCommands = [];
let commandDepth = 0, autoPhaseTimer = null, commandEpoch = 0;
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
  phaseRolls = [];
  phaseRollCursor = 0;
  updateBackButton();
}

function commandSnapshot(label) {
  return { label, units: structuredClone(units), terrain: [...terrain],
    selectedId: selected?.id, focus: focusedCell && {...focusedCell},
    log: logEl.innerHTML, rollCursor: phaseRollCursor };
}

function commandStateKey(list) {
  return JSON.stringify(list.map(({moveFrom, justHit, ...unit}) => unit));
}

function reversibleCommand(action, label) {
  return function(...args) {
    if (commandDepth || phase !== 'player' || gameOver) return action(...args);
    const before = commandSnapshot(label), epoch = commandEpoch;
    commandDepth++;
    try { return action(...args); }
    finally {
      commandDepth--;
      if (epoch === commandEpoch && commandStateKey(before.units) !== commandStateKey(units)) {
        phaseCommands.push(before);
      }
      updateBackButton();
    }
  };
}

function undoPhaseCommand() {
  if (!phaseCommands.length || phase !== 'player' || gameOver) return;
  clearTimeout(autoPhaseTimer);
  autoPhaseTimer = null;
  closePhaseConfirm(false);
  const before = phaseCommands.pop();
  units.splice(0, units.length, ...structuredClone(before.units));
  units.forEach(unit => { unit.moveFrom = null; unit.justHit = false; });
  terrain = new Set(before.terrain);
  selected = units.find(unit => unit.id === before.selectedId) || null;
  focusedCell = before.focus;
  transportLoadMode = null;
  transportUnloadMode = null;
  phaseRollCursor = before.rollCursor;
  logEl.innerHTML = before.log;
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
  if (phase !== 'player') return originalCombatOutcome(...args);
  const random = Math.random;
  Math.random = () => {
    if (phaseRollCursor === phaseRolls.length) phaseRolls.push(random());
    return phaseRolls[phaseRollCursor++];
  };
  try { return originalCombatOutcome(...args); }
  finally { Math.random = random; }
};

handleHex = reversibleCommand(handleHex, 'Kartenbefehl');
attack = reversibleCommand(attack, 'Feuerbefehl');
embark = reversibleCommand(embark, 'Verladen');
unloadAt = reversibleCommand(unloadAt, 'Entladen');

// Give BACK a short opportunity to cancel the automatic phase change.
const originalAutoAdvance = maybeAutoAdvancePhase;
maybeAutoAdvancePhase = function() {
  if (GameDialogs.isOpen()) return;
  if (!document.querySelector('#auto-end-turn')?.checked || phase !== 'player' || gameOver || phaseReadyUnits().length) return;
  if (!commandDepth && !phaseCommands.length) return originalAutoAdvance();
  clearTimeout(autoPhaseTimer);
  const epoch = commandEpoch;
  autoPhaseTimer = setTimeout(() => {
    autoPhaseTimer = null;
    if (epoch === commandEpoch) originalAutoAdvance();
  }, 2000);
};

function commitPhaseBefore(action) {
  return function(...args) { clearPhaseCommands(); return action(...args); };
}
setTurnPhase = commitPhaseBefore(setTurnPhase);
enemyTurn = commitPhaseBefore(enemyTurn);
loadScenario = commitPhaseBefore(loadScenario);
reset = commitPhaseBefore(reset);
finish = commitPhaseBefore(finish);

const backButton = document.createElement('button');
backButton.id = 'undo-command';
backButton.className = 'action-button';
backButton.setAttribute('aria-label', 'Letzten Befehl dieser Phase rückgängig machen');
backButton.onclick = undoPhaseCommand;
document.querySelector('#end-turn').before(backButton);
updateBackButton();
