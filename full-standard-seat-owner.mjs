import {createFullCatalogAiHost} from './src/core/full-catalog-ai-adapter.mjs?v=6';
import {createOwnedFullCatalogSessionHost} from './src/core/full-catalog-session-host.mjs?v=6';
import {createGameManager,createPlayerController} from './src/core/game-manager.mjs?v=2';
import {selectWeakFullCatalog, selectMediumFullCatalog} from './src/core/full-catalog-difficulty.mjs?v=3';
import {prepareFullAttack2a, FULL_ATTACK_2A_ENGINE, FULL_ATTACK_2A_ID} from './src/core/full-attack-2a.mjs?v=3';
import {prepareDefenderTrial} from './src/core/full-defender-trial.mjs?v=1';
import {createStrongSearchController} from './src/core/strong-search-controller.mjs?v=1';
import {createFullExplorationPolicy} from './src/core/full-exploration-policy.mjs?v=1';

const standardDefender = 'full-native-standard-defender';

// The presentation queue owns readiness; this owner owns cancellation and seat
// freshness. Waiting is outside strategy selection and its compute measurements.
export function withFullPresentationBarrier(port,host,movement=()=>globalThis.GoblinMovement){
  let epoch=0,closed=false,paused=false,pending=false,abort=new AbortController();
  function invalidate(){epoch++;abort.abort();abort=new AbortController();}
  return Object.freeze({
    async advance(){
      if(closed||paused||pending)return {ok:false,code:'AI_HOST_UNAVAILABLE'};
      const before=port.state();
      if(!before||before.ended||before.paused||before.controller!=='ai')return {ok:false,code:'AI_HOST_WRONG_SIDE'};
      const expected=epoch,signal=abort.signal;
      const current=()=>{
        const state=port.state();
        return !closed&&!paused&&epoch===expected&&state?.sessionId===before.sessionId&&
          state.side===before.side&&state.controller==='ai'&&!state.paused&&!state.ended;
      };
      const wait=()=>{
        const queue=movement();
        return !queue?.busy()?Promise.resolve(true):queue.whenIdle?.({signal})??Promise.resolve(false);
      };
      pending=true;
      try{
        if(!await wait()||!current())return {ok:false,code:'AI_HOST_STALE'};
        let result=await host.advance();
        while(result.code==='PRESENTATION_BUSY'&&current()&&movement()?.busy()){
          if(!await wait()||!current())return {ok:false,code:'AI_HOST_STALE'};
          result=await host.advance(); // The native host retains this exact intent.
        }
        if(result.ok)await wait(); // Accepted once, even if presentation is cancelled.
        return result;
      }finally{pending=false;}
    },
    pause(){if(closed||paused)return;paused=true;invalidate();host.pause();},
    resume(){if(closed||!paused)return;paused=false;host.resume();},
    leave(){if(closed)return;closed=true;invalidate();host.leave();}
  });
}

export function createFullGameManager(config,full) {
  const capabilities=full.controllerCapabilities(config);
  if (!capabilities) return null;
  const {level,seats}=capabilities;
  return createGameManager(level,seats);
}

export function fullNativeSetup(manager,selection) {
  const assignments=manager.assign(selection);
  return Object.freeze({
    roles:Object.freeze(Object.fromEntries(assignments.map(({seatId,controller})=>[seatId,controller]))),
    policyIds:Object.freeze(Object.fromEntries(assignments.flatMap(({seatId,policyId})=>
      policyId && policyId!==standardDefender?[[seatId,policyId]]:[])))
  });
}

export function commitFullHumanCommand(port,permit,view,command,dispatchPlayer) {
  const player=createPlayerController(permit.side,()=>command);
  const selected=player.nextCommand({side:permit.side,view});
  return selected ? port.commit('human',permit,selected,dispatchPlayer) : {ok:false,code:'FULL_CONTROL_STALE'};
}

function allowsStandardDefender(config) {
  return config?.ruleProfileId === 'FULL_CATALOG_v1' && config.aiAllowed !== false &&
    !('minimumDifficulty' in config);
}

export function standardFullSeatOffers(config, label) {
  if (!allowsStandardDefender(config)) return null;
  return {player:[], enemy:[{id:standardDefender, label}]};
}

export function selectStandardFullDefender(decision,report) {
  if (decision.side !== 'enemy') return undefined;
  const key=(decision.candidates.find(candidate=>candidate.facts.baseline === true)??
    decision.candidates.find(candidate=>candidate.kind==='end-phase'))?.key;
  if (key!==undefined) report?.({key,explanationKey:'v2.round.standardAction'});
  return key;
}

export function fullSeatFallback(session,selection,port) {
  const binding=port.controlBinding();
  if (!binding || port.state()?.sessionId!==session.sessionId) throw Error('FULL_CONTROLLER_NOT_OFFERED');
  const select={};
  for (const side of ['player','enemy']) {
    const id=selection[side];
    const sameHuman=id===null&&binding.roles[side]==='human';
    const sameQualified=binding.roles[side]==='ai'&&binding.policyIds[side]===id&&typeof id==='string';
    if (sameHuman||sameQualified) continue;
    if (side!=='enemy'||id!==standardDefender||binding.roles.enemy!=='ai'||binding.policyIds.enemy!==undefined||
        !allowsStandardDefender(session.config)) throw Error('FULL_CONTROLLER_NOT_OFFERED');
    select.enemy=selectStandardFullDefender;
  }
  return select;
}

