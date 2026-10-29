// Only the modern mission menu advertises this new product slice; historical Classic missions remain unchanged.
(async function(){
 try{
  const response=await fetch('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json');if(!response.ok)throw Error(`HTTP ${response.status}`);
  const configs=await GoblinCatalogSpecialistsModel.initialize(await response.json());for(const [id,config] of Object.entries(configs))ScenarioRuleProfiles.validate(id,config);
  const choice=new URLSearchParams(globalThis.location?.search||'').get('ui'),modern=choice===null||choice==='v2';
  for(const [id,config] of Object.entries(configs)){scenarioCatalog[id]=config;if(modern){const option=document.createElement('option');option.value=id;option.textContent=config.title;option.dataset.titleKey=`mission.${id}.title`;$('#scenario-select').appendChild(option)}}
  const id=new URLSearchParams(globalThis.location?.search||'').get('scenario');if(modern&&GoblinCatalogSpecialistsModel.has(id))loadScenario(id);renderScenarioObjective();
  globalThis.dispatchEvent?.(new Event('goblin-catalog-ready'));
 }catch(error){console.error('Specialists catalogue unavailable:',error);addLog('Katalog-Erprobung konnte nicht geprüft geladen werden.',true)}
})();
