import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual loaded Legacy resolver/wrapper chain, with only DOM/timers stubbed.
function scene(enabled=true){
  const nodes=new Map(),timers=new Map();let id=0,rolls=0,animations=0;
  function element(){const classes=new Set();return {innerHTML:'',textContent:'',checked:false,
    disabled:false,style:{},dataset:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),
      contains:n=>classes.has(n),toggle(n,v){if(v??!classes.has(n))classes.add(n);else classes.delete(n);}},
    setAttribute(){},addEventListener(){},appendChild(){},before(){},querySelector(){return null;},
    animate(){animations++;},
    insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}};}
  const buttons=['movement','fire','los'].map(view=>Object.assign(element(),{dataset:{view}}));
  const document={querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s);},
    querySelectorAll:s=>s==='.view-option:not(#grid-toggle)'?buttons:[],createElement:element,
    createElementNS:element,addEventListener(){}};
  const math=Object.create(Math);math.random=()=>{rolls++;return .91;};
  const context=vm.createContext({document,Math:math,structuredClone,console,window:{},
    localStorage:{getItem(){return null;}},GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},
    setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},
    scheduleGameTask(fn){timers.set(++id,fn);return id;}});
  const run=s=>vm.runInContext(s,context);
  const files=['unit-visuals.js','terrain-rules.js','ogre-systems.js','scenario-profile-manifest.js',
    ...(enabled?['presentation-preferences.js','presentation-state.js']:[]),'game.js','ogre-runtime.js','combat-feedback.js',
    'siegebreaker-weapons.js','strategic-missile.js','scenario.js',
    ...(enabled?['legacy-presentation.js']:[]),'command-history.js'];
  for(const file of files)run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>globalThis.GoblinLegacyPresentation?.sync();updateSelection=()=>{};loadScenario('iron-dust');");
  return {run,timers,rolls:()=>rolls,animations:()=>animations,
    events:()=>JSON.parse(run('JSON.stringify(GoblinPresentation.events())')),
    state:()=>run('JSON.stringify({units,terrain:[...terrain],terrainTypes:[...terrainTypes],legacySession,turn,phase,turnPhase,gameOver,phaseRolls,phaseRollCursor})')};
}

function attachMovement(game){
  for(const file of ['fire-anchors.js','wreck-klassen.js','fire-presentation.js'])game.run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  game.run(fs.readFileSync(new URL('../movement-presentation.js',import.meta.url),'utf8'));
  game.run(`globalThis.motionTime=0;globalThis.motionCallbacks=new Map();globalThis.motionId=0;globalThis.motionFrames=[];
    globalThis.motionQueue=GoblinMovementMath.createQueue({now:()=>motionTime,
      request:fn=>{motionCallbacks.set(++motionId,fn);return motionId;},cancel:id=>motionCallbacks.delete(id),
      render:frame=>motionFrames.push(frame),finish:()=>{}});
    const motionTickets=new WeakMap();GoblinPresentation.subscribe((type,value)=>{
      if(type==='cancel')motionQueue.clear();
      if(type==='begin')motionTickets.set(value.ticket,value.sidecar);
      if(type==='confirm'){
        if(!value.events.length)motionQueue.enqueue(value);
        for(const event of value.events)motionQueue.enqueue({...value,event,beforeSidecar:motionTickets.get(value.ticket)});
      }
      if(type==='transition')motionQueue.enqueue(value);
    });`);
}

