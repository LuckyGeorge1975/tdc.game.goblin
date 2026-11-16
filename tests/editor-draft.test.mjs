import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read,execute} from './artillery-product-harness.mjs';

async function scene() {
  const g = await fullScene('catalog-full-terrain-course',7,false,'FULL_CATALOG_v1');
  g.run(readFileSync(new URL('../level-events.js',import.meta.url),'utf8'));
  g.run(readFileSync(new URL('../editor-draft.js',import.meta.url),'utf8'));
  g.run('globalThis.draft=GoblinEditorDraft.copyTemplate()');
  return g;
}

test('6×5 and 18×12 drafts save, reload and bind native board dimensions',async()=>{
  const g=await scene();
  const store=new Map();
  g.context.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  g.run(readFileSync(new URL('../saved-levels.js',import.meta.url),'utf8'));
  for (const [width,height] of [[6,5],[18,12]]) {
    g.context.size={width,height};
    g.run(`globalThis.variableDraft={...draft,...size,
      terrain:[{x:size.width-1,y:size.height-1,type:'crater'}],
      units:[{id:'scout',assetId:'combat-skimmer',team:'player',x:0,y:0},
        {id:'core',assetId:'command-core',team:'enemy',x:size.width-1,y:size.height-1}]};
      GoblinSavedLevels.save('Variable',variableDraft);`);
    await g.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(GoblinSavedLevels.read().at(-1).level)).then(loadEditorDraft)');
    assert.deepEqual(read(g,'[W,H]'),[width,height]);
    assert.equal(g.run('GoblinCatalogFullRuntime.aiProjection("player").terrain.width'),width);
    assert.notEqual(g.run('boardViewBox()'),'0 0 790 480');
    assert.equal(execute(g,{type:'Move',actorId:'scout',x:1,y:0}).ok,true);
    assert.equal(execute(g,{type:'Move',actorId:'scout',x:width,y:0}).ok,false);
    assert.throws(()=>g.run('GoblinEditorDraft.validate({...variableDraft,width:size.width-1})'),/bounds|schema/);
    g.run("loadScenario('catalog-full-terrain-course')");
    assert.deepEqual(read(g,'[W,H]'),[12,8]);
    assert.equal(g.run('boardViewBox()'),'0 0 790 480');
  }
});

test('production FULL v3 missions round-trip with starting cargo, waves and objectives', async () => {
  const g = await scene();
  const file = name => readFileSync(new URL('../assets/unit-art/levels/' + name,import.meta.url),'utf8');
  g.context.packageText = file('catalog-full-levels.v3.json');
  const expected = JSON.parse(g.context.packageText).levels;
  g.run('globalThis.levels=GoblinEditorDraft.importLevels(packageText)');
  assert.deepEqual(read(g,'levels.map(level=>GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(level)))'),expected);
  await g.run('GoblinEditorDraft.prepare(levels[0]).then(loadEditorDraft)');
  assert.equal(g.run('units.filter(u=>u.embarkedOn).length'),2);
  await g.run('GoblinEditorDraft.prepare(levels[4]).then(loadEditorDraft)');
  assert.equal(g.run('GoblinCatalogFullRuntime.pendingEnemy()'),1);
  assert.equal(g.run('GoblinCatalogFullRuntime.status().turnLimit'),expected[4].goals[0].turns);
  g.context.pilotText = file('artillery-pilot.v3.json');
  assert.throws(()=>g.run('GoblinEditorDraft.importLevels(pilotText)'),/schema/);
});

test('solo hotspots, briefing and large localized event data survive canonical reimport', async () => {
  const g = await scene();
  g.run(`
    draft.hotspots=[{id:'rally',center:{x:4,y:4},radius:1}];
    draft.goals=[{type:'enemy-turn-limit',turns:1}];
    draft.briefing={de:'Briefing DE',en:'Briefing EN',es:'Briefing ES',fr:'Briefing FR'};
  `);
  assert.equal(read(g,'GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(draft)).hotspots[0].id'),'rally');
  g.run(`
    const msg=n=>Object.fromEntries(['de','en','es','fr'].map(lang=>[lang,'x'.repeat(n)]));
    draft.events=Array.from({length:24},(_,i)=>({id:'event-'+i,when:{all:[
      {event:'UnitMoved',unitId:'draft-1'},{pathCrossesHotspot:'rally'}]},
      effect:{type:'dialog',title:msg(45),text:msg(540)}}));
  `);
  assert.deepEqual(read(g,'GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(draft))'),read(g,'draft'));
  assert.throws(()=>g.run('GoblinEditorDraft.validate({...draft,hotspots:[]})'),/references/);
});

