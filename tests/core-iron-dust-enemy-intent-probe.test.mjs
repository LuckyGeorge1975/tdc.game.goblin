import {lifeGlobals} from './helpers/unit-life-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import TerrainRules from '../terrain-rules.js';
import {IRON_DUST_CORE_DATA_V1} from '../src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEGACY_LOS_PROBE_V1, hasIronDustLegacyLineOfSight} from
  '../src/core/iron-dust-legacy-los-probe.mjs';
import {createIronDustUnifiedStateProbe, validateIronDustUnifiedStateProbe} from
  '../src/core/iron-dust-unified-state-probe.mjs';
import {queryIronDustEnemyIntent, IRON_DUST_ENEMY_INTENT_VERSION} from
  '../src/core/iron-dust-enemy-intent-probe.mjs';
import {hexDistance} from '../src/core/hex.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const ogreSystems = readFileSync(new URL('../ogre-systems.js', import.meta.url), 'utf8');
function extract(name, last = false) {
  const start = last ? game.lastIndexOf(`function ${name}(`) : game.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0, quoted = null, escaped = false;
  const opening = game.indexOf('{', start);
  for (let i = opening; i < game.length; i++) {
    const ch = game[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quoted) quoted = null;
    } else if (ch === '"' || ch === "'" || ch === '`') quoted = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return game.slice(start, i + 1);
  }
  throw new Error(`unclosed ${name}`);
}

function legacy(changes = {}) {
  const units = clone(IRON_DUST_CORE_DATA_V1.units);
  for (const [id, change] of Object.entries(changes)) Object.assign(units.find(u => u.id === id), change);
  const shots = [], map = IRON_DUST_CORE_DATA_V1.map;
  const context = vm.createContext({...lifeGlobals,units, W: map.width, H: map.height,
    terrain: new Set(map.terrain.map(cell => `${cell.x},${cell.y}`)),
    movementCost(unit, key) {
      const [x, y] = key.split(',').map(Number);
      const type = map.terrain.find(cell => cell.x === x && cell.y === y)?.type ?? map.defaultTerrain;
      return TerrainRules.movementCost(type, unit);
    },
    lineOfSight: (a, b) => hasIronDustLegacyLineOfSight(IRON_DUST_LEGACY_LOS_PROBE_V1, a, b),
    combatOutcome: (a, b) => {shots.push([a.id, b.id]); return {result: 'NE', ratio: '1-1'}},
    addLog() {}, reportPassengerHits() {}, setTimeout() {}, draw() {}, turn: 1
  });
  vm.runInContext(ogreSystems, context);
  vm.runInContext(['hexNeighbors', 'dist', 'findEnemyStep', 'recoverDisabled']
    .map(name => extract(name)).join('\n') + '\n' + extract('enemyFire', true), context);
  return {units, shots, context, fire: id => vm.runInContext(`enemyFire(units.find(u=>u.id==='${id}'))`, context),
    step: (id, targetId) => clone(vm.runInContext(
      `findEnemyStep(units.find(u=>u.id==='${id}'),units.find(u=>u.id==='${targetId}'))`, context)),
    targetKey: () => vm.runInContext("GoblinSystems.chooseTarget(units.find(u=>u.id==='ogre').ogreSystems).key", context)};
}

test('Legacy oracle pins source move, close fire, retry fire and blocked nearer target', () => {
  const a = legacy();
  assert.equal(a.fire('guard'), false);
  assert.equal(a.fire('raider'), false);
  assert.deepEqual({x: a.step('guard', 'missile').x, y: a.step('guard', 'missile').y}, {x: 8, y: 4});
  assert.deepEqual({x: a.step('raider', 'missile').x, y: a.step('raider', 'missile').y}, {x: 8, y: 6});
  const b = legacy({guard: {x: 2, y: 5}});
  assert.equal(b.fire('guard'), true);
  assert.deepEqual(b.shots, [['guard', 'ogre']]);
  assert.equal(b.targetKey(), 'missiles');
  const c = legacy({guard: {x: 5, y: 5}});
  assert.equal(c.fire('guard'), false);
  const step = c.step('guard', 'missile');
  assert.deepEqual({x: step.x, y: step.y}, {x: 5, y: 6});
  Object.assign(c.units.find(u => u.id === 'guard'), {x: step.x, y: step.y});
  assert.equal(c.fire('guard'), true);
  assert.deepEqual(c.shots, [['guard', 'missile']]);
  const f = legacy({guard: {x: 0, y: 4}});
  assert.equal(f.fire('guard'), true);
  assert.deepEqual(f.shots, [['guard', 'infantry']]);
});

