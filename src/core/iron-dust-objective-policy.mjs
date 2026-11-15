const endPhase = {type: 'EndPhase', playerId: 'player'};
const compareId = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export const PLAYER_KI = 'iron-dust-objective-v1';

export function choosePlayerAction({state, query, queryWithWeapon, hexDistance}) {
  const candidates = [];
  const criteria = state.phase === 'fire' ? ['target-priority', 'actor-priority', 'weapon-priority'] :
    ['actor-priority', 'distance-to-objective', 'row', 'column'];
  const check = (command, rank, result, plannedShot) => {
    const row = {command, rank, status: result.available ? 'selected' : 'rejected',
      reason: result.available ? 'first-legal-candidate' : result.error.code};
    if (plannedShot) row.plannedShot = plannedShot;
    if (result.available && result.cost !== undefined) row.cost = result.cost;
    candidates.push(row);
    return result.available;
  };
  const decide = (command, reason, targetId = null) => ({command,
    explanation: {reason, targetId, checkedCandidates: candidates.length,
      selectionRule: command.type === 'EndPhase' ? 'no-candidate-passed' : 'first-legal-candidate',
      trace: [{stage: state.phase, criteria, candidates}]}});
  const actors = state.units.filter(unit => unit.team === 'player' && unit.hp > 0 && !unit.disabled)
    .sort((a, b) => Number(Boolean(b.ogreSystems)) - Number(Boolean(a.ogreSystems)) ||
      compareId(a.id, b.id));
  const targets = state.units.filter(unit => unit.team === 'enemy' && unit.hp > 0)
    .sort((a, b) => Number(b.id === 'core') - Number(a.id === 'core') ||
      compareId(a.id, b.id));

  if (state.phase === 'fire') {
    for (const [targetPriority, target] of targets.entries()) {
      for (const [actorPriority, actor] of actors.entries()) {
        const fire = {type: 'PlayerFire', playerId: 'player', unitId: actor.id, targetId: target.id};
        const goal = target.id === 'core' ? 'objective' : 'threat';
        if (!actor.ogreSystems) {
          if (check(fire, [targetPriority, actorPriority, 0], query(fire))) {
            return decide(fire, `fire-at-${goal}`, target.id);
          }
          continue;
        }
        // Prefer reusable weapons, then the limited missile, then antipersonnel.
        for (const [weaponPriority, weaponKey] of ['main', 'secondary', 'missiles', 'antipersonnel'].entries()) {
          const rank = [targetPriority, actorPriority, weaponPriority];
          const shot = {...fire, weaponKey};
          if (weaponKey === actor.ogreSystems.selectedWeapon) {
            if (check(shot, rank, query(shot))) return decide(shot, `fire-at-${goal}`, target.id);
            continue;
          }
          const select = {type: 'SelectWeapon', playerId: 'player', unitId: actor.id, weaponKey};
          if (check(select, rank, queryWithWeapon(select, shot), shot)) {
            return decide(select, `select-weapon-for-${goal}`, target.id);
          }
        }
      }
    }
    return decide(endPhase, 'no-usable-action');
  }

  const objective = targets.find(target => target.id === 'core');
  if (!objective) return decide(endPhase, 'no-usable-action');
  for (const [actorPriority, actor] of actors.entries()) {
    if (state.phase === 'gev' ? actor.id !== 'gev' || actor.secondMoved : actor.moved) continue;
    const distance = hexDistance(actor, objective);
    const destinations = [];
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        const to = {x, y};
        const remaining = hexDistance(to, objective);
        if (remaining < distance) destinations.push({to, remaining});
      }
    }
    destinations.sort((a, b) => a.remaining - b.remaining || a.to.y - b.to.y || a.to.x - b.to.x);
    for (const {to, remaining} of destinations) {
      const move = {type: 'Move', playerId: 'player', unitId: actor.id, to};
      if (check(move, [actorPriority, remaining, to.y, to.x], query(move))) {
        return decide(move, 'advance-toward-objective', objective.id);
      }
    }
  }
  return decide(endPhase, 'no-usable-action');
}
