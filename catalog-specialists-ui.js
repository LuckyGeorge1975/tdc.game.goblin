// Compact controls and command composition; every action still goes through the authoritative query.
(function(root){
 const api=()=>root.GoblinSpecialistsRuntime;
 const t=(key,params={})=>root.GoblinLanguage?.t(key,params)??key;
 const alive=u=>root.GoblinUnitLife.alive(u);
 const isArt=u=>u?.catalogFire?.ruleRef==='artillery-spotter-v1';
 function weaponLabel(u,w){return u.catalogSystems?api().slotLabel(u,w.id):u.catalogFire?.ruleRef==='siege-tank-fire-budget-v1'?GoblinSiegeWeapons.label(w.id):t('v2.ui.fire')}
 function fireCommand(actor,target,view,aggregate=false){
  let componentId=view.componentOwner===target.id?view.componentId:null;
  if(target.catalogSystems&&!componentId&&aggregate)componentId=GoblinSystems.catalogChooseTarget(target.catalogSystems,api().registry())?.id??'';
  const w=api().selectedSpec(actor,view.previewWeaponKey),mode=isArt(actor)?view.specialFireMode??'direct':'direct';
  return {type:'CatalogFire',actorId:actor.id,target:target.catalogSystems?{kind:'component',runtimeUnitId:target.id,componentId:componentId??''}:{kind:'unit',runtimeUnitId:target.id},weaponId:isArt(actor)?null:w?.id??null,mode,spotterId:mode==='indirect'?view.specialSpotterId??null:null};
 }
 function addSelect(host,label,groups,value,change){
  const row=document.createElement('label');row.className='v2-specialist-select';const title=document.createElement('span');title.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);
  for(const [group,options] of groups){const parent=group?document.createElement('optgroup'):select;if(group)parent.label=group;for(const o of options){const option=document.createElement('option');option.value=o.value;option.textContent=o.label;option.disabled=!!o.disabled;parent.appendChild(option)}if(group)select.appendChild(parent)}
  select.value=value??'';select.disabled=!!root.GoblinMovement?.busy();select.onchange=()=>change(select.value);row.append(title,select);host.appendChild(row);
 }
 function statusLabel(u,w){const slot=u.catalogSystems?.components.find(c=>c.id===w.id);if(slot?.destroyed)return t('v2.ui.destroyed');if(slot&&slot.readyFromTurn>u.catalogSystems.turn)return t('v2.specialists.readyFromTurn',{turn:slot.readyFromTurn});return w.ready?t('v2.ui.ready'):t('v2.specialists.spent')}
 function renderWeapons(host,state,actor,view,refresh){
  host.replaceChildren();host.hidden=state.turnPhase!=='fire'||state.phase!=='player'||!actor||!alive(actor);if(host.hidden)return;
  if(isArt(actor)){
   const mode=view.specialFireMode??'direct';addSelect(host,t('v2.ui.fire'),[[null,[{value:'direct',label:t('v2.ui.artillery.direct')},{value:'indirect',label:t('v2.ui.artillery.indirect')}]]],mode,value=>{view.specialFireMode=value;if(value==='direct')view.specialSpotterId=null;refresh()});
   if(mode==='indirect')addSelect(host,t('v2.ui.artillery.indirect'),[[null,[{value:'',label:t('v2.reject.artillery.spotterRequired')},...state.units.filter(u=>alive(u)&&!u.disabled&&!u.embarkedOn&&u.team===actor.team&&u.id!==actor.id).map(u=>({value:u.id,label:u.name}))]]],view.specialSpotterId,value=>{view.specialSpotterId=value||null;refresh()});
   return;
  }
  if(!actor.catalogSystems&&!actor.catalogFire){host.hidden=true;return}
  const groups=new Map(),weapons=api().weapons(actor);
  for(const w of weapons){const group=actor.catalogSystems?t(`v2.ui.weapon.${w.weaponClass}`):t('v2.ui.fire'),list=groups.get(group)??[];list.push({value:w.id,label:`${weaponLabel(actor,w)} · A${w.attack} R${w.range} · ${statusLabel(actor,w)}`,disabled:!w.ready});groups.set(group,list)}
  addSelect(host,t('v2.ui.fire'),[...groups],view.previewWeaponKey??actor.selectedSlot??actor.selectedWeapon,value=>{view.previewWeaponKey=value;refresh()});
 }
 function renderTargets(host,state,actor,target,view,refresh){
  host.replaceChildren();if(!target?.catalogSystems)return;
  let options;
  if(state.turnPhase==='fire'&&target.team!==actor.team)options=GoblinSystems.catalogTargets(target.catalogSystems,api().registry()).map(c=>({value:c.id,label:`${api().slotLabel(target,c.id)}${c.type==='treads'?` · ${target.catalogSystems.treads}/${target.catalogSystems.maxTreads}`:` · D${c.defense+TerrainRules.coverBonus(terrainTypeAt(target.x,target.y))}`}`}));
  else if(state.turnPhase==='movement'&&target.team===actor.team&&api().rules(actor)?.engineeringRef)options=target.catalogSystems.components.filter((c,i)=>{const d=target.catalogSystems.rules.definition.components[i];return c.destroyed&&!c.spent&&(d.kind!=='weapon'||!target.catalogSystems.rules.weaponClasses[d.weaponClassRef].expendable)}).map(c=>({value:c.id,label:api().slotLabel(target,c.id)}));
  if(!options)return;addSelect(host,t('v2.specialists.componentTarget'),[[null,[{value:'',label:t('v2.specialists.reject.componentRequired')},...options]]],view.componentOwner===target.id?view.componentId:'',value=>{view.componentOwner=target.id;view.componentId=value||null;refresh()});
  if(state.turnPhase==='fire'&&view.componentOwner===target.id&&view.componentId){const note=document.createElement('p');note.textContent=t(view.componentId==='treads'?'v2.specialists.treadsNote':'v2.specialists.damageNote',{attack:api().selectedSpec(actor,view.previewWeaponKey)?.attack??0});host.appendChild(note)}
 }
 function commandLabel(command){
  if(['Move','Embark','Unload'].includes(command.type))return t('v2.ui.'+({Move:'move',Embark:'embark',Unload:'unload'}[command.type]));
  if(command.type!=='Engineer')return command.type==='CatalogRam'?t('v2.ui.ram'):command.type==='CatalogLoad'?t('v2.ui.embark'):command.type==='CatalogDeploy'?t('v2.ui.catalog.deployDrone'):t('v2.ui.fire');
  const key=command.job==='repair-vehicle'?(command.option==='disabled'?'repair-disabled':'repair-hp'):command.job;const q=api().query(command),cost=q.cost;
  return t('v2.engineer.'+key)+(Number.isFinite(cost)?' · '+t('v2.engineer.cost',{cost}):q.materialGain?' · '+t('v2.engineer.gain',{gain:q.materialGain}):'');
 }
 function commands(state,actor,cell,view){
  if(!actor||!cell)return [];
  const target=state.units.find(u=>alive(u)&&!u.embarkedOn&&u.x===cell.x&&u.y===cell.y),result=[];
  const add=command=>result.push({command,label:commandLabel(command),...(command.type==='CatalogFire'?{keepTarget:true}:command.type==='CatalogHexFire'?{confirmSplash:true}:{})}),job=(name,target,option=null)=>add({type:'Engineer',actorId:actor.id,job:name,target,option});
  if(state.turnPhase==='fire'){if(root.GoblinCatalogFullRuntime?.active()&&actor.catalogId==='U13'){add({type:'CatalogHexFire',actorId:actor.id,...cell});return result}if(target&&target.team!==actor.team)add(fireCommand(actor,target,view));return result}
  if(!['movement','gev'].includes(state.turnPhase))return result;
  if(!target)add({type:'Move',actorId:actor.id,...cell});
  if(state.turnPhase==='gev')return result;
  if(target?.team!==actor.team&&target&&actor.catalogSystems&&['U01','U20'].includes(actor.catalogId))add({type:'CatalogRam',actorId:actor.id,targetId:target.id,...cell});
  if(target?.team===actor.team&&target.id!==actor.id){
   if(target.droneBays&&api().rules(actor)?.cargoRef==='drone-cargo-v1')for(const bayId of target.droneBays){const c={type:'CatalogLoad',actorId:actor.id,carrierId:target.id,bayId};result.push({command:c,label:`${t('v2.ui.embark')} · ${api().slotLabel(target,bayId)}`})}
   else if(target.transportCapacity)add({type:'Embark',actorId:actor.id,carrierId:target.id,...cell});
   if(api().rules(actor)?.engineeringRef){
    if(target.catalogSystems){job('repair-treads',{kind:'unit',runtimeUnitId:target.id});job('repair-component',{kind:'component',runtimeUnitId:target.id,componentId:view.componentOwner===target.id?view.componentId??'':''})}
    else {job('repair-vehicle',{kind:'unit',runtimeUnitId:target.id},'disabled');job('repair-vehicle',{kind:'unit',runtimeUnitId:target.id},'hp')}
   }
  }
  if(!target){
   if(actor.droneBays)for(const cargo of state.units.filter(u=>alive(u)&&u.embarkedOn===actor.id)){const command={type:'CatalogDeploy',actorId:actor.id,cargoId:cargo.id,bayId:cargo.cargoBay,...cell};result.push({command,label:`${t('v2.ui.catalog.deployDrone')} · ${api().slotLabel(actor,cargo.cargoBay)} · ${cargo.name}`})}
   else if(actor.transportCapacity)for(const cargo of state.units.filter(u=>alive(u)&&u.embarkedOn===actor.id))add({type:'Unload',actorId:actor.id,cargoId:cargo.id,...cell});
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
 root.GoblinSpecialistsUI=Object.freeze({weaponLabel,fireCommand,renderWeapons,renderTargets,commands,commandLabel,renderSystemFacts});
})(globalThis);