test('Legacy oracle pins disabled recovery and live roster target update', () => {
  const d = legacy({guard: {disabled: true, disabledUntil: 2}});
  assert.equal(d.fire('guard'), false);
  vm.runInContext("recoverDisabled('enemy')", d.context);
  assert.equal(d.units.find(u => u.id === 'guard').disabled, true);
  d.context.turn = 2;
  vm.runInContext("recoverDisabled('enemy')", d.context);
  assert.equal(d.units.find(u => u.id === 'guard').disabled, false);
  const e = legacy({guard: {x: 1, y: 4}, raider: {x: 2, y: 5}});
  assert.equal(e.fire('guard'), true);
  e.units.find(u => u.id === 'ogre').hp = 0;
  assert.equal(e.fire('raider'), true);
  assert.deepEqual(e.shots, [['guard', 'ogre'], ['raider', 'gev']]);
});

const request = (actorId, stage, claim = 'auto') =>
  ({type: 'EnemyIntent', playerId: 'enemy', actorId, stage, claim});
function probe(changes = {}, fixture = 'source') {
  const state = clone(createIronDustUnifiedStateProbe(17, {fixture}));
  state.activeTeam = 'enemy'; state.phase = 'enemy';
  for (const [id, change] of Object.entries(changes))
    Object.assign(state.units.find(unit => unit.id === id), change);
  validateIronDustUnifiedStateProbe(state);
  return state;
}

test('intent matches Legacy A-C and F without changing state or RNG', () => {
  const a = probe(), before = JSON.stringify(a);
  assert.equal(a.executable, false);
  assert.equal(queryIronDustEnemyIntent(a, request('guard', 'first-fire')).kind, 'continue');
  assert.equal(queryIronDustEnemyIntent(a, request('guard', 'first-fire', 'pass')).error.code,
    'PASS_FORBIDDEN');
  for (const [actorId, targetId, to, cost] of [
    ['guard', 'missile', {x: 8, y: 4}, 1],
    ['raider', 'missile', {x: 8, y: 6}, 2]
  ]) {
    const result = queryIronDustEnemyIntent(a, request(actorId, 'move'));
    assert.equal(result.resolverVersion, IRON_DUST_ENEMY_INTENT_VERSION);
    assert.deepEqual([result.kind, result.targetId, result.to, result.cost],
      ['move', targetId, to, cost]);
    assert.equal(queryIronDustEnemyIntent(a, request(actorId, 'move', 'pass')).error.code,
      'PASS_FORBIDDEN');
  }
  assert.equal(JSON.stringify(a), before);
  const afterMove = probe({guard: {x: 8, y: 4, moved: true}});
  assert.equal(queryIronDustEnemyIntent(afterMove, request('guard', 'retry-fire', 'pass')).kind,
    'pass');
  const b = probe({}, 'adjacent');
  const shot = queryIronDustEnemyIntent(b, request('guard', 'first-fire'));
  assert.deepEqual([shot.kind, shot.targetId, shot.targetKey, shot.command.type],
    ['fire', 'ogre', 'missiles', 'EnemySystemAttack']);
  assert.equal(queryIronDustEnemyIntent(b, request('guard', 'move')).error.code,
    'FIRE_AVAILABLE');
  assert.equal(queryIronDustEnemyIntent(b, request('guard', 'first-fire', 'pass')).error.code,
    'PASS_FORBIDDEN');
  const c = probe({guard: {x: 5, y: 5}});
  assert.equal(queryIronDustEnemyIntent(c, request('guard', 'first-fire')).kind, 'continue');
  assert.deepEqual(queryIronDustEnemyIntent(c, request('guard', 'move')).to, {x: 5, y: 6});
  Object.assign(c.units.find(unit => unit.id === 'guard'), {x: 5, y: 6, moved: true});
  validateIronDustUnifiedStateProbe(c);
  assert.deepEqual(queryIronDustEnemyIntent(c, request('guard', 'retry-fire')).command,
    {type: 'EnemyUnitAttack', playerId: 'enemy', attackerId: 'guard', targetId: 'missile'});
  const f = probe({guard: {x: 0, y: 4}});
  assert.equal(queryIronDustEnemyIntent(f, request('guard', 'first-fire')).targetId, 'infantry');
});

