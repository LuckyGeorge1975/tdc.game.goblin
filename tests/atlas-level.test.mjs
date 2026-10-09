import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const atlas=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/atlas-proving-grounds.json',import.meta.url),'utf8'));
const showcase=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/showcase-levels.json',import.meta.url),'utf8'));
const profiles=JSON.parse(readFileSync(new URL('../assets/unit-art/rules/unit-profiles.v1.json',import.meta.url),'utf8'));
const manifestSource=readFileSync(new URL('../scenario-profile-manifest.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../atlas-level.js',import.meta.url),'utf8');

async function load(bundle=showcase,search='',registry=profiles){
  const options=[],errors=[],loaded=[];
  const context=vm.createContext({
    W:12,H:8,scenarioCatalog:{},GoblinSystems:{createMarkIII:()=>({test:true})},
    TerrainRules:(await import('../terrain-rules.js')).default,updateRoster:()=>{},terrain:new Set(),currentScenario:'iron-dust',
    $:()=>({appendChild:option=>options.push(option)}),renderScenarioObjective:()=>{},
    document:{createElement:()=>({dataset:{}})},
    fetch:async url=>({ok:true,json:async()=>url.includes('unit-profiles')?registry:url.includes('showcase-levels')?bundle:atlas}),
    console:{error:(...items)=>errors.push(items)},addLog:()=>{},
    location:{search},loadScenario:id=>loaded.push(id),URLSearchParams
  });
  vm.runInContext(manifestSource,context);
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,options,errors,loaded};
}

test('ATLAS and five smaller scenarios load with complete roster and terrain coverage',async()=>{
  const {context,options,errors}=await load();
  assert.equal(errors.length,0);
  assert.deepEqual(options.map(option=>option.value),['atlas-proving-grounds',...showcase.levels.map(level=>level.id)]);
  const atlasScenario=context.scenarioCatalog['atlas-proving-grounds'];
  assert.equal(atlasScenario.objectiveVersion,1);
  assert.equal(atlasScenario.ruleProfile,'field-test-atlas-v1');
  assert.equal(atlasScenario.ruleProfileId,'FIELD_TEST_LEGACY_v1');
  assert.equal(atlasScenario.scenarioVersion,1);
  assert.equal(atlasScenario.objective,'core-and-escort');
  assert.equal(atlasScenario.units.length,26);
  assert.equal(new Set(atlasScenario.units.map(unit=>unit.visualKey)).size,26);
  assert.equal(new Set(atlasScenario.terrainTypes.map(cell=>cell.type)).size,12);
  const small=showcase.levels.map(level=>context.scenarioCatalog[level.id]);
  for(const id of ['atlas-proving-grounds',...showcase.levels.map(level=>level.id)]){
    const session=vm.runInContext(`ScenarioRuleProfiles.beginSession(${JSON.stringify(id)},scenarioCatalog[${JSON.stringify(id)}])`,context);
    assert.equal(session.scenarioId,id);
    assert.equal(session.ruleProfileId,id==='los-supercover-showcase'?
      'FIELD_TEST_SUPERCOVER_v1':'FIELD_TEST_LEGACY_v1');
    assert.equal(session.effectiveRules.unitDataProfile,'field-test-atlas-v1');
    assert.equal(session.effectiveRules.units.length,context.scenarioCatalog[id].units.length);
    assert.ok(Object.isFrozen(session.effectiveRules.units[0]));
  }
  assert.equal(new Set(small.flatMap(scenario=>scenario.units.map(unit=>unit.visualKey))).size,26);
  assert.equal(new Set(['open-ground',...small[0].terrainTypes.map(cell=>cell.type)]).size,12);
  for(const [index,scenario] of small.entries()){
    assert.equal(scenario.objectiveVersion,1);
    assert.equal(scenario.ruleProfileId,index===4?'FIELD_TEST_SUPERCOVER_v1':'FIELD_TEST_LEGACY_v1');
    assert.equal(scenario.scenarioVersion,1);
    assert.equal(scenario.objective,'core-and-escort');
    assert.equal(scenario.units.filter(unit=>unit.core&&unit.team==='enemy').length,1);
    assert.equal(new Set(scenario.units.map(unit=>`${unit.x},${unit.y}`)).size,scenario.units.length);
    const terrain=new Map(scenario.terrainTypes.map(cell=>[`${cell.x},${cell.y}`,cell.type]));
    for(const unit of scenario.units){
      if(unit.move>0)assert.ok(Number.isFinite(context.TerrainRules.movementCost(terrain.get(`${unit.x},${unit.y}`)||'open-ground',unit)));
    }
  }
  assert.ok(small[3].units.find(unit=>unit.visualKey==='strategic-missile-carrier')?.strategicMissile);
  assert.ok(small[3].units.find(unit=>unit.visualKey==='amphibious-infantry')?.amphibious);
  assert.equal(small[3].units.find(unit=>unit.visualKey==='skimmer-carrier')?.transportCapacity,3);
});

