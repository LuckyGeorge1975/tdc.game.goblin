import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {recordProfileReplay,validateProfileReplay} from '../src/core/replay-contract.mjs';
import {recordSiegeTankProbeReplay,validateSiegeTankProbeReplay} from '../src/core/siege-tank-probe-replay.mjs';
import {recordArtillerySpotterProbeReplay,validateArtillerySpotterProbeReplay} from '../src/core/artillery-spotter-probe-replay.mjs';
import {phaseScenario} from '../src/core/game-core.mjs';
import {CORE_PROFILE_CONTRACT} from '../src/core/profile-contract.mjs';
import {recordIronDustProfileReplay,validateIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
const level=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/levels/skimmer-pilot.v1.json',import.meta.url),'utf8'));
const registry=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.v1.json',import.meta.url),'utf8'));
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
  const context=vm.createContext({document,Math:math,structuredClone,console,URLSearchParams,window:{},
    localStorage:{getItem(){return null;}},GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},
    setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},
    scheduleGameTask(fn){timers.set(++id,fn);return id;}});
  const run=s=>vm.runInContext(s,context);
  const files=['unit-visuals.js','terrain-rules.js','ogre-systems.js','siege-tank-fire-budget.js','assets/unit-art/rules/siege-pilot.v1.js','skimmer-budget.js','assets/unit-art/rules/skimmer-pilot.v1.js','scenario-profile-manifest.js',
    ...(enabled?['presentation-preferences.js','presentation-state.js']:[]),'game.js','ogre-runtime.js','combat-feedback.js',
    'siegebreaker-weapons.js','strategic-missile.js','siege-pilot-runtime.js','scenario.js',
    ...(enabled?['legacy-presentation.js']:[]),'command-history.js'];
  for(const file of files)run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>globalThis.GoblinLegacyPresentation?.sync();updateSelection=()=>{};loadScenario('iron-dust');");
  run(`scenarioCatalog['skimmer-pilot']=GoblinSkimmerPilot.create(${JSON.stringify(level)},${JSON.stringify(registry)});loadScenario('skimmer-pilot');`);
  return {run,context,timers,rolls:()=>rolls,animations:()=>animations,
    events:()=>JSON.parse(run('JSON.stringify(GoblinPresentation.events())')),
    state:()=>run('JSON.stringify({units,terrain:[...terrain],terrainTypes:[...terrainTypes],legacySession,turn,phase,turnPhase,gameOver,phaseRolls,phaseRollCursor})')};
}

function queryBridge(g){
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
 const start=ui.indexOf('    function query(command)'),end=ui.indexOf('    function undo()',start);
 g.run(`const core=()=>false,t=key=>key,view={busy:false},revision=()=>JSON.stringify([turn,phase,turnPhase,units]);let startZoomPending=null;const render=()=>{};${ui.slice(start,end)}`);
}
function enemy(g){g.run('startEnemyTurn()');const fn=[...g.timers.values()].find(fn=>String(fn).includes('const foes='));assert.ok(fn);fn();}
function move(g,x,y){const command={type:'Move',actorId:'combat-skimmer',x,y};assert.equal(g.run(`query(${JSON.stringify(command)}).ok`),true,JSON.stringify(command));assert.equal(g.run(`dispatch(${JSON.stringify(command)},revision()).ok`),true);}
function fire(g,id){g.run(`setTurnPhase('fire')`);const result=g.run(`(()=>{const target=units.find(u=>u.id==='${id}');return dispatch({type:'Fire',actorId:'combat-skimmer',x:target.x,y:target.y},revision()).ok})()`);assert.equal(result,true);}

test('fixed source, full roster/terrain/profile/digest and session snapshots reject alteration before mutation',()=>{
 const g=scene();assert.equal(g.run('legacySession.ruleProfileId'),'CATALOG_SKIMMER_PILOT_v1');
 assert.equal(g.run('Object.isFrozen(legacySession.effectiveRules.movement)'),true);
 const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]))):value;
 const digest=createHash('sha256').update(JSON.stringify(stable(level))).digest('hex');
 assert.equal(g.run('legacySession.effectiveRules.sourceDigest'),digest);
 for(const mutation of ["c.scenarioVersion=2","c.ruleProfileId='FULL_CATALOG_v1'","c.sourceDigest='fake'","c.units[0].move=5","c.units[0].hp=3","c.units.push({...c.units[1],id:'raider-skimmer'})","c.units[0].x=2","c.movement.secondary=4","c.terrainTypes[0].type='road'"]){
  const before=g.state();assert.throws(()=>g.run(`{const c=JSON.parse(JSON.stringify(scenarioCatalog['skimmer-pilot']));${mutation};ScenarioRuleProfiles.beginSession('skimmer-pilot',c)}`));assert.equal(g.state(),before);
 }
 assert.equal(registry.targetActive,false);
 const oldPairs=[
  [recordProfileReplay({...structuredClone(phaseScenario),...structuredClone(CORE_PROFILE_CONTRACT)},7,[]),validateProfileReplay],
  [recordSiegeTankProbeReplay(7,[]),validateSiegeTankProbeReplay],
  [recordArtillerySpotterProbeReplay(7,[]),validateArtillerySpotterProbeReplay],
  [recordIronDustProfileReplay(7,[]),validateIronDustProfileReplay]
 ];
 for(const [old,validate] of oldPairs){
   assert.doesNotThrow(()=>validate(old));
   const changed=structuredClone(old);changed.header.ruleProfileId=level.ruleProfileId;changed.header.scenarioId=level.id;
   assert.throws(()=>validate(changed),/MISMATCH/);
 }
 assert.throws(()=>recordProfileReplay({...level,header:{ruleProfileId:level.ruleProfileId}},7,[]),/REPLAY_PROFILE_MISMATCH/);
});

