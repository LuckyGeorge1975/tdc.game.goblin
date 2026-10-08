import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {supercoverIntermediateHexes} from '../src/core/supercover-line.mjs';

const levels=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/showcase-levels.json',import.meta.url),'utf8'));
const atlas=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/atlas-proving-grounds.json',import.meta.url),'utf8'));
const key=({x,y})=>`${x},${y}`;
const A={x:2,y:2},B={x:2,y:0},left={x:1,y:1},right={x:2,y:1};

async function game(){
  const nodes=new Map();
  const element=()=>({innerHTML:'',textContent:'',checked:false,disabled:false,style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){},addEventListener(){},appendChild(){},before(){},querySelector(){return null},animate(){},
    insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML}});
  const document={querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)},
    querySelectorAll(){return []},createElement:element,createElementNS:element,addEventListener(){}};
  const context=vm.createContext({document,structuredClone,console,window:{},location:{search:''},URLSearchParams,
    GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},localStorage:{getItem(){return null}},
    setTimeout(){return 1},clearTimeout(){},
    fetch:async url=>({ok:true,json:async()=>String(url).includes('showcase-levels')?levels:atlas})});
  const run=source=>vm.runInContext(source,context);
  for(const file of ['unit-visuals.js','terrain-rules.js','ogre-systems.js','supercover-line.js','game.js',
    'ogre-runtime.js','combat-feedback.js','siegebreaker-weapons.js','strategic-missile.js',
    'scenario.js','command-history.js','atlas-level.js'])
    run(readFileSync(new URL(`../src/legacy/scripts/${file}`,import.meta.url),'utf8'));
  await new Promise(resolve=>setImmediate(resolve));
  run("draw=()=>{};updateSelection=()=>{};loadScenario('los-supercover-showcase')");
  return {run,context};
}

test('showcase binds one immutable profile and leaves eight legacy missions unchanged',async()=>{
  const {run}=await game();
  assert.equal(run('Object.keys(scenarioCatalog).length'),9);
  assert.equal(run('activeRuleProfile.id'),'FIELD_TEST_SUPERCOVER_v1');
  assert.equal(run('activeRuleProfile.scenarioVersion'),1);
  assert.equal(run('activeRuleProfile.losMode'),'strict-supercover');
  assert.equal(run('Object.isFrozen(activeRuleProfile)'),true);
  assert.equal(run('units.filter(unit=>unit.team===\'player\').length'),4);
  assert.equal(run('units.filter(unit=>unit.team===\'enemy\').length'),3);
  run("scenarioCatalog['los-supercover-showcase'].ruleProfileId='FULL_CATALOG_v1'");
  assert.equal(run('activeRuleProfile.id'),'FIELD_TEST_SUPERCOVER_v1');
  assert.throws(()=>run("loadScenario('los-supercover-showcase')"),/SCENARIO_PROFILE_MISMATCH/);
  run("loadScenario('unit-trial')");
  assert.equal(run('activeRuleProfile.id'),'FIELD_TEST_LEGACY_v1');
  assert.equal(run('activeRuleProfile.losMode'),'legacy-pixel');
});

test('one boundary blocker vetoes preview, player fire and enemy fire symmetrically',async()=>{
  const {run}=await game();
  assert.deepEqual(supercoverIntermediateHexes(A,B),[left,right]);
  for(const blocker of [left,right]){
    run("terrain.clear();terrainTypes.clear()");
    run(`terrain.add('${key(blocker)}')`);
    assert.equal(run('lineOfSight({x:2,y:2},{x:2,y:0})'),false);
    assert.equal(run('lineOfSight({x:2,y:0},{x:2,y:2})'),false);
    run("turnPhase='fire';selected=units.find(unit=>unit.visualKey==='siege-tank')");
    assert.equal(run("phaseCanAct(selected,'fire')"),false);
    const before=run("JSON.stringify({hp:units.find(unit=>unit.visualKey==='guard-tank').hp,fired:selected.fired,roll:phaseRollCursor})");
    run("attack(selected,units.find(unit=>unit.visualKey==='guard-tank'))");
    assert.equal(run("JSON.stringify({hp:units.find(unit=>unit.visualKey==='guard-tank').hp,fired:selected.fired,roll:phaseRollCursor})"),before);
    assert.equal(run("enemyFire(units.find(unit=>unit.visualKey==='guard-tank'))"),false);
  }
  run("terrain.clear();terrainTypes.clear()");
  assert.equal(run('lineOfSight({x:2,y:2},{x:2,y:0})'),true);
  assert.equal(run('lineOfSight({x:2,y:0},{x:2,y:2})'),true);
  assert.equal(run("phaseCanAct(units.find(unit=>unit.visualKey==='siege-tank'),'fire')"),true);
});

