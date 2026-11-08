import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createIronDustBrowserSession} from '../iron-dust-browser-v2.mjs';
import {buildIronDustV2View} from '../iron-dust-v2-view.mjs';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';

const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const section = (start, end) => ui.slice(ui.indexOf(start), ui.indexOf(end, ui.indexOf(start)));
const planning = section('    function planningWeapons(', '    function freeRatioChipCenter(');
const intelStats = section('        const max = key =>', "        const systems = el('div', 'v2-intel-systems')");
const mapSource = readFileSync(new URL('../game.js', import.meta.url), 'utf8')
  .match(/^function (?:hexNeighbors|dist)\([^\r\n]+/gm).join('\n');
const label = (key, values = {}) => [key, values.name, values.range, values.budget].filter(value => value !== undefined).join(' ');

test('Core planning uses the longest ready weapon, falls back when disabled, and needs no command query', () => {
  const session = createIronDustBrowserSession();
  const state = buildIronDustV2View(session.projection, session.profile.header.ruleProfileId);
  const actor = state.units.find(unit => unit.id === 'ogre');
  const before = JSON.stringify(session);
  const context = {core: () => true, t: label};
  for (const path of ['unit-life.js', 'terrain-rules.js', 'ogre-systems.js']) {
    runInNewContext(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), context);
  }
  context.unitAlive = context.GoblinUnitLife.alive;
  runInNewContext(mapSource + '\n' + planning, context);
  assert.match(context.planningArea(state, actor, 'fire').label, /^v2.plan.fire v2.ui.weapon.missiles 5$/);
  const statsContext = {state,unit:actor,t:(key,params)=>params?.weapon??key,statGrid:cells=>cells,
    section:{append(cells){this.cells=cells}}};
  runInNewContext('const treads = null;\n' + intelStats, statsContext);
  assert.deepEqual(Array.from(statsContext.section.cells[2].slice(0,2)), ['v2.ui.weapon.main',3]);
  const spent = structuredClone(actor);
  spent.ogreSystems.weapons.missiles.remaining = 0;
  assert.match(context.planningArea(state, spent, 'fire').label, /^v2.plan.fire v2.ui.weapon.main 3$/);
  spent.disabled = true;
  const fire = context.planningArea({...state, turnPhase: 'fire'}, spent, 'fire');
  assert.match(fire.label, /^v2.plan.fireSpent v2.ui.weapon.main 3$/);
  assert.ok(fire.cells.length > 0);
  const move = context.planningArea({...state, turnPhase: 'fire', units: []}, spent, 'movement');
  assert.ok(move.cells.some(cell => cell.x === 3 && cell.y === 3));
  assert.equal(move.label, 'v2.plan.movement 3');
  assert.deepEqual(context.planningArea({...state, turnPhase: 'fire'}, spent, 'movement').cells, move.cells);
  assert.equal(JSON.stringify(session), before);
});

test('System Duel intel names the selected slot while planning keeps the longest ready weapon', async () => {
  const g = await fullScene('catalog-full-siege', 7, false, 'FULL_CATALOG_v1');
  const before = g.state();
  g.run(`
    ${planning}
    const runtime=units.find(unit=>unit.team==='player'&&unit.catalogId==='U01');
    const unit={...runtime,...GoblinSpecialistsRuntime.projectUnit(runtime)};
    const state={units:[unit],turn,turnPhase};
    const treads=null,statGrid=cells=>cells;
    const section={append(cells){this.range=cells[2]}};
    globalThis.GoblinLanguage={t:(key,params)=>params?.class??key};
    {
      const t=(key,params)=>params?.weapon??key;
      ${intelStats}
    }
  `);
  assert.equal(g.run('section.range[0]'),'v2.ui.weapon.main');
  assert.equal(g.run('section.range[1]'),3);
  assert.equal(g.run("planningArea(state,unit,'fire').label"),'v2.plan.fire');
  assert.ok(g.run("planningWeapons(unit,runtime,turn).some(weapon=>weapon.range===5&&weapon.ready)"));
  assert.equal(g.state(),before);
  assert.equal(g.rolls(),0);
});

test('Full and Legacy planning use their own weapon profile, ammo and terrain without changing world or RNG', async () => {
  const g = await fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
  g.run(planning);
  g.run(`const planActor=id=>units.find(u=>u.catalogId===id&&u.team==='player');
    const planState=()=>({turn,turnPhase,units:GoblinCatalogFullRuntime.roster()});
    const plan=(id,mode)=>planningArea(planState(),planActor(id),mode);`);
  const before = g.state(), full = read(g, 'GoblinCatalogFullRuntime.snapshot()'), rolls = g.rolls();
  assert.match(read(g, "plan('U01','fire').label"), /v2.plan.fire/);
  const missile = read(g, `(() => {
    const actor=planActor('U13');
    return planningArea(planState(),{...actor,...GoblinSpecialistsRuntime.projectUnit(actor)},'fire');
  })()`);
  assert.equal(missile.label, 'v2.plan.fire');
  assert.ok(missile.cells.some(cell => cell.x === 4 && cell.y === 0));
  assert.deepEqual(read(g, `(() => {
    const actor=planActor('U13');
    return planningWeapons({...actor,...GoblinSpecialistsRuntime.projectUnit(actor)},{...actor,ammunition:0},turn);
  })()`), [{name:'v2.ui.missile',range:8,ready:false}]);
  for (const [asset, range] of [['long-range-battery', 8], ['mobile-siege-gun', 6]]) {
    const weapon = read(g, `(() => {
      const actor=units.find(unit=>unit.team==='player'&&unit.catalogAssetId===${JSON.stringify(asset)});
      return planningWeapons(actor,actor,turn)[0];
    })()`);
    assert.deepEqual(weapon, {name:'v2.plan.artillery',range,ready:true});
  }
  assert.equal(g.state(), before);
  assert.deepEqual(read(g, 'GoblinCatalogFullRuntime.snapshot()'), full);
  assert.equal(g.rolls(), rolls);
  g.run("loadScenario('iron-dust')");
  assert.equal(read(g, "planningArea({turn,turnPhase},units[0],'fire').label"), 'v2.plan.fire');
  assert.ok(read(g, "planningArea({turn,turnPhase},units[0],'movement').cells").length > 0);
});

test('explicit display choice survives phase changes and grid differs from planning and transport', () => {
  const context = {view: {areaMode: null}, clearContext() {}};
  runInNewContext('let areaPhase = null;\n' + section('    function syncAreaPhase(', '    function areaQuery('), context);
  const movement = {phase: 'player', turnPhase: 'movement'}, fire = {...movement, turnPhase: 'fire'};
  context.syncAreaPhase(movement);
  assert.equal(context.activeAreaMode(movement), 'movement');
  context.view.areaMode = 'fire';
  assert.equal(context.activeAreaMode(movement), 'fire');
  context.syncAreaPhase(fire);
  assert.equal(context.activeAreaMode(fire), 'fire');
  context.view.areaMode = 'none';
  context.syncAreaPhase(movement);
  assert.equal(context.activeAreaMode(movement), null);
  assert.match(ui, /if \(kind === 'movement' \|\| shown.has\(kind\)/);

  const css = readFileSync(new URL('../ui-v2.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css.match(/\.v2-grid-line \{[^}]+}/)[0], /stroke-dasharray/);
  assert.match(css, /\.v2-area-edge-plan \{[^}]*stroke-dasharray/);
  assert.match(css, /\.v2-area-unload \{[^}]*stroke-dasharray/);
});
