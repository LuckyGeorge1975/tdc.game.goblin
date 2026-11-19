(function(root) {
  const modern = ['v2',null].includes(new URLSearchParams(root.location?.search ?? '').get('ui'));
  if (!modern) return;
  let loading = null;
  function load() {
    if (loading || !root.GoblinEditorDraft?.available()) return loading;
    loading = (async () => {
      const response = await fetch('assets/unit-art/levels/full-migrated-missions.v3.json?v=1');
      if (!response.ok) throw Error('FULL_MIGRATED_LEVELS_UNAVAILABLE');
      const levels = GoblinEditorDraft.importLevels(await response.text());
      const configs = await Promise.all(levels.map(level => GoblinEditorDraft.prepare(level)));
      for (let index=0;index<levels.length;index++) {
        const {id} = levels[index], config = configs[index];
        ScenarioRuleProfiles.registerFullMission(id,config);
        scenarioCatalog[id] = config;
        if (!document.querySelector('#scenario-select option[value="'+id+'"]')) {
          const option = document.createElement('option');
          option.value = id;
          option.dataset.titleKey = 'mission.'+id+'.title';
          option.textContent = GoblinLanguage.t(option.dataset.titleKey);
          document.querySelector('#scenario-select').append(option);
        }
      }
      root.dispatchEvent(new Event('goblin-full-missions-ready'));
    })();
    return loading;
  }
  let resolve, reject;
  const ready = new Promise((done,fail) => {resolve=done;reject=fail;});
  function attempt() {
    const pending = load();
    if (pending) pending.then(resolve,reject);
  }
  root.GoblinFullMissions = Object.freeze({ready,
    has:id=>Object.hasOwn(scenarioCatalog,id)&&scenarioCatalog[id].ruleProfileId==='FULL_CATALOG_v1'&&
      !root.GoblinCatalogFullModel.has(id)});
  ready.catch(error => console.error('FULL mission migration unavailable:',error));
  root.addEventListener('goblin-catalog-ready',attempt);
  attempt();
})(globalThis);