test('actual Legacy movement/Ram/enemy queue preserves full gameplay and RNG through skip, Undo and restart',()=>{
  for(const mode of ['high','normal','off']){
    const observed=scene(),control=scene(false);attachMovement(observed);
    observed.run(`GoblinPresentationPreferences.set('${mode}')`);
    for(const game of [observed,control])game.run('terrain.clear();units[5].x=2;units[5].y=5;selected=units[0];handleHex(2,5)');
    assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
    assert.equal(observed.run('motionQueue.busy()'),mode!=='off');
    observed.run('motionQueue.skip()');assert.equal(observed.state(),control.state());
    for(const game of [observed,control])game.run('undoPhaseCommand()');
    assert.equal(observed.state(),control.state());assert.equal(observed.run('motionQueue.busy()'),false);
    for(const game of [observed,control]){
      game.run('enemyTurn()');
      const enemyTask=[...game.timers.values()].find(fn=>String(fn).includes('const foes='));assert.ok(enemyTask);enemyTask();
    }
    assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
    assert.ok(observed.events().some(item=>item.event.actor.team==='enemy'));
    observed.run('while(motionQueue.read().active)motionQueue.skip()');assert.equal(observed.state(),control.state());
    for(const game of [observed,control])game.run("loadScenario('iron-dust')");
    assert.equal(observed.state(),control.state());assert.equal(observed.run('motionQueue.busy()'),false);
  }
});

test('native Legacy move uses the accepted turning path once, with identical game/RNG state',()=>{
  const observed=scene(),control=scene(false);
  observed.run('globalThis.expected=findMovementPath(units[0],{x:3,y:3},units[0].move)');
  for(const game of [observed,control])game.run('handleUnitClick(units[0]);handleHex(3,3)');
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const events=observed.events();assert.equal(events.length,1);
  assert.deepEqual(events[0].event.path,JSON.parse(observed.run('JSON.stringify(expected)')));
  assert.ok(events[0].event.path.length>1);
  const route=events[0].event.path,origin=events[0].event.actor.positionBefore;
  assert.ok(new Set(route.map((cell,index)=>{
    const from=index?route[index-1]:origin;
    return observed.run(`GoblinPresentationState.direction(${JSON.stringify(from)},${JSON.stringify(cell)})`).toFixed(4);
  })).size>1);
  observed.run('draw();draw();selected=units[0];handleHex(11,0)');
  assert.equal(observed.events().length,1,'redraw/rejected command does not emit');
});

test('instant owner suppresses only the old move translation; no-owner renderer remains unchanged',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control]){
    game.run('selected=units[0];handleHex(4,5);renderUnit(units[0])');
    assert.equal(game.run('units[0].moveFrom'),null);
    assert.equal(game.run('units[0].x'),4);assert.equal(game.run('units[0].y'),5);
  }
  assert.equal(observed.animations(),0);assert.equal(control.animations(),1);
  assert.equal(observed.state(),control.state());
});

test('a carrier move retains carried positions without emitting an autonomous passenger move',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run("loadScenario('unit-trial');selected=units[2];embark(units[3],units[2]);selected=units[2];handleHex(3,5)");
  assert.equal(observed.state(),control.state());
  const events=observed.events();assert.equal(events.length,1);
  assert.equal(events[0].event.actor.unitId,'gev-pc');
  const after=events[0].event.after.units;
  const carrier=after.find(u=>u.id==='gev-pc'),cargo=after.find(u=>u.embarkedOn==='gev-pc');
  assert.ok(cargo);assert.equal(cargo.x,carrier.x);assert.equal(cargo.y,carrier.y);
});

test('Legacy Undo restores facing, opens a distinct branch and ignores stale callbacks',()=>{
  const game=scene();
  game.run('selected=units[0];handleHex(4,5);globalThis.oldCalls=0;globalThis.late=GoblinPresentation.guard(()=>oldCalls++)');
  const first=game.events()[0].event;
  game.run('undoPhaseCommand();late()');
  assert.equal(game.run('oldCalls'),0);
  assert.equal(game.run('GoblinPresentation.read().facingByUnit.find(u=>u.unitId==="ogre").origin'),'baseline');
  game.run('selected=units[0];handleHex(4,5)');
  const second=game.events().at(-1).event;
  assert.notEqual(first.eventId,second.eventId);
  assert.equal(second.binding.branchGeneration,1);
  assert.deepEqual(second.path,first.path);
});

