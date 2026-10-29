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
const level=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/levels/siege-pilot.v1.json',import.meta.url),'utf8'));
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
  const math=Object.create(Math);math.random=()=>{rolls++;return context.rollQueue?.shift()??.91;};
  const context=vm.createContext({document,Math:math,structuredClone,console,URLSearchParams,window:{},
    localStorage:{getItem(){return null;}},GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},
    setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},
    scheduleGameTask(fn){timers.set(++id,fn);return id;}});
  const run=s=>vm.runInContext(s,context);
  const files=['unit-visuals.js','terrain-rules.js','ogre-systems.js','legacy-supercover.js','artillery-spotter-rules.js','assets/unit-art/rules/artillery-pilot.v1.js','siege-tank-fire-budget.js','assets/unit-art/rules/siege-pilot.v1.js','skimmer-budget.js','assets/unit-art/rules/skimmer-pilot.v1.js','scenario-profile-manifest.js',
    ...(enabled?['presentation-preferences.js','presentation-state.js']:[]),'game.js','ogre-runtime.js','combat-feedback.js',
    'siegebreaker-weapons.js','strategic-missile.js','siege-pilot-runtime.js','artillery-pilot-runtime.js','scenario.js',
    ...(enabled?['legacy-presentation.js']:[]),'command-history.js'];
  for(const file of files)run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>globalThis.GoblinLegacyPresentation?.sync();updateSelection=()=>{};loadScenario('iron-dust');");
  run(`scenarioCatalog['siege-pilot']=GoblinSiegePilot.create(${JSON.stringify(level)},${JSON.stringify(registry)});loadScenario('siege-pilot');`);
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
function move(g,x,y){const command={type:'Move',actorId:'siege-tank',x,y};assert.equal(g.run(`query(${JSON.stringify(command)}).ok`),true,JSON.stringify(command));assert.equal(g.run(`dispatch(${JSON.stringify(command)},revision()).ok`),true);}
function fire(g,id){g.run(`setTurnPhase('fire')`);const result=g.run(`(()=>{const target=units.find(u=>u.id==='${id}');return dispatch({type:'Fire',actorId:'siege-tank',x:target.x,y:target.y},revision()).ok})()`);assert.equal(result,true);}

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


function prepare(g){queryBridge(g);move(g,3,3);g.run("setTurnPhase('fire')");}
function shot(g,key,id){const cmd=JSON.parse(g.run(`JSON.stringify((()=>{const target=units.find(u=>u.id==='${id}');return {type:'Fire',actorId:'siege-tank',weaponKey:'${key}',x:target.x,y:target.y}})())`));return {cmd,query:()=>g.run(`query(${JSON.stringify(cmd)})`),fire:()=>g.run(`dispatch(${JSON.stringify(cmd)},revision())`)};}

test('fixed Siege loader/session freezes exact stats, digest and all starts are passable; old replay families reject it',async()=>{
 const g=scene();g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));assert.equal(g.run("M1UnitMarkers.legacy(legacySession,units,'test',null).supported"),true);const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
 assert.equal(g.run('legacySession.effectiveRules.sourceDigest'),createHash('sha256').update(JSON.stringify(stable(level))).digest('hex'));
 assert.equal(g.run('Object.isFrozen(legacySession.effectiveRules.units[0].siegeFireBudget)'),true);
 assert.equal(g.run('units.every(u=>u.move===0||Number.isFinite(TerrainRules.movementCost(terrainTypeAt(u.x,u.y),u)))'),true);
 for(const mutation of ["c.scenarioVersion=2","c.ruleProfileId='FULL_CATALOG_v1'","c.units[0].damage=7","c.units[0].siegeFireBudget.used=['main-1']","c.units[2].y=4","c.sourceDigest='fake'","c.fireBudgetVersion='other'"]){const before=g.state();assert.throws(()=>g.run(`{const c=JSON.parse(JSON.stringify(scenarioCatalog['siege-pilot']));${mutation};ScenarioRuleProfiles.beginSession('siege-pilot',c)}`));assert.equal(g.state(),before);}
 for(const [old,validate] of [[recordProfileReplay({...structuredClone(phaseScenario),...structuredClone(CORE_PROFILE_CONTRACT)},7,[]),validateProfileReplay],[recordSiegeTankProbeReplay(7,[]),validateSiegeTankProbeReplay],[recordArtillerySpotterProbeReplay(7,[]),validateArtillerySpotterProbeReplay],[recordIronDustProfileReplay(7,[]),validateIronDustProfileReplay]]){const changed=structuredClone(old);changed.header.ruleProfileId=level.ruleProfileId;changed.header.scenarioId=level.id;assert.throws(()=>validate(changed),/MISMATCH/);}
 g.context.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'))});g.run("delete scenarioCatalog['siege-pilot']");g.run(fs.readFileSync(new URL('../atlas-level.js',import.meta.url),'utf8'));await new Promise(r=>setImmediate(r));assert.equal(g.run("Object.keys(scenarioCatalog).filter(id=>id!=='artillery-pilot').length"),11);
});

