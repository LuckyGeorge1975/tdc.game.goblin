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
    ...(enabled?['presentation-state.js']:[]),'game.js','ogre-runtime.js','combat-feedback.js',
    'siegebreaker-weapons.js','strategic-missile.js','scenario.js',
    ...(enabled?['legacy-presentation.js']:[]),'command-history.js'];
  for(const file of files)run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>globalThis.GoblinLegacyPresentation?.sync();updateSelection=()=>{};loadScenario('iron-dust');");
  return {run,timers,rolls:()=>rolls,animations:()=>animations,
    events:()=>JSON.parse(run('JSON.stringify(GoblinPresentation.events())')),
    state:()=>run('JSON.stringify({units,terrain:[...terrain],terrainTypes:[...terrainTypes],legacySession,turn,phase,turnPhase,gameOver,phaseRolls,phaseRollCursor})')};
}

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
  assert.equal(observed.events().length,0,'this foundation does not emit fire effects');
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
