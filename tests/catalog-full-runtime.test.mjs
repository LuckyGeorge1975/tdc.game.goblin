import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {webcrypto} from 'node:crypto';
import {artilleryScene,read,queryBridge,execute} from './artillery-product-harness.mjs';
import {fullScene as scene} from './catalog-full-harness.mjs';
test('actual full session uses complete world and filters hidden Ninja from viewer roster without query mutation',async()=>{
 const g=await scene(),n=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy')");
 assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(n.id)})`),false);
 assert.equal(read(g,`GoblinCatalogFullRuntime.roster().some(u=>u.id===${JSON.stringify(n.id)})`),false);
 g.run("setTurnPhase('fire')");const before=g.state(),rng=g.rolls();
 const q=read(g,`GoblinSpecialistsRuntime.query({type:'CatalogFire',actorId:'u3-player-ninja',target:{kind:'component',runtimeUnitId:${JSON.stringify(n.id)},componentId:'main-1'},weaponId:'main-1',mode:'direct',spotterId:null})`);
 assert.equal(q.ok,false);assert.equal(q.code,'TARGET_UNAVAILABLE');assert.equal(g.state(),before);assert.equal(g.rolls(),rng);
});
test('empty legal hex shot consumes one ammo/action with zero RNG and BACK restores full state',async()=>{
 const g=await scene(),actor=read(g,"units.find(u=>u.catalogId==='U13')");g.run("setTurnPhase('fire')");
 const command={type:'CatalogHexFire',actorId:actor.id,x:0,y:0};assert.equal(read(g,`query(${JSON.stringify(command)})`).ok,true);
 const before=read(g,'GoblinCatalogFullRuntime.snapshot()'),rolls=g.rolls();assert.equal(execute(g,command).ok,true);assert.equal(g.rolls(),rolls);
 assert.equal(read(g,`units.find(u=>u.id===${JSON.stringify(actor.id)}).ammunition`),0);
 g.run('undoPhaseCommand()');assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);assert.equal(read(g,`units.find(u=>u.id===${JSON.stringify(actor.id)}).ammunition`),1);
});
test('committed movement uses known occupancy and stops before first hidden collision; BACK restores reveal and movement',async()=>{
 const g=await scene();g.run("units.filter(u=>u.team==='player'&&u.id!=='u3-player-ninja').forEach(u=>u.disabled=true);const actor=units.find(u=>u.id==='u3-player-ninja'),hidden=units.find(u=>u.catalogId==='U21'&&u.team==='enemy');actor.x=1;actor.y=0;hidden.x=4;hidden.y=0;GoblinCatalogFullRuntime.refresh()");
 const id=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id"),command={type:'Move',actorId:'u3-player-ninja',x:4,y:0};
 assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(id)})`),false);
 const before=read(g,'GoblinCatalogFullRuntime.snapshot()');assert.equal(read(g,`query(${JSON.stringify(command)})`).ok,true);assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);
 assert.equal(execute(g,command).ok,true);assert.equal(read(g,"units.find(u=>u.id==='u3-player-ninja').x"),3);assert.equal(read(g,"units.find(u=>u.id==='u3-player-ninja').moved"),true);
 assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(id)})`),true);g.run('undoPhaseCommand()');assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),before);
});
test('U3 actual world spawns Guard before objective and stationary Drone fires immediately in its own fifth turn',async()=>{
 const g=await scene();assert.equal(read(g,'GoblinCatalogFullRuntime.pendingEnemy()'),1);
 g.run("turn=1;GoblinCatalogFullRuntime.beginTurn('enemy');turn=2;GoblinCatalogFullRuntime.beginTurn('enemy');");assert.equal(read(g,"units.some(u=>u.id==='u3-wave-guard')"),false);
 g.run("turn=3;GoblinCatalogFullRuntime.beginTurn('enemy')");assert.deepEqual(read(g,"(()=>{const u=units.find(u=>u.id==='u3-wave-guard');return [u.catalogId,u.x,u.y,u.fired,u.moved]})()"),['U25',11,0,false,false]);
 assert.equal(read(g,'GoblinCatalogFullRuntime.pendingEnemy()'),0);
 g.run("for(let n=2;n<=5;n++){turn=n;GoblinCatalogFullRuntime.beginTurn('player');}setTurnPhase('fire')");
 assert.deepEqual(read(g,"(()=>{const u=units.find(u=>u.id==='u3-wave-drone');return [u.catalogId,u.x,u.y,u.fired,u.moved,u.droneReadyTurn??1]})()"),['U14',0,6,false,false,1]);
 // Put a known target in range to distinguish readiness from lack of targets.
 g.run("const guard=units.find(u=>u.id==='u3-wave-guard');guard.x=1;guard.y=6;GoblinCatalogFullRuntime.refresh()");
 assert.equal(read(g,"GoblinSpecialistsRuntime.hasFireAction(units.find(u=>u.id==='u3-wave-drone'))"),true);
});
test('one atomic hex blast rolls once per frozen ground victim and reveals Ninja even on NE; BACK reuses cached rolls',async()=>{
 const g=await scene();g.run("const ninja=units.find(u=>u.catalogId==='U21'&&u.team==='enemy'),relay=units.find(u=>u.catalogId==='U24');ninja.x=6;ninja.y=0;relay.x=6;relay.y=1;setTurnPhase('fire');GoblinCatalogFullRuntime.refresh()");
 const actor=read(g,"units.find(u=>u.catalogId==='U13').id"),hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id"),command={type:'CatalogHexFire',actorId:actor,x:6,y:0};
 assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),false);assert.equal(read(g,`query(${JSON.stringify(command)})`).ok,true);
 g.context.rollQueue=[0,0];const start=g.rolls();assert.equal(execute(g,command).ok,true);assert.equal(g.rolls()-start,2);
 const journal=read(g,`units.find(u=>u.id===${JSON.stringify(actor)}).specialistJournal.at(-1)`);assert.equal(journal.result.outcomes[0].unitId,hidden);assert.equal(journal.result.outcomes[0].outcome.result,'NE');assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),true);
 g.run('undoPhaseCommand()');assert.equal(execute(g,command).ok,true);assert.equal(g.rolls()-start,2);assert.deepEqual(read(g,`units.find(u=>u.id===${JSON.stringify(actor)}).specialistJournal.at(-1)`),journal);
});
test('actual UI projection and M1 members exclude hidden live identity; nearby active carrier detects before deploy query',async()=>{
 const g=await scene();g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8'),a=ui.indexOf('    function project()'),b=ui.indexOf('    function query(command)',a);
 g.run(`let idleCoreLog=[],idleLegacyLogEntries=[];const legacyLogEntries=()=>[];${ui.slice(a,b)}`);
 const hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id"),projection=read(g,'project()');
 assert.equal(projection.markers.supported,true);assert.equal(JSON.stringify(projection.units).includes(hidden),false);assert.equal(JSON.stringify(projection.markers.objective).includes(hidden),false);
 assert.equal(JSON.stringify(projection).includes(hidden),false);assert.match(projection.revision,/^full:\d+:\d+$/);
 g.run("const hidden=units.find(u=>u.catalogId==='U21'&&u.team==='enemy'),forge=units.find(u=>u.catalogId==='U18');hidden.x=forge.x+1;hidden.y=forge.y;terrainTypes.set(`${hidden.x},${hidden.y}`,'forest');GoblinCatalogFullRuntime.refresh()");
 assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),true);
 const deploy=read(g,"(()=>{const forge=units.find(u=>u.catalogId==='U18'),cargo=carrierCargo(forge)[0],hidden=units.find(u=>u.catalogId==='U21'&&u.team==='enemy');return {type:'CatalogDeploy',actorId:forge.id,cargoId:cargo.id,bayId:cargo.cargoBay,x:hidden.x,y:hidden.y}})()");assert.equal(read(g,`query(${JSON.stringify(deploy)})`).ok,false);
});
test('briefing and presentation snapshots do not publish hidden identity or movement trails',async()=>{
 const g=await scene('catalog-full-specialists',7,true),hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id");
 assert.equal(JSON.stringify(read(g,'GoblinCatalogFullRuntime.initialRoster(legacySession.config)')).includes(hidden),false);
 assert.equal(JSON.stringify(read(g,'GoblinPresentation.read()')).includes(hidden),false);
 assert.equal(read(g,`GoblinLegacyPresentation.begin(units.find(u=>u.id===${JSON.stringify(hidden)}),[{x:9,y:1}],'move',null)`),null);
 assert.equal(JSON.stringify(g.events()).includes(hidden),false);
});
test('empty hex fire confirms one real coordinate launch with no fake victim and complete before/after ammo',async()=>{
 const g=await scene('catalog-full-specialists',7,true),actor=read(g,"units.find(u=>u.catalogId==='U13').id"),command={type:'CatalogHexFire',actorId:actor,x:0,y:0};g.run("setTurnPhase('fire')");const before=g.rolls();assert.equal(execute(g,command).ok,true);
 const events=g.events().filter(e=>e.event.kind==='fire');assert.equal(events.length,1);const event=events[0].event;assert.deepEqual(event.action.sourceCommand,command);assert.deepEqual(event.targetHex,{x:0,y:0});assert.equal(event.targetId,null);assert.equal(event.effects.length,0);assert.equal(event.sourceResults.length,0);assert.equal(g.rolls(),before);
 assert.equal(event.before.units.find(u=>u.id===actor).ammunition,1);assert.equal(event.after.units.find(u=>u.id===actor).ammunition,0);
 g.run(fs.readFileSync(new URL('../fire-presentation.js',import.meta.url),'utf8'));g.context.event=event;assert.equal(read(g,'GoblinFirePresentation.plan(event,0).diagnostic??null'),null);
});
test('contact loss removes historical target references from renderable fire budgets, journals and logs',async()=>{
 const g=await scene('catalog-full-atlas',7,true);g.run("const shooter=units.find(u=>u.catalogId==='U07'),subject=units.find(u=>u.catalogId==='U21');shooter.x=1;shooter.y=0;subject.x=2;subject.y=0;terrain.clear();terrainTypes.clear();setTurnPhase('fire')");
 const command=read(g,"({type:'CatalogFire',actorId:units.find(u=>u.catalogId==='U07').id,target:{kind:'component',runtimeUnitId:units.find(u=>u.catalogId==='U21').id,componentId:'main-1'},weaponId:'main-1',mode:'direct',spotterId:null})"),hidden=command.target.runtimeUnitId;g.context.rollQueue=[0];assert.equal(execute(g,command).ok,true);
 g.run("const subjectAfter=units.find(u=>u.catalogId==='U21');subjectAfter.x=11;subjectAfter.y=0;setTurnPhase('gev');setTurnPhase('fire');setTurnPhase('gev');GoblinLegacyPresentation.sync()");assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),false);
 assert.equal(JSON.stringify(read(g,'GoblinPresentation.endState()')).includes(hidden),false);assert.equal(JSON.stringify(read(g,"GoblinSpecialistsRuntime.projectUnit(units.find(u=>u.catalogId==='U07'))")).includes(hidden),false);assert.equal(read(g,'GoblinCatalogFullRuntime.logEntries()[0].message'),'v2.full.stealth.contactLost');
 assert.equal(read(g,"units.find(u=>u.catalogId==='U07').catalogFire.state.mainTargets.length"),1);
});
test('reveal outside fire expires at next end while reveal during fire survives that end exactly once',async()=>{
 const g=await scene(),hidden=read(g,"units.find(u=>u.catalogId==='U21'&&u.team==='enemy').id");
 g.run(`GoblinCatalogFullRuntime.reveal(${JSON.stringify(hidden)},'incoming-direct','NE');setTurnPhase('fire');setTurnPhase('gev')`);assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),false);
 g.run(`setTurnPhase('fire');GoblinCatalogFullRuntime.reveal(${JSON.stringify(hidden)},'incoming-area','NE');setTurnPhase('gev')`);assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),true);
 g.run("setTurnPhase('fire');setTurnPhase('gev')");assert.equal(read(g,`GoblinCatalogFullRuntime.known(${JSON.stringify(hidden)})`),false);
});
