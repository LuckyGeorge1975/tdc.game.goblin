import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fullScene} from './catalog-full-harness.mjs';
import {execute, read} from './artillery-product-harness.mjs';
import {targetOptionsSource} from './helpers/target-options-source.mjs';

const atlas = () => fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
const readyIds = game => read(game, 'phaseReadyUnits().map(unit => unit.id)');
const uncachedReadyIds = game => read(game, 'units.filter(unit => phaseCanAct(unit)).map(unit => unit.id)');

test('FULL fire areas reuse each actor only within the current rule revision', async () => {
  const game = await atlas();
  const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
  const cut = (start, end) => ui.slice(ui.indexOf(start), ui.indexOf(end, ui.indexOf(start)));
  game.run(`
    const GoblinLanguage={current:'de'};
    ${targetOptionsSource}
    ${cut('    const areaCache', '    let areaPhase')}
    ${cut('    function areaQuery(', '    function selectedFirePreview(')}
    let queries=0;
    const originalQuery=query;
    query=command=>{queries++;return originalQuery(command)};
    function drawArea(id){
      const state={revision:revision(),phase,turnPhase,gameOver,units:GoblinCatalogFullRuntime.roster()};
      const actor=state.units.find(unit=>unit.id===id),mode='fire';
      ${cut('      const key = JSON.stringify([core()', '      const hexWidth')}
      return data;
    }
    function startFire(){
      units.find(unit=>unit.id==='catalog-full-atlas-1').x=5;
      setTurnPhase('fire');
    }
    startFire();
  `);
  const siege = 'catalog-full-atlas-1', scout = 'catalog-full-atlas-2';
  const draw = id => read(game, `drawArea('${id}')`);
  const original = draw(siege);
  assert.ok(original.legal.length);
  draw(scout);
  game.run('queries=0');
  const before = game.state(), rng = game.rng();
  assert.deepEqual(draw(siege), original);
  assert.equal(game.run('queries'), 0);
  assert.equal(game.state(), before);
  assert.deepEqual(game.rng(), rng);

  const shot = read(game, `entriesAt({revision:revision(),phase,turnPhase,gameOver,units:GoblinCatalogFullRuntime.roster()},
    units.find(unit=>unit.id==='${siege}'), ${JSON.stringify(original.legal[0])}).find(entry=>entryResult(entry).ok).command`);
  assert.equal(execute(game, shot).ok, true);
  game.run('queries=0');
  draw(siege);
  assert.ok(game.run('queries') > 0);
  game.run('undoPhaseCommand(); queries=0');
  assert.deepEqual(draw(siege), original);
  assert.ok(game.run('queries') > 0);

  game.run("const hidden=units.find(unit=>unit.team==='enemy'&&!GoblinCatalogFullRuntime.known(unit.id)); GoblinCatalogFullRuntime.reveal(hidden.id,'own-fire'); queries=0");
  draw(siege);
  assert.ok(game.run('queries') > 0);
  game.run("setTurnPhase('gev')");
  assert.equal(draw(siege).status, 'phase');
  game.run("loadScenario('catalog-full-atlas'); startFire(); queries=0");
  assert.deepEqual(draw(siege), original);
  assert.ok(game.run('queries') > 0);
});

test('FULL readiness reuses scans across selection and refreshes after action and movement input changes', async () => {
  const game = await atlas();
  game.run(`
    globalThis.pathCalls = 0;
    const originalPath = findMovementPath;
    findMovementPath = (...args) => { pathCalls++; return originalPath(...args); };
  `);
  const original = readyIds(game);
  assert.ok(original.length > 1);
  const world = game.state(), rng = game.rng();
  game.run('pathCalls = 0; selected = phaseReadyUnits()[0]; phaseReadyUnits().pop()');
  assert.deepEqual(readyIds(game), original);
  assert.equal(game.run('pathCalls'), 0);
  game.run('selected = null');
  assert.equal(game.state(), world);
  assert.deepEqual(game.rng(), rng);

  game.run('globalThis.readyActor = phaseReadyUnits()[0]; readyActor.moved = true');
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
  assert.ok(!readyIds(game).includes(original[0]));
  game.run('readyActor.moved = false; readyActor.disabled = true');
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
  game.run("readyActor.disabled = false; readyActor.movementMode = 'fixed'");
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
  assert.ok(!readyIds(game).includes(original[0]));

  game.run("turnPhase = 'fire'");
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
  game.run('for (const unit of units) unit.fired = true');
  assert.deepEqual(readyIds(game), []);
  game.run("loadScenario('catalog-full-terrain-course')");
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
});

