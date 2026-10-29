(function(root){
  const WEAPONS=Object.freeze({
    main:Object.freeze({label:'MAIN BATTERY',count:1,attack:4,range:3,defense:4}),
    secondary:Object.freeze({label:'SECONDARY BATTERY',count:4,attack:3,range:2,defense:3}),
    missiles:Object.freeze({label:'MISSILES',count:2,attack:6,range:5,defense:3,expendable:true}),
    antipersonnel:Object.freeze({label:'ANTI-PERSONNEL',count:8,attack:1,range:1,defense:1,infantryOnly:true})
  });

  function createMarkIII(){
    return {model:'SIEGEBREAKER',selectedWeapon:'main',maxTreads:45,treads:45,weapons:Object.fromEntries(Object.entries(WEAPONS).map(([key,spec])=>[key,{...spec,destroyed:0,remaining:spec.count,firedThisPhase:0}]))};
  }
  function weaponRemaining(weapon){return Math.max(0,Math.min(weapon.remaining,weapon.count-weapon.destroyed))}
  function weaponReady(weapon){return weapon.expendable?weaponRemaining(weapon):Math.max(0,weaponRemaining(weapon)-(weapon.firedThisPhase||0))}
  function recordFire(weapon){if(weapon.expendable)weapon.remaining=Math.max(0,weaponReady(weapon)-1);else weapon.firedThisPhase=(weapon.firedThisPhase||0)+1}
  function resetFireState(state){Object.values(state.weapons).forEach(weapon=>{weapon.firedThisPhase=0})}
  function movementForTreads(treads){return treads>=31?3:treads>=16?2:treads>0?1:0}
  function targets(state){
    return [...Object.entries(state.weapons).filter(([,weapon])=>weaponRemaining(weapon)>0).map(([key,weapon])=>({key,label:weapon.label,defense:weapon.defense,type:'weapon'})),{key:'treads',label:'TREADS',defense:null,type:'treads'}];
  }
  function chooseTarget(state){
    const priority=['missiles','main','secondary','treads','antipersonnel'];
    return priority.map(key=>targets(state).find(target=>target.key===key)).find(Boolean)||null;
  }
  function chooseTargetSkippingDepletedTreads(state){
    const available=targets(state).filter(target=>target.key!=='treads'||state.treads>0);
    const priority=['missiles','main','secondary','treads','antipersonnel'];
    return priority.map(key=>available.find(target=>target.key===key)).find(Boolean)||null;
  }
  function applyHit(state,key,result,attackStrength=0){
    if(key==='treads'){
      const loss=result==='X'?Math.min(state.treads,Math.max(0,attackStrength)):0;
      state.treads-=loss;
      return {result,loss,remaining:state.treads};
    }
    const weapon=state.weapons[key];
    if(!weapon)return {result:'NE',loss:0,remaining:0};
    const loss=result==='X'&&weaponRemaining(weapon)>0?1:0;
    weapon.destroyed=Math.min(weapon.count,weapon.destroyed+loss);
    return {result,loss,remaining:weaponRemaining(weapon)};
  }
  function isHelpless(state){return state.treads<=0&&Object.values(state.weapons).every(weapon=>weaponRemaining(weapon)<=0)}
  function summary(state){
    return {movement:movementForTreads(state.treads),treads:`${state.treads}/${state.maxTreads}`,weapons:Object.fromEntries(Object.entries(state.weapons).map(([key,weapon])=>[key,`${weaponRemaining(weapon)}/${weapon.count}`]))};
  }
  // Additive catalog API. Historical MkIII functions above stay byte-identical.
  const CATALOG_SYSTEM_VERSION='catalog-systems-state-v1';
  const catalogRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const catalogSame=(a,b)=>{
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&catalogSame(a[k],b[k]));
  };
  function catalogReject(code){const error=new Error(code);error.code=code;throw error}
  function catalogKeys(value,keys,code){if(!catalogRecord(value)||!catalogSame(Object.keys(value).sort(),[...keys].sort()))catalogReject(code)}
  function catalogInt(value,min,max,code){if(!Number.isSafeInteger(value)||value<min||value>max)catalogReject(code)}
  function catalogClone(value){return JSON.parse(JSON.stringify(value))}
  function catalogFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(catalogFreeze);Object.freeze(value)}return value}
  function catalogBinding(registry,unitId){
    if(!catalogRecord(registry)||registry.schemaVersion!==1||registry.dataVersion!=='catalog-approved-data-v1'||
      registry.targetProfile!=='full-catalog-approved-v1'||typeof registry.targetActive!=='boolean'||
      registry.provenance?.approvedProposalSha256!=='44b9e4f473cc3fd83eb41183d1e2e70fd29078875e2f7132995bab6ba70b5d57'||
      !Array.isArray(registry.profile?.unitKeys)||registry.profile.unitKeys.length!==26||
      !catalogSame(Object.keys(registry.units??{}),registry.profile.unitKeys)||
      typeof unitId!=='string'||!Object.hasOwn(registry.units,unitId))catalogReject('INVALID_CATALOG_SYSTEM_REGISTRY');
    const record=registry.units[unitId];
    catalogKeys(record,['catalogId','legacy','target','provenance'],'INVALID_CATALOG_UNIT_RECORD');
    if(record.catalogId!==`U${String(registry.profile.unitKeys.indexOf(unitId)+1).padStart(2,'0')}`||
      !catalogRecord(record.target)||!Array.isArray(record.legacy)||record.legacy.length!==7||
      record.provenance?.approvedProposalSha256!==registry.provenance.approvedProposalSha256)catalogReject('INVALID_CATALOG_UNIT_RECORD');
    const target=record.target,model=target.systemDefinitionRef;
    if(!['mkIII','mkV','vulcan','ninja'].includes(model)||target.system!==model||target.mode!=='ogre'||
      target.damageModel!=='system-components-v1'||target.movementKind!=='tread-thresholds'||
      ['hp','maxHp','attack','range','defense','infantry'].some(k=>Object.hasOwn(target,k)))catalogReject('UNSUPPORTED_CATALOG_SYSTEM_UNIT');
    const definition=registry.systemDefinitions?.[model],classes=registry.definitions?.weaponClasses;
    catalogKeys(definition,['model','mode','maxTreads','initialTreads','movementBands','weaponCounts','components','fireRuleRef','componentD','componentX','treadHit','destroyedWhen','genericHp','infantryClassification'],'INVALID_CATALOG_SYSTEM_DEFINITION');
    if(definition.model!==model||definition.mode!=='ogre'||definition.genericHp!==false||definition.infantryClassification!==false||
      definition.componentD!=='no-effect'||definition.componentX!=='destroy-one'||definition.fireRuleRef!=='system-fire-v1'||
      !catalogSame(definition.destroyedWhen,{treads:0,allUsableModulesGone:true})||
      !catalogSame(definition.treadHit,{ratio:'1-1',successfulFaces:[5,6],loss:'attack-up-to-current-treads'}))catalogReject('INVALID_CATALOG_SYSTEM_DEFINITION');
    catalogInt(definition.maxTreads,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_TREADS');
    if(definition.initialTreads!==definition.maxTreads||target.tread!==definition.maxTreads)catalogReject('INVALID_CATALOG_TREADS');
    if(!Array.isArray(definition.movementBands)||!definition.movementBands.length||!catalogSame(target.movement,definition.movementBands.map(b=>b.movement)))catalogReject('INVALID_CATALOG_MOVEMENT');
    const sorted=[];
    for(const band of definition.movementBands){
      catalogKeys(band,['minTreads','maxTreads','movement'],'INVALID_CATALOG_MOVEMENT');
      catalogInt(band.minTreads,0,definition.maxTreads,'INVALID_CATALOG_MOVEMENT');
      catalogInt(band.maxTreads,band.minTreads,definition.maxTreads,'INVALID_CATALOG_MOVEMENT');
      catalogInt(band.movement,0,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_MOVEMENT');sorted.push(band);
    }
    sorted.sort((a,b)=>a.minTreads-b.minTreads);
    if(sorted[0].minTreads!==0||sorted.at(-1).maxTreads!==definition.maxTreads||sorted.some((b,i)=>i&&b.minTreads!==sorted[i-1].maxTreads+1))catalogReject('INVALID_CATALOG_MOVEMENT');
    const classKeys=['main','secondary','missiles','antipersonnel'];
    catalogKeys(classes,classKeys,'INVALID_CATALOG_WEAPON_CLASSES');catalogKeys(definition.weaponCounts,classKeys,'INVALID_CATALOG_WEAPON_COUNTS');
    for(const key of classKeys){
      const spec=classes[key];catalogKeys(spec,['attack','range','defense','expendable','infantryOnly'],'INVALID_CATALOG_WEAPON_CLASS');
      catalogInt(spec.attack,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_WEAPON_CLASS');catalogInt(spec.range,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_WEAPON_CLASS');catalogInt(spec.defense,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_WEAPON_CLASS');
      if(typeof spec.expendable!=='boolean'||typeof spec.infantryOnly!=='boolean')catalogReject('INVALID_CATALOG_WEAPON_CLASS');
      catalogInt(definition.weaponCounts[key],0,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_WEAPON_COUNTS');
    }
    if(!catalogSame([target.mainBatteries,target.secondaryBatteries,target.missiles,target.antipersonnel],classKeys.map(k=>definition.weaponCounts[k])))catalogReject('INVALID_CATALOG_WEAPON_COUNTS');
    if(!Array.isArray(definition.components))catalogReject('INVALID_CATALOG_COMPONENTS');
    const seen=new Set();
    for(const component of definition.components){
      if(!catalogRecord(component)||typeof component.id!=='string'||!component.id||seen.has(component.id)||component.id==='treads')catalogReject('INVALID_CATALOG_COMPONENT_ID');seen.add(component.id);
      if(component.kind==='weapon'){
        catalogKeys(component,['id','kind','weaponClassRef'],'INVALID_CATALOG_COMPONENT');
        if(!Object.hasOwn(classes,component.weaponClassRef))catalogReject('INVALID_CATALOG_COMPONENT');
      }else if(component.kind==='tool'){
        catalogKeys(component,['id','kind','defense','usableForSurvival'],'INVALID_CATALOG_COMPONENT');
        catalogInt(component.defense,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_COMPONENT');if(component.usableForSurvival!==true)catalogReject('INVALID_CATALOG_COMPONENT');
      }else if(component.kind==='drone-bay'){
        catalogKeys(component,['id','kind','defense','dronesMax','usableForSurvival'],'INVALID_CATALOG_COMPONENT');
        catalogInt(component.defense,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_COMPONENT');catalogInt(component.dronesMax,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_COMPONENT');if(component.usableForSurvival!==false)catalogReject('INVALID_CATALOG_COMPONENT');
      }else catalogReject('INVALID_CATALOG_COMPONENT');
    }
    for(const key of classKeys)if(definition.components.filter(c=>c.kind==='weapon'&&c.weaponClassRef===key).length!==definition.weaponCounts[key])catalogReject('INVALID_CATALOG_WEAPON_COUNTS');
    const priority=registry.definitions?.missile?.['hex-missile-v1']?.systemTargetPriority;
    if(!catalogSame(priority,['missiles','main','secondary','positive-treads','antipersonnel','tools','bays']))catalogReject('INVALID_CATALOG_TARGET_PRIORITY');
    return {record,definition,classes,priority};
  }
  function catalogRules(binding){return {definition:catalogClone(binding.definition),weaponClasses:catalogClone(binding.classes),targetPriority:catalogClone(binding.priority)}}
  function createCatalogSystem(registry,unitId){
    const binding=catalogBinding(registry,unitId);
    return catalogFreeze({version:CATALOG_SYSTEM_VERSION,dataVersion:registry.dataVersion,dataProfile:registry.targetProfile,unitId,catalogId:binding.record.catalogId,model:binding.definition.model,turn:1,maxTreads:binding.definition.maxTreads,treads:binding.definition.initialTreads,
      rules:catalogRules(binding),components:binding.definition.components.map(c=>({id:c.id,destroyed:false,spent:false,fired:false,readyFromTurn:1}))});
  }
  function validateCatalogSystem(state,registry){
    catalogKeys(state,['version','dataVersion','dataProfile','unitId','catalogId','model','turn','maxTreads','treads','rules','components'],'INVALID_CATALOG_SYSTEM_STATE');
    const binding=catalogBinding(registry,state.unitId);
    if(state.version!==CATALOG_SYSTEM_VERSION||state.dataVersion!==registry.dataVersion||state.dataProfile!==registry.targetProfile||state.catalogId!==binding.record.catalogId||state.model!==binding.definition.model||state.maxTreads!==binding.definition.maxTreads||!catalogSame(state.rules,catalogRules(binding)))catalogReject('CATALOG_SYSTEM_BINDING_MISMATCH');
    catalogInt(state.turn,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_TURN');catalogInt(state.treads,0,state.maxTreads,'INVALID_CATALOG_TREADS');
    if(!Array.isArray(state.components)||state.components.length!==binding.definition.components.length)catalogReject('INVALID_CATALOG_COMPONENT_STATE');
    state.components.forEach((slot,i)=>{
      catalogKeys(slot,['id','destroyed','spent','fired','readyFromTurn'],'INVALID_CATALOG_COMPONENT_STATE');
      const spec=binding.definition.components[i];
      if(slot.id!==spec.id||typeof slot.destroyed!=='boolean'||typeof slot.spent!=='boolean'||typeof slot.fired!=='boolean')catalogReject('INVALID_CATALOG_COMPONENT_STATE');
      catalogInt(slot.readyFromTurn,1,state.turn+1,'INVALID_CATALOG_COMPONENT_STATE');
      const weapon=spec.kind==='weapon'?binding.classes[spec.weaponClassRef]:null;
      if((slot.spent&&(!weapon?.expendable||slot.destroyed))||(slot.fired&&(!weapon||weapon.expendable)))catalogReject('INVALID_CATALOG_COMPONENT_STATE');
    });
    return true;
  }
  function catalogSlot(state,id){const index=state.components.findIndex(c=>c.id===id);if(index<0)catalogReject('UNKNOWN_CATALOG_COMPONENT');return {slot:state.components[index],spec:state.rules.definition.components[index]}}
  function catalogMovement(state,registry){validateCatalogSystem(state,registry);return state.rules.definition.movementBands.find(b=>state.treads>=b.minTreads&&state.treads<=b.maxTreads).movement}
  function catalogIsHelpless(state,registry){
    validateCatalogSystem(state,registry);
    return state.treads===0&&state.components.every((slot,i)=>{
      const spec=state.rules.definition.components[i];
      return spec.kind==='drone-bay'||slot.destroyed||slot.spent;
    });
  }
  function catalogWeaponReady(state,id,registry){
    validateCatalogSystem(state,registry);const {slot,spec}=catalogSlot(state,id);
    if(spec.kind!=='weapon')return 0;
    return !slot.destroyed&&!slot.spent&&!slot.fired&&slot.readyFromTurn<=state.turn?1:0;
  }
  function catalogTargets(state,registry){
    validateCatalogSystem(state,registry);
    const list=state.components.flatMap((slot,i)=>{
      if(slot.destroyed||slot.spent)return [];
      const spec=state.rules.definition.components[i],weapon=spec.kind==='weapon'?state.rules.weaponClasses[spec.weaponClassRef]:null;
      return [{key:slot.id,id:slot.id,type:spec.kind,defense:weapon?.defense??spec.defense,...(weapon?{weaponClass:spec.weaponClassRef}:{})}];
    });
    if(state.treads>0)list.push({key:'treads',id:'treads',type:'treads',defense:null});return catalogFreeze(list);
  }
  function catalogChooseTarget(state,registry){
    const list=catalogTargets(state,registry);
    for(const key of state.rules.targetPriority){
      const match=list.find(t=>key==='positive-treads'?t.type==='treads':key==='tools'?t.type==='tool':key==='bays'?t.type==='drone-bay':t.weaponClass===key);
      if(match)return match;
    }
    return null;
  }
  function catalogEffectsAfter(before,next,registry,cause){
    return !catalogIsHelpless(before,registry)&&catalogIsHelpless(next,registry)?[
      {type:'CatalogPlatformHelpless',unitId:next.unitId,...(cause?{cause:catalogClone(cause)}:{})},
      {type:'DestroyPlatformCargo',unitId:next.unitId,...(cause?{cause:catalogClone(cause)}:{})}
    ]:[];
  }
  function catalogApplyHit(state,request,registry){
    validateCatalogSystem(state,registry);
    catalogKeys(request,['targetId','result','attackStrength','cause'],'INVALID_CATALOG_HIT');
    catalogKeys(request.cause,['kind','commandId','attackerId'],'INVALID_CATALOG_DAMAGE_CAUSE');
    if(!['direct','area'].includes(request.cause.kind)||['commandId','attackerId'].some(k=>typeof request.cause[k]!=='string'||!request.cause[k]))catalogReject('INVALID_CATALOG_DAMAGE_CAUSE');
    if(!['NE','D','X'].includes(request.result)||typeof request.targetId!=='string')catalogReject('INVALID_CATALOG_HIT');
    catalogInt(request.attackStrength,0,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_ATTACK');
    if(!catalogTargets(state,registry).some(t=>t.id===request.targetId))catalogReject('CATALOG_TARGET_UNAVAILABLE');
    const next=catalogClone(state),effects=[];let loss=0,remaining;
    if(request.targetId==='treads'){
      loss=request.result==='X'?Math.min(state.treads,request.attackStrength):0;next.treads-=loss;remaining=next.treads;
      if(loss)effects.push({type:'CatalogTreadsChanged',unitId:state.unitId,loss,remaining,cause:catalogClone(request.cause)});
    }else{
      const {slot,spec}=catalogSlot(next,request.targetId);
      if(request.result==='X'){
        slot.destroyed=true;loss=1;
        effects.push({type:'CatalogComponentDestroyed',unitId:state.unitId,componentId:slot.id,kind:spec.kind,cause:catalogClone(request.cause)});
        if(spec.kind==='drone-bay')effects.push({type:'DestroyBayCargo',unitId:state.unitId,bayId:slot.id,cause:catalogClone(request.cause)});
      }
      remaining=slot.destroyed?0:1;
    }
    effects.push(...catalogEffectsAfter(state,next,registry,request.cause));
    validateCatalogSystem(next,registry);
    return catalogFreeze({state:next,effects,hit:{targetId:request.targetId,result:request.result,loss,remaining,cause:catalogClone(request.cause)}});
  }
  function catalogRecordFire(state,componentId,registry){
    validateCatalogSystem(state,registry);
    const {spec}=catalogSlot(state,componentId);
    if(spec.kind!=='weapon'||!catalogWeaponReady(state,componentId,registry)||catalogIsHelpless(state,registry))catalogReject('CATALOG_WEAPON_UNAVAILABLE');
    const weapon=state.rules.weaponClasses[spec.weaponClassRef],next=catalogClone(state),slot=catalogSlot(next,componentId).slot;
    if(weapon.expendable)slot.spent=true;else slot.fired=true;
    const effects=[{type:'CatalogWeaponFired',unitId:state.unitId,componentId,turn:state.turn,expendable:weapon.expendable},...catalogEffectsAfter(state,next,registry)];
    validateCatalogSystem(next,registry);
    return catalogFreeze({state:next,effects,shot:{componentId,weaponClass:spec.weaponClassRef,attack:weapon.attack,range:weapon.range,infantryOnly:weapon.infantryOnly,expendable:weapon.expendable}});
  }
  function catalogResetFire(state,nextTurn,registry){
    validateCatalogSystem(state,registry);
    catalogInt(nextTurn,1,Number.MAX_SAFE_INTEGER,'INVALID_CATALOG_TURN');
    if(nextTurn!==state.turn+1)catalogReject('INVALID_CATALOG_TURN');
    const next=catalogClone(state);next.turn=nextTurn;next.components.forEach(slot=>{slot.fired=false});validateCatalogSystem(next,registry);
    return catalogFreeze({state:next,effects:[{type:'CatalogTurnStarted',unitId:state.unitId,turn:nextTurn}]});
  }
  function catalogSummary(state,registry){
    validateCatalogSystem(state,registry);
    const counts={};
    state.rules.definition.components.forEach((spec,i)=>{
      const key=spec.kind==='weapon'?spec.weaponClassRef:spec.kind==='tool'?'tools':'bays',slot=state.components[i];
      const entry=counts[key]??={initial:0,intact:0,ready:0,spent:0,destroyed:0};entry.initial++;
      if(slot.destroyed)entry.destroyed++;if(slot.spent)entry.spent++;
      if(!slot.destroyed&&!slot.spent){entry.intact++;if(spec.kind==='weapon'?catalogWeaponReady(state,slot.id,registry):slot.readyFromTurn<=state.turn)entry.ready++;}
    });
    return catalogFreeze({version:state.version,unitId:state.unitId,model:state.model,turn:state.turn,treads:state.treads,maxTreads:state.maxTreads,movement:catalogMovement(state,registry),helpless:catalogIsHelpless(state,registry),components:counts});
  }

  root.GoblinSystems=Object.freeze({WEAPONS,createMarkIII,weaponRemaining,weaponReady,recordFire,resetFireState,movementForTreads,targets,chooseTarget,chooseTargetSkippingDepletedTreads,applyHit,isHelpless,summary,CATALOG_SYSTEM_VERSION,createCatalogSystem,validateCatalogSystem,catalogMovement,catalogTargets,catalogChooseTarget,catalogApplyHit,catalogWeaponReady,catalogRecordFire,catalogResetFire,catalogIsHelpless,catalogSummary});
})(globalThis);
