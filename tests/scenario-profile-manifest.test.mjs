import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scenario-profile-manifest.js',import.meta.url),'utf8');
const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const combatFeedbackSource=readFileSync(new URL('../combat-feedback.js',import.meta.url),'utf8');
const scenarioSource=readFileSync(new URL('../scenario.js',import.meta.url),'utf8');
const ids=['iron-dust','relay-run','unit-trial','atlas-proving-grounds',
  'showcase-terrain-course','showcase-advance','showcase-siege','showcase-specialists','los-supercover-showcase'];

function validator(){
  const context=vm.createContext({});
  vm.runInContext(source,context);
  return config=>vm.runInContext(`ScenarioRuleProfiles.validate(${JSON.stringify(config.id)},${JSON.stringify(config)})`,context);
}

test('nine new-start pairs and the historical Iron Dust pair are authorized',()=>{
  const context=vm.createContext({});
  vm.runInContext(source,context);
  const entries=vm.runInContext('ScenarioRuleProfiles.entries',context);
  assert.equal(vm.runInContext('ScenarioRuleProfiles.schemaVersion',context),1);
  assert.deepEqual(Object.keys(entries).filter(id=>id!=='skimmer-pilot'),ids);
  assert.equal(entries['skimmer-pilot'].ruleProfileId,'CATALOG_SKIMMER_PILOT_v1');
  const validate=validator();
  for(const id of ids){
    const expected=entries[id];
    assert.equal(expected.ruleProfileId,id==='iron-dust'?'FIELD_TEST_LEGACY_v2':
      id==='los-supercover-showcase'?'FIELD_TEST_SUPERCOVER_v1':'FIELD_TEST_LEGACY_v1',id);
    assert.equal(expected.scenarioVersion,id==='iron-dust'?2:1,id);
    assert.equal(expected.targetPolicyVersion,id==='iron-dust'?'skip-depleted-treads-v1':undefined,id);
    assert.equal(expected.objective,id==='iron-dust'?'core':'core-and-escort',id);
    assert.equal(expected.unitDataProfile,id.startsWith('showcase-')||id==='atlas-proving-grounds'||id==='los-supercover-showcase'?'field-test-atlas-v1':undefined,id);
    assert.equal(validate({id,...expected,objectiveVersion:1,ruleProfile:expected.unitDataProfile}).objective,expected.objective,id);
  }
  assert.equal(validate({id:'iron-dust',scenarioVersion:1,objectiveVersion:1,
    objective:'core',ruleProfileId:'FIELD_TEST_LEGACY_v1'}).ruleProfileId,
  'FIELD_TEST_LEGACY_v1');
});

test('unknown profiles, missing IDs and incompatible scenario pairs fail closed',()=>{
  const validate=validator();
  const base={id:'iron-dust',scenarioVersion:2,objectiveVersion:1,objective:'core',
    ruleProfileId:'FIELD_TEST_LEGACY_v2',targetPolicyVersion:'skip-depleted-treads-v1'};
  for(const mutation of [
    {ruleProfileId:undefined},{ruleProfileId:'FULL_CATALOG_v1'},
    {id:'not-a-level'},{scenarioVersion:1},{ruleProfileId:'FIELD_TEST_LEGACY_v1'},
    {targetPolicyVersion:undefined},{targetPolicyVersion:'unknown'},
    {objectiveVersion:2},{objective:'core-and-escort'},{ruleProfile:'field-test-atlas-v1'}
  ]){
    assert.throws(()=>validate({...base,...mutation}),error=>
      /UNSUPPORTED_RULE_PROFILE|SCENARIO_PROFILE_MISMATCH/.test(error.message));
  }
  for(const mutation of [{scenarioVersion:2},{targetPolicyVersion:'skip-depleted-treads-v1'}]){
    assert.throws(()=>validate({id:'iron-dust',scenarioVersion:1,objectiveVersion:1,
      objective:'core',ruleProfileId:'FIELD_TEST_LEGACY_v1',...mutation}),
    /UNSUPPORTED_RULE_PROFILE|SCENARIO_PROFILE_MISMATCH/);
  }
});

