// One authoritative world adapter; the pure visibility reducer owns disclosure rules.
(function(root){
 const active=()=>!root.IronDustBrowserV2?.active&&legacySession?.ruleProfileId===root.GoblinCatalogFullModel?.profile&&
  (root.GoblinCatalogFullModel.has(legacySession.scenarioId)||ScenarioRuleProfiles.isDraftSession?.(legacySession)||
   ScenarioRuleProfiles.isMigratedSession?.(legacySession));
 const copy=v=>JSON.parse(JSON.stringify(v));
 const registry=()=>legacySession.effectiveRules.catalog.registry;
 let state=null;
 let roundFireChoice=null;
 let roundSelection=null;
 let controller=null;
 let presentationPending=false;
 const controllerSides=['player','enemy'];
 const qualifiedControllers={player:new Map(),enemy:new Map()};
 const admissionError=code=>Object.assign(Error(code),{code});
 let commandKey=null,commandSerial=0;
 function revision(){return JSON.stringify([legacySession.sessionId,turn,phase,turnPhase,units.map(u=>[u.id,u.x,u.y,unitAlive(u),!!u.disabled,u.embarkedOn??null]),[...terrainTypes]])}
 function ruleStateKey(s) {
  return JSON.stringify([legacySession.sessionId, turn, phase, turnPhase, gameOver, [...terrain], [...terrainTypes],
   units.map(({moveFrom, justHit, specialistJournal, ...unit}) => unit), s.visibility, s.waves, s.ownTurns, s.terminalOutcome,
   ...(Object.hasOwn(s,'deadlineRemoved') ? [s.deadlineRemoved] : [])]);
 }
 function commandRevision(){const key=ruleStateKey(ensure());if(key!==commandKey){commandKey=key;commandSerial++}return `full:${legacySession.sessionId}:${commandSerial}`}

 let readinessCache = null;
 function readyUnits() {
  // The complete rule inputs also cover specialist fire, repairs and cargo actions.
  // Readiness must never advance the command revision counter.
  const key = ruleStateKey(ensure());
  if (readinessCache?.session !== legacySession || readinessCache.key !== key) {
   const ids = new Set(units.filter(unit => phaseCanAct(unit)).map(unit => unit.id));
   readinessCache = {session: legacySession, key, ids};
  }
  return units.filter(unit => readinessCache.ids.has(unit.id));
 }
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
   const full=legacySession.effectiveRules.catalog.full,config=full.waves;
   state={version:'catalog-full-runtime-v1',sessionId:legacySession.sessionId,visibility:GoblinCatalogVisibility.create(registry(),bindings,facts(teamFire)),waves:config.waves.length?GoblinCatalogWaves.create(config):null,ownTurns:{player:0,enemy:0},terminalOutcome:null,journal:[],logs:[],
    ...(full.deadlineEvent ? {deadlineRemoved:false} : {})};
   beginTurn('player');
  }
  return state;
 }
 let projectionCache = null;
 function sameProjectionTerrain(cache){
  if(cache.terrain.length!==terrain.size||cache.terrainTypes.length!==terrainTypes.size)return false;
  let same=true,index=0;
  terrain.forEach(value=>{if(value!==cache.terrain[index++])same=false});
  index=0;
  terrainTypes.forEach((value,key)=>{
   const previous=cache.terrainTypes[index++];
   if(previous[0]!==key||previous[1]!==value)same=false;
  });
  return same;
 }
 function projectionUnitKey(unit){
  return [unit.id,unit.x,unit.y,unitAlive(unit),!!unit.disabled,unit.embarkedOn??null,
   unit.catalogId,unit.catalogAssetId,unit.team];
 }
 function sameProjectionUnits(previous){
  return previous.length===units.length&&units.every((unit,index)=>{
   const row=previous[index];
   return row[0]===unit.id&&row[1]===unit.x&&row[2]===unit.y&&row[3]===unitAlive(unit)&&
    row[4]===!!unit.disabled&&row[5]===(unit.embarkedOn??null)&&
    row[6]===unit.catalogId&&row[7]===unit.catalogAssetId&&row[8]===unit.team;
  });
 }
 function projectionContext() {
  const visibility = ensure().visibility;
  const visibilityKey=JSON.stringify(visibility),cache=projectionCache;
  // Compare every input of the former nested JSON key. Native mutations, even
  // in-place terrain/roster edits, still invalidate the existing projection.
  if(!cache||cache.session!==legacySession||cache.sessionId!==legacySession.sessionId||
    cache.turn!==turn||cache.phase!==phase||cache.turnPhase!==turnPhase||
    cache.width!==W||cache.height!==H||cache.visibilityKey!==visibilityKey||
    !sameProjectionUnits(cache.units)||!sameProjectionTerrain(cache)){
   projectionCache={session:legacySession,sessionId:legacySession.sessionId,turn,phase,turnPhase,width:W,height:H,
    units:units.map(projectionUnitKey),terrain:[...terrain],terrainTypes:[...terrainTypes],
    visibilityKey,visibility,facts:null,teams:new Map()};
  }
  return projectionCache;
 }
 function projectedIds(team) {
  const cache = projectionContext();
  if (!cache.teams.has(team)) {
   cache.facts ??= facts(cache.visibility.teamFire);
   const {knownIds} = GoblinCatalogVisibility.project(cache.visibility, team, cache.facts, registry());
   cache.teams.set(team, new Set(knownIds));
  }
  return cache.teams.get(team);
 }
 function known(id, team = 'player') {
  return !active() || projectedIds(team).has(id);
 }
 function roster(team = 'player') {
  if (!active()) return units;
  const ids = projectedIds(team);
  return units.filter(unit => ids.has(unit.id));
 }
 function aiProjection(team){
  if(!active()||legacySession.ruleProfileId!=='FULL_CATALOG_v1'||!ScenarioRuleProfiles.aiAllowed(legacySession.config)||
     !['player','enemy'].includes(team))return null;
  return sideProjection(team);
 }
 function sideProjection(team){
  return {side:team,phase:turnPhase,turn,terrain:boardTerrain(),observedCells:observedCells(team),
   ...(controllerPort() || Object.hasOwn(ensure(),'deadlineRemoved') ?
    {objectives:publicObjectives(team),objectiveRemaining:publicObjectiveCount(team)} : {}),
   units:boardUnits(roster(team),team)};
 }
 function boardTerrain(){
  return {width:W,height:H,defaultTerrain:'open-ground',
   cells:[...terrainTypes].map(([key,type])=>{const [x,y]=key.split(',').map(Number);return {x,y,type}})};
 }
 let sensorCoverageCache=null;
 function observedCells(team,move=null){
  const terrainKey=JSON.stringify([W,H,[...terrainTypes]]);
  if(sensorCoverageCache?.key!==terrainKey)sensorCoverageCache={key:terrainKey,cells:new Map()};
  const distance=registry().definitions.stealth['phantom-stealth-v1'].detectionDistance;
  const observed=new Map();
  for(const unit of units.filter(unit=>unit.team===team&&unitAlive(unit)&&!unit.disabled&&!unit.embarkedOn)){
   const observer=move?.actorId===unit.id?{x:move.x,y:move.y}:unit;
   const key=observer.x+','+observer.y;
   let cells=sensorCoverageCache.cells.get(key);
   if(!cells){
    cells=[];
    for(let y=Math.max(0,observer.y-distance);y<=Math.min(H-1,observer.y+distance);y++)
     for(let x=Math.max(0,observer.x-distance-1);x<=Math.min(W-1,observer.x+distance+1);x++){
      const cell={x,y};
      if(dist(observer,cell)<=distance&&lineOfSight(observer,cell))cells.push(cell);
     }
    sensorCoverageCache.cells.set(key,cells);
   }
   for(const cell of cells)observed.set(cell.x+','+cell.y,cell);
  }
  return [...observed.values()].sort((left,right)=>left.y-right.y||left.x-right.x).map(cell=>({...cell}));
 }
 function tacticalProjection(team){
  const view=sideProjection(team);
  const cover=view.terrain.cells.filter(cell=>TerrainRules.coverBonus(cell.type)>0);
  const unitFacts=Object.fromEntries(roster(team).filter(unitAlive).map(u=>{
   const system=u.catalogSystems;
   const range=system?Math.max(0,...system.rules.definition.components.flatMap((spec,i)=>{
    const slot=system.components[i];
    return spec.kind==='weapon'&&!slot.destroyed&&!slot.spent?[system.rules.weaponClasses[spec.weaponClassRef].range]:[];
   })):u.catalogId==='U13'?(u.ammunition===1?8:0):u.range??0;
   return [u.id,{range,infantry:u.infantry===true||u.engineering===true||u.id==='infantry',
    ...(system?{maxTreads:system.maxTreads}:{})}];
  }));
  return {...view,tactics:{cover,unitFacts,crt:copy(COMBAT_RULES.crt)}};
 }
 function boardUnits(visible,team){
  const ids=new Set(visible.map(u=>u.id));
  return visible.map(u=>({id:u.id,...(team===null?{team:u.team}:{relation:u.team===team?'own':'opponent'}),assetId:u.catalogAssetId,
    x:u.x,y:u.y,alive:unitAlive(u),disabled:!!u.disabled,
    embarkedOn:ids.has(u.embarkedOn)?u.embarkedOn:null,objectiveTarget:u.core===true,
    ...(u.catalogSystems?{systems:{treads:u.catalogSystems.treads,components:u.catalogSystems.components.map(c=>
     ({id:c.id,destroyed:c.destroyed,spent:c.spent}))}}:{hp:u.hp,maxHp:u.maxHp})}));
 }
 const coreAlive = () => units.some(unit => unit.id === 'core' && unitAlive(unit));
 function publicObjectives(team){
  const s=ensure();
  const target={kind:'unit',unitId:'core'};
  const playerAlive=units.some(unit=>unit.team==='player'&&unitAlive(unit));
  if(legacySession.effectiveRules.objective==='eliminate-opponent'){
   const opponent=team==='player'?'enemy':'player';
   const remaining=units.filter(unit=>unit.team===opponent&&unitAlive(unit)).length;
   return [{kind:'destroy-opponent-force',remaining,satisfied:remaining===0},
    {kind:'survive',satisfied:units.some(unit=>unit.team===team&&unitAlive(unit))}];
  }
  const escorts=units.filter(unit=>unit.team==='enemy'&&!unit.core&&unitAlive(unit)).length+pendingEnemy();
  const attackers=units.filter(unit=>unit.team==='player'&&unitAlive(unit)).length;
  const goals=team==='player' ? [
   {kind:'destroy-core',target,satisfied:!coreAlive(),remaining:Number(coreAlive())},
   {kind:'destroy-escort',satisfied:escorts===0,remaining:escorts},
   {kind:'survive',satisfied:playerAlive}
  ] : [
   {kind:'protect-core',target,satisfied:coreAlive(),remaining:Number(coreAlive())},
   {kind:'protect-escort',remaining:escorts},
   {kind:'destroy-player-force',satisfied:!playerAlive,remaining:attackers}
  ];
  if(Number.isSafeInteger(turnLimit(s)))goals.push({kind:'enemy-turn-limit',turns:turnLimit(s),
   completedEnemyTurns:s.visibility.teamFire.enemy.completed});
  return goals;
 }
 function publicObjectiveCount(team){
  return publicObjectives(team).filter(goal=>goal.kind.startsWith('destroy-'))
   .reduce((count,goal)=>count+goal.remaining,0);
 }
 function turnLimit(s){
  return s.deadlineRemoved ? null : legacySession.effectiveRules.catalog.full.turnLimit;
 }
 function applyDeadlineEvent(){
  const id=legacySession?.effectiveRules.catalog?.full?.deadlineEvent;
  if(!id || !active())return;
  const s=ensure();
  if(s.deadlineRemoved || coreAlive())return;
  s.deadlineRemoved=true;
  s.journal.push({type:'deadline-removed',id});
  // Both sides know the core and the mission deadline in this draft.
  log('v2.full.limit.removed');
 }
 function deadlineRemoved(){
  return active() && ensure().deadlineRemoved === true;
 }
 function controlOwner(){
  return controller?.owns(legacySession) ? controller : null;
 }
 function controllerPort(){return controlOwner()?.port??null;}
 function mapPort(){const owner=controlOwner();return owner?.mapPresentation?owner.port:null;}
 function ownsPresentation(){const owner=controlOwner();return presentationPending||!!owner&&!owner.mapPresentation;}
 function stageControlledPresentation(){
  presentationPending=true;
  clearFullNativePresentation();
  root.GoblinMovement?.clear();
  root.GoblinPresentation?.stop();
 }
 function startControlledPresentation(){
  const owner=controlOwner();
  presentationPending=false;
  owner?.startPresentation();
 }
 function nativePlayerQuery(command){
  if(command.type==='Move')return moveQuery(command);
  if(command.type==='CatalogHexFire')return hexQuery(command);
  if(command.type==='Embark'||command.type==='Unload')return GoblinCatalogRuntime.query(command);
  return GoblinSpecialistsRuntime.query(command);
 }
 function nativePlayerDispatch(command,revision){
  if(!controllerSides.includes(phase)||gameOver||!controlOwner()?.committing()||commandRevision()!==revision)
   return {ok:false,code:'FULL_CONTROL_STALE'};
  if(root.GoblinMovement?.busy())return {ok:false,code:'PRESENTATION_BUSY'};
  try{
   if(command.type==='Embark'||command.type==='Unload'){
    const check=nativePlayerQuery(command);
    if(!check.ok)return check;
    const actor=units.find(u=>u.id===command.actorId);
    if(command.type==='Embark')embark(actor,units.find(u=>u.id===command.carrierId));
    else unloadAt(actor,units.find(u=>u.id===command.cargoId),command.x,command.y);
   }else executeSpecialistCommand(command);
   return {ok:commandRevision()!==revision};
  }catch(error){return {ok:false,code:error.code??error.message}}
 }
 const nativePlayerGateway=Object.freeze({query:nativePlayerQuery,dispatch:nativePlayerDispatch});
 function registerQualifiedController({side,id,difficulty,select}){
  const experiment=typeof id==='string'&&id.startsWith('full-experiment:');
  const validDifficulty=experiment?root.GoblinFullExperimentCatalog?.qualifies({side,id,difficulty,select})===true:
   id==='full-attack-2a'?side==='player'&&difficulty===null:
   id==='full-defender-control-trial'?side==='enemy'&&difficulty===null:
   ScenarioRuleProfiles.fullDifficulties.includes(difficulty);
  if(!controllerSides.includes(side)||typeof id!=='string'||!id||
      !validDifficulty||typeof select!=='function'||
      qualifiedControllers[side].has(id))throw admissionError('FULL_AI_QUALIFICATION_INVALID');
  if(experiment&&!qualifiedControllers[side].has(side+'-medium'))throw admissionError('FULL_AI_QUALIFICATION_INVALID');
  qualifiedControllers[side].set(id,Object.freeze({id,difficulty,select,experiment}));
 }
 function meetsMinimum(difficulty,minimum){
  if(minimum===null||difficulty===null)return true;
  const order=ScenarioRuleProfiles.fullDifficulties;
  return order.indexOf(difficulty)>=order.indexOf(minimum);
 }
 function controllerCapabilities(config){
  if(config?.ruleProfileId!=='FULL_CATALOG_v1')return null;
  const seatIds=Object.freeze([...(config.seatLayout?.seatIds??controllerSides)]);
  const level=Object.freeze({seatIds,maxSeats:config.seatLayout?.maxSeats??controllerSides.length,
   minimumDifficulty:ScenarioRuleProfiles.fullMinimumDifficulty(config),aiAllowed:ScenarioRuleProfiles.aiAllowed(config)});
  const seats=Object.freeze(Object.fromEntries(seatIds.map(side=>[side,Object.freeze({human:true,
   ai:Object.freeze([...qualifiedControllers[side].values()].map(({id,difficulty})=>Object.freeze({id,difficulty})))})])));
  return Object.freeze({level,seats});
 }
 function controllerOffers(config){
  const capabilities=controllerCapabilities(config);
  if(!capabilities)return null;
  const {minimumDifficulty,aiAllowed:allowed}=capabilities.level;
  const result={minimumDifficulty,legacyStartAllowed:minimumDifficulty===null};
  for(const side of controllerSides){
   const choices=allowed?capabilities.seats[side].ai.filter(policy=>meetsMinimum(policy.difficulty,minimumDifficulty)):[];
   const reason=choices.length?null:!allowed?'AI_LEVEL_FORBIDDEN':
    minimumDifficulty?'FULL_AI_MINIMUM_UNAVAILABLE':'FULL_AI_NOT_QUALIFIED';
   result[side]=Object.freeze({choices:Object.freeze(choices),reason});
  }
  return Object.freeze(result);
 }
 function bindQualifiedControllers(session,roles,policyIds){
  if(!policyIds||typeof policyIds!=='object'||Array.isArray(policyIds)||
      Object.keys(policyIds).some(side=>!controllerSides.includes(side)))throw admissionError('FULL_CONTROLLERS_INVALID');
  const minimum=ScenarioRuleProfiles.fullMinimumDifficulty(session.config);
  const bound={};
  for(const side of controllerSides){
   const id=Object.hasOwn(policyIds,side)?policyIds[side]:undefined;
   if(roles[side]==='human'){
    if(id!==undefined)throw admissionError('FULL_AI_FOR_HUMAN');
    continue;
   }
   if(id===undefined&&minimum===null)continue;
   const policy=qualifiedControllers[side].get(id);
   if(!policy)throw admissionError(minimum===null?'FULL_AI_NOT_QUALIFIED':'FULL_AI_MINIMUM_UNAVAILABLE');
   if(!meetsMinimum(policy.difficulty,minimum))throw admissionError('FULL_AI_BELOW_MINIMUM');
   bound[side]=policy;
  }
  return Object.freeze(bound);
 }
 function prepareControllers(session,selection,ui,policyIds={},seed,draft,mapPresentation=false){
  if(session.ruleProfileId!=='FULL_CATALOG_v1' || !exact(selection,['player','enemy']) ||
      !controllerSides.every(side=>['ai','human'].includes(selection[side])))throw admissionError('FULL_CONTROLLERS_INVALID');
  if(Object.values(selection).includes('ai'))ScenarioRuleProfiles.requireAi(session);
  const roles=Object.freeze({...selection});
  const policies=bindQualifiedControllers(session,roles,policyIds);
  if(mapPresentation&&(roles.player!=='human'||roles.enemy!=='ai'))
   throw admissionError('FULL_MAP_CONTROLLER_INVALID');
  if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>0xffffffff))throw admissionError('FULL_SEED_INVALID');
  return ()=>{
   if(legacySession!==session||!active()||controlOwner())throw Error('FULL_CONTROLLER_OWNER');
   controller=createControllerPort(session,roles,ui,policies,seed,draft,mapPresentation);
   return controller.port;
  };
 }
 function enterControlledSide(){
  controlOwner()?.enterSide();
 }
 function allowsPlayerPhaseAdvance(){
  return controlOwner()?.advancingPhase()??true;
 }
 function advancePhase(){
  if(!active()||gameOver||!controllerSides.includes(phase))return;
  if(controlOwner()&&!controlOwner().advancingPhase())return;
  if(turnPhase==='movement'){setTurnPhase('fire');return}
  if(turnPhase==='fire'){setTurnPhase('gev');return}
  if(turnPhase!=='gev')return;
  const previous=phase;
  if(previous==='enemy'?enemyEnd():checkVictory())return;
  const boundary=previous==='enemy'?root.GoblinFullRoundSource?.beginBoundary():null;
  fireBoundary(previous,false);
  phase=previous==='player'?'enemy':'player';
  if(phase==='player')turn++;
  selected=null;
  clearPhaseCommands();
  recoverDisabled(phase);
  resetActionState();
  beginTurn(phase);
  setTurnPhase('movement');
  if(previous==='enemy')root.GoblinFullRoundSource?.complete(boundary,turn-1,'complete');
  controlOwner()?.enterSide();
 }
 function referenceCommand(){
  if(!active()||gameOver||!controllerSides.includes(phase))return null;
  const known=roster(phase),actors=known.filter(unit=>unit.team===phase&&unitAlive(unit)&&!unit.disabled);
  if(turnPhase==='fire'){
   for(const actor of actors){
    const shot=GoblinSpecialistsRuntime.enemyShots(actor).next().value;
    if(shot)return copy(shot.baseline);
   }
  }else if(turnPhase==='movement'||turnPhase==='gev'){
   for(const actor of actors){
    const secondary=turnPhase==='gev';
    if(!canMoveUnit(actor,secondary))continue;
    const target=known.filter(unit=>unit.team!==phase&&unitAlive(unit))
     .sort((left,right)=>dist(actor,left)-dist(actor,right))[0];
    const step=target&&findEnemyStep(actor,target,movementBudget(actor,secondary));
    if(!step)continue;
    const command={type:'Move',actorId:actor.id,x:step.x,y:step.y};
    if(moveQuery(command).ok)return command;
   }
  }
  return {type:'EndPhase'};
 }
 function createMissionJournal(session,seed,seats,draft){
  const entries=[], checkpoints=new WeakMap();
  const sources=copy(root.GoblinFullTrainingSources?.current()??null);
  const recordedSeats=copy(seats);
  let word=seed, draws=0, initial=null;
  const level={id:session.scenarioId,digest:session.effectiveRules.catalog.levelDigest};
  if(draft)level.draft=copy(draft);
  // The accepted branch owns the cursor for unit, component and area fire.
  function draw(){
   word=(word+0x6d2b79f5)>>>0;
   let mixed=Math.imul(word^(word>>>15),word|1);
   mixed^=mixed+Math.imul(mixed^(mixed>>>7),mixed|61);
   draws++;
   return ((mixed^(mixed>>>14))>>>0)/4294967296;
  }
  function digest(){
   const s=ensure();
   const visibility={...s.visibility,lastEventId:undefined};
   const value=JSON.stringify([turn,phase,turnPhase,[...terrainTypes],
    units.map(({moveFrom,justHit,specialistJournal,...unit})=>unit),
    visibility,s.ownTurns,s.terminalOutcome,s.deadlineRemoved,
    s.waves&&{ownTurns:s.waves.ownTurns,waves:s.waves.waves},draws,word],(key,item)=>
     (key==='commandId'||key==='eventId')&&typeof item==='string'&&item.startsWith(session.sessionId+'/')
      ?item.slice(item.indexOf('/')+1):item);
   return hashText(value);
  }
  function hashText(value){
   let hash=2166136261;
   for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619);
   return (hash>>>0).toString(16).padStart(8,'0');
  }
  // Recording identity is separate from the neutral world/RNG prefix used by Strong.
  const context=JSON.stringify([session.ruleProfileId,seed,level,
   sources&&Object.keys(sources).sort().map(path=>[path,sources[path]]),recordedSeats]);
  function recording(){
   const boundInitial=hashText(JSON.stringify([context,initial]));
   let previous=boundInitial;
   const boundEntries=entries.map(entry=>{
    previous=hashText(JSON.stringify([context,previous,entry.side,entry.slot,entry.command,entry.draws,entry.digest]));
    return {...entry,digest:previous};
   });
   return {initial:boundInitial,entries:boundEntries};
  }
  return {
   draw,
   start(){initial=digest();},
   checkpoint(snapshot){checkpoints.set(snapshot,{length:entries.length,word,draws});},
   rewind(snapshot){
    const saved=checkpoints.get(snapshot);
    if(!saved)return;
    entries.length=saved.length;
    ({word,draws}=saved);
   },
   accept(side,slot,command,previousDraws){
    entries.push({side,slot,command:copy(command),draws:draws-previousDraws,digest:digest()});
   },
   exportBound:()=>!!sources,
   archive(){return gameOver&&initial&&sources?copy({version:'goblin-training-archive-v1',
    profile:session.ruleProfileId,seats:recordedSeats,outcome:terminalOutcome()==='draw'?'draw':terminalOutcome()===true?'player':'enemy',
    replay:{version:'full-native-journal-v1',sources,seed,level,...recording()}}):null;},
   prefix(){return initial?copy({version:'full-native-journal-v1',seed,level,initial,entries,digest:digest()}):null;},
   draws:()=>draws
  };
 }
 function createControllerPort(session,roles,ui,policies,seed,draft,mapPresentation){
  const binding=Object.freeze({roles,policyIds:Object.freeze(Object.fromEntries(
   Object.entries(policies).map(([side,policy])=>[side,policy.id])))});
  const reject=code=>({ok:false,code});
  const seats=Object.fromEntries(controllerSides.map(side=>[side,{controller:roles[side],
   ...(roles[side]==='ai'?{policy:policies[side]?.id??null,difficulty:policies[side]?.difficulty??null}:{})}]));
  const journal=seed===undefined?null:createMissionJournal(session,seed,seats,draft);
  const allowsSpectator=roles.player==='ai'&&roles.enemy==='ai';
  let ready=false,latestSpectator=null;
  let generation=0,sequence=0,paused=false,stopped=false,committing=false,advancingPhase=false,undoing=false;
  let seat,pending,permit,lastHumanSide;
  const owns=current=>current===session;
  const attached=()=>ready&&!presentationPending&&owns(legacySession)&&active()&&!stopped;
  const spectator=Object.freeze({read:()=>allowsSpectator&&attached()?latestSpectator:null});
  function publishSpectator(){
   if(!allowsSpectator||!attached())return;
   const freeze=value=>{
    if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
    return value;
   };
   latestSpectator=freeze({view:{side:'spectator',sessionId:session.sessionId,revision:sequence,
    turn,phase:turnPhase,activeSide:gameOver?null:phase,ended:gameOver,outcome:terminalOutcome(),
    terrain:boardTerrain(),units:boardUnits(units,null),objectiveRemaining:{
     player:publicObjectiveCount('player'),enemy:publicObjectiveCount('enemy')},objectives:{
     player:publicObjectives('player'),enemy:publicObjectives('enemy')}},
    log:formatLogEntries(ensure().logs,()=>true)});
  }
  function startPresentation(){
   ready=true;
   journal?.start();
   publishSpectator();
   enterSide();
  }
  const authorised=mode=>attached()&&!paused&&!gameOver&&roles[phase]===mode&&(mode==='ai'||seat===phase);
  function invalidate(){
   generation++;pending=null;seat=null;permit=null;
  }
  function enterSide(){
   invalidate();
   if(!attached()||paused||gameOver||roles[phase]!=='human')return;
   const handoff=Object.freeze({sessionId:session.sessionId,generation,side:phase});
   pending=handoff;
   ui?.handoff?.(handoff,()=>{
    if(!attached()||paused||gameOver||pending!==handoff||phase!==handoff.side)return false;
    pending=null;seat=phase;lastHumanSide=phase;
    return true;
   });
  }
  function state(){
   return attached() ? Object.freeze({sessionId:session.sessionId,generation,side:gameOver?null:phase,
    profileId:session.ruleProfileId,levelDigest:session.effectiveRules.catalog.levelDigest,
    phase:turnPhase,controller:roles[phase]??null,ended:gameOver,outcome:terminalOutcome(),paused,pending,
    slot:turnPhase,
    humanReady:authorised('human'),
    ...(policies[phase]?{policyId:policies[phase].id,
      ...(policies[phase].difficulty!==null?{difficulty:policies[phase].difficulty}:{})}:{})}) : null;
  }
  function project(mode){
   if(mode==='spectator')return spectator.read();
   if(mode==='human'&&attached()&&gameOver&&!paused&&lastHumanSide){
    return {view:{...sideProjection(lastHumanSide),activeSide:null,ended:true,outcome:terminalOutcome()},
     log:logEntries(true,lastHumanSide,true)};
   }
   if(!authorised(mode))return null;
   return {view:mode==='ai'&&(policies[phase]?.difficulty!=null||policies[phase]?.experiment)?tacticalProjection(phase):sideProjection(phase),
    ...(mode==='human'?{log:logEntries(true,phase,true)}:{})};
  }
  function ticket(mode){
   if(!authorised(mode)||committing)return null;
   const revision=commandRevision();
   if(permit?.revision!==revision){
    permit=Object.freeze({sessionId:session.sessionId,generation,revision,side:phase,
     phase:turnPhase,slot:sequence,actorId:null});
   }
   return permit;
  }
  function open(mode){
   const token=ticket(mode);
   if(!token)return null;
   return {permit:token,pass:turnPhase,entries:null};
  }
  function valid(token,mode){
   return !!token&&token===permit&&authorised(mode)&&!committing&&token.generation===generation&&
    token.side===phase&&token.phase===turnPhase&&token.revision===commandRevision();
  }
  function commit(mode,token,command,playerDispatch,evidence){
   const previousDraws=journal?.draws();
   const side=phase,slot=turnPhase;
   const result=executeCommit(mode,token,command,playerDispatch,evidence);
   if(result.ok)journal?.accept(side,slot,command,previousDraws);
   return result;
  }
  function executeCommit(mode,token,command,playerDispatch,evidence){
   if(!valid(token,mode))return reject('FULL_CONTROL_STALE');
   committing=true;
   try{
    roundSelection=mode==='ai'&&evidence?{command,evidence}:null;
    if(exact(command,['type'])&&command.type==='EndPhase'){
     permit=null;
     advancingPhase=true;
     recordRoundSelection(phase,'phase');
     advancePhase();
     sequence++;
     publishSpectator();
     return {ok:true};
    }
    const actor=units.find(unit=>unit.id===command?.actorId);
    if(!actor||actor.team!==phase||!playerDispatch)return reject('FULL_CONTROL_ACTOR');
    const result=playerDispatch(command,token.revision);
    if(result.ok){sequence++;permit=null;publishSpectator();}
    return result;
   }finally{roundSelection=null;advancingPhase=false;committing=false;}
  }
  const port=Object.freeze({state,project,ticket,open,commit,
   controlBinding:()=>attached()?binding:null,
   canUndo:()=>authorised('human')&&phaseCommands.length>0,
   undo(token){
    if(!valid(token,'human')||!port.canUndo())return false;
    undoing=true;
    try{undoPhaseCommand();permit=null;return true;}
    finally{undoing=false;}
   },
   trainingArchive:()=>attached()?journal?.archive()??null:null,
   canExportTraining:()=>attached()&&gameOver&&!!journal?.exportBound(),
   simulationSnapshot(token){
    if(!valid(token,'ai')||!journal)return null;
    return copy({config:session.config,replay:journal.prefix(),
      draft:journal.prefix()?.level.draft??ScenarioRuleProfiles.migrationDraft?.(session.scenarioId)??null,
      turn,phase,turnPhase,gameOver,side:phase});
   },
   qualifiedSelector(capture){
    const policy=authorised('ai')?policies[phase]:null;
    if(!policy)return null;
    if(policy.experiment)return (batch,report)=>policy.select(batch,
     ()=>qualifiedControllers[batch.side].get(batch.side+'-medium').select(batch,report),port,report,capture);
    return policy.difficulty===null||policy.difficulty==='strong'
     ?(batch,report)=>policy.select(batch,port,report,capture):policy.select;
   },
   spectator:()=>allowsSpectator&&attached()?spectator:null,
   pause(){if(attached()){paused=true;invalidate();}},
   resume(){if(attached()&&paused){paused=false;enterSide();}},
   leave(){stopped=true;invalidate();latestSpectator=null;}});
  return {owns,port,journal,mapPresentation,startPresentation,enterSide,committing:()=>committing,
   advancingPhase:()=>advancingPhase,undoing:()=>undoing};
 }
 function fireView(binding){const out=copy(binding);if(out?.state)delete out.state.mainTargets;return out}
 function viewerUnit(u){const {specialistJournal,specialistSerial,...publicUnit}=u,out=copy(publicUnit);if(out.catalogFire)out.catalogFire=fireView(out.catalogFire);if(out.spotterId&&!known(out.spotterId))out.spotterId=null;return out}
 function event(type,fields={},clocks=null){const s=ensure();if(!s)return;const seq=s.visibility.sequence+1,result=GoblinCatalogVisibility.reduce(s.visibility,{type,id:`full-${s.sessionId}-${seq}`,seq,...fields},facts(clocks??s.visibility.teamFire),registry());s.visibility=result.state;return result}
 function fireBoundary(team,start){const s=ensure();if(!s)return;const clocks=copy(s.visibility.teamFire);if(clocks[team].active===start)return;clocks[team].active=start;if(!start)clocks[team].completed++;event(start?'fire-start':'fire-end',{team},clocks)}
 function reveal(subjectId,reason,result=null){if(active())event('reveal',{subjectId,reason,result})}
 function refresh(){if(!active())return;event('refresh');if(selected&&!known(selected.id))selected=null}
 function log(key,params={},subjects=[],audience=null){if(active())ensure().logs.push({key,params:copy(params),subjects:[...subjects],
  ...(audience&&controllerPort()?{audience}:{})})}
 function status(){if(!active())return null;const s=ensure();return {pendingEnemy:pendingEnemy(),enemyTurns:s.visibility.teamFire.enemy.completed,turnLimit:turnLimit(s),remainingObjectives:publicObjectiveCount('player')}}
 function stealthText(u){if(!active()||!registry().units[u.catalogAssetId]?.target.stealthRef)return '';const t=(key,params={})=>root.GoblinLanguage?.t(key,params)??key,parts=[t('v2.full.stealth.capability'),t('v2.full.stealth.sensorRule',{range:2}),t('v2.full.stealth.movementRule'),t('v2.full.stealth.eventRule')];if(u.team==='enemy'&&unitAlive(u)&&known(u.id)){const s=ensure();parts.push(t(s.visibility.reveals.some(r=>r.runtimeUnitId===u.id&&r.viewerTeam==='player'&&r.untilFireEnd>s.visibility.teamFire.player.completed)?'v2.full.stealth.eventExpiry':'v2.full.stealth.sensorContact'))}return parts.join(' · ')}
 function logEntries(all=false,team='player',onlyKnown=false){
  if(!active())return [];
  const visible=entry=>(!entry.audience||entry.audience===team)&&entry.subjects.every(id=>known(id,team));
  const logs=ensure().logs;
  const scoped=onlyKnown?logs.filter(visible):logs;
  const rows=all?scoped:scoped.slice(-4);
  return formatLogEntries(rows,visible,team);
 }
 // UI effects stay out of the command history and replay snapshots.
 const actionFeedback = new WeakMap();
 function combatEffect(target,outcome){
  if(!target||!outcome||outcome.result==='NE')return 'v2.feedback.noEffect';
  if(unitDead(target))return 'v2.feedback.destroyed';
  if(outcome.system)return outcome.loss>0?'v2.feedback.systemLoss':'v2.feedback.noEffect';
  return target.disabled?'v2.ui.disabled':'v2.feedback.damaged';
 }
 function formatLogEntries(rows,visible,team=null){
  const text=(key,params)=>root.GoblinLanguage?.t(key,params)??key;
  return rows.toReversed().map(entry=>{
   const disclosed=visible(entry),key=disclosed?entry.key:'v2.full.stealth.contactLost';
   let message=text(key,disclosed?entry.params:{});
   if(disclosed&&entry.action){
    message+=` · ${entry.subjects.map(id=>GoblinCatalogRuntime.name(units.find(u=>u.id===id))).join(' → ')}`;
    const feedback=actionFeedback.get(entry);
    const effect=feedback?.effect??{NE:'v2.feedback.noEffect',D:'v2.feedback.hit',X:'v2.feedback.heavyHit'}[entry.action.result];
    if(effect)message+=` · ${text(effect)}`;
    if(feedback?.hits){
     const hits=feedback.hits.filter(hit=>team===null||(hit.viewers.includes(team)&&known(hit.id,team)));
     const effects=hits.map(hit=>`${GoblinCatalogRuntime.name(units.find(u=>u.id===hit.id))}: ${text(hit.effect)}`);
     message+=` · ${effects.join(' · ')||text('v2.feedback.noVisibleEffect')}`;
    }
   }
   return {time:'',source:'COMMAND',message};
  });
 }
 function recordAction(actor,command,result){if(!active())return;const key=result.kind==='hex-fire'?'v2.full.missile.resolved':result.kind==='collision'||result.collided?'v2.full.stealth.collision':result.kind==='engineering'?`v2.engineer.${command.job}`:result.kind==='fire'?'v2.ui.fire':result.kind==='ram'?'v2.ui.ram':['CatalogLoad','Embark'].includes(command.type)?'v2.ui.embark':command.type==='Unload'?'v2.ui.unload':command.type==='CatalogDeploy'?'v2.ui.catalog.deployDrone':'v2.ui.move';log(key,{},result.kind==='fire'?[actor.id,command.target.runtimeUnitId]:[actor.id]);
  const row=ensure().logs.at(-1);
  row.action={result:result.outcome?.result??null,ratio:result.outcome?.ratio??null};
  if(result.kind==='fire'){
   const target=units.find(u=>u.id===command.target.runtimeUnitId);
   actionFeedback.set(row,{effect:combatEffect(target,result.outcome)});
  }
  if(result.kind==='hex-fire'){
   const hits=result.outcomes.flatMap(hit=>{
    const target=units.find(u=>u.id===hit.unitId);
    const effect=combatEffect(target,hit.outcome);
    if(effect==='v2.feedback.noEffect')return [];
    return [{id:hit.unitId,effect,viewers:controllerSides.filter(side=>known(hit.unitId,side))}];
   });
   actionFeedback.set(row,{hits});
  }
 }
 const roundEntity=u=>({id:u.id,labelKey:`library.unit.${u.catalogAssetId}.name`,cell:{x:u.x,y:u.y}});
 function recordRoundSelection(side,kind,actor){
  if(!roundSelection)return;
  const {explanationKey}=roundSelection.evidence;
  roundSelection=null;
  // These native commands have no existing action row. Their private reason
  // must precede the next slot or round boundary.
  root.GoblinFullRoundSource?.recordPrivate?.({side,kind,actor:actor&&roundEntity(actor),explanationKey});
 }
 function acceptedSelection(actor,command,kind){
  if(!roundSelection)return;
  const {command:chosen,evidence}=roundSelection;
  if((chosen.type==='Unload'?chosen.cargoId:chosen.actorId)!==actor.id)return;
  const abbreviated=(chosen.type==='EnemyMove'&&kind==='move'&&!command.type) ||
   (['Embark','Unload'].includes(chosen.type)&&command.type===chosen.type&&Object.keys(command).length===1);
  if(!abbreviated&&JSON.stringify(chosen)!==JSON.stringify(command))return;
  roundSelection=null;
  return evidence;
 }
 function recordRoundAction(actor,command,result){
  const source=root.GoblinFullRoundSource;
  if(!source||!active()||legacySession.ruleProfileId!=='FULL_CATALOG_v1'||gameOver)return;
  const entity=roundEntity;
  const targetId=command.target?.runtimeUnitId??result.targetId??result.cargoId;
  const target=units.find(unit=>unit.id===targetId);
  const kind=['move','collision'].includes(result.kind)?'move':['fire','hex-fire'].includes(result.kind)?'fire':result.kind==='ram'?'ram':'special';
  const evidence=acceptedSelection(actor,command,kind);
  const optionUnits=evidence?.options.length ? new Map(units.map(unit=>[unit.id,unit])) : null;
  const fireTarget=c=>units.find(unit=>unit.id===c.target?.runtimeUnitId);
  const fireCell=c=>c.type==='CatalogHexFire'?{x:c.x,y:c.y}:null;
  const options=optionUnits ? evidence.options.map(({candidate,selected,baseline,scores})=>{
   const target=candidate.target;
   const unit=optionUnits.get(target?.unitId);
   const firingUnit=optionUnits.get(candidate.actorId);
   const spotter=optionUnits.get(candidate.facts.spotterId);
   return {kind:'fire',actor:firingUnit&&entity(firingUnit),target:unit&&entity(unit),
    targetCell:target?.kind==='cell'?{x:target.x,y:target.y}:null,component:target?.componentId,
    weaponRef:candidate.weaponRef,mode:candidate.facts.mode,spotter:spotter&&entity(spotter),
    selected,baseline,scores};
  }) : roundFireChoice?.checked.map(entry=>{
   const unit=fireTarget(entry.command);
   return {kind:'fire',target:unit&&entity(unit),targetCell:fireCell(entry.command),
    component:entry.command.target?.componentId,selected:entry===roundFireChoice.selected,baseline:entry.baseline};
  });
  const hits=result.outcomes?.flatMap(hit=>{
   const unit=units.find(item=>item.id===hit.unitId);
   return unit?[{target:entity(unit),result:hit.outcome.result,effect:combatEffect(unit,hit.outcome)}]:[];
  });
  const board={width:W,height:H,defaultTerrain:'open-ground',terrain:[...terrainTypes].map(([key,type])=>{
   const [x,y]=key.split(',').map(Number);return {x,y,type};
  }),units:units.filter(unit=>unitAlive(unit)&&!unit.embarkedOn).map(entity)};
  // Accepted prefixes attest own movement. A final reveal does not attest
  // visibility of any intermediate enemy step.
  const path=result.acceptedPrefix??result.path;
  const paths=path?.length&&actor.moveFrom?[{id:actor.id,cells:[actor.moveFrom,...path]}]:[];
  const frames=Object.fromEntries(['player','enemy'].map(side=>{
   const visibleIds=projectedIds(side);
   return [side,{...board,units:units.filter(unit=>visibleIds.has(unit.id)&&!unit.embarkedOn).map(entity)}];
  }));
  source.record({side:actor.team,kind,actor:entity(actor),target:target&&entity(target),
   result:result.outcome?.result,effect:result.outcome&&target?combatEffect(target,result.outcome):undefined,
   targetCell:fireCell(command),hits,options,
   explanationKey:evidence?.explanationKey??roundFireChoice?.reason,snapshot:{...board,paths}},frames);
 }
 function catalogCard(entry){
  if(!active())return null;const r=registry().units[root.UnitVisuals.artKey(entry)];if(!r)return null;const t=r.target,system=t.systemDefinitionRef?GoblinSystems.createCatalogSystem(registry(),r.assetId??root.UnitVisuals.artKey(entry)):null;
  const values=system?system.rules.definition.components.filter(c=>c.kind==='weapon').map(c=>system.rules.weaponClasses[c.weaponClassRef]):[];
  const range=system?Math.max(0,...values.map(w=>w.range)):t.range,attack=system?Math.max(0,...values.map(w=>w.attack)):t.strengthRef?2:t.attack;
  return {hp:system?`${system.treads}/${system.maxTreads}`:String(t.strengthRef?2:t.hp),move:t.movement.join(system?' / ':' + '),gevPhaseEligible:t.gevPhaseEligible===true,secondaryMove:t.gevPhaseEligible===true?t.movement[1]:0,range:String(range),attack:String(attack),defense:system?(root.GoblinLanguage?.t('v2.ui.bySystem')??'SYSTEMS'):String(t.strengthRef?2:t.defense),copy:t.stealthRef?(root.GoblinLanguage?.t('v2.full.stealth.sensorRule',{range:2})??''):t.missileRuleRef?(root.GoblinLanguage?.t('v2.full.missile.ammoRule')??''):root.GoblinLanguage?.translate(entry.role)??entry.role,system:!!system};
 }
 function initialRoster(config){
  if(config?.ruleProfileId!==root.GoblinCatalogFullModel?.profile)return config.units;
  const data=config.catalog.registry,teamFire={player:{completed:0,active:false},enemy:{completed:0,active:false}},actors=config.units.map(u=>({runtimeUnitId:u.id,assetId:u.catalogAssetId,team:u.team,alive:unitAlive(u),disabled:false,embarkedOn:u.embarkedOn??null,x:u.x,y:u.y}));
  const bindings=actors.filter(a=>data.units[a.assetId].target.stealthRef).map(a=>({runtimeUnitId:a.runtimeUnitId,assetId:a.assetId,team:a.team,stealthRef:'phantom-stealth-v1'})).sort((a,b)=>a.runtimeUnitId<b.runtimeUnitId?-1:1),terrainMap=new Map(config.terrainTypes.map(c=>[`${c.x},${c.y}`,c.type]));
  const sensorPairs=[];for(const b of bindings){const target=actors.find(a=>a.runtimeUnitId===b.runtimeUnitId);for(const observer of actors.filter(a=>a.alive&&!a.disabled&&!a.embarkedOn&&a.team!==target.team))sensorPairs.push({observerId:observer.runtimeUnitId,targetId:target.runtimeUnitId,distance:dist(observer,target),hasLineOfSight:GoblinHexSupercover.intermediateHexes(observer,target).every(c=>!TerrainRules.blocksLos(terrainMap.get(`${c.x},${c.y}`)??'open-ground'))})}
  const facts={revision:`initial/${config.catalog.levelDigest}`,map:{width:config.width??12,height:config.height??8},actors,sensorPairs,teamFire},visibility=GoblinCatalogVisibility.create(data,bindings,facts),known=new Set(GoblinCatalogVisibility.project(visibility,'player',facts,data).knownIds);
  return config.units.filter(u=>known.has(u.id));
 }
 function fail(code){const key=code==='HEX_RANGE'?'v2.reject.range':code==='HEX_SIGHT'?'v2.reject.sight':code==='HEX_AMMO_SPENT'?'v2.reject.spent':code.startsWith('INVALID_')?'ui.error.INVALID_COMMAND':'v2.reject.unavailable';return {ok:false,code,reason:root.GoblinLanguage?.t(key)??key}}
 const exact=(c,keys)=>c&&Object.keys(c).length===keys.length&&keys.every(k=>Object.hasOwn(c,k));
 function hexQuery(command,allowEnemy=false){
  if(!active()||!exact(command,['type','actorId','x','y'])||command.type!=='CatalogHexFire')return fail('INVALID_HEX_FIRE');
  const actor=units.find(u=>u.id===command.actorId),{x,y}=command;
  if(!actor||actor.catalogId!=='U13'||!unitAlive(actor)||actor.disabled||actor.embarkedOn||gameOver||actor.team!==phase||turnPhase!=='fire')return fail('HEX_ACTOR_UNAVAILABLE');
  if(actor.fired||actor.ammunition!==1)return fail('HEX_AMMO_SPENT');
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=W||y>=H)return fail('HEX_TARGET_UNAVAILABLE');
  if(dist(actor,{x,y})>8)return fail('HEX_RANGE');if(!lineOfSight(actor,{x,y}))return fail('HEX_SIGHT');
  const footprint=[{x,y},...hexNeighbors(x,y).filter(c=>c.x>=0&&c.y>=0&&c.x<W&&c.y<H).sort((a,b)=>a.y-b.y||a.x-b.x)];
  return {ok:true,actor,footprint,friendlies:units.filter(u=>unitAlive(u)&&!u.embarkedOn&&u.team===actor.team&&footprint.some(c=>c.x===u.x&&c.y===u.y)).map(u=>({id:u.id,name:u.name})),weapon:{attack:6,range:8}};
 }
 function hexTacticalFacts(q){
  const visible=roster(q.actor.team).filter(u=>unitAlive(u)&&!u.embarkedOn);
  const hits=q.footprint.flatMap((cell,i)=>visible.filter(u=>u.x===cell.x&&u.y===cell.y).map(u=>{
   const attack=i===0?6:3;
   const component=u.catalogSystems?GoblinSystems.catalogChooseTarget(u.catalogSystems,GoblinSpecialistsRuntime.registry()):null;
   return {unitId:u.id,attack,...GoblinSpecialistsRuntime.fireEffect(u,attack,component)};
  }));
  return {expendable:true,hits};
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
  refresh();selected=actor.team===phase&&unitAlive(actor)?actor:null;
  // No terminal check or phase advance occurs inside the frozen victim sequence.
  ended=checkVictory();
  }finally{root.GoblinLegacyPresentation?.endHex(capture)}
  updateSelection();draw();if(!ended&&actor.team==='player')maybeAutoAdvancePhase();return {ok:true};
 }
 function hasHexAction(actor){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(hexQuery({type:'CatalogHexFire',actorId:actor.id,x,y},actor.team==='enemy').ok)return true;return false}
 function fireChoices({baseline,commands,preview,apply},tactics=false){
  const byKey=new Map(commands().map(c=>[JSON.stringify(c),c]));
  const baselineKey=JSON.stringify(baseline);
  const checked=[...byKey.values()].flatMap(c=>{const q=preview(c,tactics);return q.ok?[{command:c,
   facts:{attack:q.attack,range:q.range,ratioCategory:q.ratioCategory,effectKind:q.effectKind,
    ...(tactics?{expendable:q.expendable,...(q.hits?{hits:q.hits}:{})}:{}),
    ...(Object.hasOwn(q,'objectiveTarget')?{objectiveTarget:q.objectiveTarget,disabledTarget:q.disabledTarget}:{})},
   baseline:JSON.stringify(c)===baselineKey}]:[]});
  if(!checked.some(entry=>entry.baseline))throw Error('FULL_ENEMY_BASELINE_MISSING');
  function applyChoice(entry,reason) {
   const previous=roundFireChoice;
   roundFireChoice={checked,selected:entry,reason};
   try{return apply(entry.command)}finally{roundFireChoice=previous}
  }
  return {checked,applyChoice,preview};
 }
 // The synchronous compatibility callback can replace only its current shot.
 function chooseEnemyFire(actor,pass,baseline,commands,preview,apply,choose){
  const owner=legacySession,initialRevision=commandRevision();
  const current=()=>active()&&owner===legacySession&&phase==='enemy'&&turnPhase==='enemy'&&!gameOver;
  const {checked,applyChoice}=fireChoices({baseline,commands,preview,apply});
  let open=true,spent=false,failed=false,engineError;
  const reject=code=>({ok:false,code});
  function execute(command){
   if(!open||!current())return reject('ENEMY_FIRE_SLOT_CLOSED');
   if(spent)return reject('ENEMY_FIRE_SLOT_SPENT');
   if(commandRevision()!==initialRevision)return reject('ENEMY_FIRE_STATE_CHANGED');
   const allowed=checked.find(entry=>JSON.stringify(entry.command)===JSON.stringify(command));
   if(!allowed)return reject('ENEMY_FIRE_CHOICE_UNAVAILABLE');
   try{
    const q=preview(allowed.command);
    if(!q.ok)return q;
    spent=true;
    return applyChoice(allowed);
   }catch(error){failed=true;engineError=error;open=false;throw error}
  }
  try{choose(Object.freeze({actorId:actor.id,pass,entries:()=>open&&current()&&!spent&&commandRevision()===initialRevision
   ?copy(checked):[],execute}));}
  catch(error){if(!failed)console.error('FULL enemy fire choice failed',actor.id,error)}
  finally{open=false}
  if(failed)throw engineError;
  if(spent)return true;
  if(!current())return null;
  if(commandRevision()!==initialRevision)throw Error('FULL_ENEMY_FIRE_STATE_CHANGED');
  applyChoice(checked.find(entry=>entry.baseline),'v2.round.baselineFire');
  return true;
 }
 function enemyHexShot(actor){
  const targets=roster(actor.team).filter(u=>unitAlive(u)&&!u.embarkedOn&&u.team!==actor.team).sort((a,b)=>dist(actor,a)-dist(actor,b)||(a.id<b.id?-1:1));
  for(const t of targets){
   const c={type:'CatalogHexFire',actorId:actor.id,x:t.x,y:t.y};
   if(!hexQuery(c,true).ok)continue;
   return {baseline:c,commands:()=>{
    const cells=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)cells.push({type:'CatalogHexFire',actorId:actor.id,x,y});
    return cells;
   },preview:(command,tactics)=>{const q=hexQuery(command,true);return q.ok?{ok:true,attack:q.weapon.attack,range:q.weapon.range,
    ratioCategory:null,effectKind:'area',...(tactics?hexTacticalFacts(q):{})}:q},
   apply:command=>executeHex(command,true)};
  }
 }
 function enemyHex(actor,choose,pass){
  const shot=enemyHexShot(actor);
  if(!shot)return false;
  const {baseline,commands,preview,apply}=shot;
  if(typeof choose==='function')return chooseEnemyFire(actor,pass,baseline,commands,preview,apply,choose)===true;
  apply(baseline);
  return true;
 }
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
  root.GoblinLevelEvents?.move(actor.id,result.acceptedPrefix);
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
   for(const effect of result.effects)log(effect.type==='SpawnWave'?'v2.full.wave.arrived':effect.type==='WaveFailed'?'v2.full.wave.failed':'v2.full.wave.retry',{attempt:effect.attempt,maxAttempts:3},[],team);
  }
  s.ownTurns[team]=ownTurn;refresh();
 }
 function pendingEnemy(){return active()&&ensure().waves?GoblinCatalogWaves.pendingEnemy(ensure().waves):0}
 function terminalOutcome(){return active()?ensure().terminalOutcome:null}
 function enemyBegin(){if(!active())return;fireBoundary('player',false);beginTurn('enemy');fireBoundary('enemy',true)}
 function enemyEnd(){if(!active())return false;fireBoundary('enemy',false);if(checkVictory())return true;const s=ensure(),limit=turnLimit(s);if(limit!==null&&s.ownTurns.enemy>=limit){finish(false);return true}return false}
 function validateRoster(ids){
  const config=legacySession.config,initial=config.units.map(u=>u.id),templates=config.catalog.full.waveTemplates.map(u=>u.id);
  if(initial.some(id=>!ids.has(id))||[...ids].some(id=>!initial.includes(id)&&!templates.includes(id)))throw Error('FULL_RESTORE_ROSTER');
  for(const u of units){const source=[...config.units,...config.catalog.full.waveTemplates].find(v=>v.id===u.id),rules=config.catalog.records[u.id].rules;if(u.team!==source.team||u.catalogId!==source.catalogId||u.catalogAssetId!==source.catalogAssetId)throw Error('FULL_RESTORE_OWNER');if(!u.catalogSystems&&(!Number.isInteger(u.hp)||u.hp<0||u.hp>source.maxHp||u.maxHp!==source.maxHp||u.range!==source.range||u.move!==source.move||u.damage!==(rules.strengthRef?u.hp:source.damage)||u.defense!==(rules.strengthRef?u.hp:source.defense)))throw Error('FULL_RESTORE_VALUES');if(rules.missileRuleRef&&![0,1].includes(u.ammunition))throw Error('FULL_RESTORE_AMMO')}
  const waves=ensure().waves;if(waves){GoblinCatalogWaves.validate(waves,config.catalog.full.waves);for(const row of waves.waves)if(ids.has(config.catalog.full.waves.waves.find(w=>w.id===row.id).templateId)!==(row.status==='spawned'))throw Error('FULL_RESTORE_SPAWN')}
  return true;
 }
 function restore(value){
  if(!active()){if(value!==null)throw Error('FULL_RESTORE_PROFILE');return}
  const full=legacySession.effectiveRules.catalog.full;
  const fields=['version','sessionId','visibility','waves','ownTurns','terminalOutcome','journal','logs'];
  if(full.deadlineEvent)fields.push('deadlineRemoved');
  if(!exact(value,fields)||value.version!=='catalog-full-runtime-v1'||value.sessionId!==legacySession.sessionId)throw Error('FULL_RESTORE_SESSION');
  if(!exact(value.ownTurns,['player','enemy'])||!['player','enemy'].every(team=>Number.isInteger(value.ownTurns[team])&&value.ownTurns[team]>=0)||!(legacySession.effectiveRules.objective==='eliminate-opponent'?[null,true,false,'draw']:[null,true,false]).includes(value.terminalOutcome)||!Array.isArray(value.journal)||!Array.isArray(value.logs))throw Error('FULL_RESTORE_STATE');
  GoblinCatalogVisibility.validate(value.visibility,facts(value.visibility.teamFire),registry());
  if(full.deadlineEvent && value.deadlineRemoved !== !coreAlive())throw Error('FULL_RESTORE_DEADLINE');
  const config=full.waves;
  if(config.waves.length){GoblinCatalogWaves.validate(value.waves,config);if(JSON.stringify(value.ownTurns)!==JSON.stringify(value.waves.ownTurns))throw Error('FULL_RESTORE_TURNS')}else if(value.waves!==null)throw Error('FULL_RESTORE_WAVES');
  const previousLogs=state?.sessionId===value.sessionId?state.logs:null;
  state=copy(value);
  for(const [index,row] of state.logs.entries()){
   const previous=previousLogs?.[index];
   if(!previous||JSON.stringify(previous)!==JSON.stringify(row))break;
   const feedback=actionFeedback.get(previous);
   if(feedback)actionFeedback.set(row,feedback);
  }
 }
 root.GoblinCatalogFullRuntime=Object.freeze({active,known,roster,
  missionRandom:()=>controlOwner()?.journal?.draw(),
  hasMissionRandom:()=>!!controlOwner()?.journal,
  checkpointMission:snapshot=>controlOwner()?.journal?.checkpoint(snapshot),
  rewindMission:snapshot=>controlOwner()?.journal?.rewind(snapshot),
  aiProjection,readyUnits,viewerUnit,fireView,ensure,facts,revision,commandRevision,event,fireBoundary,reveal,refresh,snapshot,restore,validateRoster,hexQuery,executeHex,hasHexAction,enemyHex,chooseEnemyFire,enemyStep,moveQuery,executeMove,ramCollision,beginTurn,pendingEnemy,terminalOutcome,enemyBegin,enemyEnd,log,logEntries,recordAction,recordRoundAction,catalogCard,initialRoster,status,stealthText,deadlineRemoved,
  enemyHexShot,prepareControllers,controllerPort,mapPort,nativeCommitActive:()=>!!controlOwner()?.committing(),
  nativeUndoActive:()=>!!controlOwner()?.undoing(),enterControlledSide,allowsPlayerPhaseAdvance,
  ownsPresentation,stageControlledPresentation,startControlledPresentation,controllerOffers,controllerCapabilities,registerQualifiedController,advancePhase,referenceCommand,
  hexTacticalFacts,nativePlayerGateway,observedCells});
 const oldCheckVictory=checkVictory;
 checkVictory=function(){
  // Native combat reaches this boundary after applying damage and before finishing the mission.
  applyDeadlineEvent();
  return oldCheckVictory();
 };
 const oldSetPhase=setTurnPhase;setTurnPhase=function(next){if(active()&&controllerSides.includes(phase)){if(turnPhase==='fire'&&next!=='fire')fireBoundary(phase,false);if(next==='fire'&&turnPhase!=='fire')fireBoundary(phase,true)}return oldSetPhase(next)};
 const oldFinish=finish;finish=function(win){
  const roundCommit=!gameOver&&root.GoblinFullRoundSource?.beginBoundary();
  if(active()&&!gameOver){
   const s=ensure();s.terminalOutcome=win;
   for(const team of controllerSides)if(s.visibility.teamFire[team].active)fireBoundary(team,false);
   let effects=[];
   if(s.waves){const result=GoblinCatalogWaves.discardPending(s.waves);s.waves=result.state;effects=copy(result.effects)}
   s.journal.push({type:'mission-end',outcome:win,effects});
  }
  const result=oldFinish(win);root.GoblinFullRoundSource?.complete(roundCommit,turn,'terminal-partial');return result;
 };
 const oldHex=handleHex;handleHex=function(x,y){if(!active())return oldHex(x,y);focusedCell={x,y};const occupant=roster().find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y);if(!occupant&&selected?.team==='player'&&['movement','gev'].includes(turnPhase))return executeSpecialistCommand({type:'Move',actorId:selected.id,x,y});if(occupant)return handleUnitClick(occupant);showFieldInfo(x,y);draw()};
})(globalThis);
