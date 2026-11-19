export function strongWorkerCount(hardwareConcurrency=globalThis.navigator?.hardwareConcurrency??2) {
  const available=Number.isFinite(hardwareConcurrency)?Math.max(1,Math.floor(hardwareConcurrency)):2;
  return Math.max(1,Math.min(8,Math.floor(available/2)));
}

export function createStrongWorkerPool({workerFactory,hardwareConcurrency}={}) {
  const count=strongWorkerCount(hardwareConcurrency);
  const create=workerFactory??(()=>new Worker(new URL('./strong-search.worker.mjs',import.meta.url),{type:'module'}));
  const workers=[];
  const requests=new Map();
  let sequence=0,stopped=false,running=false;
  function rejectPending(error) {
    for(const {reject} of requests.values()) reject(error);
    requests.clear();
  }
  function start() {
    if(workers.length) return;
    try {
      for(let index=0;index<count;index++) {
        const worker=create(index);
        worker.addEventListener('message',({data})=>{
          const pending=requests.get(data?.id);
          if(!pending) return;
          requests.delete(data.id);
          if(data.error) {
            const error=Error(data.error);
            if(typeof data.diagnosticStack==='string')error.stack=data.diagnosticStack;
            pending.reject(error);
          }
          else pending.resolve(data.result);
        });
        worker.addEventListener('error',event=>{
          rejectPending(Error(event.message??'STRONG_WORKER_FAILED'));
          stop();
        });
        workers.push(worker);
      }
    } catch(error) {stop();throw error;}
  }
  function call(worker,op,value) {
    const id=++sequence;
    return new Promise((resolve,reject)=>{
      requests.set(id,{resolve,reject});
      try {worker.postMessage({id,op,value});}
      catch(error) {requests.delete(id);reject(error);}
    });
  }
  function stop() {
    stopped=true;
    rejectPending(Error('STRONG_SEARCH_STOPPED'));
    for(const worker of workers) worker.terminate();
    workers.length=0;
  }
  async function evaluate(packet) {
    if(stopped||running) throw Error('STRONG_SEARCH_UNAVAILABLE');
    if(!packet?.actions?.length) throw Error('STRONG_SEARCH_EMPTY');
    running=true;
    try {
      start();
      await Promise.all(workers.map(worker=>call(worker,'bind',packet)));
      const groups=Array.from({length:count},()=>[]);
      packet.actions.forEach((entry,index)=>{
        if(entry.index!==index) throw Error('STRONG_ACTION_ORDER');
        groups[index%count].push(index);
      });
      const results=await Promise.all(workers.map((worker,index)=>call(worker,'evaluate',groups[index])));
      const branches=results.flat().sort((a,b)=>a.index-b.index);
      if(branches.length!==packet.actions.length||branches.some((branch,index)=>branch.index!==index||!Number.isFinite(branch.score)))
        throw Error('STRONG_SEARCH_INCOMPLETE');
      return branches;
    } catch(error) {
      stop();
      throw error;
    } finally {running=false;}
  }
  return Object.freeze({evaluate,stop,get workerCount(){return count;}});
}
