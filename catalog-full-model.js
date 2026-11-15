// Fixed public and internal admissions. Canonical data activation flags remain independent.
(function(root){
 const candidateProfile='CATALOG_FULL_CANDIDATE_v1',publicProfile='FULL_CATALOG_v1',scope=Object.freeze(Array.from({length:26},(_,i)=>`U${String(i+1).padStart(2,'0')}`));
 const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
 // Compatibility metadata is held outside authoring levels.
 const historicalLevels={
  "catalog-full-atlas":{"title":"ATLAS / PROVING GROUNDS","source":{"path":"assets/unit-art/levels/atlas-proving-grounds.json","sha256":"1f4e6a6303e9e835f41556e57595cf6d2646bb30d028fb412e090b7ff223673d","levelId":"atlas-proving-grounds"}},
  "catalog-full-terrain-course":{"title":"TERRAIN COURSE","source":{"path":"assets/unit-art/levels/showcase-levels.json","sha256":"eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140","levelId":"showcase-terrain-course"}},
  "catalog-full-advance":{"title":"ADVANCE","source":{"path":"assets/unit-art/levels/showcase-levels.json","sha256":"eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140","levelId":"showcase-advance"}},
  "catalog-full-siege":{"title":"System Duel and Siege","source":{"path":"assets/unit-art/levels/showcase-levels.json","sha256":"eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140","levelId":"showcase-siege"},"adjustments":[{"id":"u2-system-duel-buffer-v1","authorization":"Koordination 2026-10-29 / goblin-upe.4","runtimeUnitId":"catalog-full-siege-6","position":{"x":3,"y":5},"fromAssetId":"skimmer-carrier","toAssetId":"goblin-siegebreaker","reason":"Replace the unused carrier role with an approved MkIII system-duel buffer; all other positions, opponents, terrain, objectives and canonical unit values unchanged."}]},
  "catalog-full-specialists":{"title":"SPECIALISTS","source":{"path":"assets/unit-art/levels/showcase-levels.json","sha256":"eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140","levelId":"showcase-specialists"}}
 };
 let configs=null,profile=null,editorProfile=null;
 function historicalShape(data,requestedProfile){
  if(data?.version!=='goblin-level-package-v3')return data;
  const fail=()=>{throw Error('FULL_LEVEL_CONTRACT')};
  const fields=(value,required,optional=[])=>value&&typeof value==='object'&&!Array.isArray(value)&&
   required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));
  if(!fields(data,['version','levels'])||!Array.isArray(data.levels))fail();
  const version='catalog-full-levels-v1';
  return {version,levels:data.levels.map(level=>{
   if(!fields(level,['version','id','scenarioVersion','width','height','objective','terrain','units'],
    ['ruleProfile','goals','events','waveTemplates','aiAllowed','minimumDifficulty'])||level.version!=='goblin-level-v3'||level.scenarioVersion!==1||
    Object.hasOwn(level,'aiAllowed')&&typeof level.aiAllowed!=='boolean'||
    !Object.hasOwn(historicalLevels,level.id)||Object.hasOwn(level,'ruleProfile')&&level.ruleProfile!==requestedProfile||
    Object.hasOwn(level,'events')!==Object.hasOwn(level,'waveTemplates')||
    Object.hasOwn(level,'events')&&(!Array.isArray(level.events)||!Array.isArray(level.waveTemplates)))fail();
   if(Object.hasOwn(level,'minimumDifficulty')){
    if(requestedProfile!==publicProfile)fail();
    ScenarioRuleProfiles.fullMinimumDifficulty(level);
   }
   let turnLimit=null;
   if(Object.hasOwn(level,'goals')){
    const goal=Array.isArray(level.goals)&&level.goals.length===1&&level.goals[0];
    if(!fields(goal,['type','turns'])||goal.type!=='enemy-turn-limit'||!Number.isSafeInteger(goal.turns)||goal.turns<1)fail();
    turnLimit=goal.turns;
   }
   const {title,source,adjustments}=historicalLevels[level.id];
   return {id:level.id,version,source,width:level.width,height:level.height,title,objective:level.objective,turnLimit,
    terrain:level.terrain,units:level.units,waves:{version:'catalog-wave-config-v1',waves:level.events??[]},waveTemplates:level.waveTemplates??[],
    ...(adjustments?{adjustments}:{})};
  })};
 }
 async function initialize(data,levelData,admission){
  if(!admission||Object.keys(admission).length!==1||!Object.hasOwn(admission,'profile')||![candidateProfile,publicProfile].includes(admission.profile))throw Error('FULL_ADMISSION_REQUIRED');
  const requestedProfile=admission.profile;
  if(profile!==null&&profile!==requestedProfile)throw Error('FULL_ADMISSION_CONTEXT');
  const authored=levelData?.version==='goblin-level-package-v3'?levelData:null;
  levelData=historicalShape(levelData,requestedProfile);
  // Admission metadata does not alter the historical battlefield digest.
  const admissionByLevel=new Map(authored?.levels.map(level=>[level.id,{
   ...(Object.hasOwn(level,'aiAllowed')?{aiAllowed:level.aiAllowed}:{}),
   ...(Object.hasOwn(level,'minimumDifficulty')?{minimumDifficulty:level.minimumDifficulty}:{})}]));
  await GoblinCatalogBase.initialize(data);data=GoblinCatalogBase.registry;
  if(levelData?.version!=='catalog-full-levels-v1'||levelData.levels?.length!==5)throw Error('FULL_LEVEL_CONTRACT');
  if(await GoblinCatalogBase.hash(levelData)!=='ff1e209a956dff2cf2ac9c45932e670fec643b0c5451574daf85bb863c5d9c79')throw Error('FULL_LEVEL_DIGEST');
  const next={},mechanics={version:'catalog-full-mechanics-v1',scope,definitions:data.definitions,systemDefinitions:data.systemDefinitions,rules:Object.fromEntries(Object.entries(data.units).map(([id,r])=>[id,r.target]))};
  const catalogProfile={dataVersion:data.dataVersion,dataDigest:GoblinCatalogBase.digest,mechanicsVersion:mechanics.version,
   mechanicsDigest:await GoblinCatalogBase.hash(mechanics),scope,cargo:data.definitions.cargo,registry:data};
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
   const catalog={dataVersion:catalogProfile.dataVersion,dataDigest:catalogProfile.dataDigest,mechanicsVersion:catalogProfile.mechanicsVersion,
    mechanicsDigest:catalogProfile.mechanicsDigest,levelDigest:await GoblinCatalogBase.hash(level),rosterDigest:await GoblinCatalogBase.hash(units),
    terrainDigest:await GoblinCatalogBase.hash(level.terrain),scope,records,cargo:catalogProfile.cargo,registry:data,
    full:{version:level.version,source:level.source,waves:level.waves,waveTemplates,turnLimit:level.turnLimit}};
   next[level.id]=freeze({title:level.title,kicker:'G.O.B.L.I.N.',kickerKey:'screen.library.category',sub:'Kern und alle Gegner ausschalten; eigene Einheit erhalten.',scenarioVersion:1,ruleProfileId:requestedProfile,ruleProfile:data.dataVersion,objectiveVersion:1,objective:level.objective,losMode:'strict-supercover',catalog,terrain:level.terrain.filter(c=>TerrainRules.coverBonus(c.type)).map(c=>`${c.x},${c.y}`),terrainTypes:level.terrain,units,
    ...admissionByLevel.get(level.id)});
  }
  if(profile!==null&&profile!==requestedProfile)throw Error('FULL_ADMISSION_CONTEXT');
  configs=freeze(next);profile=requestedProfile;
  if(profile===publicProfile)editorProfile=freeze({ruleProfileId:profile,ruleProfile:data.dataVersion,scenarioVersion:1,
   objectiveVersion:1,objective:'core-and-escort',losMode:'strict-supercover',catalog:catalogProfile});
  return configs;
 }
 const has=(id,profileId=profile)=>profileId===profile&&!!configs&&Object.hasOwn(configs,id);
 function validate(id,config){if(!has(id,config?.ruleProfileId)||JSON.stringify(stable(config))!==JSON.stringify(stable(configs[id])))throw Error('FULL_PROFILE_MISMATCH');return true}
 root.GoblinCatalogFullModel=Object.freeze({candidateProfile,publicProfile,get profile(){return profile},get editorProfile(){return editorProfile},scope,initialize,has,validate,get configs(){return configs}});
})(globalThis);