test('Legacy Ram records the actual path and target end state without extra rolls',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run('terrain.clear();units[5].x=2;units[5].y=5;selected=units[0];handleHex(2,5)');
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const event=observed.events()[0].event;
  assert.equal(event.kind,'ram');assert.equal(event.after.units.find(u=>u.id==='guard').hp,0);
  assert.equal(event.sourceResults[0].targetId,'guard');
  assert.equal(observed.run("GoblinPresentation.read().wrecks.find(w=>w.unitId==='guard').origin"),'confirmed-end-state');
  assert.equal(observed.run("GoblinPresentation.read().wrecks.find(w=>w.unitId==='guard').destructionRef.command.type"),'Ram');
  observed.run('undoPhaseCommand()');assert.equal(observed.run('units[5].hp'),3);
});

test('movement-sidecar checkpoints leave active fire wrappers and Undo roll cache untouched',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run("units[5].x=2;units[5].y=5;setTurnPhase('fire');attack(units[1],units[5]);undoPhaseCommand();attack(units[1],units[5])");
  assert.equal(observed.state(),control.state());
  assert.equal(observed.rolls(),control.rolls());
  assert.equal(observed.run('phaseRolls.length'),1);
  const fires=observed.events().filter(item=>item.event.kind==='fire');
  assert.equal(fires.length,2,'Undo/reissue records two distinct accepted fire actions');
  assert.notEqual(fires[0].event.eventId,fires[1].event.eventId);
});

test('real Legacy fire creates a static wreck, Undo removes it and cached reissue stays gameplay-identical',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run("units[5].x=2;units[5].y=5;setTurnPhase('fire');attack(units[1],units[5])");
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const read=()=>JSON.parse(observed.run('JSON.stringify(GoblinPresentation.read())'));
  const first=read().wrecks.find(w=>w.unitId==='guard');
  assert.ok(first);assert.equal(first.destructionRef.source,'legacy-combatOutcome');
  for(const game of [observed,control])game.run('undoPhaseCommand()');
  assert.equal(read().wrecks.length,0);
  for(const game of [observed,control])game.run('attack(units[1],units[5])');
  assert.notEqual(read().wrecks.find(w=>w.unitId==='guard').wreckId,first.wreckId);
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
});

test('Legacy used weapon is captured before auto selection, never inferred from the next weapon',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run("terrain.clear();units[5].x=2;units[5].y=5;setTurnPhase('fire');SiegebreakerWeapons.selectWeapon(units[0],'main');attack(units[0],units[5])");
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const fire=observed.events().find(item=>item.event.kind==='fire').event;
  assert.equal(fire.weapon.usedWeaponKey,'main');
  assert.equal(fire.weapon.attack,fire.before.units[0].ogreSystems.weapons.main.attack);
  assert.notEqual(fire.after.units[0].ogreSystems.selectedWeapon,fire.weapon.usedWeaponKey);
});

test('natural fire settle replaces busy-cached blocked area with the legal autoselected follow-up target',()=>{
  const game=scene();
  game.run("terrain.clear();units[5].x=2;units[5].y=5;units[6].x=2;units[6].y=4;setTurnPhase('fire');SiegebreakerWeapons.selectWeapon(units[0],'main');attack(units[0],units[5])");
  const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
  const slice=(first,last)=>ui.slice(ui.indexOf(first),ui.indexOf(last,ui.indexOf(first)));
  game.run(`globalThis.followBusy=true;globalThis.GoblinMovement={busy:()=>followBusy};
    globalThis.core=()=>false;globalThis.t=key=>key;globalThis.GoblinLanguage={current:'de'};
    globalThis.previewWeaponKey=actor=>actor.ogreSystems.selectedWeapon;
    const areaCache={key:null,value:null};
    ${slice('    function query(command)', '    function previewFire(command)')}
    ${slice('    function areaQuery(', '    function freeRatioChipCenter(')}
    function drawFollowArea(){
      const state={revision:'same-confirmed-shot',phase,turnPhase,gameOver,units};
      const actor=units[0],mode='fire',weaponKey=actor.ogreSystems.selectedWeapon;
      ${slice('      const key = JSON.stringify([core()', '      const hexWidth')}
      return JSON.stringify({key,legal:areaCache.value.legal});
    }
    globalThis.followBefore=drawFollowArea();`);
  assert.equal(game.run('units[0].ogreSystems.selectedWeapon'),'secondary');
  const during=JSON.parse(game.run('followBefore'));assert.equal(during.legal.length,0);
  const canonical=game.state(),rolls=game.rolls();
  game.run('followBusy=false');
  assert.equal(game.run("query({type:'Fire',actorId:'ogre',x:2,y:4,weaponKey:'secondary'}).ok"),true);
  const after=JSON.parse(game.run('drawFollowArea()'));
  assert.ok(after.legal.some(cell=>cell.x===2&&cell.y===4),'render must agree with the actual legal next shot');
  assert.notEqual(after.key,during.key,'busy and settled legalities require separate cache entries');
  assert.equal(game.state(),canonical);assert.equal(game.rolls(),rolls);
});

