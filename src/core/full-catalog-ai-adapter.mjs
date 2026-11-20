import {createAiDecisionAdapter} from './ai-decision-adapter.mjs?v=1';

const cellTarget = ({x, y}) => ({kind: 'cell', x, y});

function targetFor(command) {
  if (command.target?.kind === 'component') return {kind:'component',
    unitId:command.target.runtimeUnitId, componentId:command.target.componentId};
  if (command.target?.kind === 'unit') return {kind:'unit', unitId:command.target.runtimeUnitId};
  if (command.target?.kind === 'cell') return cellTarget(command.target);
  if (command.target?.kind === 'wreck') return cellTarget(command.displayCell);
  if (command.targetId) return {kind:'unit', unitId:command.targetId};
  if (command.carrierId) return {kind:'unit', unitId:command.carrierId};
  return Number.isInteger(command.x) && Number.isInteger(command.y) ? cellTarget(command) : null;
}

const kindFor = Object.freeze({Move:'move',EnemyMove:'move',EnemyHold:'hold',CatalogFire:'fire',
  CatalogHexFire:'hex-fire',CatalogRam:'ram',Embark:'load',CatalogLoad:'load',Unload:'unload',
  CatalogDeploy:'deploy',Engineer:'engineering',EndPhase:'end-phase'});

function describeOptions(listed,side) {
  return listed.map(({command,facts,baseline,displayCell})=>({command,executeKind:side,
    candidate:{kind:kindFor[command.type],actorId:command.actorId??null,
      target:targetFor({...command,displayCell}),weaponRef:command.weaponId??null,
      facts:{...facts,...(baseline?{baseline:true}:{}),
        ...(command.mode?{mode:command.mode,spotterId:command.spotterId}:{}),
        ...(command.cargoId?{cargoId:command.cargoId}:{}),
        ...(command.bayId?{bayId:command.bayId}:{}),
        ...(command.job?{job:command.job,option:command.option}:{})}}}));
}

export function createFullCatalogAiAdapter(host, readGeneration) {
  let slot = null;
  let slotEpoch = 0;
  const adapter = createAiDecisionAdapter({
    read: () => ({state:host.revision(), generation:`${readGeneration()}:${slotEpoch}`}),
    describe: (revision, side, scope) => {
      if (scope !== undefined || !revision || !['player','enemy'].includes(side) || host.phase() !== side)
        return {ok:false, code:'AI_FULL_SCOPE_UNAVAILABLE'};
      const view = host.project(side);
      const listed = side === 'player' ? host.playerOptions() : slot?.entries();
      if (!listed) return {ok:false, code:'AI_FULL_SLOT_UNAVAILABLE'};
      return {ok:true, phase:view.phase, slot:side === 'player' ? view.phase : slot.pass,
        view, options:describeOptions(listed,side)};
    },
    apply: (revision, {command,executeKind}) => {
      const result = executeKind === 'player' ? host.dispatch(command,revision) : slot.execute(command);
      return result.ok ? {action:command} : {error:{code:result.code ?? 'AI_FULL_COMMAND_REJECTED'}};
    }
  });

  function inEnemySlot(nativeSlot, select) {
    if (slot) throw Error('AI_FULL_SLOT_REENTRY');
    // HOLD can leave every unit fact unchanged, but it still spends the slot.
    slot = nativeSlot;
    slotEpoch++;
    try {return select(adapter.open('enemy'),adapter.execute)}
    finally {adapter.invalidate();slot=null}
  }

  return Object.freeze({open:adapter.open,execute:adapter.execute,invalidate:adapter.invalidate,
    chooseEnemyFire:select=>nativeSlot=>inEnemySlot(nativeSlot,select),
    chooseEnemyStep:select=>nativeSlot=>inEnemySlot({pass:'first-movement',execute:nativeSlot.execute,
      entries:()=>host.enemyStepOptions(nativeSlot)},select)});
}

export function sameFullCatalogActionSlot(left,right) {
  return !!left && !!right && left.sessionId===right.sessionId && left.side===right.side && left.slot===right.slot;
}

