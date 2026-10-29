/* Pure, data-only teaching reducer. World, audit, checkpoints and rendering belong to caller. */
(function (root) {
  'use strict';
  const B=['directorSchemaVersion','scenarioId','scenarioVersion','ruleProfileId','unitDataProfile','mechanicsVersion','objectiveVersion','objective','losMode','scriptId','scriptVersion','scriptDigest'];
  const ACTOR=['id','x','y','alive','disabled','embarked','moveSpent','fireSpent'];
  const FIELDS=['alive','disabled','embarked','moveSpent','fireSpent'], QFIELDS=['legal','losBlocked','previewAvailable','coverPresent'];
  const UI=['selectActor','preview','selectIntent','cancelIntent','acknowledgeInstruction'];
  const PHASES=['movement','fire','gev','enemy','over'], TEAMS=['player','enemy'];
  const STATUS=['running','ready-for-debrief','lesson-complete','lesson-failed','abandoned'];
  const fail=code=>{
    throw Object.assign(new Error(code),{
      code
    })
  };
  const need=(v,code='MALFORMED')=>{
    if(!v)fail(code)
  };
  const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const str=v=>typeof v==='string'&&v.length>0&&v.length<=1024;
  const nat=v=>Number.isSafeInteger(v)&&v>=0;
  const bool=v=>typeof v==='boolean';
  const keys=(v,required,optional=[])=>{
    need(obj(v));
    need(required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k)))
  };
  const list=(v,test)=>{
    need(Array.isArray(v)&&v.length<=2048);
    v.forEach(x=>need(test(x)))
  };
  function json(v,seen=new Set(),depth=0){
    need(depth<=64,'JSON_LIMIT');
    if(v===null||typeof v==='string'||typeof v==='boolean')return;
    if(typeof v==='number'){
      need(Number.isFinite(v));
      return
    }
    need(typeof v==='object'&&!seen.has(v),'NON_JSON');
    const proto=Object.getPrototypeOf(v);
    need(Array.isArray(v)||proto===Object.prototype||proto===null,'NON_JSON');
    seen.add(v);
    need(Reflect.ownKeys(v).every(k=>typeof k==='string'),'NON_JSON');
    if(Array.isArray(v)){
      need(v.length<=8192);
      for(let i=0; i<v.length; i++){
        need(Object.hasOwn(v,i));
        const d=Object.getOwnPropertyDescriptor(v,String(i));
        need(d&&Object.hasOwn(d,'value'),'NON_JSON');
        json(d.value,seen,depth+1)
      }
      need(Object.keys(v).length===v.length)
    } else for(const k of Object.keys(v)){
      need(!['__proto__','constructor','prototype'].includes(k),'UNSAFE_KEY');
      const d=Object.getOwnPropertyDescriptor(v,k);
      need(d&&Object.hasOwn(d,'value'),'NON_JSON');
      json(d.value,seen,depth+1)
    }
    seen.delete(v)
  }
  const clone=v=>JSON.parse(JSON.stringify(v));
  function canonical(v){
    return v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'
  }
  const equal=(a,b)=>canonical(a)===canonical(b);
  const unique=a=>new Set(a).size===a.length;
  function binding(b,session=false){
    keys(b,session?[...B,'sessionId']:B);
    need(b.directorSchemaVersion===1&&nat(b.scenarioVersion)&&b.scenarioVersion>0&&nat(b.scriptVersion)&&b.scriptVersion>0&&nat(b.objectiveVersion)&&b.objectiveVersion>0,'BINDING');
    for(const k of B.filter(k=>!['directorSchemaVersion','scenarioVersion','scriptVersion','objectiveVersion'].includes(k)))need(str(b[k]),'BINDING');
    if(session)need(str(b.sessionId),'BINDING')
  }
  function bound(d,b){
    binding(b,true);
    const staticB={
      ...b
    };
    delete staticB.sessionId;
    need(equal(d.binding,staticB),'BINDING')
  }
  function point(p){
    keys(p,['x','y']);
    need(Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y))
  }
  function actor(a){
    keys(a,ACTOR);
    need(str(a.id));
    point({
      x:a.x,y:a.y
    });
    FIELDS.forEach(k=>need(bool(a[k])))
  }
  const tag=(d,t)=>need(str(t)&&Object.hasOwn(d.actorTags,t),'ACTOR_REF');
  const region=(d,r)=>need(d.regionRefs.includes(r),'REGION_REF');
  function condition(c,d,stepIds,depth=0,count={
    n:0
  }){
    need(depth<=16&&++count.n<=256,'DSL_LIMIT');
    need(obj(c)&&str(c.op),'CONDITION');
    switch(c.op){
      case 'all':case 'any':keys(c,['op','conditions']);
      need(Array.isArray(c.conditions)&&c.conditions.length>0&&c.conditions.length<=32);
      c.conditions.forEach(x=>condition(x,d,stepIds,depth+1,count));
      break;
      case 'not':keys(c,['op','condition']);
      condition(c.condition,d,stepIds,depth+1,count);
      break;
      case 'acceptedAction':keys(c,['op','type'],['actorTag','targetTag','regionRef']);
      need(['Move','Fire','EndPhase'].includes(c.type));
      if(c.actorTag!==undefined)tag(d,c.actorTag);
      if(c.targetTag!==undefined)tag(d,c.targetTag);
      if(c.regionRef!==undefined)region(d,c.regionRef);
      need(c.type==='EndPhase'||c.actorTag!==undefined);
      need(c.type!=='Fire'||c.targetTag!==undefined);
      break;
      case 'actorInRegion':keys(c,['op','actorTag','regionRef']);
      tag(d,c.actorTag);
      region(d,c.regionRef);
      break;
      case 'actorState':keys(c,['op','actorTag','field','value']);
      tag(d,c.actorTag);
      need(FIELDS.includes(c.field)&&bool(c.value));
      break;
      case 'phaseEntered':keys(c,['op','team','phase']);
      need(TEAMS.includes(c.team)&&PHASES.includes(c.phase));
      break;
      case 'enemyTurnCompleted':keys(c,['op']);
      break;
      case 'shotObserved':keys(c,['op','actorTag','targetTag']);
      tag(d,c.actorTag);
      tag(d,c.targetTag);
      break;
      case 'uiFact':keys(c,['op','type'],['actorTag','stepId']);
      need(UI.includes(c.type));
      if(c.actorTag!==undefined)tag(d,c.actorTag);
      if(c.stepId!==undefined)need(stepIds.includes(c.stepId),'STEP_REF');
      break;
      case 'queryFact':keys(c,['op','queryId','fact','value']);
      need(str(c.queryId)&&QFIELDS.includes(c.fact)&&bool(c.value));
      break;
      case 'undoWitness':keys(c,['op','actorTag','undoneStepId']);
      tag(d,c.actorTag);
      need(stepIds.includes(c.undoneStepId),'STEP_REF');
      break;
      default:fail('CONDITION_OP')
    }
  }
  // Small bounded DNF is used only to reject unsafe authoring, never to resolve game rules.
  function paths(c){
    if(c===null)return [[]];
    if(c.op==='any')return c.conditions.flatMap(paths);
    if(c.op==='all'){
      let p=[[]];
      for(const x of c.conditions){
        const next=[];
        for(const a of p)for(const b of paths(x)){
          need(next.length<256,'DSL_LIMIT');
          next.push([...a,...b])
        }
        p=next
      }
      return p
    }
    return [[c]]
  }
  function gameplayGuard(c){
    return paths(c).every(p=>{
      const a=p.filter(x=>x.op==='acceptedAction');
      return a.length>0&&a.every(x=>x.type==='Move'?p.some(y=>y.op==='actorInRegion'&&y.actorTag===x.actorTag)&&p.some(y=>y.op==='actorState'&&y.actorTag===x.actorTag&&y.field==='moveSpent'&&y.value):x.type==='Fire'?p.some(y=>y.op==='shotObserved'&&y.actorTag===x.actorTag&&y.targetTag===x.targetTag)&&p.some(y=>y.op==='actorState'&&y.actorTag===x.actorTag&&y.field==='fireSpent'&&y.value):p.some(y=>y.op==='phaseEntered'))
    })
  }
  function eventGuard(c){
    return paths(c).every(p=>p.some(x=>['acceptedAction','phaseEntered','enemyTurnCompleted','shotObserved','uiFact','undoWitness'].includes(x.op)))
  }
  function validate(d,m=null){
    json(d);
    keys(d,['binding','mode','startStepId','actorTags','regionRefs','steps','onRestore','terminal']);
    binding(d.binding);
    need(['learning','advisory'].includes(d.mode));
    need(obj(d.actorTags)&&Object.keys(d.actorTags).length>0);
    for(const [k,v]of Object.entries(d.actorTags))need(str(k)&&str(v));
    need(unique(Object.values(d.actorTags)),'ACTOR_REF');
    list(d.regionRefs,str);
    need(unique(d.regionRefs));
    need(Array.isArray(d.steps)&&d.steps.length>0&&d.steps.length<=256);
    const ids=d.steps.map(s=>s.id);
    list(ids,str);
    need(unique(ids)&&ids.includes(d.startStepId),'STEP_REF');
    const ref=id=>need(id===null||ids.includes(id),'STEP_REF');
    for(const s of d.steps){
      keys(s,['id','category','messageKey','paramRefs','highlightRefs','completeWhen','next','alternatives','recovery','holdAutoPhase']);
      need(['instruction','gameplay','explanation','branch','debrief','exit'].includes(s.category));
      need(s.messageKey===null||str(s.messageKey));
      need(obj(s.paramRefs));
      Object.entries(s.paramRefs).forEach(([k,v])=>need(str(k)&&str(v)));
      need(Array.isArray(s.highlightRefs)&&s.highlightRefs.length<=32);
      for(const h of s.highlightRefs){
        keys(h,['kind','ref']);
        need(['actor','region','control'].includes(h.kind));
        if(h.kind==='actor')tag(d,h.ref);
        else if(h.kind==='region')region(d,h.ref);
        else need(str(h.ref))
      }
      if(s.completeWhen!==null)condition(s.completeWhen,d,ids);
      ref(s.next);
      need(Array.isArray(s.alternatives)&&s.alternatives.length<=32);
      for(const a of s.alternatives){
        keys(a,['when','next']);
        condition(a.when,d,ids);
        ref(a.next)
      }
      if(s.recovery!==null){
        keys(s.recovery,['messageKey','next']);
        need(str(s.recovery.messageKey));
        ref(s.recovery.next)
      }
      need(bool(s.holdAutoPhase)&&(!s.holdAutoPhase||d.mode==='learning'),'HOLD_PROFILE');
      if(s.category==='gameplay'){
        need(s.completeWhen!==null&&gameplayGuard(s.completeWhen),'GAMEPLAY_GUARD');
        s.alternatives.forEach(a=>need(gameplayGuard(a.when),'GAMEPLAY_GUARD'))
      }
      if(s.category==='exit')need(s.next===null&&s.alternatives.length===0);
      if(s.category==='debrief')need(d.mode==='learning')
    }
    if(d.onRestore!==null){
      keys(d.onRestore,['actorTag','undoneStepId','nextStepId']);
      tag(d,d.onRestore.actorTag);
      need(ids.includes(d.onRestore.undoneStepId)&&ids.includes(d.onRestore.nextStepId));
      need(d.mode==='learning'&&d.steps.find(s=>s.id===d.onRestore.undoneStepId).category==='gameplay','RESTORE_RULE');
      need(paths(d.steps.find(s=>s.id===d.onRestore.undoneStepId).completeWhen).every(path=>path.some(c=>c.op==='acceptedAction'&&c.type==='Move'&&c.actorTag===d.onRestore.actorTag)),'RESTORE_MOVE')
    }
    if(d.mode==='learning'){
      keys(d.terminal,['requiredStepIds','readyMessageKey','completeMessageKey','failureMessageKey','scriptFailureMessageKey']);
      list(d.terminal.requiredStepIds,x=>ids.includes(x));
      need(unique(d.terminal.requiredStepIds));
      for(const k of ['readyMessageKey','completeMessageKey','failureMessageKey','scriptFailureMessageKey'])need(str(d.terminal[k]));
      need(d.binding.objective==='learning'&&d.binding.objectiveVersion===1&&d.binding.scenarioVersion===1&&d.binding.scriptVersion===1&&d.binding.ruleProfileId==='TRAINING_FIELD_TEST_v1'&&d.binding.unitDataProfile==='training-field-test-data-v1'&&d.binding.mechanicsVersion==='legacy-field-test-training-v1'&&d.binding.losMode==='legacy-pixel-los-v1','LEARNING_PROFILE')
    } else need(d.terminal===null&&d.onRestore===null&&!d.steps.some(s=>s.category==='debrief'),'ADVISORY');
    const edges=s=>[s.next,...s.alternatives.map(a=>a.next),s.recovery?.next].filter(x=>x!==null&&x!==undefined);
    const reached=new Set();
    function visit(id){
      if(reached.has(id))return;
      reached.add(id);
      edges(d.steps.find(s=>s.id===id)).forEach(visit)
    }
    visit(d.startStepId);
    if(d.onRestore)visit(d.onRestore.nextStepId);
    need(reached.size===ids.length,'UNREACHABLE_STEP');
    const exits=new Set(d.steps.filter(s=>s.category==='exit'||s.category==='debrief').map(s=>s.id));
    let change=true;
    while(change){
      change=false;
      for(const s of d.steps)if(!exits.has(s.id)&&edges(s).some(id=>exits.has(id))){
        exits.add(s.id);
        change=true
      }
    }
    need(ids.every(id=>exits.has(id)),'NO_EXIT');
    const colors=new Map();
    function noNullCycle(id){
      if(colors.get(id)===1)fail('NULL_CYCLE');
      if(colors.get(id)===2)return;
      colors.set(id,1);
      const s=d.steps.find(s=>s.id===id);
      if(!eventGuard(s.completeWhen))if(s.next!==null)noNullCycle(s.next);
      for(const a of s.alternatives)if(!eventGuard(a.when)&&a.next!==null)noNullCycle(a.next);
      colors.set(id,2)
    }
    ids.forEach(noNullCycle);
    if(m!==null){
      json(m);
      keys(m,['binding','definition','actorTags','regionRefs','copyKeys','parameterRefs','controlRefs','capabilityRefs']);
      binding(m.binding);
      need(equal(m.binding,d.binding)&&equal(m.definition,d)&&equal(m.actorTags,d.actorTags)&&equal(m.regionRefs,d.regionRefs),'MANIFEST_BINDING');
      for(const k of ['copyKeys','parameterRefs','controlRefs','capabilityRefs']){
        list(m[k],str);
        need(unique(m[k]))
      }
      const copy=k=>need(k===null||m.copyKeys.includes(k),'COPY_REF');
      for(const s of d.steps){
        copy(s.messageKey);
        if(s.recovery)copy(s.recovery.messageKey);
        Object.values(s.paramRefs).forEach(r=>need(m.parameterRefs.includes(r),'PARAM_REF'));
        s.highlightRefs.filter(h=>h.kind==='control').forEach(h=>need(m.controlRefs.includes(h.ref),'CONTROL_REF'));
        const scan=c=>{
          if(!c)return;
          if(c.op==='queryFact')need(m.parameterRefs.includes(c.queryId),'QUERY_REF');
          if(c.conditions)c.conditions.forEach(scan);
          if(c.condition)scan(c.condition)
        };
        scan(s.completeWhen);
        s.alternatives.forEach(a=>scan(a.when))
      }
      if(d.terminal)Object.entries(d.terminal).filter(([k])=>k!=='requiredStepIds').forEach(([,k])=>copy(k))
    }
    return true
  }
  function state(d,s){
    json(s);
    keys(s,['binding','receiptSequence','history','phase','actors','regions','queries','uiIntent','undo','terminalFacts','viewerProjection']);
    bound(d,s.binding);
    need(nat(s.receiptSequence));
    keys(s.history,['branchId','revision','stateKey','rngCursor']);
    need(str(s.history.branchId)&&nat(s.history.revision)&&str(s.history.stateKey)&&nat(s.history.rngCursor));
    keys(s.phase,['team','phase','turn']);
    need(TEAMS.includes(s.phase.team)&&PHASES.includes(s.phase.phase)&&nat(s.phase.turn)&&s.phase.turn>0);
    need(obj(s.actors)&&equal(Object.keys(s.actors).sort(),Object.keys(d.actorTags).sort()),'ACTOR_BINDING');
    for(const [t,a]of Object.entries(s.actors)){
      actor(a);
      need(a.id===d.actorTags[t],'ACTOR_BINDING')
    }
    need(obj(s.regions)&&equal(Object.keys(s.regions).sort(),[...d.regionRefs].sort()),'REGION_REF');
    for(const a of Object.values(s.regions)){
      list(a,x=>Object.values(d.actorTags).includes(x));
      need(unique(a))
    }
    need(Array.isArray(s.queries));
    for(const q of s.queries){
      keys(q,['queryId','actorId','targetId','regionRef','historyRevision','stateKey',...QFIELDS]);
      need(str(q.queryId)&&Object.values(d.actorTags).includes(q.actorId));
      need(q.targetId===null||Object.values(d.actorTags).includes(q.targetId));
      need(q.regionRef===null||d.regionRefs.includes(q.regionRef));
      need(q.historyRevision===s.history.revision&&q.stateKey===s.history.stateKey,'STALE_QUERY');
      QFIELDS.forEach(f=>need(bool(q[f])))
    }
    need(unique(s.queries.map(q=>q.queryId)),'QUERY_REF');
    if(s.uiIntent!==null)intent(d,s.uiIntent,s);
    keys(s.undo,['available','checkpointRef']);
    need(bool(s.undo.available)&&(s.undo.checkpointRef===null||str(s.undo.checkpointRef)));
    keys(s.terminalFacts,['playerAlive','normalEnded','normalOutcome','unavailableRequiredActorTags']);
    need(bool(s.terminalFacts.playerAlive)&&bool(s.terminalFacts.normalEnded));
    need([null,true,false].includes(s.terminalFacts.normalOutcome));
    need(s.terminalFacts.normalEnded||s.terminalFacts.normalOutcome===null);
    list(s.terminalFacts.unavailableRequiredActorTags,t=>Object.hasOwn(d.actorTags,t));
    keys(s.viewerProjection,['actorIds','regionRefs','parameterRefs','controlRefs']);
    for(const a of Object.values(s.viewerProjection)){
      list(a,str);
      need(unique(a))
    }
    need(s.viewerProjection.actorIds.every(id=>Object.values(d.actorTags).includes(id)));
    need(s.viewerProjection.regionRefs.every(r=>d.regionRefs.includes(r)));
    return s
  }
  function intent(d,i,s){
    keys(i,['intentId','queryId','actorId','stepId','historyRevision','stateKey']);
    need(str(i.intentId)&&str(i.queryId)&&Object.values(d.actorTags).includes(i.actorId)&&d.steps.some(x=>x.id===i.stepId));
    need(i.historyRevision===s.history.revision&&i.stateKey===s.history.stateKey,'STALE_INTENT');
    need(s.queries.some(q=>q.queryId===i.queryId&&q.actorId===i.actorId),'QUERY_REF')
  }
  const current=(d,p)=>d.steps.find(s=>s.id===p.stepId);
  function hold(d,p){
    return d.mode==='learning'&&(p.status==='ready-for-debrief'||p.status==='running'&&current(d,p)?.holdAutoPhase===true)
  }
  function effect(d,p,s,type,messageKey=null,step=current(d,p)){
    const refs=step?.highlightRefs??[],params=step?.paramRefs??{
    };
    need(Object.values(params).every(r=>s.viewerProjection.parameterRefs.includes(r)),'VIEWER_PARAM');
    for(const h of refs)need(h.kind==='actor'?s.viewerProjection.actorIds.includes(d.actorTags[h.ref]):h.kind==='region'?s.viewerProjection.regionRefs.includes(h.ref):s.viewerProjection.controlRefs.includes(h.ref),'VIEWER_REF');
    const key=canonical([p.binding.sessionId,p.binding.scriptId,p.binding.scriptVersion,p.stepId,p.branchId,p.lastReceiptId??'initial',type]);
    if(p.seenEffectKeys.includes(key))return;
    p.seenEffectKeys.push(key);
    if(['showInstruction','showHint','setHighlight','clearHighlight','setLearningGoal'].includes(type))p.pendingEffects=p.pendingEffects.filter(e=>e.type!==type&&(!['clearHighlight','setHighlight'].includes(type)||!['clearHighlight','setHighlight'].includes(e.type)));
    p.pendingEffects.push({
      type,key,stepId:p.stepId,messageKey,paramRefs:clone(params),highlightRefs:clone(refs)
    })
  }
  function present(d,p,s){
    const step=current(d,p);
    if(!step)return;
    if(step.messageKey!==null)effect(d,p,s,d.mode==='advisory'?'showHint':'showInstruction',step.messageKey);
    if(step.highlightRefs.length)effect(d,p,s,'setHighlight');
    if(d.mode==='learning')effect(d,p,s,'setLearningGoal',step.messageKey)
  }
  function createProgress(d,s){
    validate(d);
    state(d,s);
    const p={
      version:1,binding:clone(s.binding),branchId:s.history.branchId,historyRevision:s.history.revision,stateKey:s.history.stateKey,rngCursor:s.history.rngCursor,sequence:s.receiptSequence,lastReceiptId:null,lastInputKey:null,stepId:d.startStepId,status:'running',proofs:[],undoWitness:null,seenEffectKeys:[],pendingEffects:[],pendingIntent:null,actorFacts:clone(s.actors),phaseFacts:clone(s.phase),recoveryOffered:false,holdAutoPhase:false
    };
    present(d,p,s);
    p.holdAutoPhase=hold(d,p);
    return p
  }
  function progress(d,p){
    json(p);
    keys(p,['version','binding','branchId','historyRevision','stateKey','rngCursor','sequence','lastReceiptId','lastInputKey','stepId','status','proofs','undoWitness','seenEffectKeys','pendingEffects','pendingIntent','actorFacts','phaseFacts','recoveryOffered','holdAutoPhase']);
    bound(d,p.binding);
    need(p.version===1&&str(p.branchId)&&nat(p.historyRevision)&&str(p.stateKey)&&nat(p.rngCursor)&&nat(p.sequence)&&STATUS.includes(p.status)&&d.steps.some(s=>s.id===p.stepId),'PROGRESS');
    need((p.lastReceiptId===null||str(p.lastReceiptId))&&(p.lastInputKey===null||str(p.lastInputKey)||typeof p.lastInputKey==='string'));
    need(Array.isArray(p.proofs));
    for(const a of p.proofs){
      keys(a,['stepId','receiptId','rootCommandId','kind']);
      need(d.steps.some(s=>s.id===a.stepId)&&str(a.receiptId)&&(a.rootCommandId===null||str(a.rootCommandId))&&['gameplay','phase','enemyTurnComplete','ui','restore'].includes(a.kind))
    }
    list(p.seenEffectKeys,x=>typeof x==='string');
    need(Array.isArray(p.pendingEffects)&&bool(p.holdAutoPhase));
    for(const e of p.pendingEffects){
      keys(e,['type','key','stepId','messageKey','paramRefs','highlightRefs']);
      need(['showInstruction','showHint','setHighlight','clearHighlight','setLearningGoal','offerRecovery','readyForDebrief','completeLearning','failLearning','requestRepeat','offerRestartExit'].includes(e.type)&&typeof e.key==='string'&&d.steps.some(s=>s.id===e.stepId)&&(e.messageKey===null||str(e.messageKey))&&obj(e.paramRefs)&&Array.isArray(e.highlightRefs),'EFFECT');
      Object.values(e.paramRefs).forEach(v=>need(str(v)));
      for(const h of e.highlightRefs){
        keys(h,['kind','ref']);
        need(['actor','region','control'].includes(h.kind)&&str(h.ref));
        if(h.kind==='actor')tag(d,h.ref);
        if(h.kind==='region')region(d,h.ref)
      }
    }
    need(obj(p.actorFacts)&&equal(Object.keys(p.actorFacts).sort(),Object.keys(d.actorTags).sort()));
    for(const [t,a]of Object.entries(p.actorFacts)){
      actor(a);
      need(a.id===d.actorTags[t])
    }
    if(p.undoWitness!==null){
      keys(p.undoWitness,['actorTag','undoneStepId','rootCommandId','receiptId','checkpointRef','branchId']);
      tag(d,p.undoWitness.actorTag);
      need(d.steps.some(s=>s.id===p.undoWitness.undoneStepId));
      for(const k of ['rootCommandId','receiptId','checkpointRef','branchId'])need(str(p.undoWitness[k]))
    }
    if(p.pendingIntent!==null){
      keys(p.pendingIntent,['intentId','queryId','actorId','stepId','historyRevision','stateKey']);
      need(str(p.pendingIntent.intentId)&&str(p.pendingIntent.queryId)&&Object.values(d.actorTags).includes(p.pendingIntent.actorId)&&d.steps.some(s=>s.id===p.pendingIntent.stepId)&&p.pendingIntent.historyRevision===p.historyRevision&&p.pendingIntent.stateKey===p.stateKey)
    }
    keys(p.phaseFacts,['team','phase','turn']);
    need(TEAMS.includes(p.phaseFacts.team)&&PHASES.includes(p.phaseFacts.phase)&&nat(p.phaseFacts.turn)&&p.phaseFacts.turn>0&&bool(p.recoveryOffered));
    if(p.status==='ready-for-debrief')need(current(d,p).category==='debrief'&&d.mode==='learning'&&d.terminal.requiredStepIds.every(id=>p.proofs.some(x=>x.stepId===id)),'PROGRESS');
    need(p.holdAutoPhase===hold(d,p),'HOLD_PROFILE')
  }
  function receipt(d,p,r,s){
    json(r);
    keys(r,['binding','receiptId','sequence','kind','accepted','rootCommandId','branchBefore','branchAfter','historyRevisionBefore','historyRevisionAfter','stateKeyBefore','stateKeyAfter','rngCursorBefore','rngCursorAfter','command','events','ui','restore']);
    bound(d,r.binding);
    need(equal(r.binding,p.binding)&&equal(r.binding,s.binding),'BINDING');
    need(str(r.receiptId)&&nat(r.sequence)&&r.sequence>0&&bool(r.accepted)&&['gameplay','phase','enemyTurnComplete','ui','restore'].includes(r.kind),'RECEIPT');
    for(const k of ['branchBefore','branchAfter','stateKeyBefore','stateKeyAfter'])need(str(r[k]));
    for(const k of ['historyRevisionBefore','historyRevisionAfter','rngCursorBefore','rngCursorAfter'])need(nat(r[k]));
    need(s.receiptSequence===r.sequence&&s.history.branchId===r.branchAfter&&s.history.revision===r.historyRevisionAfter&&s.history.stateKey===r.stateKeyAfter&&s.history.rngCursor===r.rngCursorAfter,'AFTER_STATE');
    need(Array.isArray(r.events)&&r.events.length<=1024);
    if(r.kind==='ui'){
      need(r.rootCommandId===null&&r.command===null&&r.restore===null&&r.events.length===0&&r.accepted);
      uiReceipt(d,p,r,s)
    } else if(r.kind==='restore'){
      need(r.rootCommandId===null&&r.command===null&&r.ui===null&&r.events.length===0&&r.accepted);
      restoreReceipt(d,p,r,s)
    } else{
      need(str(r.rootCommandId)&&r.ui===null&&r.restore===null);
      if(r.kind==='gameplay')gameplay(d,p,r,s);
      else if(r.kind==='phase'){
        keys(r.command,['type']);
        need(r.command.type==='EndPhase');
        if(r.accepted)need(r.events.some(e=>e.type==='PhaseEntered'),'PHASE_EVENT')
      } else need(r.command===null);
      events(d,p,r,s)
    }
    if(r.kind!=='restore'){
      need(p.branchId===r.branchBefore&&r.branchBefore===r.branchAfter&&p.historyRevision===r.historyRevisionBefore&&p.stateKey===r.stateKeyBefore&&p.rngCursor===r.rngCursorBefore,'BEFORE_STATE');
      if(r.kind==='ui'||!r.accepted)need(r.historyRevisionAfter===r.historyRevisionBefore&&r.stateKeyAfter===r.stateKeyBefore&&r.rngCursorAfter===r.rngCursorBefore,'UNCHANGED');
      else need(r.historyRevisionAfter===r.historyRevisionBefore+1&&r.rngCursorAfter>=r.rngCursorBefore,'REVISION');
      if(!r.accepted)need(r.events.length===0&&equal(s.actors,p.actorFacts),'REJECT_CHANGED')
    }
  }
  function uiReceipt(d,p,r,s){
    keys(r.ui,['type','actorId','stepId','intentId','queryId','action']);
    const u=r.ui;
    need(UI.includes(u.type)&&d.steps.some(x=>x.id===u.stepId),'UI_FACT');
    need(u.actorId===null||Object.values(d.actorTags).includes(u.actorId));
    need(u.intentId===null||str(u.intentId));
    need(u.queryId===null||str(u.queryId));
    need(equal(s.actors,p.actorFacts)&&equal(s.phase,p.phaseFacts),'UI_CHANGED');
    if(u.type==='acknowledgeInstruction'){
      need(['continue','debrief','repeat','exit'].includes(u.action)&&u.actorId===null&&u.intentId===null&&u.queryId===null)
    } else{
      need(u.action===null&&u.actorId!==null);
      if(u.type==='selectActor')need(u.intentId===null&&u.queryId===null);
      else{
        need(str(u.intentId)&&str(u.queryId));
        if(u.type==='cancelIntent'){
          const i=p.pendingIntent;
          need(i&&i.intentId===u.intentId&&i.queryId===u.queryId&&i.actorId===u.actorId&&i.stepId===u.stepId&&i.historyRevision===s.history.revision&&i.stateKey===s.history.stateKey&&s.uiIntent===null,'CANCEL_IDENTITY')
        } else{
          need(s.uiIntent!==null&&s.uiIntent.intentId===u.intentId&&s.uiIntent.queryId===u.queryId&&s.uiIntent.actorId===u.actorId&&s.uiIntent.stepId===u.stepId,'INTENT_IDENTITY');
          need(s.queries.some(q=>q.queryId===u.queryId&&q.actorId===u.actorId&&(u.type!=='preview'||q.previewAvailable)),'QUERY_REF')
        }
      }
    }
  }
  function gameplay(d,p,r,s){
    need(obj(r.command));
    const c=r.command;
    if(c.type==='Move'){
      keys(c,['type','actorId','from','to','acceptedPath','cost']);
      need(Object.values(d.actorTags).includes(c.actorId));
      point(c.from);
      point(c.to);
      need(Array.isArray(c.acceptedPath)&&c.acceptedPath.length<=256);
      need(r.accepted?c.acceptedPath.length>0&&Number.isFinite(c.cost)&&c.cost>0:c.acceptedPath.length===0&&c.cost===null,'MOVE_PATH');
      c.acceptedPath.forEach(point);
      
      if(r.accepted){
        const t=Object.keys(d.actorTags).find(t=>d.actorTags[t]===c.actorId),before=p.actorFacts[t],after=s.actors[t];
        need(before.alive&&!before.disabled&&!before.embarked&&!before.moveSpent&&equal(c.from,{
          x:before.x,y:before.y
        })&&!equal(c.from,c.to)&&equal(c.to,c.acceptedPath.at(-1))&&equal(c.to,{
          x:after.x,y:after.y
        })&&after.moveSpent,'MOVE_STATE');
        need(r.events.filter(e=>e.type==='UnitMoved'&&e.actorId===c.actorId&&equal(e.from,c.from)&&equal(e.to,c.to)&&e.moveSpentBefore===before.moveSpent&&e.moveSpentAfter===after.moveSpent).length===1,'MOVE_EVENT')
      }
    } else if(c.type==='Fire'){
      keys(c,['type','actorId','targetId','weaponId']);
      need(Object.values(d.actorTags).includes(c.actorId)&&Object.values(d.actorTags).includes(c.targetId)&&(c.weaponId===null||str(c.weaponId)));
      if(r.accepted){
        const t=Object.keys(d.actorTags).find(t=>d.actorTags[t]===c.actorId);
        const targetTag=Object.keys(d.actorTags).find(t=>d.actorTags[t]===c.targetId);
        need(p.actorFacts[targetTag].alive,'FIRE_TARGET');
        need(p.actorFacts[t].alive&&!p.actorFacts[t].disabled&&!p.actorFacts[t].embarked&&!p.actorFacts[t].fireSpent&&s.actors[t].fireSpent,'FIRE_STATE');
        need(r.events.filter(e=>e.type==='ShotResolved'&&e.actorId===c.actorId&&e.targetId===c.targetId&&e.weaponId===c.weaponId).length===1,'SHOT_EVENT')
      }
    } else if(c.type==='Other'){
      keys(c,['type']);
      need(r.events.length===0,'OTHER_EVENTS')
    } else fail('COMMAND_TYPE')
  }
  function events(d,p,r,s){
    for(const e of r.events){
      need(obj(e)&&e.rootCommandId===r.rootCommandId,'ROOT_EVENT');
      switch(e.type){
        case 'UnitMoved':keys(e,['type','rootCommandId','actorId','from','to','moveSpentBefore','moveSpentAfter']);
        need(Object.values(d.actorTags).includes(e.actorId));
        point(e.from);
        point(e.to);
        need(bool(e.moveSpentBefore)&&bool(e.moveSpentAfter));
        break;
        case 'ShotResolved':keys(e,['type','rootCommandId','actorId','targetId','weaponId','outcome','fireSpentBefore','fireSpentAfter','targetBefore','targetAfter']);
        need(Object.values(d.actorTags).includes(e.actorId)&&Object.values(d.actorTags).includes(e.targetId)&&['NE','D','X'].includes(e.outcome)&&(e.weaponId===null||str(e.weaponId)));
        need(bool(e.fireSpentBefore)&&bool(e.fireSpentAfter));
        for(const a of [e.targetBefore,e.targetAfter]){
          keys(a,['alive','disabled']);
          need(bool(a.alive)&&bool(a.disabled))
        }
        if(r.kind==='gameplay'&&r.command.type==='Fire'&&e.actorId===r.command.actorId&&e.targetId===r.command.targetId){
          const at=Object.keys(d.actorTags).find(t=>d.actorTags[t]===e.actorId),tt=Object.keys(d.actorTags).find(t=>d.actorTags[t]===e.targetId);
          need(e.fireSpentBefore===p.actorFacts[at].fireSpent&&e.fireSpentAfter===s.actors[at].fireSpent&&equal(e.targetBefore,{
            alive:p.actorFacts[tt].alive,disabled:p.actorFacts[tt].disabled
          })&&equal(e.targetAfter,{
            alive:s.actors[tt].alive,disabled:s.actors[tt].disabled
          }),'SHOT_STATE')
        }
        break;
        case 'PhaseEntered':keys(e,['type','rootCommandId','team','phase','turn']);
        need(e.team===s.phase.team&&e.phase===s.phase.phase&&e.turn===s.phase.turn,'PHASE_STATE');
        break;
        case 'EnemyTurnCompleted':keys(e,['type','rootCommandId','nextTeam','nextPhase','turn','budgetsReset']);
        need(r.kind==='enemyTurnComplete'&&e.nextTeam==='player'&&e.nextPhase==='movement'&&e.turn===s.phase.turn&&e.budgetsReset===true&&s.phase.team==='player'&&s.phase.phase==='movement','ENEMY_STATE');
        break;
        default:fail('EVENT_TYPE')
      }
    }
    if(r.kind==='enemyTurnComplete'&&r.accepted&&!s.terminalFacts.normalEnded)need(r.events.filter(e=>e.type==='EnemyTurnCompleted').length===1,'ENEMY_EVENT')
  }
  function restoreReceipt(d,p,r,s){
    const x=r.restore;
    keys(x,['undoneRootCommandId','undoneStepId','actorId','branchBefore','branchAfter','checkpointRef','checkpointBranchId','checkpointHistoryRevision','expectedBeforeKey','restoredAfterKey','restoredBudgetFacts','restoredRollCursor']);
    need(str(x.undoneRootCommandId)&&d.steps.some(t=>t.id===x.undoneStepId)&&Object.values(d.actorTags).includes(x.actorId));
    need(str(x.checkpointRef)&&str(x.checkpointBranchId)&&nat(x.checkpointHistoryRevision)&&x.checkpointBranchId===p.branchId&&x.checkpointHistoryRevision===p.historyRevision,'CHECKPOINT');
    need(x.branchBefore===r.branchBefore&&x.branchAfter===r.branchAfter&&r.branchAfter!==r.branchBefore&&r.branchAfter!==p.branchId,'RESTORE_BRANCH');
    need(r.historyRevisionAfter>r.historyRevisionBefore&&r.historyRevisionAfter>x.checkpointHistoryRevision,'RESTORE_REVISION');
    need(x.expectedBeforeKey===p.stateKey&&x.restoredAfterKey===p.stateKey&&r.stateKeyAfter===p.stateKey&&x.restoredRollCursor===p.rngCursor&&r.rngCursorAfter===p.rngCursor,'RESTORE_STATE');
    keys(x.restoredBudgetFacts,['moveSpent','fireSpent']);
    need(bool(x.restoredBudgetFacts.moveSpent)&&bool(x.restoredBudgetFacts.fireSpent));
    const t=Object.keys(d.actorTags).find(t=>d.actorTags[t]===x.actorId);
    need(equal(p.actorFacts,s.actors)&&equal(p.phaseFacts,s.phase)&&s.actors[t].moveSpent===x.restoredBudgetFacts.moveSpent&&s.actors[t].fireSpent===x.restoredBudgetFacts.fireSpent,'RESTORE_ACTOR')
  }
  function evaluate(c,d,p,r,s){
    if(c===null)return true;
    const actor=t=>s.actors[t],freshRoot=()=>p.undoWitness?.rootCommandId!==r.rootCommandId&&!p.proofs.some(x=>x.rootCommandId!==null&&x.rootCommandId===r.rootCommandId);
    switch(c.op){
      case 'all':return c.conditions.every(x=>evaluate(x,d,p,r,s));
      case 'any':return c.conditions.some(x=>evaluate(x,d,p,r,s));
      case 'not':return !evaluate(c.condition,d,p,r,s);
      case 'acceptedAction':return r.accepted&&['gameplay','phase'].includes(r.kind)&&r.command?.type===c.type&&freshRoot()&&(c.actorTag===undefined||r.command.actorId===d.actorTags[c.actorTag])&&(c.targetTag===undefined||r.command.targetId===d.actorTags[c.targetTag])&&(c.regionRef===undefined||s.regions[c.regionRef].includes(r.command.actorId));
      case 'actorInRegion':return s.regions[c.regionRef].includes(actor(c.actorTag).id);
      case 'actorState':return actor(c.actorTag)[c.field]===c.value;
      case 'phaseEntered':return r.accepted&&r.events.some(e=>e.type==='PhaseEntered'&&e.team===c.team&&e.phase===c.phase);
      case 'enemyTurnCompleted':return r.accepted&&r.kind==='enemyTurnComplete'&&r.events.some(e=>e.type==='EnemyTurnCompleted');
      case 'shotObserved':return r.accepted&&r.events.some(e=>e.type==='ShotResolved'&&e.actorId===d.actorTags[c.actorTag]&&e.targetId===d.actorTags[c.targetTag]);
      case 'uiFact':return r.kind==='ui'&&r.ui.type===c.type&&r.ui.stepId===(c.stepId??p.stepId)&&(c.actorTag===undefined||r.ui.actorId===d.actorTags[c.actorTag]);
      case 'queryFact':return s.queries.some(q=>q.queryId===c.queryId&&q[c.fact]===c.value&&q.historyRevision===s.history.revision&&q.stateKey===s.history.stateKey);
      case 'undoWitness':return p.undoWitness!==null&&p.undoWitness.actorTag===c.actorTag&&p.undoWitness.undoneStepId===c.undoneStepId;
      default:return false
    }
  }
  function scriptFailure(d,p,s){
    p.status=d.mode==='learning'?'lesson-failed':'abandoned';
    p.pendingEffects=[];
    if(d.mode==='learning'){
      effect(d,p,s,'failLearning',d.terminal.scriptFailureMessageKey,null);
      effect(d,p,s,'offerRestartExit',d.terminal.scriptFailureMessageKey,null)
    } else effect(d,p,s,'clearHighlight',null,null);
    p.holdAutoPhase=false
  }
  function reduceDirector(d,input,r,s){
    try{
      validate(d);
      progress(d,input);
      state(d,s);
      json(r);
      bound(d,r.binding);
      need(equal(r.binding,input.binding)&&equal(r.binding,s.binding),'BINDING');
      const inputKey=canonical([r,s]);
      if(r.receiptId===input.lastReceiptId&&r.sequence===input.sequence){
        need(input.lastInputKey===inputKey,'DUPLICATE_MISMATCH');
        return {
          progress:input,effects:[]
        }
      }
      receipt(d,input,r,s);
      need(r.sequence>input.sequence&&(r.kind==='restore'||r.sequence===input.sequence+1),'SEQUENCE');
      need(r.receiptId!==input.lastReceiptId,'RECEIPT_ID');
      const p=clone(input);
      p.pendingEffects=[];
      p.sequence=r.sequence;
      p.lastReceiptId=r.receiptId;
      p.lastInputKey=inputKey;
      p.branchId=r.branchAfter;
      p.historyRevision=r.historyRevisionAfter;
      p.stateKey=r.stateKeyAfter;
      p.rngCursor=r.rngCursorAfter;
      p.actorFacts=clone(s.actors);
      p.phaseFacts=clone(s.phase);
      if(r.kind==='restore'){
        p.pendingIntent=null;
        p.undoWitness=null;
        p.recoveryOffered=false;
        if(d.onRestore&&input.stepId===d.onRestore.undoneStepId&&r.restore.undoneStepId===d.onRestore.undoneStepId&&r.restore.actorId===d.actorTags[d.onRestore.actorTag]){
          p.undoWitness={
            actorTag:d.onRestore.actorTag,undoneStepId:r.restore.undoneStepId,rootCommandId:r.restore.undoneRootCommandId,receiptId:r.receiptId,checkpointRef:r.restore.checkpointRef,branchId:r.branchAfter
          };
          p.stepId=d.onRestore.nextStepId;
          p.status='running'
        }
        present(d,p,s)
      } else if(r.kind==='ui'){
        p.pendingIntent=clone(s.uiIntent)
      } else p.pendingIntent=null;
      if(d.mode==='advisory'&&s.terminalFacts.normalEnded){
        p.status='abandoned';
        p.pendingEffects=[];
        effect(d,p,s,'clearHighlight');
        p.holdAutoPhase=false;
        return {
          progress:p,effects:clone(p.pendingEffects)
        }
      }
      if(d.mode==='learning'&&['running','ready-for-debrief'].includes(p.status)&&(!s.terminalFacts.playerAlive||s.terminalFacts.unavailableRequiredActorTags.length>0)){
        p.status='lesson-failed';
        p.pendingEffects=[];
        effect(d,p,s,'failLearning',d.terminal.failureMessageKey,null);
        effect(d,p,s,'offerRecovery',d.terminal.failureMessageKey,null);
        p.holdAutoPhase=false;
        return {
          progress:p,effects:clone(p.pendingEffects)
        }
      }
      const ack=r.kind==='ui'&&r.ui.type==='acknowledgeInstruction'&&r.ui.stepId===p.stepId?r.ui.action:null;
      if(ack==='exit'){
        p.status='abandoned';
        effect(d,p,s,'clearHighlight')
      } else if(ack==='repeat'){
        effect(d,p,s,'requestRepeat',current(d,p).messageKey)
      } else if(p.status==='ready-for-debrief'){
        if(ack==='debrief'){
          p.status='lesson-complete';
          effect(d,p,s,'completeLearning',d.terminal.completeMessageKey)
        }
      } else if(p.status==='running'){
        if(ack==='continue'&&p.recoveryOffered&&current(d,p).recovery?.next){
          p.stepId=current(d,p).recovery.next;
          p.recoveryOffered=false;
          present(d,p,s)
        }
        let transitions=0;
        while(p.status==='running'){
          const step=current(d,p);
          if(step.category==='debrief'){
            need(d.terminal.requiredStepIds.every(id=>p.proofs.some(x=>x.stepId===id)),'INCOMPLETE_DEBRIEF');
            p.status='ready-for-debrief';
            effect(d,p,s,'readyForDebrief',d.terminal.readyMessageKey);
            break
          }
          if(step.category==='exit'){
            p.status='abandoned';
            effect(d,p,s,'clearHighlight');
            break
          }
          const alt=step.alternatives.find(a=>evaluate(a.when,d,p,r,s));
          const done=alt!==undefined||evaluate(step.completeWhen,d,p,r,s);
          if(!done){
            if(step.recovery&&r.kind==='gameplay'&&r.accepted){
              p.recoveryOffered=true;
              effect(d,p,s,'offerRecovery',step.recovery.messageKey)
            };
            break
          }
          if(transitions===32){
            scriptFailure(d,p,s);
            break
          }
          transitions++;
          if(!p.proofs.some(x=>x.stepId===step.id&&x.receiptId===r.receiptId))p.proofs.push({
            stepId:step.id,receiptId:r.receiptId,rootCommandId:paths(alt?alt.when:step.completeWhen).some(path=>path.some(c=>c.op==='acceptedAction')&&path.every(c=>evaluate(c,d,p,r,s)))?r.rootCommandId:null,kind:r.kind
          });
          const next=alt?alt.next:step.next;
          if(next===null){
            p.status='abandoned';
            effect(d,p,s,'clearHighlight');
            break
          }
          p.stepId=next;
          p.recoveryOffered=false;
          present(d,p,s)
        }
      }
      p.holdAutoPhase=hold(d,p);
      return {
        progress:p,effects:clone(p.pendingEffects)
      }
    }
    catch(e){
      return {
        progress:input,effects:[],error:{
          code:typeof e?.code==='string'?e.code:'INVALID_INPUT'
        }
      }
    }
  }
  function validateDefinition(d,m){
    need(m!==null&&m!==undefined,'MANIFEST_REQUIRED');
    return validate(d,m);
  }
  root.GoblinTrainingDirector=Object.freeze({
    validateDefinition,createProgress,reduceDirector
  });
})(globalThis);
