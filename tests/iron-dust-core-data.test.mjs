import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_LEVEL_V1} from '../src/levels/iron-dust.v1.mjs';
import {IRON_DUST_CORE_DATA_V1, adaptIronDustLevelV1, validateIronDustCoreDataV1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {createGame} from '../src/core/game-core.mjs';
import {recordProfileReplay} from '../src/core/replay-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function legacyIronDust() {
  const context = vm.createContext({});
  vm.runInContext(read('../ogre-systems.js'), context);
  const game = read('../game.js');
  vm.runInContext(game.slice(0, game.indexOf('let bootProfileError=')), context);
  return plain(vm.runInContext("scenarioCatalog['iron-dust']", context));
}

test('the inactive Core data view retains every Legacy unit, system and terrain cell', () => {
  const legacy = legacyIronDust();
  const data = adaptIronDustLevelV1(structuredClone(IRON_DUST_LEVEL_V1));
  assert.equal(data, IRON_DUST_CORE_DATA_V1);
  assert.equal(validateIronDustCoreDataV1(plain(data)), data);
  assert.deepEqual(plain(data.units), legacy.units);
  assert.deepEqual(plain(data.map), {
    width: 12, height: 8, defaultTerrain: 'open-ground',
    terrain: legacy.terrain.map(key => {
      const [x, y] = key.split(',').map(Number);
      return {x, y, type: 'rubble-field'};
    })
  });
  assert.deepEqual(
    [data.scenarioId, data.scenarioVersion, data.ruleProfileId, data.objectiveVersion, data.objective],
    ['iron-dust', legacy.scenarioVersion, legacy.ruleProfileId, legacy.objectiveVersion, legacy.objective]
  );
  assert.equal(data.sourceSchemaVersion, IRON_DUST_LEVEL_V1.schemaVersion);
  assert.deepEqual(plain(data.legacyTraitEvidence),
    [{unitId: 'gev', trait: 'gev', sourceField: 'id', sourceValue: 'gev'}]);
  assert.equal(data.units.find(unit => unit.id === 'gev').movementMode, undefined,
    'the Legacy source unit must not be rewritten as an executable Core unit');
});

test('the data view is deeply frozen and remains rejected by Core and replay', () => {
  const data = IRON_DUST_CORE_DATA_V1;
  for (const value of [data, data.map, data.map.terrain, data.map.terrain[0], data.units,
    ...data.units, data.units[0].ogreSystems, data.units[0].ogreSystems.weapons,
    ...Object.values(data.units[0].ogreSystems.weapons), data.legacyTraitEvidence,
    data.legacyTraitEvidence[0]]) assert.ok(Object.isFrozen(value));
  assert.equal(data.executable, false);
  assert.equal(Object.hasOwn(data, 'rulesVersion'), false);
  assert.equal(Object.hasOwn(data, 'effectiveRules'), false);
  assert.throws(() => createGame(data, 1), {code: 'UNSUPPORTED_RULE_PROFILE'});
  assert.throws(() => recordProfileReplay(data, 1, []), {code: 'REPLAY_PROFILE_MISMATCH'});
});

test('source and adapted data reject changed versions, profiles and systems', () => {
  for (const [change, error] of [
    [level => {level.schemaVersion = 2}, 'UNSUPPORTED_LEVEL_VERSION'],
    [level => {level.scenarioVersion = 2}, 'UNSUPPORTED_LEVEL_VERSION'],
    [level => {level.ruleProfileId = 'FULL_CATALOG_v1'}, 'UNSUPPORTED_LEVEL_PROFILE'],
    [level => {level.units[0].ogreSystems.weapons.missiles.remaining = 1}, 'LEVEL_DATA_MISMATCH'],
    [level => {level.units[1].id = 'other'}, 'LEVEL_DATA_MISMATCH'],
    [level => {level.terrain[0] = '0,0'}, 'LEVEL_DATA_MISMATCH']
  ]) {
    const candidate = structuredClone(IRON_DUST_LEVEL_V1);
    change(candidate);
    const before = plain(candidate);
    assert.throws(() => adaptIronDustLevelV1(candidate), {message: error});
    assert.deepEqual(plain(candidate), before);
  }
  for (const [change, error] of [
    [data => {data.dataContractVersion = 'other'}, 'UNSUPPORTED_DATA_VERSION'],
    [data => {data.sourceSchemaVersion = 2}, 'UNSUPPORTED_DATA_PROFILE'],
    [data => {data.ruleProfileId = 'FULL_CATALOG_v1'}, 'UNSUPPORTED_DATA_PROFILE'],
    [data => {data.executable = true}, 'UNSUPPORTED_DATA_PROFILE'],
    [data => {data.map.terrain[0].type = 'open-ground'}, 'DATA_SNAPSHOT_MISMATCH'],
    [data => {data.units[0].ogreSystems.treads = 44}, 'DATA_SNAPSHOT_MISMATCH'],
    [data => {data.legacyTraitEvidence[0].sourceField = 'movementMode'}, 'DATA_SNAPSHOT_MISMATCH'],
    [data => {data.rulesVersion = 'core-v3-profile-v1'}, 'DATA_SNAPSHOT_MISMATCH']
  ]) {
    const candidate = structuredClone(IRON_DUST_CORE_DATA_V1);
    change(candidate);
    const before = plain(candidate);
    assert.throws(() => validateIronDustCoreDataV1(candidate), {message: error});
    assert.deepEqual(plain(candidate), before);
  }
});
