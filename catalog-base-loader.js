// Register only after all fixed contracts have been checked. Failure leaves old missions available.
(async function(){
 try{
  const response=await fetch('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json');
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const configs=await GoblinCatalogBase.initialize(await response.json());
  for(const [id,config] of Object.entries(configs))ScenarioRuleProfiles.validate(id,config);
  for(const [id,config] of Object.entries(configs)){
   scenarioCatalog[id]=config;const option=document.createElement('option');option.value=id;option.textContent=config.title;option.dataset.titleKey=`mission.${id}.title`;$('#scenario-select').appendChild(option);
  }
  renderScenarioObjective();
  const id=new URLSearchParams(globalThis.location?.search||'').get('scenario');
  if(GoblinCatalogBase.has(id)){$('#scenario-select').value=id;loadScenario(id)}
  globalThis.dispatchEvent?.(new Event('goblin-catalog-ready'));
 }catch(error){console.error('Catalogue base unavailable:',error);addLog('Katalogbasis konnte nicht geprüft geladen werden.',true)}
})();
