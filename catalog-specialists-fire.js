// Additive binding adapter only. All fire decisions remain in existing capabilities.
(function(root){
  const VERSION='catalog-specialists-fire-binding-v1',DATA_VERSION='catalog-approved-data-v1',DATA_PROFILE='full-catalog-approved-v1',CAPABILITY_PROFILE='full-catalog-v1-draft';
  const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const same=(a,b)=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
  const copy=v=>JSON.parse(JSON.stringify(v));
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
  const reject=code=>{const e=new Error(code);e.code=code;throw e};
  const keys=(v,list,code)=>{if(!record(v)||!same(Object.keys(v).sort(),[...list].sort()))reject(code)};
  const id=v=>typeof v==='string'&&v.length>0;
  function targetKey(spec){
    if(spec?.kind==='unit'){keys(spec,['kind','runtimeUnitId'],'INVALID_CATALOG_FIRE_TARGET');if(!id(spec.runtimeUnitId))reject('INVALID_CATALOG_FIRE_TARGET');return JSON.stringify(['unit',spec.runtimeUnitId])}
    keys(spec,['kind','runtimeUnitId','componentId'],'INVALID_CATALOG_FIRE_TARGET');
    if(spec.kind!=='component'||!id(spec.runtimeUnitId)||!id(spec.componentId))reject('INVALID_CATALOG_FIRE_TARGET');
    return JSON.stringify(['component',spec.runtimeUnitId,spec.componentId]);
  }
  function parsedKey(value){
    let tuple;try{tuple=JSON.parse(value)}catch{reject('INVALID_CATALOG_FIRE_TARGET_KEY')}
    if(!Array.isArray(tuple)||!['unit','component'].includes(tuple[0])||tuple.length!==(tuple[0]==='unit'?2:3)||!tuple.slice(1).every(id)||JSON.stringify(tuple)!==value)reject('INVALID_CATALOG_FIRE_TARGET_KEY');return tuple;
  }
  function capability(registry,assetId,turn){
    if(registry?.schemaVersion!==1||registry.dataVersion!==DATA_VERSION||registry.targetProfile!==DATA_PROFILE||typeof registry.targetActive!=='boolean'||
      registry.provenance?.approvedProposalSha256!=='44b9e4f473cc3fd83eb41183d1e2e70fd29078875e2f7132995bab6ba70b5d57')reject('INVALID_CATALOG_FIRE_REGISTRY');
    if(!['siege-tank','long-range-battery','mobile-siege-gun'].includes(assetId))reject('UNSUPPORTED_CATALOG_FIRE_ASSET');
    const target=registry.units?.[assetId]?.target;
    if(!record(target)||!Number.isSafeInteger(target.hp)||target.hp<=0)reject('INVALID_CATALOG_FIRE_RECORD');
    const ruleRef=assetId==='siege-tank'?'siege-tank-fire-budget-v1':'artillery-spotter-v1',definition=registry.definitions?.fire?.[ruleRef];
    if(target.fireRuleRef!==ruleRef||!record(definition))reject('INVALID_CATALOG_FIRE_RULE');
    // Explicit old capability metadata projection, never a product/session header.
    const projection={schemaVersion:registry.schemaVersion,legacyProfile:registry.legacyProfile,targetProfile:CAPABILITY_PROFILE,targetActive:false,units:{[assetId]:{target:copy(target)}}};
    let state,api;
    if(assetId==='siege-tank'){
      api=root.GoblinSiegeBudget;if(!api)reject('CATALOG_FIRE_DEPENDENCY_MISSING');
      const w=api.WEAPONS,main=['main-1','main-2'],ap=['ap-1','ap-2'];
      if(!main.every(k=>w[k].attack===w[main[0]].attack&&w[k].range===w['main-both'].range)||!ap.every(k=>w[k].attack===w[ap[0]].attack&&w[k].range===w[ap[0]].range&&w[k].infantryOnly))reject('CATALOG_FIRE_CAPABILITY_MISMATCH');
      const expected={phase:'fire',mainSlots:main.length,mainAttack:w[main[0]].attack,mainRange:w[main[0]].range,combinedAttack:w['main-both'].attack,combinedRolls:1,combinedSlotCost:main.length,mainSeparateTargets:'distinct',apSlots:ap.length,apAttack:w[ap[0]].attack,apRange:w[ap[0]].range,apInfantryOnly:true,neConsumesSlot:true,neBindsMainTarget:true};
      if(!same(definition,expected))reject('CATALOG_FIRE_CAPABILITY_MISMATCH');
      state=api.createSiegeTankFireBudget(projection,CAPABILITY_PROFILE,assetId,turn);
    }else{
      api=root.GoblinArtilleryRules;if(!api)reject('CATALOG_FIRE_DEPENDENCY_MISSING');
      state=api.createArtillerySpotterProbe(projection,CAPABILITY_PROFILE,assetId,turn);
      const expected={phase:'fire',shotsPerTurn:1,setupValue:state.forceBudgetValue,setupDelayTurns:0,directOwnLos:true,indirectOccupiedEnemy:true,indirectSpotter:'living-active-allied-direct-los-not-embarked',blindFire:false,splash:false,additionalMinimumRange:null};
      if(!same(definition,expected))reject('CATALOG_FIRE_CAPABILITY_MISMATCH');
    }
    return {state,api,ruleRef,rules:{target:copy(target),definition:copy(definition)}};
  }
  function wrap(assetId,runtimeUnitId,cap){
    if(!id(runtimeUnitId))reject('INVALID_CATALOG_RUNTIME_ID');
    return freeze({version:VERSION,runtimeUnitId,assetId,dataVersion:DATA_VERSION,dataProfile:DATA_PROFILE,ruleRef:cap.ruleRef,rules:cap.rules,state:cap.state});
  }
  function createSiegeBinding(registry,assetId,runtimeUnitId,turn=1){if(assetId!=='siege-tank')reject('UNSUPPORTED_CATALOG_FIRE_ASSET');return wrap(assetId,runtimeUnitId,capability(registry,assetId,turn))}
  function createArtilleryBinding(registry,assetId,runtimeUnitId,turn=1){if(!['long-range-battery','mobile-siege-gun'].includes(assetId))reject('UNSUPPORTED_CATALOG_FIRE_ASSET');return wrap(assetId,runtimeUnitId,capability(registry,assetId,turn))}
  function validate(binding,runtimeUnitId,registry){
    keys(binding,['version','runtimeUnitId','assetId','dataVersion','dataProfile','ruleRef','rules','state'],'INVALID_CATALOG_FIRE_BINDING');
    if(binding.version!==VERSION||!id(runtimeUnitId)||binding.runtimeUnitId!==runtimeUnitId||binding.dataVersion!==DATA_VERSION||binding.dataProfile!==DATA_PROFILE)reject('CATALOG_FIRE_BINDING_MISMATCH');
    const cap=capability(registry,binding.assetId,binding.state?.turn);
    if(cap.ruleRef!==binding.ruleRef||!same(cap.rules,binding.rules))reject('CATALOG_FIRE_BINDING_MISMATCH');
    if(binding.assetId==='siege-tank'){
      cap.api.validateSiegeTankFireBudget(binding.state);binding.state.mainTargets.forEach(parsedKey);
    }else cap.api.validateArtillerySpotterProbe(binding.state);
    if(binding.state.unitId!==binding.assetId)reject('CATALOG_FIRE_BINDING_MISMATCH');return true;
  }
  function resolve(binding,runtimeUnitId,request,registry){
    validate(binding,runtimeUnitId,registry);
    if(!record(request)||request.actor?.id!==binding.assetId)reject('CATALOG_FIRE_ACTOR_MISMATCH');
    const target=parsedKey(request.target?.id);if(target[1]===runtimeUnitId)reject('CATALOG_FIRE_SELF_TARGET');
    if(target[0]==='component'&&request.target.infantry===true)reject('CATALOG_COMPONENT_IS_NOT_INFANTRY');
    if(binding.assetId!=='siege-tank'&&request.spotter!==null){
      const spotter=parsedKey(request.spotter?.id);if(spotter[0]!=='unit'||spotter[1]===runtimeUnitId)reject('CATALOG_FIRE_SELF_SPOTTER');
    }
    const cap=capability(registry,binding.assetId,binding.state.turn),result=binding.assetId==='siege-tank'?cap.api.resolveSiegeTankFire(binding.state,request):cap.api.resolveArtilleryFire(binding.state,request);
    const next=wrap(binding.assetId,runtimeUnitId,{...cap,state:result.state});validate(next,runtimeUnitId,registry);
    return freeze({state:next,attack:result.attack});
  }
  function reset(binding,runtimeUnitId,nextTurn,registry){
    validate(binding,runtimeUnitId,registry);const cap=capability(registry,binding.assetId,binding.state.turn);
    const state=binding.assetId==='siege-tank'?cap.api.resetSiegeTankFireBudget(binding.state,nextTurn):cap.api.resetArtillerySpotterProbe(binding.state,nextTurn);
    const next=wrap(binding.assetId,runtimeUnitId,{...cap,state});validate(next,runtimeUnitId,registry);return next;
  }
  root.GoblinCatalogSpecialistFire=Object.freeze({VERSION,targetKey,createSiegeBinding,createArtilleryBinding,validate,resolve,reset});
})(globalThis);
