const reasons = Object.freeze({
  'advance-toward-objective':'objectiveMove',
  'select-weapon-for-objective':'objectiveWeapon',
  'select-weapon-for-threat':'objectiveWeapon',
  'fire-at-objective':'effectAttack',
  'fire-at-threat':'effectAttack',
  'no-usable-action':'objectivePass',
  'no-objective':'objectivePass'
});

// The native adapter binds the established objective rule's command to a fresh
// legal candidate. The controller receives only the active seat's decision.
export function selectMediumIronDustAttack(decision,report) {
  if (!decision?.ok || decision.side!=='player' || decision.view?.side!=='player') return undefined;
  const selected = decision.candidates.find(candidate =>
    Object.hasOwn(reasons,candidate.facts.objectiveReason));
  if (!selected) return undefined;
  report?.({key:selected.key,explanationKey:'v2.round.'+reasons[selected.facts.objectiveReason]});
  return selected.key;
}