test('intent matches Legacy disabled and live-target vectors', () => {
  const d = probe({guard: {disabled: true, disabledUntil: 2}});
  assert.deepEqual(queryIronDustEnemyIntent(d, request('guard', 'first-fire')).command,
    {type: 'EnemyPass', playerId: 'enemy', actorId: 'guard'});
  assert.equal(queryIronDustEnemyIntent(d, request('guard', 'move')).error.code, 'STALE_STAGE');
  d.turn = 2; d.units.find(unit => unit.id === 'guard').disabled = false;
  d.units.find(unit => unit.id === 'guard').disabledUntil = 0;
  validateIronDustUnifiedStateProbe(d);
  assert.equal(queryIronDustEnemyIntent(d, request('guard', 'first-fire')).kind, 'continue');
  const e = probe({guard: {x: 1, y: 4}, raider: {x: 2, y: 5}});
  assert.equal(queryIronDustEnemyIntent(e, request('guard', 'first-fire')).targetId, 'ogre');
  const ogre = e.units.find(unit => unit.id === 'ogre');
  ogre.hp = 0; ogre.ogreSystems.treads = 0;
  for (const weapon of Object.values(ogre.ogreSystems.weapons)) weapon.destroyed = weapon.count;
  validateIronDustUnifiedStateProbe(e);
  assert.equal(queryIronDustEnemyIntent(e, request('raider', 'first-fire')).targetId, 'gev');
});

test('forged actor, phase, stage and spent action fail closed', () => {
  const state = probe();
  assert.equal(queryIronDustEnemyIntent(state, {...request('core', 'first-fire')}).error.code,
    'ENEMY_ACTOR_FORBIDDEN');
  assert.equal(queryIronDustEnemyIntent(state, request('guard', 'retry-fire')).error.code,
    'STALE_STAGE');
  assert.equal(queryIronDustEnemyIntent(state, {...request('guard', 'move'), extra: 1}).error.code,
    'ENEMY_INTENT_REQUEST_INVALID');
  assert.equal(queryIronDustEnemyIntent(state, {...request('guard', 'move'), playerId: 'player'}).error.code,
    'NOT_ACTIVE_TEAM');
  state.enemyPassed.push('guard');
  assert.equal(queryIronDustEnemyIntent(state, request('guard', 'move')).error.code, 'ACTION_SPENT');
  assert.equal(queryIronDustEnemyIntent(createIronDustUnifiedStateProbe(17),
    request('guard', 'move')).error.code, 'NOT_ACTIVE_TEAM');
});

test('all free actor cells retain Legacy fire choice and FIFO movement ties', () => {
  const map = IRON_DUST_CORE_DATA_V1.map;
  for (const actorId of ['guard', 'raider']) for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const state = clone(createIronDustUnifiedStateProbe(17));
      const actor = state.units.find(unit => unit.id === actorId);
      if (state.units.some(unit => unit !== actor && unit.hp > 0 && unit.x === x && unit.y === y))
        continue;
      state.activeTeam = 'enemy'; state.phase = 'enemy';
      Object.assign(actor, {x, y});
      validateIronDustUnifiedStateProbe(state);
      const old = legacy({[actorId]: {x, y}});
      const fired = old.fire(actorId);
      const first = queryIronDustEnemyIntent(state, request(actorId, 'first-fire'));
      assert.equal(first.kind, fired ? 'fire' : 'continue', `${actorId} ${x},${y}`);
      if (fired) {
        assert.equal(first.targetId, old.shots[0][1], `${actorId} ${x},${y}`);
        continue;
      }
      const target = old.units.filter(unit => unit.team === 'player' && unit.hp > 0)
        .sort((a, b) => hexDistance(actor, a) - hexDistance(actor, b))[0];
      const expected = old.step(actorId, target.id);
      const move = queryIronDustEnemyIntent(state, request(actorId, 'move'));
      assert.equal(move.kind, expected ? 'move' : 'pass', `${actorId} ${x},${y}`);
      if (expected) assert.deepEqual([move.targetId, move.to, move.cost, move.path],
        [target.id, {x: expected.x, y: expected.y}, expected.cost, expected.path],
        `${actorId} ${x},${y}`);
    }
});