test('asset levels reject missing, unknown and mismatched product profiles before registration',async()=>{
  for(const mutation of [
    level=>{level.ruleProfileId=''},
    level=>{level.ruleProfileId='FULL_CATALOG_v1'},
    level=>{level.scenarioVersion=2},
    level=>{level.objective='core'}
  ]){
    const invalid=structuredClone(showcase);
    mutation(invalid.levels[0]);
    const {context,errors,options}=await load(invalid);
    assert.ok(context.scenarioCatalog['atlas-proving-grounds']);
    assert.equal(context.scenarioCatalog['showcase-terrain-course'],undefined);
    assert.equal(options.length,1);
    assert.match(String(errors[0]?.[1]),/UNSUPPORTED_RULE_PROFILE|SCENARIO_PROFILE_MISMATCH/);
  }
});

test('the inactive catalog target leaves all 26 live ATLAS values at the versioned Legacy snapshot',async()=>{
  const {context,errors}=await load();
  assert.equal(errors.length,0);
  assert.equal(profiles.targetActive,false);
  const units=context.scenarioCatalog['atlas-proving-grounds'].units;
  assert.equal(Object.keys(profiles.units).length,26);
  assert.deepEqual(new Set(units.map(unit=>unit.visualKey)),new Set(Object.keys(profiles.units)));
  for(const unit of units){
    const [hp,defense,range,move,damage,icon,type]=profiles.units[unit.visualKey].legacy;
    assert.deepEqual([unit.maxHp,unit.defense,unit.range,unit.move,unit.damage,unit.icon,unit.type],
      [hp,defense,range,move,damage,icon,type],unit.visualKey);
  }
  assert.equal(units.find(unit=>unit.visualKey==='local-defense').move,0);
  assert.equal(profiles.units['local-defense'].target.movement[0],2);
});

test('a malformed rule register prevents all five levels from loading',async()=>{
  const invalid=structuredClone(profiles);
  invalid.units['assault-tank'].legacy[0]=-1;
  const {context,errors}=await load(showcase,'',invalid);
  assert.equal(Object.keys(context.scenarioCatalog).length,0);
  assert.match(String(errors[0]?.[1]),/Unit rule profile invalid/);
});

test('a mistakenly activated full-catalog draft blocks all asset levels',async()=>{
  const invalid=structuredClone(profiles);
  invalid.targetActive=true;
  const {context,errors}=await load(showcase,'',invalid);
  assert.equal(Object.keys(context.scenarioCatalog).length,0);
  assert.match(String(errors[0]?.[1]),/Unit rule profile invalid/);
});

test('loader rejects malformed starts before adding a selectable level',async()=>{
  const invalid=structuredClone(showcase);
  invalid.levels[0].units[0].x=invalid.levels[0].units[1].x;
  invalid.levels[0].units[0].y=invalid.levels[0].units[1].y;
  const {context,errors}=await load(invalid);
  assert.ok(context.scenarioCatalog['atlas-proving-grounds']);
  assert.equal(context.scenarioCatalog['showcase-terrain-course'],undefined);
  assert.match(String(errors[0]?.[1]),/duplicate unit or position/);
});

test('a showcase URL selects its loaded scenario',async()=>{
  const {options,loaded}=await load(showcase,'?scenario=showcase-siege');
  assert.deepEqual(loaded,['showcase-siege']);
  assert.ok(options.find(option=>option.value==='showcase-siege'));
});
