// Observes the existing Legacy command/phase/history path. The Director owns no World.
(function(root){
 const copy=x=>JSON.parse(JSON.stringify(x));
 let session=null,serial=0,depth=0,rootWork=null,deferredAuto=false,advisoryEnabled=true;
 function active(){return !!session&&session.scenarioId===currentScenario&&!root.IronDustBrowserV2?.active}
 function worldKey(){const facts=JSON.stringify({units:units.map(({moveFrom,justHit,lastOutcome,...u})=>u),terrain:[...terrain],terrainTypes:[...terrainTypes],turn,phase,turnPhase,gameOver});if(!session.stateKeys.has(facts))session.stateKeys.set(facts,session.binding.sessionId+':state:'+session.stateKeys.size);return session.stateKeys.get(facts)}
 function descriptor(){return {branchId:session.branch,revision:session.revision,stateKey:worldKey(),rngCursor:session.rng.cursor}}
 function phaseFact(){if(phase==='player'||phase==='enemy')session.lastTeam=phase;return {team:session.lastTeam,phase:turnPhase,turn}}
 function actors(){return Object.fromEntries(Object.entries(session.definition.actorTags).map(([tag,id])=>{const u=units.find(u=>u.id===id);return [tag,{id,x:u?.x??0,y:u?.y??0,alive:!!u&&unitAlive(u),disabled:!!u?.disabled,embarked:!!u?.embarkedOn,moveSpent:!!u?.moved,fireSpent:!!u?.fired}]}))}
 function remainingActors(){
  if(!session.progress||session.definition.mode!=='learning')return [];
  const required=new Set(),seen=new Set();
  function scan(c){if(!c)return;if(['acceptedAction','undoWitness'].includes(c.op)&&c.actorTag)required.add(c.actorTag);c.conditions?.forEach(scan);if(c.condition)scan(c.condition)}
  function visit(id){if(!id||seen.has(id))return;seen.add(id);const step=session.definition.steps.find(s=>s.id===id);scan(step.completeWhen);step.alternatives.forEach(a=>{scan(a.when);visit(a.next)});visit(step.next)}
  visit(session.progress.stepId);const facts=actors(),unavailable=[...required].filter(tag=>!facts[tag].alive);
  if(session.definition.onRestore&&session.progress.stepId==='undo'&&!phaseCommands.some(s=>s.trainingCheckpoint?.stepId===session.definition.onRestore.undoneStepId))unavailable.push(session.definition.onRestore.actorTag);
  return [...new Set(unavailable)];
 }
 function stable(){const a=actors(),h=descriptor(),d=session.definition;return {binding:copy(session.binding),receiptSequence:session.sequence,history:h,phase:phaseFact(),actors:a,
  regions:Object.fromEntries(d.regionRefs.map(ref=>[ref,Object.values(a).filter(u=>u.alive&&!u.embarked&&session.regions[ref].some(c=>c.x===u.x&&c.y===u.y)).map(u=>u.id)])),
  queries:copy(session.queries),uiIntent:copy(session.intent),undo:{available:!!phaseCommands.length,checkpointRef:phaseCommands.at(-1)?.trainingCheckpoint?.ref??null},
  terminalFacts:{playerAlive:units.some(u=>u.team==='player'&&unitAlive(u)),normalEnded:d.mode==='advisory'&&gameOver,normalOutcome:d.mode==='advisory'&&gameOver?victoryOutcome(victoryProfile(legacySession.effectiveRules),units):null,unavailableRequiredActorTags:remainingActors()},
  viewerProjection:{actorIds:Object.values(d.actorTags),regionRefs:[...d.regionRefs],parameterRefs:[...session.manifest.parameterRefs],controlRefs:[...session.manifest.controlRefs]}}}
 function publish(kind,accepted,command,events=[],ui=null,restore=null,before=null,rootId=null){
  const p=session.progress,b=before??{branchId:p.branchId,revision:p.historyRevision,stateKey:p.stateKey,rngCursor:p.rngCursor};
  if(kind!=='ui'&&accepted){session.revision++;session.queries=[];session.intent=null}
  session.sequence++;const h=descriptor();
  const receipt={binding:copy(session.binding),receiptId:session.binding.sessionId+':receipt:'+session.sequence,sequence:session.sequence,kind,accepted,rootCommandId:kind==='ui'||kind==='restore'?null:rootId??session.binding.sessionId+':root:'+ ++session.roots,
   branchBefore:b.branchId,branchAfter:h.branchId,historyRevisionBefore:b.revision,historyRevisionAfter:h.revision,stateKeyBefore:b.stateKey,stateKeyAfter:h.stateKey,rngCursorBefore:b.rngCursor,rngCursorAfter:h.rngCursor,command,events,ui,restore};
  const state=stable(),result=GoblinTrainingDirector.reduceDirector(session.definition,p,receipt,state);
  session.audit.push({receipt:copy(receipt),state:copy(state),rng:copy(session.rng),raw:copy(rootWork?.shots??[]),error:result.error??null});
  if(result.error)throw Error('TRAINING_RECEIPT_'+result.error.code);
  session.progress=result.progress;render();terminal();return receipt;
 }
 function terminal(){
  if(session.definition.mode!=='learning'||gameOver)return;
  if(!['lesson-failed','lesson-complete','abandoned'].includes(session.progress.status))return;
  gameOver=true;turnPhase='over';$('#end-turn').disabled=true;
  const id=session.binding.sessionId+':root:'+ ++session.roots;
  publish('phase',true,{type:'EndPhase'},[{type:'PhaseEntered',rootCommandId:id,...phaseFact()}],null,null,null,id);
 }
 function begin(id){
  session=null;const config=legacySession.config,t=root.GoblinTrainingModel?.has(id)?config.training:advisoryEnabled&&id==='iron-dust'?root.GoblinTrainingModel?.advisoryFor(config):null;if(!t)return;const d=t.definition;
  session={scenarioId:id,definition:d,manifest:t.manifest,regions:t.regions,binding:{...copy(d.binding),sessionId:'training-session:'+ ++serial},sequence:0,revision:0,branch:'branch:0',branches:0,roots:0,checkpoints:0,lastTeam:'player',queries:[],intent:null,progress:null,audit:[],checkpointAudit:{},lastShot:null,rng:{seed:t.seed,state:t.seed,draws:0,cursor:0}};
  session.rng={seed:t.seed??0,state:t.seed??0,draws:0,cursor:0};session.stateKeys=new Map();session.progress=GoblinTrainingDirector.createProgress(d,stable());render();
 }
 function checkpoint(snapshot){if(!active())return;const ref=session.binding.sessionId+':checkpoint:'+ ++session.checkpoints;const c={ref,progress:copy(session.progress),history:descriptor(),cursor:session.rng.cursor,rootId:rootWork?.id??null,stepId:session.progress.stepId,actorId:rootWork?.actorId??null,lastShot:copy(session.lastShot),queryDetails:copy(session.queryDetails??null)};snapshot.trainingCheckpoint=c;session.checkpointAudit[ref]={rootId:c.rootId,actorId:c.actorId,stepId:c.stepId,history:copy(c.history)}}
 function restore(snapshot,departed){
  if(!active())return;const c=snapshot.trainingCheckpoint,known=c&&session.checkpointAudit[c.ref];
  if(!c||!known||known.rootId!==c.rootId||known.actorId!==c.actorId)throw Error('TRAINING_CHECKPOINT_IDENTITY');
  session.progress=copy(c.progress);session.rng.cursor=c.cursor;session.revision=departed.revision;session.branch='branch:'+ ++session.branches;session.queries=[];session.intent=null;
  session.lastShot=copy(c.lastShot);session.queryDetails=copy(c.queryDetails);
  if(worldKey()!==c.history.stateKey)throw Error('TRAINING_RESTORED_WORLD');
  const actor=units.find(u=>u.id===c.actorId);
  publish('restore',true,null,[],null,{undoneRootCommandId:c.rootId,undoneStepId:c.stepId,actorId:c.actorId,branchBefore:departed.branchId,branchAfter:session.branch,checkpointRef:c.ref,checkpointBranchId:c.history.branchId,checkpointHistoryRevision:c.history.revision,expectedBeforeKey:c.history.stateKey,restoredAfterKey:worldKey(),restoredBudgetFacts:{moveSpent:!!actor.moved,fireSpent:!!actor.fired},restoredRollCursor:c.cursor},departed);
 }
 function wrapAction(fn,type){return function(...args){
  if(!active()||depth)return fn.apply(this,args);
  const actor=type==='Fire'?args[0]:selected,to=type==='Move'?{x:args[0],y:args[1]}:null;
  // A click selecting a unit is UI, not a rejected gameplay action.
  if(type==='Move'&&(!actor||units.some(u=>unitAlive(u)&&u.team==='player'&&!u.embarkedOn&&u.x===to.x&&u.y===to.y)))return fn.apply(this,args);
  const path=type==='Move'&&actor?findMovementPath(actor,to,movementBudget(actor,turnPhase==='gev'),actor):null;
  const before=descriptor(),a=actors(),id=session.binding.sessionId+':root:'+ ++session.roots;
  rootWork={id,actorId:actor?.id??null,shots:[]};depth++;
  let result,failed=false;try{result=fn.apply(this,args);return result}catch(error){failed=true;throw error}finally{
   depth--;const work=rootWork;
   try{if(!failed){let command={type:'Other'},events=[],accepted=before.stateKey!==worldKey();const after=actors(),tag=Object.keys(a).find(t=>a[t].id===actor?.id),shot=work.shots.find(s=>s.actorId===actor?.id&&Object.values(session.definition.actorTags).includes(s.targetId));
    if(shot&&tag&&a[tag].fireSpent===false&&after[tag].fireSpent){const tt=Object.keys(a).find(t=>a[t].id===shot.targetId);command={type:'Fire',actorId:actor.id,targetId:shot.targetId,weaponId:null};events=[{type:'ShotResolved',rootCommandId:id,actorId:actor.id,targetId:shot.targetId,weaponId:null,outcome:shot.outcome,fireSpentBefore:a[tag].fireSpent,fireSpentAfter:after[tag].fireSpent,targetBefore:{alive:a[tt].alive,disabled:a[tt].disabled},targetAfter:{alive:after[tt].alive,disabled:after[tt].disabled}}]}
    else if(type==='Move'&&tag&&path?.length&&after[tag].x===to.x&&after[tag].y===to.y&&(a[tag].x!==to.x||a[tag].y!==to.y)){command={type:'Move',actorId:actor.id,from:{x:a[tag].x,y:a[tag].y},to,acceptedPath:path.map(c=>({x:c.x,y:c.y})),cost:path.reduce((n,c)=>n+movementCost(actor,c.x+','+c.y),0)};events=[{type:'UnitMoved',rootCommandId:id,actorId:actor.id,from:command.from,to,moveSpentBefore:a[tag].moveSpent,moveSpentAfter:after[tag].moveSpent}]}
    publish('gameplay',accepted,command,events,null,null,before,id);
   }}finally{rootWork=null;if(deferredAuto){deferredAuto=false;maybeAutoAdvancePhase()}}
  }
 }}
 function wrapPhase(fn){return function(...args){if(!active()||depth)return fn.apply(this,args);const before=descriptor(),id=session.binding.sessionId+':root:'+ ++session.roots;depth++;let result;try{result=fn.apply(this,args)}finally{depth--}if(before.stateKey!==worldKey())publish('phase',true,{type:'EndPhase'},[{type:'PhaseEntered',rootCommandId:id,...phaseFact()}],null,null,before,id);return result}}
 const baseLoad=loadScenario;loadScenario=function(id){if(!scenarioCatalog[id])return baseLoad(id);const previous=session;session=null;try{const result=baseLoad(id);begin(id);return result}catch(error){session=previous;throw error}};
 const baseSnapshot=commandSnapshot;commandSnapshot=function(...args){const s=baseSnapshot(...args);checkpoint(s);return s};
 const baseUndo=undoPhaseCommand;undoPhaseCommand=function(){if(!active()||!phaseCommands.length||phase!=='player'||gameOver)return baseUndo();const snapshot=phaseCommands.at(-1),before=descriptor();const result=baseUndo();restore(snapshot,before);return result};
 handleHex=wrapAction(handleHex,'Move');attack=wrapAction(attack,'Fire');embark=wrapAction(embark,'Other');unloadAt=wrapAction(unloadAt,'Other');
 if(typeof executeSpecialistCommand==='function')executeSpecialistCommand=wrapAction(executeSpecialistCommand,'Other');
 setTurnPhase=wrapPhase(setTurnPhase);enemyTurn=wrapPhase(enemyTurn);
 const baseAuto=maybeAutoAdvancePhase;maybeAutoAdvancePhase=function(){if(active()){if(depth){deferredAuto=true;return}if(session.progress.holdAutoPhase){clearTimeout(autoPhaseTimer);autoPhaseTimer=null;return}}return baseAuto()};
 const baseConfirm=confirmPhaseAdvance;confirmPhaseAdvance=async function(action){
  if(!active()||session.definition.mode!=='learning'||session.progress.stepId!=='undo')return baseConfirm(action);
  if(GameDialogs.isOpen())return;const owner=session,previous=turnPhase,t=root.GoblinLanguage?.t;
  const accepted=await GameDialogs.confirm({id:'phase-end',title:t?.('training.undoMove',{back:'BACK'})??'BACK',message:t?.('training.undoUnavailable')??'BACK',acceptLabel:t?.('dialog.phaseAdvance.confirm.toFire')??'FIRE',cancelLabel:t?.('ui.dialog.cancel')??'Cancel'});
  if(accepted&&session===owner&&phase==='player'&&turnPhase===previous&&!gameOver)action();
 };
 const baseSchedule=scheduleGameTask;
 scheduleGameTask=function(action,delay){
  if(!active()||phase!=='enemy')return baseSchedule(action,delay);
  const owner=session,scheduledTurn=turn;let executed=false;
  const observed=function(){
   if(session!==owner||executed||phase!=='enemy'||turn!==scheduledTurn)return;executed=true;
   const before=descriptor(),id=session.binding.sessionId+':root:'+ ++session.roots;
   depth++;rootWork={id,actorId:null,shots:[]};try{action()}finally{depth--}
   try{
    const complete=phase==='player'&&turnPhase==='movement'&&units.filter(u=>u.team==='player').every(u=>!u.moved&&!u.fired&&!u.secondMoved);
    const events=complete?[{type:'PhaseEntered',rootCommandId:id,...phaseFact()},{type:'EnemyTurnCompleted',rootCommandId:id,nextTeam:'player',nextPhase:'movement',turn,budgetsReset:true}]:[];
    publish(complete||gameOver?'enemyTurnComplete':'gameplay',true,complete||gameOver?null:{type:'Other'},events,null,null,before,id);
   }finally{rootWork=null}
  };
  observed.toString=()=>action.toString();return baseSchedule(observed,delay);
 };
 const baseCombat=combatOutcome;combatOutcome=function(attacker,target){if(!active()||session.definition.mode!=='learning')return baseCombat(...arguments);const random=Math.random,r=session.rng,cursor=phaseRollCursor;Math.random=()=>{r.state^=r.state<<13;r.state^=r.state>>>17;r.state^=r.state<<5;r.state>>>=0;r.draws++;return r.state/4294967296};try{const outcome=baseCombat(...arguments);r.cursor+=phase==='player'?phaseRollCursor-cursor:1;const shot={actorId:attacker.id,targetId:target.id,outcome:outcome.result,roll:outcome.roll};rootWork?.shots.push(shot);session.lastShot=copy(shot);return outcome}finally{Math.random=random}};
 function ui(type,actorId=null,action=null){if(!active())return;const intent=session.intent,stepId=type==='cancelIntent'?intent?.stepId:session.progress.stepId;if(type==='cancelIntent'&&!intent)return;const fact={type,actorId,stepId,intentId:['preview','selectIntent','cancelIntent'].includes(type)?intent?.intentId??null:null,queryId:['preview','selectIntent','cancelIntent'].includes(type)?intent?.queryId??null:null,action};if(type==='cancelIntent')session.intent=null;publish('ui',true,null,[],fact)}
 function inspect(command,legal,preview){if(!active())return;const actor=units.find(u=>u.id===command.actorId),target=units.find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===command.x&&u.y===command.y);if(!actor||!Object.values(session.definition.actorTags).includes(actor.id))return;const h=descriptor();session.queries=[{queryId:'query',actorId:actor.id,targetId:target?.id??null,regionRef:null,historyRevision:h.revision,stateKey:h.stateKey,legal:!!legal.ok,losBlocked:!!target&&dist(actor,target)<=actor.range&&!lineOfSight(actor,target),previewAvailable:command.type==='Move'?!!legal.ok:!!preview,coverPresent:TerrainRules.coverBonus(terrainTypeAt(command.x,command.y))>0}];session.intent={intentId:session.binding.sessionId+':intent:'+ ++session.checkpoints,queryId:'query',actorId:actor.id,stepId:session.progress.stepId,historyRevision:h.revision,stateKey:h.stateKey};session.queryDetails={command:copy(command),legal:copy(legal),preview:copy(preview??null)};ui(command.type==='Move'&&legal.ok||preview?'preview':'selectIntent',actor.id)}
 function params(){const q=session.queryDetails,actor=units.find(u=>u.id===(q?.command.actorId??session.definition.actorTags.tank)),target=units.find(u=>u.id===session.definition.actorTags.hostile),values={'query:attack':actor?.damage,'query:defense':target?effectiveDefense(target):'', 'query:range':actor?.range,'query:cost':q?.legal.path?.reduce((n,c)=>n+movementCost(actor,c.x+','+c.y),0)??'', 'query:available':actor?movementBudget(actor):'', 'shot:result':session.lastShot?.outcome??'', 'shot:effect':session.lastShot?.outcome??'',recoveryReason:root.GoblinLanguage?.t('training.undoUnavailable')??'',skills:'',objective:'', 'control:back':'BACK','control:cancel':root.GoblinLanguage?.t('ui.cancel')??'Cancel','phase:fire':'FIRE','phase:movement':'MOVEMENT'};for(const [tag,id]of Object.entries(session.definition.actorTags))values['actor:'+tag]=units.find(u=>u.id===id)?.name??'';for(const [ref,cells]of Object.entries(session.regions))values['region:'+ref]=cells.map(c=>String.fromCharCode(65+c.x)+String(c.y+1).padStart(2,'0')).join(' / ');return values}
 function render(){root.dispatchEvent?.(new Event('goblin-training-change'))}
 function rejected(command){
  if(!active())return;const actor=units.find(u=>u.id===command?.actorId);let normalized={type:'Other'};
  if(command?.type==='Move'&&actor&&Object.values(session.definition.actorTags).includes(actor.id)&&Number.isInteger(command.x)&&Number.isInteger(command.y))normalized={type:'Move',actorId:actor.id,from:{x:actor.x,y:actor.y},to:{x:command.x,y:command.y},acceptedPath:[],cost:null};
  publish('gameplay',false,normalized);
 }
 function parameterValues(){
  const values=params(),t=(key,fallback)=>{const v=root.GoblinLanguage?.t(key);return v&&v!==key?v:fallback};
  values.objective=t('mission.'+currentScenario+'.objective.short',legacySession.config.sub);
  values['shot:effect']=t('training.result.'+session.lastShot?.outcome?.toLowerCase(),session.lastShot?.outcome??'');
  values['budget:scout']=units.find(u=>u.id===session.definition.actorTags.scout)?.moved?0:units.find(u=>u.id===session.definition.actorTags.scout)?.move??0;
  values['phase:movement']=t('v2.phase.'+turnPhase,turnPhase.toUpperCase());
  values['phase:fire']=t('v2.phase.fire','FIRE');values['control:cancel']=t('ui.dialog.cancel','Cancel');
  for(const [tag,id]of Object.entries(session.definition.actorTags)){const u=units.find(u=>u.id===id);if(u)values['actor:'+tag]=t('library.unit.'+UnitVisuals.artKey(u)+'.name',u.name)}
  const step=session.definition.steps.find(s=>s.id===session.progress.stepId);
  if(step?.messageKey){const instructionParams=Object.fromEntries(Object.entries(step.paramRefs).filter(([,ref])=>ref!=='recoveryReason').map(([key,ref])=>[key,values[ref]??'']));values.recoveryReason=root.GoblinLanguage?.t(step.messageKey,instructionParams)??values.recoveryReason}
  return values;
 }
 root.GoblinTrainingRuntime=Object.freeze({
  active,checkpoint,inspect,rejected,select:actorId=>ui('selectActor',actorId),
  cancel:()=>{if(active()&&session.intent)ui('cancelIntent',session.intent.actorId)},
  ack:(action='continue')=>ui('acknowledgeInstruction',null,action),
  status:()=>active()?session.progress.status:null,
  view:()=>active()?copy({definition:session.definition,progress:session.progress,params:parameterValues(),regions:session.regions,next:legacySession.config.training?.next??null}):null,
  setAdvisory(enabled){advisoryEnabled=!!enabled;if(!enabled&&active()&&session.definition.mode==='advisory')ui('acknowledgeInstruction',null,'exit')},
  get advisoryEnabled(){return advisoryEnabled},
  audit:()=>active()?copy(session.audit):[],rng:()=>active()?copy(session.rng):null
 });
})(globalThis);
