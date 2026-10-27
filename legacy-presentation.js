// Read-only commit capture. Never calls a resolver, pathfinder, renderer or gameplay RNG.
(function(root){
  const checkpoints=new WeakMap();
  const safe=fn=>(...args)=>{try{return fn(...args);}catch{return null;}};
  function snapshot(){
    return {units:units.map(({moveFrom,justHit,...unit})=>({...unit,
      visualKey:root.UnitVisuals.artKey(unit)})),terrain:[...terrain],terrainTypes:[...terrainTypes],
      turn,phase:turnPhase,activeTeam:phase,gameOver};
  }
  function sync(){
    if(!legacySession||root.IronDustBrowserV2?.active)return false;
    const state=snapshot();
    root.GoblinPresentation.bind({runtime:'legacy',scenarioId:legacySession.scenarioId,
      scenarioVersion:legacySession.scenarioVersion,ruleProfileId:legacySession.ruleProfileId,
      sourceStateVersion:'legacy-live-v1',sessionId:legacySession.sessionId},state);
    root.GoblinPresentation.synchronize(state);
    return true;
  }
  root.GoblinLegacyPresentation=Object.freeze({
    sync:safe(sync),
    beforeResult:safe(source=>sync()?{source,beforeRevision:root.GoblinPresentationState.stamp(snapshot()),
      animationPreference:root.GoblinPresentationPreferences?.read()??{schemaVersion:1,mode:'high'}}:null),
    afterResult:safe(reference=>{
      if(!reference||!root.GoblinPresentation.owns('legacy'))return;
      const state=snapshot();
      root.GoblinPresentation.synchronize(state,{...reference,afterRevision:root.GoblinPresentationState.stamp(state)});
      root.GoblinPresentation.transition(state);
    }),
    begin:safe((actor,path,kind,target)=>{
      if(!sync())return null;
      return {ticket:root.GoblinPresentation.begin({type:kind==='ram'?'Ram':'Move',actorId:actor.id,
        to:{x:path.at(-1).x,y:path.at(-1).y},...(target?{targetId:target.id}:{})},snapshot()),
        actorId:actor.id,kind,targetId:target?.id??null,
        path:JSON.parse(JSON.stringify(path)),from:{x:actor.x,y:actor.y}};
    }),
    confirm:safe(capture=>{
      if(!capture)return;
      const after=snapshot(),actor=after.units.find(unit=>unit.id===capture.actorId);
      const result={type:capture.kind==='ram'?'RamResolved':'UnitMoved',actorId:actor.id,
        from:capture.from,to:{x:actor.x,y:actor.y},path:capture.path,
        ...(capture.targetId?{targetId:capture.targetId,
          targetHp:after.units.find(unit=>unit.id===capture.targetId)?.hp,actorHp:actor.hp}:{})};
      root.GoblinPresentation.confirm(capture.ticket,after,[result],[{...result,
        kind:capture.kind,sourceEventIndex:0}]);
    }),
    checkpoint:safe(snapshotKey=>{if(sync())checkpoints.set(snapshotKey,root.GoblinPresentation.read());}),
    beforeUndo:safe(()=>root.GoblinPresentation.cancel()),
    afterUndo:safe(snapshotKey=>{if(sync())root.GoblinPresentation.rewind(checkpoints.get(snapshotKey),snapshot());})
  });
  // The later roll-cache wrapper still invokes this resolver exactly once.
  const baseCombatOutcome=combatOutcome;
  combatOutcome=function(...args){
    const reference=root.GoblinLegacyPresentation.beforeResult('legacy-combatOutcome');
    const result=baseCombatOutcome(...args);
    root.GoblinLegacyPresentation.afterResult(reference);
    return result;
  };
  root.GoblinLegacyPresentation.sync();
})(globalThis);
