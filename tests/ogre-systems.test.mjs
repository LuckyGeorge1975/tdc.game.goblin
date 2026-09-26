import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../ogre-systems.js',import.meta.url),'utf8'),context);
const systems=context.GoblinSystems;

test('Mk III starts with its canonical weapon and tread inventory',()=>{
  const state=systems.createMarkIII(),summary=systems.summary(state);
  assert.equal(summary.treads,'45/45');
  assert.deepEqual({...summary.weapons},{main:'1/1',secondary:'4/4',missiles:'2/2',antipersonnel:'8/8'});
  assert.equal(summary.movement,3);
});

test('tread thresholds reduce movement at 30, 15, and 0',()=>{
  assert.deepEqual([45,31,30,16,15,1,0].map(systems.movementForTreads),[3,3,2,2,1,1,0]);
});

test('D has no effect on Ogre weapons while X destroys one system',()=>{
  const state=systems.createMarkIII();
  systems.applyHit(state,'secondary','D',6);
  assert.equal(systems.weaponRemaining(state.weapons.secondary),4);
  systems.applyHit(state,'secondary','X',6);
  assert.equal(systems.weaponRemaining(state.weapons.secondary),3);
});

test('a successful tread attack removes attack strength rather than one tread',()=>{
  const state=systems.createMarkIII(),hit=systems.applyHit(state,'treads','X',6);
  assert.equal(hit.loss,6);
  assert.equal(state.treads,39);
});

test('target priority advances as systems are destroyed',()=>{
  const state=systems.createMarkIII();
  assert.equal(systems.chooseTarget(state).key,'missiles');
  systems.applyHit(state,'missiles','X');systems.applyHit(state,'missiles','X');
  assert.equal(systems.chooseTarget(state).key,'main');
});
