// An observer of accepted browser commits, never a second command source.
export function createCorePresentationObserver(owner,getEpoch=()=>0){
  const safe=fn=>(...args)=>{try{return fn(...args);}catch{return null;}};
  function snapshot(session){
    const state=JSON.parse(JSON.stringify(session.projection.state));
    state.units=state.units.map(unit=>({...unit,
      visualKey:globalThis.UnitVisuals?.artKey(unit)??unit.visualKey??null}));
    return state;
  }
  function sync(session){
    owner.bind({runtime:'core',scenarioId:session.profile.header.scenarioId,
      scenarioVersion:session.profile.header.scenarioVersion,
      ruleProfileId:session.profile.header.ruleProfileId,
      sourceStateVersion:session.profile.header.stateVersion,epoch:getEpoch()},snapshot(session));
    owner.synchronize(snapshot(session));
  }
  return Object.freeze({
    sync:safe(sync),
    begin:safe((session,command,query)=>{
      sync(session);
      return owner.begin(command,snapshot(session),{
        sourceCursor:session.projection.cursor,
        ...(query.action?.command?{resolvedCommand:query.action.command}:{})});
    }),
    confirm:safe((ticket,session)=>{
      const results=session.projection.events;
      const movements=results.flatMap((event,sourceEventIndex)=>
        ['UnitMoved','EnemyMoved','RamResolved'].includes(event.type)?[{
          kind:event.type==='RamResolved'?'ram':'move',actorId:event.unitId??event.actorId,
          from:event.from,to:event.to,path:event.path,sourceEventIndex}]:[]);
      return owner.confirm(ticket,snapshot(session),results,movements);
    })
  });
}
