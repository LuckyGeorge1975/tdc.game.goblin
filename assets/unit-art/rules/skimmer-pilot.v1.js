// Fixed pilot contract. Level identity is checked before creating any playable session.
(function(root){
 const level={"schemaVersion":1,"id":"skimmer-pilot","scenarioVersion":1,"ruleProfileId":"CATALOG_SKIMMER_PILOT_v1","title":"Skimmer-Erprobung","kicker":"Skimmer-Erprobung","objective":"core","width":12,"height":8,"defaultTerrain":"open-ground","terrain":[{"x":3,"y":3,"type":"rubble-field"},{"x":4,"y":2,"type":"mountain"},{"x":7,"y":2,"type":"ridge"},{"x":4,"y":4,"type":"forest"},{"x":5,"y":5,"type":"marsh"},{"x":6,"y":0,"type":"water"},{"x":7,"y":0,"type":"water"},{"x":6,"y":1,"type":"river"},{"x":6,"y":2,"type":"river"},{"x":6,"y":4,"type":"river"},{"x":6,"y":5,"type":"river"},{"x":4,"y":3,"type":"road"},{"x":5,"y":3,"type":"road"},{"x":7,"y":3,"type":"road"},{"x":8,"y":3,"type":"road"},{"x":6,"y":3,"type":"bridge"},{"x":9,"y":3,"type":"urban"},{"x":8,"y":5,"type":"crater"}],"units":[{"assetId":"combat-skimmer","team":"player","x":1,"y":3},{"assetId":"guard-tank","team":"enemy","x":8,"y":2},{"assetId":"command-core","team":"enemy","x":10,"y":3}]};
 const digest='3ac5caae85ec629444247c732eabc9267fcc53a56191faf0954acda10e4877dc';
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
 freeze(level);
 const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]))):value;
 const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 let canonical;
 function create(value,registry){
   if(!same(value,level))throw new Error('PILOT_LEVEL_MISMATCH');
   const budget=GoblinSkimmerBudget.skimmerMovementBudget(registry,registry.targetProfile,'combat-skimmer');
   if(budget.primary!==4||budget.secondary!==3)throw new Error('INVALID_PILOT_BUDGET');
   const stats={'combat-skimmer':[2,2,2,budget.primary,2,'C','HOVERCRAFT'],'guard-tank':[3,3,2,1,1,'G','GUARD ARMOR'],'command-core':[5,5,0,0,0,'C','COMMAND CORE']};
   const units=level.units.map(entry=>{
     const [hp,defense,range,move,damage,icon,type]=stats[entry.assetId];
     return {id:entry.assetId==='command-core'?'core':entry.assetId,visualKey:entry.assetId,name:entry.assetId.replaceAll('-',' ').toUpperCase(),type,team:entry.team,x:entry.x,y:entry.y,hp,maxHp:hp,defense,range,move,damage,icon,...(entry.assetId==='combat-skimmer'?{gev:true,movementMode:'gev'}:{}),...(entry.assetId==='command-core'?{core:true}:{})};
   });
   canonical=freeze({title:level.title,kicker:level.kicker,sub:level.title,scenarioVersion:1,ruleProfileId:level.ruleProfileId,ruleProfile:'skimmer-pilot-data-v1',objectiveVersion:1,objective:'core',sourceDigest:digest,movement:{version:'skimmer-pilot-budget-v1',primary:budget.primary,secondary:budget.secondary},terrain:level.terrain.filter(cell=>TerrainRules.coverBonus(cell.type)>0).map(cell=>`${cell.x},${cell.y}`),terrainTypes:level.terrain,units});
   return canonical;
 }
 function validate(config){if(!canonical||!same(config,canonical))throw new Error('PILOT_PROFILE_MISMATCH')}
 root.GoblinSkimmerPilot=Object.freeze({create,validate,digest});
})(globalThis);
