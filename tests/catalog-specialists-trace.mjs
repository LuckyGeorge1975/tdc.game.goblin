import {compatibleDisplaySources} from './helpers/catalog-display-source-compatibility.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {specialistsScene,read} from './catalog-specialists-harness.mjs';
import {apply,facts,digest,sources as baseSources} from './catalog-product-trace.mjs';
const paths=['unit-life.js','ogre-systems.js','catalog-specialists-fire.js','catalog-specialists-model.js','catalog-specialists-runtime.js','catalog-specialists-ui.js','catalog-specialists-loader.js','tests/catalog-specialists-harness.mjs','tests/catalog-specialists-trace.mjs','tests/helpers/trace-object-table.mjs'];
export const sources=()=>({...baseSources(),...Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex')]))});
function observer(g){
 const events=[];g.context.__traceEvent=event=>{const {before,after,...rest}=JSON.parse(JSON.stringify(event));events.push({event:{...rest,beforeDigest:digest(before),afterDigest:digest(after)},status:'settled'})};
 g.run("GoblinPresentation.subscribe((type,value)=>{if(type==='confirm')for(const event of value.events)__traceEvent(event)})");
 return ()=>({state:read(g,'({units,terrain:[...terrain],terrainTypes:[...terrainTypes],turn,phase,turnPhase,gameOver,selectedId:selected?.id??null,focusedCell,phaseRolls,phaseRollCursor,history:phaseCommands.map(({log,...s})=>s)})'),markers:read(g,"M1UnitMarkers.legacy(legacySession,units,'trace',gameOver?victoryOutcome(victoryProfile(legacySession.effectiveRules),units):null)"),rng:g.rng(),presentation:read(g,'GoblinPresentation.read()'),events:structuredClone(events)});
}
// Streaming JSON digest keeps the exact JSON byte contract without retaining a hundreds-of-MB string.
export function streamDigest(value){const hash=createHash('sha256');let chunks=[],length=0;const write=s=>{chunks.push(s);length+=s.length;if(length>65536){hash.update(chunks.join(''));chunks=[];length=0}};function visit(v){if(v===null||typeof v!=='object'){write(JSON.stringify(v));return}if(Array.isArray(v)){write('[');v.forEach((x,i)=>{if(i)write(',');visit(x)});write(']')}else{write('{');Object.entries(v).forEach(([k,x],i)=>{if(i)write(',');write(JSON.stringify(k));write(':');visit(x)});write('}')}}visit(value);if(length)hash.update(chunks.join(''));return hash.digest('hex')}
export async function record(id,seed,commands,expected=null){
 assert.ok(['catalog-siege','catalog-specialists'].includes(id));assert.ok(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff);
 const g=await specialistsScene(id,seed);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
 const observe=observer(g);const header={scenarioId:id,ruleProfileId:'CATALOG_SPECIALISTS_v1',session:read(g,'legacySession'),sources:sources(),rng:'xorshift32-test-v1',seed},initial=observe(),steps=[];
 if(expected){assert.deepEqual({...header,sources:compatibleDisplaySources(header.sources,expected.header.sources,expected.traceDigest)},expected.header);assert.deepEqual(initial,expected.initial)}
 for(const [i,command]of commands.entries()){const result=await apply(g,command,observe),step={command,result,...observe()};if(expected)assert.deepEqual(step,expected.steps[i],'full product step '+i+' differs');else steps.push(step)}
 if(expected)return expected;
 const value={version:'catalog-specialists-product-trace-v1',publicSaveFormat:false,header,initial,commands,steps};return {...value,traceDigest:digest(value)};
}
export async function replay(trace){
 assert.equal(trace?.version,'catalog-specialists-product-trace-v1');assert.equal(trace.publicSaveFormat,false);assert.equal(trace.header.ruleProfileId,'CATALOG_SPECIALISTS_v1');compatibleDisplaySources(sources(),trace.header.sources,trace.traceDigest);
 const {traceDigest,...body}=trace;assert.equal(streamDigest(body),traceDigest);assert.equal(trace.commands.length,trace.steps.length);for(const [i,s]of trace.steps.entries())assert.deepEqual(s.command,trace.commands[i]);
 return record(trace.header.scenarioId,trace.header.seed,trace.commands,trace);
}
// Test-only planner. Uses public queries, real commands and the scheduled enemy callback. No state or RNG injection.
export async function discover(id,seed,win=true){
 const g=await specialistsScene(id,seed),commands=[];g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));const observe=observer(g);const step=async s=>{commands.push(s);return apply(g,s,observe)},command=async c=>{const r=await step({kind:'Command',command:c});assert.equal(r.query.ok,true,JSON.stringify(r));assert.equal(r.result.ok,true);return r};
 if(win&&id==='catalog-specialists'){
  await command({type:'Move',actorId:'engineers',x:3,y:4});
  await command({type:'CatalogDeploy',actorId:'forge',cargoId:'bay-drone-one',bayId:'bay-1',x:2,y:3});
  await step({kind:'Undo'});await command({type:'CatalogDeploy',actorId:'forge',cargoId:'bay-drone-one',bayId:'bay-1',x:2,y:3});
 }
 for(let round=0;round<90&&!g.run('gameOver');round++){
  for(const u of read(g,"units.filter(u=>u.team==='player'&&unitAlive(u)&&!u.embarkedOn)")){
   const candidate=read(g,`(()=>{const u=units.find(u=>u.id===${JSON.stringify(u.id)}),core=units.find(u=>u.core),options=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c={type:'Move',actorId:u.id,x,y};if(!query(c).ok)continue;options.push({c,score:dist({x,y},core)})}options.sort((a,b)=>a.score-b.score||a.c.y-b.c.y||a.c.x-b.c.x);return options[0]?.score<dist(u,core)?options[0].c:null})()`);
   if(candidate)await command(candidate);
  }
  await step({kind:'Advance'});
  if(win)for(const u of read(g,"units.filter(u=>u.team==='player'&&unitAlive(u))")){
   for(const w of read(g,`GoblinSpecialistsRuntime.weapons(units.find(u=>u.id===${JSON.stringify(u.id)}))`)){
    if(!w.ready||g.run('gameOver'))continue;
    const shot=read(g,`GoblinSpecialistsRuntime.candidateCommands(units.find(u=>u.id===${JSON.stringify(u.id)}),${JSON.stringify(w.id)}).sort((a,b)=>Number(units.find(u=>u.id===b.target.runtimeUnitId).core??false)-Number(units.find(u=>u.id===a.target.runtimeUnitId).core??false)).find(c=>query(c).ok)??null`);
    if(shot)await command(shot);
   }
  }
  if(g.run('gameOver'))break;
  await step({kind:'Advance'});await step({kind:'Advance'});await step({kind:'Enemy'});
 }
 return {id,seed,commands,turn:g.run('turn'),gameOver:g.run('gameOver'),win:g.run("units.find(u=>u.core).hp===0&&units.some(u=>u.team==='player'&&unitAlive(u))")};
}
