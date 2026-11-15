import {hexDistance} from './hex.mjs';

const available = unit => unit.alive && !unit.embarkedOn;
const cellKey = ({x,y}) => `${x},${y}`;
const distanceTo = (cell,units) => Math.min(...units.map(unit=>hexDistance(cell,unit)));

function board(batch) {
  const units = new Map(batch.view.units.map(unit=>[unit.id,unit]));
  const opponents = batch.view.units.filter(unit=>available(unit)&&unit.relation==='opponent');
  return {units,opponents};
}

function best(candidates, score) {
  let winner, highest = 0;
  for (const candidate of candidates) {
    const value = score(candidate);
    if (value>highest) { winner=candidate; highest=value; }
  }
  return winner;
}

function finish(candidates) {
  // A native weapon continuation can require an offered shot. It has no pass.
  return candidates.find(({kind})=>kind==='hold'||kind==='end-phase') ??
    candidates.find(({facts})=>facts.baseline) ?? candidates[0];
}

export function selectWeakFullCatalog(batch) {
  const {units,opponents}=board(batch);
  const {candidates}=batch;
  const shot=best(candidates, ({kind,actorId,target,facts})=>{
    if (kind!=='fire'&&kind!=='hex-fire') return 0;
    const targets=kind==='fire'?[units.get(target.unitId)]:
      (facts.hits??[]).map(hit=>units.get(hit.unitId));
    const visible=targets.filter(unit=>unit&&available(unit)&&unit.relation==='opponent');
    return visible.length?1/(1+distanceTo(units.get(actorId),visible)):0;
  });
  if (shot) return shot.key;
  const move=opponents.length&&best(candidates, ({kind,actorId,target})=>{
    if (kind!=='move') return 0;
    const actor=units.get(actorId);
    const before=distanceTo(actor,opponents), after=distanceTo(target,opponents);
    return after<before?1/(1+after):0;
  });
  return (move||finish(candidates))?.key;
}

function expectedEffect(target, {ratioCategory,effectKind,attack}, tactics) {
  if (effectKind==='tread-roll-5-6') return Math.min(target.systems.treads,attack)/3;
  const outcomes=ratioCategory==='5-1'?['X']:tactics.crt[ratioCategory];
  if (!outcomes) return 0;
  const destruction=effectKind==='component-crt'?2:2+target.hp;
  const disruption=effectKind==='component-crt'?0:
    tactics.unitFacts[target.id]?.infantry?1:target.disabled?destruction:1;
  return outcomes.reduce((total,result)=>total+(result==='X'?destruction:result==='D'?disruption:0),0)/outcomes.length;
}

function situation(batch) {
  const {units,opponents}=board(batch);
  const {tactics}=batch.view;
  const defending=batch.side==='enemy';
  const own=batch.view.units.filter(unit=>available(unit)&&unit.relation==='own');
  const core=(defending?own:opponents).find(unit=>unit.objectiveTarget);
  const cover=new Set(tactics.cover.map(cellKey));
  const weaponRange=unit=>unit.disabled?0:tactics.unitFacts[unit.id]?.range??0;
  const threatens=(unit,cell)=>weaponRange(unit)>0&&hexDistance(unit,cell)<=weaponRange(unit);
  const exposed=cell=>opponents.filter(unit=>threatens(unit,cell)).length;
  const safety=cell=>Number(cover.has(cellKey(cell)))-2*exposed(cell);
  const damageFraction=unit=>unit.systems?unit.systems.treads/tactics.unitFacts[unit.id].maxTreads:unit.hp/unit.maxHp;
  const guardingCore=unit=>core&&hexDistance(unit,core)<=2&&!unit.disabled;
  const escorts=defending?own.filter(unit=>unit!==core&&guardingCore(unit)):[];
  const coreThreatened=defending&&core&&opponents.some(unit=>threatens(unit,core));
  const abandonCore=(actor,cell)=>coreThreatened&&escorts.length===1&&escorts[0]===actor&&!guardingCore(cell);
  function priority(actor,target) {
    if (target===core) return 3;
    if (defending&&(core&&threatens(target,core)||escorts.some(unit=>threatens(target,unit)))) return 2;
    if (!defending&&core&&weaponRange(target)>0&&
        hexDistance(actor,target)+hexDistance(target,core)<=hexDistance(actor,core)+2) return 2;
    return 1;
  }
  return {units,opponents,tactics,core,defending,safety,damageFraction,abandonCore,priority};
}

export function selectMediumFullCatalog(batch) {
  const {units,opponents,tactics,core,defending,safety,damageFraction,abandonCore,priority}=situation(batch);
  const {candidates}=batch;
  const retreat=best(candidates, ({kind,actorId,target})=>{
    if (kind!=='move') return 0;
    const actor=units.get(actorId);
    if (damageFraction(actor)>0.5||abandonCore(actor,target)) return 0;
    return safety(target)-safety(actor);
  });
  if (retreat) return retreat.key;

  let bestAttack, bestValue=0;
  for (const candidate of candidates) {
    const {kind,actorId,target,facts}=candidate;
    if (!['fire','hex-fire','ram'].includes(kind)) continue;
    const actor=units.get(actorId);
    const hits=kind==='hex-fire'?facts.hits:[{unitId:target.unitId,...facts}];
    const value=hits.reduce((total,hit)=>{
      const victim=units.get(hit.unitId);
      const effect=kind==='ram'?2+victim.hp:expectedEffect(victim,hit,tactics);
      return total+effect*(victim.relation==='own'?-2:priority(actor,victim));
    },0);
    if (value>bestValue||value>0&&value===bestValue&&bestAttack.facts.expendable&&!facts.expendable) {
      bestAttack=candidate;
      bestValue=value;
    }
  }
  if (bestAttack) return bestAttack.key;

  const position=best(candidates, ({kind,actorId,target,facts})=>{
    const actor=units.get(actorId);
    if (kind==='move') {
      if (abandonCore(actor,target)) return 0;
      const progress=opponents.length?distanceTo(actor,opponents)-distanceTo(target,opponents):0;
      const objective=!defending&&core?(hexDistance(actor,core)-hexDistance(target,core))/2:0;
      return progress+objective+safety(target)-safety(actor);
    }
    if (!['load','deploy','unload'].includes(kind)||!opponents.length) return 0;
    const cargo=kind==='load'?actor:units.get(facts.cargoId);
    if (!cargo?.alive||cargo.disabled) return 0;
    const destination=kind==='load'?units.get(target.unitId):target;
    const goal=!defending&&core?[core]:opponents;
    const progress=distanceTo(cargo,goal)-distanceTo(destination,goal);
    return progress>0?progress+(kind==='load'?0:1)+safety(destination)-safety(cargo):0;
  });
  return (position??finish(candidates))?.key;
}
