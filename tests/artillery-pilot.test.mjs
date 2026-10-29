import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {artilleryScene as scene,queryBridge,command,execute,enemy,read} from './artillery-product-harness.mjs';
const state=g=>g.state();
const phase=g=>g.run("setTurnPhase('fire')");
function fire(g,actor,target,mode='direct',spotter=null){const c=command(g,actor,target,mode,spotter);const result=execute(g,c);assert.equal(result.ok,true,JSON.stringify({c,result}));return c;}
function move(g,id,x,y){assert.equal(execute(g,{type:'Move',actorId:id,x,y}).ok,true);}

test('fixed artillery contract freezes approved HP2/3 and target stats, strict LOS, digest and passable starts',()=>{
 const g=scene();queryBridge(g);assert.equal(g.run('legacySession.ruleProfileId'),'CATALOG_ARTILLERY_PILOT_v1');assert.equal(g.run('legacySession.effectiveRules.losMode'),'strict-supercover');
 assert.deepEqual(read(g,'units.slice(0,2).map(u=>[u.hp,u.defense,u.damage,u.range,u.move])'),[[2,1,6,8,0],[3,2,6,6,1]]);
 assert.equal(g.run('Object.isFrozen(legacySession.effectiveRules.units[0].artilleryFire)'),true);assert.equal(g.run('units.every(u=>u.move===0||Number.isFinite(TerrainRules.movementCost(terrainTypeAt(u.x,u.y),u)))'),true);
 const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
 const level=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/levels/artillery-pilot.v1.json',import.meta.url),'utf8'));assert.equal(g.run('legacySession.effectiveRules.sourceDigest'),createHash('sha256').update(JSON.stringify(stable(level))).digest('hex'));
 for(const change of ["c.units[0].hp=1","c.units[1].hp=2","c.scenarioVersion=2","c.ruleProfileId='FULL_CATALOG_v1'","c.fireBudgetVersion='other'","c.sourceDigest='fake'","c.losMode='legacy'","c.units[0].artilleryFire.fired=true"]){const before=state(g);assert.throws(()=>g.run(`{const c=JSON.parse(JSON.stringify(scenarioCatalog['artillery-pilot']));${change};ScenarioRuleProfiles.beginSession('artillery-pilot',c)}`));assert.equal(state(g),before);}
 assert.equal(execute(g,{type:'Move',actorId:'long-range-battery',x:2,y:1}).ok,false);
});

test('real own/spotter Supercover and direct versus indirect use the same query/dispatch and exactly one roll',()=>{
 const g=scene();queryBridge(g);move(g,'mobile-siege-gun',2,6);phase(g);g.context.rollQueue=[0,0];
 for(const [id,target,range] of [['long-range-battery','guard-tank',8],['mobile-siege-gun','assault-tank',6]]){
  const direct=command(g,id,target),before=state(g),rolls=g.rolls();assert.equal(g.run(`query(${JSON.stringify(direct)}).code`),'DIRECT_LOS_REQUIRED');assert.equal(execute(g,direct).ok,false);assert.equal(state(g),before);
  const c=command(g,id,target,'indirect','recon-tank'),legal=g.run(`query(${JSON.stringify(c)})`);assert.equal(legal.ok,true);assert.equal(legal.weapon.attack,6);assert.equal(legal.weapon.range,range);
  const preview=g.run(`previewFire(${JSON.stringify(c)})`);assert.ok(preview?.legal);assert.equal(preview.weaponKey,'indirect/recon-tank');assert.equal(execute(g,c).ok,true);assert.equal(g.rolls(),rolls+1);
  const event=g.events().at(-1).event;assert.equal(event.weapon.mode,'indirect');assert.equal(event.weapon.spotterId,'recon-tank');assert.equal(event.weapon.attack,6);assert.equal(event.sourceResults.length,1);
  const after=state(g);assert.equal(execute(g,c).ok,false);assert.equal(state(g),after);assert.equal(g.rolls(),rolls+1);
 }
});