test('Legacy strategic splash preserves one launch and per-resolver outcomes, including friendly passengers',()=>{
  const observed=scene(),control=scene(false);attachMovement(observed);
  const setup="terrain.clear();units.splice(0,units.length,{id:'carrier',visualKey:'strategic-missile-carrier',name:'CARRIER',x:0,y:1,hp:2,maxHp:2,team:'player',strategicMissile:true,missilesRemaining:1,range:8,damage:6},{id:'target',visualKey:'guard-tank',name:'TARGET',x:2,y:3,hp:2,maxHp:2,defense:2,team:'enemy',transportCapacity:3},{id:'passenger',visualKey:'infantry-squad',name:'PASSENGER',x:2,y:3,hp:2,maxHp:2,defense:1,infantry:true,embarkedOn:'target',team:'enemy'},{id:'adjacent',visualKey:'infantry-squad',name:'FRIEND',x:3,y:4,hp:2,maxHp:2,defense:2,team:'player'});setTurnPhase('fire');attack(units[0],units[1])";
  for(const game of [observed,control])game.run(setup);
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const fires=observed.events().filter(item=>item.event.kind==='fire');assert.equal(fires.length,1);
  const fire=fires[0].event;assert.equal(fire.weapon.semanticKind,'missile');assert.equal(fire.sourceResults.length,2);
  assert.equal(fire.before.units[0].missilesRemaining,1);assert.equal(fire.after.units[0].missilesRemaining,0);
  assert.deepEqual(fire.effects.map(effect=>effect.role),['primary','passenger','splash']);
  assert.equal(fire.effects[1].sourceResultIndex,0);assert.equal(fire.effects[2].sourceResultIndex,1);
  assert.equal(observed.rolls(),fire.sourceResults.length,'passengers use their primary resolver roll without another draw');
  assert.equal(fire.effects[2].after.team,'player');
  observed.run(`globalThis.rocketPlan=GoblinFirePresentation.plan(GoblinPresentation.events().at(-1).event,0);
    globalThis.moveFrame=ms=>{motionTime+=ms;const pending=[...motionCallbacks.values()];motionCallbacks.clear();pending.forEach(fn=>fn());};`);
  assert.equal(observed.run('rocketPlan.rockets.length'),1);
  assert.ok(observed.run('rocketPlan.duration>=rocketPlan.arrival+3420'));
  const final=observed.state(),rolls=observed.rolls();
  observed.run('moveFrame(rocketPlan.arrival+3000)');assert.equal(observed.run('motionQueue.busy()'),true);
  observed.run('moveFrame(rocketPlan.duration);moveFrame(220)');assert.equal(observed.run('motionQueue.busy()'),false);
  assert.equal(observed.state(),final);assert.equal(observed.rolls(),rolls);
});

test('Legacy system losses create no wreck until actual whole-unit destruction, without extra rolls',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run("GoblinOgreRuntime.resolveSystemAttack(units[5],units[0],'main')");
  assert.equal(observed.run('GoblinPresentation.read().wrecks.length'),0);
  for(const game of [observed,control])game.run("const system=units[0].ogreSystems;Object.values(system.weapons).forEach(w=>w.destroyed=w.count);system.treads=1;GoblinOgreRuntime.resolveSystemAttack(units[5],units[0],'treads')");
  assert.equal(observed.run('units[0].hp'),0);
  assert.equal(observed.run('GoblinPresentation.read().wrecks[0].destructionRef.source'),'legacy-resolveSystemAttack');
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
});

