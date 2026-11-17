export function selectWeakIronDustAttack(decision,report) {
  const fires=decision.candidates.filter(candidate=>Number.isFinite(candidate.facts.weakFireDistance));
  const shot=fires.sort((a,b)=>a.facts.weakFireDistance-b.facts.weakFireDistance||
    Number(b.kind==='fire')-Number(a.kind==='fire'))[0];
  if (shot) {
    report?.({key:shot.key,explanationKey:'v2.round.nearestFire'});
    return shot.key;
  }
  const approaches=decision.candidates.filter(candidate=>candidate.facts.weakApproach);
  const move=approaches.sort((a,b)=>{
    const left=a.facts.weakApproach,right=b.facts.weakApproach;
    return left.distance-right.distance||Number(right.inRange)-Number(left.inRange)||
      a.facts.cost-b.facts.cost||left.remaining-right.remaining;
  })[0];
  const chosen=move??decision.candidates.find(candidate=>candidate.kind==='end-phase');
  if (chosen) report?.({key:chosen.key,explanationKey:`v2.round.${move?'approach':'rulePass'}`});
  return chosen?.key;
}
