// Internal seeded product traces. All actions execute the shipped UI query/dispatch and enemy callback.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {catalogScene,read,execute} from './catalog-product-harness.mjs';
export const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const paths=['catalog-base-model.js','catalog-base-runtime.js','catalog-base-loader.js','assets/unit-art/rules/unit-profiles.catalog-approved.v1.json','game.js','scenario.js','scenario-profile-manifest.js','terrain-rules.js','legacy-supercover.js','ui-v2.js','legacy-presentation.js','presentation-state.js','command-history.js','ogre-runtime.js','siegebreaker-weapons.js','strategic-missile.js','siege-pilot-runtime.js','artillery-pilot-runtime.js','tests/artillery-product-harness.mjs','tests/catalog-product-harness.mjs','tests/catalog-product-trace.mjs','m1-unit-markers.js'];
export const sources=()=>Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex')]));
const snapshot=g=>read(g,'({units,terrain:[...terrain],terrainTypes:[...terrainTypes],turn,phase,turnPhase,gameOver,selectedId:selected?.id??null,focusedCell,phaseRolls,phaseRollCursor,history:phaseCommands.map(({log,...s})=>s)})');
const facts=g=>({state:snapshot(g),markers:read(g,"M1UnitMarkers.legacy(legacySession,units,'trace',gameOver?victoryOutcome(victoryProfile(legacySession.effectiveRules),units):null)"),rng:g.rng(),presentation:read(g,'GoblinPresentation.read()'),events:g.events().map(({event,...e})=>{const {before,after,...rest}=event;return {...e,event:{...rest,beforeDigest:digest(before),afterDigest:digest(after)}}})});
export async function apply(g,step){
 if(step.kind==='Command'||step.kind==='Query'){
  const before=facts(g),c=JSON.stringify(step.command),query=read(g,`query(${c})`),result=step.kind==='Query'?query:read(g,`dispatch(${c},revision())`);
  if(step.kind==='Query'||!query.ok)assert.deepEqual(facts(g),before,'query/reject mutation');return {query,result};
 }
 if(step.kind==='Undo'){g.run('undoPhaseCommand()');return {ok:true}}
 if(step.kind==='Advance'){g.run("$('#end-turn').onclick()");await new Promise(r=>setImmediate(r));return {ok:true}}
 if(step.kind==='Enemy'){
  assert.equal(g.run('phase'),'enemy');const job=[...g.timers.entries()].find(([,f])=>String(f).includes('const foes='));assert.ok(job);g.timers.delete(job[0]);job[1]();return {ok:true};
 }
 if(step.kind==='Restart'){g.run('loadScenario(currentScenario)');return {ok:true}}
 throw new Error('INVALID_PRODUCT_TRACE_STEP');
}
export async function record(id,seed,commands){
 assert.ok(['catalog-transport','catalog-maneuver'].includes(id));assert.ok(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff);
 const g=await catalogScene(id,seed),header={scenarioId:id,scenarioVersion:1,ruleProfileId:'CATALOG_BASE_TRANSPORT_v1',session:read(g,'legacySession'),sources:sources(),rng:'xorshift32-test-v1',seed};
 const initial=facts(g),steps=[];
 for(const command of commands){const result=await apply(g,command);steps.push({command,result,...facts(g)})}
 const trace={version:'catalog-base-product-trace-v1',publicSaveFormat:false,header,initial,commands,steps};return {...trace,traceDigest:digest(trace)};
}
export async function replay(trace){
 assert.equal(trace?.version,'catalog-base-product-trace-v1');assert.equal(trace.publicSaveFormat,false);assert.equal(trace.header.ruleProfileId,'CATALOG_BASE_TRANSPORT_v1');assert.deepEqual(trace.header.sources,sources());
 const {traceDigest,...body}=trace;assert.equal(digest(body),traceDigest);assert.equal(trace.commands.length,trace.steps.length);
 for(const [i,s] of trace.steps.entries())assert.deepEqual(s.command,trace.commands[i]);
 const actual=await record(trace.header.scenarioId,trace.header.seed,trace.commands);assert.equal(digest(actual),digest(trace),'complete product state/event/header/RNG oracle differs');return actual;
}
// Route discovery is test tooling only. It neither replaces product AI nor injects state or random results.
export async function discover(id,seed,win=true){
 const g=await catalogScene(id,seed),commands=[];
 const step=async s=>{commands.push(s);return apply(g,s)};
 const command=async c=>step({kind:'Command',command:c});
 if(win&&id==='catalog-transport'){
  await command({type:'Unload',actorId:'carrier-drone',cargoId:'drone',x:2,y:2});
  await step({kind:'Undo'});await command({type:'Unload',actorId:'carrier-drone',cargoId:'drone',x:2,y:2});
  await command({type:'Embark',actorId:'squad',carrierId:'carrier-infantry',x:1,y:5});
 }
 for(let round=0;round<36&&!g.run('gameOver');round++){
  if(win)for(const u of read(g,"units.filter(u=>u.team==='player'&&u.hp>0&&!u.embarkedOn)")){
   const candidate=read(g,`(()=>{const u=units.find(u=>u.id===${JSON.stringify(u.id)}),core=units.find(u=>u.core),options=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c={type:'Move',actorId:u.id,x,y};if(!query(c).ok)continue;const p={x,y},danger=units.filter(e=>e.team==='enemy'&&e.hp>0&&e.damage>0).reduce((n,e)=>n+(dist(p,e)<=e.range?1:0),0);options.push({c,score:dist(p,core)+danger*0.2})}options.sort((a,b)=>a.score-b.score||a.c.y-b.c.y||a.c.x-b.c.x);return options[0]?.score<dist(u,core)?options[0].c:null})()`);
   if(candidate)await command(candidate);
  }
  await step({kind:'Advance'});
  if(win)for(const u of read(g,"units.filter(u=>u.team==='player'&&u.hp>0)")){
   const shot=read(g,`(()=>{const u=units.find(u=>u.id===${JSON.stringify(u.id)}),targets=units.filter(t=>t.team==='enemy'&&t.hp>0).sort((a,b)=>(b.core?1:0)-(a.core?1:0)||a.defense-b.defense);return targets.map(t=>({type:'Fire',actorId:u.id,x:t.x,y:t.y})).find(c=>query(c).ok)??null})()`);
   if(shot){await command(shot);if(g.run('gameOver'))break}
  }
  if(g.run('gameOver'))break;
  await step({kind:'Advance'});await step({kind:'Advance'});await step({kind:'Enemy'});
 }
 return {id,seed,commands,turn:g.run('turn'),gameOver:g.run('gameOver'),win:g.run("units.find(u=>u.core).hp===0&&units.some(u=>u.team==='player'&&u.hp>0)")};
}
