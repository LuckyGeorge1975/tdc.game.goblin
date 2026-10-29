// Internal fixed candidate entry. Normal menus do not claim full-catalog activation.
(async function(){
 const params=new URLSearchParams(globalThis.location?.search||'');
 if(params.get('catalogCandidate')!=='1'||!['v2',null].includes(params.get('ui')))return;
 try{
  const responses=await Promise.all(['assets/unit-art/rules/unit-profiles.catalog-approved.v1.json','assets/unit-art/levels/catalog-full-levels.v1.json'].map(path=>fetch(path)));
  if(responses.some(r=>!r.ok))throw Error('FULL_CANDIDATE_SOURCE_UNAVAILABLE');
  const [data,levels]=await Promise.all(responses.map(r=>r.json()));
  if(globalThis.GoblinLanguage&&await GoblinLanguage.ready!==true)throw Error('FULL_CANDIDATE_COPY_UNAVAILABLE');
  const configs=await GoblinCatalogFullModel.initialize(data,levels);
  for(const [id,config] of Object.entries(configs))ScenarioRuleProfiles.validate(id,config);
  for(const [id,config] of Object.entries(configs)){scenarioCatalog[id]=config;const option=document.createElement('option');option.value=id;option.textContent=config.title;option.dataset.titleKey=`mission.${id}.title`;$('#scenario-select').appendChild(option)}
  const id=params.get('scenario');if(GoblinCatalogFullModel.has(id)){$('#scenario-select').value=id;loadScenario(id)}
  renderScenarioObjective();globalThis.dispatchEvent?.(new Event('goblin-catalog-ready'));
 }catch(error){console.error('Full candidate unavailable:',error)}
})();