test('query, dispatch and terrain cost use 4-not-5 and 3-not-4; rejected actions never consume RNG',()=>{
 for(const second of [false,true]){
  const g=scene();queryBridge(g);g.run(`setTurnPhase('${second?'gev':'movement'}')`);
  const allowance=second?3:4;
  const cells=JSON.parse(g.run(`JSON.stringify(Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12)})).map(to=>({to,path:findMovementPath(units[0],to,99)})).filter(p=>p.path?.length).map(p=>({...p,cost:p.path.reduce((n,c)=>n+movementCost(units[0],c.x+','+c.y),0)})))`));
  const positive=cells.find(c=>c.cost===allowance),negative=cells.find(c=>c.cost===allowance+1);assert.ok(positive&&negative);
  const before=g.state(),rolls=g.rolls();
  const cmd={type:'Move',actorId:'combat-skimmer',...negative.to};assert.equal(g.run(`query(${JSON.stringify(cmd)}).ok`),false);assert.equal(g.run(`dispatch(${JSON.stringify(cmd)},revision()).ok`),false);assert.equal(g.state(),before);
  move(g,positive.to.x,positive.to.y);assert.equal(g.rolls(),rolls);assert.equal(g.run(`units[0].${second?'secondMoved':'moved'}`),true);
  assert.equal(g.run(`query(${JSON.stringify({type:'Move',actorId:'combat-skimmer',x:1,y:3})}).ok`),false);
 }
 const g=scene();queryBridge(g);
 for(const mutation of ["turnPhase='fire'","units[0].disabled=true","units[0].hp=0","units[0].moved=true"]){g.run("loadScenario('skimmer-pilot');"+mutation);const before=g.state();assert.equal(g.run("dispatch({type:'Move',actorId:'combat-skimmer',x:2,y:3},revision()).ok"),false);assert.equal(g.state(),before);}
 g.run("loadScenario('iron-dust')");assert.equal(g.run("movementBudget(units.find(u=>u.id==='gev'),true)"),2);
 assert.equal(g.run("GoblinSkimmerBudget.sessionBudget(legacySession,{id:'raider-skimmer',team:'enemy',move:3,gev:true}).secondary"),0);
});

test('real fixed-level victory route, phase reset and Undo reuse the same combat roll',()=>{
 const g=scene();queryBridge(g);
 move(g,4,1);g.run("setTurnPhase('fire');setTurnPhase('gev')");move(g,4,3);enemy(g);
 assert.equal(g.run('turn'),2);assert.equal(g.run('units[0].moved||units[0].secondMoved'),false);
 move(g,5,3);g.run("setTurnPhase('fire')");
 const command=JSON.parse(g.run("JSON.stringify((()=>{const u=units.find(u=>u.id==='guard-tank');return {type:'Fire',actorId:'combat-skimmer',x:u.x,y:u.y}})())"));
 const rolls=g.rolls();assert.equal(g.run(`dispatch(${JSON.stringify(command)},revision()).ok`),true);
 g.run('undoPhaseCommand()');assert.equal(g.run(`dispatch(${JSON.stringify(command)},revision()).ok`),true);assert.equal(g.rolls(),rolls+1);
 g.run("setTurnPhase('gev')");move(g,8,4);enemy(g);move(g,10,4);fire(g,'core');
 assert.equal(g.run('gameOver&&units[0].hp>0&&units.find(u=>u.core).hp===0'),true);
 console.log('Victory: T1 E02 -> E04; T2 F04, fire guard, I05; T3 K05, fire core (CRT rolls 6).');
 const session=g.run('legacySession.sessionId');g.run("loadScenario('skimmer-pilot')");assert.ok(g.run('legacySession.sessionId')>session);assert.equal(g.run('units[0].x'),1);
});

