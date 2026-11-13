import test from 'node:test';import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto,createHash} from 'node:crypto';
const data=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url),'utf8'));
function context(){const c=vm.createContext({crypto:webcrypto,TextEncoder,console,Math:Object.assign(Object.create(Math),{random(){throw Error('NO_RNG_IN_SYSTEM_RULES')}})});for(const path of ['terrain-rules.js','ogre-systems.js','siege-tank-fire-budget.js','artillery-spotter-rules.js','catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js'])vm.runInContext(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),c);return c}
const read=(c,s)=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',c));
test('catalog shot preview matches recorded shot without consuming its slot',()=>{
 const c=context();c.data=data;
 const result=read(c,`(()=>{
  const api=GoblinSystems, state=api.createCatalogSystem(data,'goblin-siegebreaker');
  const id=state.rules.definition.components.find(slot=>slot.kind==='weapon').id;
  const preview=api.catalogFireShot(state,id,data);
  const fired=api.catalogRecordFire(state,id,data);
  return {preview,shot:fired.shot,before:api.catalogWeaponReady(state,id,data),after:api.catalogWeaponReady(fired.state,id,data)};
 })()`);
 assert.deepEqual(result.preview,result.shot);
 assert.equal(result.before,1);
 assert.equal(result.after,0);
});
test('adopted additive Core system artifact keeps its verified source hash and immutable factories',()=>{
 const raw=fs.readFileSync(new URL('../ogre-systems.js',import.meta.url),'utf8').replaceAll('\r\n','\n');assert.equal(createHash('sha256').update(raw).digest('hex'),'8529a02c0cda4adbde1efd20c31275216f6914b806a157748e3a2cb316c6d887');
 const c=context();c.data=data;for(const id of ['goblin-siegebreaker','goblin-dreadnaught','forge-engineer']){c.id=id;assert.equal(vm.runInContext('Object.isFrozen(GoblinSystems.createCatalogSystem(data,id).components)',c),true)}
});
test('24-class fixed specialists contract has actual system slots, explicit material and two distinct drone bays without generic platform HP',async()=>{
 const c=context();c.data=data;await vm.runInContext('GoblinCatalogSpecialistsModel.initialize(data)',c);
 assert.equal(vm.runInContext('GoblinCatalogSpecialistsModel.scope.length',c),24);
 const configs=read(c,'GoblinCatalogSpecialistsModel.configs'),seen=new Set();
 for(const cfg of Object.values(configs)){for(const u of cfg.units){seen.add(u.catalogId);if(u.catalogSystems){assert.equal(Object.hasOwn(u,'hp'),false);assert.equal(Object.hasOwn(u,'maxHp'),false);assert.equal(Object.hasOwn(u,'infantry'),false);assert.equal(u.alive,true)}}}
 assert.equal(seen.size,24);assert.equal(seen.has('U13'),false);assert.equal(seen.has('U21'),false);
 const units=configs['catalog-specialists'].units,forge=units.find(u=>u.id==='forge');assert.equal(forge.material,6);assert.equal(units.find(u=>u.id==='engineers').material,3);
 assert.deepEqual(units.filter(u=>u.embarkedOn==='forge').map(u=>[u.id,u.cargoBay]),[['bay-drone-one','bay-1'],['bay-drone-two','bay-2']]);
 assert.equal(vm.runInContext("GoblinCatalogSpecialistsModel.validate('catalog-siege',GoblinCatalogSpecialistsModel.configs['catalog-siege'])",c),true);
 assert.throws(()=>vm.runInContext("GoblinCatalogSpecialistsModel.validate('catalog-siege',{...GoblinCatalogSpecialistsModel.configs['catalog-siege'],ruleProfileId:'FULL_CATALOG_v1'})",c));
});
