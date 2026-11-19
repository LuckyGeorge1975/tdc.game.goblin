import {createStrongWorkerPool} from './strong-worker-pool.mjs';

export function createStrongSearchController({capture,profile,reference,workerFactory,hardwareConcurrency,onSearch}={}) {
  if(typeof capture!=='function'||!['FULL_CATALOG_v1','CORE_IRON_DUST_v2'].includes(profile))
    throw Error('STRONG_CONTROLLER_INVALID');
  let pool=null,epoch=0,stopped=false,pending=false;
  function invalidate() {
    epoch++;
    pool?.stop();
    pool=null;
  }
  async function select(batch,report) {
    if(stopped||pending||!batch?.ok||batch.side!==batch.view?.side) return undefined;
    const generation=epoch;
    const started=performance.now();
    const packet=capture(batch);
    if(!packet||packet.version!==1||packet.profile!==profile||packet.side!==batch.side||
        packet.revision!==batch.revision||packet.actions?.length!==batch.candidates.length)
      throw Error('STRONG_CAPTURE_MISMATCH');
    pending=true;
    try {
      pool??=createStrongWorkerPool({workerFactory,hardwareConcurrency});
      const branches=await pool.evaluate(packet);
      if(stopped||generation!==epoch) return undefined;
      let chosen=branches[0];
      for(const branch of branches) if(branch.score>chosen.score) chosen=branch;
      const baselineKey=reference?.(batch);
      const baselineIndex=baselineKey===undefined?packet.baselineIndex:
        batch.candidates.findIndex(candidate=>candidate.key===baselineKey);
      const baseline=branches[baselineIndex];
      // Keep the reference's real progress on equal evaluations, particularly
      // weapon setup versus firing or ending a phase.
      if(baseline&&baseline.score===chosen.score) chosen=baseline;
      const key=batch.candidates[chosen.index].key;
      const wallMs=performance.now()-started;
      onSearch?.({side:batch.side,revision:batch.revision,workers:pool.workerCount,wallMs,
        targetMs:5000,overTarget:wallMs>5000,chosen:chosen.index,branches});
      report?.({key,explanationKey:'v2.round.effectAttack',
        options:branches.map(branch=>({key:batch.candidates[branch.index].key,scores:{basis:branch.score}}))});
      return key;
    } finally {pending=false;}
  }
  return Object.freeze({select,invalidate,stop(){stopped=true;invalidate();}});
}
