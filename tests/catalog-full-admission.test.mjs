import {assertHistoricalFullTransition} from './helpers/historical-full-transition.mjs';
import {runFullLoader} from './helpers/full-loader-context.mjs';
import {apply} from './catalog-product-trace.mjs';
import {replay} from './catalog-full-trace.mjs';
import {gunzipSync} from 'node:zlib';import{decode}from './helpers/trace-object-table.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {fullScene,fullShell}from './catalog-full-harness.mjs';import{read,execute}from './artillery-product-harness.mjs';
const retired='CATALOG_FULL_CANDIDATE_v1',P='FULL_CATALOG_v1';
const ids=['atlas','terrain-course','advance','siege','specialists'].map(s=>'catalog-full-'+s);
const file=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const dir=new URL('./fixtures/catalog-full/',import.meta.url);
const index=JSON.parse(fs.readFileSync(new URL('index.v2.json',dir)));
const victory=id=>decode(JSON.parse(gunzipSync(fs.readFileSync(new URL(index.traces[id+'-victory'].file,dir)))));
test('all five current FULL starts match the recorded sessions, visibility and RNG',async()=>{
 for(const id of ids){
  const g=await fullScene(id,7,true);
  g.run(file('m1-unit-markers.js'));
  const trace=victory(id);
  assert.equal(trace.header.profile,P);
  assert.deepEqual(read(g,'legacySession'),trace.header.session);
  assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),trace.initial.full);
  assert.deepEqual(read(g,"M1UnitMarkers.legacy(legacySession,GoblinCatalogFullRuntime.roster(),'full-trace',victoryOutcome(victoryProfile(legacySession.effectiveRules),units))"),trace.initial.markers);
  assert.deepEqual(g.rng(),trace.initial.rng);
  assert.equal(read(g,'data.targetActive'),false);
  assert.equal(read(g,'GoblinCatalogFullRuntime.active()'),true);
 }
});
test('admission rejects retired or foreign profiles, formats and forged bindings without changing world or RNG',async()=>{
 const g=await fullScene(),before=g.state(),rng=g.rng();
 g.context.retired=retired;
 for(const expression of [
  "GoblinCatalogFullModel.initialize(data,levelData)",
  "GoblinCatalogFullModel.initialize(data,levelData,{profile:'foreign'})",
  "GoblinCatalogFullModel.initialize(data,levelData,{profile:retired})",
  "GoblinCatalogFullModel.initialize(data,{...levelData,version:'catalog-full-levels-v1'},{profile:'FULL_CATALOG_v1'})"
 ]){
  await assert.rejects(()=>g.run(expression));
  assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);
 }
 for(const mutate of [c=>c.ruleProfileId=retired,c=>c.scenarioVersion++,c=>c.objectiveVersion++,c=>c.losMode='legacy',
  c=>c.ruleProfile='foreign',c=>c.catalog.dataDigest='foreign',c=>c.catalog.rosterDigest='foreign',
  c=>c.catalog.mechanicsDigest='foreign',c=>c.catalog.levelDigest='foreign',c=>c.units[0].hp=999]){
  const config=read(g,'legacySession.config');mutate(config);g.context.badConfig=config;
  assert.throws(()=>g.run("ScenarioRuleProfiles.beginSession('catalog-full-specialists',badConfig)"));
  assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);
 }
 assert.throws(()=>g.run("ScenarioRuleProfiles.beginSession('unknown-full',legacySession.config)"));
 for(const id of ['__proto__','constructor'])assert.equal(read(g,'GoblinCatalogFullModel.has('+JSON.stringify(id)+')'),false);
});
test('actual loader admits only the public FULL profile and refreshes navigation screens',async()=>{const loader=file('catalog-full-loader.js');for(const [search,profile]of ['',...ids.map(id=>'?ui=v2&scenario='+id)].map(search=>[search,P])){const g=fullShell();g.context.location={search};g.context.__events=[];g.context.dispatchEvent=e=>g.context.__events.push(e.type);g.context.Event=class{constructor(type){this.type=type}};g.context.fetch=async path=>({ok:true,json:async()=>structuredClone(path.includes('levels')?g.context.levelData:g.context.data)});await runFullLoader(g,loader);assert.equal(read(g,'GoblinCatalogFullModel.profile'),profile);assert.equal(read(g,"Object.keys(scenarioCatalog).filter(id=>id.startsWith('catalog-full-')).length"),5);assert.deepEqual(g.context.__events,['goblin-catalog-ready']);if(search.includes('scenario='))assert.equal(read(g,'legacySession.ruleProfileId'),profile)}const source=file('ui-v2-flow.js'),start=source.indexOf("    globalThis.addEventListener('goblin-catalog-ready',"),end=source.indexOf("    globalThis.addEventListener('goblin-core-v2-ready',",start),g=fullShell();g.context.__count=0;g.run(`{let screen='levels',started=false,campaign=null,missionId='iron-dust';const missionData=()=>null;const renderScreen=()=>__count++;const globalThis={addEventListener(name,fn){if(name==='goblin-catalog-ready')this.ready=fn}};${source.slice(start,end)}globalThis.ready();screen='briefing';globalThis.ready();screen='menu';globalThis.ready();screen='play';globalThis.ready();}`);assert.equal(g.context.__count,3)});
test('normal loader refuses invalid source/copy and unsupported mode without partial Full registration or world mutation',async()=>{for(const mode of ['classic','data','copy']){const g=fullShell(),before=g.state(),rng=g.rng();g.context.location={search:mode==='classic'?'?ui=classic':''};g.context.console={error(){}};g.context.GoblinLanguage={ready:Promise.resolve(mode!=='copy')};g.context.fetch=async path=>({ok:mode!=='data',json:async()=>structuredClone(path.includes('levels')?g.context.levelData:g.context.data)});await runFullLoader(g,file('catalog-full-loader.js'));assert.equal(read(g,"Object.keys(scenarioCatalog).some(id=>id.startsWith('catalog-full-'))"),false);assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng)}});
test('FULL Specialists keeps movement, hex fire, Undo and both scheduled waves',async()=>{
 const g=await fullScene('catalog-full-specialists',7,true);
 const start=read(g,"units.find(u=>u.catalogId==='U13')");
 const move={type:'Move',actorId:start.id,x:1,y:2};
 assert.equal(read(g,'query('+JSON.stringify(move)+')').ok,true);
 assert.equal(execute(g,move).ok,true);
 assert.equal(read(g,"units.find(u=>u.catalogId==='U13').y"),2);
 g.run("undoPhaseCommand();setTurnPhase('fire')");
 assert.equal(read(g,"units.find(u=>u.catalogId==='U13').y"),start.y);
 const shot={type:'CatalogHexFire',actorId:start.id,x:0,y:0};
 assert.equal(read(g,'query('+JSON.stringify(shot)+')').ok,true);
 assert.equal(execute(g,shot).ok,true);
 assert.equal(read(g,"units.find(u=>u.catalogId==='U13').ammunition"),0);
 g.run('undoPhaseCommand()');
 assert.equal(read(g,"units.find(u=>u.catalogId==='U13').ammunition"),start.ammunition);
 for(let n=0;n<5;n++){
  while(read(g,'phase')==='player')await apply(g,{kind:'Advance'});
  await apply(g,{kind:'Enemy'});
 }
 assert.equal(read(g,"GoblinCatalogFullRuntime.snapshot().waves.waves.every(w=>w.status==='spawned')"),true);
});

