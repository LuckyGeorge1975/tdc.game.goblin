// Read-only commit capture. Never calls a resolver, pathfinder, renderer or gameplay RNG.
(function(root){
  const checkpoints=new WeakMap();
  const safe=fn=>(...args)=>{try{return fn(...args);}catch{return null;}};
  let attackCapture=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function finishFire(){
    const capture=attackCapture;attackCapture=null;
    if(capture?.ticket)try{root.GoblinPresentation.confirm(capture.ticket,snapshot(),capture.results,[],[{
      actorId:capture.actorId,targetId:capture.targetId,weaponKey:capture.weaponKey,strategic:capture.strategic,
      effects:capture.effects,...(capture.mode?{mode:capture.mode,spotterId:capture.spotterId}:{}),attack:capture.results[0]?.attack,range:capture.range,sourceEventIndex:0}]);}catch{/* Observation cannot reject or retry gameplay. */}
  }
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
    beforeResult:safe((source,attacker,target)=>{
      if(!sync())return null;
      const before=snapshot(),standalone=!!attacker&&!attackCapture;
      if(standalone)attackCapture={results:[],effects:[]};
      if(attacker&&target&&!attackCapture.ticket){
        Object.assign(attackCapture,{actorId:attacker.id,targetId:target.id,
          ...(attacker.artilleryFire?root.GoblinArtilleryWeapons.parse(attacker.artilleryChoice):{}),weaponKey:attacker.artilleryChoice??attacker.siegeWeapon??attacker.ogreSystems?.selectedWeapon??null,range:attacker.range,strategic:attacker.strategicMissile===true,
          ticket:root.GoblinPresentation.begin({type:'Fire',actorId:attacker.id,targetId:target.id},attackCapture.before??before)});
      }
      return {source,beforeRevision:root.GoblinPresentationState.stamp(before),before,attackerId:attacker?.id,
        targetId:target?.id,standalone,attack:attacker?.damage,
        animationPreference:root.GoblinPresentationPreferences?.read()??{schemaVersion:1,mode:'high'}};
    }),
    afterResult:safe((reference,outcome)=>{
      if(!reference||!root.GoblinPresentation.owns('legacy'))return;
      const state=snapshot();
      root.GoblinPresentation.synchronize(state,{...reference,afterRevision:root.GoblinPresentationState.stamp(state)});
      if(reference.attackerId&&outcome&&attackCapture){
        const index=attackCapture.results.length;
        const result={...outcome,passengers:(outcome.passengers??[]).map(({unit,outcome})=>({unitId:unit.id,outcome:clone(outcome)}))};
        attackCapture.results.push(clone({...result,attackerId:reference.attackerId,targetId:reference.targetId,attack:reference.attack}));
        const subjects=[{id:reference.targetId,result:outcome.result,targetKey:outcome.system?.key??null},
          ...(outcome.passengers??[]).map(({unit,outcome})=>({id:unit.id,result:outcome.result,passenger:true}))];
        attackCapture.effects.push(...subjects.map(subject=>({subjectId:subject.id,result:subject.result,
          role:subject.passenger?'passenger':index?'splash':subject.targetKey?'system':'primary',targetKey:subject.targetKey??null,
          sourceResultIndex:index,before:reference.before.units.find(unit=>unit.id===subject.id),after:state.units.find(unit=>unit.id===subject.id)})));
        if(reference.standalone)finishFire();
      }else root.GoblinPresentation.transition(state);
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
    const reference=root.GoblinLegacyPresentation.beforeResult('legacy-combatOutcome',args[0],args[1]);
    const result=baseCombatOutcome(...args);
    root.GoblinLegacyPresentation.afterResult(reference,result);
    return result;
  };
  for(const name of ['attack','enemyFire']){
    const base=name==='attack'?attack:enemyFire;
    const wrapped=function(...args){
      if(attackCapture)return base(...args);
      attackCapture={results:[],effects:[],before:snapshot()};
      try{return base(...args);}finally{finishFire();}
    };
    if(name==='attack')attack=wrapped;else enemyFire=wrapped;
  }
  root.GoblinLegacyPresentation.sync();
})(globalThis);
