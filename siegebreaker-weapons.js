(function(root){
  function stateFor(unit){return unit?.ogreSystems||null}
  function weaponEntries(unit){const state=stateFor(unit);return state?Object.entries(state.weapons).map(([key,weapon])=>({key,weapon})):[]}
  function targetAllowed(unit,target,key){
    const state=stateFor(unit),weapon=state?.weapons[key];
    return !!(weapon&&GoblinSystems.weaponReady(weapon)>0&&target?.hp>0&&target.team!==unit.team&&dist(unit,target)<=weapon.range&&lineOfSight(unit,target)&&(!weapon.infantryOnly||target.infantry===true||target.engineering===true));
  }
  function weaponHasTarget(unit,key){return units.some(target=>targetAllowed(unit,target,key))}
  function hasFireAction(unit){return weaponEntries(unit).some(({key,weapon})=>GoblinSystems.weaponReady(weapon)>0&&weaponHasTarget(unit,key))}
  function selectDefaultWeapon(unit){
    const state=stateFor(unit);if(!state)return null;
    if(!state.weapons[state.selectedWeapon]||GoblinSystems.weaponReady(state.weapons[state.selectedWeapon])<=0){
      state.selectedWeapon=weaponEntries(unit).find(({key,weapon})=>GoblinSystems.weaponReady(weapon)>0&&weaponHasTarget(unit,key))?.key||weaponEntries(unit).find(({weapon})=>GoblinSystems.weaponReady(weapon)>0)?.key||'main';
    }
    const weapon=state.weapons[state.selectedWeapon];if(weapon){unit.damage=weapon.attack;unit.range=weapon.range}return weapon;
  }
  function selectWeapon(unit,key){
    const state=stateFor(unit),weapon=state?.weapons[key];if(!weapon||GoblinSystems.weaponReady(weapon)<=0)return false;
    state.selectedWeapon=key;unit.damage=weapon.attack;unit.range=weapon.range;updateSelection();showUnitInfo(unit);draw();return true;
  }
  function renderControls(){
    const panel=$('#weapon-controls');if(!panel)return;
    const unit=selected,state=stateFor(unit);
    if(!state||turnPhase!=='fire'||phase!=='player'||unit.hp<=0){panel.classList.add('hidden');panel.innerHTML='';return}
    selectDefaultWeapon(unit);panel.classList.remove('hidden');panel.innerHTML='';
    weaponEntries(unit).forEach(({key,weapon})=>{const ready=GoblinSystems.weaponReady(weapon),button=document.createElement('button');button.type='button';button.className='weapon-control'+(state.selectedWeapon===key?' active':'');button.disabled=ready<=0;button.innerHTML=`<b>${weapon.label}</b><small>A${weapon.attack} · R${weapon.range} · READY ${ready}</small>`;button.title=ready<=0?'Keine Systeme verfügbar':weaponHasTarget(unit,key)?'Waffe auswählen':'Kein Ziel in Reichweite';button.onclick=event=>{event.stopPropagation();selectWeapon(unit,key)};panel.appendChild(button)});
  }
  root.canSelectedWeaponTarget=function(attacker,target){const state=stateFor(attacker);return !state||targetAllowed(attacker,target,state.selectedWeapon)};
  const basePhaseCanAct=phaseCanAct;
  phaseCanAct=function(unit,phaseName=turnPhase){if(stateFor(unit)&&phaseName==='fire')return unit.team==='player'&&unit.hp>0&&!unit.disabled&&hasFireAction(unit);return basePhaseCanAct(unit,phaseName)};
  const basePhaseDoneLabel=phaseDoneLabel;
  phaseDoneLabel=function(unit){if(stateFor(unit)&&turnPhase==='fire')return weaponEntries(unit).some(({weapon})=>GoblinSystems.weaponReady(weapon)>0)?'NO TARGET':'FIRE DONE';return basePhaseDoneLabel(unit)};
  const baseResetActionState=resetActionState;
  resetActionState=function(){baseResetActionState();units.forEach(unit=>{const state=stateFor(unit);if(state){GoblinSystems.resetFireState(state);unit.fired=false;selectDefaultWeapon(unit)}})};
  const baseUpdateSelection=updateSelection;
  updateSelection=function(){if(selected&&stateFor(selected))selectDefaultWeapon(selected);baseUpdateSelection();renderControls()};
  const baseShowUnitInfo=showUnitInfo;
  showUnitInfo=function(unit){baseShowUnitInfo(unit);const state=stateFor(unit);if(!state)return;const weapon=selectDefaultWeapon(unit),facts=$('#unit-intel-facts');if(weapon)facts.innerHTML+=`<div><span>SELECTED WEAPON</span><b>${weapon.label}</b></div><div><span>ATTACK / RANGE</span><b>${weapon.attack} / ${weapon.range}</b></div>`};
  const baseAttack=attack;
  attack=function(attacker,target){
    const state=stateFor(attacker);if(!state)return baseAttack(attacker,target);
    const weapon=selectDefaultWeapon(attacker),key=state.selectedWeapon;
    if(attacker.disabled){setToast(`${attacker.name} IST DEAKTIVIERT`);return}
    if(turnPhase!=='fire'||!weapon||GoblinSystems.weaponReady(weapon)<=0){setToast('WAFFE IN DIESER PHASE NICHT VERFÜGBAR');return}
    if(!targetAllowed(attacker,target,key)){setToast(weapon.infantryOnly?'NUR GEGEN INFANTERIE':'ZIEL NICHT IN WAFFENREICHWEITE');return}
    const wasDisabled=!!target.disabled;attacker.acted=true;const outcome=combatOutcome(attacker,target),effect=CombatFeedback.describeCombatEffect(target,outcome,wasDisabled);
    GoblinSystems.recordFire(weapon);attacker.fired=!weaponEntries(attacker).some(({weapon:item})=>GoblinSystems.weaponReady(item)>0);target.lastOutcome=outcome.result;target.justHit=true;focusedCell={x:target.x,y:target.y};
    addLog(`${attacker.name} / ${weapon.label} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${effect}.`);reportPassengerHits(attacker,outcome);setToast(effect);
    selectDefaultWeapon(attacker);selected=attacker;updateSelection();showUnitInfo(attacker);draw();setTimeout(()=>{target.justHit=false;draw()},560);if(checkVictory())return;maybeAutoAdvancePhase();
  };
  root.SiegebreakerWeapons=Object.freeze({stateFor,weaponEntries,targetAllowed,hasFireAction,selectWeapon,selectDefaultWeapon,renderControls});
})(globalThis);
