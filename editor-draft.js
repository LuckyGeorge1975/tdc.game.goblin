// Local editor documents never enter the curated scenario registry.
(function(root) {
  const id = 'editor-draft', version = 'goblin-level-v3', historicalVersion = 'goblin-level-draft-v1';
  const width = 12, height = 8, objective = 'core-and-escort';
  const admitted = new WeakSet();
  const maxLength = 65536;
  const languages = ['de','en','es','fr'];
  const template = () => root.GoblinCatalogFullModel?.configs?.['catalog-full-terrain-course'];
  const profile = () => root.GoblinCatalogFullModel?.editorProfile;
  const available = () => !!profile();
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const size = Object.freeze({minWidth:6,maxWidth:18,minHeight:5,maxHeight:12});
  const validSize = ({width,height}) => Number.isInteger(width) && width >= size.minWidth && width <= size.maxWidth &&
    Number.isInteger(height) && height >= size.minHeight && height <= size.maxHeight;
  const key = cell => cell.x + ',' + cell.y;
  const fail = code => { throw new Error(code); };
  function copyTemplate() {
    const source = template();
    if (!available() || !source) fail('unavailable');
    return {version, width, height, objective, terrain:source.terrainTypes.map(({x,y,type}) => ({x,y,type})),
      units:source.units.map((unit,index) => ({
        id:unit.core ? 'core' : 'draft-' + (index + 1), assetId:unit.catalogAssetId, team:unit.team, x:unit.x, y:unit.y,
        ...(unit.squads ? {squads:unit.squads} : {})
      }))};
  }
  function eventData(draft) {
    if (draft.version === root.GoblinLevelEvents?.version) return {hotspots:draft.hotspots,hooks:draft.hooks};
    if (!Object.hasOwn(draft,'events') && !Object.hasOwn(draft,'hotspots')) return null;
    const events = Object.hasOwn(draft,'waveTemplates') ? [] : Object.hasOwn(draft,'events') ? draft.events : [];
    if (!root.GoblinLevelEvents || !Array.isArray(events) || events.length > 24) fail('events');
    const hooks = events.map(event => {
      if (!exact(event,['id','when','effect']) || !exact(event.effect,['type','title','text']) ||
          !['dialog','general-dialog'].includes(event.effect.type)) fail('events');
      const {type,title,text} = event.effect;
      return {id:event.id,when:event.when,show:type==='dialog' ? {style:'standard',title,text} :
        {style:'general',title,text,portrait:null}};
    });
    return {hotspots:Object.hasOwn(draft,'hotspots') ? draft.hotspots : [],hooks};
  }
  function validate(draft) {
    if (!available()) fail('unavailable');
    const oldEvents = draft?.version === root.GoblinLevelEvents?.version && draft?.version !== undefined;
    const current = draft?.version === version;
    const fields = ['version','width','height','objective','terrain','units'];
    if (oldEvents) fields.push('hotspots','hooks');
    if (current) for (const key of ['id','scenarioVersion','ruleProfile','hotspots','events','goals','waveTemplates','briefing'])
      if (Object.hasOwn(draft,key)) fields.push(key);
    if (!exact(draft,fields) || (!oldEvents && !current && draft.version !== historicalVersion) ||
        (current && Object.hasOwn(draft,'ruleProfile') && draft.ruleProfile !== profile().ruleProfileId) ||
        !(current ? validSize(draft) : draft.width === width && draft.height === height) || draft.objective !== objective ||
        !Array.isArray(draft.terrain) || !Array.isArray(draft.units) ||
        draft.terrain.length > draft.width * draft.height || draft.units.length > draft.width * draft.height) fail('schema');
    const position = cell => Number.isInteger(cell.x) && cell.x >= 0 && cell.x < draft.width &&
      Number.isInteger(cell.y) && cell.y >= 0 && cell.y < draft.height;
    const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(id);
    if (Object.hasOwn(draft,'id') !== Object.hasOwn(draft,'scenarioVersion') ||
        Object.hasOwn(draft,'id') && (!validId(draft.id) || draft.scenarioVersion !== 1)) fail('schema');
    if (Object.hasOwn(draft,'briefing')) {
      const valid = text => typeof text === 'string' && text.trim() && text.length <= 600;
      if (!valid(draft.briefing) && !(exact(draft.briefing,languages) && languages.every(lang => valid(draft.briefing[lang]))))
        fail('briefing');
    }
    let turnLimit = null;
    if (Object.hasOwn(draft,'goals')) {
      const goal = Array.isArray(draft.goals) && draft.goals.length === 1 && draft.goals[0];
      if (!exact(goal,['type','turns']) || goal.type !== 'enemy-turn-limit' ||
          !Number.isSafeInteger(goal.turns) || goal.turns < 1) fail('goals');
      turnLimit = goal.turns;
    }
    const registry = profile().catalog.registry;
    const terrains = new Map(), occupied = new Set(), ids = new Set();
    for (const cell of draft.terrain) {
      if (!exact(cell,['x','y','type']) || typeof cell.type !== 'string' || !Object.hasOwn(TerrainRules.rules, cell.type)) fail('terrain');
      if (!position(cell)) fail('bounds');
      if (terrains.has(key(cell))) fail('collision');
      terrains.set(key(cell), cell.type);
    }
    const records = {}, units = [];
    const waveTemplates = [];
    let waves = {version:'catalog-wave-config-v1',waves:[]};
    if (Object.hasOwn(draft,'waveTemplates')) {
      waves = {...waves,waves:draft.events};
      try { GoblinCatalogWaves.create(waves); } catch { fail('waves'); }
      if (!Array.isArray(draft.waveTemplates) || draft.waveTemplates.length !== waves.waves.length) fail('waves');
      if (waves.waves.some(wave => wave.entries.some(cell => !position(cell)))) fail('bounds');
    }
    const templates = draft.waveTemplates ?? [];
    for (const [index,entry] of [...draft.units,...templates].entries()) {
      const template = index >= draft.units.length;
      if (!entry || typeof entry.assetId !== 'string' || !Object.hasOwn(registry.units, entry.assetId)) fail('unit');
      const rule = registry.units[entry.assetId].target;
      const fields = ['id','assetId','team','x','y'];
      if (rule.strengthRef) fields.push('squads');
      if (current && Object.hasOwn(entry,'name')) {
        if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100) fail('unit');
        fields.push('name');
      }
      const cargo = Object.hasOwn(entry,'embarkedOn');
      if (cargo) {
        if (!validId(entry.embarkedOn) || typeof entry.cargoBay !== 'string') fail('cargo');
        fields.push('embarkedOn','cargoBay');
      }
      if (!exact(entry,fields) || typeof entry.id !== 'string' ||
          !(oldEvents || current ? /^[a-z][a-z0-9-]{0,47}$/.test(entry.id) : /^(core|draft-[1-9][0-9]{0,2})$/.test(entry.id)) ||
          !['player','enemy'].includes(entry.team)) fail('unit');
      if (!position(entry)) fail('bounds');
      if (ids.has(entry.id) || !template && !cargo && occupied.has(key(entry))) fail('collision');
      if ((entry.id === 'core') !== (entry.assetId === 'command-core') ||
          entry.id === 'core' && entry.team !== 'enemy') fail('core');
      if (rule.strengthRef && (!Number.isInteger(entry.squads) || entry.squads < 1 || entry.squads > 3)) fail('unit');
      if (template && (cargo || entry.assetId === 'command-core' || !waves.waves.some(wave =>
        wave.templateId === entry.id && wave.team === entry.team))) fail('waves');
      ids.add(entry.id);
      if (!template && !cargo) occupied.add(key(entry));
      const unit = GoblinCatalogSpecialistsModel.createUnit(entry, registry, records, GoblinCatalogFullModel.scope);
      const type = terrains.get(key(entry)) ?? 'open-ground';
      if (!cargo && !template && (unit.move > 0 ? !Number.isFinite(TerrainRules.movementCost(type, unit)) : ['water','river'].includes(type))) fail('startTerrain');
      if (rule.missileRuleRef) Object.assign(unit, {cruiseMissile:true, ammunition:rule.ammunition, splashAttack:rule.splashAttack, blastRadius:1});
      (template ? waveTemplates : units).push(unit);
    }
    const bays = new Set();
    for (const unit of units.filter(unit => unit.embarkedOn !== undefined)) {
      const owner = units.find(item => item.id === unit.embarkedOn);
      const slot = unit.embarkedOn + ':' + unit.cargoBay;
      if (unit.catalogId !== 'U14' || !owner?.droneBays?.includes(unit.cargoBay) ||
        owner.team !== unit.team || key(owner) !== key(unit) || bays.has(slot)) fail('cargo');
      bays.add(slot);
    }
    if (!ids.has('core')) fail('core');
    if (!units.some(unit => unit.team === 'player')) fail('player');
    const events = eventData(draft);
    if (events) {
      try { root.GoblinLevelEvents.validate(events,new Set(units.map(unit => unit.id)),position); }
      catch (error) {
        if (!oldEvents) {
          const references = (condition, depth = 0) => {
            if (!condition || depth > 4) return false;
            if (typeof condition.unitId === 'string') return !units.some(unit => unit.id === condition.unitId);
            if (typeof condition.pathCrossesHotspot === 'string')
              return Array.isArray(events.hotspots) && !events.hotspots.some(spot => spot?.id === condition.pathCrossesHotspot);
            const group = condition.all ?? condition.any;
            return Array.isArray(group) && group.some(child => references(child,depth+1));
          };
          if (events.hooks.some(hook => hook.when && references(hook.when))) fail('references');
        }
        throw error;
      }
    }
    return {units,records,events,waves,waveTemplates,turnLimit};
  }
  function exportJson(draft) {
    const {events} = validate(draft);
    const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key,sort(value[key])])) : value;
    const canonical = sort({...draft,version,
      ...(events ? {hotspots:events.hotspots,events:events.hooks.map(({id,when,show}) =>
        ({id,when,effect:{type:show.style==='general'?'general-dialog':'dialog',title:show.title,text:show.text}}))} : {})
    });
    delete canonical.hooks;
    if (Object.hasOwn(draft,'waveTemplates')) {
      canonical.events = sort(draft.events);
      if (!Object.hasOwn(draft,'hotspots')) delete canonical.hotspots;
    }
    const compact = JSON.stringify(canonical);
    if (compact.length > maxLength) fail('schema');
    const pretty = JSON.stringify(canonical,null,2);
    return pretty.length <= maxLength ? pretty : compact;
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > maxLength) fail('schema');
    let draft;
    try { draft = JSON.parse(text); } catch { fail('json'); }
    validate(draft);
    return draft;
  }
  function importLevels(text) {
    if (typeof text !== 'string' || text.length > maxLength) fail('schema');
    let input;
    try { input = JSON.parse(text); } catch { fail('json'); }
    if (input?.version !== 'goblin-level-package-v3') return [parse(text)];
    if (!exact(input,['version','levels']) || !Array.isArray(input.levels) || !input.levels.length) fail('schema');
    const ids = new Set();
    for (const level of input.levels) {
      validate(level);
      if (!level.id || ids.has(level.id)) fail('schema');
      ids.add(level.id);
    }
    return input.levels;
  }
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  async function prepare(draft) {
    const copy = structuredClone(draft);
    const {units,records,events,waves,waveTemplates,turnLimit} = validate(copy);
    const source = profile(), terrainTypes = copy.terrain;
    const [levelDigest,rosterDigest,terrainDigest] = await Promise.all(
      [copy,units,terrainTypes].map(value => GoblinCatalogBase.hash(value)));
    const config = freeze({...source, ...(copy.width !== width || copy.height !== height ? {width:copy.width,height:copy.height} : {}),
      title:'Editor draft', kicker:'G.O.B.L.I.N.', kickerKey:'v2.editor.title',
      sub:'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',
      ...(copy.briefing ? {briefing:copy.briefing} : {}),
      ...(events ? {levelEvents:events} : {}),
      units,terrainTypes,terrain:terrainTypes.filter(cell => TerrainRules.coverBonus(cell.type)).map(key),
      catalog:{...source.catalog,records,levelDigest,rosterDigest,terrainDigest,
        full:{version:'catalog-full-levels-v1',source:copy.version,waves,waveTemplates,
          ...(turnLimit !== null ? {turnLimit} : {})}}});
    admitted.add(config);
    return config;
  }
  const unitTypes = () => Object.entries(profile().catalog.registry.units).map(([assetId, record]) =>
    ({assetId, squads:!!record.target.strengthRef}));
  root.GoblinEditorDraft = Object.freeze({id,version,size,available,copyTemplate,validate,parse,importLevels,exportJson,prepare,unitTypes,isPrepared:config => admitted.has(config)});
})(globalThis);
