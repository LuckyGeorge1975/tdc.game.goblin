(function(root){
  const copy=value=>JSON.parse(JSON.stringify(value));
  function freeze(value){
    if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
    return value;
  }
  const immutable=value=>freeze(copy(value));
  const preference=value=>({schemaVersion:1,mode:value?.schemaVersion===1&&
    ['high','normal','off'].includes(value.mode)?value.mode:'high'});
  function currentPreference(){
    try{return preference(root.GoblinPresentationPreferences?.read());}catch{return preference(null);}
  }
  function stamp(value){
    let hash=2166136261;
    for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  const position=unit=>({x:unit.x,y:unit.y});
  const center=cell=>({x:Math.sqrt(3)*(cell.x+(cell.y%2)/2),y:1.5*cell.y});
  function direction(from,to){
    const a=center(from),b=center(to);
    return (Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360;
  }
  function validPath(from,to,path){
    if(!Array.isArray(path)||!path.length)return false;
    let previous=from;
    for(const cell of path){
      if(!Number.isInteger(cell?.x)||!Number.isInteger(cell?.y))return false;
      const a=center(previous),b=center(cell);
      if(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-Math.sqrt(3))>1e-8)return false;
      previous=cell;
    }
    return previous.x===to.x&&previous.y===to.y;
  }
  let nextRun=0;
  function createOwner(){
    let binding=null,key=null,sidecar=null,endState=null,generation=0,sequence=0;
    let tickets=new WeakSet();
    const records=new Map();
    const listeners=new Set();
    function notify(type,value){for(const listener of listeners){try{listener(type,value);}catch{ /* Visual observers cannot reject a command. */ }}}
    function cancel(){generation++;tickets=new WeakSet();notify('cancel');}
    function synchronize(state,destructionRef=null,confirmedBefore=null){
      if(!sidecar)return;
      if(destructionRef?.animationPreference)sidecar.animationPreference=preference(destructionRef.animationPreference);
      const previous=new Map(sidecar.facingByUnit.map(item=>[item.unitId,item]));
      sidecar.facingByUnit=state.units.map(unit=>{
        const old=previous.get(unit.id);
        return old&&old.team===unit.team&&old.visualKey===(unit.visualKey??null)?old:
          {unitId:unit.id,team:unit.team,visualKey:unit.visualKey??null,
            angleDegrees:unit.team==='enemy'?180:0,sourceActionId:null,origin:'baseline'};
      });
      const oldWrecks=new Map(sidecar.wrecks.map(item=>[item.unitId,item]));
      sidecar.wrecks=state.units.filter(unit=>Number.isFinite(unit.hp)&&unit.hp<=0).map(unit=>{
        const old=oldWrecks.get(unit.id),prior=endState?.units.find(item=>item.id===unit.id);
        const same=old&&old.team===unit.team&&old.visualKey===(unit.visualKey??null);
        const beforeUnit=confirmedBefore?.units.find(item=>item.id===unit.id);
        // A draw may have reconstructed this death before the accepted Ram settles.
        const enrich=same&&old.origin==='reconstructed-state-transition'&&old.destructionRef===null&&
          destructionRef?.source==='accepted-command'&&beforeUnit?.hp>0&&
          beforeUnit.team===unit.team&&(beforeUnit.visualKey??null)===(unit.visualKey??null)&&
          old.position.x===unit.x&&old.position.y===unit.y&&
          destructionRef.beforeRevision===stamp(confirmedBefore)&&destructionRef.afterRevision===stamp(state);
        const carrierId=unit.embarkedOn??prior?.embarkedOn??null;
        const facing=sidecar.facingByUnit.find(item=>item.unitId===unit.id);
        return {...(same?old:{wreckId:`${sidecar.sessionInstanceId}/${sidecar.branchGeneration}/wreck/${unit.id}`,
          unitId:unit.id,visualKey:unit.visualKey??null,team:unit.team,type:unit.type??null,
          nameKeyOrRuntimeName:unit.name??unit.id,
          binding:{...binding,sessionInstanceId:sidecar.sessionInstanceId,branchGeneration:sidecar.branchGeneration},
          destructionRef:destructionRef?copy(destructionRef):null,
          cargoRelation:carrierId?{carrierId}:null,
          origin:destructionRef?'confirmed-end-state':prior?.hp>0?'reconstructed-state-transition':'reconstructed-default'}),
          ...(enrich?{destructionRef:copy(destructionRef),origin:'confirmed-end-state'}:{}),
          position:position(unit),facingDegrees:facing.angleDegrees};
      });
      endState=immutable(state);
      sidecar.settledRevision=stamp(state);
    }
    function bind(next,state){
      const nextKey=JSON.stringify(next);
      if(nextKey===key)return false;
      cancel();key=nextKey;binding=immutable(next);sequence=0;records.clear();endState=null;
      sidecar={schemaVersion:1,binding:copy(binding),sessionInstanceId:`presentation-${++nextRun}`,
        mappingVersion:'movement-facing-v1',visualConfigVersion:'instant-off-v1',branchGeneration:0,
        acceptedSequence:0,settledThrough:null,baselineRevision:stamp(state),settledRevision:stamp(state),
        facingByUnit:[],wrecks:[],wreckMappingVersion:'static-wreck-v1',animationPreference:currentPreference()};
      synchronize(state);return true;
    }
    function begin(command,before,details={}){
      if(!sidecar)return null;
      synchronize(before);
      const ticket=immutable({generation,bindingKey:key,command,before,details,animationPreference:currentPreference()});
      tickets.add(ticket);notify('begin',{ticket,sidecar:immutable(sidecar)});return ticket;
    }
    function settleToAfter(eventId,expectedGeneration=generation){
      const item=records.get(eventId);
      if(expectedGeneration!==generation||!item||item.status==='settled')return false;
      item.status='running';
      const event=item.event;
      synchronize(event.after,{source:'accepted-command',command:event.action.sourceCommand,
        beforeRevision:event.action.beforeRevision,afterRevision:event.action.afterRevision},event.before);
      if(event.path){
        const from=event.path.length===1?event.actor.positionBefore:event.path.at(-2);
        const facing=sidecar.facingByUnit.find(unit=>unit.unitId===event.actor.unitId);
        if(facing){facing.angleDegrees=direction(from,event.path.at(-1));
          facing.sourceActionId=eventId;facing.origin='confirmed-movement';}
      }
      if(event.kind==='fire'){
        const target=event.before.units.find(unit=>unit.id===event.targetId);
        const facing=sidecar.facingByUnit.find(unit=>unit.unitId===event.actor.unitId);
        if(target&&facing){facing.angleDegrees=direction(event.actor.positionBefore,target);
          facing.sourceActionId=eventId;facing.origin='confirmed-fire';}
      }
      synchronize(event.after,{source:'accepted-command',command:event.action.sourceCommand,
        beforeRevision:event.action.beforeRevision,afterRevision:event.action.afterRevision},event.before);
      sidecar.settledThrough=eventId;item.status='settled';return true;
    }
    function confirm(ticket,after,sourceResults,movements,fires=[]){
      if(!tickets.has(ticket)||ticket.generation!==generation||ticket.bindingKey!==key)return [];
      tickets.delete(ticket);
      sidecar.animationPreference=preference(ticket.animationPreference);
      if((!Array.isArray(movements)||!movements.length)&&!fires.length){
        synchronize(after,{source:'accepted-command',command:ticket.command,
          beforeRevision:stamp(ticket.before),afterRevision:stamp(after)},ticket.before);
        notify('confirm',{ticket,events:[],after:immutable(after),sidecar:immutable(sidecar)});return [];}
      const acceptedSequence=++sequence,events=[];
      sidecar.acceptedSequence=sequence;
      for(const movement of movements??[]){
        const beforeUnit=ticket.before.units.find(unit=>unit.id===movement.actorId);
        const afterUnit=after.units.find(unit=>unit.id===movement.actorId);
        if(!beforeUnit||!afterUnit||beforeUnit.x===afterUnit.x&&beforeUnit.y===afterUnit.y)continue;
        const from=position(beforeUnit),to=position(afterUnit);
        const consistent=movement.from?.x===from.x&&movement.from?.y===from.y&&
          movement.to?.x===to.x&&movement.to?.y===to.y&&validPath(from,to,movement.path);
        const index=movement.sourceEventIndex;
        const eventId=`${sidecar.sessionInstanceId}/${sidecar.branchGeneration}/${acceptedSequence}/${index}`;
        if(records.has(eventId))continue;
        const event=immutable({schemaVersion:1,eventId,kind:movement.kind,
          binding:{...binding,sessionInstanceId:sidecar.sessionInstanceId,branchGeneration:sidecar.branchGeneration},
          action:{acceptedSequence,sourceCommand:ticket.command,...ticket.details,
            animationPreference:ticket.animationPreference,
            turn:ticket.before.turn,phase:ticket.before.phase,
            beforeRevision:stamp(ticket.before),afterRevision:stamp(after)},
          actor:{unitId:beforeUnit.id,team:beforeUnit.team,visualKey:beforeUnit.visualKey??null,
            positionBefore:from,positionAfter:to},
          before:ticket.before,after,sourceResults,sourceEventIndex:index,
          path:consistent?movement.path:null,diagnostic:consistent?null:'INVALID_CONFIRMED_PATH',effects:[]});
        records.set(eventId,{event,status:'queued'});events.push(event);
        // Canonical observation settles synchronously; the separate visual queue projects it once.
        settleToAfter(eventId);
      }
      for(const fire of fires){
        const actor=ticket.before.units.find(unit=>unit.id===fire.actorId);
        const target=ticket.before.units.find(unit=>unit.id===fire.targetId);
        if(!actor||!target)continue;
        const eventId=`${sidecar.sessionInstanceId}/${sidecar.branchGeneration}/${acceptedSequence}/fire-${fire.sourceEventIndex}`;
        if(records.has(eventId))continue;
        const weaponKey=fire.weaponKey??null,used=actor.ogreSystems?.weapons?.[weaponKey];
        const effects=fire.effects??[...new Set([fire.targetId,...(fire.passengerIds??[])])].map((id,index)=>({
          subjectId:id,role:index?'passenger':fire.targetKey?'system':'primary',result:fire.result,
          targetKey:fire.targetKey??null,before:ticket.before.units.find(unit=>unit.id===id),after:after.units.find(unit=>unit.id===id)}));
        const event=immutable({schemaVersion:1,eventId,kind:'fire',
          binding:{...binding,sessionInstanceId:sidecar.sessionInstanceId,branchGeneration:sidecar.branchGeneration},
          action:{acceptedSequence,sourceCommand:ticket.command,...ticket.details,animationPreference:ticket.animationPreference,
            turn:ticket.before.turn,phase:ticket.before.phase,beforeRevision:stamp(ticket.before),afterRevision:stamp(after)},
          actor:{unitId:actor.id,team:actor.team,visualKey:actor.visualKey??null,positionBefore:position(actor),positionAfter:position(actor)},
          targetId:target.id,weapon:{usedWeaponKey:weaponKey,attack:used?.attack??fire.attack??actor.damage,
            range:used?.range??fire.range??actor.range,semanticKind:fire.strategic?'missile':weaponKey==='missiles'?'rockets':null,
            visualMappingVersion:'fire-mapping-v1'},before:ticket.before,after,sourceResults,sourceEventIndex:fire.sourceEventIndex,
          effects:effects.filter(effect=>effect.before&&effect.after).map((effect,index)=>({...effect,
            effectId:`${eventId}/${index}`,sourceResultIndex:effect.sourceResultIndex??fire.sourceEventIndex})),path:null});
        records.set(eventId,{event,status:'queued'});events.push(event);settleToAfter(eventId);
      }
      synchronize(after);notify('confirm',{ticket,events,after:immutable(after),sidecar:immutable(sidecar)});return events;
    }
    function compatible(saved,state,historical=false){
      if(!saved||saved.schemaVersion!==1||JSON.stringify(saved.binding)!==JSON.stringify(binding)||
          saved.sessionInstanceId!==sidecar?.sessionInstanceId||saved.mappingVersion!=='movement-facing-v1'||
          saved.visualConfigVersion!=='instant-off-v1'||saved.settledRevision!==stamp(state)||
          !Number.isSafeInteger(saved.branchGeneration)||saved.branchGeneration<0||
          !Number.isSafeInteger(saved.acceptedSequence)||saved.acceptedSequence<0||
          !historical&&(saved.branchGeneration!==sidecar.branchGeneration||
            saved.acceptedSequence!==sidecar.acceptedSequence)||
          typeof saved.baselineRevision!=='string'||
          !(saved.settledThrough===null||typeof saved.settledThrough==='string')||
          saved.wreckMappingVersion!=='static-wreck-v1'||!Array.isArray(saved.wrecks)||!Array.isArray(saved.facingByUnit)||
          saved.facingByUnit.length!==state.units.length)return false;
      const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
      if(!saved.wrecks.every(object)||!saved.facingByUnit.every(object))return false;
      const dead=state.units.filter(unit=>Number.isFinite(unit.hp)&&unit.hp<=0),wreckIds=new Set(),wreckUnits=new Set();
      if(saved.wrecks.length!==dead.length||!saved.wrecks.every(item=>{
        const unit=dead.find(unit=>unit.id===item.unitId),facing=saved.facingByUnit.find(f=>f.unitId===item.unitId);
        const carrierId=unit?.embarkedOn??null;
        const carrier=carrierId?state.units.find(candidate=>candidate.id===carrierId):null;
        if(!unit||wreckUnits.has(item.unitId)||typeof item.wreckId!=='string'||wreckIds.has(item.wreckId)||
          item.team!==unit.team||item.visualKey!==(unit.visualKey??null)||item.type!==(unit.type??null)||
          item.position?.x!==unit.x||item.position?.y!==unit.y||item.facingDegrees!==facing?.angleDegrees||
          item.nameKeyOrRuntimeName!==(unit.name??unit.id)||
          !['confirmed-end-state','reconstructed-state-transition','reconstructed-default'].includes(item.origin)||
          item.binding?.sessionInstanceId!==saved.sessionInstanceId||
          !Number.isSafeInteger(item.binding?.branchGeneration)||item.binding.branchGeneration<0||
          item.binding.branchGeneration>saved.branchGeneration||
          item.wreckId!==`${saved.sessionInstanceId}/${item.binding.branchGeneration}/wreck/${unit.id}`||
          Object.entries(binding).some(([key,value])=>item.binding[key]!==value)||
          !(carrierId===null?item.cargoRelation===null:
            object(item.cargoRelation)&&item.cargoRelation.carrierId===carrierId&&carrier&&carrier.id!==unit.id)||
          !(item.destructionRef===null||typeof item.destructionRef==='object'&&
            typeof item.destructionRef.source==='string'&&typeof item.destructionRef.beforeRevision==='string'&&
            typeof item.destructionRef.afterRevision==='string')||
          (item.origin==='confirmed-end-state')!==(item.destructionRef!==null))return false;
        wreckUnits.add(item.unitId);wreckIds.add(item.wreckId);return true;
      }))return false;
      const ids=new Set();
      return saved.facingByUnit.every(item=>{
        const unit=state.units.find(unit=>unit.id===item.unitId);
        if(!unit||ids.has(item.unitId)||item.team!==unit.team||item.visualKey!==(unit.visualKey??null)||
          !Number.isFinite(item.angleDegrees)||item.angleDegrees<0||item.angleDegrees>=360||
          !(item.sourceActionId===null||typeof item.sourceActionId==='string')||
          !['baseline','confirmed-movement','confirmed-fire'].includes(item.origin))return false;
        ids.add(item.unitId);return true;
      });
    }
    function rewind(saved,state){
      cancel();sidecar.branchGeneration++;
      // Keep sequence monotonic; repeating an undone action belongs to a new visual branch.
      const valid=compatible(saved,state,true);
      sidecar.facingByUnit=valid?copy(saved.facingByUnit):[];
      sidecar.wrecks=valid?copy(saved.wrecks):[];
      sidecar.animationPreference=valid?preference(saved.animationPreference):currentPreference();
      endState=null;
      sidecar.settledThrough=valid?saved.settledThrough:null;
      synchronize(state);return valid;
    }
    return Object.freeze({bind,begin,confirm,cancel,synchronize,settleToAfter,rewind,
      subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
      transition(state){notify('transition',{after:immutable(state),sidecar:sidecar?immutable(sidecar):null});},
      stop(runtime){if(runtime!==undefined&&binding?.runtime!==runtime)return;
        cancel();key=null;binding=null;sidecar=null;endState=null;records.clear();},
      read:()=>sidecar?immutable(sidecar):null,endState:()=>endState,
      events:()=>immutable([...records.values()].map(item=>({event:item.event,status:item.status}))),
      owns:runtime=>binding?.runtime===runtime,
      guard(callback){const expected=generation;return (...args)=>expected===generation?callback(...args):undefined;},
      restore(saved,state){if(!sidecar)return false;
        if(!compatible(saved,state)){cancel();sidecar.facingByUnit=[];sidecar.wrecks=[];endState=null;sidecar.settledThrough=null;
          synchronize(state);return false;}
        cancel();sidecar=copy(saved);sidecar.animationPreference=preference(saved.animationPreference);
        sequence=Math.max(sequence,saved.acceptedSequence);synchronize(state);return true;}
    });
  }
  const api=Object.freeze({createOwner,stamp,validPath,direction,
    visualRandom:(eventId,salt)=>parseInt(stamp([eventId,salt,'goblin-visual-v1']),16)/4294967296});
  root.GoblinPresentationState=api;
  root.GoblinPresentation=createOwner();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
