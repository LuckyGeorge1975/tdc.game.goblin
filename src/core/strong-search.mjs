export async function evaluateStrongBranch(packet,index,createSimulationPort) {
  if(!Number.isInteger(index)||packet.actions[index]?.index!==index) throw Error('STRONG_ACTION_ORDER');
  const started=performance.now();
  const port=await createSimulationPort(packet);
  const initialStatus=port.status();
  const continuation=[];
  let adjustment=0,opponentSeen=false;
  function accept(action) {
    const before=port.status();
    const result=port.commit(action);
    if(!result||result.error||result.ok===false) throw Error(result?.error?.code??'STRONG_SIMULATION_REJECTED');
    if(!Number.isFinite(result.expectedAdjustment??0)) throw Error('STRONG_SIMULATION_VALUE');
    adjustment+=result.expectedAdjustment??0;
    continuation.push({side:before.side,turn:before.turn,action,events:result.events??[],
      ...(result.chance?{chance:result.chance}:{})});
  }
  try {
    if(port.status().ended||port.status().side!==packet.side) throw Error('STRONG_SIMULATION_WRONG_SIDE');
    accept(packet.actions[index].action);
    for(;;) {
      const status=port.status();
      if(status.ended) break;
      if(status.side!==packet.side) opponentSeen=true;
      if(status.side===packet.side&&(opponentSeen||status.turn>initialStatus.turn)) break;
      // A guard reports an invalid/non-progressing reference policy. Partial
      // replies never enter the candidate ranking.
      if(continuation.length>=10000) throw Error('STRONG_SIMULATION_NO_HANDOVER');
      const opened=port.open();
      const action=port.choose(opened);
      if(!action) throw Error('STRONG_SIMULATION_NO_REFERENCE_ACTION');
      accept(action);
    }
    const final=port.status();
    return {index,score:port.evaluate(packet.side)+adjustment,expectedAdjustment:adjustment,
      final,continuation,wallMs:performance.now()-started};
  } finally {port.dispose?.();}
}