export function createOwnedFullCatalogAiAdapter(port,player) {
  const captured=new WeakMap();
  let prepared;
  function commit(token,command,evidence){
    const result=port.commit('ai',token,command,player.dispatch,evidence);
    return result.ok?{ok:true,action:command}:{ok:false,code:result.code??'AI_FULL_COMMAND_REJECTED'};
  }
  const adapter=createAiDecisionAdapter({
    read:()=>({state:port.ticket('ai')}),
    describe:(token,side,scope)=>{
      const opened=port.open('ai'), projection=port.project('ai');
      if(scope!==undefined||!opened||!projection||opened.permit!==token||token.side!==side)
        return {ok:false,code:'AI_FULL_SCOPE_UNAVAILABLE'};
      const listed=[...player.playerOptions(!!projection.view.tactics),{command:{type:'EndPhase'},facts:{}}];
      prepared={token,commands:listed.map(({command})=>command)};
      return {ok:true,phase:token.phase,slot:opened.pass,view:projection.view,options:describeOptions(listed,side)};
    },
    apply:(token,{command},evidence)=>{
      const result=commit(token,command,evidence);
      return result.ok?{action:result.action}:{error:{code:result.code}};
    }
  });
  return Object.freeze({...adapter,
    captureStrongDecision(batch){
      const native=captured.get(batch);
      if(!native||port.ticket('ai')!==native.token||batch.side!==native.token.side)return null;
      const snapshot=port.simulationSnapshot(native.token);
      if(!snapshot)return null;
      return {version:1,profile:'FULL_CATALOG_v1',side:batch.side,revision:batch.revision,
        rootView:batch.view,snapshot,
        actions:native.commands.map((action,index)=>({index,action:structuredClone(action)}))};
    },
    open(side,scope){
      const batch=adapter.open(side,scope);
      if(batch.ok)captured.set(batch,prepared);
      return batch;
    },
    remember(batch,key,evidence){
      const batchNative=captured.get(batch);
      const index=batch.candidates.findIndex(candidate=>candidate.key===key);
      return batchNative&&index>=0 ? {token:batchNative.token,command:batchNative.commands[index],evidence} : null;
    },
    resume({token:original,command,evidence}){
      const fresh=port.ticket('ai');
      if(!sameFullCatalogActionSlot(original,fresh)||fresh.generation===original.generation||
          fresh.revision!==original.revision||fresh.phase!==original.phase||fresh.actorId!==original.actorId)return null;
      // Only the recorded command is reused. The old permission never reaches commit.
      return commit(fresh,command,evidence);
    }
  });
}

// Inject the existing player command composer and revision-bound UI gateway.
// Tests and a future browser owner can supply the same interfaces without DOM input.
export function createFullCatalogAiHost(full, specialistsUi, player, currentPhase, specialists) {
  const active = () => full.active() && full.aiProjection('player') !== null;
  function cells(view) {
    const result = [];
    for (let y=0;y<view.terrain.height;y++) for(let x=0;x<view.terrain.width;x++) result.push({x,y});
    return result;
  }
  function composePlayerOptions(safetyView,tactics) {
    if (!safetyView) return [];
    const roster = full.roster(safetyView.side);
    const view = {turnPhase:safetyView.phase,units:roster};
    const allCells = cells(safetyView);
    const seen = new Set(), available = [];
    for (const actor of roster.filter(unit=>unit.team===safetyView.side)) for (const cell of allCells) {
      for (const {command} of specialistsUi.commands(view,actor,cell)) {
        const key = JSON.stringify(command);
        if (seen.has(key)) continue;
        seen.add(key);
        const check = player.query(command);
        if (!check.ok) continue;
        const preview = command.type==='CatalogFire' ? specialists.firePreview(command,false,tactics) : null;
        available.push({command,displayCell:cell,facts:{
          ...(command.type==='Move'?{observedCellsAfterMove:full.observedCells(safetyView.side,command)}:{}),
          ...(Number.isFinite(check.cost)?{cost:check.cost}:{}),
          ...(check.weapon?{attack:check.weapon.attack,range:check.weapon.range}:{}),
          ...(preview?.ok?{ratioCategory:preview.ratioCategory,effectKind:preview.effectKind,
            objectiveTarget:preview.objectiveTarget,disabledTarget:preview.disabledTarget,
            ...(tactics?{expendable:preview.expendable}:{})}:{}),
          ...(command.type==='CatalogHexFire'?{ratioCategory:null,effectKind:'area',
            ...(tactics?full.hexTacticalFacts(check):{})}:{})}});
      }
    }
    return available;
  }
  function humanPlayerOptions(port) {
    if (port !== full.controllerPort()) return [];
    const view = port?.project('human')?.view;
    return view?.side === port.state()?.side ? composePlayerOptions(view,false) : [];
  }
  function enemyStepOptions(slot) {
    const hold = {type:'EnemyHold',actorId:slot.actorId};
    const options = slot.query(hold).ok ? [{command:hold,facts:{}}] : [];
    for (const {x,y} of cells(full.aiProjection('enemy'))) {
      const command = {type:'EnemyMove',actorId:slot.actorId,x,y};
      const check = slot.query(command);
      if(check.ok)options.push({command,facts:{path:check.path,observedCellsAfterMove:full.observedCells('enemy',command)}});
    }
    return options;
  }
  return Object.freeze({revision:()=>active()?full.commandRevision():null,phase:currentPhase,
    project:full.aiProjection,dispatch:player.dispatch,
    playerOptions:(tactics=false)=>composePlayerOptions(full.aiProjection(currentPhase()),tactics),
    humanPlayerOptions,enemyStepOptions});
}
