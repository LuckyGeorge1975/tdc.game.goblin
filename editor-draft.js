// Local editor documents never enter the curated scenario registry.
(function(root) {
  const id = 'editor-draft', version = 'goblin-level-draft-v1';
  const width = 12, height = 8, objective = 'core-and-escort';
  const admitted = new WeakSet();
  const template = () => root.GoblinCatalogFullModel?.configs?.['catalog-full-terrain-course'];
  const available = () => !!template() && root.GoblinCatalogFullModel.profile === root.GoblinCatalogFullModel.publicProfile;
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const position = cell => Number.isInteger(cell.x) && cell.x >= 0 && cell.x < width &&
    Number.isInteger(cell.y) && cell.y >= 0 && cell.y < height;
  const key = cell => cell.x + ',' + cell.y;
  const fail = code => { throw new Error(code); };
  function copyTemplate() {
    if (!available()) fail('unavailable');
    const source = template();
    return {version, width, height, objective, terrain:source.terrainTypes.map(({x,y,type}) => ({x,y,type})),
      units:source.units.map((unit,index) => ({
        id:unit.core ? 'core' : 'draft-' + (index + 1), assetId:unit.catalogAssetId, team:unit.team, x:unit.x, y:unit.y,
        ...(unit.squads ? {squads:unit.squads} : {})
      }))};
  }
  function validate(draft) {
    if (!available()) fail('unavailable');
    if (!exact(draft,['version','width','height','objective','terrain','units']) || draft.version !== version ||
        draft.width !== width || draft.height !== height || draft.objective !== objective ||
        !Array.isArray(draft.terrain) || !Array.isArray(draft.units) ||
        draft.terrain.length > width * height || draft.units.length > width * height) fail('schema');
    const registry = template().catalog.registry;
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
      if (!exact(entry,fields) || typeof entry.id !== 'string' || !/^(core|draft-[1-9][0-9]{0,2})$/.test(entry.id) ||
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
    return {units,records};
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
    const {units,records} = validate(copy);
    const source = template(), terrainTypes = copy.terrain;
    const [levelDigest,rosterDigest,terrainDigest] = await Promise.all(
      [copy,units,terrainTypes].map(value => GoblinCatalogBase.hash(value)));
    const config = freeze({...source, title:'Editor draft', kickerKey:'v2.editor.title',
      units,terrainTypes,terrain:terrainTypes.filter(cell => TerrainRules.coverBonus(cell.type)).map(key),
      catalog:{...source.catalog,records,levelDigest,rosterDigest,terrainDigest,
        full:{...source.catalog.full,source:version}}});
    admitted.add(config);
    return config;
  }
  const unitTypes = () => Object.entries(template().catalog.registry.units).map(([assetId, record]) =>
    ({assetId, squads:!!record.target.strengthRef}));
  root.GoblinEditorDraft = Object.freeze({id,available,copyTemplate,validate,parse,prepare,unitTypes,isPrepared:config => admitted.has(config)});
})(globalThis);
