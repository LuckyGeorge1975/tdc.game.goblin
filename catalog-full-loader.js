// Public fixed Full admission; explicit internal candidate entry preserves historical bindings.
(async function(){
 const params=new URLSearchParams(globalThis.location?.search||'');
 if(!['v2',null].includes(params.get('ui')))return;
 try{
  if(params.has('catalogCandidate')&&params.get('catalogCandidate')!=='1')throw Error('FULL_ADMISSION_QUERY');
  const profile=params.get('catalogCandidate')==='1'?GoblinCatalogFullModel.candidateProfile:GoblinCatalogFullModel.publicProfile;
  const responses=await Promise.all(['assets/unit-art/rules/unit-profiles.catalog-approved.v1.json','assets/unit-art/levels/catalog-full-levels.v1.json'].map(path=>fetch(path)));
  if(responses.some(r=>!r.ok))throw Error('FULL_SOURCE_UNAVAILABLE');
  const [data,levels]=await Promise.all(responses.map(r=>r.json()));
  if(globalThis.GoblinLanguage&&await GoblinLanguage.ready!==true)throw Error('FULL_COPY_UNAVAILABLE');
  const configs=await GoblinCatalogFullModel.initialize(data,levels,{profile});
  for(const [id,config] of Object.entries(configs))ScenarioRuleProfiles.validate(id,config);
  for(const [id,config] of Object.entries(configs)){scenarioCatalog[id]=config;const option=document.createElement('option');option.value=id;option.textContent=config.title;option.dataset.titleKey=`mission.${id}.title`;$('#scenario-select').appendChild(option)}
  const id=params.get('scenario');if(GoblinCatalogFullModel.has(id)&&!globalThis.GoblinV2Flow?.hasStarted()){$('#scenario-select').value=id;loadScenario(id)}
  renderScenarioObjective();globalThis.dispatchEvent?.(new Event('goblin-catalog-ready'));
 }catch(error){console.error('Full catalog unavailable:',error)}
})();