test('four single shots, distinct main targets even after NE, one roll per shot and exact preview specs',()=>{
 const g=scene();prepare(g);g.context.rollQueue=[0,0,0,0];
 for(const [key,id,attack,range] of [['main-1','guard-tank',3,3],['main-2','recon-tank',3,3],['ap-1','infantry',1,1],['ap-2','infantry',1,1]]){
  const s=shot(g,key,id);assert.equal(s.query().ok,true,JSON.stringify(s.query()));assert.equal(s.query().weapon.attack,attack);assert.equal(s.query().weapon.range,range);
  const p=g.run(`previewFire(${JSON.stringify(s.cmd)})`);assert.equal(p.ratioCategory,g.run(`combatRatio(${attack},effectiveDefense(units.find(u=>u.id==='${id}')))`));assert.equal(p.weaponKey,key);
  const rolls=g.rolls();assert.equal(s.fire().ok,true);assert.equal(g.rolls(),rolls+1);
  if(key==='main-1'){const same=shot(g,'main-2','guard-tank'),before=g.state();assert.equal(same.query().code,'MAIN_TARGET_ALREADY_FIRED');assert.equal(same.fire().ok,false);assert.equal(g.state(),before);assert.equal(g.rolls(),rolls+1);}
 }
 assert.equal(g.run('units[0].siegeFireBudget.used.length'),4);assert.equal(g.run('phaseCanAct(units[0],"fire")'),false);const rolls=g.rolls();g.run('resetActionState()');assert.equal(g.run('units[0].siegeFireBudget.used.length'),4);assert.equal(g.rolls(),rolls);
});

test('combined consumes two main slots in one roll, AP infantry D reduces SP twice, Undo restores slots/history and cached roll',()=>{
 const g=scene();prepare(g);g.context.rollQueue=[0,.75,.75];const s=shot(g,'main-both','guard-tank');assert.equal(s.query().weapon.attack,6);assert.equal(s.fire().ok,true);assert.equal(g.rolls(),1);assert.equal(g.run('units[0].siegeFireBudget.used.length'),2);
 g.run('undoPhaseCommand()');assert.equal(g.run('units[0].siegeFireBudget.used.length'),0);assert.equal(s.fire().ok,true);assert.equal(g.rolls(),1);
 for(const key of ['ap-1','ap-2']){assert.equal(shot(g,key,'infantry').fire().ok,true);}
 assert.equal(g.run("units.find(u=>u.id==='infantry').hp"),0);assert.equal(g.rolls(),3);
 g.context.rollQueue=[0,0];enemy(g);assert.equal(g.run('turn'),2);assert.equal(g.run('units[0].siegeFireBudget.used.length'),0);assert.equal(g.run('units[0].siegeFireBudget.mainTargets.length'),0);g.run('resetActionState()');assert.equal(g.run('units[0].siegeFireBudget.turn'),2);
});

test('negative query/dispatch gates preserve state, slots, target history, sidecar and RNG',()=>{
 for(const mutation of ["turnPhase='movement'","units[0].disabled=true","units[0].hp=0","units[0].team='enemy'","units[1].team='player'","units[1].hp=0","units[1].x=11","terrainTypes.set('4,3','forest')","units[0].siegeFireBudget.used=['invalid']"]){
  const g=scene();prepare(g);g.run(mutation);const s=shot(g,'main-1','guard-tank'),before=g.state(),rolls=g.rolls(),events=JSON.stringify(g.events());assert.equal(s.query().ok,false,mutation);assert.equal(s.fire().ok,false,mutation);assert.equal(g.state(),before);assert.equal(g.rolls(),rolls);assert.equal(JSON.stringify(g.events()),events);
 }
 const g=scene();prepare(g);for(const [key,id] of [['ap-1','guard-tank'],['ap-2','recon-tank']]){const s=shot(g,key,id),before=g.state();assert.equal(s.fire().ok,false);assert.equal(g.state(),before);}
 g.run("units.find(u=>u.id==='infantry').x=5");assert.equal(shot(g,'ap-1','infantry').fire().ok,false);
});