test('direct fire needs no spotter and Undo restores fired state and the same cached roll',()=>{
 const g=scene();queryBridge(g);phase(g);g.context.rollQueue=[0];const c=fire(g,'long-range-battery','rocket-artillery');assert.equal(g.rolls(),1);assert.equal(g.run('units[0].artilleryFire.fired'),true);
 g.run('undoPhaseCommand()');assert.equal(g.run('units[0].artilleryFire.fired'),false);assert.equal(execute(g,c).ok,true);assert.equal(g.rolls(),1);assert.equal(g.events().at(-1).event.weapon.spotterId,null);assert.equal(g.events().at(-1).event.weapon.mode,'direct');
 g.context.rollQueue=Array(20).fill(0);enemy(g);assert.equal(g.run('turn'),2);assert.equal(g.run('units[0].artilleryFire.fired'),false);g.run('resetActionState()');assert.equal(g.run('units[0].artilleryFire.turn'),2);
});

test('all live spotter, occupancy, target, range, phase and request gates reject atomically without RNG/events',()=>{
 const cases=["units[2].hp=0","units[2].disabled=true","units[2].team='enemy'","units[2].embarkedOn='carrier'","units[2].x=99","terrainTypes.set('6,2','forest')","units[0].hp=0","units[0].disabled=true","units[0].embarkedOn='carrier'","units[3].hp=0","units[3].team='player'","units[3].embarkedOn='carrier'","units[3].x=11","turnPhase='movement'","units[0].artilleryFire.fired=true","units[0].artilleryFire.turn=9"];
 for(const mutation of cases){const g=scene();queryBridge(g);phase(g);g.run(mutation);const c=command(g,'long-range-battery','guard-tank','indirect','recon-tank'),before=state(g),rolls=g.rolls(),events=JSON.stringify(g.events());assert.equal(execute(g,c).ok,false,mutation);assert.equal(state(g),before);assert.equal(g.rolls(),rolls);assert.equal(JSON.stringify(g.events()),events);}
 const g=scene();queryBridge(g);phase(g);const c=command(g,'long-range-battery','rocket-artillery');for(const altered of [{...c,spotterId:'recon-tank'},{...c,mode:'blind'},{...c,x:0,y:0},{...c,extra:true},{...c,type:'Fire'},{...c,mode:'indirect',spotterId:'missing'},{...c,mode:'indirect',spotterId:'long-range-battery'}]){const before=state(g);assert.equal(execute(g,altered).ok,false);assert.equal(state(g),before);}assert.equal(g.rolls(),0);
});

test('normal resolver victory uses direct stationary fire, move+indirect mobile fire, spotter and regular enemy rounds',()=>{
 const g=scene();queryBridge(g);move(g,'recon-tank',6,1);move(g,'mobile-siege-gun',2,6);phase(g);g.context.rollQueue=[.91,.91,.91,.91];
 fire(g,'long-range-battery','rocket-artillery');fire(g,'mobile-siege-gun','assault-tank','indirect','recon-tank');
 const guard=read(g,"units.find(u=>u.id==='guard-tank')");assert.equal(execute(g,{type:'Fire',actorId:'recon-tank',x:guard.x,y:guard.y}).ok,true);enemy(g);
 const route=[];for(let i=0;i<12&&!g.run('gameOver');i++){
  const destination=read(g,`(()=>{const a=units[1],target=units.find(u=>u.core),cells=[];for(let y=0;y<8;y++)for(let x=0;x<12;x++){if(units.some(u=>u.hp>0&&u.x===x&&u.y===y))continue;const p=findMovementPath(a,{x,y},a.move);if(p?.length)cells.push({x,y,d:dist({x,y},target)});}return cells.sort((a,b)=>a.d-b.d)[0]})()`);
  if(destination){move(g,'mobile-siege-gun',destination.x,destination.y);route.push({turn:g.run('turn'),x:destination.x,y:destination.y});}phase(g);const c=command(g,'mobile-siege-gun','core','indirect','recon-tank');if(g.run(`query(${JSON.stringify(c)}).ok`))assert.equal(execute(g,c).ok,true);if(!g.run('gameOver'))enemy(g);
 }
 assert.equal(g.run("gameOver&&units.some(u=>u.team==='player'&&u.hp>0)&&units.find(u=>u.core).hp===0"),true,JSON.stringify(route));console.log('Artillery controlled victory route',JSON.stringify(route));
 const lost=scene();queryBridge(lost);lost.context.rollQueue=Array(100).fill(.91);for(let i=0;i<15&&!lost.run('gameOver');i++)enemy(lost);assert.equal(lost.run("gameOver&&!units.some(u=>u.team==='player'&&u.hp>0)"),true);console.log('Artillery controlled hold-position defeat turn',lost.run('turn'));
});