if (typeof document !== 'undefined' && globalThis.GoblinV2Flow) {
  const full = globalThis.GoblinCatalogFullRuntime;
  const specialists = globalThis.GoblinSpecialistsRuntime;
  const searches = new WeakMap();
  const explorations = new WeakMap();
  const failures = new WeakMap();
  const computing = new WeakSet(), hooks = new WeakMap();
  function explorationFor(port,side) {
    let seats=explorations.get(port);
    if(!seats){seats=new Map();explorations.set(port,seats);}
    if(!seats.has(side))seats.set(side,createFullExplorationPolicy({side}));
    return seats.get(side);
  }
  function selectWithExploration(batch,port,report,choose) {
    const exploration=explorationFor(port,batch.side);
    exploration.observe(batch.view);
    const key=choose();
    const selected=batch.candidates.find(candidate=>candidate.key===key);
    return ['hold','end-phase'].includes(selected?.kind)?exploration.select(batch,report)??key:key;
  }
  async function selectStrong(batch,port,report,capture) {
    explorationFor(port,batch.side).observe(batch.view);
    let search = searches.get(port);
    if (!search) {
      search = createStrongSearchController({profile:'FULL_CATALOG_v1',
        capture:decision=>{
          const packet=capture(decision);
          return packet&&{...packet,explorationState:explorationFor(port,decision.side).snapshot()};
        },
        reference:decision=>explorationFor(port,decision.side).select(decision)??selectMediumFullCatalog(decision),
        onSearch({side,wallMs,workers}) {
          const end=performance.now();
          performance.measure('goblin-ai-search',{start:end-wallMs,end,
            detail:{profile:'FULL_CATALOG_v1',side,workers}});
        }});
      searches.set(port,search);
    }
    computing.add(port);
    failures.delete(port);
    hooks.get(port)?.refresh();
    try {return await search.select(batch,report);}
    catch(error){
      if(error.message!=='STRONG_SEARCH_STOPPED'&&!port.state()?.paused&&port.state())
        failures.set(port,error.message);
      throw error;
    }
    finally {computing.delete(port);hooks.get(port)?.refresh();}
  }
  for (const side of ['player', 'enemy']) {
    full.registerQualifiedController({side, id:side + '-weak', difficulty:'weak',
      select:(batch,report)=>selectWithExploration(batch,full.controllerPort(),report,
        ()=>selectWeakFullCatalog(batch,report))});
    full.registerQualifiedController({side, id:side + '-medium', difficulty:'medium',
      select:(batch,report)=>selectWithExploration(batch,full.controllerPort(),report,
        ()=>selectMediumFullCatalog(batch,report))});
    full.registerQualifiedController({side, id:side + '-strong', difficulty:'strong', select:selectStrong});
  }
  const player = createFullCatalogAiHost(full, globalThis.GoblinSpecialistsUI, full.nativePlayerGateway,
    () => full.controllerPort()?.state()?.side, specialists);

  let readyState = false;
  const unavailable = [];
  const ready = Promise.allSettled([
    (async () => {
      const response = await fetch(new URL('./assets/ai/full-attack-2a.json?v=1',import.meta.url));
      if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
      const {base64} = await response.json();
      const modelBytes = Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
      const select = await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes});
      full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,
        select:(batch,port,report)=>selectWithExploration(batch,port,report,()=>select(batch,port,report))});
    })(),
    (async () => {
      const id = 'full-defender-control-trial';
      const response = await fetch(new URL('./assets/ai/'+id+'.json',import.meta.url));
      if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
      const select = await prepareDefenderTrial(id,await response.arrayBuffer());
      full.registerQualifiedController({side:'enemy',id,difficulty:null,
        select:(batch,port,report)=>selectWithExploration(batch,port,report,()=>select(batch,report))});
    })()
  ]).then(results => {
    for (const [index,result] of results.entries()) {
      if (result.status !== 'rejected') continue;
      unavailable.push(index === 0 ? 'player' : 'enemy');
      console.warn('Trained FULL player unavailable:',result.reason.message);
    }
    readyState = true;
  });

  globalThis.GoblinFullSeatOwner = Object.freeze({
    ready,
    get readyState() { return readyState; },
    get unavailable() { return [...unavailable]; },
    computing:port=>computing.has(port),
    failure:port=>failures.get(port)??null,
    offers:config => standardFullSeatOffers(config, GoblinLanguage.t('v2.full.standardDefender')),
    configure:config=>createFullGameManager(config,full),
    nativeSetup:(config,selection)=>fullNativeSetup(createFullGameManager(config,full),selection),
    commitHuman:(port,permit,view,command)=>commitFullHumanCommand(port,permit,view,command,player.dispatch),
    bind(session, selection, ui, port) {
      hooks.set(port,ui);
      const select=fullSeatFallback(session,selection,port);
      const host=withFullPresentationBarrier(port,createOwnedFullCatalogSessionHost({port,player,select,onCommit(_result,before){
        const projection=port.project('ai')?.view;
        explorationFor(port,before.side).accepted(projection?.side===before.side?projection:undefined);
        ui.refresh();
      }}));
      return Object.freeze({...host,
        async advance(){
          const result=await host.advance();
          const state=port.state();
          if(!result.ok&&state?.controller==='ai'&&!state.paused&&!state.ended&&
              !['AI_HOST_STALE','AI_HOST_UNAVAILABLE','PRESENTATION_BUSY'].includes(result.code)){
            if(!failures.has(port))failures.set(port,result.code);
            ui.refresh();
          }
          return result;
        },
        pause(){searches.get(port)?.invalidate();host.pause();},
        leave(){
          searches.get(port)?.stop();searches.delete(port);
          for(const exploration of explorations.get(port)?.values()??[])exploration.reset();
          explorations.delete(port);failures.delete(port);hooks.delete(port);host.leave();
        }
      });
    },
    playerCommands: port => player.humanPlayerOptions(port).map(entry=>entry.command),
    dispatchPlayer: player.dispatch
  });

}
