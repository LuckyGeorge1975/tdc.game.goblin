import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import TerrainRules from '../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, validateIronDustLegacyLosProbeV1,
  hasIronDustLegacyLineOfSight} from '../src/core/iron-dust-legacy-los-probe.mjs';
import {supercoverIntermediateHexes} from '../src/core/supercover-line.mjs';
import {createGame, dispatch, queryCommand, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';
import {makeIronDustGevProbeScenario} from '../src/core/iron-dust-gev-probe.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const A = (x, y) => ({x, y});

// Execute the actual named Legacy functions as an independent parity oracle.
function legacyLineOfSight() {
  const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  const names = ['terrainTypeAt', 'hexCenter', 'nearestHex', 'legacyLosSampleCount', 'lineOfSight'];
  const functions = names.map(name => {
    const start = game.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `Legacy function ${name} exists`);
    const opening = game.indexOf('{', start);
    let depth = 0;
    for (let i = opening; i < game.length; i++) {
      if (game[i] === '{') depth++;
      if (game[i] === '}' && --depth === 0) return game.slice(start, i + 1);
    }
    throw new Error(`unclosed Legacy function ${name}`);
  });
  const map = IRON_DUST_CORE_DATA_V1.map;
  const context = vm.createContext({TerrainRules});
  vm.runInContext(`const W=12,H=8,S=34,DX=Math.sqrt(3)*S,DY=1.5*S;
    const terrain=new Set(${JSON.stringify(map.terrain.map(cell => `${cell.x},${cell.y}`))});
    let terrainTypes=new Map();
    const legacySession=Object.freeze({ruleProfileId:'FIELD_TEST_LEGACY_v1',effectiveRules:Object.freeze({})});
    ${functions.join('\n')}`, context);
  return vm.runInContext('lineOfSight', context);
}

test('the inactive LOS probe binds the exact Iron Dust terrain and never authorizes Core or replay', () => {
  const probe = IRON_DUST_LEGACY_LOS_PROBE_V1;
  assert.equal(validateIronDustLegacyLosProbeV1(plain(probe)), probe);
  assert.deepEqual(plain(probe.map), plain(IRON_DUST_CORE_DATA_V1.map));
  assert.equal(probe.executable, false);
  assert.equal(probe.sourceRuleProfileId, 'FIELD_TEST_LEGACY_v1');
  assert.equal(probe.losMode, 'legacy-pixel-sample-8-v1');
  assert.equal(Object.isFrozen(probe), true);
  assert.equal(Object.isFrozen(probe.map.terrain[0]), true);
  assert.equal(probe.map.terrain.length, 8);
  for (const cell of probe.map.terrain) {
    assert.equal(cell.type, 'rubble-field');
    assert.equal(TerrainRules.movementCost(cell.type, 'tracked'), 2);
    assert.equal(TerrainRules.coverBonus(cell.type), 1);
    assert.equal(TerrainRules.blocksLos(cell.type), true);
  }
  assert.equal(TerrainRules.movementCost(probe.map.defaultTerrain, 'tracked'), 1);
  assert.equal(TerrainRules.blocksLos(probe.map.defaultTerrain), false);
  assert.throws(() => createGame(probe, 5), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(probe, 5, []), {code: 'REPLAY_PROFILE_MISMATCH'});
});

test('fixed bidirectional Iron Dust vectors match live Legacy pixel sampling', () => {
  const legacy = legacyLineOfSight(), probe = IRON_DUST_LEGACY_LOS_PROBE_V1;
  const vectors = [
    [A(0, 0), A(4, 0), true],          // open center crossing
    [A(0, 0), A(4, 1), false],         // rubble at 3,1 blocks an intermediate cell
    [A(2, 0), A(6, 1), true],          // boundary: pixel Legacy permits, supercover blocks
    [A(0, 4), A(2, 4), false],         // rubble at 1,4 blocks
    [A(1, 4), A(1, 3), true],          // obstructing terrain is the endpoint
    [A(3, 1), A(3, 0), true],          // obstructing terrain is the origin
    [A(8, 1), A(10, 2), true]          // separate edge region
  ];
  for (const [from, to, expected] of vectors) {
    for (const [a, b] of [[from, to], [to, from]]) {
      assert.equal(legacy(a, b), expected, `Legacy ${JSON.stringify([a, b])}`);
      assert.equal(hasIronDustLegacyLineOfSight(probe, a, b), expected,
        `Core probe ${JSON.stringify([a, b])}`);
    }
  }
  const blocked = new Set(probe.map.terrain.map(cell => `${cell.x},${cell.y}`));
  assert.ok(supercoverIntermediateHexes(A(2, 0), A(6, 1))
    .some(cell => blocked.has(`${cell.x},${cell.y}`)), 'v4 has a distinct boundary policy');
});

test('unknown mode, changed terrain and invalid points fail without altering the probe', () => {
  for (const change of [
    value => {value.probeVersion = 'other'},
    value => {value.sourceRuleProfileId = 'FULL_CATALOG_v1'},
    value => {value.executable = true},
    value => {value.losMode = 'strict-supercover'},
    value => {value.map.terrain[0].type = 'open-ground'},
    value => {value.map.width = 11}
  ]) {
    const candidate = plain(IRON_DUST_LEGACY_LOS_PROBE_V1);
    change(candidate);
    const before = JSON.stringify(candidate);
    assert.throws(() => hasIronDustLegacyLineOfSight(candidate, A(0, 0), A(4, 0)),
      {code: 'LOS_PROBE_MISMATCH'});
    assert.equal(JSON.stringify(candidate), before);
  }
  const probe = IRON_DUST_LEGACY_LOS_PROBE_V1, before = JSON.stringify(probe);
  for (const point of [A(-1, 0), A(12, 0), A(0, 8), {x: 1.5, y: 2}, null])
    assert.throws(() => hasIronDustLegacyLineOfSight(probe, point, A(0, 0)),
      {code: 'LOS_PROBE_INVALID_POINT'});
  assert.equal(JSON.stringify(probe), before);
});

test('Fire stays gated in the v5 movement probe, without state/RNG mutation', () => {
  const state = dispatch(createGame(makeIronDustGevProbeScenario(), 5),
    {type: 'EndPhase', playerId: 'player'}).state;
  const command = {type: 'Fire', playerId: 'player', unitId: 'gev', targetId: 'core'};
  const before = JSON.stringify(state);
  assert.equal(queryCommand(state, command).error.code, 'UNSUPPORTED_COMMAND');
  assert.equal(dispatch(state, command).error.code, 'UNSUPPORTED_COMMAND');
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.rng.state, 5);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
