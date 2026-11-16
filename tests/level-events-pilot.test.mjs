import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fullScene} from './catalog-full-harness.mjs';
import {execute,read,enemy} from './artillery-product-harness.mjs';

const source = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
async function pilot() {
  const game = await fullScene('catalog-full-terrain-course',7,false,'FULL_CATALOG_v1');
  game.run(source('level-events.js'));
  game.run(source('editor-draft.js'));
  game.context.draftText = source('assets/training/level-events-pilot.v3.json');
  game.run(`
    const warnings=[], confirmations=[];
    GameDialogs.isOpen=()=>confirmations.length>0;
    GameDialogs.warn=options=>{
      warnings.push({...options,undoAtOpen:phaseCommands.length});
      return new Promise(resolve=>confirmations.push(resolve));
    };
    const dismiss=()=>confirmations.shift()(true);
    const eventDraft=GoblinEditorDraft.parse(draftText);
  `);
  await game.run('GoblinEditorDraft.prepare(eventDraft).then(loadEditorDraft)');
  return game;
}

test('v3 event draft round-trips and rejects retired editor formats before applying them',async()=>{
  const game=await pilot();
  assert.deepEqual(read(game,'GoblinEditorDraft.parse(JSON.stringify(eventDraft))'),JSON.parse(game.context.draftText));
  const world = game.state(), rng = game.rng();
  assert.throws(()=>game.run("GoblinEditorDraft.parse(JSON.stringify({...GoblinEditorDraft.copyTemplate(),version:'goblin-level-draft-v1'}))"),/schema/);
  assert.throws(()=>game.run("GoblinEditorDraft.importLevels(JSON.stringify({...GoblinEditorDraft.copyTemplate(),version:'goblin-level-draft-v2',hotspots:[],hooks:[]}))"),/schema/);
  assert.throws(()=>game.run("GoblinEditorDraft.importLevels(JSON.stringify({version:'goblin-level-package-v2',levels:[eventDraft]}))"),/schema/);
  assert.equal(game.state(),world);
  assert.deepEqual(game.rng(),rng);
  assert.equal(game.run('GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(eventDraft)).version'),'goblin-level-v3');
  assert.equal(game.run('GoblinEditorDraft.exportJson(GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(eventDraft)))===GoblinEditorDraft.exportJson(eventDraft)'),true);
  const canonicalExport=game.run('GoblinEditorDraft.exportJson(eventDraft)');
  assert.doesNotMatch(canonicalExport,/\r/);
  assert.equal(canonicalExport,source('assets/training/level-events-pilot.v3.json').replaceAll('\r\n','\n').trimEnd());
  for (const mutation of [
    "d.events[0].when.unitId='unknown'",
    "d.hotspots[0].radius=-1",
    "d.events[0].effect.type='heal'",
    "d.events[1].when.all[1].pathCrossesHotspot='unknown'",
    "d.events[0].when={any:[]}",
    "d.events[1].effect.portrait='remote.jpg'"
  ]) {
    assert.throws(()=>game.run(`{const d=structuredClone(eventDraft);${mutation};GoblinEditorDraft.parse(JSON.stringify(d))}`),/events|references/);
  }
});

test('the editor pilot entry loads the shipped draft through the same validated import path',async()=>{
  const game=await pilot(), flow=source('ui-v2-flow.js');
  const start=flow.indexOf('    function updateEditor('), end=flow.indexOf('    async function playEditorDraft(',start);
  game.run(`
    let screen='editor',editorDraft=GoblinEditorDraft.copyTemplate(),editorBusy=false,editorMoving=false,
      editorCell={x:0,y:0},editorError='',requested='';
    const renderScreen=()=>{};
    const fetch=async path=>{requested=path;return {ok:true,text:async()=>draftText}};
    ${flow.slice(start,end)}
  `);
  await game.run('loadEditorPilot()');
  assert.equal(game.run('requested'),'assets/training/level-events-pilot.v3.json');
  assert.deepEqual(read(game,'editorDraft'),JSON.parse(game.context.draftText));
  assert.deepEqual(read(game,'editorCell'),{x:1,y:3});
  assert.equal(game.run('editorBusy'),false);
  assert.equal(game.run('editorError'),'');
});