test('actual fire metadata, measured per-main anchors and AP center fallback agree before automatic selection',()=>{
 const g=scene();prepare(g);attachMovement(g);g.context.rollQueue=[0,0,0];
 for(const [key,id,attack,range,count,fallback] of [['main-1','guard-tank',3,3,1,false],['main-2','recon-tank',3,3,1,false],['ap-1','infantry',1,1,1,true]]){
  assert.equal(shot(g,key,id).fire().ok,true);const event=g.events().at(-1).event;assert.equal(event.weapon.usedWeaponKey,key);assert.equal(event.weapon.attack,attack);assert.equal(event.weapon.range,range);
  const mapping=g.run(`GoblinFirePresentation.mapping(${JSON.stringify(event)})`);assert.equal(mapping.anchors.length,count);assert.equal(mapping.fallback,fallback);g.run('motionQueue.clear()');
 }
});

test('normal fixed-level winning and losing traces use only legal move/fire/phase/enemy commands',()=>{
 const g=scene();prepare(g);g.context.rollQueue=[.91,.91,.75,.75];
 for(const [key,id] of [['main-1','guard-tank'],['main-2','recon-tank'],['ap-1','infantry'],['ap-2','infantry']])assert.equal(shot(g,key,id).fire().ok,true);
 enemy(g);const route=[];
 for(let i=0;i<8&&!g.run('gameOver');i++){
  const target=JSON.parse(g.run(`JSON.stringify((()=>{const a=units[0],core=units.find(u=>u.core),cells=[];for(let y=0;y<8;y++)for(let x=0;x<12;x++){if(units.some(u=>u.hp>0&&u.x===x&&u.y===y))continue;const p=findMovementPath(a,{x,y},a.move);if(p?.length)cells.push({x,y,d:dist({x,y},core),los:lineOfSight({x,y},core)});}return cells.sort((a,b)=>(a.d<=3&&a.los?-100:a.d)-(b.d<=3&&b.los?-100:b.d))[0]})())`));
  if(target){move(g,target.x,target.y);route.push({turn:g.run('turn'),x:target.x,y:target.y});}
  g.run("setTurnPhase('fire')");const s=shot(g,'main-both','core');if(s.query().ok)assert.equal(s.fire().ok,true);if(!g.run('gameOver'))enemy(g);
 }
 assert.equal(g.run('gameOver&&units[0].hp>0&&units.find(u=>u.core).hp===0'),true,JSON.stringify(route));console.log('Victory route after D04 split/AP:',JSON.stringify(route));
 const lost=scene();queryBridge(lost);for(let i=0;i<8&&!lost.run('gameOver');i++)enemy(lost);assert.equal(lost.run('gameOver&&units[0].hp===0'),true);console.log('Defeat: hold B04, skip turns; enemy closes and fires CRT6; round',lost.run('turn'));
});


