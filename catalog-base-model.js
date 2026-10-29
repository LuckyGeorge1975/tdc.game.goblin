// Narrow, immutable adoption of the approved catalogue. This does not enable FULL_CATALOG.
(function(root){
 const PROFILE='CATALOG_BASE_TRANSPORT_v1',DATA='catalog-approved-data-v1';
 const digest='71acac02581cf0709875bf4656418d493d21a40c5bc74ac4ffeff9b115b2e51a';
 const scope=['U02','U03','U04','U05','U06','U10','U11','U12','U14','U15','U17','U19','U22','U23','U24','U25','U26'];
 const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]))):value;
 const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
 async function hash(value){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(value))))),b=>b.toString(16).padStart(2,'0')).join('')}
 const entry=(assetId,id,team,x,y,extra={})=>({assetId,id,team,x,y,...extra});
 const maps=[
  {id:'catalog-transport',title:'Transportlinie',sub:'Drohne aufstellen, Infanterie einschiffen und den feindlichen Kern ausschalten. Mindestens eine eigene Einheit erhalten.',
   terrain:[{x:3,y:2,type:'water'},{x:3,y:3,type:'river'},{x:5,y:2,type:'forest'},{x:5,y:5,type:'ridge'},{x:4,y:3,type:'bridge'}],
   units:[entry('skimmer-carrier','carrier-drone','player',1,2),entry('artillery-drone','drone','player',1,2,{embarkedOn:'carrier-drone'}),entry('skimmer-carrier','carrier-infantry','player',1,5),entry('infantry-squad','squad','player',2,5,{squads:3}),entry('assault-tank','assault','player',2,3),entry('infantry-squad','reserve-one','player',0,5,{squads:1}),entry('infantry-squad','reserve-two','player',1,6,{squads:2}),entry('recon-tank','recon','player',0,6),entry('rocket-artillery','rocket','player',0,4),entry('local-defense','militia','enemy',7,4),entry('guard-tank','guard','enemy',8,2),entry('command-core','core','enemy',10,3)]},
  {id:'catalog-maneuver',title:'Manöver am Fluss',sub:'GEV-Budgets und amphibische Infanterie einsetzen; feindlichen Kern ausschalten und eine eigene Einheit erhalten.',
   terrain:[{x:3,y:1,type:'water'},{x:3,y:2,type:'river'},{x:3,y:3,type:'river'},{x:3,y:4,type:'bridge'},{x:3,y:5,type:'marsh'},{x:5,y:2,type:'forest'},{x:5,y:5,type:'crater'}],
   units:[entry('skimmer-scout','scout','player',1,1),entry('combat-skimmer','combat','player',1,3),entry('light-skimmer','light','player',1,5),entry('skimmer-carrier','carrier','player',0,6),entry('amphibious-infantry','marines','player',2,2,{squads:3}),entry('infantry-platoon','platoon','player',2,4),entry('local-defense','defense','player',2,6),entry('raider-skimmer','raider','enemy',7,3),entry('assault-tank','hostile-assault','enemy',8,5),entry('command-hub','hub','enemy',10,6),entry('relay-node','relay','enemy',10,1),entry('command-core','core','enemy',10,3)]}
 ];
 let registry=null,configs=null;
 async function initialize(data){
  if(await hash(data)!==digest||data.dataVersion!==DATA||data.targetActive!==false)throw new Error('CATALOG_DATA_DIGEST_MISMATCH');
  const copy=freeze(JSON.parse(JSON.stringify(data))),byClass=Object.fromEntries(Object.entries(copy.units).map(([assetId,r])=>[r.catalogId,{assetId,...r}]));
  for(const id of scope){const r=byClass[id]?.target;if(!r||r.systemDefinitionRef||r.engineeringRef||r.missileRuleRef||r.stealthRef||!['single-fire-v1','no-fire-v1'].includes(r.fireRuleRef))throw new Error('UNSUPPORTED_CATALOG_CAPABILITY')}
  const mechanics={version:'catalog-base-transport-mechanics-v1',scope,definitions:{strength:copy.definitions.strength,cargo:copy.definitions.cargo},rules:Object.fromEntries(scope.map(id=>[id,byClass[id].target]))};
  const mechanicsDigest=await hash(mechanics),next={};
  for(const level of maps){
   const records={},units=level.units.map(e=>{
    const record=copy.units[e.assetId];if(!record||!scope.includes(record.catalogId))throw new Error('UNSUPPORTED_CATALOG_CLASS');
    const t=record.target,sp=t.strengthRef?e.squads:null;
    if(t.strengthRef&&(!Number.isInteger(sp)||sp<1||sp>3))throw new Error('INVALID_INFANTRY_STRENGTH');
    const hp=sp??t.hp;records[e.id]={assetId:e.assetId,catalogId:record.catalogId,rules:t};
    return {id:e.id,catalogAssetId:e.assetId,catalogId:record.catalogId,visualKey:e.assetId,name:e.assetId.replaceAll('-',' ').toUpperCase(),type:record.catalogId,icon:record.catalogId.slice(1),team:e.team,x:e.x,y:e.y,hp,maxHp:hp,damage:sp??t.attack,defense:sp??t.defense,range:t.range,move:t.movement[0],movementMode:t.mode,infantry:t.infantry,amphibious:!!t.waterCombat,forceBudgetWeight:t.forceBudgetWeight,halfUnit:!!t.halfUnit,...(sp?{squads:sp}:{}),...(t.cargoRef==='carrier-cargo-v1'?{transportCapacity:copy.definitions.cargo[t.cargoRef].capacity}:{}),...(e.embarkedOn?{embarkedOn:e.embarkedOn}:{}),...(e.id==='core'?{core:true}:{})};
   });
   const occupied=new Set();
   for(const u of units){const type=level.terrain.find(c=>c.x===u.x&&c.y===u.y)?.type??'open-ground';
    if(!u.embarkedOn){const key=`${u.x},${u.y}`;if(occupied.has(key))throw new Error('CATALOG_START_COLLISION');occupied.add(key);if(u.move>0&&!Number.isFinite(TerrainRules.movementCost(type,u))||u.move===0&&['water','river'].includes(type))throw new Error('CATALOG_START_TERRAIN')}
    else {const c=units.find(c=>c.id===u.embarkedOn);if(!c?.transportCapacity||c.team!==u.team||c.x!==u.x||c.y!==u.y||u.catalogId!=='U14')throw new Error('INVALID_INITIAL_CARGO')}
   }
   const catalog={dataVersion:DATA,dataDigest:digest,mechanicsDigest,levelDigest:await hash(level),rosterDigest:await hash(units),terrainDigest:await hash(level.terrain),scope,records,cargo:copy.definitions.cargo};
   next[level.id]=freeze({title:level.title,kicker:'KATALOGBASIS · TRANSPORT / SP / GEV',sub:level.sub,scenarioVersion:1,ruleProfileId:PROFILE,ruleProfile:DATA,objectiveVersion:1,objective:'core',losMode:'strict-supercover',catalog,terrain:level.terrain.filter(c=>TerrainRules.coverBonus(c.type)).map(c=>`${c.x},${c.y}`),terrainTypes:level.terrain,units});
  }
  registry=copy;configs=freeze(next);return configs;
 }
 const has=id=>maps.some(m=>m.id===id);
 function validate(id,config){if(!configs?.[id]||!same(config,configs[id]))throw new Error('CATALOG_PROFILE_MISMATCH');return true}
 const api={profile:PROFILE,dataVersion:DATA,digest,scope:freeze(scope),has,hash,initialize,validate,get configs(){return configs},get registry(){return registry}};
 root.GoblinCatalogBase=Object.freeze(api);
})(globalThis);
