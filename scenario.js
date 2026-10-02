const objectiveFallback = {
  'iron-dust': 'Kommandokern zerstören; mindestens eine eigene Einheit erhalten.',
  'relay-run': 'Relaisknoten und alle Feinde ausschalten; eigene Einheit erhalten.',
  'unit-trial': 'Kommandozentrum und alle Feinde ausschalten; eigene Einheit erhalten.',
  'atlas-proving-grounds': 'Feindlichen Kern und alle Feinde ausschalten; eigene Einheit erhalten.',
  'showcase-terrain-course': 'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',
  'showcase-advance': 'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',
  'showcase-siege': 'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',
  'showcase-specialists': 'Kern und alle Gegner ausschalten; eigene Einheit erhalten.'
};
function renderScenarioObjective(){
  const key=`mission.${currentScenario}.objective.short`;
  const translated=globalThis.GoblinLanguage?.t(key);
  $('#mission-sub').textContent=translated&&translated!==key?translated:objectiveFallback[currentScenario]||scenarioCatalog[currentScenario]?.sub||'';
  if(scenarioCatalog[currentScenario]?.showAllEnemiesProgress){
    const titleKey=`mission.${currentScenario}.title`,title=globalThis.GoblinLanguage?.t(titleKey);
    $('#mission-title').textContent=title&&title!==titleKey?title:scenarioCatalog[currentScenario].title;
  }
  for(const option of document.querySelectorAll('#scenario-select option[data-title-key]')){
    const title=globalThis.GoblinLanguage?.t(option.dataset.titleKey);
    option.textContent=title&&title!==option.dataset.titleKey?title:scenarioCatalog[option.value]?.title||option.textContent;
  }
}
globalThis.GoblinLanguage?.ready.then(renderScenarioObjective);
globalThis.addEventListener?.('goblin-language-change',renderScenarioObjective);
function loadScenario(id){
  const config=scenarioCatalog[id];
  if(!config)return;
  currentScenario=id;
  terrain=new Set(config.terrain);
  terrainTypes=new Map((config.terrainTypes||[]).map(cell=>[`${cell.x},${cell.y}`,cell.type]));
  for(const [key,type] of terrainTypes)if(TerrainRules.coverBonus(type))terrain.add(key);
  units.splice(0,units.length,...JSON.parse(JSON.stringify(config.units)).map(unit=>({...unit,moveCount:0,moveFrom:null,acted:false,disabled:false,justHit:false})));
  selected=null;focusedCell=null;transportLoadMode=null;transportUnloadMode=null;turn=1;phase='player';turnPhase='movement';gameOver=false;resetActionState();$("#end-turn").disabled=false;
  $('#mission-kicker').textContent=config.kicker;
  $('#mission-title').textContent=config.title;
  renderScenarioObjective();
  $('#turn-number').textContent='01';
  $('#phase-title').textContent='MOVEMENT PHASE';updatePhaseControls();
  $('#log-status').textContent='STANDBY';
  logEl.innerHTML='';
  addLog(`${config.kicker} online. Awaiting command.`);
  updateSelection();
  setViewMode('movement');
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
