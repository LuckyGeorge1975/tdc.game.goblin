import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
async function model(){
 const c=vm.createContext({crypto:webcrypto,TextEncoder,console});
 for(const p of ['terrain-rules.js','ogre-systems.js','siege-tank-fire-budget.js','artillery-spotter-rules.js','catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js','catalog-full-model.js','scenario-profile-manifest.js'])vm.runInContext(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),c);
 c.data=read('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json');c.levels=read('assets/unit-art/levels/catalog-full-levels.v1.json');
 await vm.runInContext('GoblinCatalogFullModel.initialize(data,levels,{profile:"CATALOG_FULL_CANDIDATE_v1"})',c);return c;
}
test('five fixed full candidates authorize 26 actual classes with Ninja systems and one-shot hex missile',async()=>{
 const c=await model(),configs=JSON.parse(vm.runInContext('JSON.stringify(GoblinCatalogFullModel.configs)',c));
 assert.equal(Object.keys(configs).length,5);
 const atlas=configs['catalog-full-atlas'];assert.equal(new Set(atlas.units.map(u=>u.catalogId)).size,26);
 const ninja=atlas.units.find(u=>u.catalogId==='U21');assert.equal(ninja.catalogSystems.treads,30);assert.equal(Object.hasOwn(ninja,'hp'),false);
 const missile=atlas.units.find(u=>u.catalogId==='U13');assert.equal(missile.ammunition,1);assert.equal(missile.range,8);
 for(const [id,config] of Object.entries(configs)){c.id=id;c.config=config;assert.equal(vm.runInContext('ScenarioRuleProfiles.beginSession(id,config).ruleProfileId',c),'CATALOG_FULL_CANDIDATE_v1')}
 assert.equal(c.data.targetActive,false);
 assert.throws(()=>vm.runInContext("ScenarioRuleProfiles.beginSession('catalog-full-atlas',{...GoblinCatalogFullModel.configs['catalog-full-atlas'],ruleProfileId:'FULL_CATALOG_v1'})",c));
});
test('only U3 declares bounded waves and limit, while cargo and wave instances have distinct records',async()=>{
 const c=await model(),configs=JSON.parse(vm.runInContext('JSON.stringify(GoblinCatalogFullModel.configs)',c));
 for(const [id,cfg] of Object.entries(configs)){
  const full=cfg.catalog.full;assert.equal(full.turnLimit,id==='catalog-full-specialists'?20:null);
  assert.equal(full.waves.waves.length,id==='catalog-full-specialists'?2:0);
  for(const t of full.waveTemplates){assert.ok(cfg.catalog.records[t.id]);assert.equal(cfg.units.some(u=>u.id===t.id),false)}
 }
 const u3=configs['catalog-full-specialists'];assert.deepEqual(u3.catalog.full.waves.waves.map(w=>[w.id,w.dueOwnTurn,w.maxAttempts]),[['u3-guard-3',3,3],['u3-drone-5',5,3]]);
 assert.ok(u3.units.some(u=>u.id==='u3-player-ninja'&&u.x===2&&u.y===1));
});
