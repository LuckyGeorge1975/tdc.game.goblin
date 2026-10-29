import test from 'node:test';import assert from 'node:assert/strict';
import {fullScene} from './catalog-full-harness.mjs';import {read,execute} from './artillery-product-harness.mjs';
function controlledDamage(g){g.run("globalThis.destroyControlled=u=>{if(!u.catalogSystems){u.hp=0;return}while(!GoblinSystems.catalogIsHelpless(u.catalogSystems,GoblinSpecialistsRuntime.registry())){const target=GoblinSystems.catalogChooseTarget(u.catalogSystems,GoblinSpecialistsRuntime.registry()),hit=GoblinSystems.catalogApplyHit(u.catalogSystems,{targetId:target.id,result:'X',attackStrength:1000,cause:{kind:'direct',commandId:'controlled-terminal',attackerId:'boundary-fixture'}},GoblinSpecialistsRuntime.registry());u.catalogSystems=hit.state;GoblinSpecialistsRuntime.applyEffects(u,hit.effects)}}")}
test('Ninja actual owner obeys all tread bands, remains a system and never gains GEV or ram',async()=>{
 const g=await fullScene();g.run("globalThis.actor=units.find(u=>u.id==='u3-player-ninja')");
 for(const [remaining,movement] of [[30,3],[21,3],[20,2],[11,2],[10,1],[1,1],[0,0]]){
  g.context.remaining=remaining;g.run("if(actor.catalogSystems.treads>remaining){const hit=GoblinSystems.catalogApplyHit(actor.catalogSystems,{targetId:'treads',result:'X',attackStrength:actor.catalogSystems.treads-remaining,cause:{kind:'direct',commandId:'band-'+remaining,attackerId:'controlled-boundary'}},GoblinSpecialistsRuntime.registry());actor.catalogSystems=hit.state;GoblinSpecialistsRuntime.applyEffects(actor,hit.effects)}");
  assert.deepEqual(read(g,"[movementBudget(actor),movementBudget(actor,true),isGevUnit(actor),unitAlive(actor),Object.hasOwn(actor,'hp'),Object.hasOwn(actor,'infantry')]"),[movement,0,false,true,false,false]);
 }
 const command=read(g,"({type:'CatalogRam',actorId:actor.id,targetId:units.find(u=>u.core).id,x:10,y:3})");assert.equal(read(g,`GoblinSpecialistsRuntime.query(${JSON.stringify(command)})`).ok,false);
});
test('real U3 retries exactly three times, duplicate BeginTurn reuses full request, failed wave creates no casualty',async()=>{
 const g=await fullScene();g.run("const blockers=units.filter(u=>u.team==='enemy');blockers.forEach((u,i)=>{u.x=11;u.y=i});for(let n=1;n<=3;n++){turn=n;GoblinCatalogFullRuntime.beginTurn('enemy')}");
 const first=read(g,'GoblinCatalogFullRuntime.snapshot()');assert.equal(first.waves.waves[0].attempts,1);assert.equal(first.waves.waves[0].status,'pending');
 g.run("GoblinCatalogFullRuntime.beginTurn('enemy')");assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),first);
 g.run("for(let n=4;n<=5;n++){turn=n;GoblinCatalogFullRuntime.beginTurn('enemy')}");
 const last=read(g,'GoblinCatalogFullRuntime.snapshot()');assert.equal(last.waves.waves[0].attempts,3);assert.equal(last.waves.waves[0].status,'failed');assert.equal(read(g,"units.some(u=>u.id==='u3-wave-guard')"),false);assert.equal(read(g,'GoblinCatalogFullRuntime.pendingEnemy()'),0);
 assert.equal(last.journal.filter(e=>e.type==='begin-turn'&&e.effects.some(f=>f.type==='WaveFailed')).length,1);
});
test('the actual scheduled enemy callback is idempotent and its whole fire-move-fire window ends once',async()=>{
 const g=await fullScene();g.run("setTurnPhase('fire');setTurnPhase('gev');startEnemyTurn()");
 const callback=[...g.timers.values()].find(f=>String(f).includes('const foes='));assert.ok(callback);callback();
 const before=g.state(),full=read(g,'GoblinCatalogFullRuntime.snapshot()'),rng=g.rng();callback();assert.equal(g.state(),before);assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),full);assert.deepEqual(g.rng(),rng);
 assert.deepEqual(full.ownTurns,{player:2,enemy:1});assert.deepEqual(full.visibility.teamFire,{player:{completed:1,active:false},enemy:{completed:1,active:false}});
});
test('frozen area victims share one carrier roll; surviving infantry ejects without a second ground roll',async()=>{
 const g=await fullScene();g.run("globalThis.carrier=units.find(u=>u.catalogId==='U12');globalThis.cargo=units.find(u=>u.catalogId==='U15');carrier.x=5;carrier.y=0;carrier.disabled=true;cargo.x=5;cargo.y=0;cargo.embarkedOn=carrier.id;setTurnPhase('fire')");
 const actor=read(g,"units.find(u=>u.catalogId==='U13').id");g.context.rollQueue=[.2];const before=g.rolls();assert.equal(execute(g,{type:'CatalogHexFire',actorId:actor,x:5,y:0}).ok,true);assert.equal(g.rolls()-before,1);
 assert.deepEqual(read(g,'[unitAlive(carrier),cargo.hp,cargo.squads,cargo.embarkedOn,cargo.x,cargo.y]'),[false,1,1,null,5,0]);
 const outcomes=read(g,`units.find(u=>u.id===${JSON.stringify(actor)}).specialistJournal.at(-1).result.outcomes`);assert.equal(outcomes.length,1);assert.equal(outcomes[0].outcome.passengers.length,1);
});
test('last own unit and core are both resolved before survival-priority defeat; future own wave cannot revive',async()=>{
 const g=await fullScene();controlledDamage(g);g.run("const actor=units.find(u=>u.catalogId==='U13');units.filter(u=>u.team==='player'&&u!==actor).forEach(destroyControlled);actor.x=5;actor.y=0;const commandCore=units.find(u=>u.core);commandCore.x=6;commandCore.y=0;setTurnPhase('fire')");
 const actor=read(g,"units.find(u=>u.catalogId==='U13').id");g.context.rollQueue=[.99,.99];const before=g.rolls();assert.equal(execute(g,{type:'CatalogHexFire',actorId:actor,x:5,y:0}).ok,true);assert.equal(g.rolls()-before,2);assert.equal(read(g,"units.find(u=>u.core).hp"),0);
 const full=read(g,'GoblinCatalogFullRuntime.snapshot()');assert.equal(full.terminalOutcome,false);assert.equal(full.waves.waves[1].status,'discarded');assert.equal(read(g,'gameOver'),true);
});
test('pending enemy prevents premature victory; the U3 limit checks victory before limit defeat',async()=>{
 const g=await fullScene();controlledDamage(g);g.run("units.filter(u=>u.team==='enemy').forEach(destroyControlled);GoblinCatalogFullRuntime.refresh()");assert.equal(read(g,'checkVictory()'),false);assert.equal(read(g,'GoblinCatalogFullRuntime.pendingEnemy()'),1);
 g.run("const blockers=units.filter(u=>u.team==='player'&&!u.embarkedOn).slice(0,3);blockers.forEach((u,i)=>{u.x=11;u.y=i});for(let n=1;n<=20;n++){turn=n;GoblinCatalogFullRuntime.beginTurn('enemy')};GoblinCatalogFullRuntime.fireBoundary('enemy',true)");
 assert.equal(read(g,'GoblinCatalogFullRuntime.enemyEnd()'),true);assert.equal(read(g,'GoblinCatalogFullRuntime.terminalOutcome()'),true);
 const limit=await fullScene();limit.run("for(let n=1;n<=20;n++){turn=n;GoblinCatalogFullRuntime.beginTurn('enemy')};GoblinCatalogFullRuntime.fireBoundary('enemy',true);GoblinCatalogFullRuntime.enemyEnd()");assert.equal(read(limit,'GoblinCatalogFullRuntime.terminalOutcome()'),false);assert.equal(read(limit,'objectiveSnapshot(victoryProfile(legacySession.effectiveRules),units).playerAlive'),true);
});
