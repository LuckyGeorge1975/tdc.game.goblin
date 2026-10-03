import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scenario-profile-manifest.js',import.meta.url),'utf8');
const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const ids=['iron-dust','relay-run','unit-trial','atlas-proving-grounds',
  'showcase-terrain-course','showcase-advance','showcase-siege','showcase-specialists'];

function validator(){
  const context=vm.createContext({});
  vm.runInContext(source,context);
  return config=>vm.runInContext(`ScenarioRuleProfiles.validate(${JSON.stringify(config.id)},${JSON.stringify(config)})`,context);
}

test('exactly eight scenario and product profile pairs are authorized',()=>{
  const context=vm.createContext({});
  vm.runInContext(source,context);
  const entries=vm.runInContext('ScenarioRuleProfiles.entries',context);
  assert.equal(vm.runInContext('ScenarioRuleProfiles.schemaVersion',context),1);
  assert.deepEqual(Object.keys(entries),ids);
  const validate=validator();
  for(const id of ids){
    const expected=entries[id];
    assert.equal(expected.ruleProfileId,'FIELD_TEST_LEGACY_v1',id);
    assert.equal(expected.scenarioVersion,1,id);
    assert.equal(expected.objective,id==='iron-dust'?'core':'core-and-escort',id);
    assert.equal(expected.unitDataProfile,id.startsWith('showcase-')||id==='atlas-proving-grounds'?'field-test-atlas-v1':undefined,id);
    assert.equal(validate({id,...expected,objectiveVersion:1,ruleProfile:expected.unitDataProfile}).objective,expected.objective,id);
  }
});

test('unknown profiles, missing IDs and incompatible scenario pairs fail closed',()=>{
  const validate=validator();
  const base={id:'iron-dust',scenarioVersion:1,objectiveVersion:1,objective:'core',ruleProfileId:'FIELD_TEST_LEGACY_v1'};
  for(const mutation of [
    {ruleProfileId:undefined},{ruleProfileId:'FULL_CATALOG_v1'},
    {id:'not-a-level'},{scenarioVersion:2},{objectiveVersion:2},
    {objective:'core-and-escort'},{ruleProfile:'field-test-atlas-v1'}
  ]){
    assert.throws(()=>validate({...base,...mutation}),error=>
      /UNSUPPORTED_RULE_PROFILE|SCENARIO_PROFILE_MISMATCH/.test(error.message));
  }
});

test('an invalid built-in profile stops initial boot before gameplay handlers or first draw',()=>{
  const nodes=new Map();
  const document={querySelector(selector){
    if(!nodes.has(selector))nodes.set(selector,{textContent:'',disabled:false});
    return nodes.get(selector);
  }};
  const context=vm.createContext({document,GoblinSystems:{createMarkIII:()=>({})},window:{}});
  vm.runInContext(source,context);
  const invalid=gameSource.replace("ruleProfileId:'FIELD_TEST_LEGACY_v1'","ruleProfileId:'FULL_CATALOG_v1'");
  assert.throws(()=>vm.runInContext(invalid,context),/UNSUPPORTED_RULE_PROFILE/);
  assert.match(document.querySelector('#mission-sub').textContent,/Partie wurde nicht geladen/);
  assert.equal(document.querySelector('#scenario-select').disabled,true);
  assert.equal(document.querySelector('#end-turn').disabled,true);
  assert.equal(document.querySelector('#reset-game').disabled,true);
  assert.equal(nodes.has('#battlefield-map'),false,'gameplay setup must not reach the first draw');
});
