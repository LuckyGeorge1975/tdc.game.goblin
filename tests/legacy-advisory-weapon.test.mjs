import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceEnemy, snapshot, trainingScene} from './training-product-harness.mjs';
import {execute} from './artillery-product-harness.mjs';

test('Legacy Iron Dust advisory follows a Siegebreaker weapon change through Undo and turn two', async () => {
  const observed = await trainingScene('iron-dust', true);
  const control = await trainingScene('iron-dust');
  const actions = [
    {type:'Move',actorId:'missile',x:4,y:6},
    {type:'Move',actorId:'ogre',x:4,y:4}
  ];
  const shot = {type:'Fire',actorId:'ogre',weaponKey:'missiles',x:8,y:3};
  for (const game of [observed, control]) {
    game.context.rollQueue = [0];
    for (const command of actions) assert.equal(execute(game, command).ok, true);
    game.run("setTurnPhase('fire')");
    assert.equal(execute(game, shot).ok, true);
    assert.equal(game.run("units.find(u=>u.id==='guard').lastOutcome"), 'NE');
    assert.equal(game.run('phaseCommands.length'), 1);
    game.run('undoPhaseCommand()');
    assert.equal(game.run('phaseCommands.length'), 0);
    assert.equal(execute(game, shot).ok, true);
    advanceEnemy(game);
    assert.equal(game.run("turn===2 && turnPhase==='movement' && phaseReadyUnits().length===4"), true);
    assert.equal(execute(game, {type:'Move',actorId:'ogre',x:4,y:5}).ok, true);
    game.run("setTurnPhase('fire')");
    assert.equal(game.run("turnPhase==='fire'"), true);
  }
  const withAdvisory = snapshot(observed);
  const withoutAdvisory = snapshot(control);
  assert.deepEqual(withAdvisory.world, withoutAdvisory.world);
  assert.deepEqual(withAdvisory.ambientRng, withoutAdvisory.ambientRng);
  assert.ok(withAdvisory.audit.length > 0);
  assert.ok(withAdvisory.audit.every(entry => entry.error === null));
});