test('Legacy and Core geometry agree; historical tie behavior remains separate',async()=>{
  const {run}=await game();
  const points=Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>({x,y}))).flat();
  for(const from of points)for(const to of points){
    assert.deepEqual(JSON.parse(run(`JSON.stringify(GoblinHexSupercover.intermediateHexes(${JSON.stringify(from)},${JSON.stringify(to)}))`)),
      supercoverIntermediateHexes(from,to));
  }
  run("loadScenario('unit-trial');terrainTypes.clear();terrain.clear();terrain.add('1,1')");
  const first=run('lineOfSight({x:2,y:2},{x:2,y:0})');
  run("terrain.clear();terrain.add('2,1')");
  const second=run('lineOfSight({x:2,y:2},{x:2,y:0})');
  assert.notEqual(first,second,'the old profile keeps its historical boundary choice');
});

test('showcase can reach victory through movement, fire and enemy turns',async()=>{
  const {run}=await game();
  run('scheduleGameTask=action=>action()');
  for(let round=0;round<20&&!run('gameOver');round++){
    for(const id of JSON.parse(run("JSON.stringify(units.filter(u=>u.team==='player'&&u.hp>0&&u.move>0).map(u=>u.id))"))){
      const destination=JSON.parse(run(`JSON.stringify((()=>{
        const unit=units.find(u=>u.id==='${id}'),targets=units.filter(u=>u.team==='enemy'&&u.hp>0&&!u.core);
        const target=targets[0]||units.find(u=>u.core&&u.hp>0);
        if(!target)return null;
        let best=null;
        for(let y=0;y<H;y++)for(let x=0;x<W;x++){
          if(x===unit.x&&y===unit.y||units.some(other=>other!==unit&&other.hp>0&&!other.embarkedOn&&other.x===x&&other.y===y))continue;
          if(!findMovementPath(unit,{x,y},unit.move,unit))continue;
          const score=dist({x,y},target)*100+dist({x,y},unit);
          if(!best||score<best.score)best={x,y,score};
        }
        return best;
      })())`));
      if(destination)run(`selected=units.find(u=>u.id==='${id}');handleHex(${destination.x},${destination.y})`);
    }
    run("setTurnPhase('fire');Math.random=()=>0.999");
    for(const id of JSON.parse(run("JSON.stringify(units.filter(u=>u.team==='player'&&u.hp>0).map(u=>u.id))"))){
      const target=JSON.parse(run(`JSON.stringify((()=>{const unit=units.find(u=>u.id==='${id}');return units.filter(u=>u.team==='enemy'&&u.hp>0&&dist(unit,u)<=unit.range&&lineOfSight(unit,u)).sort((a,b)=>Number(a.core)-Number(b.core)||dist(unit,a)-dist(unit,b))[0]?.id||null})())`));
      if(target)run(`selected=units.find(u=>u.id==='${id}');handleUnitClick(units.find(u=>u.id==='${target}'))`);
      if(run('gameOver'))break;
    }
    if(!run('gameOver'))run('Math.random=()=>0;enemyTurn()');
  }
  assert.equal(run('gameOver'),true,run("JSON.stringify(units.map(u=>({id:u.id,hp:u.hp,x:u.x,y:u.y})))"));
  assert.equal(run("document.querySelector('#phase-title').textContent"),'MISSION COMPLETE');
  assert.ok(run('turn')<=20);
});

test('showcase can reach defeat when the force does not engage',async()=>{
  const {run}=await game();
  run('scheduleGameTask=action=>action();Math.random=()=>0.999');
  for(let round=0;round<25&&!run('gameOver');round++)run('enemyTurn()');
  if(!run('gameOver'))run("selected=units.find(u=>u.id==='assault-tank');handleHex(2,4)");
  for(let round=0;round<40&&!run('gameOver');round++)run('enemyTurn()');
  assert.equal(run('gameOver'),true,run("JSON.stringify(units.map(u=>({id:u.id,hp:u.hp,x:u.x,y:u.y})))"));
  assert.equal(run("document.querySelector('#phase-title').textContent"),'MISSION FAILED');
});