test('saved v3 levels reload by stable ID and restart from the admitted start snapshot', async () => {
  const disk = new Map();
  const open = async () => {
    const game = await scene();
    game.context.localStorage = {getItem:key=>disk.get(key)??null,setItem:(key,value)=>disk.set(key,value)};
    game.run(readFileSync(new URL('../saved-levels.js',import.meta.url),'utf8'));
    return game;
  };
  const first = await open();
  const a = read(first, "GoblinSavedLevels.save('Atlas copy',draft)");
  const b = read(first, "GoblinSavedLevels.save('Atlas copy',draft)");
  assert.notEqual(a.id,b.id);
  assert.equal(JSON.parse(a.level).version,'goblin-level-v3');
  const second = await open();
  assert.deepEqual(read(second,'GoblinSavedLevels.read()'),[a,b]);
  const flow = readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
  const start = flow.slice(flow.indexOf('    async function startSavedLevel('),flow.indexOf('    async function reloadGameCache('));
  const restart = flow.slice(flow.indexOf('    async function confirmRestart('),flow.indexOf('    async function goToLevels('));
  second.run(`
    let screen='levels',savedTab=true,savedStarting=false,savedError='',savedConfig=null,savedTitle='',editorConfig=null,started=false,campaign=null;
    let panel={};
    const surface={querySelector:()=>panel};
    const renderScreen=()=>{},show=value=>{screen=value},releasePause=()=>{},bindCampaignLesson=()=>{};
    const GoblinUIV2={resetView(){},startView(){}};
    ${start}
    ${restart}
  `);
  const beforeStart = second.state();
  const stale = second.run('startSavedLevel(GoblinSavedLevels.read()[0])');
  second.run('panel={}');
  await stale;
  assert.equal(second.run('screen'),'levels');
  assert.equal(second.state(),beforeStart);
  await second.run('startSavedLevel(GoblinSavedLevels.read()[0])');
  assert.equal(second.run('screen'),'play');
  assert.equal(second.run('savedTitle'),'Atlas copy');
  const snapshot = read(second,'savedConfig.units');
  second.run("GoblinSavedLevels.save('Revised',draft,GoblinSavedLevels.read()[0]); units[0].x=0");
  await second.run('confirmRestart()');
  assert.deepEqual(read(second,'legacySession.config.units'),snapshot);
  assert.equal(read(second,'GoblinSavedLevels.read()[0].id'),a.id);
  assert.throws(()=>second.run(`GoblinSavedLevels.save('Stale',draft,${JSON.stringify(a)})`),/conflict/);
  const before = [...disk];
  second.context.localStorage.setItem = () => { throw Error('quota'); };
  assert.throws(()=>second.run("GoblinSavedLevels.save('Quota',draft)"),/quota/);
  assert.deepEqual([...disk],before);
  disk.set(before[0][0],'{');
  assert.throws(()=>second.run('GoblinSavedLevels.read()'));
});

test('draft JSON round-trips and rejects malformed coordinates, IDs, terrain and objective without a world change',async()=>{
  const g = await scene();
  const before = g.state();
  assert.deepEqual(read(g,'GoblinEditorDraft.parse(JSON.stringify(draft))'),read(g,'draft'));
  for (const [edit,error] of [
    ['d.version="wrong"','schema'], ['d.objective="core"','schema'], ['d.units[0].x=12','bounds'],
    ['d.units[0].id=d.units[1].id','collision'], ['d.units[0].x=d.units[1].x;d.units[0].y=d.units[1].y','collision'],
    ['d.units[0].assetId="__proto__"','unit'], ['d.units[0].hp=999','unit'],
    ['d.ruleProfile="FIELD_TEST_LEGACY_v1"','schema'], ['d.minimumDifficulty="Strong"','FULL minimumDifficulty'],
    ['d.losMode="legacy"','schema'], ['d.code="return 0"','schema'], ['d.title="custom UI"','schema'],
    ['d.units=d.units.filter(u=>u.id!=="core")','core'], ['d.units=d.units.filter(u=>u.team!=="player")','player'],
    ['d.terrain.push({x:0,y:0,type:"lava"})','terrain'],
    ['const u=d.units[0];d.terrain=d.terrain.filter(c=>c.x!==u.x||c.y!==u.y);d.terrain.push({x:u.x,y:u.y,type:"water"})','startTerrain']
  ]) {
    assert.throws(()=>g.run(`{const d=structuredClone(draft);${edit};GoblinEditorDraft.parse(JSON.stringify(d))}`),new RegExp(error));
    assert.equal(g.state(),before);
  }
  assert.throws(()=>g.run("GoblinEditorDraft.parse('{invalid')"),/json/);
});