test('a concurrent retired admission cannot replace a valid FULL admission',async()=>{
 const g=fullShell(),before=g.state(),rng=g.rng();
 g.context.retired=retired;
 const results=await g.run("Promise.allSettled([GoblinCatalogFullModel.initialize(data,levelData,{profile:retired}),GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})])");
 assert.deepEqual(Array.from(results,r=>r.status),['rejected','fulfilled']);
 assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng);
 assert.equal(read(g,'GoblinCatalogFullModel.profile'),P);
});
test('public label uses exact localized copy instead of technical profile ID without mutation',async()=>{const g=await fullScene('catalog-full-atlas',7,false,P),before=g.state(),rng=g.rng(),source=file('ui-v2.js'),line=source.split('\n').filter(l=>l.includes("at('#v2-profile').textContent")).at(-1);for(const [lang,text]of Object.entries({de:'Vollkatalog',en:'Full catalog',es:'Catálogo completo',fr:'Catalogue complet'})){g.context.__copy=JSON.parse(file('assets/ui-copy/briefing-01.'+lang+'.json')).messages;g.context.__label={};g.run(`{const state={profile:legacySession.ruleProfileId},at=()=>__label,t=k=>__copy[k];${line}}`);assert.equal(g.context.__label.textContent,text)}assert.equal(g.state(),before);assert.deepEqual(g.rng(),rng)});
test('historical FULL Advance retains its bound route and rejects only the authorised inactive-side initial-state transition',async()=>{
 await assertHistoricalFullTransition(victory('catalog-full-advance'));
});

test('catalog ready selects a validated requested Full mission but never redirects an already started mission',async()=>{const g=await fullScene('catalog-full-atlas',7,false,P),source=file('ui-v2-flow.js'),start=source.indexOf("    globalThis.addEventListener('goblin-catalog-ready',"),end=source.indexOf("    globalThis.addEventListener('goblin-core-v2-ready',",start);g.context.__selected=[];g.run(`{let screen='menu',started=false,campaign=null,missionId='iron-dust';const missionData=id=>scenarioCatalog[id],renderScreen=()=>{};const globalThis={location:{search:'?scenario=catalog-full-atlas'},addEventListener(name,fn){if(name==="goblin-catalog-ready")this.ready=fn}};${source.slice(start,end)}globalThis.ready();__selected.push(missionId);started=true;missionId='relay-run';globalThis.ready();__selected.push(missionId);}`);assert.deepEqual([...g.context.__selected],['catalog-full-atlas','relay-run']);const shell=fullShell();shell.context.GoblinV2Flow={hasStarted:()=>true};shell.context.location={search:'?scenario=catalog-full-atlas'};shell.context.fetch=async path=>({ok:true,json:async()=>structuredClone(path.includes('levels')?shell.context.levelData:shell.context.data)});const before=read(shell,'legacySession.sessionId');await runFullLoader(shell,file('catalog-full-loader.js'));assert.equal(read(shell,'legacySession.sessionId'),before);assert.equal(read(shell,'GoblinCatalogFullModel.profile'),P)});

test('already loaded direct Full URL initializes navigation to the same mission before the ready listener exists',async()=>{const g=await fullScene('catalog-full-atlas',7,false,P),source=file('ui-v2-flow.js'),start=source.indexOf('    const requestedScenario='),end=source.indexOf('    let libraryIndex',start);g.context.location={search:'?scenario=catalog-full-atlas'};g.run(`{${source.slice(start,end)}globalThis.__initialMission=missionId;}`);assert.equal(g.context.__initialMission,'catalog-full-atlas')});