test('V2 chosen weapon controls, range area and CRT chip use AP/main selection rather than actor A6',()=>{
 const g=scene();prepare(g);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
 g.run('const legacyLogEntries=()=>[];'+ui.slice(ui.indexOf('    let idleCoreLog='),ui.indexOf('    function query(command)')));
 const start=ui.indexOf('    function previewWeaponKey('),end=ui.indexOf('    function freeRatioChipCenter(',start);g.run(ui.slice(start,end));
 g.run("view.target={x:3,y:4};view.previewWeaponKey='ap-2';globalThis.state=project();globalThis.actor=state.units[0];globalThis.area=areaData(state,actor,'fire');globalThis.chip=selectedFirePreview(state,actor,units[0],'fire',previewWeaponKey(actor),area.legal)");
 assert.equal(g.run('chip.weaponKey'),'ap-2');assert.equal(g.run('chip.ratioCategory'),'1-1');assert.equal(g.run('area.legal.length'),1);
 g.run("view.previewWeaponKey='main-both';view.target={x:5,y:3};state=project();actor=state.units[0];area=areaData(state,actor,'fire');chip=selectedFirePreview(state,actor,units[0],'fire',previewWeaponKey(actor),area.legal)");assert.equal(g.run('chip.weaponKey'),'main-both');assert.equal(g.run('chip.ratioCategory'),'2-1');
 // Guide projection carries all four slots and the actual selected weapon.
 assert.equal(g.run('actor.siegeFireBudget.used.length'),0);assert.equal(g.run('actor.siegeWeapon'),'main-1');
 g.run(fs.readFileSync(new URL('../unit-guide-range.js',import.meta.url),'utf8'));
 g.run("GoblinSiegeWeapons.selectWeapon(units[0],'ap-1')");assert.equal(g.run("UnitGuideRange.profile({name:'SIEGE TANK',move:'3',range:'3'},units[0]).range"),1);
 g.run("loadScenario('iron-dust')");assert.equal(g.run('units[0].siegeFireBudget===undefined'),true);assert.equal(g.run("movementBudget(units.find(u=>u.id==='gev'),true)"),2);
});


test('one combined presentation event uses two measured main anchors and just one actual result',()=>{
 const g=scene();prepare(g);attachMovement(g);g.context.rollQueue=[0];assert.equal(shot(g,'main-both','guard-tank').fire().ok,true);
 const event=g.events().at(-1).event;assert.equal(event.weapon.attack,6);assert.equal(event.weapon.usedWeaponKey,'main-both');assert.equal(event.sourceResults.length,1);assert.equal(g.run(`GoblinFirePresentation.mapping(${JSON.stringify(event)}).anchors.length`),2);assert.equal(g.rolls(),1);
});

test('classic rejection explains main-target binding; native map reference range follows selected AP spec',()=>{
 const g=scene();prepare(g);g.context.rollQueue=[0];assert.equal(shot(g,'main-1','guard-tank').fire().ok,true);
 g.context.GoblinLanguage={t:key=>key,translate:text=>text};const before=g.state(),rolls=g.rolls();g.run("selected=units[0];handleHex(5,3)");assert.equal(g.state(),before);assert.equal(g.rolls(),rolls);assert.equal(g.run("$('#map-toast').textContent"),'v2.reject.siege.sameMainTarget');
 g.run("GoblinSiegeWeapons.selectWeapon(units[0],'ap-1')");assert.equal(g.run('attackRange(units[0])'),1);g.run("GoblinSiegeWeapons.selectWeapon(units[0],'main-2')");assert.equal(g.run('attackRange(units[0])'),3);
});

test('real V2 weapon button builds and dispatches the chosen AP command, with five explicit slot choices',()=>{
 const g=scene();prepare(g);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');g.run('const legacyLogEntries=()=>[];'+ui.slice(ui.indexOf('    let idleCoreLog='),ui.indexOf('    function query(command)')));
 g.run(ui.slice(ui.indexOf('    function previewWeaponKey('),ui.indexOf('    function activeAreaMode(')));
 g.run("document.body={classList:{contains:()=>false}};globalThis.state=project();globalThis.actor=state.units[0];globalThis.testContainer={replaceChildren(){this.children=[]},append(b){this.children.push(b)},setAttribute(){}};view.actorId='siege-tank';view.target={x:3,y:4};renderWeaponControls(state,actor,testContainer)");
 assert.equal(g.run('testContainer.children.length'),5);g.run("testContainer.children.find(b=>b.dataset.weapon==='ap-2').onclick({stopPropagation(){}})");assert.equal(g.run('view.previewWeaponKey'),'ap-2');
 const a=ui.indexOf("        commands = state.turnPhase === 'fire'"),b=ui.indexOf("          : target?.team === 'enemy'",a);assert.ok(a>0&&b>a);
 g.run("let commands;const runtimeActor=units[0];"+ui.slice(a,b)+':[];');assert.equal(g.run('commands[0].command.weaponKey'),'ap-2');assert.equal(g.run('dispatch(commands[0].command,revision()).ok'),true);assert.equal(g.events().at(-1).event.weapon.usedWeaponKey,'ap-2');assert.equal(g.rolls(),1);
});
