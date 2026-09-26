import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const publicContent=['index.html','unit-guide.js','README.md','RULE_MATRIX.md']
  .map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8'))
  .join('\n');

test('public content uses the independent G.O.B.L.I.N. nomenclature',()=>{
  for(const legacy of ['Ogre/G.E.V.','Shockwave','Reinforcement Pack','Battlefields','GOBLIN MK III','GEV SCOUT','GEV-PC','OGRE MK III','VULCAN']){
    assert.equal(publicContent.toLowerCase().includes(legacy.toLowerCase()),false,`legacy public name remains: ${legacy}`);
  }
  for(const current of ['GOBLIN SIEGEBREAKER','SKIMMER CARRIER','FIELD ENGINEERS']){
    assert.equal(publicContent.includes(current),true,`current public name missing: ${current}`);
  }
  const runtime=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  assert.equal(runtime.includes("gev:'SKIMMER MANEUVER'"),true);
});

test('the page does not request third-party webfonts',()=>{
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal(/fonts\.(?:googleapis|gstatic)\.com/i.test(index),false);
  assert.equal(index.includes('content-brand.css?v=1'),true);
});
