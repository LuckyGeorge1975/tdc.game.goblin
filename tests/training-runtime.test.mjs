import {targetOptionsSource} from './helpers/target-options-source.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createHash}from 'node:crypto';
import{trainingScene,route,apply,snapshot,inspect,advanceEnemy}from './training-product-harness.mjs';
import{read,execute}from './artillery-product-harness.mjs';
const progress=g=>read(g,'GoblinTrainingRuntime.view().progress');
async function beforeShot(){const g=await trainingScene('training-t02');for(const a of route('training-t02').slice(0,5))apply(g,a);assert.equal(progress(g).stepId,'shot');return g}
for(const [result,roll]of [['NE',0],['D',2],['X',5]])test('controlled actual CRT '+result+' remains a valid lesson shot; no required hit',async()=>{
 const g=await beforeShot();
 // Explicit boundary-only control: real CRT/damage resolver receives this die.
 // These controlled branches are separate from the fixed-seed normal traces.
 g.run(`const actualApply=applyCombatRoll;applyCombatRoll=(actor,target,roll)=>actualApply(actor,target,actor.team==='player'?${roll}:roll)`);
 apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}});
 assert.equal(progress(g).stepId,'result');assert.equal(read(g,"units.find(u=>u.team==='enemy').lastOutcome"),result);
 const receipt=read(g,'GoblinTrainingRuntime.audit().at(-1).receipt');assert.equal(receipt.command.type,'Fire');assert.equal(receipt.events[0].outcome,result);assert.equal(receipt.events.length,1);
 assert.equal(g.run('GoblinTrainingRuntime.shotEffect()'),{NE:'noEffect',D:'disabled',X:'destroyed'}[result]);
 if(result==='D')assert.equal(g.run("units.find(u=>u.team==='enemy').hp"),3);
 apply(g,{ui:'ack',action:'continue'});advanceEnemy(g);assert.equal(progress(g).status,'ready-for-debrief');assert.equal(read(g,'gameOver'),false);
});
function mountTrainingPanel(g){
 const flow=fs.readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
 const panel=flow.slice(flow.indexOf('    const targetTrainingCopy'),flow.indexOf('    const requestedScenario'));
 g.run(`
  let busy=false,refreshes=0,screen='play';
  const campaign=null,confirmRestart=()=>{},goToLevels=()=>{};
  const GoblinLanguage={t:key=>key,translate:key=>key};
  const GoblinUIV2={project:()=>({scenario:currentScenario,phase,turnPhase,units}),refresh:()=>refreshes++};
  globalThis.GoblinMovement={busy:()=>busy};
  const trainingPanel={nodes:[],replaceChildren(){this.nodes=[]},append(...nodes){this.nodes.push(...nodes)}};
  const paragraph=x=>x,actions=(...nodes)=>Object.assign(nodes,{append(...items){nodes.push(...items)}}),
   button=(key,onclick)=>({key:key.key,onclick});
  {
   const t=(key,params)=>({key,params});
   ${panel}
   globalThis.renderTraining=renderTraining;
  }
 `);
}
test('advisory acknowledgement refreshes the current target without bubbling into the outside-click handler',async()=>{
 const g=await trainingScene('iron-dust',true);
 apply(g,{ui:'ack',action:'continue'});
 const move=read(g,"(()=>{for(let x=0;x<W;x++)for(let y=0;y<H;y++){const c={type:'Move',actorId:'gev',x,y};if(query(c).ok)return c}})()");
 assert.equal(execute(g,move).ok,true);
 assert.equal(progress(g).stepId,'hint');
 g.run("setTurnPhase('fire')");
 mountTrainingPanel(g);
 const before=JSON.parse(g.state());
 g.run("let stopped=false;renderTraining();trainingPanel.nodes.at(-1).find(b=>b.key==='ui.dialog.confirm').onclick({stopPropagation(){stopped=true}})");
 assert.equal(g.run('stopped'),true);
 assert.equal(g.run('refreshes'),1);
 assert.deepEqual(JSON.parse(g.state()),before);
 assert.equal(progress(g).stepId,'exit');
});
test('T02 shows phase guidance before the enemy turn and delays the debrief until movement settles',async()=>{
 const g=await beforeShot();
 mountTrainingPanel(g);
 apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}});
 g.run('renderTraining()');
 assert.match(g.run('trainingPanel.nodes[1].params.effect.key'),/^v2\.training\.effect\./);
 apply(g,{ui:'ack',action:'continue'});
 g.run('renderTraining()');
 assert.equal(g.run('trainingPanel.nodes[1].key'),'v2.training.finishFire');
 g.run("setTurnPhase('gev');renderTraining()");
 assert.equal(g.run('trainingPanel.nodes[1].key'),'v2.training.startEnemy');
 g.run('busy=true');
 advanceEnemy(g);
 g.run('renderTraining()');
 assert.equal(g.run('trainingPanel.nodes[1].key'),'v2.training.waitForEnemy');
 assert.equal(g.run('trainingPanel.nodes.length'),2);
 g.run('busy=false;renderTraining()');
 assert.equal(g.run('trainingPanel.nodes[1].key'),'training.readyForDebrief');
 assert.equal(g.run('trainingPanel.nodes[2].key'),'training.roundComplete');
 assert.equal(g.run("trainingPanel.nodes.at(-1).some(b=>b.key==='training.debrief.confirm')"),true);
});
test('actual fire BACK reuses cached die while physical RNG stays advanced; new branch and audit remain monotone',async()=>{
 const g=await beforeShot(),before=read(g,'GoblinTrainingRuntime.rng()');apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}});
 const shot=read(g,'GoblinTrainingRuntime.audit().at(-1).receipt'),rng=read(g,'GoblinTrainingRuntime.rng()');g.run('undoPhaseCommand()');
 const restore=read(g,'GoblinTrainingRuntime.audit().at(-1).receipt');assert.equal(restore.kind,'restore');assert.ok(restore.sequence>shot.sequence);assert.notEqual(restore.branchAfter,shot.branchAfter);
 assert.equal(read(g,'GoblinTrainingRuntime.rng().cursor'),before.cursor);assert.equal(read(g,'GoblinTrainingRuntime.rng().draws'),rng.draws);
 apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}});assert.deepEqual(read(g,'GoblinTrainingRuntime.rng()'),rng);assert.equal(read(g,'GoblinTrainingRuntime.audit().at(-1).receipt.events[0].outcome'),shot.events[0].outcome);
});
test('real rejected dispatch and stale revision cannot advance learning or consume RNG',async()=>{
 const g=await trainingScene(),before=snapshot(g),step=progress(g).stepId;
 assert.equal(execute(g,{type:'Move',actorId:'training-t01-tank',x:11,y:7}).ok,false);
 assert.equal(progress(g).stepId,step);assert.deepEqual(snapshot(g).world,before.world);assert.deepEqual(snapshot(g).trainingRng,before.trainingRng);
 const rejected=read(g,'GoblinTrainingRuntime.audit().at(-1).receipt');assert.equal(rejected.accepted,false);assert.deepEqual(rejected.command.acceptedPath,[]);assert.equal(rejected.historyRevisionAfter,rejected.historyRevisionBefore);
 const count=read(g,'GoblinTrainingRuntime.audit().length');assert.equal(g.run("dispatch({type:'Move',actorId:'training-t01-tank',x:3,y:3},'stale')").ok,false);assert.equal(read(g,'GoblinTrainingRuntime.audit().length'),count);
});
test('T01 positive auto hold preserves actual BACK; declined manual leave keeps proof opportunity',async()=>{
 const g=await trainingScene();for(const a of route('training-t01').slice(0,5))apply(g,a);assert.equal(progress(g).stepId,'undo');
 const before=snapshot(g);g.run("document.querySelector('#auto-end-turn').checked=true;maybeAutoAdvancePhase()");
 for(const fn of [...g.timers.values()])if(String(fn).includes('originalAutoAdvance'))fn();
 assert.equal(read(g,'turnPhase'),'movement');assert.equal(read(g,'phaseCommands.length'),1);assert.deepEqual(snapshot(g).world,before.world);
 g.run('GameDialogs.confirm=async()=>false');await g.run("confirmPhaseAdvance(()=>setTurnPhase('fire'))");assert.equal(progress(g).stepId,'undo');assert.equal(read(g,'phaseCommands.length'),1);
 g.run('GameDialogs.confirm=async()=>true');await g.run("confirmPhaseAdvance(()=>setTurnPhase('fire'))");assert.equal(progress(g).status,'lesson-failed');
});
test('lost still-required actor fails, while a demonstrated actor may die with a friendly survivor',async()=>{
 for(const shotDone of [false,true]){const g=await trainingScene('training-t02');for(const a of route('training-t02').slice(0,3))apply(g,a);
  g.run('const actualApply=applyCombatRoll;applyCombatRoll=(actor,target,roll)=>actualApply(actor,target,actor.team===\'enemy\'?5:0)');
  if(shotDone){apply(g,{phase:'fire'});inspect(g,{type:'Fire',actorId:'training-t02-tank',x:5,y:3});apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}});apply(g,{ui:'ack',action:'continue'})}
  advanceEnemy(g);assert.equal(read(g,'units[0].hp'),0);assert.equal(read(g,'units[1].hp'),2);assert.equal(progress(g).status,shotDone?'ready-for-debrief':'lesson-failed');
 }
});
test('enemy callbacks are complete and idempotent; reset discards an earlier callback',async()=>{
 const g=await trainingScene('training-t02');const callback=advanceEnemy(g),before=snapshot(g);callback();assert.deepEqual(snapshot(g),before);
 g.run("startEnemyTurn()");const old=[...g.timers.values()].find(fn=>String(fn).includes('const foes='));g.run("loadScenario('training-t01')");const reset=snapshot(g);old();assert.deepEqual(snapshot(g),reset);
});
test('advisory on/off and after training exit preserve actual four-round World and RNG',async()=>{
 async function play(enabled,exited){const g=await trainingScene('training-t01',true);if(exited)apply(g,{ui:'ack',action:'exit'});g.run(`GoblinTrainingRuntime.setAdvisory(${enabled});loadScenario('iron-dust')`);if(enabled)apply(g,{ui:'ack',action:'continue'});const worlds=[];
  for(let n=0;n<4;n++){const command=read(g,"(()=>{for(let y=0;y<H;y++)for(let x=W-1;x>=0;x--){const c={type:'Move',actorId:'gev',x,y};if(query(c).ok)return c}return null})()");if(n===0)assert.ok(command);if(command)execute(g,command);
   if(enabled&&n===0){assert.equal(progress(g).stepId,'hint');apply(g,{ui:'ack',action:'continue'})}apply(g,{phase:'fire'});
   const fire=read(g,"(()=>{for(const u of units.filter(u=>u.team==='player'))for(const t of units.filter(u=>u.team==='enemy')){const c={type:'Fire',actorId:u.id,x:t.x,y:t.y};if(query(c).ok)return c}return null})()");if(fire)execute(g,fire);advanceEnemy(g);worlds.push(JSON.parse(g.state()))}
  return {worlds,rng:g.rng()};
 }
 const off=await play(false,false),on=await play(true,false),exited=await play(false,true);assert.deepEqual(on,off);assert.deepEqual(exited,off);assert.ok(on.rng.draws>0);
});
test('copy has exactly the supplied 47 keys in four languages; source admission rejects foreign configs',async()=>{
 const source=JSON.parse(fs.readFileSync(new URL('./fixtures/training-copy.v1.json',import.meta.url)));
 for(const lang of ['de','en','es','fr']){const actual=JSON.parse(fs.readFileSync(new URL('../assets/ui-copy/briefing-01.'+lang+'.json',import.meta.url))).messages;const keys=Object.keys(actual).filter(k=>k.startsWith('training.')).sort((a,b)=>a.localeCompare(b));assert.equal(keys.length,47);assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(keys.map(k=>[k,actual[k]])))).digest('hex'),source.locales[lang].sha256);for(const key of keys)assert.deepEqual([...actual[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),source.locales.en.placeholders[key])}
 const g=await trainingScene();const before=snapshot(g);assert.throws(()=>g.run("ScenarioRuleProfiles.beginSession('iron-dust',GoblinTrainingModel.configs['training-t01'])"));assert.deepEqual(snapshot(g),before);
 g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));assert.equal(read(g,"M1UnitMarkers.legacy(legacySession,units,'test',null).supported"),true);assert.deepEqual(read(g,"M1UnitMarkers.legacy(legacySession,units,'test',null).objective.members"),[]);
});
test('actual V2 chooseActor/chooseHex/clearContext handlers prove the T01 preview/cancel sequence',async()=>{
 const g=await trainingScene(),source=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
 const clear=source.slice(source.indexOf('    function clearContext()'),source.indexOf('    const hexLabel'));
 const select=source.slice(source.indexOf('    function chooseActor('),source.indexOf('    function focusUnit('));
 const hex=source.slice(source.indexOf('    function chooseHex('),source.indexOf('    const areaCache'));
 g.context.matchMedia=()=>({matches:false});g.run("const at=s=>document.querySelector(s);document.querySelector('#v2-actions button:not(:disabled)').focus=()=>{};document.querySelector('#v2-action-execute').focus=()=>{};");
 const inspect=source.slice(source.indexOf('    function inspectTrainingTarget('),source.indexOf('    function hitChance('));
 g.run("const GoblinLanguage={current:'de'};const project=()=>({units,phase,turnPhase,gameOver,revision:revision()});const focusTargetCard=()=>{};"+targetOptionsSource+inspect+clear+select+hex);
 g.run("GoblinTrainingRuntime.ack();chooseActor('training-t01-tank');chooseHex(3,3)");assert.equal(progress(g).stepId,'cancel');
 const before=snapshot(g).world;g.run('clearContext()');assert.equal(progress(g).stepId,'first-move');assert.deepEqual(snapshot(g).world,before);
});
test('all friendly losses take priority over a previously ready learning debrief',async()=>{
 const g=await beforeShot();g.run("const actualApply=applyCombatRoll;applyCombatRoll=(actor,target,roll)=>actualApply(actor,target,actor.team==='enemy'?5:0)");
 apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}});apply(g,{ui:'ack',action:'continue'});advanceEnemy(g);assert.equal(progress(g).status,'ready-for-debrief');
 for(let n=0;n<15&&!read(g,'gameOver');n++)advanceEnemy(g);
 assert.equal(read(g,"units.some(u=>u.team==='player'&&unitAlive(u))"),false);assert.equal(progress(g).status,'lesson-failed');assert.equal(read(g,'gameOver'),true);
});
test('synchronous resolver exception restores ambient Math.random',async()=>{
 const g=await beforeShot();g.run('globalThis.savedRandom=Math.random;applyCombatRoll=()=>{throw Error("controlled resolver failure")}');
 assert.throws(()=>apply(g,{command:{type:'Fire',actorId:'training-t02-tank',x:5,y:3}}),/controlled resolver failure/);assert.equal(g.run('Math.random===savedRandom'),true);
});
test('training source/manifest mutations reject before World/RNG; Classic gets no incomplete learning entry',async()=>{
 const g=await trainingScene(),before=snapshot(g);
 for(const change of ["c.units[0].damage++","c.training.seed++","c.training.definition.steps[0].messageKey='foreign'","c.losMode='strict-supercover'","c.scenarioVersion++"]){g.run("globalThis.c=JSON.parse(JSON.stringify(GoblinTrainingModel.configs['training-t01']))");g.run(change);assert.throws(()=>g.run("ScenarioRuleProfiles.beginSession('training-t01',c)"));assert.deepEqual(snapshot(g),before)}
 g.run('globalThis.badLevels=JSON.parse(JSON.stringify(trainingLevels));badLevels.levels[0].seed++');await assert.rejects(g.run('GoblinTrainingModel.initialize(badLevels,trainingScripts)'),/TRAINING_SOURCE_DIGEST/);assert.deepEqual(snapshot(g),before);
 g.run("globalThis.validConfig=scenarioCatalog['training-t01'];scenarioCatalog['training-t01']={...validConfig,scenarioVersion:99}");assert.throws(()=>g.run("loadScenario('training-t01')"));g.run("scenarioCatalog['training-t01']=validConfig");assert.deepEqual(snapshot(g),before);g.run("loadScenario('foreign-scenario')");assert.deepEqual(snapshot(g),before);
 g.context.location={search:'?ui=classic'};g.context.fetch=()=>{throw Error('Classic must not fetch training sources')};await g.run(fs.readFileSync(new URL('../training-loader.js',import.meta.url),'utf8'));assert.deepEqual(snapshot(g),before);
});
test('actual end-screen branch keeps normal advisory battle results separate from learning completion',async()=>{
 const source=fs.readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8'),start=source.indexOf('        const training=globalThis.GoblinTrainingRuntime?.view();'),end=source.indexOf("      } else if (screen === 'log')",start),body=source.slice(start,end);
 for(const lesson of [null,'training-t01','training-t02']){
  const g=await trainingScene(lesson??'training-t01',true);if(lesson)for(const action of route(lesson))apply(g,action);else g.run("loadScenario('iron-dust')");
  g.run(`{globalThis.headings=[];globalThis.buttons=[];const campaign=null,editorConfig=null,state={objective:{outcome:true},scenario:currentScenario,turn:1};const panel={append(){}},heading=x=>headings.push(x),paragraph=x=>x,actions=(...x)=>x,button=(key)=>buttons.push(key),confirmRestart=()=>{},goToLevels=()=>{};${body}}`);
  assert.equal(read(g,'headings[0]'),lesson?'training.complete.title':'screen.missionEnd.victory.title');
  assert.equal(read(g,"buttons.includes('training.nextLesson')"),!!lesson);
 }
});