test('editor prepares an authored level from its registered profile without a demo config',async()=>{
  const g=await scene();
  const source=readFileSync(new URL('../editor-draft.js',import.meta.url),'utf8');
  g.run(`{const root=globalThis;
    const isolated={GoblinCatalogFullModel:{editorProfile:root.GoblinCatalogFullModel.editorProfile,scope:root.GoblinCatalogFullModel.scope}};
    ((globalThis,GoblinCatalogFullModel)=>{
    ${source}
    })(isolated,isolated.GoblinCatalogFullModel);
    root.independentEditor=isolated.GoblinEditorDraft;
  }`);
  const config=await g.run('independentEditor.prepare(draft)');
  assert.equal(config.ruleProfileId,'FULL_CATALOG_v1');
  assert.equal(config.losMode,'strict-supercover');
  assert.deepEqual(Array.from(config.catalog.full.waves.waves),[]);
  assert.equal(Object.hasOwn(config.catalog.full,'turnLimit'),false);
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
  g.context.document.createTextNode = text => text;
  const createElement = g.context.document.createElement;
  g.context.document.createElement = () => Object.assign(createElement(), {append() {}});
  g.run(`
    let screen='menu',campaign=null,started=false,editorDraft=null,editorCell={x:0,y:0},editorError='',editorBusy=false,editorMoving=false;
    let editorConfig=null,editorReturnScenario=null;
    let editorSaved=null,editorName='',editorSavedMessage='',editorMissionOpen=false,editorImportLevels=null;
    const button=()=>({}),actions=()=>({});
    const show=next=>{screen=next},releasePause=()=>{},renderScreen=()=>{},heading=x=>x,paragraph=x=>x;
    const GoblinUIV2={resetView(){},startView(){}},GoblinEditorUI={render(panel,view){globalThis.editorView=view}};
    ${flow.match(/^    const ironDustSeatScreens = .*;$/m)[0]}
    ${flow.slice(flow.indexOf('    async function leaveMission('),flow.indexOf('    function libraryAssetId('))}
  `);
  const world = g.state();
  g.run("openEditor();renderEditor({append(){}});editorView.import('{invalid')");
  const before = read(g,'editorDraft');
  assert.equal(g.run('editorError'),'json');
  assert.equal(g.state(),world);
  const origin = before.units.find(unit => unit.id === 'draft-1');
  const occupied = before.units.find(unit => unit.id === 'core');
  g.run(`editorView.select({x:${origin.x},y:${origin.y}});editorView.setMoving(true);
    editorView.select({x:${occupied.x},y:${occupied.y}})`);
  assert.equal(g.run('editorError'),'collision');
  assert.equal(g.run('editorMoving'),true);
  assert.deepEqual(read(g,'editorDraft'),before);
  g.run('editorView.setMoving(false)');
  assert.equal(g.run('editorMoving'),false);
  assert.deepEqual(read(g,'editorDraft'),before);
  g.run('editorView.setMoving(true);editorView.select({x:0,y:3})');
  assert.equal(g.run('editorMoving'),false);
  assert.deepEqual(read(g,"editorDraft.units.find(unit=>unit.id==='draft-1')"),{...origin,x:0,y:3});
  assert.deepEqual(read(g,'editorCell'),{x:0,y:3});
  g.run(`editorView.setMoving(true);editorView.select({x:${origin.x},y:${origin.y}})`);
  assert.deepEqual(read(g,'editorDraft'),before);
  assert.equal(g.state(),world);
  g.run("editorView.update({...editorDraft,briefing:'Check cover before moving'}); GameDialogs.confirm=async options=>{globalThis.notice=options;return false}");
  await g.run('playEditorDraft()');
  assert.equal(g.run('screen'),'editor');
  assert.equal(g.state(),world);
  assert.equal(g.run('notice.message'),'Check cover before moving');
  g.run('GameDialogs.confirm=async()=>true');
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
  assert.deepEqual(read(g,'editorDraft'),{...before,briefing:'Check cover before moving'});
});