test('FULL visibility is reused per viewer and tracks sensor, reveal, clock and restored inputs', async () => {
  const game = await atlas();
  const roster = team => read(game, `GoblinCatalogFullRuntime.roster('${team}').map(unit => unit.id)`);
  const expected = team => read(game, `(() => {
    const full = GoblinCatalogFullRuntime, {visibility} = full.snapshot();
    return GoblinCatalogVisibility.project(visibility, '${team}', full.facts(visibility.teamFire), legacySession.effectiveRules.catalog.registry).knownIds;
  })()`);
  const check = () => {
    for (const team of ['player', 'enemy']) assert.deepEqual(roster(team), expected(team));
  };
  check();
  const originalPlayer = roster('player');
  game.run(`
    globalThis.losCalls = 0;
    const originalSight = lineOfSight;
    lineOfSight = (...args) => { losCalls++; return originalSight(...args); };
    GoblinCatalogFullRuntime.roster().pop();
  `);
  assert.deepEqual(roster('player'), originalPlayer);
  roster('enemy');
  assert.equal(game.run('losCalls'), 0);

  game.run(`
    globalThis.beforeVisibility = GoblinCatalogFullRuntime.snapshot();
    globalThis.hiddenEnemy = units.find(unit => unit.team === 'enemy' && !GoblinCatalogFullRuntime.known(unit.id));
    GoblinCatalogFullRuntime.reveal(hiddenEnemy.id, 'own-fire');
  `);
  assert.equal(game.run('GoblinCatalogFullRuntime.known(hiddenEnemy.id)'), true);
  check();
  game.run("GoblinCatalogFullRuntime.fireBoundary('player', true); GoblinCatalogFullRuntime.fireBoundary('player', false)");
  assert.equal(game.run('GoblinCatalogFullRuntime.known(hiddenEnemy.id)'), false);
  check();
  game.run('GoblinCatalogFullRuntime.restore(beforeVisibility)');
  assert.deepEqual(roster('player'), originalPlayer);

  game.run(`
    globalThis.observer = units.find(unit => unit.team === 'player' && unitAlive(unit) && !unit.embarkedOn);
    Object.assign(observer, hexNeighbors(hiddenEnemy.x, hiddenEnemy.y).find(cell => cell.x >= 0 && cell.x < W && cell.y >= 0 && cell.y < H));
  `);
  assert.equal(game.run('GoblinCatalogFullRuntime.known(hiddenEnemy.id)'), true);
  check();
  game.run('observer.disabled = true');
  assert.equal(game.run('GoblinCatalogFullRuntime.known(hiddenEnemy.id)'), false);
  check();
});

test('specialist readiness changes with ammo and engineering material at fixed positions', async () => {
  const game = await atlas();
  game.run(`
    turnPhase = 'fire';
    globalThis.missile = units.find(unit => unit.team === 'player' && unit.catalogId === 'U13');
  `);
  const missileId = game.run('missile.id');
  const revision = game.run('GoblinCatalogFullRuntime.commandRevision()');
  assert.ok(readyIds(game).includes(missileId));
  game.run('missile.ammunition = 0');
  assert.ok(!readyIds(game).includes(missileId));
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
  game.run('missile.ammunition = 1');
  assert.ok(readyIds(game).includes(missileId));
  assert.equal(game.run('GoblinCatalogFullRuntime.commandRevision()'), revision);

  game.run(`
    turnPhase = 'movement';
    globalThis.engineer = units.find(unit => unit.team === 'player' && !unit.catalogSystems &&
      GoblinSpecialistsRuntime.rules(unit).engineeringRef);
    engineer.movementMode = 'fixed';
    const site = hexNeighbors(engineer.x, engineer.y).find(({x, y}) => x >= 0 && x < W && y >= 0 && y < H &&
      !units.some(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === x && unit.y === y));
    terrainTypes.set(site.x + ',' + site.y, 'rubble-field');
    engineer.material = 0;
  `);
  const engineerId = game.run('engineer.id');
  assert.ok(!readyIds(game).includes(engineerId));
  game.run('engineer.material = engineer.materialMax');
  assert.ok(readyIds(game).includes(engineerId));
  assert.deepEqual(readyIds(game), uncachedReadyIds(game));
});