test('only committed paths fire hooks, in order, and cut off Undo before the first notice',async()=>{
  const game=await pilot();
  const scout={type:'Move',actorId:'tutorial-scout',x:2,y:5};
  const tank={type:'Move',actorId:'tutorial-tank',x:4,y:3};
  assert.equal(execute(game,scout).ok,true);
  assert.equal(game.run('phaseCommands.length'),1);
  game.context.tank=tank;
  const before=game.state();
  const query=read(game,'query(tank)');
  assert.equal(query.ok,true);
  assert.deepEqual(query.path.at(-2),{x:3,y:3});
  assert.equal(game.run('warnings.length'),0);
  assert.equal(game.state(),before);
  assert.equal(execute(game,tank).ok,true);
  assert.deepEqual(read(game,'warnings.map(({title,portrait,undoAtOpen})=>[title,portrait,undoAtOpen])'),
    [['Erste Bewegung',false,0],['Meldung der Einsatzleitung',true,0]]);
  const committed=game.state();
  game.run('undoPhaseCommand();dismiss();dismiss()');
  await game.run('Promise.resolve()');
  assert.equal(game.state(),committed);
  assert.equal(game.rolls(),0);

  enemy(game);
  assert.equal(execute(game,{...tank,x:2}).ok,true);
  assert.equal(game.run('warnings.length'),2);
  assert.equal(game.run('phaseCommands.length'),1);
  game.run('undoPhaseCommand()');
  assert.equal(game.run("units.find(u=>u.id==='tutorial-tank').x"),4);
});

test('OR action hooks cut the boundary and later commands in the same phase remain reversible',async()=>{
  const game=await pilot();
  const scout={type:'Move',actorId:'tutorial-scout',x:2,y:5};
  const tank={type:'Move',actorId:'tutorial-tank',x:4,y:3};
  await game.run(`
    const altered=structuredClone(eventDraft);
    altered.events[0].when={any:[{event:'UnitActed',unitId:'tutorial-scout'},{event:'UnitDestroyed',unitId:'core'}]};
    altered.events.splice(1,1);
    GoblinEditorDraft.prepare(altered).then(loadEditorDraft);
  `);
  assert.equal(execute(game,scout).ok,true);
  assert.equal(game.run('phaseCommands.length'),0);
  game.run('dismiss()');
  await game.run('Promise.resolve()');
  assert.equal(execute(game,tank).ok,true);
  assert.equal(game.run('phaseCommands.length'),1);
  game.run('undoPhaseCommand();undoPhaseCommand()');
  assert.deepEqual(read(game,'units.slice(0,2).map(u=>u.x)'),[1,2]);
  assert.equal(game.rolls(),0);
});

test('a confirmed shot reports real destruction and acknowledgement consumes no die',async()=>{
  const game=await pilot();
  assert.equal(execute(game,{type:'Move',actorId:'tutorial-tank',x:4,y:3}).ok,true);
  game.run('dismiss();dismiss();setTurnPhase("fire")');
  await game.run('Promise.resolve()');
  game.context.rollQueue=[.99];
  const shot={type:'CatalogFire',actorId:'tutorial-tank',target:{kind:'unit',runtimeUnitId:'core'},weaponId:null,mode:'direct',spotterId:null};
  assert.equal(execute(game,shot).ok,true);
  assert.equal(game.run("units.find(u=>u.id==='core').hp"),0);
  assert.equal(game.run('warnings.at(-1).title'),'Ziel zerstört');
  assert.equal(game.run('warnings.at(-1).undoAtOpen'),0);
  assert.equal(game.rolls(),1);
  const after=game.state();
  game.run('dismiss()');
  await game.run('Promise.resolve()');
  assert.equal(game.state(),after);
  assert.equal(game.rolls(),1);
});

test('a hotspot radius also includes the final hex',async()=>{
  const game=await pilot();
  await game.run(`
    const endpoint=structuredClone(eventDraft);
    endpoint.hotspots[0].center={x:5,y:3};
    endpoint.hotspots[0].radius=1;
    GoblinEditorDraft.prepare(endpoint).then(loadEditorDraft);
  `);
  assert.equal(execute(game,{type:'Move',actorId:'tutorial-tank',x:4,y:3}).ok,true);
  assert.equal(game.run('warnings.at(-1).title'),'Meldung der Einsatzleitung');
});

test('enemy turn destruction uses the same event queue without creating player history',async()=>{
  const game=await pilot();
  await game.run(`
    const ambush=structuredClone(eventDraft);
    ambush.units.push({id:'ambush-tank',assetId:'assault-tank',team:'enemy',x:3,y:5});
    ambush.events[0].when={event:'UnitDestroyed',unitId:'tutorial-scout'};
    GoblinEditorDraft.prepare(ambush).then(loadEditorDraft);
  `);
  game.context.rollQueue=[.99];
  enemy(game);
  assert.equal(game.run("units.find(u=>u.id==='tutorial-scout').hp"),0);
  assert.equal(game.run('warnings.length'),1);
  assert.equal(game.run('warnings[0].undoAtOpen'),0);
});