test('a session owns a frozen copy of validated effective rules',()=>{
  const context=vm.createContext({});
  vm.runInContext(source,context);
  const config={scenarioVersion:2,objectiveVersion:1,ruleProfileId:'FIELD_TEST_LEGACY_v2',
    targetPolicyVersion:'skip-depleted-treads-v1',objective:'core',
    title:'Iron Dust',terrain:['1,1'],units:[
      {id:'core',team:'enemy',x:2,y:2,hp:5,maxHp:5,defense:5,range:0,move:0,damage:0,core:true},
      {id:'player',team:'player',x:1,y:1,hp:2,maxHp:2,defense:2,range:1,move:1,damage:1}]};
  context.config=config;
  const first=vm.runInContext("ScenarioRuleProfiles.beginSession('iron-dust',config)",context);
  assert.equal(first.schemaVersion,1);
  assert.equal(first.ruleProfileId,'FIELD_TEST_LEGACY_v2');
  assert.equal(first.effectiveRules.targetPolicyVersion,'skip-depleted-treads-v1');
  assert.equal(first.effectiveRules.objective,'core');
  assert.equal(first.effectiveRules.units[0].hp,5);
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.config.units[0]));
  config.objective='core-and-escort';config.targetPolicyVersion='unknown';
  config.units[0].hp=0;config.terrain.push('2,2');
  assert.equal(first.effectiveRules.objective,'core');
  assert.equal(first.effectiveRules.units[0].hp,5);
  assert.equal(first.effectiveRules.targetPolicyVersion,'skip-depleted-treads-v1');
  assert.deepEqual([...first.effectiveRules.terrain],['1,1']);
  for(const bad of [
    {...config,ruleProfileId:undefined},
    {...config,ruleProfileId:'FULL_CATALOG_v1'},
    {...config,scenarioVersion:1},
    {...config,objective:'core',units:undefined},
    {...config,objective:'core',terrain:undefined},
    {...config,objective:'core',units:[{...config.units[0],defense:-1},config.units[1]]}
  ]){
    assert.throws(()=>vm.runInContext(`ScenarioRuleProfiles.beginSession('iron-dust',${JSON.stringify(bad)})`,context),
      /UNSUPPORTED_RULE_PROFILE|SCENARIO_PROFILE_MISMATCH/);
  }
  const historical={...first.config,scenarioVersion:1,
    ruleProfileId:'FIELD_TEST_LEGACY_v1'};
  delete historical.targetPolicyVersion;
  const old=vm.runInContext(`ScenarioRuleProfiles.beginSession('iron-dust',${JSON.stringify(historical)})`,context);
  assert.equal(old.ruleProfileId,'FIELD_TEST_LEGACY_v1');
  assert.equal(old.effectiveRules.targetPolicyVersion,undefined);
});

test('an invalid built-in profile stops initial boot before gameplay handlers or first draw',()=>{
  const nodes=new Map(),classes=new Set(),listeners=[];
  const document={body:{classList:{add(name){classes.add(name)}}},querySelector(selector){
    if(!nodes.has(selector))nodes.set(selector,{textContent:'',disabled:false});
    return nodes.get(selector);
  },querySelectorAll(){return []},addEventListener(name){listeners.push(name)}};
  const context=vm.createContext({document,GoblinSystems:{createMarkIII:()=>({})},window:{}});
  vm.runInContext(source,context);
  const invalid=gameSource.replace("ruleProfileId:'FIELD_TEST_LEGACY_v2'","ruleProfileId:'FULL_CATALOG_v1'");
  assert.doesNotThrow(()=>vm.runInContext(invalid,context));
  assert.match(document.querySelector('#mission-sub').textContent,/Partie wurde nicht geladen/);
  assert.equal(vm.runInContext('goblinBootProfileError.code',context),'UNSUPPORTED_RULE_PROFILE');
  assert.equal(classes.has('boot-profile-rejected'),true);
  assert.equal(document.querySelector('#scenario-select').disabled,true);
  assert.equal(document.querySelector('#end-turn').disabled,true);
  assert.equal(document.querySelector('#reset-game').disabled,true);
  assert.equal(document.querySelector('#end-turn').onclick,undefined);
  assert.deepEqual(listeners,[],'gameplay keyboard handler must not be installed');
  vm.runInContext(scenarioSource,context);
  vm.runInContext('renderScenarioObjective()',context);
  assert.doesNotThrow(()=>vm.runInContext(combatFeedbackSource,context),
    'combat feedback must not inspect a rejected boot without a session');
  assert.doesNotThrow(()=>vm.runInContext('CombatFeedback.updateObjectiveStatus()',context));
  assert.equal(vm.runInContext('legacySession',context),null);
  assert.match(document.querySelector('#mission-sub').textContent,/Partie wurde nicht geladen/);
  assert.throws(()=>vm.runInContext("loadScenario('relay-run')",context),/UNSUPPORTED_RULE_PROFILE/);
});
