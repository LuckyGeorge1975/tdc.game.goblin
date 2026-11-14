import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fullScene} from './catalog-full-harness.mjs';
import {read, execute, enemy} from './artillery-product-harness.mjs';
import {targetOptionsSource} from './helpers/target-options-source.mjs';

const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const source = (start, end) => ui.slice(ui.indexOf(start), ui.indexOf(end, ui.indexOf(start)));

test('Atlas carrier and cargo target each other through the same reversible load command', async () => {
  const g = await fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
  g.run(readFileSync(new URL('../catalog-specialists-ui.js', import.meta.url), 'utf8'));
  g.run("const GoblinLanguage={current:'de',t:key=>key,translate:key=>key};" + targetOptionsSource);
  g.run(`globalThis.cargo=units.find(u=>u.id==='catalog-full-atlas-17');
    globalThis.carrier=units.find(u=>u.id==='catalog-full-atlas-12');
    const projected=()=>({units:GoblinCatalogFullRuntime.roster(),turnPhase,phase,gameOver,revision:revision()});
    const options=(actor,target)=>entriesAt(projected(),actor,{x:target.x,y:target.y});`);
  g.run(`
    const project=projected;
    const el=(tag,className='',text='')=>({tag,className,text,children:[],
      append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},setAttribute(){}});
    const card=Object.assign(el('section'),{dataset:{}}), at=selector=>selector==='#v2-target-card'?card:selector==='#v2-map'?{focus(){}}:null;
    const svgIcon=()=>'', placeNearHex=()=>{}, TerrainDisplay={label:type=>type,icon:()=>null};
    document.body={classList:{contains:()=>false}};
    document.createTextNode=text=>el('#text','',text);
    ${source('    function clearContext(', '    function coreOpenCount(')}
    ${source('    function inspectTrainingTarget(', '    const areaCache')}
    ${source('    function areaQuery(', '    function selectedFirePreview(')}
  `);
  const before = g.state();
  const forward = read(g, "options(cargo,carrier).find(entry=>entry.command.type==='Embark')")?.command;
  const reverse = read(g, "options(carrier,cargo).find(entry=>entry.command.type==='Embark')??null")?.command;
  assert.ok(forward);
  assert.deepEqual(reverse, forward);
  assert.equal(g.state(), before);
  assert.deepEqual(read(g, 'areaData(projected(),carrier,"movement").load'), [{x:0,y:7}]);
  g.run('carrier.moved=true');
  const spentCarrier = read(g, 'areaData(projected(),carrier,"movement")');
  assert.deepEqual(spentCarrier.legal, []);
  assert.deepEqual(spentCarrier.load, [{x:0,y:7}]);
  assert.equal(spentCarrier.reason, '');
  assert.equal(spentCarrier.status, 'move');
  g.run('carrier.moved=false');

  for (const [actor,target] of [['carrier','cargo'],['cargo','carrier']]) {
    g.run(`view.actorId=${actor}.id;chooseHex(${target}.x,${target}.y);renderTargetCard(projected(),${actor})`);
    await g.run("card.children.flatMap(node=>node.children).find(node=>node.id==='v2-action-execute').onclick()");
    assert.equal(g.run('cargo.embarkedOn'), forward.carrierId);
    assert.equal(g.run('phaseCommands.length'), 1);
    assert.equal(g.run('phaseCommands[0].label'), 'Verladen');
    assert.equal(g.rolls(), 0);
    const blocked = read(g, "options(carrier,{x:0,y:7}).find(entry=>entry.command.type==='Unload')");
    assert.equal(blocked.transport, true);
    assert.equal(read(g, `query(${JSON.stringify(blocked.command)})`).code, 'CARGO_TURN');
    g.run('view.actorId=carrier.id;chooseHex(0,7);renderTargetCard(projected(),carrier)');
    assert.equal(g.run('view.actorId'), forward.carrierId);
    assert.equal(g.run('card.hidden'), false);
    assert.match(g.run("card.children.find(node=>node.className==='v2-target-blocked').text"), /selben Zug/);
    assert.ok(!read(g, 'areaData(projected(),carrier,"movement").unload').some(cell => cell.x === 0 && cell.y === 7));
    g.run('undoPhaseCommand()');
    assert.equal(g.state(), before);
    g.run("globalThis.cargo=units.find(u=>u.id==='catalog-full-atlas-17'); globalThis.carrier=units.find(u=>u.id==='catalog-full-atlas-12')");
  }
  assert.equal(execute(g, reverse).ok, true);
  enemy(g);
  const rolls = g.rolls();
  const available = read(g, "options(carrier,{x:0,y:7}).find(entry=>entry.command.type==='Unload')").command;
  assert.ok(read(g, 'areaData(projected(),carrier,"movement").unload').some(cell => cell.x === 0 && cell.y === 7));
  assert.equal(execute(g, available).ok, true);
  assert.equal(g.run('cargo.embarkedOn'), null);
  assert.equal(g.rolls(), rolls);
});

test('a deployed Forge drone can be loaded through either direction into the same bay', async () => {
  const g = await fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
  g.run(readFileSync(new URL('../catalog-specialists-ui.js', import.meta.url), 'utf8'));
  g.run(`const forge=units.find(u=>u.id==='catalog-full-atlas-18');
    const drone=units.find(u=>u.id===forge.id+'-drone-1');
    const state=()=>({units:GoblinCatalogFullRuntime.roster(),turnPhase});
    const options=(actor,target)=>GoblinSpecialistsUI.commands(state(),actor,{x:target.x,y:target.y});`);
  const deploy = read(g, "options(forge,{x:1,y:2}).find(entry=>entry.command.bayId==='bay-1').command");
  assert.equal(execute(g, deploy).ok, true);
  enemy(g);
  const forward = read(g, "options(drone,forge).find(entry=>entry.command.type==='CatalogLoad'&&entry.command.bayId==='bay-1').command");
  const reverse = read(g, "options(forge,drone).find(entry=>entry.command.type==='CatalogLoad'&&entry.command.bayId==='bay-1').command");
  assert.deepEqual(reverse, forward);
  const rolls = g.rolls();
  assert.equal(execute(g, reverse).ok, true);
  assert.equal(g.run('drone.embarkedOn'), reverse.carrierId);
  assert.equal(g.run('drone.cargoBay'), 'bay-1');
  assert.equal(g.rolls(), rolls);
});
