// Exact fixed product contract; HP2/3 explicitly accepted in the 29 October A-G decision.
(function(root){
 const level={"schemaVersion":1,"id":"artillery-pilot","scenarioVersion":1,"ruleProfileId":"CATALOG_ARTILLERY_PILOT_v1","title":"Artillerie-Erprobung","kicker":"Artillerie-Erprobung","objective":"core","losMode":"strict-supercover","width":12,"height":8,"defaultTerrain":"open-ground","terrain":[{"x":3,"y":1,"type":"forest"},{"x":3,"y":6,"type":"forest"},{"x":5,"y":4,"type":"ridge"},{"x":3,"y":3,"type":"road"},{"x":4,"y":3,"type":"road"},{"x":5,"y":3,"type":"road"},{"x":6,"y":3,"type":"road"},{"x":7,"y":3,"type":"road"},{"x":8,"y":3,"type":"road"},{"x":9,"y":3,"type":"road"}],"units":[{"assetId":"long-range-battery","id":"long-range-battery","team":"player","x":1,"y":1},{"assetId":"mobile-siege-gun","id":"mobile-siege-gun","team":"player","x":1,"y":6},{"assetId":"recon-tank","id":"recon-tank","team":"player","x":5,"y":3},{"assetId":"guard-tank","id":"guard-tank","team":"enemy","x":8,"y":1},{"assetId":"assault-tank","id":"assault-tank","team":"enemy","x":7,"y":6},{"assetId":"rocket-artillery","id":"rocket-artillery","team":"enemy","x":4,"y":3},{"assetId":"command-core","id":"core","team":"enemy","x":10,"y":3}]};
 const digest='661aa73f005e1684ba47080176981718d1b3b6f85f07996efd4091a314f99c2d';
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
 freeze(level);
 const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]))):value;
 const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 let canonical;
 function create(value,registry){
   if(!same(value,level))throw new Error('PILOT_LEVEL_MISMATCH');
   const stats={'long-range-battery':[2,1,8,0,6,'B','FIXED ARTILLERY'],'mobile-siege-gun':[3,2,6,1,6,'M','MOBILE ARTILLERY'],'recon-tank':[2,2,2,3,2,'R','SCOUT ARMOR'],'guard-tank':[3,3,2,1,1,'G','GUARD ARMOR'],'assault-tank':[3,3,2,3,4,'A','FRONTLINE ARMOR'],'rocket-artillery':[3,2,4,2,3,'M','ARTILLERY'],'command-core':[5,5,0,0,0,'C','COMMAND CORE']};
   const units=level.units.map(entry=>{
     const [hp,defense,range,move,damage,icon,type]=stats[entry.assetId];
     const artillery=['long-range-battery','mobile-siege-gun'].includes(entry.assetId);
     return {id:entry.id,visualKey:entry.assetId,name:entry.assetId.replaceAll('-',' ').toUpperCase(),type,team:entry.team,x:entry.x,y:entry.y,hp,maxHp:hp,defense,range,move,damage,icon,
       ...(artillery?{artilleryFire:GoblinArtilleryRules.createArtillerySpotterProbe(registry,registry.targetProfile,entry.id),artilleryChoice:'direct'}:{}),...(entry.assetId==='command-core'?{core:true}:{})};
   });
   canonical=freeze({title:level.title,kicker:level.kicker,sub:level.title,scenarioVersion:1,ruleProfileId:level.ruleProfileId,ruleProfile:'artillery-pilot-data-v1',objectiveVersion:1,objective:'core',losMode:level.losMode,sourceDigest:digest,fireBudgetVersion:'artillery-spotter-v1',terrain:level.terrain.filter(cell=>TerrainRules.coverBonus(cell.type)>0).map(cell=>`${cell.x},${cell.y}`),terrainTypes:level.terrain,units});
   return canonical;
 }
 function validate(config){if(!canonical||!same(config,canonical))throw new Error('PILOT_PROFILE_MISMATCH')}
 root.GoblinArtilleryPilot=Object.freeze({create,validate,digest});
})(globalThis);
