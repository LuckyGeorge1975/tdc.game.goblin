import {createFullCatalogAiAdapter,createOwnedFullCatalogAiAdapter,sameFullCatalogActionSlot} from './full-catalog-ai-adapter.mjs?v=4';
import {createAiSessionHost} from './ai-session-host.mjs?v=3';

export function createFullCatalogSessionHost({host, read, readGeneration, select, selectEnemy, policy, onCommit, spectator = false}) {
  const adapter = createFullCatalogAiAdapter(host, readGeneration);
  const player = createAiSessionHost({adapter, select, policy, commit:onCommit, spectator,
    read:() => { const state = read(); return state?.side === 'player' ? state : null; }});
  let stopped = false, paused = false;
  function atEnemySlot(decision, execute) {
    if (stopped || paused || !decision.ok || (!selectEnemy && !policy)) return;
    const before = read();
    if (before?.side !== 'enemy' || decision.side !== before.side || before.ended) return;
    const key = policy ? policy.select(before,decision) : selectEnemy(decision);
    if (stopped || paused || !decision.candidates.some(candidate => candidate.key === key)) return;
    const current = read();
    if (!current || current.session !== before.session || current.side !== before.side || current.ended ||
        current.engine !== before.engine || current.profile !== before.profile || current.feature !== before.feature) return;
    const result = execute({schemaVersion:decision.schemaVersion,
      decisionId:decision.decisionId,revision:decision.revision,key});
    if (result.ok) onCommit(result,before);
  }
  return Object.freeze({
    advancePlayer:player.advance,
    chooseEnemyStep:adapter.chooseEnemyStep(atEnemySlot),
    chooseEnemyFire:adapter.chooseEnemyFire(atEnemySlot),
    invalidate:player.invalidate,
    pause() { paused = true; player.pause(); },
    resume() { if (!stopped) { paused = false; player.resume(); } },
    stop() { stopped = true; player.stop(); }
  });
}

export function createOwnedFullCatalogSessionHost({port,player,select,onCommit=()=>{}}) {
  const adapter=createOwnedFullCatalogAiAdapter(port,player);
  let attempted=null,pending=false;
  const read=()=>{
    const state=port.state();
    if(!state||state.controller!=='ai'||state.paused||state.ended)return null;
    return {...state,session:state.sessionId,engine:state.generation};
  };
  const ai=createAiSessionHost({adapter,read,spectator:true,
    select:(batch,report)=>attempted.select(batch,report),
    remember(batch,key,evidence){if(attempted)attempted.intent=adapter.remember(batch,key,evidence);},commit:onCommit});
  function continueChoice(attempt,state){
    if(!attempt.intent)return null;
    const result=adapter.resume(attempt.intent);
    if(!result)return null;
    attempt.intent=null;
    if(result.ok)onCommit(result,state);
    return result.ok?{ok:true}:result;
  }
  async function advance(){
    if(pending)return {ok:false,code:'AI_HOST_UNAVAILABLE'};
    const state=read();
    const choose=state?.policyId?port.qualifiedSelector():select?.[state?.side];
    if(!state||typeof choose!=='function')return {ok:false,code:'AI_HOST_WRONG_SIDE'};
    const ticket=port.ticket('ai');
    if(!ticket)return {ok:false,code:'AI_FULL_NO_NEW_ACTION'};
    if(sameFullCatalogActionSlot(ticket,attempted?.ticket))
      return continueChoice(attempted,state)??{ok:false,code:'AI_FULL_NO_NEW_ACTION'};
    const attempt=attempted={ticket,intent:null,select:choose};
    pending=true;
    try{
      const result=await ai.advance();
      if(result.ok){attempt.intent=null;return result;}
      if(result.code==='AI_HOST_STALE')return continueChoice(attempt,read())??result;
      attempt.intent=null;
      return result;
    }
    finally{pending=false;}
  }
  return Object.freeze({advance,
    pause(){port.pause();ai.pause();},resume(){port.resume();ai.resume();},
    leave(){port.leave();ai.stop();attempted=null;}});
}
