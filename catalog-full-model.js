// Fixed candidate contracts. Activation is separate from the canonical data flag.
(function(root){
 const profile='CATALOG_FULL_CANDIDATE_v1',scope=Object.freeze(Array.from({length:26},(_,i)=>`U${String(i+1).padStart(2,'0')}`));
 const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
 let configs=null;
 async function initialize(data,levelData){
  await GoblinCatalogBase.initialize(data);data=GoblinCatalogBase.registry;
  if(levelData?.version!=='catalog-full-levels-v1'||levelData.levels?.length!==5)throw Error('FULL_LEVEL_CONTRACT');
  if(await GoblinCatalogBase.hash(levelData)!=='ff1e209a956dff2cf2ac9c45932e670fec643b0c5451574daf85bb863c5d9c79')throw Error('FULL_LEVEL_DIGEST');
  const next={},mechanics={version:'catalog-full-mechanics-v1',scope,definitions:data.definitions,systemDefinitions:data.systemDefinitions,rules:Object.fromEntries(Object.entries(data.units).map(([id,r])=>[id,r.target]))};
  for(const level of levelData.levels){
   if(!level.id.startsWith('catalog-full-')||next[level.id]||level.width!==12||level.height!==8||level.objective!=='core-and-escort')throw Error('FULL_LEVEL_ID');
   const records={},make=entry=>{const u=GoblinCatalogSpecialistsModel.createUnit(entry,data,records,scope);if(u.catalogId==='U13')Object.assign(u,{cruiseMissile:true,ammunition:records[u.id].rules.ammunition,splashAttack:records[u.id].rules.splashAttack,blastRadius:1});return u};
   const units=level.units.map(make),waveTemplates=level.waveTemplates.map(make),occupied=new Set(),ids=new Set();
   for(const u of [...units,...waveTemplates]){if(ids.has(u.id))throw Error('FULL_DUPLICATE_ID');ids.add(u.id);if(u.catalogSystems)GoblinSystems.validateCatalogSystem(u.catalogSystems,data)}
   for(const u of units){
    if(!Number.isInteger(u.x)||!Number.isInteger(u.y)||u.x<0||u.x>=12||u.y<0||u.y>=8)throw Error('FULL_START_BOUNDS');
    if(u.embarkedOn){const owner=units.find(v=>v.id===u.embarkedOn);if(!owner?.droneBays?.includes(u.cargoBay)||u.catalogId!=='U14'||u.team!==owner.team||u.x!==owner.x||u.y!==owner.y)throw Error('FULL_START_CARGO');continue}
    const cell=`${u.x},${u.y}`,type=level.terrain.find(c=>c.x===u.x&&c.y===u.y)?.type??'open-ground';
    if(occupied.has(cell))throw Error(`FULL_START_COLLISION:${level.id}:${cell}`);occupied.add(cell);
    if(u.move>0&&!Number.isFinite(TerrainRules.movementCost(type,u))||u.move===0&&['water','river'].includes(type))throw Error(`FULL_START_TERRAIN:${level.id}:${u.id}:${type}`);
   }
   if(units.filter(u=>u.core).length!==1)throw Error('FULL_CORE_COUNT');
   const catalog={dataVersion:data.dataVersion,dataDigest:GoblinCatalogBase.digest,mechanicsVersion:mechanics.version,mechanicsDigest:await GoblinCatalogBase.hash(mechanics),levelDigest:await GoblinCatalogBase.hash(level),rosterDigest:await GoblinCatalogBase.hash(units),terrainDigest:await GoblinCatalogBase.hash(level.terrain),scope,records,cargo:data.definitions.cargo,registry:data,full:{version:level.version,source:level.source,waves:level.waves,waveTemplates,turnLimit:level.turnLimit}};
   next[level.id]=freeze({title:level.title,kicker:'G.O.B.L.I.N.',kickerKey:'screen.library.category',sub:'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',scenarioVersion:1,ruleProfileId:profile,ruleProfile:data.dataVersion,objectiveVersion:1,objective:level.objective,losMode:'strict-supercover',catalog,terrain:level.terrain.filter(c=>TerrainRules.coverBonus(c.type)).map(c=>`${c.x},${c.y}`),terrainTypes:level.terrain,units});
  }
  configs=freeze(next);return configs;
 }
 const has=id=>!!configs?.[id];
 function validate(id,config){if(!has(id)||JSON.stringify(stable(config))!==JSON.stringify(stable(configs[id])))throw Error('FULL_PROFILE_MISMATCH');return true}
 root.GoblinCatalogFullModel=Object.freeze({profile,scope,initialize,has,validate,get configs(){return configs}});
})(globalThis);
