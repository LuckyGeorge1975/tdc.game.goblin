import test from 'node:test';import assert from 'node:assert/strict';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';
test('all 26 actual full owners bind canonical stats and executable fire or intentional no-fire gates',async()=>{
 const g=await fullScene('catalog-full-atlas'),owners=read(g,'units.filter(u=>!u.embarkedOn)');assert.equal(new Set(owners.map(u=>u.catalogId)).size,26);
 for(const owner of owners){
  g.context.ownerId=owner.id;
  const actual=read(g,"(()=>{const u=units.find(u=>u.id===ownerId),r=GoblinSpecialistsRuntime.rules(u);return {id:u.catalogId,rules:r,hp:u.hp,damage:u.damage,defense:u.defense,range:u.range,move:movementBudget(u),bonus:movementBudget(u,true),system:!!u.catalogSystems,alive:unitAlive(u)}})()");
  assert.equal(actual.alive,true,owner.catalogId);
  if(actual.system){assert.equal(Object.hasOwn(owner,'hp'),false);assert.ok(actual.rules.systemDefinitionRef)}else{assert.equal(actual.hp,actual.rules.strengthRef?2:actual.rules.hp);assert.equal(actual.damage,actual.rules.strengthRef?2:actual.rules.attack);assert.equal(actual.defense,actual.rules.strengthRef?2:actual.rules.defense);assert.equal(actual.range,actual.rules.range)}
  assert.equal(actual.bonus,actual.rules.gevPhaseEligible?actual.rules.movement[1]:0,owner.catalogId);
  // Controlled query fixture only: preserve IDs, canonical stats and Ninja team bindings.
  g.run("terrain.clear();terrainTypes.clear();globalThis.owner=units.find(u=>u.id===ownerId);globalThis.target=units.find(t=>t.team!==owner.team&&GoblinSpecialistsRuntime.rules(t).infantry);owner.x=1;owner.y=0;target.x=2;target.y=0;phase=owner.team;turnPhase='fire'");
  if(actual.rules.missileRuleRef){const q=read(g,"GoblinCatalogFullRuntime.hexQuery({type:'CatalogHexFire',actorId:owner.id,x:2,y:0},owner.team==='enemy')");assert.equal(q.ok,true,owner.catalogId);assert.equal(read(g,"GoblinSpecialistsRuntime.query({type:'CatalogFire',actorId:owner.id,target:{kind:'unit',runtimeUnitId:target.id},weaponId:null,mode:'direct',spotterId:null})").ok,false);continue}
  const spec=read(g,'GoblinSpecialistsRuntime.weapons(owner).find(w=>w.ready)??null');
  const command={type:'CatalogFire',actorId:owner.id,target:{kind:'unit',runtimeUnitId:read(g,'target.id')},weaponId:spec?.id??null,mode:'direct',spotterId:null};g.context.command=command;
  if(actual.rules.fireRuleRef==='no-fire-v1'){assert.equal(spec,null,owner.catalogId);assert.throws(()=>g.run('GoblinSpecialistsRuntime.fireQuery(command,true)'));continue}
  assert.ok(spec,owner.catalogId);assert.equal(read(g,'GoblinSpecialistsRuntime.fireQuery(command,true).ok'),true,owner.catalogId);
  g.run("phase=owner.team==='enemy'?'player':'enemy'");assert.throws(()=>g.run('GoblinSpecialistsRuntime.fireQuery(command,true)'),owner.catalogId);
 }
});
