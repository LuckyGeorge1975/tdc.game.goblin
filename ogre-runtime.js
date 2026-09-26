(function(root){
  function ensureState(unit){
    if(unit?.id==='ogre'&&!unit.ogreSystems)unit.ogreSystems=GoblinSystems.createMarkIII();
    return unit?.ogreSystems||null;
  }
  function syncUnit(unit){
    const state=ensureState(unit);if(!state)return unit;
    unit.move=GoblinSystems.movementForTreads(state.treads);
    if(GoblinSystems.isHelpless(state))unit.hp=0;
    return unit;
  }
  function resolveSystemAttack(attacker,target,targetKey){
    const state=ensureState(target),system=targetKey?GoblinSystems.targets(state).find(item=>item.key===targetKey):GoblinSystems.chooseTarget(state);
    if(!system)return null;
    const roll=Math.floor(Math.random()*6);
    let ratio,result;
    if(system.type==='treads'){
      ratio='1-1';result=roll>=4?'X':'NE';
    }else{
      ratio=combatRatio(attacker.damage,system.defense);
      result=ratio==='5-1'?'X':COMBAT_RULES.crt[ratio][roll];
    }
    const applied=GoblinSystems.applyHit(state,system.key,result,attacker.damage);
    syncUnit(target);
    return {system,ratio,result,roll,...applied};
  }
  function describeHit(outcome){
    if(outcome.system.type==='treads')return outcome.loss?`${outcome.loss} KETTENEINHEITEN ZERSTÖRT`:'KEIN EFFEKT';
    return outcome.loss?'SYSTEM ZERSTÖRT':outcome.result==='D'?'D OHNE WIRKUNG':'KEIN EFFEKT';
  }
  function renderIntel(unit){
    const state=ensureState(unit);if(!state)return;
    const summary=GoblinSystems.summary(state),facts=$('#unit-intel-facts');
    facts.innerHTML+=`<div><span>TREADS</span><b>${summary.treads} · MOVE ${summary.movement}</b></div>`+
      `<div><span>MAIN / SECONDARY</span><b>${summary.weapons.main} / ${summary.weapons.secondary}</b></div>`+
      `<div><span>MISSILES / AP</span><b>${summary.weapons.missiles} / ${summary.weapons.antipersonnel}</b></div>`;
  }

  const baseShowUnitInfo=showUnitInfo;
  showUnitInfo=function(unit){baseShowUnitInfo(unit);renderIntel(unit)};

  const baseDraw=draw;
  draw=function(){units.forEach(syncUnit);return baseDraw()};

  enemyFire=function(foe){
    if(foe.hp<=0||foe.disabled)return false;
    const targets=units.filter(unit=>unit.team==='player'&&unit.hp>0&&!unit.embarkedOn).sort((a,b)=>dist(foe,a)-dist(foe,b));
    const target=targets.find(unit=>dist(foe,unit)<=foe.range&&lineOfSight(foe,unit));
    if(!target)return false;
    if(ensureState(target)){
      const outcome=resolveSystemAttack(foe,target),effect=describeHit(outcome);
      target.justHit=true;target.lastOutcome=outcome.result;
      addLog(`${foe.name} feuert auf ${target.name} / ${outcome.system.label}: ${outcome.result} bei ${outcome.ratio} — ${effect}.`,true);
      setTimeout(()=>{target.justHit=false;draw()},560);
      return true;
    }
    const outcome=combatOutcome(foe,target);target.justHit=true;
    addLog(`${foe.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${outcome.result==='X'?'ZIEL AUSGESCHALTET':outcome.result==='D'?'ZIEL DEAKTIVIERT':'KEIN EFFEKT'}.`,true);
    reportPassengerHits(foe,outcome,true);setTimeout(()=>{target.justHit=false;draw()},560);return true;
  };

  units.forEach(syncUnit);
  root.GoblinOgreRuntime=Object.freeze({ensureState,syncUnit,resolveSystemAttack,describeHit});
})(globalThis);