test('exact R8/R6 boundaries, no hidden spotter weapon-range requirement and generic survival objective',()=>{
 for(const [id,index,limit,x] of [['long-range-battery',3,8,9],['mobile-siege-gun',4,6,8]]){
  const g=scene();queryBridge(g);if(index===4)move(g,id,2,6);phase(g);g.run(`units[${index}].x=${x}`);const c=command(g,id,index===3?'guard-tank':'assault-tank','indirect','recon-tank');assert.equal(g.run(`query(${JSON.stringify(c)}).ok`),true);const before=state(g);g.run(`units[${index}].x++`);const far=command(g,id,index===3?'guard-tank':'assault-tank','indirect','recon-tank');assert.equal(g.run(`query(${JSON.stringify(far)}).code`),'TARGET_OUT_OF_RANGE');assert.equal(execute(g,far).ok,false);assert.equal(g.rolls(),0);
 }
 const g=scene();queryBridge(g);phase(g);g.run('units[2].fired=true;units[2].moved=true');const observed=command(g,'long-range-battery','guard-tank','indirect','recon-tank');assert.equal(g.run(`query(${JSON.stringify(observed)}).ok`),true,'a spent movement/fire action does not disable a living spotter');assert.equal(g.run("victoryOutcome(victoryProfile(legacySession.effectiveRules),units.map(u=>({...u,hp:u.core||u.artilleryFire?0:u.hp})))"),true);assert.equal(g.run("victoryOutcome(victoryProfile(legacySession.effectiveRules),units.map(u=>({...u,hp:u.core||u.team==='player'?0:u.hp})))"),false);
});

test('actual V2 mode/spotter button builds FireArtillery, chosen preview/CRT and used event metadata; classic handles indirect LOS honestly',()=>{
 const g=scene();queryBridge(g);phase(g);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');g.run('const legacyLogEntries=()=>[];'+ui.slice(ui.indexOf('    let idleCoreLog='),ui.indexOf('    function query(command)')));
 const a=ui.indexOf('    function previewWeaponKey('),b=ui.indexOf('    function freeRatioChipCenter(',a);g.run(ui.slice(a,b));
 g.run("document.body={classList:{contains:()=>false}};globalThis.state=project();globalThis.actor=state.units[0];globalThis.testContainer={replaceChildren(){this.children=[]},append(b){this.children.push(b)},setAttribute(){}};view.actorId='long-range-battery';view.target={x:8,y:1};renderWeaponControls(state,actor,testContainer)");
 assert.equal(g.run('state.markers.supported'),true);assert.ok(g.run('testContainer.children.length')>=3);g.run("testContainer.children.find(b=>b.dataset.weapon==='indirect/recon-tank').onclick({stopPropagation(){}})");
 g.run("globalThis.area=areaData(state,actor,'fire');globalThis.chip=selectedFirePreview(state,actor,units[0],'fire',previewWeaponKey(actor),area.legal)");assert.equal(g.run('chip.weaponKey'),'indirect/recon-tank');assert.equal(g.run('chip.ratioCategory'),'2-1');
 const c=ui.indexOf("        commands = state.turnPhase === 'fire'"),d=ui.indexOf("          : target?.team === 'enemy'",c);g.run("let commands;const runtimeActor=units[0];"+ui.slice(c,d)+':[];');assert.equal(g.run('commands[0].command.type'),'FireArtillery');assert.equal(g.run('commands[0].command.spotterId'),'recon-tank');g.context.rollQueue=[0];assert.equal(g.run('dispatch(commands[0].command,revision()).ok'),true);assert.equal(g.events().at(-1).event.weapon.spotterId,'recon-tank');assert.equal(g.rolls(),1);
 const classic=scene();queryBridge(classic);phase(classic);classic.context.rollQueue=[0];classic.run("selected=units[0];GoblinArtilleryWeapons.selectWeapon(selected,'indirect/recon-tank');handleHex(8,1)");assert.equal(classic.rolls(),1);assert.equal(classic.run('lineOfSight(units[0],units[3])'),false);assert.equal(classic.events().at(-1).event.weapon.mode,'indirect');
});

