(function(root){
  const STRIKE=Object.freeze({directAttack:6,splashAttack:3,radius:1});
  const isCarrier=unit=>unit?.strategicMissile===true;
  const ready=unit=>isCarrier(unit)&&unit.missilesRemaining>0;

  const basePhaseCanAct=phaseCanAct;
  phaseCanAct=function(unit,phaseName=turnPhase){
    if(isCarrier(unit)&&phaseName==='fire')return ready(unit)&&basePhaseCanAct(unit,phaseName);
    return basePhaseCanAct(unit,phaseName);
  };

  const basePhaseDoneLabel=phaseDoneLabel;
  phaseDoneLabel=function(unit){
    if(isCarrier(unit)&&turnPhase==='fire'&&!ready(unit))return 'MISSILE SPENT';
    return basePhaseDoneLabel(unit);
  };

  const baseWeaponTargetAllowed=weaponTargetAllowed;
  weaponTargetAllowed=function(attacker,target){
    return (!isCarrier(attacker)||ready(attacker))&&baseWeaponTargetAllowed(attacker,target);
  };

  const baseShowUnitInfo=showUnitInfo;
  showUnitInfo=function(unit){
    baseShowUnitInfo(unit);
    if(isCarrier(unit))$('#unit-intel-facts').innerHTML+=`<div><span>MISSILE</span><b>${unit.missilesRemaining}/1</b></div><div><span>BLAST</span><b>6 DIRECT · 3 ADJACENT</b></div><div><span>FRIENDLY FIRE</span><b>POSSIBLE</b></div>`;
  };

  const baseAttack=attack;
  attack=function(attacker,target){
    if(!isCarrier(attacker))return baseAttack(attacker,target);
    if(phase!=='player'||turnPhase!=='fire'||attacker.hp<=0||attacker.disabled||attacker.fired||!ready(attacker)||!target||target.team===attacker.team||target.hp<=0||dist(attacker,target)>attacker.range||!lineOfSight(attacker,target)){
      setToast('LENKFLUGKÖRPER NICHT VERFÜGBAR');return;
    }
    const impact={x:target.x,y:target.y};
    const affected=units.filter(unit=>unit.hp>0&&!unit.embarkedOn&&dist(unit,impact)<=STRIKE.radius)
      .sort((left,right)=>Number(right===target)-Number(left===target));
    attacker.missilesRemaining--;
    attacker.fired=true;
    attacker.acted=true;
    addLog(`${attacker.name} startet Lenkflugkörper auf ${target.name} (${String.fromCharCode(65+impact.x)}-${String(impact.y+1).padStart(2,'0')}).`);
    for(const unit of affected){
      const originalAttack=attacker.damage;
      attacker.damage=unit===target?STRIKE.directAttack:STRIKE.splashAttack;
      const outcome=combatOutcome(attacker,unit);
      attacker.damage=originalAttack;
      unit.lastOutcome=outcome.result;
      unit.justHit=true;
      addLog(`${unit.name}${unit.team===attacker.team?' (EIGENE EINHEIT)':''}: ${outcome.result} bei ${outcome.ratio}${unit===target?' · DIREKTTREFFER':' · DRUCKWELLE'}.`);
      reportPassengerHits(attacker,outcome);
      setTimeout(()=>{unit.justHit=false;draw()},560);
    }
    focusedCell=impact;
    selected=null;
    setToast(`LENKFLUGKÖRPER · ${affected.length} ZIELE ERFASST`);
    updateSelection();draw();
    if(checkVictory())return;
    maybeAutoAdvancePhase();
  };

  root.StrategicMissile=Object.freeze({STRIKE,isCarrier,ready});
})(globalThis);
