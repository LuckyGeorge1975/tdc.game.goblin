// One world adapter for the approved specialists slice. Pure system/fire modules own their rules.
(function(root){
 const active=()=>!root.IronDustBrowserV2?.active&&(legacySession?.ruleProfileId==='CATALOG_SPECIALISTS_v1'&&GoblinCatalogSpecialistsModel.has(legacySession.scenarioId)||root.GoblinCatalogFullRuntime?.active());
 const registry=()=>legacySession.effectiveRules.catalog.registry;
 const record=u=>active()?legacySession.effectiveRules.catalog.records[u?.id]:null;
 const rules=u=>record(u)?.rules;
 const system=u=>!!record(u)&&!!u.catalogSystems;
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const reject=code=>{const e=Error(code);e.code=code;throw e};
 const require=(yes,code)=>{if(!yes)reject(code)};
 const bound=u=>!!u&&units.includes(u)&&!!record(u);
 const alive=u=>bound(u)&&unitAlive(u);
 const dtoHp=u=>u?.catalogSystems?(unitAlive(u)?1:0):u?.hp;
 let intent=null;
 function validateOwner(u){if(system(u))require(u.catalogSystems.unitId===record(u).assetId,'SYSTEM_OWNER_MISMATCH')}
 function sync(u){if(!system(u))return;validateOwner(u);GoblinSystems.validateCatalogSystem(u.catalogSystems,registry());u.alive=!GoblinSystems.catalogIsHelpless(u.catalogSystems,registry());u.move=GoblinSystems.catalogMovement(u.catalogSystems,registry())}
 const worldPhase=(u,required)=>!gameOver&&(u.team==='player'?phase==='player'&&turnPhase===required:phase==='enemy'&&required==='fire');
 const targetKey=t=>GoblinCatalogSpecialistFire.targetKey(t);
 function resolveTarget(t,viewerTeam='player'){
  require(exact(t,t?.kind==='unit'?['kind','runtimeUnitId']:['kind','runtimeUnitId','componentId']),'INVALID_TYPED_TARGET');
  const u=units.find(u=>u.id===t.runtimeUnitId);require(alive(u)&&!u.embarkedOn&&(!root.GoblinCatalogFullRuntime?.active()||root.GoblinCatalogFullRuntime.known(u.id,viewerTeam)),'TARGET_UNAVAILABLE');
  if(system(u)){validateOwner(u);require(t.kind==='component'&&typeof t.componentId==='string'&&!!t.componentId,'COMPONENT_REQUIRED');const c=GoblinSystems.catalogTargets(u.catalogSystems,registry()).find(c=>c.id===t.componentId);require(c,'COMPONENT_UNAVAILABLE');return {unit:u,component:c}}
  require(t.kind==='unit','INVALID_COMPONENT_OWNER');return {unit:u,component:null};
 }
 function fireQuery(command,allowEnemy=false){
  require(exact(command,['type','actorId','target','weaponId','mode','spotterId'])&&command.type==='CatalogFire','INVALID_SPECIALISTS_FIRE');
  const u=units.find(u=>u.id===command.actorId);require(alive(u)&&!u.disabled&&(!u.embarkedOn||rules(u).passengerRef),'ACTOR_UNAVAILABLE');
  require((u.team==='player'||allowEnemy)&&worldPhase(u,'fire'),'WRONG_FIRE_PHASE');
  const target=resolveTarget(command.target,u.team),t=target.unit;require(u.team!==t.team,'FRIENDLY_DIRECT_TARGET');
  const rule=rules(u),distance=dist(u,t),los=lineOfSight(u,t);let attack,nextSystem=null,nextFire=null,effects=[];
  if(system(u)){
   validateOwner(u);require(command.mode==='direct'&&command.spotterId===null&&typeof command.weaponId==='string','INVALID_SYSTEM_FIRE');
   const out=GoblinSystems.catalogRecordFire(u.catalogSystems,command.weaponId,registry());attack={...out.shot,key:command.weaponId};nextSystem=out.state;effects=out.effects;
   require(distance>=1&&distance<=attack.range,'TARGET_OUT_OF_RANGE');require(los,'DIRECT_LOS_REQUIRED');require(!attack.infantryOnly||rules(t).infantry===true,'INFANTRY_TARGET_REQUIRED');
  }else if(u.catalogFire){
   const actor={id:record(u).assetId,team:u.team,hp:dtoHp(u),disabled:!!u.disabled};let request;
   if(rule.fireRuleRef==='siege-tank-fire-budget-v1'){
    require(command.mode==='direct'&&command.spotterId===null&&typeof command.weaponId==='string','INVALID_SIEGE_FIRE');
    request={phase:'fire',weapon:command.weaponId,actor,target:{id:targetKey(command.target),team:t.team,hp:dtoHp(t),infantry:rules(t).infantry===true,distance,hasLineOfSight:los}};
   }else{
    require(command.weaponId===null&&['direct','indirect'].includes(command.mode),'INVALID_ARTILLERY_FIRE');
    const s=command.spotterId===null?null:units.find(s=>s.id===command.spotterId);
    if(command.mode==='indirect')require(alive(s)&&!s.disabled&&!s.embarkedOn&&s.team===u.team&&s!==u,'INVALID_SPOTTER');
    request={phase:'fire',mode:command.mode,actor:{...actor,hasLineOfSight:los},target:{id:targetKey(command.target),team:t.team,hp:dtoHp(t),distance},spotter:s?{id:targetKey({kind:'unit',runtimeUnitId:s.id}),team:s.team,hp:dtoHp(s),disabled:!!s.disabled,hasLineOfSight:lineOfSight(s,t)}:null};
   }
   const out=GoblinCatalogSpecialistFire.resolve(u.catalogFire,u.id,request,registry());attack={...out.attack,key:command.weaponId};nextFire=out.state;
  }else{
   require(!rule.missileRuleRef&&rule.fireRuleRef==='single-fire-v1'&&command.weaponId===null&&command.mode==='direct'&&command.spotterId===null,'NO_FIRE_CAPABILITY');
   require(!u.fired,'FIRE_SPENT');require(rule.cargoRef!=='drone-cargo-v1'||!u.embarkedOn&&(u.droneReadyTurn??1)<=turn,'DRONE_NOT_READY');
   require(distance>=1&&distance<=rule.range,'TARGET_OUT_OF_RANGE');require(los,'DIRECT_LOS_REQUIRED');attack={attack:u.damage,range:rule.range,key:null};
  }
  return {ok:true,actor:u,target:t,component:target.component,weapon:attack,nextSystem,nextFire,effects};
 }
 function applyEffects(owner,effects){
  const lost=new Set();for(const effect of effects){
   if(effect.type==='DestroyBayCargo')for(const cargo of carrierCargo(owner))if(cargo.cargoBay===effect.bayId)lost.add(cargo.id);
   if(effect.type==='DestroyPlatformCargo')for(const cargo of carrierCargo(owner))lost.add(cargo.id);
  }
  for(const id of lost){const u=units.find(u=>u.id===id);u.hp=0;u.lastOutcome='X'}sync(owner);
 }
 const oldOutcome=combatOutcome;
 combatOutcome=function(attacker,target){
  if(!active()||!system(target))return oldOutcome(attacker,target);
  const targetIntent=intent?.area?intent.areaTarget:intent?.command.target;require(targetIntent?.runtimeUnitId===target.id,'SYSTEM_TARGET_INTENT_REQUIRED');
  const component=GoblinSystems.catalogTargets(target.catalogSystems,registry()).find(c=>c.id===targetIntent.componentId);require(component,'COMPONENT_UNAVAILABLE');
  const passengers=[...carrierCargo(target)],roll=Math.floor(Math.random()*6),ratio=component.type==='treads'?'1-1':combatRatio(attacker.damage,component.defense+TerrainRules.coverBonus(terrainTypeAt(target.x,target.y))),result=component.type==='treads'?(roll>=4?'X':'NE'):ratio==='5-1'?'X':COMBAT_RULES.crt[ratio][roll];
  const applied=GoblinSystems.catalogApplyHit(target.catalogSystems,{targetId:component.id,result,attackStrength:attacker.damage,cause:{kind:intent.area?'area':'direct',commandId:intent.commandId,attackerId:attacker.id}},registry());
  target.catalogSystems=applied.state;const hits=passengers.map(unit=>({unit,outcome:applyCombatRoll(attacker,unit,roll)}));applyEffects(target,applied.effects);
  for(const hit of hits)if(unitDead(hit.unit)&&hit.outcome.result!=='X')hit.outcome={...hit.outcome,directResult:hit.outcome.result,result:'X',cause:'mechanical-cargo-loss'};
  return {system:{...component,label:component.id},ratio,result,roll,loss:applied.hit.loss,remaining:applied.hit.remaining,passengers:hits,effects:applied.effects};
 };
 function areaOutcome(attacker,target,componentId,commandId,command){
  require(root.GoblinCatalogFullRuntime?.active(),'FULL_AREA_PROFILE_REQUIRED');
  const previous=intent;intent={area:true,commandId,command:structuredClone(command),areaTarget:{runtimeUnitId:target.id,componentId}};
  try{return combatOutcome(attacker,target)}finally{intent=previous}
 }
 function appendJournal(u,command,result){u.specialistSerial=(u.specialistSerial??0)+1;(u.specialistJournal??=[]).push({id:`${legacySession.sessionId}/${u.id}/${u.specialistSerial}`,turn,team:u.team,command:structuredClone(command),result:structuredClone(result)});root.GoblinCatalogFullRuntime?.recordAction(u,command,result)}
 const oldAttack=attack;
 attack=function(u,t){
  if(!active())return oldAttack(u,t);if(intent?.command.type!=='CatalogFire'){setToast('Waffe und konkretes Ziel wählen.');return}
  const q=fireQuery(intent.command,u.team==='enemy');root.GoblinCatalogFullRuntime?.reveal(u.id,'own-fire');const outcome=combatOutcome({...u,damage:q.weapon.attack,range:q.weapon.range},t);
  root.GoblinCatalogFullRuntime?.reveal(t.id,'incoming-direct',outcome.result);
  if(q.nextSystem){u.catalogSystems=q.nextSystem;applyEffects(u,q.effects)}else if(q.nextFire)u.catalogFire=q.nextFire;else u.fired=true;
  u.acted=true;t.lastOutcome=outcome.result;t.justHit=true;appendJournal(u,intent.command,{kind:'fire',weapon:q.weapon,target:intent.command.target,outcome:{...outcome,passengers:(outcome.passengers??[]).map(h=>({unitId:h.unit.id,outcome:h.outcome}))}});
  addLog(`${GoblinCatalogRuntime.name(u)} / ${system(u)?slotLabel(u,intent.command.weaponId):u.catalogFire?.ruleRef==='siege-tank-fire-budget-v1'?GoblinSiegeWeapons.label(intent.command.weaponId):text(intent.command.mode==='indirect'?'v2.ui.artillery.indirect':'v2.ui.fire')} → ${GoblinCatalogRuntime.name(t)}${q.component?' / '+slotLabel(t,q.component.id):''}: ${outcome.result} (${outcome.ratio})`);reportPassengerHits(u,outcome,u.team==='enemy');selected=u.team==='player'?u:null;updateSelection();draw();setTimeout(()=>{t.justHit=false;draw()},560);if(!checkVictory()&&u.team==='player')maybeAutoAdvancePhase();
 };
 const inside=c=>Number.isInteger(c?.x)&&c.x>=0&&c.x<W&&Number.isInteger(c?.y)&&c.y>=0&&c.y<H;
 const wreckKey=u=>JSON.stringify(['wreck',legacySession.sessionId,u.id]);
 function bridgeLand(x,y){
  const q=x-(y-(y&1))/2,r=y,dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  const land=([dq,dr])=>{const nr=r+dr,nq=q+dq,nx=nq+(nr-(nr&1))/2;return inside({x:nx,y:nr})&&!['water','river','bridge'].includes(terrainTypeAt(nx,nr))&&Number.isFinite(TerrainRules.movementCost(terrainTypeAt(nx,nr),'tracked'))};
  return dirs.slice(0,3).some((d,i)=>land(d)&&land(dirs[i+3]));
 }
 function engineeringQuery(command){
  require(exact(command,['type','actorId','job','target','option'])&&command.type==='Engineer','INVALID_ENGINEER_COMMAND');
  const u=units.find(u=>u.id===command.actorId),r=rules(u);require(alive(u)&&r?.engineeringRef&&u.team==='player'&&worldPhase(u,'movement')&&!u.disabled&&!u.embarkedOn&&!u.moved&&!u.disembarkedThisTurn&&u.jobTurn!==turn,'ENGINEER_UNAVAILABLE');
  const d=registry().definitions.engineering[r.engineeringRef];
  if(system(u))require(u.catalogSystems.components.some((c,i)=>u.catalogSystems.rules.definition.components[i].kind==='tool'&&!c.destroyed&&c.readyFromTurn<=u.catalogSystems.turn),'READY_TOOL_REQUIRED');
  let cost=0,nextSystem=null,targetUnit=null,terrainChange=null,materialGain=0;
  if(['clear','position','bridge'].includes(command.job)){
   require(command.option===null&&exact(command.target,['kind','x','y'])&&command.target.kind==='cell'&&inside(command.target)&&dist(u,command.target)<=d.range,'INVALID_ENGINEER_CELL');
   const {x,y}=command.target;require(!units.some(t=>unitAlive(t)&&!t.embarkedOn&&t.x===x&&t.y===y),'ENGINEER_CELL_OCCUPIED');const old=terrainTypeAt(x,y);let rule;
   if(command.job==='clear')rule=d.clear.find(c=>c.from===old);
   if(command.job==='position')rule=d.buildPosition.from.includes(old)?d.buildPosition:null;
   if(command.job==='bridge')rule=old===d.buildBridge.from&&bridgeLand(x,y)?d.buildBridge:null;
   require(rule,'INVALID_ENGINEER_TERRAIN');cost=rule.materialCost;terrainChange={x,y,from:old,to:rule.to};
  }else if(command.job==='salvage'){
   require(command.option===null&&exact(command.target,['kind','wreckId'])&&command.target.kind==='wreck','INVALID_WRECK_TARGET');
   targetUnit=units.find(t=>unitDead(t)&&!t.embarkedOn&&!t.salvaged&&wreckKey(t)===command.target.wreckId);require(targetUnit&&dist(u,targetUnit)===d.range&&u.material<u.materialMax,'SALVAGE_UNAVAILABLE');materialGain=d.salvage.materialGain;
  }else{
   const component=command.job==='repair-component';require(exact(command.target,component?['kind','runtimeUnitId','componentId']:['kind','runtimeUnitId'])&&command.target.kind===(component?'component':'unit'),'INVALID_REPAIR_TARGET');
   targetUnit=units.find(t=>t.id===command.target.runtimeUnitId);require(alive(targetUnit)&&targetUnit!==u&&targetUnit.team===u.team&&!targetUnit.embarkedOn&&dist(u,targetUnit)===d.range,'REPAIR_UNAVAILABLE');
   if(command.job==='repair-vehicle'){
    require(!system(targetUnit)&&rules(targetUnit).repairClass==='vehicle'&&!rules(targetUnit).infantry&&!targetUnit.core,'INVALID_VEHICLE_REPAIR');
    require(command.option==='disabled'&&targetUnit.disabled||command.option==='hp'&&targetUnit.hp<targetUnit.maxHp,'REPAIR_EFFECT_UNAVAILABLE');cost=d.repairVehicle.materialCost;
   }else{
    require(system(targetUnit)&&command.option===null,'INVALID_SYSTEM_REPAIR');nextSystem=structuredClone(targetUnit.catalogSystems);
    if(command.job==='repair-treads'){require(nextSystem.treads<nextSystem.maxTreads,'TREADS_FULL');cost=d.repairSystem.treadsMaterialCost;nextSystem.treads=Math.min(nextSystem.maxTreads,nextSystem.treads+d.repairSystem.treadsRestored)}
    else if(component){
     require(typeof command.target.componentId==='string'&&!!command.target.componentId,'COMPONENT_REQUIRED');
     const i=nextSystem.components.findIndex(c=>c.id===command.target.componentId);require(i>=0,'UNKNOWN_REPAIR_COMPONENT');const c=nextSystem.components[i],def=nextSystem.rules.definition.components[i];
     require(c.destroyed&&!c.spent&&(def.kind!=='weapon'||!nextSystem.rules.weaponClasses[def.weaponClassRef].expendable),'NONREPAIRABLE_COMPONENT');c.destroyed=false;c.readyFromTurn=nextSystem.turn+1;cost=d.repairSystem.componentMaterialCost;
    }else reject('UNKNOWN_ENGINEER_JOB');GoblinSystems.validateCatalogSystem(nextSystem,registry());
   }
  }
  if(!Number.isInteger(u.material)||u.material<cost){const e=Error('INSUFFICIENT_MATERIAL');e.code='INSUFFICIENT_MATERIAL';e.cost=cost;throw e}return {ok:true,actor:u,cost,materialGain,targetUnit,nextSystem,terrainChange};
 }
 const freezeState=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freezeState);Object.freeze(v)}return v};
 const forge=u=>system(u)&&rules(u).cargoRef==='forge-drone-bays-v1';
 function bayState(u,id){require(forge(u),'FORGE_REQUIRED');const i=u.catalogSystems.components.findIndex(c=>c.id===id);require(i>=0&&u.catalogSystems.rules.definition.components[i].kind==='drone-bay','UNKNOWN_BAY');return u.catalogSystems.components[i]}
 const readyBay=(u,id)=>{const b=bayState(u,id);return !b.destroyed&&b.readyFromTurn<=u.catalogSystems.turn};
 function bayCargo(u,roster=units){return u.catalogSystems.rules.definition.components.filter(c=>c.kind==='drone-bay').map(b=>({id:b.id,ready:readyBay(u,b.id),destroyed:bayState(u,b.id).destroyed,cargo:roster.find(c=>unitAlive(c)&&c.embarkedOn===u.id&&c.cargoBay===b.id)?.id??null}))}
 function cargoQuery(c){
  const loading=c?.type==='CatalogLoad';require(exact(c,loading?['type','actorId','carrierId','bayId']:['type','actorId','cargoId','bayId','x','y'])&&(loading||c.type==='CatalogDeploy'),'INVALID_FORGE_CARGO_COMMAND');
  const cargo=units.find(u=>u.id===(loading?c.actorId:c.cargoId)),carrier=units.find(u=>u.id===(loading?c.carrierId:c.actorId));
  require(alive(cargo)&&alive(carrier)&&rules(cargo).cargoRef==='drone-cargo-v1'&&forge(carrier)&&cargo.team==='player'&&carrier.team===cargo.team&&!cargo.disabled&&!carrier.disabled&&worldPhase(carrier,'movement')&&!carrier.moved,'FORGE_CARGO_UNAVAILABLE');require(readyBay(carrier,c.bayId),'BAY_UNAVAILABLE');
  if(loading){require(!cargo.embarkedOn&&!cargo.moved&&!cargo.fired&&!cargo.disembarkedThisTurn&&dist(cargo,carrier)===1&&!carrierCargo(carrier).some(u=>u.cargoBay===c.bayId),'FORGE_LOAD_UNAVAILABLE')}
  else {require(cargo.embarkedOn===carrier.id&&cargo.cargoBay===c.bayId&&!cargo.embarkedThisTurn&&!cargo.disembarkedThisTurn&&inside(c)&&dist(carrier,c)===1&&!units.some(u=>unitAlive(u)&&!u.embarkedOn&&u.x===c.x&&u.y===c.y)&&!registry().definitions.cargo['carrier-cargo-v1'].droneDeployExcludedTerrain.includes(terrainTypeAt(c.x,c.y)),'FORGE_DEPLOY_UNAVAILABLE')}
  return {ok:true,cargo,carrier,loading};
 }
 function executeCargo(c){const q=cargoQuery(c),u=q.cargo,carrier=q.carrier;
  u.moved=true;u.fired=true;u.acted=true;carrier.moved=true;carrier.acted=true;
  if(q.loading){u.embarkedOn=carrier.id;u.cargoBay=c.bayId;u.embarkedThisTurn=true;u.x=carrier.x;u.y=carrier.y}
  else {u.embarkedOn=null;u.cargoBay=null;u.embarkedThisTurn=false;u.disembarkedThisTurn=true;u.droneReadyTurn=turn+1;u.x=c.x;u.y=c.y}
  appendJournal(carrier,c,{kind:q.loading?'load-bay':'deploy-bay',cargoId:u.id,bayId:c.bayId});selected=carrier;addLog(text('v2.specialists.bayCargo',{bay:slotLabel(carrier,c.bayId),cargo:GoblinCatalogRuntime.name(u)})+' · '+text(q.loading?'v2.ui.embark':'v2.ui.catalog.deployDrone'));updateSelection();draw();maybeAutoAdvancePhase();return {ok:true};
 }
 function executeEngineering(command){
  const q=engineeringQuery(command),u=q.actor;
  if(q.terrainChange){const c=q.terrainChange,key=`${c.x},${c.y}`;terrainTypes.set(key,c.to);if(TerrainRules.coverBonus(c.to))terrain.add(key);else terrain.delete(key)}
  if(command.job==='repair-vehicle'){if(command.option==='disabled'){q.targetUnit.disabled=false;q.targetUnit.disabledUntil=0}else q.targetUnit.hp=Math.min(q.targetUnit.maxHp,q.targetUnit.hp+1)}
  if(q.nextSystem){q.targetUnit.catalogSystems=freezeState(q.nextSystem);sync(q.targetUnit)}
  if(command.job==='salvage')q.targetUnit.salvaged=true;
  u.material=Math.min(u.materialMax,u.material-q.cost+q.materialGain);u.moved=true;u.fired=true;u.acted=true;u.jobTurn=turn;
  if(system(u)){const next=structuredClone(u.catalogSystems);next.components.forEach((c,i)=>{const d=next.rules.definition.components[i];if(d.kind==='weapon'&&!next.rules.weaponClasses[d.weaponClassRef].expendable)c.fired=true});GoblinSystems.validateCatalogSystem(next,registry());u.catalogSystems=freezeState(next);sync(u)}
  appendJournal(u,command,{kind:'engineering',cost:q.cost,materialGain:q.materialGain,terrainChange:q.terrainChange,targetId:q.targetUnit?.id??null});selected=u;addLog(text('v2.engineer.completed',{unit:GoblinCatalogRuntime.name(u),job:text('v2.engineer.'+(command.job==='repair-vehicle'?(command.option==='disabled'?'repair-disabled':'repair-hp'):command.job)),materialLabel:text('v2.specialists.material'),current:u.material,max:u.materialMax}));updateSelection();draw();root.GoblinLegacyPresentation?.sync();maybeAutoAdvancePhase();return {ok:true};
 }
 function weapons(u){
  if(!unitAlive(u)||!record(u))return [];
  if(system(u))return u.catalogSystems.rules.definition.components.flatMap((d,i)=>d.kind==='weapon'?[{id:d.id,weaponClass:d.weaponClassRef,...u.catalogSystems.rules.weaponClasses[d.weaponClassRef],ready:GoblinSystems.catalogWeaponReady(u.catalogSystems,d.id,registry())}]:[]).sort((a,b)=>['missiles','main','secondary','antipersonnel'].indexOf(a.weaponClass)-['missiles','main','secondary','antipersonnel'].indexOf(b.weaponClass)||(a.id<b.id?-1:a.id>b.id?1:0));
  if(rules(u).fireRuleRef==='siege-tank-fire-budget-v1')return ['main-both','main-1','main-2','ap-1','ap-2'].map(id=>({id,...GoblinSiegeBudget.WEAPONS[id],ready:(id==='main-both'?['main-1','main-2']:[id]).some(slot=>u.catalogFire.state.used.includes(slot))?0:1}));
  if(rules(u).fireRuleRef==='no-fire-v1')return [];
  return [{id:null,attack:u.damage??u.attack,range:u.range,ready:u.catalogFire?(u.catalogFire.state.fired?0:1):u.fired?0:1}];
 }
 function candidateCommands(u,weaponId){
  const targets=(root.GoblinCatalogFullRuntime?.active()?root.GoblinCatalogFullRuntime.roster(u.team):units).filter(t=>unitAlive(t)&&!t.embarkedOn&&t.team!==u.team).sort((a,b)=>dist(u,a)-dist(u,b)||(a.id<b.id?-1:1));
  const commands=[];
  for(const t of targets){const component=system(t)?GoblinSystems.catalogChooseTarget(t.catalogSystems,registry()):null;if(system(t)&&!component)continue;
   const target=component?{kind:'component',runtimeUnitId:t.id,componentId:component.id}:{kind:'unit',runtimeUnitId:t.id};
   commands.push({type:'CatalogFire',actorId:u.id,target,weaponId,mode:'direct',spotterId:null});
   if(rules(u).fireRuleRef==='artillery-spotter-v1')for(const spotter of units.filter(s=>unitAlive(s)&&!s.disabled&&!s.embarkedOn&&s.team===u.team&&s!==u).sort((a,b)=>a.id<b.id?-1:1))commands.push({type:'CatalogFire',actorId:u.id,target,weaponId:null,mode:'indirect',spotterId:spotter.id});
  }
  return commands;
 }
 const legalFire=c=>{try{return fireQuery(c,true).ok}catch{return false}};
 const hasFireAction=u=>root.GoblinCatalogFullRuntime?.active()&&u.catalogId==='U13'?root.GoblinCatalogFullRuntime.hasHexAction(u):weapons(u).some(w=>w.ready&&candidateCommands(u,w.id).some(legalFire));
 function executeFire(command,allowEnemy=false){const legal=fireQuery(command,allowEnemy);intent={command:structuredClone(command),weaponClass:legal.weapon.weaponClass??(legal.actor.catalogFire?.ruleRef==='siege-tank-fire-budget-v1'?(GoblinSiegeBudget.WEAPONS[command.weaponId].infantryOnly?'antipersonnel':'main'):null),commandId:`${legacySession.sessionId}/${command.actorId}/${(legal.actor.specialistSerial??0)+1}`};try{attack(legal.actor,legal.target)}finally{intent=null}return {ok:true}}
 const oldEnemy=enemyFire;enemyFire=function(u){
  if(!active())return oldEnemy(u);if(root.GoblinCatalogFullRuntime?.active()&&u.catalogId==='U13')return root.GoblinCatalogFullRuntime.enemyHex(u);if(!alive(u)||u.disabled||u.embarkedOn&&!rules(u).passengerRef)return false;let fired=false;
  for(const w of weapons(u)){if(!unitAlive(u)||gameOver)break;if(!w.ready)continue;const c=candidateCommands(u,w.id).find(legalFire);if(c){executeFire(c,true);fired=true}}
  return fired;
 };
 function resetOwned(team){for(const u of units.filter(u=>u.team===team&&unitAlive(u))){
  if(system(u)&&u.catalogSystems.turn<turn){require(u.catalogSystems.turn+1===turn,'SYSTEM_TURN_DRIFT');u.catalogSystems=GoblinSystems.catalogResetFire(u.catalogSystems,turn,registry()).state;sync(u)}
  if(u.catalogFire&&u.catalogFire.state.turn<turn)u.catalogFire=GoblinCatalogSpecialistFire.reset(u.catalogFire,u.id,turn,registry());
 }}
 const oldReset=resetActionState;resetActionState=function(){oldReset();if(active())resetOwned('player')};
 const oldEnemyTurn=enemyTurn;enemyTurn=function(){if(active())resetOwned('enemy');return oldEnemyTurn()};
 // A stationary engineer or Forge can still work or deploy. Readiness must not commit its phase early.
 function hasMovementAction(u){
  if(!alive(u)||u.team!=='player'||u.disabled||u.embarkedOn||u.moved)return false;
  const legal=c=>{try{if(c.type==='Engineer')engineeringQuery(c);else cargoQuery(c);return true}catch{return false}};
  const cells=[];for(let y=Math.max(0,u.y-1);y<=Math.min(H-1,u.y+1);y++)for(let x=Math.max(0,u.x-1);x<=Math.min(W-1,u.x+1);x++)if(dist(u,{x,y})<=1)cells.push({kind:'cell',x,y});
  if(rules(u).engineeringRef){
   for(const target of cells)for(const job of ['clear','position','bridge'])if(legal({type:'Engineer',actorId:u.id,job,target,option:null}))return true;
   for(const t of units){const target={kind:'unit',runtimeUnitId:t.id};
    if(unitDead(t)){if(legal({type:'Engineer',actorId:u.id,job:'salvage',target:{kind:'wreck',wreckId:wreckKey(t)},option:null}))return true;continue}
    for(const option of ['disabled','hp'])if(legal({type:'Engineer',actorId:u.id,job:'repair-vehicle',target,option}))return true;
    if(system(t)){if(legal({type:'Engineer',actorId:u.id,job:'repair-treads',target,option:null}))return true;for(const c of t.catalogSystems.components.filter(c=>c.destroyed))if(legal({type:'Engineer',actorId:u.id,job:'repair-component',target:{kind:'component',runtimeUnitId:t.id,componentId:c.id},option:null}))return true}
   }
  }
  if(forge(u))for(const cargo of carrierCargo(u))for(const cell of cells)if(legal({type:'CatalogDeploy',actorId:u.id,cargoId:cargo.id,bayId:cargo.cargoBay,x:cell.x,y:cell.y}))return true;
  if(rules(u).cargoRef==='drone-cargo-v1')for(const carrier of units.filter(forge))for(const bayId of carrier.droneBays)if(legal({type:'CatalogLoad',actorId:u.id,carrierId:carrier.id,bayId}))return true;
  return false;
 }
 const oldPhase=phaseCanAct;phaseCanAct=function(u,name=turnPhase){if(!active())return oldPhase(u,name);if(name==='fire')return alive(u)&&u.team==='player'&&!u.disabled&&hasFireAction(u);return name==='movement'&&hasMovementAction(u)||oldPhase(u,name)};
 const oldMovement=movementBudget;movementBudget=function(u,second=false){return active()&&u?.catalogSystems?(second?0:GoblinSystems.catalogMovement(u.catalogSystems,registry())):oldMovement(u,second)};
 const oldRange=attackRange;attackRange=function(u){if(active()&&system(u))return weapons(u).find(w=>w.id===u.selectedSlot)?.range??0;return oldRange(u)};
 function ramQuery(c){
  require(exact(c,['type','actorId','targetId','x','y'])&&c.type==='CatalogRam','INVALID_RAM_COMMAND');const u=units.find(u=>u.id===c.actorId),t=units.find(t=>t.id===c.targetId);
  require(alive(u)&&u.team==='player'&&worldPhase(u,'movement')&&['U01','U20'].includes(record(u).catalogId)&&!u.disabled&&!u.embarkedOn&&!u.moved,'RAM_ACTOR_UNAVAILABLE');
  require(alive(t)&&(!root.GoblinCatalogFullRuntime?.active()||root.GoblinCatalogFullRuntime.known(t.id,u.team))&&t.team!==u.team&&!t.embarkedOn&&!t.core&&!system(t)&&!rules(t).infantry&&rules(t).repairClass==='vehicle'&&c.x===t.x&&c.y===t.y,'RAM_TARGET_UNAVAILABLE');
  const path=findMovementPath(u,t,movementBudget(u),u);require(path?.length,'RAM_UNREACHABLE');return {ok:true,actor:u,target:t,path};
 }
 function executeRam(c){const q=ramQuery(c),u=q.actor,t=q.target;if(root.GoblinCatalogFullRuntime?.ramCollision(c,q))return {ok:true};intent={command:structuredClone(c),commandId:`${legacySession.sessionId}/${u.id}/${(u.specialistSerial??0)+1}`};
  try{const capture=root.GoblinLegacyPresentation?.begin(u,q.path,'ram',t);u.moveFrom={x:u.x,y:u.y};u.x=t.x;u.y=t.y;u.moved=true;u.acted=true;u.moveCount=(u.moveCount??0)+1;carrierCargo(u).forEach(cargo=>{cargo.x=u.x;cargo.y=u.y});t.hp=0;t.lastOutcome='X';
   for(const cargo of carrierCargo(t)){if(rules(cargo).cargoRef==='drone-cargo-v1')cargo.hp=0;else{cargo.embarkedOn=null;cargo.embarkedThisTurn=false;cargo.disembarkedThisTurn=true;cargo.moved=true;cargo.x=t.x;cargo.y=t.y}}
   appendJournal(u,c,{kind:'ram',targetId:t.id,path:q.path});selected=u;updateSelection();draw();checkVictory();root.GoblinLegacyPresentation?.confirm(capture);return {ok:true};
  }finally{intent=null}
 }
 function execute(command){
  if(root.GoblinCatalogFullRuntime?.active())require(!root.GoblinMovement?.busy(),'PRESENTATION_BUSY');
  if(root.GoblinCatalogFullRuntime?.active()&&command?.type==='CatalogHexFire')return root.GoblinCatalogFullRuntime.executeHex(command);
  if(root.GoblinCatalogFullRuntime?.active()&&command?.type==='Move')return root.GoblinCatalogFullRuntime.executeMove(command);
  require(active(),'UNSUPPORTED_SPECIALISTS_PROFILE');require(!root.GoblinMovement?.busy(),'PRESENTATION_BUSY');
  if(command?.type==='Engineer')return executeEngineering(command);
  if(['CatalogLoad','CatalogDeploy'].includes(command?.type))return executeCargo(command);
  if(command?.type==='CatalogRam')return executeRam(command);
  return executeFire(command);
 }
 function query(command){try{if(command?.type==='CatalogRam'){const q=ramQuery(command);return {ok:true,path:q.path}}if(['CatalogLoad','CatalogDeploy'].includes(command?.type)){cargoQuery(command);return {ok:true}}if(command?.type==='Engineer'){const q=engineeringQuery(command);return {ok:true,cost:q.cost,materialGain:q.materialGain,terrainChange:q.terrainChange}}const q=fireQuery(command);return {ok:true,weapon:q.weapon,componentId:q.component?.id??null,defense:q.component?.type==='treads'?null:q.component?q.component.defense+TerrainRules.coverBonus(terrainTypeAt(q.target.x,q.target.y)):effectiveDefense(q.target)}}catch(error){return {ok:false,code:error.code??error.message,reason:reason(error.code??error.message,command),...(Number.isFinite(error.cost)?{cost:error.cost}:{})}}}
 function validateRestoredState(){
  if(!active())return true;const ids=new Set();
  for(const u of units){const r=record(u);require(r&&!ids.has(u.id),'RESTORE_OWNER_MISMATCH');ids.add(u.id);
   if(u.catalogSystems){require(r.rules.systemDefinitionRef&&u.catalogSystems.unitId===r.assetId&&!Object.hasOwn(u,'hp')&&!Object.hasOwn(u,'maxHp')&&!Object.hasOwn(u,'infantry'),'RESTORE_SYSTEM_BINDING');GoblinSystems.validateCatalogSystem(u.catalogSystems,registry());require(u.alive===!GoblinSystems.catalogIsHelpless(u.catalogSystems,registry()),'RESTORE_LIVENESS_MISMATCH');require(u.move===GoblinSystems.catalogMovement(u.catalogSystems,registry()),'RESTORE_MOVEMENT_MISMATCH')}
   if(u.catalogFire)GoblinCatalogSpecialistFire.validate(u.catalogFire,u.id,registry());
   if(r.rules.material)require(Number.isInteger(u.material)&&u.material>=0&&u.material<=r.rules.material.max&&u.materialMax===r.rules.material.max,'RESTORE_MATERIAL_MISMATCH');
   if(unitAlive(u)&&u.embarkedOn){const owner=units.find(c=>c.id===u.embarkedOn);require(alive(owner)&&owner.team===u.team&&owner.x===u.x&&owner.y===u.y,'RESTORE_CARGO_OWNER');if(forge(owner))require(r.rules.cargoRef==='drone-cargo-v1'&&!bayState(owner,u.cargoBay).destroyed,'RESTORE_BAY_CARGO')}
  }
  if(root.GoblinCatalogFullRuntime?.active())root.GoblinCatalogFullRuntime.validateRoster(ids);else require(ids.size===Object.keys(legacySession.effectiveRules.catalog.records).length,'RESTORE_ROSTER_MISMATCH');
  for(const u of units.filter(forge)){const cargo=carrierCargo(u),bays=new Set();for(const c of cargo){require(!bays.has(c.cargoBay),'RESTORE_BAY_CAPACITY');bays.add(c.cargoBay)}}
  for(const [key,type] of terrainTypes){const [x,y]=key.split(',').map(Number);require(inside({x,y})&&Object.hasOwn(TerrainRules.rules,type),'RESTORE_TERRAIN_MISMATCH');require(terrain.has(key)===(TerrainRules.coverBonus(type)>0),'RESTORE_COVER_MISMATCH')}
  return true;
 }
 const reasonKeys={COMPONENT_REQUIRED:'v2.specialists.reject.componentRequired',COMPONENT_UNAVAILABLE:'v2.specialists.reject.componentUnavailable',ENGINEER_UNAVAILABLE:'v2.specialists.reject.engineerUnavailable',READY_TOOL_REQUIRED:'v2.specialists.reject.toolRequired',ENGINEER_CELL_OCCUPIED:'v2.specialists.reject.occupied',INSUFFICIENT_MATERIAL:'v2.specialists.reject.material',REPAIR_UNAVAILABLE:'v2.specialists.reject.repairTarget',INVALID_VEHICLE_REPAIR:'v2.specialists.reject.vehicleRepair',REPAIR_EFFECT_UNAVAILABLE:'v2.specialists.reject.noRepairEffect',NONREPAIRABLE_COMPONENT:'v2.specialists.reject.nonrepairable',TREADS_FULL:'v2.specialists.reject.treadsFull',SALVAGE_UNAVAILABLE:'v2.specialists.reject.salvage',FORGE_CARGO_UNAVAILABLE:'v2.specialists.reject.forgeCargo',FORGE_LOAD_UNAVAILABLE:'v2.specialists.reject.forgeLoad',FORGE_DEPLOY_UNAVAILABLE:'v2.specialists.reject.forgeDeploy',BAY_UNAVAILABLE:'v2.specialists.reject.bayUnavailable',PRESENTATION_BUSY:'v2.specialists.actionResolving',TARGET_OUT_OF_RANGE:'v2.reject.range',DIRECT_LOS_REQUIRED:'v2.reject.sight',ACTOR_UNAVAILABLE:'v2.reject.unavailable',WRONG_FIRE_PHASE:'v2.reject.phase',FIRE_SPENT:'v2.reject.spent',DRONE_NOT_READY:'v2.reject.catalog.droneNotReady',INFANTRY_TARGET_REQUIRED:'v2.reject.infantry'};
 function reason(code,command){
  if(code==='INFANTRY_TARGET_REQUIRED')return root.GoblinLanguage?.translate('NUR GEGEN INFANTERIE')??'NUR GEGEN INFANTERIE';
  if(code==='INVALID_ENGINEER_TERRAIN')return text(`v2.specialists.reject.${command.job==='clear'?'clearTerrain':command.job==='position'?'positionTerrain':'bridgeTerrain'}`);
  if(['MAIN_TARGET_ALREADY_FIRED','INVALID_WEAPON','WEAPON_SPENT','INVALID_SIEGE_TANK_STATE'].includes(code))return GoblinSiegeWeapons.message(code,command.weaponId);
  if(['VALID_SPOTTER_REQUIRED','INVALID_SPOTTER','DIRECT_LOS_REQUIRED','INVALID_FIRE_MODE'].includes(code)&&command.mode==='indirect')return GoblinArtilleryWeapons.message('VALID_SPOTTER_REQUIRED');
  if(code==='CATALOG_WEAPON_UNAVAILABLE'){const u=units.find(u=>u.id===command.actorId),slot=u?.catalogSystems?.components.find(c=>c.id===command.weaponId);if(slot&&slot.readyFromTurn>u.catalogSystems.turn)return text('v2.specialists.readyFromTurn',{turn:slot.readyFromTurn});if(slot?.destroyed)return text('v2.ui.destroyed');if(slot?.spent||slot?.fired)return text('v2.specialists.spent');return text('v2.reject.weapon')}
  return text(reasonKeys[code]??'ui.error.INVALID_COMMAND');
 }
 const text=(key,params={})=>root.GoblinLanguage?.t(key,params)??key;
 function slotLabel(u,id){
  if(id==='treads')return text('v2.ui.treads');const defs=u.catalogSystems.rules.definition.components,d=defs.find(d=>d.id===id);if(!d)return '';
  const cls=d.kind==='weapon'?d.weaponClassRef:d.kind==='tool'?'tool':'bay',classLabel=text(d.kind==='weapon'?`v2.ui.weapon.${cls}`:`v2.specialists.${cls}`),same=defs.filter(x=>x.kind===d.kind&&(d.kind!=='weapon'||x.weaponClassRef===d.weaponClassRef));
  return text('v2.specialists.componentSlot',{class:classLabel,index:same.findIndex(x=>x.id===id)+1});
 }
 function selectedSpec(u,key){return weapons(u).find(w=>w.id===(key??u.selectedSlot??u.selectedWeapon))??weapons(u).find(w=>w.ready)??weapons(u)[0]??null}
 function summary(u,roster=units){
  const list=[];
  if(system(u)){const state=GoblinSystems.catalogSummary(u.catalogSystems,registry()),band=u.catalogSystems.rules.definition.movementBands.find(b=>state.treads>=b.minTreads&&state.treads<=b.maxTreads);
   list.push(text('v2.specialists.resource',{label:text('v2.ui.treads'),current:state.treads,max:state.maxTreads}),text('v2.specialists.movementBand',{min:band.minTreads,max:band.maxTreads,movement:band.movement}));
   for(const [key,c] of Object.entries(state.components))list.push(`${text(key==='tools'?'v2.specialists.tool':key==='bays'?'v2.specialists.bay':`v2.ui.weapon.${key}`)} · ${text('v2.specialists.intact',{current:c.intact,max:c.initial})} · ${text('v2.specialists.readyCount',{count:c.ready})}`);
  }
  if(u.materialMax!==undefined)list.push(text('v2.specialists.resource',{label:text('v2.specialists.material'),current:u.material,max:u.materialMax}));
  if(forge(u))for(const b of bayCargo(u,roster))list.push(text('v2.specialists.bayCargo',{bay:slotLabel(u,b.id),cargo:b.cargo?GoblinCatalogRuntime.name(roster.find(c=>c.id===b.cargo)):text('v2.specialists.bayEmpty')}));
  if(u.catalogFire)list.push(rules(u).fireRuleRef==='siege-tank-fire-budget-v1'?text('mission.siege-pilot.budget'):text('mission.artillery-pilot.budget'));
  if(rules(u)?.stealthRef&&root.GoblinCatalogFullRuntime?.active())list.push(root.GoblinCatalogFullRuntime.stealthText(u));
  return list.join(' · ');
 }
 function projectUnit(u,preferred){const spec=selectedSpec(u,preferred);return {...(rules(u)?.missileRuleRef?{ammunition:u.ammunition,cruiseMissile:true}:{}),...(u.catalogSystems?{catalogSystems:structuredClone(u.catalogSystems),alive:u.alive,selectedSlot:preferred??u.selectedSlot,systemSummary:GoblinSystems.catalogSummary(u.catalogSystems,registry()),attack:spec?.attack??null,range:spec?.range??0}:{}),...(u.catalogFire?{catalogFire:root.GoblinCatalogFullRuntime?.active()?root.GoblinCatalogFullRuntime.fireView(u.catalogFire):structuredClone(u.catalogFire),selectedWeapon:preferred??u.selectedWeapon,attack:spec?.attack??u.damage,range:spec?.range??u.range}:{}),...(u.materialMax!==undefined?{material:u.material,materialMax:u.materialMax}:{}),...(u.droneBays?{droneBays:[...u.droneBays]}:{}),...(u.cargoBay?{cargoBay:u.cargoBay}:{})}}
 function actions(u){return [...(movementBudget(u)>0?[text('v2.ui.move')]:[]),...(weapons(u).length?[text('v2.ui.fire')]:[]),...(rules(u).engineeringRef?['clear','position','bridge','repair-disabled','repair-hp','repair-treads','repair-component','salvage'].map(k=>text('v2.engineer.'+k)):[]),...(forge(u)?[text('v2.ui.embark'),text('v2.ui.catalog.deployDrone')]:[])]}
 const oldInfo=showUnitInfo;showUnitInfo=function(u){if(active()&&system(u)){$('#unit-intel-title').textContent=GoblinCatalogRuntime.name(u);$('#unit-intel-facts').textContent=summary(u);return}oldInfo(u)};
 function fireMetadata(){return intent?{command:intent.command,weaponClass:intent.weaponClass??null,weaponKey:intent.command.weaponId,mode:intent.command.mode,spotterId:intent.command.spotterId,targetComponentId:intent.command.target?.componentId??null}:null}
 root.GoblinSpecialistsRuntime=Object.freeze({active,registry,record,rules,system,sync,areaOutcome,query,fireQuery,resolveTarget,applyEffects,execute,engineeringQuery,wreckKey,forge,bayCargo,cargoQuery,ramQuery,weapons,candidateCommands,hasFireAction,resetOwned,validateRestoredState,slotLabel,selectedSpec,summary,projectUnit,actions,appendJournal,fireMetadata});
})(globalThis);
function executeSpecialistCommand(command){return GoblinSpecialistsRuntime.execute(command)}