test('tutorial campaign advances only from its confirmed lessons and isolates restart and exit',async()=>{
 const flow=fs.readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
 const g=await trainingScene();
 g.run(`
  const campaignLessons=['training-t01','training-t02'];
  let campaign=null,editorConfig=null,screen='menu',missionId='relay-run',startError='',started=false;
  const show=next=>{screen=next},missionData=id=>scenarioCatalog[id];
  const GoblinUIV2={resetView(){},startView(){}},renderScreen=()=>{},releasePause=()=>{};
  ${flow.slice(flow.indexOf('    function campaignAvailable('),flow.indexOf('    function libraryAssetId('))}
 `);
 g.run('openCampaign()');
 assert.deepEqual(read(g,'[screen,missionId,campaign.index]'),['briefing','training-t01',0]);
 await g.run('startMission()');
 const first=progress(g).binding.sessionId;
 assert.equal(read(g,'campaign.sessionId'),first);
 g.run("show('end');advanceCampaign()");
 assert.deepEqual(read(g,'[screen,campaign.index]'),['end',0]);
 g.run('GameDialogs.confirm=async()=>true');
 await g.run('confirmRestart()');
 const retry=progress(g).binding.sessionId;
 assert.notEqual(retry,first);
 assert.equal(read(g,'campaign.sessionId'),retry);
 for(const action of route('training-t01').slice(0,-1))apply(g,action);
 assert.equal(progress(g).status,'ready-for-debrief');
 g.run("show('end');advanceCampaign()");
 assert.equal(read(g,'campaign.index'),0);
 apply(g,route('training-t01').at(-1));
 g.run('advanceCampaign()');
 assert.deepEqual(read(g,'[screen,missionId,campaign.index,campaign.sessionId]'),['briefing','training-t02',1,null]);
 await g.run('startMission()');
 assert.notEqual(progress(g).binding.sessionId,retry);
 g.run('GameDialogs.confirm=async()=>false');
 await g.run("leaveMission('levels')");
 assert.deepEqual(read(g,'[screen,campaign.index]'),['play',1]);
 for(const action of route('training-t02'))apply(g,action);
 g.run("show('end');advanceCampaign()");
 assert.equal(read(g,'screen'),'campaign-complete');
 g.run('returnToCampaignMenu()');
 assert.deepEqual(read(g,'[screen,missionId,campaign,started]'),['menu','relay-run',null,false]);
 g.run('openCampaign()');
 await g.run('startMission()');
 g.run('GameDialogs.confirm=async()=>true');
 await g.run("leaveMission('levels')");
 assert.deepEqual(read(g,'[screen,missionId,campaign,started]'),['levels','relay-run',null,false]);
});