test('ordinary exposed approach produces defeat without state injection',()=>{
 const g=scene();queryBridge(g);move(g,4,1);g.run("setTurnPhase('fire');setTurnPhase('gev')");move(g,6,3);enemy(g);
 assert.equal(g.run('gameOver&&units[0].hp===0'),true);assert.ok(g.rolls()>0);
 console.log('Defeat: T1 E02 -> G04, enemy Guard advances H04 and fires (CRT roll 6).');
});

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

test('actual async loader registers the distinct fixed mission and preserves every historical level',async()=>{
 const g=scene();g.context.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'))});
 g.run("delete scenarioCatalog['skimmer-pilot']");g.run(fs.readFileSync(new URL('../atlas-level.js',import.meta.url),'utf8'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(g.run("Object.keys(scenarioCatalog).filter(id=>id!=='siege-pilot').length"),10);g.run("loadScenario('skimmer-pilot')");assert.equal(g.run('units.length'),3);assert.equal(g.run("scenarioCatalog['showcase-terrain-course'].units.length"),7);
});
test('overlay costs, native Guide, M1 and animation paths agree with the frozen session and Undo',()=>{
 const g=scene();queryBridge(g);attachMovement(g);
 for(const file of ['m1-unit-markers.js','unit-guide-range.js'])g.run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');const a=ui.indexOf('    function areaQuery('),b=ui.indexOf('    function freeRatioChipCenter(',a);g.run(ui.slice(a,b));
 const guide=JSON.parse(g.run("JSON.stringify(UnitGuideRange.profile({name:'COMBAT SKIMMER',move:'4 + 3',range:'2'},units[0]))"));assert.equal(guide.movement,4);assert.equal(guide.bonus,3);
 assert.equal(g.run("M1UnitMarkers.legacy(legacySession,units,'test',null).supported"),true);
 for(const phaseName of ['movement','gev']){
  g.run(`setTurnPhase('${phaseName}')`);const costs=JSON.parse(g.run("JSON.stringify(areaData({phase,turnPhase,gameOver,units},units[0],'movement').legal)"));assert.ok(costs.some(c=>c.cost===(phaseName==='gev'?3:4)));assert.ok(costs.every(c=>c.cost<=(phaseName==='gev'?3:4)));
 }
 g.run("setTurnPhase('movement');globalThis.path=findMovementPath(units[0],{x:4,y:1},movementBudget(units[0]));selected=units[0];handleHex(4,1)");
 assert.deepEqual(g.events().at(-1).event.path,JSON.parse(g.run('JSON.stringify(path)')));assert.equal(g.rolls(),0);assert.equal(g.run('motionQueue.busy()'),true);
 g.run('undoPhaseCommand()');assert.equal(g.run('motionQueue.busy()'),false);assert.equal(g.run('units[0].x'),1);assert.equal(g.run('units[0].moved'),false);
 g.run("selected=units[0];handleHex(4,1);loadScenario('skimmer-pilot')");assert.equal(g.run('motionQueue.busy()'),false);
});
test('occupied targets, terrain costs, secondary spent and hostile U26 cannot obtain a pilot move',()=>{
 const g=scene();queryBridge(g);assert.equal(g.run("query({type:'Move',actorId:'combat-skimmer',x:8,y:2}).ok"),false);
 assert.equal(g.run("movementCost(units[0],'3,3')"),2);assert.equal(g.run("movementCost(units[0],'6,2')"),1);
 g.run("setTurnPhase('gev');units[0].secondMoved=true");const before=g.state();assert.equal(g.run("dispatch({type:'Move',actorId:'combat-skimmer',x:2,y:3},revision()).ok"),false);assert.equal(g.state(),before);
 assert.equal(g.run("query({type:'Move',actorId:'guard-tank',x:7,y:3}).ok"),false);assert.throws(()=>g.run("GoblinSkimmerBudget.sessionBudget(legacySession,{id:'raider-skimmer',team:'enemy',move:3,gev:true})"));
});

test('actual V2 projection carries frozen pilot budgets and art identities into live library values',()=>{
 const g=scene();queryBridge(g);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');g.run('const legacyLogEntries=()=>[];'+ui.slice(ui.indexOf('    let idleCoreLog='),ui.indexOf('    function query(command)')));
 const live=JSON.parse(g.run('JSON.stringify(project())'));
 assert.equal(live.profile,'CATALOG_SKIMMER_PILOT_v1');assert.equal(live.units[0].move,4);assert.equal(live.units[0].secondaryMove,3);assert.equal(live.units[0].visualKey,'combat-skimmer');assert.equal(live.units[1].secondaryMove,0);
 g.run("loadScenario('iron-dust')");assert.equal(g.run("project().units.find(u=>u.id==='gev').secondaryMove"),2);
});
