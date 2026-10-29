// The fixed U07 mission uses the existing pure fire-budget resolver. Other profiles never opt in.
(function(root){
  const keys=['main-1','main-2','main-both','ap-1','ap-2'];
  const labels={'main-1':'Hauptgeschütz 1','main-2':'Hauptgeschütz 2','main-both':'Beide Hauptgeschütze','ap-1':'Infanterieabwehr 1','ap-2':'Infanterieabwehr 2'};
  const active=unit=>legacySession?.scenarioId==='siege-pilot'&&legacySession.ruleProfileId==='CATALOG_SIEGE_PILOT_v1'&&unit?.id==='siege-tank';
  const label=key=>{const id=key==='main-both'?'v2.ui.siege.combined':key?.startsWith('main-')?'v2.ui.siege.mainGun':'v2.ui.siege.ap';const text=root.GoblinLanguage?.t(id,{number:key?.at(-1)});return text&&text!==id?text:labels[key]};
  function message(code,key,target){
    if(code==='TARGET_NOT_ATTACKABLE'&&key?.startsWith('ap-')&&target&&!target.infantry)return root.GoblinLanguage?.translate('NUR GEGEN INFANTERIE')||'NUR GEGEN INFANTERIE';
    const id=code==='MAIN_TARGET_ALREADY_FIRED'?'v2.reject.siege.sameMainTarget':code==='WEAPON_SPENT'?(key==='main-both'?'v2.reject.siege.combinedNotReady':'v2.area.weaponEmpty'):code==='TARGET_NOT_ATTACKABLE'?'ui.error.TARGET_NOT_ATTACKABLE':code==='INVALID_FIRE_PHASE'?'ui.error.WRONG_PHASE':'ui.error.INVALID_COMMAND';
    return root.GoblinLanguage?.t(id)||'Waffe oder Ziel für diesen Schuss nicht verfügbar.';
  }
  function weapons(unit){
    if(!active(unit))return null;
    const used=unit.siegeFireBudget?.used??[];
    return Object.fromEntries(keys.map(key=>[key,{...GoblinSiegeBudget.WEAPONS[key],label:label(key),
      ready:(key==='main-both'?['main-1','main-2']:[key]).some(slot=>used.includes(slot))?0:1}]));
  }
  function query(unit,target,key=unit?.siegeWeapon){
    try{
      if(!active(unit)||phase!=='player'||gameOver||unit.siegeFireBudget?.turn!==turn)throw new Error('ACTOR_CANNOT_FIRE');
      const result=GoblinSiegeBudget.resolveSiegeTankFire(unit.siegeFireBudget,{phase:turnPhase,weapon:key,
        actor:{id:unit.id,team:unit.team,hp:unit.hp,disabled:!!unit.disabled},
        target:{id:target?.id,team:target?.team,hp:target?.hp,infantry:target?.infantry===true,
          distance:target?dist(unit,target):0,hasLineOfSight:!!target&&!target.embarkedOn&&lineOfSight(unit,target)}});
      return {ok:true,next:result.state,weapon:{key,label:label(key),...result.attack}};
    }catch(error){return {ok:false,code:error.code??error.message,reason:message(error.code??error.message,key,target)}}
  }
  const hasTarget=(unit,key)=>units.some(target=>query(unit,target,key).ok);
  function selectDefault(unit){
    const list=weapons(unit);if(!list)return;
    if(!list[unit.siegeWeapon]?.ready)unit.siegeWeapon=keys.find(key=>list[key].ready&&hasTarget(unit,key))??keys.find(key=>list[key].ready)??null;
  }
  function selectWeapon(unit,key){
    if(!active(unit)||root.GoblinMovement?.busy()||phase!=='player'||turnPhase!=='fire'||gameOver||unitDead(unit)||unit.disabled||!weapons(unit)?.[key]?.ready)return false;
    unit.siegeWeapon=key;updateSelection();draw();return true;
  }
  function summary(unit){return Object.entries(weapons(unit)??{}).filter(([key])=>key!=='main-both').map(([key,w])=>`${label(key)}: ${w.ready}`).join(' · ')}
  function renderControls(){
    const panel=$('#weapon-controls');if(!panel||!active(selected))return;
    panel.innerHTML='';panel.classList.toggle('hidden',turnPhase!=='fire'||phase!=='player');
    if(turnPhase!=='fire'||phase!=='player')return;
    for(const [key,w] of Object.entries(weapons(selected))){
      const button=document.createElement('button');button.type='button';button.className='weapon-control'+(selected.siegeWeapon===key?' active':'');
      button.textContent=`${w.label} · A${w.attack} R${w.range} · ${w.ready}/1`;
      button.disabled=!w.ready||selected.disabled||unitDead(selected);
      button.title=hasTarget(selected,key)?w.label:message(w.ready?'TARGET_NOT_ATTACKABLE':'WEAPON_SPENT',key);
      button.onclick=event=>{event.stopPropagation();selectWeapon(selected,key)};panel.appendChild(button);
    }
  }
  const oldTarget=root.canSelectedWeaponTarget;
  root.canSelectedWeaponTarget=(unit,target)=>active(unit)?query(unit,target).ok:oldTarget(unit,target);
  const oldPhase=phaseCanAct;
  phaseCanAct=function(unit,name=turnPhase){if(active(unit)&&name==='fire')return unit.team==='player'&&unitAlive(unit)&&!unit.disabled&&keys.some(key=>hasTarget(unit,key));return oldPhase(unit,name)};
  const oldReset=resetActionState;
  resetActionState=function(){oldReset();for(const unit of units.filter(active)){
    if(unit.siegeFireBudget.turn!==turn)unit.siegeFireBudget=GoblinSiegeBudget.resetSiegeTankFireBudget(unit.siegeFireBudget,turn);
    unit.fired=unit.siegeFireBudget.used.length===4;selectDefault(unit);
  }};
  const oldSelection=updateSelection;
  updateSelection=function(){oldSelection();renderControls()};
  const oldInfo=showUnitInfo;
  showUnitInfo=function(unit){oldInfo(unit);if(active(unit))$('#unit-intel-facts').innerHTML+=`<div><span>2 × A3/R3 + 2 × A1/R1</span><b>${summary(unit)}</b></div>`};
  // Classic map picking reports the same resolver reason as V2, before the old generic gate.
  function rejectPick(target){
    if(!active(selected)||phase!=='player'||turnPhase!=='fire'||target?.team!=='enemy')return false;
    const result=query(selected,target);if(result.ok)return false;setToast(result.reason);return true;
  }
  const oldHex=handleHex;
  handleHex=function(x,y){const target=units.find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y);if(!rejectPick(target))return oldHex(x,y)};
  const oldClick=handleUnitClick;
  handleUnitClick=function(unit){if(!rejectPick(unit))return oldClick(unit)};
  const oldAttack=attack;
  attack=function(unit,target){
    if(!active(unit))return oldAttack(unit,target);
    const legal=query(unit,target);if(!legal.ok){setToast(legal.reason);return}
    const spec=legal.weapon,wasDisabled=!!target.disabled;
    // Pass the chosen specification into the existing combat and roll-cache chain exactly once.
    const outcome=combatOutcome({...unit,damage:spec.attack,range:spec.range},target);
    unit.siegeFireBudget=legal.next;unit.fired=legal.next.used.length===4;unit.acted=true;
    target.lastOutcome=outcome.result;target.justHit=true;focusedCell={x:target.x,y:target.y};
    const effect=CombatFeedback.describeCombatEffect(target,outcome,wasDisabled);
    addLog(`${unit.name} / ${spec.label} → ${target.name}: ${outcome.result} (${outcome.ratio})`);
    reportPassengerHits(unit,outcome);setToast(effect);selectDefault(unit);selected=unit;
    updateSelection();showUnitInfo(unit);draw();setTimeout(()=>{target.justHit=false;draw()},560);
    if(!checkVictory())maybeAutoAdvancePhase();
  };
  root.GoblinSiegeWeapons=Object.freeze({active,weapons,query,selectWeapon,summary,label,message});
})(globalThis);
