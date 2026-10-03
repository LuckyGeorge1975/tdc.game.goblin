// Product profile authorization for new Legacy scenario starts.
// Unit data version field-test-atlas-v1 is separate from FIELD_TEST_LEGACY_v1.
const ScenarioRuleProfiles=Object.freeze((()=>{
  const product='FIELD_TEST_LEGACY_v1';
  const atlasData='field-test-atlas-v1';
  const entries=Object.freeze({
    'iron-dust':Object.freeze({scenarioVersion:1,objective:'core',ruleProfileId:product}),
    'relay-run':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product}),
    'unit-trial':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product}),
    'atlas-proving-grounds':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-terrain-course':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-advance':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-siege':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData}),
    'showcase-specialists':Object.freeze({scenarioVersion:1,objective:'core-and-escort',ruleProfileId:product,unitDataProfile:atlasData})
  });
  function reject(code,message){const error=new Error(`${code}: ${message}`);error.code=code;throw error}
  function validate(id,config){
    if(!config?.ruleProfileId||config.ruleProfileId!==product)
      reject('UNSUPPORTED_RULE_PROFILE',`Unbekanntes Regelprofil ${config?.ruleProfileId??'(fehlt)'}; Partie wurde nicht geladen.`);
    const expected=entries[id];
    if(!expected||config.scenarioVersion!==expected.scenarioVersion||config.objectiveVersion!==1||
      config.objective!==expected.objective||config.ruleProfileId!==expected.ruleProfileId||
      config.ruleProfile!==expected.unitDataProfile)
      reject('SCENARIO_PROFILE_MISMATCH',`Szenario ${id} und Regelprofil ${config.ruleProfileId} sind nicht kompatibel; Partie wurde nicht geladen.`);
    return expected;
  }
  return {schemaVersion:1,product,entries,validate};
})());
