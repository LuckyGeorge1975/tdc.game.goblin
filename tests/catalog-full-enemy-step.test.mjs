import test from 'node:test';
import assert from 'node:assert/strict';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';

const atlas = () => fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
const dreadnaught = 'catalog-full-atlas-20';
const hold = {type:'EnemyHold', actorId:dreadnaught};
const move = {type:'EnemyMove', actorId:dreadnaught, x:8, y:1};
const facts = g => [g.state(), read(g,'GoblinCatalogFullRuntime.snapshot()'), g.rng()];

function schedule(g, choose) {
  g.context.chooseForTest = choose;
  g.run("setTurnPhase('fire');setTurnPhase('gev');startEnemyTurn(chooseForTest)");
  const job = [...g.timers.entries()].find(([,fn]) => String(fn).includes('const foes='));
  assert.ok(job);
  g.timers.delete(job[0]);
  return job[1];
}

test('Atlas Dreadnaught can query and execute a legal move at its existing slot', async () => {
  const g = await atlas();
  const order = [];
  let saved, applied;
  const callback = schedule(g, slot => {
    order.push(slot.actorId);
    if (slot.actorId !== dreadnaught) return;
    saved = slot;
    const before = facts(g);
    assert.equal(slot.query(move).ok, true);
    assert.equal(slot.query(hold).ok, true);
    assert.equal(slot.execute({...move,actorId:'catalog-full-atlas-21'}).ok, false);
    for (const command of [
      {...move,x:-1}, {...move,x:9,y:4}, {...move,x:8,y:6},
      {...move,x:0,y:0}, {...move,path:[]}
    ]) {
      assert.equal(slot.query(command).ok, false);
      assert.equal(slot.execute(command).ok, false);
    }
    assert.deepEqual(facts(g), before);
    // A previously valid preview cannot authorize execution after occupancy changes.
    g.run("const blocker=units.find(u=>u.id==='catalog-full-atlas-21');const blockerFrom={x:blocker.x,y:blocker.y};blocker.x=8;blocker.y=1");
    const occupied = facts(g);
    assert.equal(slot.execute(move).code, 'ENEMY_DESTINATION_OCCUPIED');
    assert.deepEqual(facts(g), occupied);
    g.run('Object.assign(blocker,blockerFrom)');
    assert.equal(slot.execute(move).ok, true);
    assert.equal(slot.execute(hold).code, 'ENEMY_STEP_SPENT');
    assert.deepEqual(g.rng(), before[2]);
    applied = read(g,"units.find(u=>u.id==='catalog-full-atlas-20')");
    assert.deepEqual([applied.x,applied.y,applied.moveCount], [8,1,1]);
  });
  assert.equal(saved, undefined);
  callback();
  assert.ok(order.indexOf('catalog-full-atlas-19') < order.indexOf(dreadnaught));
  assert.ok(order.indexOf(dreadnaught) < order.indexOf('catalog-full-atlas-21'));
  assert.equal(saved.execute(move).code, 'ENEMY_SLOT_CLOSED');
  assert.deepEqual(read(g,'[phase,turnPhase,turn]'), ['player','movement',2]);
});

test('a scheduled choice from a previous session never opens an actor slot', async () => {
  const g = await atlas();
  let calls = 0;
  const stale = schedule(g, () => calls++);
  g.run("loadScenario('catalog-full-atlas')");
  schedule(g, () => {});
  const before = facts(g);
  stale();
  assert.equal(calls, 0);
  assert.deepEqual(facts(g), before);
});

test('FULL rechecks affected enemy actors before movement and fire retry', async () => {
  const g = await atlas();
  g.run(`
    const nativeEnemyFire = enemyFire;
    const shotCalls = [];
    const destroyed = units.find(unit => unit.id === 'catalog-full-atlas-20');
    const disabled = units.find(unit => unit.id === 'catalog-full-atlas-21');
    enemyFire = (actor, choose, pass) => {
      shotCalls.push([actor.id, pass]);
      if (actor.id === 'catalog-full-atlas-19' && pass === 'first') {
        destroyed.disabled = false;
        destroyed.alive = false;
        destroyed.hp = 0;
        disabled.disabled = true;
        actor.disabled = true;
        return false;
      }
      return nativeEnemyFire(actor, choose, pass);
    };
  `);
  const slots = [];
  const before = read(g, '[destroyed.x, destroyed.y, disabled.x, disabled.y]');
  schedule(g, slot => { slots.push(slot.actorId); })();
  assert.ok(slots.includes('catalog-full-atlas-19'));
  assert.ok(!slots.includes('catalog-full-atlas-20'));
  assert.ok(!slots.includes('catalog-full-atlas-21'));
  assert.deepEqual(read(g, '[destroyed.x, destroyed.y, disabled.x, disabled.y]'), before);
  assert.deepEqual(read(g, 'shotCalls.filter(([id]) => ["catalog-full-atlas-19","catalog-full-atlas-20","catalog-full-atlas-21"].includes(id))'),
    [['catalog-full-atlas-19', 'first']]);
  assert.deepEqual(read(g, '[phase, turnPhase, turn]'), ['player', 'movement', 2]);
});

