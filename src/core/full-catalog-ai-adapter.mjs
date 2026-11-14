import {createAiDecisionAdapter} from './ai-decision-adapter.mjs';

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
  CatalogDeploy:'deploy',Engineer:'engineering'});

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
        view, options:listed.map(({command, facts, baseline, displayCell}) => ({command, executeKind:side,
          candidate:{kind:kindFor[command.type],actorId:command.actorId,
            target:targetFor({...command,displayCell}),weaponRef:command.weaponId ?? null,
            facts:{...facts,...(baseline ? {baseline:true} : {}),
              ...(command.mode ? {mode:command.mode,spotterId:command.spotterId} : {}),
              ...(command.cargoId ? {cargoId:command.cargoId} : {}),
              ...(command.bayId ? {bayId:command.bayId} : {}),
              ...(command.job ? {job:command.job, option:command.option} : {})}}}))};
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

// Inject the existing player command composer and revision-bound UI gateway.
// Tests and a future browser owner can supply the same interfaces without DOM input.
export function createFullCatalogAiHost(full, specialistsUi, player, currentPhase, specialists) {
  const active = () => full.active() && full.aiProjection('player') !== null;
  function cells(view) {
    const result = [];
    for (let y=0;y<view.terrain.height;y++) for(let x=0;x<view.terrain.width;x++) result.push({x,y});
    return result;
  }
  function playerOptions() {
    const safetyView = full.aiProjection('player');
    const roster = full.roster('player');
    const view = {turnPhase:safetyView.phase,units:roster};
    const allCells = cells(safetyView);
    const seen = new Set(), available = [];
    for (const actor of roster.filter(unit=>unit.team==='player')) for (const cell of allCells) {
      for (const {command} of specialistsUi.commands(view,actor,cell)) {
        const key = JSON.stringify(command);
        if (seen.has(key)) continue;
        seen.add(key);
        const check = player.query(command);
        if (!check.ok) continue;
        const preview = command.type==='CatalogFire' ? specialists.firePreview(command) : null;
        available.push({command,displayCell:cell,facts:{
          ...(Number.isFinite(check.cost)?{cost:check.cost}:{}),
          ...(check.weapon?{attack:check.weapon.attack,range:check.weapon.range}:{}),
          ...(preview?.ok?{ratioCategory:preview.ratioCategory,effectKind:preview.effectKind,
            objectiveTarget:preview.objectiveTarget,disabledTarget:preview.disabledTarget}:{}),
          ...(command.type==='CatalogHexFire'?{ratioCategory:null,effectKind:'area'}:{})}});
      }
    }
    return available;
  }
  function enemyStepOptions(slot) {
    const hold = {type:'EnemyHold',actorId:slot.actorId};
    const options = slot.query(hold).ok ? [{command:hold,facts:{}}] : [];
    for (const {x,y} of cells(full.aiProjection('enemy'))) {
      const command = {type:'EnemyMove',actorId:slot.actorId,x,y};
      const check = slot.query(command);
      if(check.ok)options.push({command,facts:{path:check.path}});
    }
    return options;
  }
  return Object.freeze({revision:()=>active()?full.commandRevision():null,phase:currentPhase,
    project:full.aiProjection,dispatch:player.dispatch,playerOptions,enemyStepOptions});
}
