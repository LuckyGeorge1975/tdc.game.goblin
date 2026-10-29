import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';import {apply} from './catalog-product-trace.mjs';import {streamDigest} from './catalog-specialists-trace.mjs';
const paths=['ui-v2.css','assets/ui-copy/briefing-01.de.json','assets/ui-copy/briefing-01.en.json','assets/ui-copy/briefing-01.es.json','assets/ui-copy/briefing-01.fr.json','tests/catalog-product-trace.mjs','tests/catalog-specialists-trace.mjs','tests/helpers/catalog-display-source-compatibility.mjs','tests/helpers/catalog-full-source-compatibility.mjs','tests/helpers/trace-object-table.mjs','index.html','unit-life.js','terrain-rules.js','ogre-systems.js','catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js','catalog-full-model.js','catalog-full-runtime.js','catalog-full-loader.js','catalog-visibility.js','catalog-waves.js','game.js','catalog-base-runtime.js','catalog-specialists-runtime.js','catalog-specialists-ui.js','scenario-profile-manifest.js','scenario.js','command-history.js','legacy-presentation.js','presentation-state.js','fire-presentation.js','m1-unit-markers.js','ui-v2.js','ui-v2-flow.js','unit-guide.js','unit-guide-range.js','assets/unit-art/rules/unit-profiles.catalog-approved.v1.json','assets/unit-art/levels/catalog-full-levels.v1.json','tests/artillery-product-harness.mjs','tests/catalog-full-harness.mjs','tests/catalog-full-trace.mjs'];
const hash=v=>createHash('sha256').update(v).digest('hex');
export const sources=()=>Object.fromEntries(paths.map(p=>[p,hash(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n'))]));
function observer(g){
 const events=[];g.context.__fullEvent=event=>{const {before,after,...rest}=JSON.parse(JSON.stringify(event));events.push({...rest,beforeDigest:streamDigest(before),afterDigest:streamDigest(after)})};
 g.run("GoblinPresentation.subscribe((type,value)=>{if(type==='confirm')for(const event of value.events)__fullEvent(event)})");
 return ()=>({world:read(g,'({units,terrain:[...terrain],terrainTypes:[...terrainTypes],turn,phase,turnPhase,gameOver,selectedId:selected?.id??null,focusedCell,phaseRolls,phaseRollCursor,history:phaseCommands.map(({log,...s})=>s)})'),full:read(g,'GoblinCatalogFullRuntime.snapshot()'),markers:read(g,"M1UnitMarkers.legacy(legacySession,GoblinCatalogFullRuntime.roster(),'full-trace',victoryOutcome(victoryProfile(legacySession.effectiveRules),units))"),rng:g.rng(),presentation:read(g,'GoblinPresentation.read()'),events:structuredClone(events)});
}
export async function record(route,expected=null){
 assert.match(route.id,/^catalog-full-(atlas|terrain-course|advance|siege|specialists)$/);assert.equal(typeof route.intendedWin,'boolean');
 const g=await fullScene(route.id,route.seed,true);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));const observe=observer(g);
 const header={version:'catalog-full-product-trace-v2',publicSaveFormat:false,scenarioId:route.id,profile:'CATALOG_FULL_CANDIDATE_v1',session:read(g,'legacySession'),sources:sources(),seed:route.seed,rng:'xorshift32-test-v1'},initial=observe(g),steps=[];
 if(expected){assert.deepEqual(header,expected.header);assert.deepEqual(initial,expected.initial)}
 for(const [index,command] of route.commands.entries()){
  const result=await apply(g,command,observe),facts=observe(g),step={command,result,...facts};
  if(expected)assert.deepEqual(step,expected.steps[index],`full trace step ${index}`);else steps.push(step);
 }
 assert.equal(read(g,'gameOver'),true);assert.equal(read(g,'GoblinCatalogFullRuntime.terminalOutcome()'),route.intendedWin);
 if(expected){assert.equal(route.commands.length,expected.steps.length);return true}
 const trace={header,initial,route,steps};return {...trace,traceDigest:streamDigest(trace)};
}
export async function replay(trace){const {traceDigest,...body}=trace;assert.equal(streamDigest(body),traceDigest);return record(trace.route,trace)}
