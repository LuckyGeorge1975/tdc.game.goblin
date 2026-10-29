// Register only the fully validated, pinned learning package.
(async function(){
 const params=new URLSearchParams(globalThis.location?.search||'');
 if(!['v2',null].includes(params.get('ui')))return;
 try{
  const responses=await Promise.all(['assets/training/levels.v1.json','assets/training/scripts.v1.json'].map(path=>fetch(path)));
  if(responses.some(r=>!r.ok))throw Error('TRAINING_SOURCE_UNAVAILABLE');
  const [levels,scripts]=await Promise.all(responses.map(r=>r.json()));
  if(globalThis.GoblinLanguage&&await GoblinLanguage.ready!==true)throw Error('TRAINING_COPY_UNAVAILABLE');
  const configs=await GoblinTrainingModel.initialize(levels,scripts);
  await GoblinTrainingModel.initializeAdvisory(scenarioCatalog['iron-dust']);
  for(const [id,config]of Object.entries(configs)){ScenarioRuleProfiles.validate(id,config);for(const key of config.training.manifest.copyKeys)if(GoblinLanguage.t(key)===key)throw Error('TRAINING_COPY_MISSING:'+key)}
  for(const [id,config]of Object.entries(configs)){scenarioCatalog[id]=config;const option=document.createElement('option');option.value=id;option.dataset.titleKey=`mission.${id}.title`;option.textContent=GoblinLanguage.t(config.titleKey);$('#scenario-select').appendChild(option)}
  globalThis.dispatchEvent?.(new Event('goblin-training-ready'));
 }catch(error){console.error('Training unavailable:',error)}
})();
