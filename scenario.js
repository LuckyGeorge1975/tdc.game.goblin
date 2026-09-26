function loadScenario(id){
  const config=scenarioCatalog[id];
  if(!config)return;
  currentScenario=id;
  terrain=new Set(config.terrain);
  units.splice(0,units.length,...JSON.parse(JSON.stringify(config.units)).map(unit=>({...unit,moveCount:0,moveFrom:null,acted:false,disabled:false,justHit:false})));
  selected=null;focusedCell=null;transportLoadMode=null;transportUnloadMode=null;turn=1;phase='player';turnPhase='movement';gameOver=false;resetActionState();$("#end-turn").disabled=false;
  $('#mission-kicker').textContent=config.kicker;
  $('#mission-title').textContent=config.title;
  $('#mission-sub').textContent=config.sub;
  $('#turn-number').textContent='01';
  $('#phase-title').textContent='MOVEMENT PHASE';updatePhaseControls();
  $('#log-status').textContent='STANDBY';
  logEl.innerHTML='';
  addLog(`${config.kicker} online. Awaiting command.`);
  updateSelection();
  draw();
}

function hasScenarioProgress(){return turn>1||units.some(unit=>unit.moveCount>0||unit.moved||unit.fired||unit.secondMoved||unit.embarkedOn||unit.hp<unit.maxHp)}

async function resetScenario(){
  if(GameDialogs.isOpen())return;
  if(hasScenarioProgress()&&!await GameDialogs.confirm({id:'restart',title:'MISSION NEU STARTEN?',message:'Der aktuelle Spielstand und die Befehle dieser Mission gehen verloren.',acceptLabel:'NEU STARTEN',cancelLabel:'WEITERSPIELEN'})){
    maybeAutoAdvancePhase();return;
  }
  loadScenario(currentScenario);
}

document.querySelector('#scenario-select').onchange=async event=>{
  const nextScenario=event.target.value;
  event.target.value=currentScenario;
  if(nextScenario===currentScenario||!scenarioCatalog[nextScenario]||GameDialogs.isOpen())return;
  if(hasScenarioProgress()&&!await GameDialogs.confirm({id:'scenario',title:'SZENARIO WECHSELN?',message:'Der aktuelle Spielstand wird verworfen. Neues Szenario: '+scenarioCatalog[nextScenario].kicker,acceptLabel:'WECHSELN',cancelLabel:'WEITERSPIELEN'})){
    setToast('SZENARIOWECHSEL ABGEBROCHEN');
    maybeAutoAdvancePhase();
    return;
  }
  loadScenario(nextScenario);
  event.target.value=nextScenario;
};
document.querySelector('#reset-game').onclick=resetScenario;
