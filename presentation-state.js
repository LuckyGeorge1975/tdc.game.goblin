(function(root){
  const copy=value=>JSON.parse(JSON.stringify(value));
  function freeze(value){
    if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
    return value;
  }
  const immutable=value=>freeze(copy(value));
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
    function cancel(){generation++;tickets=new WeakSet();}
    function synchronize(state){
      if(!sidecar)return;
      const previous=new Map(sidecar.facingByUnit.map(item=>[item.unitId,item]));
      sidecar.facingByUnit=state.units.map(unit=>{
        const old=previous.get(unit.id);
        return old&&old.team===unit.team&&old.visualKey===(unit.visualKey??null)?old:
          {unitId:unit.id,team:unit.team,visualKey:unit.visualKey??null,
            angleDegrees:unit.team==='enemy'?180:0,sourceActionId:null,origin:'baseline'};
      });
      endState=immutable(state);
      sidecar.settledRevision=stamp(state);
    }
    function bind(next,state){
      const nextKey=JSON.stringify(next);
      if(nextKey===key)return false;
      cancel();key=nextKey;binding=immutable(next);sequence=0;records.clear();
      sidecar={schemaVersion:1,binding:copy(binding),sessionInstanceId:`presentation-${++nextRun}`,
        mappingVersion:'movement-facing-v1',visualConfigVersion:'instant-off-v1',branchGeneration:0,
        acceptedSequence:0,settledThrough:null,baselineRevision:stamp(state),settledRevision:stamp(state),
        facingByUnit:[],wrecks:[]};
      synchronize(state);return true;
    }
    function begin(command,before,details={}){
      if(!sidecar)return null;
      synchronize(before);
      const ticket=immutable({generation,bindingKey:key,command,before,details});
      tickets.add(ticket);return ticket;
    }
    function settleToAfter(eventId,expectedGeneration=generation){
      const item=records.get(eventId);
      if(expectedGeneration!==generation||!item||item.status==='settled')return false;
      item.status='running';
      const event=item.event;
      synchronize(event.after);
      if(event.path){
        const from=event.path.length===1?event.actor.positionBefore:event.path.at(-2);
        const facing=sidecar.facingByUnit.find(unit=>unit.unitId===event.actor.unitId);
        if(facing){facing.angleDegrees=direction(from,event.path.at(-1));
          facing.sourceActionId=eventId;facing.origin='confirmed-movement';}
      }
      sidecar.settledThrough=eventId;item.status='settled';return true;
    }
    function confirm(ticket,after,sourceResults,movements){
      if(!tickets.has(ticket)||ticket.generation!==generation||ticket.bindingKey!==key)return [];
      tickets.delete(ticket);
      if(!Array.isArray(movements)||!movements.length){synchronize(after);return [];}
      const acceptedSequence=++sequence,events=[];
      sidecar.acceptedSequence=sequence;
      for(const movement of movements){
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
            turn:ticket.before.turn,phase:ticket.before.phase,
            beforeRevision:stamp(ticket.before),afterRevision:stamp(after)},
          actor:{unitId:beforeUnit.id,team:beforeUnit.team,visualKey:beforeUnit.visualKey??null,
            positionBefore:from,positionAfter:to},
          before:ticket.before,after,sourceResults,sourceEventIndex:index,
          path:consistent?movement.path:null,diagnostic:consistent?null:'INVALID_CONFIRMED_PATH',effects:[]});
        records.set(eventId,{event,status:'queued'});events.push(event);
        // This foundation has no animated mode: the single queue owner always settles synchronously.
        settleToAfter(eventId);
      }
      synchronize(after);return events;
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
          !Array.isArray(saved.wrecks)||saved.wrecks.length||!Array.isArray(saved.facingByUnit)||
          saved.facingByUnit.length!==state.units.length)return false;
      const ids=new Set();
      return saved.facingByUnit.every(item=>{
        const unit=state.units.find(unit=>unit.id===item.unitId);
        if(!unit||ids.has(item.unitId)||item.team!==unit.team||item.visualKey!==(unit.visualKey??null)||
          !Number.isFinite(item.angleDegrees)||item.angleDegrees<0||item.angleDegrees>=360||
          !(item.sourceActionId===null||typeof item.sourceActionId==='string')||
          !['baseline','confirmed-movement'].includes(item.origin))return false;
        ids.add(item.unitId);return true;
      });
    }
    function rewind(saved,state){
      cancel();sidecar.branchGeneration++;
      // Keep sequence monotonic; repeating an undone action belongs to a new visual branch.
      const valid=compatible(saved,state,true);
      sidecar.facingByUnit=valid?copy(saved.facingByUnit):[];
      sidecar.settledThrough=valid?saved.settledThrough:null;
      synchronize(state);return valid;
    }
    return Object.freeze({bind,begin,confirm,cancel,synchronize,settleToAfter,rewind,
      stop(runtime){if(runtime!==undefined&&binding?.runtime!==runtime)return;
        cancel();key=null;binding=null;sidecar=null;endState=null;records.clear();},
      read:()=>sidecar?immutable(sidecar):null,endState:()=>endState,
      events:()=>immutable([...records.values()].map(item=>({event:item.event,status:item.status}))),
      owns:runtime=>binding?.runtime===runtime,
      guard(callback){const expected=generation;return (...args)=>expected===generation?callback(...args):undefined;},
      restore(saved,state){if(!sidecar)return false;
        if(!compatible(saved,state)){cancel();sidecar.facingByUnit=[];sidecar.settledThrough=null;
          synchronize(state);return false;}
        cancel();sidecar=copy(saved);sequence=Math.max(sequence,saved.acceptedSequence);synchronize(state);return true;}
    });
  }
  const api=Object.freeze({createOwner,stamp,validPath,direction,
    visualRandom:(eventId,salt)=>parseInt(stamp([eventId,salt,'goblin-visual-v1']),16)/4294967296});
  root.GoblinPresentationState=api;
  root.GoblinPresentation=createOwner();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
