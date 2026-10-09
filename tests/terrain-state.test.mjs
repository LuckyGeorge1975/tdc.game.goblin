import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, referenceScenario, REFERENCE_SEED, replayReference, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {hasLineOfSight, movementPaths, terrainAt} from '../src/core/hex.mjs';
import TerrainRules from '../terrain-rules.js';
import {TERRAIN_STATE_SCHEMA_VERSION, snapshotTerrainState, validateTerrainState, projectTerrainStateForProbe} from '../src/core/terrain-state.mjs';

const stateWith = (state, snapshot) => ({...state, map: {
  width: snapshot.width, height: snapshot.height, terrain: snapshot.terrain
}});

test('versioned terrain snapshots own serializable, frozen cells', () => {
  const source = structuredClone(referenceScenario.map);
  const snapshot = snapshotTerrainState(source);
  assert.equal(snapshot.schemaVersion, TERRAIN_STATE_SCHEMA_VERSION);
  assert.deepEqual(snapshot.terrain, source.terrain);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.terrain));
  assert.ok(snapshot.terrain.every(Object.isFrozen));
  source.terrain[0].type = 'open-ground';
  source.terrain.push({x: 0, y: 0, type: 'road'});
  assert.equal(snapshot.terrain[0].type, 'mountain');
  assert.equal(snapshot.terrain.length, 2);
  assert.deepEqual(validateTerrainState(JSON.parse(JSON.stringify(snapshot))), snapshot);
});

test('one isolated changed cell recomputes existing movement, cover and intermediate LOS', () => {
  const game = createGame(referenceScenario, REFERENCE_SEED);
  const original = JSON.stringify(game);
  const base = snapshotTerrainState(game.map);
  const changed = projectTerrainStateForProbe(base, [{x: 2, y: 3, type: 'open-ground'}]);
  const before = stateWith(game, base), after = stateWith(game, changed);
  const unit = game.units.find(value => value.id === 'p-1');
  const probe = state => ({
    moveCost: movementPaths(state, unit).get('2,3')?.cost,
    cover: TerrainRules.coverBonus(terrainAt(state, {x: 2, y: 3})),
    lineOfSight: hasLineOfSight(state, {x: 1, y: 3}, {x: 3, y: 3})
  });
  assert.deepEqual(probe(before), {moveCost: 2, cover: 1, lineOfSight: false});
  assert.deepEqual(probe(after), {moveCost: 1, cover: 0, lineOfSight: true});
  assert.deepEqual(probe(stateWith(game, validateTerrainState(JSON.parse(JSON.stringify(changed))))),
    {moveCost: 1, cover: 0, lineOfSight: true});
  assert.deepEqual(changed.terrain.filter(cell => cell.x === 6 && cell.y === 3),
    base.terrain.filter(cell => cell.x === 6 && cell.y === 3));
  assert.equal(game.rng.state, REFERENCE_SEED);
  assert.equal(JSON.stringify(game), original);
  assert.equal(base.terrain[0].type, 'mountain');
  assert.deepEqual(projectTerrainStateForProbe(base, [{x: 2, y: 3, type: 'open-ground'}]), changed);
});

test('invalid snapshots and replacement sets fail without changing inputs', () => {
  const base = snapshotTerrainState(referenceScenario.map);
  const invalidMaps = [
    {...base, schemaVersion: undefined},
    {...base, schemaVersion: 2},
    {...base, width: 0},
    {...base, terrain: [{x: 2, y: 3, type: 'unknown'}]},
    {...base, terrain: [{x: -1, y: 3, type: 'mountain'}]},
    {...base, terrain: [{x: 12, y: 3, type: 'mountain'}]},
    {...base, terrain: [base.terrain[0], base.terrain[0]]},
    {...base, terrain: [{x: 2.5, y: 3, type: 'mountain'}]},
    {...base, terrain: [{x: 2, y: 3, type: 'mountain', extra: true}]}
  ];
  for (const candidate of invalidMaps) {
    const before = JSON.stringify(candidate);
    assert.throws(() => validateTerrainState(candidate), error => !!error.code);
    assert.equal(JSON.stringify(candidate), before);
  }
  const changes = [
    [{x: 2, y: 3, type: 'unknown'}],
    [{x: 12, y: 3, type: 'road'}],
    [{x: 2, y: 3, type: 'road'}, {x: 2, y: 3, type: 'forest'}],
    [{x: 2, y: 3, type: 'road', extra: true}]
  ];
  for (const candidate of changes) {
    const before = JSON.stringify(candidate), baseBefore = JSON.stringify(base);
    assert.throws(() => projectTerrainStateForProbe(base, candidate), error => !!error.code);
    assert.equal(JSON.stringify(candidate), before);
    assert.equal(JSON.stringify(base), baseBefore);
  }
});

test('inactive snapshots leave historical replay oracles untouched', () => {
  const reference = JSON.stringify(replayReference());
  const phase = JSON.stringify(replayPhase());
  snapshotTerrainState(referenceScenario.map);
  projectTerrainStateForProbe(snapshotTerrainState(referenceScenario.map),
    [{x: 2, y: 3, type: 'open-ground'}]);
  assert.equal(JSON.stringify(replayReference()), reference);
  assert.equal(JSON.stringify(replayPhase()), phase);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
