import assert from 'node:assert/strict';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';

const atlas = () => fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
const readyIds = game => read(game, 'phaseReadyUnits().map(unit => unit.id)');
const uncachedReadyIds = game => read(game, 'units.filter(unit => phaseCanAct(unit)).map(unit => unit.id)');

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
