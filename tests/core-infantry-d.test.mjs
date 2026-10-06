import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, dispatch, phaseScenario, replayPhase, expectedPhaseReplay} from '../src/core/game-core.mjs';

const fire = targetId => ({type: 'Fire', playerId: 'player', unitId: 'p-tank', targetId});
const end = playerId => ({type: 'EndPhase', playerId});
const target = (state, id) => state.units.find(unit => unit.id === id);
const scenarioWithTarget = (id, type, infantry) => {
  const scenario = structuredClone(phaseScenario);
  Object.assign(scenario.units.find(unit => unit.id === 'e-tank'), {id, type, infantry, hp: 2, maxHp: 2});
  return scenario;
};
const firstShot = (scenario, seed, id) => {
  const initial = createGame(scenario, seed);
  const firePhase = dispatch(initial, end('player')).state;
  return {initial, firePhase, result: dispatch(firePhase, fire(id))};
};

test('D reduces marked infantry HP by exactly one for all four approved scenario types', () => {
  const cases = [
    ['amphibious-infantry', 'AMPHIBIOUS INFANTRY'],
    ['infantry-squad', 'INFANTRY'],
    ['field-engineers', 'FIELD ENGINEERING'],
    ['infantry-platoon', 'INFANTRY'],
  ];
  for (const [name, type] of cases) {
    const id = `free-${name}`;
    const scenario = scenarioWithTarget(id, type, true);
    const first = firstShot(scenario, 5, id), second = firstShot(scenario, 5, id);
    assert.equal(JSON.stringify(first), JSON.stringify(second), name);
    assert.deepEqual(first.result.events[0], {
      type: 'ShotResolved', attackerId: 'p-tank', targetId: id,
      roll: 2, ratio: '1-1', result: 'D', hpBefore: 2, hpAfter: 1, disabled: false,
    }, name);
    assert.equal(target(first.result.state, id).hp, 1, name);
    assert.equal(target(first.result.state, id).disabled, false, name);
    assert.equal(target(first.result.state, id).disabledUntil, 0, name);
    assert.equal(first.result.state.rng.state, 1022226848, name);
    assert.equal(target(first.firePhase, id).hp, 2, 'dispatch leaves the prior state unchanged');
  }
});

test('an explicit non-infantry vehicle is disabled by D and destroyed by the next D', () => {
  const id = 'free-vehicle';
  let state = createGame(scenarioWithTarget(id, 'HOSTILE ARMOR', false), 10);
  state = dispatch(state, end('player')).state;
  const first = dispatch(state, fire(id));
  assert.equal(first.events[0].result, 'D');
  assert.equal(target(first.state, id).hp, 2);
  assert.equal(target(first.state, id).disabled, true);
  assert.equal(target(first.state, id).disabledUntil, 2);
  state = first.state;
  for (const playerId of ['player', 'player', 'enemy', 'enemy', 'enemy', 'player'])
    state = dispatch(state, end(playerId)).state;
  const second = dispatch(state, fire(id));
  assert.equal(second.events[0].result, 'D');
  assert.equal(target(second.state, id).hp, 0);
  assert.equal(target(second.state, id).disabled, true);
  assert.equal(second.events[0].hpAfter, 0);
});

test('rejected fire preserves state and RNG; historical full replay oracle stays byte-equal', () => {
  const {firePhase} = firstShot(scenarioWithTarget('free-infantry', 'AMPHIBIOUS INFANTRY', true), 5, 'free-infantry');
  const before = JSON.stringify(firePhase);
  const rejected = dispatch(firePhase, fire('missing-unit'));
  assert.equal(rejected.error.code, 'INVALID_TARGET');
  assert.equal(JSON.stringify(firePhase), before);
  assert.equal(JSON.stringify(replayPhase()), JSON.stringify(expectedPhaseReplay));
});
