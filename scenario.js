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
  for(const option of document.querySelectorAll('#scenario-select option[data-title-key]')){
    const title=globalThis.GoblinLanguage?.t(option.dataset.titleKey);
    option.textContent=title&&title!==option.dataset.titleKey?title:scenarioCatalog[option.value]?.title||option.textContent;
  }
  if(globalThis.goblinBootProfileError||globalThis.IronDustBrowserV2?.active)return;
  const config=legacySession.config,profile=victoryProfile(legacySession.effectiveRules);
  if(globalThis.GoblinTrainingModel?.has(currentScenario)){
    $('#mission-kicker').textContent=globalThis.GoblinLanguage?.t(config.kickerKey)??config.kicker;
    $('#mission-title').textContent=globalThis.GoblinLanguage?.t(config.titleKey)??config.title;
    $('#mission-sub').textContent=globalThis.GoblinLanguage?.t(config.goalKey)??config.sub;return;
  }
  if(globalThis.GoblinCatalogFullModel?.has(currentScenario)&&config.kickerKey){const kicker=globalThis.GoblinLanguage?.t(config.kickerKey);$('#mission-kicker').textContent=kicker&&kicker!==config.kickerKey?kicker:config.kicker;}
  const key=`mission.${currentScenario}.objective.short`;
  const translated=globalThis.GoblinLanguage?.t(key);
  $('#mission-sub').textContent=translated&&translated!==key?translated:objectiveFallback[currentScenario]||config.sub||'';
  if(profile.requiresAllEnemies||['siege-pilot','artillery-pilot','catalog-transport','catalog-maneuver'].includes(currentScenario)){
    const titleKey=`mission.${currentScenario}.title`,title=globalThis.GoblinLanguage?.t(titleKey);
    $('#mission-title').textContent=title&&title!==titleKey?title:config.title;
  }
}
globalThis.GoblinLanguage?.ready.then(renderScenarioObjective);
globalThis.addEventListener?.('goblin-language-change',renderScenarioObjective);
function loadScenario(id){
  if(globalThis.goblinBootProfileError)throw globalThis.goblinBootProfileError;
  const config=scenarioCatalog[id];
  if(!config)return;
  let nextSession;
  try{nextSession=ScenarioRuleProfiles.beginSession(id,config)}catch(error){addLog(error.message,true);throw error}
  globalThis.IronDustBrowserV2?.stop();
  legacySession=nextSession;
  const active=nextSession.config;
  currentScenario=id;
  terrain=new Set(active.terrain);
  terrainTypes=new Map((active.terrainTypes||[]).map(cell=>[`${cell.x},${cell.y}`,cell.type]));
  for(const [key,type] of terrainTypes)if(TerrainRules.coverBonus(type))terrain.add(key);
  units.splice(0,units.length,...JSON.parse(JSON.stringify(active.units)).map(unit=>({...unit,moveCount:0,moveFrom:null,acted:false,disabled:false,justHit:false})));
  selected=null;focusedCell=null;transportLoadMode=null;transportUnloadMode=null;turn=1;phase='player';turnPhase='movement';gameOver=false;resetActionState();$("#end-turn").disabled=false;
  $('#mission-kicker').textContent=active.kicker;
  $('#mission-title').textContent=active.title;
  renderScenarioObjective();
  $('#turn-number').textContent='01';
  $('#phase-title').textContent='MOVEMENT PHASE';updatePhaseControls();
  $('#log-status').textContent='STANDBY';
  logEl.innerHTML='';
  addLog(`${active.kicker} online. Awaiting command.`);
  globalThis.GoblinLegacyPresentation?.sync();
  updateSelection();
  setViewMode('movement');
}

function hasScenarioProgress(){return !!globalThis.IronDustBrowserV2?.active||turn>1||units.some(unit=>unit.moveCount>0||unit.moved||unit.fired||unit.secondMoved||unit.embarkedOn||unit.hp<unit.maxHp)}

async function resetScenario(){
  if(GameDialogs.isOpen())return;
  if(hasScenarioProgress()&&!await GameDialogs.confirm({id:'restart',title:'MISSION NEU STARTEN?',message:'Der aktuelle Spielstand und die Befehle dieser Mission gehen verloren.',acceptLabel:'NEU STARTEN',cancelLabel:'WEITERSPIELEN'})){
    maybeAutoAdvancePhase();return;
  }
  if(globalThis.IronDustBrowserV2?.active)globalThis.IronDustBrowserV2.restart();
  else loadScenario(currentScenario);
}

document.querySelector('#scenario-select').onchange=async event=>{
  const nextScenario=event.target.value;
  event.target.value=currentScenario;
  const v2=globalThis.IronDustBrowserV2;
  const isV2=nextScenario===v2?.selectorId;
  if(nextScenario===currentScenario||!(isV2||scenarioCatalog[nextScenario])||GameDialogs.isOpen())return;
  if(isV2&&!v2.available)return;
  const nextTitle=isV2?(globalThis.GoblinLanguage?.t('mission.iron-dust-v2.title')||'IRON DUST v2'):scenarioCatalog[nextScenario].kicker;
  if((isV2||hasScenarioProgress())&&!await GameDialogs.confirm({id:'scenario',title:'SZENARIO WECHSELN?',message:'Der aktuelle Spielstand wird verworfen. Neues Szenario: '+nextTitle,acceptLabel:'WECHSELN',cancelLabel:'WEITERSPIELEN'})){
    setToast('SZENARIOWECHSEL ABGEBROCHEN');
    maybeAutoAdvancePhase();
    return;
  }
  if(isV2)v2.start();
  else loadScenario(nextScenario);
  event.target.value=nextScenario;
};
document.querySelector('#reset-game').onclick=resetScenario;
