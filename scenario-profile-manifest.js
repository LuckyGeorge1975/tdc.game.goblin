// Product profile authorization for new Legacy scenario starts.
// Unit data version field-test-atlas-v1 is separate from FIELD_TEST_LEGACY_v1.
const ScenarioRuleProfiles=Object.freeze((()=>{
  const product='FIELD_TEST_LEGACY_v1';
  const correctedIronDust='FIELD_TEST_LEGACY_v2';
  const correctedTargetPolicy='skip-depleted-treads-v1';
  const atlasData='field-test-atlas-v1';
  const historicalIronDust=Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:product});
  const losProbe=Object.freeze({id:'los-supercover-probe',scenarioVersion:1,
    objective:'core',ruleProfileId:'LEGACY_SUPERCOVER_PROBE_v1',losMode:'strict-supercover'});
  const fullIds=['catalog-full-atlas','catalog-full-terrain-course','catalog-full-advance','catalog-full-siege','catalog-full-specialists'];
  const fullCandidateEntries=Object.freeze(Object.fromEntries(fullIds.map(id=>[id,Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:'CATALOG_FULL_CANDIDATE_v1',unitDataProfile:'catalog-approved-data-v1',losMode:'strict-supercover'})])));
  const trainingIds=['training-t01','training-t02','training-t03'];
  const entries=Object.freeze({
    ...Object.fromEntries(trainingIds.map(id=>[id,Object.freeze({scenarioVersion:1,objective:'learning',ruleProfileId:'TRAINING_FIELD_TEST_v1',unitDataProfile:'training-field-test-data-v1',losMode:'legacy-pixel-los-v1'})])),
    ...Object.fromEntries(fullIds.map(id=>[id,Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:'FULL_CATALOG_v1',unitDataProfile:'catalog-approved-data-v1',losMode:'strict-supercover'})])),
    'catalog-siege':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_SPECIALISTS_v1',unitDataProfile:'catalog-approved-data-v1',losMode:'strict-supercover'}),
    'catalog-specialists':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_SPECIALISTS_v1',unitDataProfile:'catalog-approved-data-v1',losMode:'strict-supercover'}),
    'catalog-transport':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_BASE_TRANSPORT_v1',unitDataProfile:'catalog-approved-data-v1',losMode:'strict-supercover'}),
    'catalog-maneuver':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_BASE_TRANSPORT_v1',unitDataProfile:'catalog-approved-data-v1',losMode:'strict-supercover'}),
    'artillery-pilot':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_ARTILLERY_PILOT_v1',unitDataProfile:'artillery-pilot-data-v1',losMode:'strict-supercover'}),
    'siege-pilot':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_SIEGE_PILOT_v1',unitDataProfile:'siege-pilot-data-v1'}),
    'skimmer-pilot':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:'CATALOG_SKIMMER_PILOT_v1',unitDataProfile:'skimmer-pilot-data-v1'}),
    'iron-dust':Object.freeze({scenarioVersion:2,objective:'core',ruleProfileId:correctedIronDust,
      targetPolicyVersion:correctedTargetPolicy}),
    'relay-run':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product}),
    'unit-trial':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product}),
    'atlas-proving-grounds':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-terrain-course':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-advance':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-siege':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-specialists':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'los-supercover-showcase':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:'FIELD_TEST_SUPERCOVER_v1',unitDataProfile:atlasData,losMode:'strict-supercover'})
  });
  // Historical stats and traits stay in profile-owned records. Factories run only during resolution.
  const legacyUnitProfiles={
    "goblin-siegebreaker":{"name":"GOBLIN SIEGEBREAKER","type":"HEAVY ASSAULT","hp":5,"maxHp":5,"defense":5,"range":2,"move":3,"damage":3,"icon":"G","ogreSystems":()=>GoblinSystems.createMarkIII()},
    "skimmer-scout":{"name":"SKIMMER SCOUT","type":"HOVERCRAFT","hp":3,"maxHp":3,"defense":3,"range":3,"move":3,"damage":1,"icon":"G"},
    "rocket-artillery":{"name":"ROCKET ARTILLERY","type":"ARTILLERY","hp":3,"maxHp":3,"defense":3,"range":4,"move":1,"damage":2,"icon":"M"},
    "infantry-platoon":{"name":"INFANTRY PLATOON","type":"MOBILE INFANTRY","hp":2,"maxHp":2,"defense":2,"range":1,"move":2,"damage":1,"icon":"I","infantry":true},
    "command-core":{"name":"COMMAND CORE","type":"FORTIFIED TARGET","hp":5,"maxHp":5,"defense":5,"range":0,"move":0,"damage":0,"icon":"X","core":true},
    "guard-tank":{"name":"GUARD TANK","type":"HOSTILE ARMOR","hp":3,"maxHp":3,"defense":3,"range":2,"move":1,"damage":1,"icon":"G"},
    "raider-skimmer":{"name":"RAIDER SKIMMER","type":"HOSTILE HOVER","hp":2,"maxHp":2,"defense":2,"range":2,"move":2,"damage":1,"icon":"R"},
    "relay-node":{"name":"RELAY NODE","type":"FORTIFIED TARGET","hp":4,"maxHp":4,"defense":4,"range":0,"move":0,"damage":0,"icon":"X","core":true},
    "assault-tank":{"name":"ASSAULT TANK","type":"FRONTLINE ARMOR","hp":3,"maxHp":3,"defense":3,"range":2,"move":3,"damage":4,"icon":"H"},
    "recon-tank":{"name":"RECON TANK","type":"SCOUT ARMOR","hp":2,"maxHp":2,"defense":2,"range":2,"move":3,"damage":2,"icon":"L"},
    "skimmer-carrier":{"name":"SKIMMER CARRIER","type":"PERSONNEL CARRIER","hp":2,"maxHp":2,"defense":2,"range":2,"move":3,"damage":1,"icon":"P","movementMode":"gev","gev":true,"transportCapacity":3},
    "field-engineers":{"name":"FIELD ENGINEERS","type":"FIELD ENGINEERING","hp":2,"maxHp":2,"defense":2,"range":1,"move":2,"damage":2,"icon":"E","infantry":true,"engineering":true},
    "command-hub":{"name":"COMMAND HUB","type":"FORTIFIED TARGET","hp":5,"maxHp":5,"defense":5,"range":0,"move":0,"damage":0,"icon":"X","core":true},
    "siege-tank":{"name":"SIEGE TANK","type":"TWIN-GUN TANK DESTROYER","hp":5,"maxHp":5,"defense":5,"range":3,"move":3,"damage":6,"icon":"S"},
    "light-skimmer":{"name":"LIGHT SKIMMER","type":"HOSTILE HOVERCRAFT","hp":1,"maxHp":1,"defense":1,"range":2,"move":3,"damage":1,"icon":"L"},
    "strategic-missile-carrier":{"name":"STRATEGIC MISSILE CARRIER","type":"ONE-SHOT MISSILE PLATFORM","hp":2,"maxHp":2,"defense":2,"range":8,"move":1,"damage":6,"icon":"C","strategicMissile":true,"missilesRemaining":1}
  };
  const legacyCopy={
    "iron-dust":{"kicker":"MISSION 07 / IRON DUST","title":"Durchbrechen. Ausschalten. Überleben.","sub":"Zerstöre den feindlichen Kommandokern, bevor Verstärkungen eintreffen."},
    "relay-run":{"kicker":"MISSION 08 / RELAY RUN","title":"Sichern. Halten. Extrahieren.","sub":"Erreiche den östlichen Relaisknoten und schalte seine Eskorte aus."},
    "unit-trial":{"kicker":"MISSION 09 / UNIT TRIAL","title":"Katalog testen. Linie halten.","sub":"Erprobe die neuen Einheiten gegen eine gemischte Verteidigung."}
  };
  function reject(code,message){const error=new Error(`${code}: ${message}`);error.code=code;throw error}
  function legacyLevel(level){
    const fail=()=>reject('SCENARIO_PROFILE_MISMATCH','Invalid historical level data');
    const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
      Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
    const fields=['version','id','scenarioVersion','width','height','ruleProfile','objective','terrain','units'];
    if(level&&Object.hasOwn(level,'aiAllowed'))fields.push('aiAllowed');
    if(!exact(level,fields)||
      level.version!=='goblin-level-v3'||!Object.hasOwn(legacyCopy,level.id)||level.width!==12||level.height!==8||
      !Array.isArray(level.terrain)||!Array.isArray(level.units))fail();
    const rules=entries[level.id];
    if(level.ruleProfile!==rules.ruleProfileId)
      reject('UNSUPPORTED_RULE_PROFILE',`Unbekanntes Regelprofil ${level.ruleProfile}; Partie wurde nicht geladen.`);
    if(level.scenarioVersion!==rules.scenarioVersion||level.objective!==rules.objective)fail();
    const position=cell=>Number.isInteger(cell.x)&&cell.x>=0&&cell.x<level.width&&
      Number.isInteger(cell.y)&&cell.y>=0&&cell.y<level.height;
    const key=cell=>`${cell.x},${cell.y}`;
    const cells=new Set(),ids=new Set(),starts=new Set();
    for(const cell of level.terrain){
      if(!exact(cell,['x','y','type'])||!position(cell)||cell.type!=='rubble-field'||cells.has(key(cell)))fail();
      cells.add(key(cell));
    }
    const units=level.units.map(unit=>{
      if(!exact(unit,['id','assetId','team','x','y'])||typeof unit.id!=='string'||!/^[a-z][a-z0-9-]*$/.test(unit.id)||
        !Object.hasOwn(legacyUnitProfiles,unit.assetId)||!['player','enemy'].includes(unit.team)||
        !position(unit)||ids.has(unit.id)||starts.has(key(unit)))fail();
      ids.add(unit.id);starts.add(key(unit));
      const {name,type,...record}=legacyUnitProfiles[unit.assetId];
      if(record.ogreSystems)record.ogreSystems=record.ogreSystems();
      const {id,team,x,y}=unit;
      return {id,name,type,team,x,y,...record};
    });
    if(!units.some(unit=>unit.team==='player')||units.filter(unit=>unit.team==='enemy'&&unit.core).length!==1)fail();
    return {...legacyCopy[level.id],scenarioVersion:rules.scenarioVersion,ruleProfileId:rules.ruleProfileId,
      ...(rules.targetPolicyVersion?{targetPolicyVersion:rules.targetPolicyVersion}:{}),
      ...(Object.hasOwn(level,'aiAllowed')?{aiAllowed:aiAllowed(level)}:{}),
      objectiveVersion:1,objective:rules.objective,terrain:[...cells],units};
  }
  function aiAllowed(config){
    const learning=config?.ruleProfileId==='TRAINING_FIELD_TEST_v1'||config?.ruleProfile==='TRAINING_FIELD_TEST_v1';
    if(config&&Object.hasOwn(config,'aiAllowed')){
      if(typeof config.aiAllowed!=='boolean'||learning&&config.aiAllowed)
        reject('SCENARIO_AI_PERMISSION_INVALID','Invalid aiAllowed');
      return config.aiAllowed;
    }
    return !!config&&!learning;
  }
  function requireAi(session){
    if(!aiAllowed(session?.config))reject('AI_LEVEL_FORBIDDEN','AI control is disabled for this level');
  }
  const fullDifficulties=Object.freeze(['weak','medium','strong']);
  function fullMinimumDifficulty(config){
    if(!Object.hasOwn(config??{},'minimumDifficulty'))return null;
    const value=config.minimumDifficulty;
    if(!fullDifficulties.includes(value))reject('FULL_AI_MINIMUM_INVALID','Invalid FULL minimumDifficulty');
    return value;
  }
  function checkEnemyControllers(session,move,fire){
    if(typeof move==='function'||typeof fire==='function')requireAi(session);
  }
  function validate(id,config){
    aiAllowed(config);
    if(trainingIds.includes(id)){if(!globalThis.GoblinTrainingModel)reject('SCENARIO_PROFILE_MISMATCH','Training contract unavailable');GoblinTrainingModel.validate(id,config);return entries[id]}
    if(fullIds.includes(id)){if(!globalThis.GoblinCatalogFullModel)reject('SCENARIO_PROFILE_MISMATCH','Full contract unavailable');GoblinCatalogFullModel.validate(id,config);}
    if(['catalog-siege','catalog-specialists'].includes(id)){if(!globalThis.GoblinCatalogSpecialistsModel)reject('SCENARIO_PROFILE_MISMATCH','Specialists contract unavailable');GoblinCatalogSpecialistsModel.validate(id,config);}
    if(['catalog-transport','catalog-maneuver'].includes(id)){if(!globalThis.GoblinCatalogBase)reject('SCENARIO_PROFILE_MISMATCH','Catalog contract unavailable');GoblinCatalogBase.validate(id,config);}
    if(id==='artillery-pilot'){if(!globalThis.GoblinArtilleryPilot)reject('SCENARIO_PROFILE_MISMATCH','Pilot contract unavailable');GoblinArtilleryPilot.validate(config);}
    if(id==='siege-pilot'){if(!globalThis.GoblinSiegePilot)reject('SCENARIO_PROFILE_MISMATCH','Pilot contract unavailable');GoblinSiegePilot.validate(config);}
    if(id==='skimmer-pilot'){if(!globalThis.GoblinSkimmerPilot)reject('SCENARIO_PROFILE_MISMATCH','Pilot contract unavailable');GoblinSkimmerPilot.validate(config);}
    const expected=fullIds.includes(id)&&config?.ruleProfileId==='CATALOG_FULL_CANDIDATE_v1'?fullCandidateEntries[id]:id===losProbe.id?losProbe:id==='iron-dust'&&
      config?.scenarioVersion===1&&config?.ruleProfileId===product
      ?historicalIronDust:entries[id];
    if(!config?.ruleProfileId||config.ruleProfileId!==expected?.ruleProfileId)
      reject('UNSUPPORTED_RULE_PROFILE',`Unbekanntes Regelprofil ${config?.ruleProfileId??'(fehlt)'}; Partie wurde nicht geladen.`);
    if(!expected||config.scenarioVersion!==expected.scenarioVersion||config.objectiveVersion!==1||
      config.objective!==expected.objective||config.ruleProfileId!==expected.ruleProfileId||
      config.ruleProfile!==expected.unitDataProfile||config.losMode!==expected.losMode||
      config.targetPolicyVersion!==expected.targetPolicyVersion)
      reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} und Regelprofil ${config.ruleProfileId} sind nicht kompatibel; Partie wurde nicht geladen.`);
    return expected;
  }
  const freeze=value=>{
    if(value&&typeof value==='object'){
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  let nextSessionId=1;
  const draftSessions = new WeakSet();
  function beginDraftSession(config){
    const editor=globalThis.GoblinEditorDraft;
    if(!editor?.isPrepared(config))reject('SCENARIO_PROFILE_MISMATCH','Editor draft was not validated');
    const session=buildSession(editor.id,config,true);
    draftSessions.add(session);
    return session;
  }
  function beginSession(id,config){
    validate(id,config);
    return buildSession(id,config,false);
  }
  function buildSession(id,config,draft){
    aiAllowed(config);
    const width=draft?config.width??12:12, height=draft?config.height??8:8;
    if(!Array.isArray(config.units)||!Array.isArray(config.terrain)||
      config.terrainTypes!==undefined&&!Array.isArray(config.terrainTypes))
      reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} hat keine gültigen effektiven Regeln; Partie wurde nicht geladen.`);
    const unitIds=new Set();
    for(const unit of config.units){
      if(!unit||typeof unit.id!=='string'||!unit.id||unitIds.has(unit.id)||
        !['player','enemy'].includes(unit.team)||
        !Number.isInteger(unit.x)||unit.x<0||unit.x>=width||!Number.isInteger(unit.y)||unit.y<0||unit.y>=height||
        !Number.isInteger(unit.move)||unit.move<0||
        (unit.catalogSystems?
          ((!draft&&!['catalog-siege','catalog-specialists',...fullIds].includes(id))||Object.hasOwn(unit,'hp')||Object.hasOwn(unit,'maxHp')||Object.hasOwn(unit,'infantry')||unit.alive!==true||!GoblinSystems.validateCatalogSystem(unit.catalogSystems,config.catalog.registry)):
          (!Number.isInteger(unit.hp)||unit.hp<1||!Number.isInteger(unit.maxHp)||unit.maxHp<unit.hp||!Number.isInteger(unit.defense)||unit.defense<1||!Number.isInteger(unit.range)||unit.range<0||!Number.isInteger(unit.damage)||unit.damage<0)))
        reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} hat ungültige Einheitenwerte; Partie wurde nicht geladen.`);
      unitIds.add(unit.id);
    }
    if(!config.units.some(unit=>unit.team==='player')||
      (!trainingIds.includes(id)&&config.units.filter(unit=>unit.team==='enemy'&&unit.core).length!==1))
      reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} hat keine gültige Parteien- oder Kernbelegung; Partie wurde nicht geladen.`);
    const source=JSON.parse(JSON.stringify(config));
    const session=freeze({schemaVersion:1,sessionId:nextSessionId++,scenarioId:id,
      scenarioVersion:source.scenarioVersion,ruleProfileId:source.ruleProfileId,
      effectiveRules:{objectiveVersion:source.objectiveVersion,objective:source.objective,
        ...(source.losMode?{losMode:source.losMode}:{}),
        ...(source.targetPolicyVersion?{targetPolicyVersion:source.targetPolicyVersion}:{}),
        ...(id==='artillery-pilot'?{fireBudgetVersion:source.fireBudgetVersion,sourceDigest:source.sourceDigest}:{}),
        ...(id==='siege-pilot'?{fireBudgetVersion:source.fireBudgetVersion,sourceDigest:source.sourceDigest}:{}),
        ...(id==='skimmer-pilot'?{movement:source.movement,sourceDigest:source.sourceDigest}:{}),
        ...((draft||globalThis.GoblinCatalogBase?.has(id)||globalThis.GoblinCatalogSpecialistsModel?.has(id)||globalThis.GoblinCatalogFullModel?.has(id))?{catalog:source.catalog}:{}),
        ...(trainingIds.includes(id)?{training:source.training}:{}),
        unitDataProfile:source.ruleProfile??null,terrain:source.terrain,
        terrainTypes:source.terrainTypes??[],units:source.units},config:source});
    return session;
  }
  return {schemaVersion:1,product,entries,legacyLevel,validate,beginSession,beginDraftSession,aiAllowed,requireAi,checkEnemyControllers,
    fullDifficulties,fullMinimumDifficulty,
    isDraftSession:session=>draftSessions.has(session)};
})());
