import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('ATLAS loads the content JSON as a playable scenario with unique units',async()=>{
  const level=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/atlas-proving-grounds.json',import.meta.url),'utf8'));
  const options=[];
  const context=vm.createContext({
    W:12,H:8,scenarioCatalog:{},GoblinSystems:{createMarkIII:()=>({test:true})},
    TerrainRules:(await import('../terrain-rules.js')).default,updateRoster:()=>{},terrain:new Set(),currentScenario:'iron-dust',
    $:()=>({appendChild:option=>options.push(option)}),
    document:{createElement:()=>({})},
    fetch:async()=>({ok:true,json:async()=>level}),
    console,addLog:()=>{}
  });
  vm.runInContext(readFileSync(new URL('../atlas-level.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const scenario=context.scenarioCatalog['atlas-proving-grounds'];
  assert.ok(scenario);
  assert.equal(scenario.units.length,26);
  assert.equal(new Set(scenario.units.map(unit=>`${unit.x},${unit.y}`)).size,26);
  assert.equal(new Set(scenario.terrainTypes.map(cell=>cell.type)).size,12);
  assert.equal(scenario.terrain.length,12);
  assert.ok(scenario.units.find(unit=>unit.id==='core')?.core);
  assert.ok(scenario.units.find(unit=>unit.id==='ogre')?.ogreSystems);
  assert.ok(scenario.units.find(unit=>unit.name==='AMPHIBIOUS INFANTRY')?.amphibious);
  const terrainByPosition=new Map(scenario.terrainTypes.map(cell=>[`${cell.x},${cell.y}`,cell.type]));
  for(const unit of scenario.units){
    const type=terrainByPosition.get(`${unit.x},${unit.y}`)||'open-ground';
    if(unit.move>0)assert.ok(Number.isFinite(context.TerrainRules.movementCost(type,unit)),`${unit.name} starts on impassable ${type}`);
  }
  assert.equal(options[0].value,'atlas-proving-grounds');
});
