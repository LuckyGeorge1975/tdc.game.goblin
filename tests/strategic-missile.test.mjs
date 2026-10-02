import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {UNIT_CATALOG} from '../rules.mjs';

function game(){
  const nodes=new Map();
  function element(){return {innerHTML:'',textContent:'',checked:false,disabled:false,style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},appendChild(){},before(){},
    insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML}}}
  const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector)},
    querySelectorAll(){return []},createElement:element,createElementNS:element,addEventListener(){}};
  const context=vm.createContext({document,structuredClone,console,window:{},
    GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},localStorage:{getItem(){return null}},
    setTimeout(){return 1},clearTimeout(){}});
  const run=source=>vm.runInContext(source,context);
  for(const file of ['unit-visuals.js','terrain-rules.js','ogre-systems.js','game.js','ogre-runtime.js','combat-feedback.js','siegebreaker-weapons.js','strategic-missile.js','scenario.js','command-history.js'])
    run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>{};updateSelection=()=>{};loadScenario('unit-trial');document.querySelector('#auto-end-turn').checked=false");
  return run;
}

test('catalogue and trial expose the one-use missile carrier',()=>{
  assert.equal(UNIT_CATALOG.missileCrawler.ammunition,1);
  assert.equal(UNIT_CATALOG.missileCrawler.blastRadius,1);
  const run=game();
  assert.equal(run("units.find(u=>u.id==='missile-crawler').missilesRemaining"),1);
  run("setTurnPhase('fire')");
  assert.equal(run("phaseCanAct(units.find(u=>u.id==='missile-crawler'),'fire')"),false,
    'the opening targets are outside the corrected eight-hex radius');
  run("terrain.clear();units.find(u=>u.id==='guard').x=2;units.find(u=>u.id==='guard').y=7");
  assert.equal(run("phaseCanAct(units.find(u=>u.id==='missile-crawler'),'fire')"),true);
});

test('missile strike affects the target and adjacent units of both teams, then spends ammunition',()=>{
  const run=game();
  run("terrain.clear();const carrier=units.find(u=>u.id==='missile-crawler');carrier.x=1;carrier.y=4;const guard=units.find(u=>u.id==='guard');guard.x=4;guard.y=4;guard.defense=1;const raider=units.find(u=>u.id==='raider');raider.x=5;raider.y=4;const infantry=units.find(u=>u.id==='infantry');infantry.x=4;infantry.y=5;setTurnPhase('fire');attack(carrier,guard)");
  assert.equal(run("units.find(u=>u.id==='guard').hp"),0);
  assert.equal(run("units.find(u=>u.id==='missile-crawler').missilesRemaining"),0);
  assert.equal(run("phaseCanAct(units.find(u=>u.id==='missile-crawler'),'fire')"),false);
  assert.match(run('logEl.innerHTML'),/EIGENE EINHEIT/);
  assert.match(run('logEl.innerHTML'),/DRUCKWELLE/);
  assert.equal(run('phaseCommands.length'),1);
  run('undoPhaseCommand()');
  assert.equal(run("units.find(u=>u.id==='missile-crawler').missilesRemaining"),1);
  assert.equal(run("units.find(u=>u.id==='guard').hp"),5);
});

test('missile splash that eliminates both forces ends in defeat',()=>{
  const run=game();
  run("terrain.clear();units.forEach(unit=>unit.hp=0);const carrier=units.find(unit=>unit.id==='missile-crawler');const core=units.find(unit=>unit.core);carrier.hp=1;carrier.defense=1;carrier.x=1;carrier.y=4;core.hp=1;core.defense=1;core.x=2;core.y=4;Math.random=()=>0.5;setTurnPhase('fire');attack(carrier,core)");
  assert.equal(run("units.find(unit=>unit.core).hp"),0);
  assert.equal(run("units.find(unit=>unit.id==='missile-crawler').hp"),0);
  assert.equal(run('gameOver'),true);
  assert.equal(run("document.querySelector('#phase-title').textContent"),'MISSION FAILED');
  assert.match(run('logEl.innerHTML'),/EIGENE EINHEIT/);
});

test('spent missile does not reload on a new turn',()=>{
  const run=game();
  run("const carrier=units.find(u=>u.id==='missile-crawler');carrier.missilesRemaining=0;resetActionState()");
  assert.equal(run("units.find(u=>u.id==='missile-crawler').missilesRemaining"),0);
  run("setTurnPhase('fire');attack(units.find(u=>u.id==='missile-crawler'),units.find(u=>u.id==='guard'))");
  assert.equal(run('phaseCommands.length'),0);
});

test('a missile cannot be launched through blocked sight',()=>{
  const run=game();
  run("const carrier=units.find(u=>u.id==='missile-crawler');carrier.x=1;carrier.y=4;const guard=units.find(u=>u.id==='guard');guard.x=4;guard.y=4;terrain.clear();terrain.add('2,4');setTurnPhase('fire')");
  assert.equal(run("lineOfSight(units.find(u=>u.id==='missile-crawler'),units.find(u=>u.id==='guard'))"),false);
  run("attack(units.find(u=>u.id==='missile-crawler'),units.find(u=>u.id==='guard'))");
  assert.equal(run("units.find(u=>u.id==='missile-crawler').missilesRemaining"),1);
  assert.equal(run('phaseCommands.length'),0);
});