test('actual loader keeps previous missions, all old replay envelopes reject the new profile, and restart cancels stale session effects',async()=>{
 const g=scene();queryBridge(g);g.context.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'))});g.run("delete scenarioCatalog['artillery-pilot']");g.run(fs.readFileSync(new URL('../atlas-level.js',import.meta.url),'utf8'));await new Promise(r=>setImmediate(r));assert.equal(g.run('Object.keys(scenarioCatalog).length'),12);
 g.run("loadScenario('artillery-pilot')");const id=g.run('legacySession.sessionId');phase(g);g.context.rollQueue=[0];fire(g,'long-range-battery','rocket-artillery');assert.ok(g.events().length);g.run("loadScenario('artillery-pilot')");assert.ok(g.run('legacySession.sessionId')>id);assert.equal(g.run('units[0].artilleryFire.fired'),false);assert.equal(g.events().length,0);
 g.run("loadScenario('skimmer-pilot')");assert.equal(g.run('movementBudget(units[0],true)'),3);g.run("loadScenario('siege-pilot')");assert.equal(g.run('units[0].siegeFireBudget.used.length'),0);
 const {recordProfileReplay,validateProfileReplay}=await import('../src/core/replay-contract.mjs');const {recordSiegeTankProbeReplay,validateSiegeTankProbeReplay}=await import('../src/core/siege-tank-probe-replay.mjs');const {recordArtillerySpotterProbeReplay,validateArtillerySpotterProbeReplay}=await import('../src/core/artillery-spotter-probe-replay.mjs');const {recordIronDustProfileReplay,validateIronDustProfileReplay}=await import('../src/core/iron-dust-profile-replay.mjs');const {phaseScenario}=await import('../src/core/game-core.mjs');const {CORE_PROFILE_CONTRACT}=await import('../src/core/profile-contract.mjs');
 for(const [old,validate] of [[recordProfileReplay({...structuredClone(phaseScenario),...structuredClone(CORE_PROFILE_CONTRACT)},7,[]),validateProfileReplay],[recordSiegeTankProbeReplay(7,[]),validateSiegeTankProbeReplay],[recordArtillerySpotterProbeReplay(7,[]),validateArtillerySpotterProbeReplay],[recordIronDustProfileReplay(7,[]),validateIronDustProfileReplay]]){const changed=structuredClone(old);changed.header.ruleProfileId='CATALOG_ARTILLERY_PILOT_v1';changed.header.scenarioId='artillery-pilot';assert.throws(()=>validate(changed),/MISMATCH/);}
});

test('legacy 5:1 automatic X consumes one real cached rollslot; Undo reuses it, and cover changes the ratio',()=>{
 const g=scene();queryBridge(g);phase(g);
 // Explicit isolated boundary setup, not a normal fixed-level victory/playability claim.
 g.run("units.find(u=>u.id==='rocket-artillery').defense=1");const c=command(g,'long-range-battery','rocket-artillery');
 assert.equal(g.run(`query(${JSON.stringify(c)}).weapon.rolls`),1);
 assert.equal(execute(g,c).ok,true);assert.equal(g.rolls(),1);assert.equal(g.run('phaseRollCursor'),1);assert.equal(g.run('phaseRolls.length'),1);assert.equal(g.run('units[0].artilleryFire.fired'),true);
 const after=g.rng(),event=g.events().at(-1).event;assert.equal(event.sourceResults[0].ratio,'5-1');assert.equal(event.sourceResults[0].result,'X');assert.equal(event.sourceResults[0].roll,0);
 g.run('undoPhaseCommand()');assert.equal(g.run('units[0].artilleryFire.fired'),false);assert.equal(g.run('phaseRollCursor'),0);assert.equal(execute(g,c).ok,true);assert.deepEqual(g.rng(),after);assert.equal(g.run('phaseRollCursor'),1);assert.equal(g.events().at(-1).event.sourceResults[0].roll,event.sourceResults[0].roll);
 const covered=scene();queryBridge(covered);phase(covered);covered.run("units.find(u=>u.id==='rocket-artillery').defense=1;terrainTypes.set('4,3','forest')");const cc=command(covered,'long-range-battery','rocket-artillery');assert.equal(covered.run(`previewFire(${JSON.stringify(cc)}).ratioCategory`),'3-1');assert.equal(execute(covered,cc).ok,true);assert.equal(covered.rolls(),1);assert.equal(covered.events().at(-1).event.sourceResults[0].ratio,'3-1');assert.equal(covered.events().at(-1).event.sourceResults[0].result,'D');
 console.log('Effective Legacy5:1: X with one real rollslot (roll0 here); BACK/reissue reuses same slot, no additional fresh RNG. D1+cover gives3:1. Isolated boundary setup only.');
});
