import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read,execute} from './artillery-product-harness.mjs';

async function scene() {
  const g = await fullScene('catalog-full-terrain-course',7,false,'FULL_CATALOG_v1');
  g.run(readFileSync(new URL('../editor-draft.js',import.meta.url),'utf8'));
  g.run('globalThis.draft=GoblinEditorDraft.copyTemplate()');
  return g;
}

test('draft JSON round-trips and rejects malformed coordinates, IDs, terrain and objective without a world change',async()=>{
  const g = await scene();
  const before = g.state();
  assert.deepEqual(read(g,'GoblinEditorDraft.parse(JSON.stringify(draft))'),read(g,'draft'));
  for (const [edit,error] of [
    ['d.version="wrong"','schema'], ['d.objective="core"','schema'], ['d.units[0].x=12','bounds'],
    ['d.units[0].id=d.units[1].id','collision'], ['d.units[0].x=d.units[1].x;d.units[0].y=d.units[1].y','collision'],
    ['d.units[0].assetId="__proto__"','unit'], ['d.units[0].hp=999','unit'],
    ['d.units=d.units.filter(u=>u.id!=="core")','core'], ['d.units=d.units.filter(u=>u.team!=="player")','player'],
    ['d.terrain.push({x:0,y:0,type:"lava"})','terrain'],
    ['const u=d.units[0];d.terrain=d.terrain.filter(c=>c.x!==u.x||c.y!==u.y);d.terrain.push({x:u.x,y:u.y,type:"water"})','startTerrain']
  ]) {
    assert.throws(()=>g.run(`{const d=structuredClone(draft);${edit};GoblinEditorDraft.parse(JSON.stringify(d))}`),new RegExp(error));
    assert.equal(g.state(),before);
  }
  assert.throws(()=>g.run("GoblinEditorDraft.parse('{invalid')"),/json/);
});

test('a prepared draft starts real FULL play without registration, mutation of curated config or acceptance of a forged session',async()=>{
  const g = await scene();
  const source = read(g,'GoblinCatalogFullModel.configs');
  const before = g.state();
  g.run('draft.units[0].x=0;draft.units[0].y=3');
  await g.run('GoblinEditorDraft.prepare(draft).then(config=>globalThis.prepared=config)');
  assert.equal(g.state(),before);
  assert.equal(g.run("GoblinCatalogFullModel.has('editor-draft') || Object.hasOwn(ScenarioRuleProfiles.entries,'editor-draft') || Object.hasOwn(scenarioCatalog,'editor-draft')"),false);
  assert.throws(()=>g.run("ScenarioRuleProfiles.beginSession('editor-draft',prepared)"),/UNSUPPORTED_RULE_PROFILE/);
  assert.throws(()=>g.run('loadEditorDraft(structuredClone(prepared))'),/not validated/);
  assert.equal(g.state(),before);
  g.run('loadEditorDraft(prepared)');
  assert.equal(g.run('currentScenario'),'editor-draft');
  assert.equal(g.run('GoblinCatalogFullRuntime.active() && ScenarioRuleProfiles.isDraftSession(legacySession)'),true);
  assert.equal(g.run('ScenarioRuleProfiles.isDraftSession(structuredClone(legacySession))'),false);
  assert.equal(g.run('lineOfSight({x:0,y:0},{x:1,y:0})'),true);
  g.run(readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));
  const markers = read(g,"M1UnitMarkers.legacy(legacySession,GoblinCatalogFullRuntime.roster(),'draft',null)");
  assert.equal(markers.supported,true);
  assert.ok(markers.objective.members.some(member=>member.unitId==='core'));
  const move = {type:'Move',actorId:'draft-1',x:0,y:4};
  assert.equal(execute(g,move).ok,true);
  assert.equal(g.run("units.find(u=>u.id==='draft-1').y"),4);
  assert.equal(g.run('phaseCommands.length'),1);
  assert.equal(g.rolls(),0);
  g.run('undoPhaseCommand()');
  assert.equal(g.run("units.find(u=>u.id==='draft-1').y"),3);
  assert.deepEqual(read(g,'GoblinCatalogFullModel.configs'),source);
  g.run("loadScenario('catalog-full-terrain-course')");
  assert.equal(g.run('ScenarioRuleProfiles.isDraftSession(legacySession)'),false);
  assert.equal(g.run("units.find(u=>u.id==='catalog-full-terrain-course-1').x"),1);
});

test('editor flow keeps the validated draft across playtest and rejects an import without replacing it',async()=>{
  const g = await scene();
  const flow = readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
  g.run(`
    let screen='menu',campaign=null,started=false,editorDraft=null,editorCell={x:0,y:0},editorError='',editorBusy=false;
    let editorConfig=null,editorReturnScenario=null;
    const show=next=>{screen=next},releasePause=()=>{},renderScreen=()=>{},heading=x=>x,paragraph=x=>x;
    const GoblinUIV2={resetView(){},startView(){}},GoblinEditorUI={render(panel,view){globalThis.editorView=view}};
    ${flow.slice(flow.indexOf('    async function leaveMission('),flow.indexOf('    function libraryAssetId('))}
  `);
  const world = g.state();
  g.run("openEditor();renderEditor({append(){}});editorView.import('{invalid')");
  const before = read(g,'editorDraft');
  assert.equal(g.run('editorError'),'json');
  assert.equal(g.state(),world);
  await g.run('playEditorDraft()');
  assert.equal(g.run('screen'),'play');
  assert.equal(execute(g,{type:'Move',actorId:'draft-1',x:0,y:3}).ok,true);
  g.run('GameDialogs.confirm=async()=>false');
  await g.run("leaveMission('levels')");
  assert.equal(g.run('screen'),'play');
  g.run('GameDialogs.confirm=async()=>true');
  await g.run("leaveMission('levels')");
  assert.equal(g.run('screen'),'editor');
  assert.equal(g.run('currentScenario'),'catalog-full-terrain-course');
  assert.deepEqual(read(g,'editorDraft'),before);
});
