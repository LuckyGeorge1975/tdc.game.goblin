import {bindReplaySources,gameplaySourceHashes} from './helpers/replay-source-binding.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';import {apply} from './catalog-product-trace.mjs';import {streamDigest} from './catalog-specialists-trace.mjs';
// New recordings bind the gameplay sources; recorded traces keep their original header (see replay-source-binding).
export const sources=()=>gameplaySourceHashes();
function observer(g){
 const events=[];g.context.__fullEvent=event=>{const {before,after,...rest}=JSON.parse(JSON.stringify(event));events.push({...rest,beforeDigest:streamDigest(before),afterDigest:streamDigest(after)})};
 g.run("GoblinPresentation.subscribe((type,value)=>{if(type==='confirm')for(const event of value.events)__fullEvent(event)})");
 return ()=>({world:read(g,'({units,terrain:[...terrain],terrainTypes:[...terrainTypes],turn,phase,turnPhase,gameOver,selectedId:selected?.id??null,focusedCell,phaseRolls,phaseRollCursor,history:phaseCommands.map(({log,...s})=>s)})'),full:read(g,'GoblinCatalogFullRuntime.snapshot()'),markers:read(g,"M1UnitMarkers.legacy(legacySession,GoblinCatalogFullRuntime.roster(),'full-trace',victoryOutcome(victoryProfile(legacySession.effectiveRules),units))"),rng:g.rng(),presentation:read(g,'GoblinPresentation.read()'),events:structuredClone(events)});
}
export async function record(route,expected=null){
 assert.match(route.id,/^catalog-full-(atlas|terrain-course|advance|siege|specialists)$/);assert.equal(typeof route.intendedWin,'boolean');
 const g=await fullScene(route.id,route.seed,true);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));const observe=observer(g);
 const header={version:'catalog-full-product-trace-v2',publicSaveFormat:false,scenarioId:route.id,profile:'CATALOG_FULL_CANDIDATE_v1',session:read(g,'legacySession'),sources:sources(),seed:route.seed,rng:'xorshift32-test-v1'},initial=observe(g),steps=[];
 if(expected){assert.deepEqual({...header,sources:bindReplaySources(expected.header.sources,expected.traceDigest)},expected.header);assert.deepEqual(initial,expected.initial)}
 for(const [index,command] of route.commands.entries()){
  const result=await apply(g,command,observe),facts=observe(g),step={command,result,...facts};
  if(expected)assert.deepEqual(step,expected.steps[index],`full trace step ${index}`);else steps.push(step);
 }
 assert.equal(read(g,'gameOver'),true);assert.equal(read(g,'GoblinCatalogFullRuntime.terminalOutcome()'),route.intendedWin);
 if(expected){assert.equal(route.commands.length,expected.steps.length);return true}
 const trace={header,initial,route,steps};return {...trace,traceDigest:streamDigest(trace)};
}
export async function replay(trace){const {traceDigest,...body}=trace;assert.equal(streamDigest(body),traceDigest);return record(trace.route,trace)}
