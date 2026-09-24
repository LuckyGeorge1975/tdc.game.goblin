function loadScenario(id){
  const config=scenarioCatalog[id];
  if(!config)return;
  currentScenario=id;
  terrain=new Set(config.terrain);
  units.splice(0,units.length,...JSON.parse(JSON.stringify(config.units)).map(unit=>({...unit,moveCount:0,moveFrom:null,acted:false,disabled:false,justHit:false})));
  selected=null;turn=1;phase='player';turnPhase='movement';gameOver=false;resetActionState();
  $('#modal').classList.add('hidden');
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

function resetScenario(){loadScenario(currentScenario)}

document.querySelector('#scenario-select').onchange=event=>{
  const nextScenario=event.target.value;
  const hasMovedUnit=units.some(unit=>unit.moveCount>0);
  if(nextScenario!==currentScenario&&hasMovedUnit&&!window.confirm('Mindestens eine Einheit wurde bereits bewegt. Szenario wirklich wechseln?')){
    event.target.value=currentScenario;
    setToast('SZENARIOWECHSEL ABGEBROCHEN');
    return;
  }
  loadScenario(nextScenario);
};
document.querySelector('#reset-game').onclick=resetScenario;
document.querySelector('#modal-reset').onclick=resetScenario;
