// The second approved catalogue slice: C/D/B plus the existing special-fire capabilities.
(function(root){
 const profile='CATALOG_SPECIALISTS_v1',scope=Array.from({length:26},(_,i)=>`U${String(i+1).padStart(2,'0')}`).filter(id=>!['U13','U21'].includes(id));
 const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
 const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
 const e=(assetId,id,team,x,y,rest={})=>({assetId,id,team,x,y,...rest});
 const levels=[
  {id:'catalog-siege',title:'Systeme im Gefecht',sub:'Kommandokern ausschalten und eine eigene Einheit erhalten. Individuelle Waffen und Komponentenziele nutzen.',
   terrain:[{x:5,y:2,type:'forest'},{x:5,y:5,type:'ridge'},{x:4,y:4,type:'road'},{x:5,y:4,type:'road'},{x:6,y:4,type:'road'}],
   units:[e('goblin-siegebreaker','alpha','player',1,1),e('goblin-dreadnaught','bravo','player',1,5),e('siege-tank','siege','player',3,3),e('long-range-battery','battery','player',0,7),e('mobile-siege-gun','mobile','player',2,6),e('recon-tank','observer','player',4,3),e('goblin-siegebreaker','defender','enemy',9,1),e('goblin-dreadnaught','bastion','enemy',10,6),e('guard-tank','guard','enemy',7,4),e('raider-skimmer','raider','enemy',8,6),e('command-core','core','enemy',11,3)]},
  {id:'catalog-specialists',title:'Bergen und Bauen',sub:'Werkzeuge, Material und Drohnenbuchten einsetzen; feindlichen Kern ausschalten und eine eigene Einheit erhalten.',
   terrain:[{x:2,y:2,type:'rubble-field'},{x:2,y:4,type:'forest'},{x:3,y:3,type:'river'},{x:3,y:4,type:'road'},{x:4,y:3,type:'open-ground'},{x:4,y:5,type:'crater'},{x:5,y:2,type:'forest'}],
   units:[e('forge-engineer','forge','player',1,3),e('field-engineers','engineers','player',2,3),e('artillery-drone','bay-drone-one','player',1,3,{embarkedOn:'forge',cargoBay:'bay-1'}),e('artillery-drone','bay-drone-two','player',1,3,{embarkedOn:'forge',cargoBay:'bay-2'}),e('artillery-drone','ground-drone','player',1,4),e('skimmer-carrier','carrier','player',0,4),e('amphibious-infantry','marines','player',0,5,{squads:3}),e('local-defense','defense','player',2,5),e('infantry-squad','squad','player',2,6,{squads:2}),e('skimmer-scout','scout','player',1,6),e('rocket-artillery','rocket','enemy',8,1),e('assault-tank','assault','enemy',8,6),e('combat-skimmer','combat','enemy',7,2),e('light-skimmer','light','enemy',8,4),e('infantry-platoon','platoon','enemy',7,5),e('command-hub','hub','enemy',10,7),e('relay-node','relay','enemy',10,0),e('forge-engineer','hostile-forge','enemy',9,4),e('artillery-drone','hostile-bay-one','enemy',9,4,{embarkedOn:'hostile-forge',cargoBay:'bay-1'}),e('artillery-drone','hostile-bay-two','enemy',9,4,{embarkedOn:'hostile-forge',cargoBay:'bay-2'}),e('command-core','core','enemy',10,3)]}
 ];
 let configs=null;
 function createUnit(entry,data,records){
  const r=data.units[entry.assetId],t=r?.target;if(!r||!scope.includes(r.catalogId))throw Error('UNSUPPORTED_SPECIALISTS_CLASS');
  records[entry.id]={assetId:entry.assetId,catalogId:r.catalogId,rules:t};
  const common={id:entry.id,catalogAssetId:entry.assetId,catalogId:r.catalogId,visualKey:entry.assetId,name:entry.assetId.replaceAll('-',' ').toUpperCase(),type:r.catalogId,icon:r.catalogId.slice(1),team:entry.team,x:entry.x,y:entry.y,movementMode:t.mode,...(entry.id==='core'?{core:true}:{})};
  if(t.systemDefinitionRef){const catalogSystems=GoblinSystems.createCatalogSystem(data,entry.assetId);return {...common,catalogSystems,alive:true,move:GoblinSystems.catalogMovement(catalogSystems,data),selectedSlot:catalogSystems.components.find(c=>GoblinSystems.catalogWeaponReady(catalogSystems,c.id,data))?.id??null,...(t.material?{material:t.material.initial,materialMax:t.material.max}:{}),...(t.cargoRef==='forge-drone-bays-v1'?{droneBays:catalogSystems.rules.definition.components.filter(c=>c.kind==='drone-bay').map(c=>c.id)}:{})}}
  const sp=t.strengthRef?entry.squads:null;if(t.strengthRef&&(!Number.isInteger(sp)||sp<1||sp>3))throw Error('INVALID_SPECIALISTS_STRENGTH');
  const hp=sp??t.hp;return {...common,hp,maxHp:hp,damage:sp??t.attack,defense:sp??t.defense,range:t.range,move:t.movement[0],infantry:t.infantry,amphibious:!!t.waterCombat,forceBudgetWeight:t.forceBudgetWeight,halfUnit:!!t.halfUnit,...(sp?{squads:sp}:{}),...(t.material?{material:t.material.initial,materialMax:t.material.max}:{}),...(t.fireRuleRef==='siege-tank-fire-budget-v1'?{catalogFire:GoblinCatalogSpecialistFire.createSiegeBinding(data,entry.assetId,entry.id),selectedWeapon:'main-both'}:t.fireRuleRef==='artillery-spotter-v1'?{catalogFire:GoblinCatalogSpecialistFire.createArtilleryBinding(data,entry.assetId,entry.id),fireMode:'direct',spotterId:null}:{}),...(t.cargoRef==='carrier-cargo-v1'?{transportCapacity:data.definitions.cargo[t.cargoRef].capacity}:{}),...(entry.embarkedOn?{embarkedOn:entry.embarkedOn,cargoBay:entry.cargoBay??null}:{})};
 }
 async function initialize(data){
  await GoblinCatalogBase.initialize(data);data=GoblinCatalogBase.registry;
  const next={},mechanics={version:'catalog-specialists-mechanics-v1',scope,definitions:data.definitions,systemDefinitions:data.systemDefinitions,rules:Object.fromEntries(Object.entries(data.units).filter(([,r])=>scope.includes(r.catalogId)).map(([key,r])=>[key,r.target]))};
  for(const level of levels){
   const records={},units=level.units.map(entry=>createUnit(entry,data,records)),occupied=new Set();
   for(const u of units){
    if(u.catalogSystems)GoblinSystems.validateCatalogSystem(u.catalogSystems,data);
    if(u.embarkedOn){const carrier=units.find(c=>c.id===u.embarkedOn);if(!carrier?.droneBays?.includes(u.cargoBay)||u.catalogId!=='U14'||u.team!==carrier.team||u.x!==carrier.x||u.y!==carrier.y)throw Error('INVALID_SPECIALISTS_CARGO');continue}
    const cell=`${u.x},${u.y}`,type=level.terrain.find(c=>c.x===u.x&&c.y===u.y)?.type??'open-ground';if(occupied.has(cell))throw Error('SPECIALISTS_START_COLLISION');occupied.add(cell);
    if(u.move>0&&!Number.isFinite(TerrainRules.movementCost(type,u))||u.move===0&&['water','river'].includes(type))throw Error('SPECIALISTS_START_TERRAIN');
   }
   const catalog={dataVersion:data.dataVersion,dataDigest:GoblinCatalogBase.digest,mechanicsVersion:mechanics.version,mechanicsDigest:await GoblinCatalogBase.hash(mechanics),levelDigest:await GoblinCatalogBase.hash(level),rosterDigest:await GoblinCatalogBase.hash(units),terrainDigest:await GoblinCatalogBase.hash(level.terrain),scope,records,cargo:data.definitions.cargo,registry:data};
   next[level.id]=freeze({title:level.title,kicker:'KATALOG · SYSTEME / ENGINEERING',sub:level.sub,scenarioVersion:1,ruleProfileId:profile,ruleProfile:data.dataVersion,objectiveVersion:1,objective:'core',losMode:'strict-supercover',catalog,terrain:level.terrain.filter(c=>TerrainRules.coverBonus(c.type)).map(c=>`${c.x},${c.y}`),terrainTypes:level.terrain,units});
  }
  configs=freeze(next);return configs;
 }
 const has=id=>levels.some(level=>level.id===id);
 const validate=(id,config)=>{if(!configs?.[id]||!same(config,configs[id]))throw Error('SPECIALISTS_PROFILE_MISMATCH');return true};
 root.GoblinCatalogSpecialistsModel=Object.freeze({profile,scope:freeze(scope),initialize,has,validate,get configs(){return configs}});
})(globalThis);
