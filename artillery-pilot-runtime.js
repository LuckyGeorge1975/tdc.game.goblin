// Fixed product adapter; the existing pure artillery resolver owns fire legality and consumption.
(function(root){
  const active=unit=>legacySession?.scenarioId==='artillery-pilot'&&legacySession.ruleProfileId==='CATALOG_ARTILLERY_PILOT_v1'&&['long-range-battery','mobile-siege-gun'].includes(unit?.id);
  const text=(key,fallback,params)=>{const value=root.GoblinLanguage?.t(key,params);return value&&value!==key?value:fallback};
  const parse=key=>key==='direct'?{mode:'direct',spotterId:null}:typeof key==='string'&&key.startsWith('indirect/')?{mode:'indirect',spotterId:key.slice(9)}:null;
  const choice=(mode,spotterId)=>mode==='direct'?'direct':`indirect/${spotterId}`;
  function label(key){
    if(key==='indirect')return text('v2.ui.artillery.indirect','Indirektes Feuer');
    const action=parse(key);if(!action)return '';
    if(action.mode==='direct')return text('v2.ui.artillery.direct','Direkt');
    const spotter=units.find(unit=>unit.id===action.spotterId),name=spotter?.name??'';
    const localized=spotter?text(`library.unit.${root.UnitVisuals.artKey(spotter)}.name`,name):name;
    return text('v2.ui.artillery.indirectVia',`Indirekt über ${localized}`,{spotter:localized});
  }
  function message(code){
    if(code==='DIRECT_LOS_REQUIRED')return text('v2.reject.sight','Eigene Sichtlinie fehlt.');
    if(code==='VALID_SPOTTER_REQUIRED')return text('v2.reject.artillery.spotterRequired','Wähle einen lebenden, aktiven eigenen Beobachter mit direkter Sicht auf das Ziel.');
    const key=code==='ACTOR_CANNOT_FIRE'?'v2.reject.unavailable':code==='WEAPON_SPENT'?'v2.reject.spent':code==='TARGET_OUT_OF_RANGE'?'ui.error.TARGET_NOT_ATTACKABLE':code==='INVALID_FIRE_MODE'?'ui.error.WRONG_PHASE':'ui.error.INVALID_TARGET';
    return text(key,'Aktion oder Ziel nicht verfügbar.');
  }
  const occupied=unit=>!!unit&&!unit.embarkedOn&&unit.x>=0&&unit.x<W&&unit.y>=0&&unit.y<H&&units.filter(other=>other.hp>0&&!other.embarkedOn&&other.x===unit.x&&other.y===unit.y).length===1;
  function command(unit,target,key=unit?.artilleryChoice){
    const action=parse(key);return {type:'FireArtillery',actorId:unit?.id,x:target?.x,y:target?.y,mode:action?.mode,spotterId:action?.spotterId};
  }
  function query(unit,target,request){
    try{
      const fields=['type','actorId','x','y','mode','spotterId'];
      if(!request||Object.keys(request).length!==fields.length||!fields.every(key=>Object.hasOwn(request,key))||request.type!=='FireArtillery'||request.actorId!==unit?.id||request.x!==target?.x||request.y!==target?.y||!['direct','indirect'].includes(request.mode)||(request.mode==='direct'?request.spotterId!==null:typeof request.spotterId!=='string'||!request.spotterId))throw new Error('INVALID_FIRE_TARGET');
      if(!active(unit)||phase!=='player'||gameOver||!occupied(unit)||unit.artilleryFire?.turn!==turn)throw new Error('ACTOR_CANNOT_FIRE');
      if(!occupied(target)||target.hp<=0||target.team===unit.team)throw new Error('INVALID_FIRE_TARGET');
      const spotter=request.mode==='indirect'?units.find(item=>item.id===request.spotterId):null;
      if(request.mode==='indirect'&&!occupied(spotter))throw new Error('VALID_SPOTTER_REQUIRED');
      const resolved=GoblinArtilleryRules.resolveArtilleryFire(unit.artilleryFire,{phase:turnPhase,mode:request.mode,
        actor:{id:unit.id,team:unit.team,hp:unit.hp,disabled:!!unit.disabled,hasLineOfSight:lineOfSight(unit,target)},
        target:{id:target.id,team:target.team,hp:target.hp,distance:dist(unit,target)},
        spotter:spotter?{id:spotter.id,team:spotter.team,hp:spotter.hp,disabled:!!spotter.disabled,hasLineOfSight:lineOfSight(spotter,target)}:null});
      const key=choice(request.mode,request.spotterId);
      return {ok:true,next:resolved.state,weapon:{key,label:label(key),...resolved.attack}};
    }catch(error){return {ok:false,code:error.code??error.message,reason:message(error.code??error.message)}}
  }
  const queryChoice=(unit,target,key=unit?.artilleryChoice)=>query(unit,target,command(unit,target,key));
  function weapons(unit){
    if(!active(unit))return null;
    const keys=['direct',...units.filter(other=>other.team===unit.team&&other.id!==unit.id&&other.hp>0&&!other.disabled&&!other.embarkedOn).map(other=>`indirect/${other.id}`)];
    if(keys.length===1)keys.push('indirect');
    return Object.fromEntries(keys.map(key=>[key,{attack:6,range:GoblinArtilleryRules.UNITS[unit.id].range,label:label(key),ready:key==='indirect'||unit.artilleryFire?.fired?0:1,...(key==='indirect'?{unavailableReason:'VALID_SPOTTER_REQUIRED'}:{})}]));
  }
  const hasAction=unit=>Object.keys(weapons(unit)??{}).some(key=>units.some(target=>queryChoice(unit,target,key).ok));
  function selectWeapon(unit,key){
    if(!active(unit)||root.GoblinMovement?.busy()||phase!=='player'||turnPhase!=='fire'||gameOver||unit.hp<=0||unit.disabled||!weapons(unit)?.[key]?.ready)return false;
    unit.artilleryChoice=key;updateSelection();draw();return true;
  }
  const summary=unit=>`${label(unit.artilleryChoice)} · ${unit.artilleryFire?.fired?text('v2.area.weaponEmpty','Verbraucht'):text('v2.ui.ready','Bereit')}`;
  function renderControls(){
    const panel=$('#weapon-controls');if(!panel||!active(selected))return;
    panel.innerHTML='';panel.classList.toggle('hidden',turnPhase!=='fire'||phase!=='player');
    if(turnPhase!=='fire'||phase!=='player')return;
    for(const [key,spec] of Object.entries(weapons(selected))){const button=document.createElement('button');button.type='button';button.className='weapon-control'+(selected.artilleryChoice===key?' active':'');button.textContent=`${spec.label} · A6 R${spec.range} · ${spec.ready}/1`;button.disabled=!spec.ready||selected.disabled||selected.hp<=0;button.title=spec.unavailableReason?message(spec.unavailableReason):spec.label;button.onclick=event=>{event.stopPropagation();selectWeapon(selected,key)};panel.appendChild(button)}
  }
  const oldTarget=root.canSelectedWeaponTarget;
  root.canSelectedWeaponTarget=(unit,target)=>active(unit)?queryChoice(unit,target).ok:oldTarget(unit,target);
  const oldPhase=phaseCanAct;
  phaseCanAct=function(unit,name=turnPhase){return active(unit)&&name==='fire'?unit.team==='player'&&unit.hp>0&&!unit.disabled&&hasAction(unit):oldPhase(unit,name)};
  const oldReset=resetActionState;
  resetActionState=function(){oldReset();for(const unit of units.filter(active)){if(unit.artilleryFire.turn!==turn)unit.artilleryFire=GoblinArtilleryRules.resetArtillerySpotterProbe(unit.artilleryFire,turn);unit.fired=unit.artilleryFire.fired;if(!weapons(unit)[unit.artilleryChoice])unit.artilleryChoice='direct'}};
  const oldSelection=updateSelection;
  updateSelection=function(){oldSelection();renderControls()};
  const oldInfo=showUnitInfo;
  showUnitInfo=function(unit){oldInfo(unit);if(active(unit))$('#unit-intel-facts').innerHTML+=`<div><span>A6 / R${unit.range}</span><b>${summary(unit)}</b></div>`};
  function pick(target){if(!active(selected)||phase!=='player'||turnPhase!=='fire'||target?.team!=='enemy')return false;const result=queryChoice(selected,target);if(result.ok)attack(selected,target);else setToast(result.reason);return true}
  const oldHex=handleHex;
  handleHex=function(x,y){if(!pick(units.find(unit=>unit.hp>0&&!unit.embarkedOn&&unit.x===x&&unit.y===y)))return oldHex(x,y)};
  const oldClick=handleUnitClick;
  handleUnitClick=function(unit){if(!pick(unit))return oldClick(unit)};
  const oldAttack=attack;
  attack=function(unit,target){
    if(!active(unit))return oldAttack(unit,target);
    const legal=queryChoice(unit,target);if(!legal.ok){setToast(legal.reason);return}
    const wasDisabled=!!target.disabled,outcome=combatOutcome({...unit,damage:6,range:legal.weapon.range},target);
    unit.artilleryFire=legal.next;unit.fired=true;unit.acted=true;target.lastOutcome=outcome.result;target.justHit=true;focusedCell={x:target.x,y:target.y};
    const effect=CombatFeedback.describeCombatEffect(target,outcome,wasDisabled);addLog(`${unit.name} / ${legal.weapon.label} → ${target.name}: ${outcome.result} (${outcome.ratio})`);reportPassengerHits(unit,outcome);setToast(effect);selected=unit;
    updateSelection();showUnitInfo(unit);draw();setTimeout(()=>{target.justHit=false;draw()},560);if(!checkVictory())maybeAutoAdvancePhase();
  };
  root.GoblinArtilleryWeapons=Object.freeze({active,parse,choice,label,message,command,query,queryChoice,weapons,selectWeapon,summary});
})(globalThis);
