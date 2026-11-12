// Local editor documents never enter the curated scenario registry.
(function(root) {
  const id = 'editor-draft', version = 'goblin-level-v3', historicalVersion = 'goblin-level-draft-v1';
  const width = 12, height = 8, objective = 'core-and-escort';
  const admitted = new WeakSet();
  const template = () => root.GoblinCatalogFullModel?.configs?.['catalog-full-terrain-course'];
  const profile = () => root.GoblinCatalogFullModel?.editorProfile;
  const available = () => !!profile();
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const position = cell => Number.isInteger(cell.x) && cell.x >= 0 && cell.x < width &&
    Number.isInteger(cell.y) && cell.y >= 0 && cell.y < height;
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
    if (!root.GoblinLevelEvents || !Array.isArray(draft.events) || draft.events.length > 24) fail('events');
    const hooks = draft.events.map(event => {
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
    if (current) for (const key of ['ruleProfile','hotspots','events']) if (Object.hasOwn(draft,key)) fields.push(key);
    if (!exact(draft,fields) || (!oldEvents && !current && draft.version !== historicalVersion) ||
        (current && Object.hasOwn(draft,'ruleProfile') && draft.ruleProfile !== profile().ruleProfileId) ||
        draft.width !== width || draft.height !== height || draft.objective !== objective ||
        !Array.isArray(draft.terrain) || !Array.isArray(draft.units) ||
        draft.terrain.length > width * height || draft.units.length > width * height) fail('schema');
    const registry = profile().catalog.registry;
    const terrains = new Map(), occupied = new Set(), ids = new Set();
    for (const cell of draft.terrain) {
      if (!exact(cell,['x','y','type']) || typeof cell.type !== 'string' || !Object.hasOwn(TerrainRules.rules, cell.type)) fail('terrain');
      if (!position(cell)) fail('bounds');
      if (terrains.has(key(cell))) fail('collision');
      terrains.set(key(cell), cell.type);
    }
    const records = {}, units = [];
    for (const entry of draft.units) {
      if (!entry || typeof entry.assetId !== 'string' || !Object.hasOwn(registry.units, entry.assetId)) fail('unit');
      const rule = registry.units[entry.assetId].target;
      const fields = ['id','assetId','team','x','y'];
      if (rule.strengthRef) fields.push('squads');
      if (!exact(entry,fields) || typeof entry.id !== 'string' ||
          !(oldEvents || current ? /^[a-z][a-z0-9-]{0,47}$/.test(entry.id) : /^(core|draft-[1-9][0-9]{0,2})$/.test(entry.id)) ||
          !['player','enemy'].includes(entry.team)) fail('unit');
      if (!position(entry)) fail('bounds');
      if (ids.has(entry.id) || occupied.has(key(entry))) fail('collision');
      if ((entry.id === 'core') !== (entry.assetId === 'command-core') ||
          entry.id === 'core' && entry.team !== 'enemy') fail('core');
      if (rule.strengthRef && (!Number.isInteger(entry.squads) || entry.squads < 1 || entry.squads > 3)) fail('unit');
      ids.add(entry.id);
      occupied.add(key(entry));
      const unit = GoblinCatalogSpecialistsModel.createUnit(entry, registry, records, GoblinCatalogFullModel.scope);
      const type = terrains.get(key(entry)) ?? 'open-ground';
      if (unit.move > 0 ? !Number.isFinite(TerrainRules.movementCost(type, unit)) : ['water','river'].includes(type)) fail('startTerrain');
      if (rule.missileRuleRef) Object.assign(unit, {cruiseMissile:true, ammunition:rule.ammunition, splashAttack:rule.splashAttack, blastRadius:1});
      units.push(unit);
    }
    if (!ids.has('core')) fail('core');
    if (!units.some(unit => unit.team === 'player')) fail('player');
    const events = eventData(draft);
    if (events) root.GoblinLevelEvents.validate(events,ids,position);
    return {units,records,events};
  }
  function exportJson(draft) {
    const {events} = validate(draft);
    const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key,sort(value[key])])) : value;
    return JSON.stringify(sort({version,width,height,objective,terrain:draft.terrain,units:draft.units,
      ...(Object.hasOwn(draft,'ruleProfile') ? {ruleProfile:draft.ruleProfile} : {}),
      ...(events ? {hotspots:events.hotspots,events:events.hooks.map(({id,when,show}) =>
        ({id,when,effect:{type:show.style==='general'?'general-dialog':'dialog',title:show.title,text:show.text}}))} : {})
    }),null,2);
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > 65536) fail('schema');
    let draft;
    try { draft = JSON.parse(text); } catch { fail('json'); }
    validate(draft);
    return draft;
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
    const {units,records,events} = validate(copy);
    const source = profile(), terrainTypes = copy.terrain;
    const [levelDigest,rosterDigest,terrainDigest] = await Promise.all(
      [copy,units,terrainTypes].map(value => GoblinCatalogBase.hash(value)));
    const config = freeze({...source, title:'Editor draft', kicker:'G.O.B.L.I.N.', kickerKey:'v2.editor.title',
      sub:'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',
      ...(events ? {levelEvents:events} : {}),
      units,terrainTypes,terrain:terrainTypes.filter(cell => TerrainRules.coverBonus(cell.type)).map(key),
      catalog:{...source.catalog,records,levelDigest,rosterDigest,terrainDigest,
        full:{version:'catalog-full-levels-v1',source:copy.version,waves:{version:'catalog-wave-config-v1',waves:[]},waveTemplates:[]}}});
    admitted.add(config);
    return config;
  }
  const unitTypes = () => Object.entries(profile().catalog.registry.units).map(([assetId, record]) =>
    ({assetId, squads:!!record.target.strengthRef}));
  root.GoblinEditorDraft = Object.freeze({id,version,available,copyTemplate,validate,parse,exportJson,prepare,unitTypes,isPrepared:config => admitted.has(config)});
})(globalThis);
