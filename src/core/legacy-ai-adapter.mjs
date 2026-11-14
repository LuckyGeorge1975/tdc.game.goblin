import {createAiDecisionAdapter} from './ai-decision-adapter.mjs';

const kinds = Object.freeze({Move:'move',Ram:'ram',Fire:'fire',FireArtillery:'fire',LegacyEnemyFire:'fire',
  CatalogFire:'fire',CatalogRam:'ram',Embark:'load',CatalogLoad:'load',Unload:'unload',
  CatalogDeploy:'deploy',Engineer:'engineering'});

function candidate({command,facts,weaponRef,targetId,baseline,displayCell}) {
  const unitId=command.target?.runtimeUnitId??command.targetId??targetId??command.carrierId;
  const componentId=command.target?.componentId??facts.componentId;
  const cell=command.target?.kind==='cell'?command.target:displayCell??command;
  const target=unitId ? (componentId?{kind:'component',unitId,componentId}:{kind:'unit',unitId}) :
    Number.isInteger(cell.x)&&Number.isInteger(cell.y)?{kind:'cell',x:cell.x,y:cell.y}:null;
  return {kind:kinds[command.type],actorId:command.actorId,target,
    weaponRef:weaponRef??command.weaponId??command.weaponKey??null,
    facts:{...facts,...(baseline?{baseline:true}:{})}};
}

export function createLegacyAiAdapter(host, readGeneration = () => 0) {
  let slot=null, slotEpoch=0;
  const adapter=createAiDecisionAdapter({
    read:()=>({state:host.revision(),generation:`${readGeneration()}:${host.generation()}:${slotEpoch}`}),
    describe(revision,side,scope) {
      if(scope!==undefined||!revision||!['player','enemy'].includes(side)||host.side()!==side)
        return {ok:false,code:'AI_LEGACY_SCOPE_UNAVAILABLE'};
      if(side==='enemy'&&!slot)return {ok:false,code:'AI_LEGACY_SLOT_UNAVAILABLE'};
      const view=host.project(side);
      const entries=side==='player'?host.playerOptions():slot.entries();
      return {ok:true,phase:view.phase,slot:side==='player'?view.phase:slot.pass,view,
        options:entries.map(entry=>({command:entry.command,executeKind:side,candidate:candidate(entry)}))};
    },
    apply(revision,{command,executeKind}) {
      const result=executeKind==='player'?host.dispatch(command,revision):slot.execute(command);
      return result.ok?{action:command}:{error:{code:result.code??'AI_LEGACY_COMMAND_REJECTED'}};
    }
  });
  function chooseEnemyFire(select) {
    return nativeSlot=>{
      if(slot)throw Error('AI_LEGACY_SLOT_REENTRY');
      slot=nativeSlot;
      slotEpoch++;
      try{return select(adapter.open('enemy'),adapter.execute)}
      finally{adapter.invalidate();slot=null;}
    };
  }
  return Object.freeze({...adapter,chooseEnemyFire});
}