test('restarting inside a choice stops the old pass, retry and turn end', async () => {
  const g = await atlas();
  let calls = 0, restarted;
  schedule(g, slot => {
    calls++;
    g.run("loadScenario('catalog-full-atlas')");
    restarted = facts(g);
    assert.equal(slot.execute({type:'EnemyHold',actorId:slot.actorId}).code, 'ENEMY_SLOT_CLOSED');
  })();
  assert.equal(calls, 1);
  assert.deepEqual(read(g,'[phase,turnPhase,turn]'), ['player','movement',1]);
  assert.deepEqual(facts(g), restarted);
});

test('choice exception before commit closes the slot and falls back to the automatic turn', async () => {
  const expected = await atlas();
  schedule(expected)();
  const g = await atlas();
  const reports = [], error = new Error('choice before commit');
  g.context.console = {error:(...args) => reports.push(args)};
  let saved;
  schedule(g, slot => {
    if (slot.actorId !== dreadnaught) return;
    saved = slot;
    throw error;
  })();
  assert.equal(saved.execute(hold).code, 'ENEMY_SLOT_CLOSED');
  assert.deepEqual(reports, [['FULL enemy choice failed',dreadnaught,error]]);
  assert.deepEqual(facts(g), facts(expected));
});

test('choice exception after movement preserves the commit and its normal fire retry', async () => {
  const expected = await atlas();
  schedule(expected, slot => {
    if (slot.actorId === dreadnaught) assert.equal(slot.execute(move).ok,true);
  })();
  const g = await atlas();
  const reports = [], error = new Error('choice after commit');
  g.context.console = {error:(...args) => reports.push(args)};
  let saved;
  schedule(g, slot => {
    if (slot.actorId !== dreadnaught) return;
    saved = slot;
    assert.equal(slot.execute(move).ok,true);
    throw error;
  })();
  assert.equal(saved.execute(move).code, 'ENEMY_SLOT_CLOSED');
  assert.deepEqual(reports, [['FULL enemy choice failed',dreadnaught,error]]);
  assert.deepEqual(facts(g), facts(expected));
});

test('an exception from the movement commit propagates without fallback or retry', async () => {
  const g = await atlas();
  const error = new Error('commit failed after a world mutation');
  g.context.commitError = error;
  g.run(`const normalCommit=commitEnemyStep;
    commitEnemyStep=function(actor,step){
      normalCommit(actor,step);
      if(actor.id==='catalog-full-atlas-20') throw commitError;
    };`);
  let saved, failedState;
  const callback = schedule(g, slot => {
    if (slot.actorId !== dreadnaught) return;
    saved = slot;
    assert.throws(() => slot.execute(move), error);
    failedState = facts(g);
  });
  assert.throws(callback, error);
  assert.equal(saved.execute(hold).code, 'ENEMY_SLOT_CLOSED');
  assert.deepEqual(facts(g), failedState);
});

test('Hold consumes only the first pass and allows the normal fire retry', async () => {
  const g = await atlas();
  let slotExecuted = false;
  g.run(`const legacyFire=enemyFire,fireCalls=[];
    enemyFire=function(actor){fireCalls.push(actor.id);return legacyFire(actor)};`);
  const callback = schedule(g, slot => {
    if (slot.actorId !== dreadnaught) return;
    const before = facts(g);
    assert.equal(slot.execute(hold).ok, true);
    assert.equal(slot.query(move).code, 'ENEMY_STEP_SPENT');
    assert.deepEqual(facts(g), before);
    slotExecuted = true;
  });
  callback();
  assert.ok(slotExecuted);
  const calls = read(g,'fireCalls');
  assert.equal(calls.filter(id => id === dreadnaught).length, 1);
  assert.ok(calls.lastIndexOf(dreadnaught) > calls.indexOf('catalog-full-atlas-21'));
});

test('Enemy movement preview keeps hidden occupancy private and commit stops on collision', async () => {
  const g = await fullScene('catalog-full-specialists',7,false,'FULL_CATALOG_v1');
  const actorId = 'catalog-full-specialists-8';
  g.run(`units.filter(u=>u.team==='enemy'&&u.id!=='${actorId}').forEach(u=>u.disabled=true);
    const enemyActor=units.find(u=>u.id==='${actorId}');
    const playerNinja=units.find(u=>u.id==='u3-player-ninja');
    enemyActor.x=1;enemyActor.y=0;playerNinja.x=4;playerNinja.y=0;
    GoblinCatalogFullRuntime.refresh();`);
  let tested = false;
  schedule(g, slot => {
    if (slot.actorId !== actorId) return;
    const command = {type:'EnemyMove',actorId,x:4,y:0};
    assert.equal(read(g,"GoblinCatalogFullRuntime.known('u3-player-ninja','enemy')"),false);
    const before = facts(g);
    const query = slot.query(command);
    assert.equal(query.ok,true);
    assert.equal(JSON.stringify(query).includes('u3-player-ninja'),false);
    assert.deepEqual(facts(g),before);
    assert.equal(slot.execute(command).ok,true);
    assert.equal(read(g,'enemyActor.x'),3);
    assert.equal(read(g,"GoblinCatalogFullRuntime.known('u3-player-ninja','enemy')"),true);
    assert.deepEqual(g.rng(),before[2]);
    tested = true;
  })();
  assert.ok(tested);
});
