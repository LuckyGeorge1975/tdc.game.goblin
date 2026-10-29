// One authoritative world adapter; the pure visibility reducer owns disclosure rules.
(function(root){
 const active=()=>!root.IronDustBrowserV2?.active&&legacySession?.ruleProfileId===root.GoblinCatalogFullModel?.profile&&root.GoblinCatalogFullModel.has(legacySession.scenarioId);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const registry=()=>legacySession.effectiveRules.catalog.registry;
 let state=null;
 let commandKey=null,commandSerial=0;
 function revision(){return JSON.stringify([legacySession.sessionId,turn,phase,turnPhase,units.map(u=>[u.id,u.x,u.y,unitAlive(u),!!u.disabled,u.embarkedOn??null]),[...terrainTypes]])}
 function commandRevision(){const s=ensure(),key=JSON.stringify([legacySession.sessionId,turn,phase,turnPhase,gameOver,[...terrain],[...terrainTypes],units.map(({moveFrom,justHit,specialistJournal,...u})=>u),s.visibility,s.waves,s.ownTurns,s.terminalOutcome]);if(key!==commandKey){commandKey=key;commandSerial++}return `full:${legacySession.sessionId}:${commandSerial}`}
 function facts(clocks){
  const actors=units.map(u=>({runtimeUnitId:u.id,assetId:u.catalogAssetId,team:u.team,alive:unitAlive(u),disabled:!!u.disabled,embarkedOn:u.embarkedOn??null,x:u.x,y:u.y}));
  const sensorPairs=[];
  for(const target of units.filter(u=>u.catalogId==='U21'&&unitAlive(u)))for(const observer of units.filter(u=>unitAlive(u)&&!u.disabled&&!u.embarkedOn&&u.team!==target.team))sensorPairs.push({observerId:observer.id,targetId:target.id,distance:dist(observer,target),hasLineOfSight:lineOfSight(observer,target)});
  return {revision:revision(),map:{width:W,height:H},actors,sensorPairs,teamFire:copy(clocks)};
 }
 function ensure(){
  if(!active())return null;
  if(state?.sessionId!==legacySession.sessionId){
   const teamFire={player:{completed:0,active:false},enemy:{completed:0,active:false}};
   const bindings=units.filter(u=>u.catalogId==='U21').map(u=>({runtimeUnitId:u.id,assetId:u.catalogAssetId,team:u.team,stealthRef:'phantom-stealth-v1'})).sort((a,b)=>a.runtimeUnitId<b.runtimeUnitId?-1:1);
   const config=legacySession.effectiveRules.catalog.full.waves;
   state={version:'catalog-full-runtime-v1',sessionId:legacySession.sessionId,visibility:GoblinCatalogVisibility.create(registry(),bindings,facts(teamFire)),waves:config.waves.length?GoblinCatalogWaves.create(config):null,ownTurns:{player:0,enemy:0},terminalOutcome:null,journal:[],logs:[]};
   beginTurn('player');
  }
  return state;
 }
 function known(id,team='player'){if(!active())return true;const s=ensure();return GoblinCatalogVisibility.isKnown(s.visibility,team,id,facts(s.visibility.teamFire),registry())}
 function roster(team='player'){if(!active())return units;const s=ensure(),ids=new Set(GoblinCatalogVisibility.project(s.visibility,team,facts(s.visibility.teamFire),registry()).knownIds);return units.filter(u=>ids.has(u.id))}
 function fireView(binding){const out=copy(binding);if(out?.state)delete out.state.mainTargets;return out}
 function viewerUnit(u){const {specialistJournal,specialistSerial,...publicUnit}=u,out=copy(publicUnit);if(out.catalogFire)out.catalogFire=fireView(out.catalogFire);if(out.spotterId&&!known(out.spotterId))out.spotterId=null;return out}
 function event(type,fields={},clocks=null){const s=ensure();if(!s)return;const seq=s.visibility.sequence+1,result=GoblinCatalogVisibility.reduce(s.visibility,{type,id:`full-${s.sessionId}-${seq}`,seq,...fields},facts(clocks??s.visibility.teamFire),registry());s.visibility=result.state;return result}
 function fireBoundary(team,start){const s=ensure();if(!s)return;const clocks=copy(s.visibility.teamFire);if(clocks[team].active===start)return;clocks[team].active=start;if(!start)clocks[team].completed++;event(start?'fire-start':'fire-end',{team},clocks)}
 function reveal(subjectId,reason,result=null){if(active())event('reveal',{subjectId,reason,result})}
 function refresh(){if(!active())return;event('refresh');if(selected&&!known(selected.id))selected=null}
 function log(key,params={},subjects=[]){if(active())ensure().logs.push({key,params:copy(params),subjects:[...subjects]})}
 function status(){if(!active())return null;const s=ensure();return {pendingEnemy:pendingEnemy(),enemyTurns:s.visibility.teamFire.enemy.completed,turnLimit:legacySession.effectiveRules.catalog.full.turnLimit}}
 function stealthText(u){if(!active()||!registry().units[u.catalogAssetId]?.target.stealthRef)return '';const t=(key,params={})=>root.GoblinLanguage?.t(key,params)??key,parts=[t('v2.full.stealth.capability'),t('v2.full.stealth.sensorRule',{range:2}),t('v2.full.stealth.movementRule'),t('v2.full.stealth.eventRule')];if(u.team==='enemy'&&unitAlive(u)&&known(u.id)){const s=ensure();parts.push(t(s.visibility.reveals.some(r=>r.runtimeUnitId===u.id&&r.viewerTeam==='player'&&r.untilFireEnd>s.visibility.teamFire.player.completed)?'v2.full.stealth.eventExpiry':'v2.full.stealth.sensorContact'))}return parts.join(' · ')}
 function logEntries(all=false){if(!active())return [];const rows=all?ensure().logs:ensure().logs.slice(-4);return rows.toReversed().map(e=>{const visible=e.subjects.every(id=>known(id)),key=visible?e.key:'v2.full.stealth.contactLost';let message=root.GoblinLanguage?.t(key,visible?e.params:{})??key;if(visible&&e.action){message+=` · ${e.subjects.map(id=>GoblinCatalogRuntime.name(units.find(u=>u.id===id))).join(' → ')}`;if(e.action.result)message+=` · ${e.action.result}${e.action.ratio?' ('+e.action.ratio+')':''}`}return {time:'',source:'COMMAND',message}})}
 function recordAction(actor,command,result){if(!active())return;const key=result.kind==='hex-fire'?'v2.full.missile.resolved':result.kind==='collision'||result.collided?'v2.full.stealth.collision':result.kind==='engineering'?`v2.engineer.${command.job}`:result.kind==='fire'?'v2.ui.fire':result.kind==='ram'?'v2.ui.ram':['CatalogLoad','Embark'].includes(command.type)?'v2.ui.embark':command.type==='Unload'?'v2.ui.unload':command.type==='CatalogDeploy'?'v2.ui.catalog.deployDrone':'v2.ui.move';log(key,{},result.kind==='fire'?[actor.id,command.target.runtimeUnitId]:[actor.id]);const row=ensure().logs.at(-1);row.action={result:result.outcome?.result??null,ratio:result.outcome?.ratio??null}}
 function catalogCard(entry){
  if(!active())return null;const r=registry().units[root.UnitVisuals.artKey(entry)];if(!r)return null;const t=r.target,system=t.systemDefinitionRef?GoblinSystems.createCatalogSystem(registry(),r.assetId??root.UnitVisuals.artKey(entry)):null;
  const values=system?system.rules.definition.components.filter(c=>c.kind==='weapon').map(c=>system.rules.weaponClasses[c.weaponClassRef]):[];
  const range=system?Math.max(0,...values.map(w=>w.range)):t.range,attack=system?Math.max(0,...values.map(w=>w.attack)):t.strengthRef?2:t.attack;
  return {hp:system?`${system.treads}/${system.maxTreads}`:String(t.strengthRef?2:t.hp),move:t.movement.join(' + '),range:String(range),attack:String(attack),defense:system?(root.GoblinLanguage?.t('v2.ui.bySystem')??'SYSTEMS'):String(t.strengthRef?2:t.defense),copy:t.stealthRef?(root.GoblinLanguage?.t('v2.full.stealth.sensorRule',{range:2})??''):t.missileRuleRef?(root.GoblinLanguage?.t('v2.full.missile.ammoRule')??''):root.GoblinLanguage?.translate(entry.role)??entry.role,system:!!system};
 }
 function initialRoster(config){
  if(config?.ruleProfileId!==root.GoblinCatalogFullModel?.profile)return config.units;
  const data=config.catalog.registry,teamFire={player:{completed:0,active:false},enemy:{completed:0,active:false}},actors=config.units.map(u=>({runtimeUnitId:u.id,assetId:u.catalogAssetId,team:u.team,alive:unitAlive(u),disabled:false,embarkedOn:u.embarkedOn??null,x:u.x,y:u.y}));
  const bindings=actors.filter(a=>data.units[a.assetId].target.stealthRef).map(a=>({runtimeUnitId:a.runtimeUnitId,assetId:a.assetId,team:a.team,stealthRef:'phantom-stealth-v1'})).sort((a,b)=>a.runtimeUnitId<b.runtimeUnitId?-1:1),terrainMap=new Map(config.terrainTypes.map(c=>[`${c.x},${c.y}`,c.type]));
  const sensorPairs=[];for(const b of bindings){const target=actors.find(a=>a.runtimeUnitId===b.runtimeUnitId);for(const observer of actors.filter(a=>a.alive&&!a.disabled&&!a.embarkedOn&&a.team!==target.team))sensorPairs.push({observerId:observer.runtimeUnitId,targetId:target.runtimeUnitId,distance:dist(observer,target),hasLineOfSight:GoblinHexSupercover.intermediateHexes(observer,target).every(c=>!TerrainRules.blocksLos(terrainMap.get(`${c.x},${c.y}`)??'open-ground'))})}
  const facts={revision:`initial/${config.catalog.levelDigest}`,map:{width:12,height:8},actors,sensorPairs,teamFire},visibility=GoblinCatalogVisibility.create(data,bindings,facts),known=new Set(GoblinCatalogVisibility.project(visibility,'player',facts,data).knownIds);
  return config.units.filter(u=>known.has(u.id));
 }
 function fail(code){const key=code==='HEX_RANGE'?'v2.reject.range':code==='HEX_SIGHT'?'v2.reject.sight':code==='HEX_AMMO_SPENT'?'v2.reject.spent':code.startsWith('INVALID_')?'ui.error.INVALID_COMMAND':'v2.reject.unavailable';return {ok:false,code,reason:root.GoblinLanguage?.t(key)??key}}
 const exact=(c,keys)=>c&&Object.keys(c).length===keys.length&&keys.every(k=>Object.hasOwn(c,k));
 function hexQuery(command,allowEnemy=false){
  if(!active()||!exact(command,['type','actorId','x','y'])||command.type!=='CatalogHexFire')return fail('INVALID_HEX_FIRE');
  const actor=units.find(u=>u.id===command.actorId),{x,y}=command;
  if(!actor||actor.catalogId!=='U13'||!unitAlive(actor)||actor.disabled||actor.embarkedOn||gameOver||actor.team!=='player'&&!allowEnemy||actor.team==='player'&&(phase!=='player'||turnPhase!=='fire')||actor.team==='enemy'&&phase!=='enemy')return fail('HEX_ACTOR_UNAVAILABLE');
  if(actor.fired||actor.ammunition!==1)return fail('HEX_AMMO_SPENT');
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=W||y>=H)return fail('HEX_TARGET_UNAVAILABLE');
  if(dist(actor,{x,y})>8)return fail('HEX_RANGE');if(!lineOfSight(actor,{x,y}))return fail('HEX_SIGHT');
  const footprint=[{x,y},...hexNeighbors(x,y).filter(c=>c.x>=0&&c.y>=0&&c.x<W&&c.y<H).sort((a,b)=>a.y-b.y||a.x-b.x)];
  return {ok:true,actor,footprint,friendlies:units.filter(u=>unitAlive(u)&&!u.embarkedOn&&u.team===actor.team&&footprint.some(c=>c.x===u.x&&c.y===u.y)).map(u=>({id:u.id,name:u.name})),weapon:{attack:6,range:8}};
 }
 function executeHex(command,allowEnemy=false){
  const q=hexQuery(command,allowEnemy);if(!q.ok)return q;
  const actor=q.actor,commandId=`${legacySession.sessionId}/${actor.id}/${(actor.specialistSerial??0)+1}`;
  // Freeze all ground victims and automatic system targets before any damage/ejection.
  const victims=q.footprint.flatMap((cell,i)=>units.filter(u=>unitAlive(u)&&!u.embarkedOn&&u.x===cell.x&&u.y===cell.y).sort((a,b)=>a.id<b.id?-1:1).map(unit=>({unit,attack:i===0?6:3,componentId:unit.catalogSystems?GoblinSystems.catalogChooseTarget(unit.catalogSystems,registry())?.id:null})));
  reveal(actor.id,'own-fire');
  const outcomes=[],capture=root.GoblinLegacyPresentation?.beginHex(command,actor);let ended=false;
  actor.ammunition=0;actor.fired=true;actor.acted=true;
  try{for(const victim of victims){
   // The incoming area attack itself reveals, before any observer result capture.
   reveal(victim.unit.id,'incoming-area','NE');
   const outcome=GoblinSpecialistsRuntime.areaOutcome({...actor,damage:victim.attack,range:8},victim.unit,victim.componentId,commandId,command);
   victim.unit.lastOutcome=outcome.result;
   outcomes.push({unitId:victim.unit.id,attack:victim.attack,componentId:victim.componentId,outcome:{...outcome,passengers:(outcome.passengers??[]).map(h=>({unitId:h.unit.id,outcome:h.outcome}))}});
  }
  GoblinSpecialistsRuntime.appendJournal(actor,command,{kind:'hex-fire',footprint:q.footprint,outcomes});
  refresh();selected=actor.team==='player'&&unitAlive(actor)?actor:null;
  // No terminal check or phase advance occurs inside the frozen victim sequence.
  ended=checkVictory();
  }finally{root.GoblinLegacyPresentation?.endHex(capture)}
  updateSelection();draw();if(!ended&&actor.team==='player')maybeAutoAdvancePhase();return {ok:true};
 }
 function hasHexAction(actor){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(hexQuery({type:'CatalogHexFire',actorId:actor.id,x,y},actor.team==='enemy').ok)return true;return false}
 function enemyHex(actor){const targets=roster(actor.team).filter(u=>unitAlive(u)&&!u.embarkedOn&&u.team!==actor.team).sort((a,b)=>dist(actor,a)-dist(actor,b)||(a.id<b.id?-1:1));for(const t of targets){const c={type:'CatalogHexFire',actorId:actor.id,x:t.x,y:t.y};if(hexQuery(c,true).ok){executeHex(c,true);return true}}return false}
 function enemyStep(actor,step){if(!active()||!step)return step;const s=ensure(),seq=s.visibility.sequence+1,result=GoblinCatalogVisibility.collisionPrefix(s.visibility,{id:`full-${s.sessionId}-${seq}`,seq,actorId:actor.id,phase:'movement',path:step.path},facts(s.visibility.teamFire),registry());s.visibility=result.state;const last=result.acceptedPrefix.at(-1)??actor;return {...step,x:last.x,y:last.y,path:result.acceptedPrefix}}
 function moveQuery(command){
  if(!active()||!exact(command,['type','actorId','x','y'])||command.type!=='Move')return fail('INVALID_FULL_MOVE');
  return GoblinCatalogRuntime.query(command);
 }
 function executeMove(command){
  const q=moveQuery(command);if(!q.ok)return q;const actor=units.find(u=>u.id===command.actorId),s=ensure(),seq=s.visibility.sequence+1;
  const result=GoblinCatalogVisibility.collisionPrefix(s.visibility,{id:`full-${s.sessionId}-${seq}`,seq,actorId:actor.id,phase:turnPhase,path:q.path},facts(s.visibility.teamFire),registry());
  const capture=root.GoblinLegacyPresentation?.begin(actor,result.acceptedPrefix,'move',null);s.visibility=result.state;
  actor.moveFrom={x:actor.x,y:actor.y};const last=result.acceptedPrefix.at(-1);if(last){actor.x=last.x;actor.y=last.y}
  carrierCargo(actor).forEach(u=>{u.x=actor.x;u.y=actor.y});if(turnPhase==='gev')actor.secondMoved=true;else actor.moved=true;actor.acted=true;actor.moveCount=(actor.moveCount??0)+1;
  GoblinSpecialistsRuntime.appendJournal(actor,command,{kind:'move',acceptedPrefix:result.acceptedPrefix,collided:result.collided});refresh();root.GoblinLegacyPresentation?.confirm(capture);selected=null;updateSelection();draw();maybeAutoAdvancePhase();return {ok:true};
 }
 function ramCollision(command,q){
  if(!active()||q.path.length<2)return false;const actor=q.actor,s=ensure(),seq=s.visibility.sequence+1;
  const result=GoblinCatalogVisibility.collisionPrefix(s.visibility,{id:`full-${s.sessionId}-${seq}`,seq,actorId:actor.id,phase:'movement',path:q.path.slice(0,-1)},facts(s.visibility.teamFire),registry());
  if(!result.collided)return false;
  const capture=root.GoblinLegacyPresentation?.begin(actor,result.acceptedPrefix,'move',null);s.visibility=result.state;
  const last=result.acceptedPrefix.at(-1);actor.moveFrom={x:actor.x,y:actor.y};if(last){actor.x=last.x;actor.y=last.y}actor.moved=true;actor.acted=true;actor.moveCount=(actor.moveCount??0)+1;carrierCargo(actor).forEach(u=>{u.x=actor.x;u.y=actor.y});
  GoblinSpecialistsRuntime.appendJournal(actor,command,{kind:'collision',acceptedPrefix:result.acceptedPrefix});refresh();root.GoblinLegacyPresentation?.confirm(capture);selected=null;updateSelection();draw();maybeAutoAdvancePhase();return true;
 }
 function snapshot(){return active()?copy(ensure()):null}
 function beginTurn(team){
  const s=ensure();if(!s)return;const ownTurn=turn,config=legacySession.effectiveRules.catalog.full;
  if(s.ownTurns[team]===ownTurn){
   if(s.waves){const previous=s.journal.findLast(e=>e.type==='begin-turn'&&e.request.team===team&&e.request.ownTurn===ownTurn);if(!previous||!GoblinCatalogWaves.beginTurn(s.waves,previous.request,config.waves).idempotent)throw Error('FULL_BEGIN_REPLAY')}
   return;
  }
  if(ownTurn!==s.ownTurns[team]+1)throw Error('FULL_BEGIN_TURN_DRIFT');
  if(s.waves){
   const entries=config.waves.waves.filter(w=>w.team===team&&s.waves.waves.some(row=>row.id===w.id&&row.status==='pending'&&row.nextOwnTurn<=ownTurn)).map(w=>{
    const template=config.waveTemplates.find(u=>u.id===w.templateId);
    return {waveId:w.id,options:w.entries.map(c=>({x:c.x,y:c.y,passable:template.move===0?!['water','river'].includes(terrainTypeAt(c.x,c.y)):Number.isFinite(TerrainRules.movementCost(terrainTypeAt(c.x,c.y),template)),occupied:units.some(u=>unitAlive(u)&&!u.embarkedOn&&u.x===c.x&&u.y===c.y)}))};
   });
   const request={eventId:`${s.sessionId}/${team}/begin/${ownTurn}`,revision:revision(),team,ownTurn,entries};
   const result=GoblinCatalogWaves.beginTurn(s.waves,request,config.waves);
   for(const effect of result.effects.filter(e=>e.type==='SpawnWave')){
    if(units.some(u=>u.id===effect.unitId))throw Error('FULL_DUPLICATE_SPAWN');
    const template=config.waveTemplates.find(u=>u.id===effect.templateId);if(!template||template.team!==team)throw Error('FULL_SPAWN_TEMPLATE');
    units.push({...copy(template),...effect.entry,moved:false,fired:false,secondMoved:false,acted:false,disabled:false,moveCount:0,moveFrom:null,justHit:false});
   }
   s.waves=result.state;s.journal.push({type:'begin-turn',request,effects:copy(result.effects)});
   for(const effect of result.effects)log(effect.type==='SpawnWave'?'v2.full.wave.arrived':effect.type==='WaveFailed'?'v2.full.wave.failed':'v2.full.wave.retry',{attempt:effect.attempt,maxAttempts:3});
  }
  s.ownTurns[team]=ownTurn;refresh();
 }
 function pendingEnemy(){return active()&&ensure().waves?GoblinCatalogWaves.pendingEnemy(ensure().waves):0}
 function terminalOutcome(){return active()?ensure().terminalOutcome:null}
 function enemyBegin(){if(!active())return;fireBoundary('player',false);beginTurn('enemy');fireBoundary('enemy',true)}
 function enemyEnd(){if(!active())return false;fireBoundary('enemy',false);if(checkVictory())return true;if(legacySession.effectiveRules.catalog.full.turnLimit!==null&&ensure().ownTurns.enemy>=legacySession.effectiveRules.catalog.full.turnLimit){finish(false);return true}return false}
 function validateRoster(ids){
  const config=legacySession.config,initial=config.units.map(u=>u.id),templates=config.catalog.full.waveTemplates.map(u=>u.id);
  if(initial.some(id=>!ids.has(id))||[...ids].some(id=>!initial.includes(id)&&!templates.includes(id)))throw Error('FULL_RESTORE_ROSTER');
  for(const u of units){const source=[...config.units,...config.catalog.full.waveTemplates].find(v=>v.id===u.id),rules=config.catalog.records[u.id].rules;if(u.team!==source.team||u.catalogId!==source.catalogId||u.catalogAssetId!==source.catalogAssetId)throw Error('FULL_RESTORE_OWNER');if(!u.catalogSystems&&(!Number.isInteger(u.hp)||u.hp<0||u.hp>source.maxHp||u.maxHp!==source.maxHp||u.range!==source.range||u.move!==source.move||u.damage!==(rules.strengthRef?u.hp:source.damage)||u.defense!==(rules.strengthRef?u.hp:source.defense)))throw Error('FULL_RESTORE_VALUES');if(rules.missileRuleRef&&![0,1].includes(u.ammunition))throw Error('FULL_RESTORE_AMMO')}
  const waves=ensure().waves;if(waves){GoblinCatalogWaves.validate(waves,config.catalog.full.waves);for(const row of waves.waves)if(ids.has(config.catalog.full.waves.waves.find(w=>w.id===row.id).templateId)!==(row.status==='spawned'))throw Error('FULL_RESTORE_SPAWN')}
  return true;
 }
 function restore(value){
  if(!active()){if(value!==null)throw Error('FULL_RESTORE_PROFILE');return}
  if(!exact(value,['version','sessionId','visibility','waves','ownTurns','terminalOutcome','journal','logs'])||value.version!=='catalog-full-runtime-v1'||value.sessionId!==legacySession.sessionId)throw Error('FULL_RESTORE_SESSION');
  if(!exact(value.ownTurns,['player','enemy'])||!['player','enemy'].every(team=>Number.isInteger(value.ownTurns[team])&&value.ownTurns[team]>=0)||![null,true,false].includes(value.terminalOutcome)||!Array.isArray(value.journal)||!Array.isArray(value.logs))throw Error('FULL_RESTORE_STATE');
  GoblinCatalogVisibility.validate(value.visibility,facts(value.visibility.teamFire),registry());
  const config=legacySession.effectiveRules.catalog.full.waves;
  if(config.waves.length){GoblinCatalogWaves.validate(value.waves,config);if(JSON.stringify(value.ownTurns)!==JSON.stringify(value.waves.ownTurns))throw Error('FULL_RESTORE_TURNS')}else if(value.waves!==null)throw Error('FULL_RESTORE_WAVES');
  state=copy(value);
 }
 root.GoblinCatalogFullRuntime=Object.freeze({active,known,roster,viewerUnit,fireView,ensure,facts,revision,commandRevision,event,fireBoundary,reveal,refresh,snapshot,restore,validateRoster,hexQuery,executeHex,hasHexAction,enemyHex,enemyStep,moveQuery,executeMove,ramCollision,beginTurn,pendingEnemy,terminalOutcome,enemyBegin,enemyEnd,log,logEntries,recordAction,catalogCard,initialRoster,status,stealthText});
 const oldSetPhase=setTurnPhase;setTurnPhase=function(next){if(active()&&phase==='player'){if(turnPhase==='fire'&&next!=='fire')fireBoundary('player',false);if(next==='fire'&&turnPhase!=='fire')fireBoundary('player',true)}return oldSetPhase(next)};
 const oldFinish=finish;finish=function(win){if(active()){const s=ensure();s.terminalOutcome=win;for(const team of ['player','enemy'])if(s.visibility.teamFire[team].active)fireBoundary(team,false);if(s.waves){const result=GoblinCatalogWaves.discardPending(s.waves);s.waves=result.state;s.journal.push({type:'mission-end',outcome:win,effects:copy(result.effects)})}}return oldFinish(win)};
 const oldHex=handleHex;handleHex=function(x,y){if(!active())return oldHex(x,y);focusedCell={x,y};const occupant=roster().find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y);if(!occupant&&selected?.team==='player'&&['movement','gev'].includes(turnPhase))return executeSpecialistCommand({type:'Move',actorId:selected.id,x,y});if(occupant)return handleUnitClick(occupant);showFieldInfo(x,y);draw()};
})(globalThis);
