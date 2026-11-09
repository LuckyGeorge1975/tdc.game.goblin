// Compact controls and command composition; every action still goes through the authoritative query.
(function(root){
 const api=()=>root.GoblinSpecialistsRuntime;
 const t=(key,params={})=>root.GoblinLanguage?.t(key,params)??key;
 const alive=u=>root.GoblinUnitLife.alive(u);
 const isArt=u=>u?.catalogFire?.ruleRef==='artillery-spotter-v1';
 function weaponLabel(u,w){return u.catalogSystems?api().slotLabel(u,w.id):u.catalogFire?.ruleRef==='siege-tank-fire-budget-v1'?GoblinSiegeWeapons.label(w.id):t('v2.ui.fire')}
 function statusLabel(u,w){const slot=u.catalogSystems?.components.find(c=>c.id===w.id);if(slot?.destroyed)return t('v2.ui.destroyed');if(slot&&slot.readyFromTurn>u.catalogSystems.turn)return t('v2.specialists.readyFromTurn',{turn:slot.readyFromTurn});return w.ready?t('v2.ui.ready'):t('v2.specialists.spent')}
 function commandLabel(command){
  if(['Move','Embark','Unload'].includes(command.type))return t('v2.ui.'+({Move:'move',Embark:'embark',Unload:'unload'}[command.type]));
  if(command.type!=='Engineer')return command.type==='CatalogRam'?t('v2.ui.ram'):command.type==='CatalogLoad'?t('v2.ui.embark'):command.type==='CatalogDeploy'?t('v2.ui.catalog.deployDrone'):t('v2.ui.fire');
  const key=command.job==='repair-vehicle'?(command.option==='disabled'?'repair-disabled':'repair-hp'):command.job;
  return t('v2.engineer.'+key);
 }
 function addLoadOptions(result,cargo,carrier){
  if(dist(cargo,carrier)!==1)return;
  const rules=api().rules(cargo),drone=rules?.cargoRef==='drone-cargo-v1';
  const label=t('v2.ui.embark')+' · '+cargo.name;
  if(drone&&carrier.droneBays){
   for(const bayId of carrier.droneBays)
    result.push({command:{type:'CatalogLoad',actorId:cargo.id,carrierId:carrier.id,bayId},
     label:label+' · '+api().slotLabel(carrier,bayId),transport:true});
  }else if(carrier.transportCapacity&&(drone||rules?.passengerRef==='infantry-passenger-v1')){
   result.push({command:{type:'Embark',actorId:cargo.id,carrierId:carrier.id,x:carrier.x,y:carrier.y},label,transport:true});
  }
 }
 function commands(state,actor,cell){
  if(!actor||!cell)return [];
  const target=state.units.find(u=>alive(u)&&!u.embarkedOn&&u.x===cell.x&&u.y===cell.y),result=[];
  const add=(command,label=commandLabel(command),attack)=>result.push({command,label,confirmSplash:command.type==='CatalogHexFire',...(attack&&{attack})});
  const job=(name,target,option=null,label)=>add({type:'Engineer',actorId:actor.id,job:name,target,option},label);
  if(state.turnPhase==='fire'){
   if(root.GoblinCatalogFullRuntime?.active()&&actor.catalogId==='U13'){
    add({type:'CatalogHexFire',actorId:actor.id,...cell},t('v2.ui.missile'));
    return result;
   }
   if(!target||target.team===actor.team)return result;
   const targets=target.catalogSystems?GoblinSystems.catalogTargets(target.catalogSystems,api().registry()).map(c=>
    ({kind:'component',runtimeUnitId:target.id,componentId:c.id})): [{kind:'unit',runtimeUnitId:target.id}];
   const options=isArt(actor)?[
    {weaponId:null,mode:'direct',spotterId:null,label:t('v2.ui.artillery.direct'),attack:{name:t('v2.ui.artillery.direct'),icon:'fire'}},
    ...state.units.filter(u=>alive(u)&&!u.disabled&&!u.embarkedOn&&u.team===actor.team&&u.id!==actor.id).map(u=>
     ({weaponId:null,mode:'indirect',spotterId:u.id,label:t('v2.ui.artillery.indirectVia',{spotter:u.name}),
      attack:{name:t('v2.ui.artillery.indirectVia',{spotter:u.name}),icon:'indirect'}}))
   ]:api().weapons(actor).map(w=>{
    const name=weaponLabel(actor,w);
    return {weaponId:w.id,mode:'direct',spotterId:null,label:`${name} · A${w.attack} R${w.range} · ${statusLabel(actor,w)}`,
     attack:{name,icon:w.weaponClass??(w.id?.startsWith('ap-')?'antipersonnel':w.id?.startsWith('main-')?'main':'fire'),
      shots:w.id==='main-both'?null:w.ready}};
   });
   for(const {label,attack,...weapon} of options)for(const aim of targets){
    const command={type:'CatalogFire',actorId:actor.id,target:aim,...weapon};
    if(aim.kind==='component'){
     const componentLabel=api().slotLabel(target,aim.componentId);
     result.push({command,label:`${label} · ${componentLabel}`,weaponLabel:label,componentLabel,attack});
    }else add(command,label,attack);
   }
   return result;
  }
  if(!['movement','gev'].includes(state.turnPhase))return result;
  if(!target)add({type:'Move',actorId:actor.id,...cell});
  if(state.turnPhase==='gev')return result;
  if(target?.team!==actor.team&&target&&actor.catalogSystems&&['U01','U20'].includes(actor.catalogId))add({type:'CatalogRam',actorId:actor.id,targetId:target.id,...cell});
  if(target?.team===actor.team&&target.id!==actor.id){
   addLoadOptions(result,actor,target);
   addLoadOptions(result,target,actor);
   if(api().rules(actor)?.engineeringRef){
    if(target.catalogSystems){
     job('repair-treads',{kind:'unit',runtimeUnitId:target.id});
     for(const part of target.catalogSystems.components.filter(c=>c.destroyed&&!c.spent))
      job('repair-component',{kind:'component',runtimeUnitId:target.id,componentId:part.id},null,
       `${t('v2.engineer.repair-component')} · ${api().slotLabel(target,part.id)}`);
    }
    else {job('repair-vehicle',{kind:'unit',runtimeUnitId:target.id},'disabled');job('repair-vehicle',{kind:'unit',runtimeUnitId:target.id},'hp')}
   }
  }
  if(!target){
   if((actor.droneBays||actor.transportCapacity)&&dist(actor,cell)===1){
    for(const cargo of state.units.filter(u=>alive(u)&&u.embarkedOn===actor.id)){
     const command=actor.droneBays?{type:'CatalogDeploy',actorId:actor.id,cargoId:cargo.id,bayId:cargo.cargoBay,...cell}:
      {type:'Unload',actorId:actor.id,cargoId:cargo.id,...cell};
     const label=actor.droneBays?t('v2.ui.catalog.deployDrone')+' · '+api().slotLabel(actor,cargo.cargoBay):t('v2.ui.unload');
     result.push({command,label:label+' · '+cargo.name,transport:true});
    }
   }
   if(api().rules(actor)?.engineeringRef){const terrain=terrainTypeAt(cell.x,cell.y),d=api().registry().definitions.engineering['engineering-actions-v1'];if(d.clear.some(c=>c.from===terrain))job('clear',{kind:'cell',...cell});if(d.buildPosition.from.includes(terrain))job('position',{kind:'cell',...cell});if(terrain===d.buildBridge.from)job('bridge',{kind:'cell',...cell});for(const wreck of state.units.filter(u=>root.GoblinUnitLife.dead(u)&&!u.embarkedOn&&!u.salvaged&&u.x===cell.x&&u.y===cell.y))job('salvage',{kind:'wreck',wreckId:api().wreckKey(wreck)})}
  }
  return result;
 }
 function renderSystemFacts(host,unit){
  const summary=unit.systemSummary??GoblinSystems.catalogSummary(unit.catalogSystems,api().registry());const facts=[];
  facts.push([t('v2.ui.treads'),`${summary.treads}/${summary.maxTreads}`]);
  for(const [key,c] of Object.entries(summary.components)){const label=t(key==='tools'?'v2.specialists.tool':key==='bays'?'v2.specialists.bay':`v2.ui.weapon.${key}`);facts.push([label,`${t('v2.specialists.intact',{current:c.intact,max:c.initial})} · ${t('v2.specialists.readyCount',{count:c.ready})}${key==='missiles'?' · '+t('v2.specialists.resource',{label:t('v2.specialists.ammo'),current:c.intact,max:c.initial}):''}`])}
  if(unit.materialMax!==undefined)facts.push([t('v2.specialists.material'),`${unit.material}/${unit.materialMax}`]);
  for(const [label,value] of facts){const row=document.createElement('div');row.className='v2-system-row';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value;row.append(a,b);host.appendChild(row)}
 }
 root.GoblinSpecialistsUI=Object.freeze({commands,renderSystemFacts});
})(globalThis);
