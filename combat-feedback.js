(function(root){
  function describeCombatEffect(target,outcome,wasDisabled=false){
    if(outcome.result==='D'&&wasDisabled&&target.hp<=0){
      return target.core?'ZWEITES D — CORE OFFLINE':'ZWEITES D — ZIEL AUSGESCHALTET';
    }
    if(target.hp<=0||outcome.result==='X')return target.core?'CORE OFFLINE — ZIEL ZERSTÖRT':'ZIEL AUSGESCHALTET';
    if(outcome.result!=='D')return 'KEIN EFFEKT';
    if(target.infantry===true||target.engineering===true||target.id==='infantry'){
      return `INFANTERIE VERLIERT 1 STÄRKEPUNKT — ${target.hp}/${target.maxHp} VERBLEIBEND`;
    }
    const recovery=target.disabledUntil?` BIS RUNDE ${target.disabledUntil}`:'';
    return `${target.core?'CORE':'ZIEL'} DEAKTIVIERT${recovery} — NÄCHSTES D ODER X ZERSTÖRT`;
  }

  function updateObjectiveStatus(){
    const core=units.find(unit=>unit.core),text=$('#objective-text'),progress=$('#objective-progress');
    if(!core||!text||!progress)return;
    if(core.hp<=0){text.textContent='CORE OFFLINE';progress.style.width='100%';return}
    if(core.disabled){text.textContent='CORE DISABLED · DAMAGE 1/2';progress.style.width='50%';return}
    text.textContent='CORE OPERATIONAL · DAMAGE 0/2';progress.style.width='0%';
  }

  function renderStatusIntel(unit){
    const facts=$('#unit-intel-facts');
    if(!facts)return;
    if(unit.core){
      const state=unit.hp<=0?'DESTROYED':unit.disabled?'DISABLED':'OPERATIONAL';
      facts.innerHTML=`<div><span>DEFENSE</span><b>${unit.defense??0}</b></div><div><span>DAMAGE STATE</span><b>${unit.disabled?'1/2':'0/2'}</b></div><div><span>STATUS</span><b>${state}</b></div>`+
        (unit.disabled?`<div><span>RECOVERY</span><b>TURN ${unit.disabledUntil}</b></div><div><span>NEXT D / X</span><b>DESTROYS</b></div>`:'');
      $('#unit-intel-copy').textContent=`${unit.type} · HARDENED COMMAND POST · SECTOR ${String.fromCharCode(65+unit.x)}-${String(unit.y+1).padStart(2,'0')}`;
    }else if(unit.disabled){
      facts.innerHTML+=`<div><span>RECOVERY</span><b>TURN ${unit.disabledUntil}</b></div><div><span>NEXT D / X</span><b>DESTROYS</b></div>`;
    }
  }

  const baseShowUnitInfo=showUnitInfo;
  showUnitInfo=function(unit){baseShowUnitInfo(unit);renderStatusIntel(unit)};

  const baseUpdateRoster=updateRoster;
  updateRoster=function(){
    baseUpdateRoster();
    const roster=$('#unit-roster'),cards=roster&&roster.children?[...roster.children]:[];
    const players=units.filter(unit=>unit.team==='player');
    cards.forEach((card,index)=>{
      if(players[index]?.disabled){card.classList.remove('acted');card.classList.add('disabled')}
    });
    updateObjectiveStatus();
  };

  attack=function(attacker,target){
    if(attacker.disabled){setToast(`${attacker.name} IST DEAKTIVIERT`);return}
    if(target.team==='enemy'&&!lineOfSight(attacker,target)){setToast('SICHTLINIE BLOCKIERT');return}
    if(attacker.team==='player'&&(turnPhase!=='fire'||attacker.fired)){setToast('FEUERPHASE ODER EINHEIT BEREITS VERBRAUCHT');return}
    const wasDisabled=!!target.disabled;
    attacker.acted=true;
    if(attacker.team==='player')attacker.fired=true;
    const outcome=combatOutcome(attacker,target),effect=describeCombatEffect(target,outcome,wasDisabled);
    target.lastOutcome=outcome.result;
    target.justHit=true;
    addLog(`${attacker.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${effect}.`);
    reportPassengerHits(attacker,outcome);
    setToast(effect);
    selected=null;
    updateSelection();
    draw();
    setTimeout(()=>{target.justHit=false;draw()},560);
    if(checkVictory())return;
    maybeAutoAdvancePhase();
  };

  enemyFire=function(foe){
    if(foe.hp<=0||foe.disabled)return false;
    const targets=units.filter(unit=>unit.team==='player'&&unit.hp>0&&!unit.embarkedOn).sort((a,b)=>dist(foe,a)-dist(foe,b));
    const target=targets.find(unit=>dist(foe,unit)<=foe.range&&lineOfSight(foe,unit));
    if(!target)return false;
    if(target.ogreSystems){
      const outcome=GoblinOgreRuntime.resolveSystemAttack(foe,target),effect=GoblinOgreRuntime.describeHit(outcome);
      target.justHit=true;
      target.lastOutcome=outcome.result;
      addLog(`${foe.name} feuert auf ${target.name} / ${outcome.system.label}: ${outcome.result} bei ${outcome.ratio} — ${effect}.`,true);
      setTimeout(()=>{target.justHit=false;draw()},560);
      return true;
    }
    const wasDisabled=!!target.disabled,outcome=combatOutcome(foe,target),effect=describeCombatEffect(target,outcome,wasDisabled);
    target.justHit=true;
    addLog(`${foe.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${effect}.`,true);
    reportPassengerHits(foe,outcome,true);
    setTimeout(()=>{target.justHit=false;draw()},560);
    return true;
  };

  updateObjectiveStatus();
  root.CombatFeedback=Object.freeze({describeCombatEffect,updateObjectiveStatus,renderStatusIntel});
})(globalThis);