test('actual Legacy carrier combat serializes killed hidden passengers without a second visible wreck',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control])game.run("units[5].transportCapacity=3;units[6].embarkedOn=units[5].id;units[6].x=units[5].x;units[6].y=units[5].y;units[1].damage=99;combatOutcome(units[1],units[5])");
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const wrecks=JSON.parse(observed.run('JSON.stringify(GoblinPresentation.read().wrecks)'));
  assert.ok(wrecks.some(w=>w.unitId==='guard'&&w.cargoRelation===null));
  assert.ok(wrecks.some(w=>w.unitId===observed.run('units[6].id')&&w.cargoRelation?.carrierId==='guard'));
});

test('a terminal Legacy Ram captures the completed victory check, not its intermediate state',()=>{
  const game=scene();
  game.run("terrain.clear();units.filter(u=>u.team==='enemy'&&u.id!=='guard').forEach(u=>u.hp=0);units[5].x=2;units[5].y=5;selected=units[0];handleHex(2,5)");
  assert.equal(game.run('gameOver'),true);
  const event=game.events()[0].event;
  assert.equal(event.after.gameOver,true);
  assert.equal(event.after.phase,game.run('turnPhase'));
});

test('Legacy resolver captures explicit animation mode at action start without changing cached fire/Undo state',()=>{
  const observed=scene(),control=scene(false);
  observed.run("GoblinPresentationPreferences.set('normal')");
  for(const game of [observed,control])game.run("units[5].x=2;units[5].y=5;setTurnPhase('fire');attack(units[1],units[5])");
  assert.equal(observed.run('GoblinPresentation.read().animationPreference.mode'),'normal');
  assert.equal(observed.run('GoblinPresentation.read().wrecks[0].destructionRef.animationPreference.mode'),'normal');
  observed.run("GoblinPresentationPreferences.set('off');GoblinLegacyPresentation.sync()");
  assert.equal(observed.run('GoblinPresentation.read().animationPreference.mode'),'normal','redraw cannot change current action mode');
  for(const game of [observed,control])game.run('undoPhaseCommand();attack(units[1],units[5])');
  assert.equal(observed.run('GoblinPresentation.read().animationPreference.mode'),'off');
  assert.equal(observed.run('GoblinPresentationPreferences.read().mode'),'off','Undo does not revert explicit setting');
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
});

test('each internal Legacy enemy move is captured before later enemy actions, not as one turn diff',()=>{
  const observed=scene(),control=scene(false);
  for(const game of [observed,control]){
    game.run('enemyTurn()');
    // Run the actual scheduled enemy-turn callback, leaving toast/phase timers alone.
    const callback=[...game.timers.values()].find(fn=>String(fn).includes('const foes='));
    assert.ok(callback);callback();
  }
  assert.equal(observed.state(),control.state());assert.equal(observed.rolls(),control.rolls());
  const events=observed.events();assert.ok(events.length>1);
  for(const {event} of events){assert.equal(event.actor.team,'enemy');assert.ok(event.path.length>0);}
  assert.equal(new Set(events.map(item=>item.event.eventId)).size,events.length);
});

test('canceled restart preserves sidecar; accepted restart discards old session/callbacks',async()=>{
  const game=scene();game.run('selected=units[0];handleHex(4,5)');
  const before=game.run('JSON.stringify(GoblinPresentation.read())');
  game.run('GameDialogs.confirm=async()=>false');await game.run('resetScenario()');
  assert.equal(game.run('JSON.stringify(GoblinPresentation.read())'),before);
  game.run('globalThis.calls=0;globalThis.late=GoblinPresentation.guard(()=>calls++);GameDialogs.confirm=async()=>true');
  await game.run('resetScenario()');game.run('late()');
  assert.equal(game.run('calls'),0);assert.equal(game.events().length,0);
  assert.notEqual(game.run('JSON.stringify(GoblinPresentation.read().binding)'),
    JSON.stringify(JSON.parse(before).binding));
});
