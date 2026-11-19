import {createHeadlessFullEngine} from './full-worker-engine.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from './full-catalog-ai-adapter.mjs';
import {selectMediumFullCatalog} from './full-catalog-difficulty.mjs';

let levelSource;
async function levels() {
  const response=await fetch(new URL('../../assets/unit-art/levels/catalog-full-levels.v3.json',import.meta.url));
  if(!response.ok)throw Error('FULL_STRONG_LEVEL_SOURCE_UNAVAILABLE');
  return response.json();
}

export async function createSimulationPort(packet,{engineFactory=createHeadlessFullEngine,levelData}={}) {
  if(packet?.version!==1||packet.profile!=='FULL_CATALOG_v1'||!packet.snapshot?.replay)
    throw Error('FULL_STRONG_CAPTURE_INVALID');
  const {config,replay,draft}=packet.snapshot;
  const engine=await engineFactory();
  const full=engine.root.GoblinCatalogFullRuntime;
  const known=new Set(packet.rootView.units.map(unit=>unit.id));
  const history=[];
  let port,player,adapter;
  await engine.initialize(config.catalog.registry,levelData??await(levelSource??=levels()));
  install(await engine.loadConfig(config,replay.seed,replay.level.id,draft));

  function install(binding) {
    port=binding.port;
    player=createFullCatalogAiHost(full,engine.root.GoblinSpecialistsUI,full.nativePlayerGateway,
      ()=>port.state()?.side,engine.root.GoblinSpecialistsRuntime);
    adapter=createOwnedFullCatalogAiAdapter(port,player);
  }
  function nativeCommit(action) {
    const token=port.open('ai')?.permit;
    const result=port.commit('ai',token,action,player.dispatch);
    if(!result.ok)throw Error(result.code??'FULL_STRONG_COMMIT_FAILED');
  }
  function replayPrefix() {
    engine.setModalRoll(null);
    for(const entry of replay.entries) {
      if(port.state()?.side!==entry.side)throw Error('FULL_STRONG_REPLAY_SIDE');
      nativeCommit(entry.command);
    }
  }
  replayPrefix();
  const initial=port.simulationSnapshot(port.ticket('ai'));
  if(initial?.replay.digest!==replay.digest)throw Error('FULL_STRONG_REPLAY_DIGEST');
  engine.applyRootKnowledge(packet.rootView);
  function restore() {
    engine.setModalRoll(null);
    install(engine.reload());
    replayPrefix();
    engine.applyRootKnowledge(packet.rootView);
    for(const entry of history) {
      engine.setModalRoll(entry.faces.length?[...entry.faces]:null);
      nativeCommit(entry.action);
    }
  }
  function material(side) {
    return full.roster(packet.side).filter(unit=>known.has(unit.id)).reduce((sum,unit)=>{
      if(!engine.root.GoblinUnitLife.alive(unit))return sum;
      const system=unit.catalogSystems;
      const weapons=system?.components.filter((slot,index)=>
        system.rules.definition.components[index].kind==='weapon'&&!slot.destroyed&&!slot.spent).length??0;
      const value=system?10+system.treads+2*weapons:10+2*unit.hp-(unit.disabled?2:0);
      return sum+(unit.team===side?value:-value);
    },0);
  }
  function open() {
    const batch=adapter.open(port.state().side);
    if(!batch.ok)throw Error(batch.code??'FULL_STRONG_OPEN_FAILED');
    const captured=adapter.captureStrongDecision(batch);
    if(!captured)throw Error('FULL_STRONG_CAPTURE_STALE');
    return {view:batch.view,batch,options:batch.candidates.map((candidate,index)=>
      ({candidate,action:captured.actions[index].action}))};
  }
  const first=open();
  if(JSON.stringify(first.options.map(option=>option.action))!==JSON.stringify(packet.actions.map(entry=>entry.action)))
    throw Error('FULL_STRONG_ACTION_ORDER');
  function modalFace(context) {
    if(!context)throw Error('FULL_STRONG_COMBAT_CONTEXT');
    const {attacker,target,metadata}=context;
    const component=target.catalogSystems?(metadata?.targetComponentId
      ?engine.root.GoblinSystems.catalogTargets(target.catalogSystems,config.catalog.registry)
        .find(item=>item.id===metadata.targetComponentId)
      :engine.root.GoblinSystems.catalogChooseTarget(target.catalogSystems,config.catalog.registry)):null;
    const effect=engine.root.GoblinSpecialistsRuntime.fireEffect(target,attacker.damage,component);
    const outcomes=effect.effectKind==='tread-roll-5-6'?['NE','NE','NE','NE','X','X']:
      effect.ratioCategory==='5-1'?['X','X','X','X','X','X']:first.batch.view.tactics.crt[effect.ratioCategory];
    if(!outcomes)throw Error('FULL_STRONG_CRT_INVALID');
    const counts={NE:0,D:0,X:0};
    for(const result of outcomes)counts[result]++;
    const modal=['NE','D','X'].sort((left,right)=>counts[right]-counts[left])[0];
    return outcomes.indexOf(modal);
  }
  function commit(action) {
    if(!['CatalogFire','CatalogHexFire'].includes(action.type)) {
      engine.setModalRoll(null);
      nativeCommit(action);
      history.push({action:structuredClone(action),faces:[]});
      return {events:[],expectedAdjustment:0};
    }
    let expected=0;
    for(let face=0;face<6;face++) {
      restore();
      engine.setModalRoll(face);
      nativeCommit(action);
      expected+=material(packet.side)/6;
    }
    restore();
    const faces=[];
    engine.setModalRoll(context=>{
      const face=modalFace(context);
      faces.push(face);
      return face;
    });
    nativeCommit(action);
    history.push({action:structuredClone(action),faces});
    return {events:[],expectedAdjustment:expected-material(packet.side)};
  }
  return Object.freeze({open,commit,
    choose(opened) {
      const key=selectMediumFullCatalog(opened.batch);
      return opened.options.find(option=>option.candidate.key===key)?.action;
    },
    status() {
      const state=engine.state();
      return {side:state.phase,turn:state.turn,ended:state.ended,winner:state.winner};
    },
    evaluate(side) {
      const {ended,winner}=engine.state();
      const goal=packet.rootView.objectives?.find(item=>item.kind===(
        side==='player'?'destroy-escort':'destroy-player-force'));
      const certainWin=winner===side&&goal?.satisfied===true;
      return (ended?(winner!==side?-100000:certainWin?100000:0):0)+material(side);
    },
    dispose:engine.dispose
  });
}
