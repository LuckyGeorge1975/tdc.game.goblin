import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IRON_DUST_LEVEL_V1, validateIronDustLevelV1} from '../src/levels/iron-dust.v1.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function legacyIronDust() {
  const context = vm.createContext({});
  vm.runInContext(read('../ogre-systems.js'), context);
  const game = read('../game.js');
  vm.runInContext(game.slice(0, game.indexOf('let bootProfileError=')), context);
  return plain(vm.runInContext("scenarioCatalog['iron-dust']", context));
}

test('Iron Dust v1 data exactly matches the built-in Legacy start', () => {
  const legacy = legacyIronDust();
  const level = plain(IRON_DUST_LEVEL_V1);
  assert.deepEqual(
    Object.fromEntries(['scenarioVersion', 'ruleProfileId', 'objectiveVersion', 'objective', 'terrain', 'units']
      .map(key => [key, level[key]])),
    Object.fromEntries(['scenarioVersion', 'ruleProfileId', 'objectiveVersion', 'objective', 'terrain', 'units']
      .map(key => [key, legacy[key]]))
  );
  assert.equal(level.id, 'iron-dust');
  assert.equal(level.width, 12);
  assert.equal(level.height, 8);
  assert.equal(level.defaultTerrain, 'open-ground');
  assert.equal(level.terrain.length, 8);
  assert.equal(level.units.length, 7);
  assert.equal(new Set(level.units.map(unit => unit.id)).size, 7);
  assert.equal(new Set(level.units.map(unit => `${unit.x},${unit.y}`)).size, 7);
  assert.ok(level.units.every(unit => unit.x >= 0 && unit.x < 12 && unit.y >= 0 && unit.y < 8));
  assert.equal(level.units.filter(unit => unit.team === 'enemy' && unit.core).length, 1);
});

test('the accepted snapshot and nested system state are immutable', () => {
  assert.equal(validateIronDustLevelV1(structuredClone(IRON_DUST_LEVEL_V1)), IRON_DUST_LEVEL_V1);
  const ogre = IRON_DUST_LEVEL_V1.units[0];
  for (const value of [IRON_DUST_LEVEL_V1, IRON_DUST_LEVEL_V1.terrain,
    IRON_DUST_LEVEL_V1.units, ogre, ogre.ogreSystems, ogre.ogreSystems.weapons,
    ...Object.values(ogre.ogreSystems.weapons)]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {ogre.ogreSystems.weapons.missiles.remaining = 0}, TypeError);
});

test('unknown versions and profiles fail closed without altering the candidate', () => {
  for (const [change, code] of [
    [level => {level.schemaVersion = 2}, 'UNSUPPORTED_LEVEL_VERSION'],
    [level => {level.scenarioVersion = 2}, 'UNSUPPORTED_LEVEL_VERSION'],
    [level => {level.objectiveVersion = 2}, 'UNSUPPORTED_LEVEL_VERSION'],
    [level => {level.ruleProfileId = 'FULL_CATALOG_v1'}, 'UNSUPPORTED_LEVEL_PROFILE'],
    [level => {level.id = 'relay-run'}, 'UNSUPPORTED_LEVEL_PROFILE'],
    [level => {level.objective = 'core-and-escort'}, 'UNSUPPORTED_LEVEL_PROFILE'],
    [level => {delete level.units[0].ogreSystems}, 'LEVEL_DATA_MISMATCH'],
    [level => {level.units[1].move = 4}, 'LEVEL_DATA_MISMATCH'],
    [level => {level.terrain.push('0,0')}, 'LEVEL_DATA_MISMATCH']
  ]) {
    const candidate = structuredClone(IRON_DUST_LEVEL_V1);
    change(candidate);
    const before = plain(candidate);
    assert.throws(() => validateIronDustLevelV1(candidate), {message: code});
    assert.deepEqual(plain(candidate), before);
  }
});
