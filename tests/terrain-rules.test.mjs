import test from 'node:test';
import assert from 'node:assert/strict';
import TerrainRules from '../terrain-rules.js';
import {readFileSync} from 'node:fs';

test('all twelve artwork terrain types have explicit gameplay rules',()=>{
  assert.equal(Object.keys(TerrainRules.rules).length,12);
  for(const [type,rule] of Object.entries(TerrainRules.rules)){
    assert.ok(rule.label&&rule.note,type);
    assert.equal(typeof rule.blocksLos,'boolean',type);
    assert.equal(typeof rule.cover,'number',type);
  }
  const matrix=readFileSync(new URL('../RULE_MATRIX.md',import.meta.url),'utf8');
  const normalized=text=>text.toLocaleLowerCase('de-DE').replaceAll('ß','ss');
  for(const rule of Object.values(TerrainRules.rules))assert.ok(normalized(matrix).includes(normalized(rule.label)),rule.label);
});

test('water and river admit only skimmers and amphibious infantry',()=>{
  for(const type of ['water','river']){
    assert.equal(TerrainRules.movementCost(type,{move:3,movementMode:'tracked'}),Infinity);
    assert.equal(TerrainRules.movementCost(type,{move:2,infantry:true}),Infinity);
    assert.equal(TerrainRules.movementCost(type,{move:2,infantry:true,amphibious:true}),1);
    assert.equal(TerrainRules.movementCost(type,{move:3,movementMode:'gev'}),1);
  }
  assert.equal(TerrainRules.movementCost('bridge',{move:3,movementMode:'tracked'}),1);
});

test('cover and sight are separate effects',()=>{
  assert.equal(TerrainRules.coverBonus('forest'),1);
  assert.equal(TerrainRules.blocksLos('forest'),true);
  assert.equal(TerrainRules.coverBonus('crater'),1);
  assert.equal(TerrainRules.blocksLos('crater'),false);
  assert.equal(TerrainRules.movementCost('marsh',{move:3,movementMode:'gev'}),1);
  assert.equal(TerrainRules.movementCost('marsh',{move:3,movementMode:'tracked'}),2);
});
