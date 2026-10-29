import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogScene,read,execute,enemy} from './catalog-product-harness.mjs';
const unit=id=>`units.find(u=>u.id==='${id}')`;
const unload=(x,y)=>({type:'Unload',actorId:'carrier-drone',cargoId:'drone',x,y});
function reject(g,c){const before=g.state(),rng=g.rng(),events=g.events();assert.equal(execute(g,c).ok,false);assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);assert.deepEqual(g.events(),events)}
for(const type of ['open-ground','rubble-field','mountain','ridge','forest','marsh','road','bridge','urban','crater','water','river'])test('drone deployment terrain: '+type,async()=>{
 const g=await catalogScene();g.context.cellType=type;g.run("terrainTypes.set('2,2',cellType)");
 if(['water','river'].includes(type))reject(g,unload(2,2));else assert.equal(execute(g,unload(2,2)).ok,true);
});
test('explicit SP1/2/3 roster; two counters cost1+2, no fourth SP/mixed mechanical cargo',async()=>{
 const g=await catalogScene();assert.deepEqual(read(g,"units.filter(u=>['reserve-one','reserve-two','squad'].includes(u.id)).map(u=>[u.hp,u.damage,u.defense])"),[[3,3,3],[1,1,1],[2,2,2]]);
 assert.equal(execute(g,{type:'Embark',actorId:'reserve-one',carrierId:'carrier-infantry',x:1,y:5}).ok,true);
 assert.equal(execute(g,{type:'Embark',actorId:'reserve-two',carrierId:'carrier-infantry',x:1,y:5}).ok,true);
 reject(g,{type:'Embark',actorId:'squad',carrierId:'carrier-infantry',x:1,y:5});
 assert.equal(g.run(`carrierLoad(${unit('carrier-infantry')})`),3);
 g.run(`${unit('drone')}.embarkedOn=null;${unit('drone')}.x=2;${unit('drone')}.y=5`);
 reject(g,{type:'Embark',actorId:'drone',carrierId:'carrier-infantry',x:1,y:5});
});
test('disabled/dead/enemy carrier or cargo rejects atomically; ground drone load consumes both main and fire',async()=>{
 for(const expression of ["units[0].disabled=true","units[1].disabled=true","units[0].hp=0","units[1].hp=0","units[0].team='enemy'"]){const g=await catalogScene();g.run(expression);reject(g,unload(2,2))}
 const g=await catalogScene();g.run(`${unit('drone')}.embarkedOn=null;${unit('drone')}.x=2`);
 assert.equal(execute(g,{type:'Embark',actorId:'drone',carrierId:'carrier-drone',x:1,y:2}).ok,true);
 assert.deepEqual(read(g,`[${unit('drone')}.moved,${unit('drone')}.fired,${unit('carrier-drone')}.moved,${unit('carrier-drone')}.secondMoved]`),[true,true,true,false]);
 reject(g,unload(2,2));
});
test('drone cannot fire aboard, cannot load after firing or without carrier main, cannot impersonate ordinary artillery',async()=>{
 const g=await catalogScene();g.run("setTurnPhase('fire')");reject(g,{type:'Fire',actorId:'drone',x:7,y:4});
 g.run("setTurnPhase('movement');units[1].embarkedOn=null;units[1].x=2;units[1].fired=true");reject(g,{type:'Embark',actorId:'drone',carrierId:'carrier-drone',x:1,y:2});
 g.run('units[1].fired=false;units[0].moved=true');reject(g,{type:'Embark',actorId:'drone',carrierId:'carrier-drone',x:1,y:2});
 g.run('units[0].moved=false;units[1].catalogId="U08"');assert.equal(g.run('GoblinCatalogRuntime.record(units[1]).catalogId'),'U14');
});
test('one shared roll and distinct quotes; carrier X + passenger D causes mechanical loss but infantry emergency survival',async()=>{
 const g=await catalogScene();g.context.rollQueue=[0];
 // Controlled resolver boundary only: differentiating defenses ensure primary X / drone NE on the same slot.
 g.run('units[0].defense=1;units[1].defense=20');const before=g.rolls();
 const r=read(g,"combatOutcome({damage:5,team:'enemy'},units[0])");assert.equal(r.result,'X');assert.equal(r.passengers[0].outcome.directResult,'NE');assert.equal(r.passengers[0].outcome.result,'X');assert.equal(g.rolls()-before,1);assert.equal(g.run('units[1].hp'),0);
 const h=await catalogScene();assert.equal(execute(h,{type:'Embark',actorId:'squad',carrierId:'carrier-infantry',x:1,y:5}).ok,true);h.context.rollQueue=[2/6];h.run(`${unit('carrier-infantry')}.defense=1`);
 const rr=read(h,`combatOutcome({damage:5,team:'enemy'},${unit('carrier-infantry')})`);assert.equal(rr.result,'X');assert.equal(rr.passengers[0].outcome.result,'D');assert.deepEqual(read(h,`[${unit('squad')}.hp,${unit('squad')}.damage,${unit('squad')}.defense,${unit('squad')}.embarkedOn,${unit('squad')}.x,${unit('squad')}.y]`),[2,2,2,null,1,5]);
});
test('infantry fires aboard once; Undo restores SP, cargo identity and cached roll; retry uses no fresh RNG',async()=>{
 const g=await catalogScene();execute(g,{type:'Embark',actorId:'squad',carrierId:'carrier-infantry',x:1,y:5});
 g.run(`${unit('militia')}.x=2;${unit('militia')}.y=5;setTurnPhase('fire')`);const c={type:'Fire',actorId:'squad',x:2,y:5};g.context.rollQueue=[0];
 assert.equal(execute(g,c).ok,true);const before=g.rolls();reject(g,c);g.run('undoPhaseCommand()');assert.equal(g.run(`${unit('squad')}.embarkedOn`),'carrier-infantry');assert.equal(execute(g,c).ok,true);assert.equal(g.rolls(),before);
});
test('previously moved carrier keeps movement state through infantry unload; restart clears cargo readiness/history/ghost events',async()=>{
 const g=await catalogScene();execute(g,{type:'Embark',actorId:'squad',carrierId:'carrier-infantry',x:1,y:5});enemy(g);execute(g,{type:'Move',actorId:'carrier-infantry',x:3,y:5});
 assert.equal(execute(g,{type:'Unload',actorId:'carrier-infantry',cargoId:'squad',x:2,y:5}).ok,true);assert.equal(g.run(`${unit('carrier-infantry')}.moved`),true);
 g.run("loadScenario('catalog-transport')");assert.equal(g.run('turn'),1);assert.equal(g.run('phaseCommands.length'),0);assert.equal(g.run(`${unit('drone')}.embarkedOn`),'carrier-drone');assert.equal(g.run(`${unit('drone')}.droneReadyTurn??1`),1);assert.equal(g.events().length,0);
});
