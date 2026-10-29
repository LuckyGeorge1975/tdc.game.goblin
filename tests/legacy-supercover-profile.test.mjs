import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {supercoverIntermediateHexes} from '../src/core/supercover-line.mjs';

const A={x:2,y:2},B={x:2,y:0},L={x:1,y:1},R={x:2,y:1};
const key=({x,y})=>`${x},${y}`;

function legacy(){
  const nodes=new Map();
  const element=()=>({innerHTML:'',textContent:'',checked:false,disabled:false,style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    setAttribute(){},addEventListener(){},appendChild(){},before(){},querySelector(){return null},animate(){},
    insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML}});
  const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector)},
    querySelectorAll(){return []},createElement:element,createElementNS:element,addEventListener(){}};
  const context=vm.createContext({document,structuredClone,console,window:{},
    GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},
    localStorage:{getItem(){return null}},setTimeout(){return 1},clearTimeout(){}});
  const run=source=>vm.runInContext(source,context);
  for(const file of ['unit-visuals.js','terrain-rules.js','ogre-systems.js',
    'scenario-profile-manifest.js','legacy-supercover.js','game.js','ogre-runtime.js',
    'combat-feedback.js','siegebreaker-weapons.js','strategic-missile.js',
    'scenario.js','command-history.js'])
    run(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  run("draw=()=>{};updateSelection=()=>{};loadScenario('unit-trial');terrain.clear();terrainTypes.clear()");
  return {run,context};
}

function probeConfig(blocked=[]){
  return {scenarioVersion:1,objectiveVersion:1,objective:'core',
    ruleProfileId:'LEGACY_SUPERCOVER_PROBE_v1',losMode:'strict-supercover',
    terrain:blocked.map(key),units:[
      {id:'player',team:'player',x:2,y:2,hp:2,maxHp:2,defense:2,range:3,move:1,damage:1},
      {id:'core',team:'enemy',x:2,y:0,hp:2,maxHp:2,defense:2,range:0,move:0,damage:0,core:true}
    ]};
}

function startProbe(game,blocked=[]){
  const config=probeConfig(blocked);
  game.context.config=config;
  game.run("legacySession=ScenarioRuleProfiles.beginSession('los-supercover-probe',config)");
  game.run('terrain.clear();terrainTypes.clear()');
  for(const cell of blocked)game.run(`terrain.add('${key(cell)}')`);
  return config;
}

test('technical probe is versioned but absent from the nine visible scenarios',()=>{
  const game=legacy();
  assert.equal(game.run("Object.keys(ScenarioRuleProfiles.entries).filter(id=>!['skimmer-pilot','siege-pilot'].includes(id)).length"),9);
  assert.equal(game.run("Object.hasOwn(scenarioCatalog,'los-supercover-probe')"),false);
  assert.equal(game.run("Object.hasOwn(ScenarioRuleProfiles.entries,'los-supercover-probe')"),false);
  const config=startProbe(game);
  assert.equal(game.run('legacySession.ruleProfileId'),'LEGACY_SUPERCOVER_PROBE_v1');
  assert.equal(game.run('legacySession.scenarioVersion'),1);
  assert.equal(game.run('legacySession.effectiveRules.losMode'),'strict-supercover');
  assert.equal(game.run('Object.isFrozen(legacySession)&&Object.isFrozen(legacySession.effectiveRules)'),true);
  config.losMode='legacy-nearest';
  assert.equal(game.run('legacySession.effectiveRules.losMode'),'strict-supercover');
  game.run("setViewMode('los');setGridVisible(true)");
  assert.equal(game.run('legacySession.effectiveRules.losMode'),'strict-supercover');
  assert.equal(game.run('lineOfSight({x:2,y:2},{x:2,y:0})'),true);
  assert.throws(()=>game.run("ScenarioRuleProfiles.validate('unit-trial',{...scenarioCatalog['unit-trial'],losMode:'strict-supercover'})"),
    /SCENARIO_PROFILE_MISMATCH/);
  assert.throws(()=>game.run("ScenarioRuleProfiles.beginSession('los-supercover-probe',{...config,losMode:'legacy-nearest'})"),
    /SCENARIO_PROFILE_MISMATCH/);
});

test('one boundary blocker vetoes the technical probe in both directions',()=>{
  const game=legacy();
  for(const [blocked,visible] of [[[],true],[[L],false],[[R],false],[[L,R],false]]){
    startProbe(game,blocked);
    assert.equal(game.run('lineOfSight({x:2,y:2},{x:2,y:0})'),visible,`A->B ${blocked.map(key)}`);
    assert.equal(game.run('lineOfSight({x:2,y:0},{x:2,y:2})'),visible,`B->A ${blocked.map(key)}`);
  }
});

test('non-boundary and endpoint cases agree with the geometry helper',()=>{
  const game=legacy();
  startProbe(game,[A,B]);
  assert.equal(game.run('lineOfSight({x:2,y:2},{x:2,y:0})'),true);
  assert.deepEqual(supercoverIntermediateHexes({x:1,y:3},{x:3,y:3}),[{x:2,y:3}]);
  startProbe(game,[{x:2,y:3}]);
  assert.equal(game.run('lineOfSight({x:1,y:3},{x:3,y:3})'),false);
  assert.equal(game.run('lineOfSight({x:3,y:3},{x:1,y:3})'),false);
  startProbe(game);
  assert.equal(game.run('lineOfSight({x:1,y:3},{x:3,y:3})'),true);
  const points=Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>({x,y}))).flat();
  for(const from of points)for(const to of points){
    assert.deepEqual(JSON.parse(game.run(`JSON.stringify(GoblinHexSupercover.intermediateHexes(${JSON.stringify(from)},${JSON.stringify(to)}))`)),
      supercoverIntermediateHexes(from,to));
  }
});

test('old Field Test session ignores outer profile edits and retains nearestHex tie behavior',()=>{
  const game=legacy();
  game.run("const {targetPolicyVersion,...historicalIronDust}=scenarioCatalog['iron-dust'];legacySession=ScenarioRuleProfiles.beginSession('iron-dust',{...historicalIronDust,scenarioVersion:1,ruleProfileId:'FIELD_TEST_LEGACY_v1'})");
  assert.equal(game.run('legacySession.ruleProfileId'),'FIELD_TEST_LEGACY_v1');
  game.run("terrain.clear();terrainTypes.clear();terrain.add('1,1')");
  const left=game.run('lineOfSight({x:2,y:2},{x:2,y:0})');
  game.run("terrain.clear();terrain.add('2,1')");
  const right=game.run('lineOfSight({x:2,y:2},{x:2,y:0})');
  assert.notEqual(left,right,'historical boundary choice remains one-sided');
  game.run("scenarioCatalog['unit-trial'].losMode='strict-supercover';setViewMode('los')");
  assert.equal(game.run('legacySession.effectiveRules.losMode'),undefined);
  assert.equal(game.run('lineOfSight({x:2,y:2},{x:2,y:0})'),right);
});
