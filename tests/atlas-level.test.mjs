import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const atlas=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/atlas-proving-grounds.json',import.meta.url),'utf8'));
const showcase=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/showcase-levels.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../src/legacy/scripts/atlas-level.js',import.meta.url),'utf8');

async function load(bundle=showcase,search=''){
  const options=[],errors=[],loaded=[];
  const context=vm.createContext({
    W:12,H:8,scenarioCatalog:{},GoblinSystems:{createMarkIII:()=>({test:true})},
    TerrainRules:(await import('../src/legacy/scripts/terrain-rules.js')).default,updateRoster:()=>{},terrain:new Set(),currentScenario:'iron-dust',
    $:()=>({appendChild:option=>options.push(option)}),renderScenarioObjective:()=>{},
    document:{createElement:()=>({dataset:{}})},
    fetch:async url=>({ok:true,json:async()=>url.includes('showcase-levels')?bundle:atlas}),
    console:{error:(...items)=>errors.push(items)},addLog:()=>{},
    location:{search},loadScenario:id=>loaded.push(id),URLSearchParams
  });
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,options,errors,loaded};
}

test('ATLAS and four smaller scenarios load with complete roster and terrain coverage',async()=>{
  const {context,options,errors}=await load();
  assert.equal(errors.length,0);
  assert.deepEqual(options.map(option=>option.value),['atlas-proving-grounds',...showcase.levels.map(level=>level.id)]);
  const atlasScenario=context.scenarioCatalog['atlas-proving-grounds'];
  assert.equal(atlasScenario.units.length,26);
  assert.equal(new Set(atlasScenario.units.map(unit=>unit.visualKey)).size,26);
  assert.equal(new Set(atlasScenario.terrainTypes.map(cell=>cell.type)).size,12);
  const small=showcase.levels.map(level=>context.scenarioCatalog[level.id]);
  assert.equal(new Set(small.flatMap(scenario=>scenario.units.map(unit=>unit.visualKey))).size,26);
  assert.equal(new Set(['open-ground',...small[0].terrainTypes.map(cell=>cell.type)]).size,12);
  for(const scenario of small){
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
