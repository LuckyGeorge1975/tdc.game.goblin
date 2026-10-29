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
  const entries=Object.freeze({
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
  function reject(code,message){const error=new Error(`${code}: ${message}`);error.code=code;throw error}
  function validate(id,config){
    if(id==='skimmer-pilot'){if(!globalThis.GoblinSkimmerPilot)reject('SCENARIO_PROFILE_MISMATCH','Pilot contract unavailable');GoblinSkimmerPilot.validate(config);}
    const expected=id===losProbe.id?losProbe:id==='iron-dust'&&
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
  function beginSession(id,config){
    validate(id,config);
    if(!Array.isArray(config.units)||!Array.isArray(config.terrain)||
      config.terrainTypes!==undefined&&!Array.isArray(config.terrainTypes))
      reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} hat keine gültigen effektiven Regeln; Partie wurde nicht geladen.`);
    const unitIds=new Set();
    for(const unit of config.units){
      if(!unit||typeof unit.id!=='string'||!unit.id||unitIds.has(unit.id)||
        !['player','enemy'].includes(unit.team)||
        !Number.isInteger(unit.x)||unit.x<0||unit.x>=12||!Number.isInteger(unit.y)||unit.y<0||unit.y>=8||
        !Number.isInteger(unit.hp)||unit.hp<1||!Number.isInteger(unit.maxHp)||unit.maxHp<unit.hp||
        !Number.isInteger(unit.defense)||unit.defense<1||
        !Number.isInteger(unit.range)||unit.range<0||!Number.isInteger(unit.move)||unit.move<0||
        !Number.isInteger(unit.damage)||unit.damage<0)
        reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} hat ungültige Einheitenwerte; Partie wurde nicht geladen.`);
      unitIds.add(unit.id);
    }
    if(!config.units.some(unit=>unit.team==='player')||
      config.units.filter(unit=>unit.team==='enemy'&&unit.core).length!==1)
      reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} hat keine gültige Parteien- oder Kernbelegung; Partie wurde nicht geladen.`);
    const source=JSON.parse(JSON.stringify(config));
    const session=freeze({schemaVersion:1,sessionId:nextSessionId++,scenarioId:id,
      scenarioVersion:source.scenarioVersion,ruleProfileId:source.ruleProfileId,
      effectiveRules:{objectiveVersion:source.objectiveVersion,objective:source.objective,
        ...(source.losMode?{losMode:source.losMode}:{}),
        ...(source.targetPolicyVersion?{targetPolicyVersion:source.targetPolicyVersion}:{}),
        ...(id==='skimmer-pilot'?{movement:source.movement,sourceDigest:source.sourceDigest}:{}),
        unitDataProfile:source.ruleProfile??null,terrain:source.terrain,
        terrainTypes:source.terrainTypes??[],units:source.units},config:source});
    return session;
  }
  return {schemaVersion:1,product,entries,validate,beginSession};
})());
