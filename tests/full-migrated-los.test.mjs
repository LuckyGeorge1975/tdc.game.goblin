import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fullShell} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const prefix=JSON.parse(read('tests/fixtures/full-migrated-los-prefix.json'));
const training=JSON.parse(read('assets/unit-art/levels/ai-training-missions.v3.json')).levels;
const migrated=JSON.parse(read('assets/unit-art/levels/full-migrated-missions.v3.json')).levels;
async function fixture(level,mode='registered',seed=7){
  const game=fullShell(seed);
  await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
  game.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
  for(const path of ['level-events.js','editor-draft.js'])game.run(read(path));
  const full=game.context.GoblinCatalogFullRuntime,specialists=game.context.GoblinSpecialistsRuntime;
  for(const side of ['player','enemy'])full.registerQualifiedController({side,id:side+'-strong',difficulty:'strong',select(){throw Error('EXPLICIT_NATIVE_TEST_COMMANDS');}});
  game.context.source=level;
  game.context.controls={roles:{player:'ai',enemy:'ai'},policyIds:{player:'player-strong',enemy:'enemy-strong'},seed};
  await game.run(`GoblinEditorDraft.prepare(source).then(config=>{
    globalThis.prepared=config;
    if(${JSON.stringify(mode)}==='registered'){
      ScenarioRuleProfiles.registerFullMission(source.id,config);scenarioCatalog[source.id]=config;
      globalThis.port=loadScenario(source.id,controls);
    }else globalThis.port=loadEditorDraft(config,controls);
  })`);
  const port=game.context.port,ui=game.context.GoblinSpecialistsUI;
  const host=createFullCatalogAiHost(full,ui,full.nativePlayerGateway,()=>port.state()?.side,specialists);
  const commit=command=>assert.equal(port.commit('ai',port.open('ai').permit,command,host.dispatch).ok,true);
  function frame(){
    const before=[game.state(),JSON.stringify(full.snapshot()),game.rng()];
    const value={view:plain(port.project('ai').view),fire:plain(host.playerOptions(true)
      .filter(entry=>['CatalogFire','CatalogHexFire'].includes(entry.command.type)).map(entry=>entry.command))};
    assert.deepEqual([game.state(),JSON.stringify(full.snapshot()),game.rng()],before);
    return value;
  }
  return {game,full,port,host,specialists,ui,commit,frame};
}

test('recorded early fire states have identical registered/editor offers on both seats and retain the real urban blockade',async()=>{
  const collected=[];
  for(const mode of ['registered','editor']){
    const f=await fixture(training.find(level=>level.id===prefix.levelId),mode,prefix.seed),frames=[];
    for(let index=0;index<=34;index++){
      if([7,16,25,34].includes(index)){
        assert.equal(f.port.state().phase,'fire');
        const frame=f.frame();assert.equal(frame.fire.length,({7:0,16:1,25:2,34:3})[index]);
        assert.ok(frame.view.observedCells.length>0);
        const [actorId,targetId]=index===7?['a-2','b-6']:index===16?['b-5','a-4']:index===25?['a-2','b-2']:['b-1','a-5'];
        const command={type:'CatalogFire',actorId,target:{kind:'unit',runtimeUnitId:targetId},weaponId:null,mode:'direct',spotterId:null};
        const q=f.specialists.query(command);assert.equal(q.ok,index!==7);
        if(index===7)assert.equal(q.code,'DIRECT_LOS_REQUIRED');
        assert.deepEqual(plain(f.full.nativePlayerGateway.query(command)),plain(q));
        frames.push(frame);
      }
      if(index<34)f.commit(prefix.commands[index]);
    }
    collected.push(frames);f.port.leave();
  }
  assert.deepEqual(collected[0],collected[1],'same native units/terrain/phase/budgets give the same complete offer and observed cells');
});

test('all four new mission IDs and a prior migration use validated FULL sight on both seats with editor parity',async()=>{
  for(const level of [...training,migrated.find(level=>level.id==='iron-dust')])for(const side of ['player','enemy']){
    const frames=[];
    for(const mode of ['registered','editor']){
      const f=await fixture(level,mode);
      for(let count=0;count<(side==='player'?1:4);count++)f.commit({type:'EndPhase'});
      f.game.context.testSide=side;
      f.game.run(`{
        const roster=GoblinCatalogFullRuntime.roster(testSide);
        const armed=unit=>GoblinSpecialistsRuntime.weapons(unit).some(weapon=>weapon.ready&&!weapon.infantryOnly&&weapon.range>=1);
        globalThis.losActor=roster.find(unit=>unit.team===testSide&&armed(unit));
        globalThis.losTarget=roster.find(unit=>unit.team!==testSide&&armed(unit));
        const occupied=new Set(units.filter(unit=>unitAlive(unit)&&unit!==losActor&&unit!==losTarget).map(unit=>unit.x+','+unit.y));
        let found=false;
        for(let y=0;y<H&&!found;y++)for(let x=0;x<W&&!found;x++){
          if(occupied.has(x+','+y)||!Number.isFinite(movementCost(losActor,x+','+y)))continue;
          const next=hexNeighbors(x,y).find(cell=>cell.x>=0&&cell.x<W&&cell.y>=0&&cell.y<H&&
            !occupied.has(cell.x+','+cell.y)&&Number.isFinite(movementCost(losTarget,cell.x+','+cell.y)));
          if(!next)continue;Object.assign(losActor,{x,y});Object.assign(losTarget,next);found=true;
        }
        if(!found)throw Error('NO_VALID_CLEAR_ADJACENT_FIXTURE');
        GoblinCatalogFullRuntime.refresh();
      }`);
      assert.equal(f.game.run('lineOfSight(losActor,losTarget)'),true,level.id+'/'+side+'/'+mode);
      const frame=f.frame();
      assert.ok(frame.fire.some(command=>command.actorId===f.game.context.losActor.id&&command.target?.runtimeUnitId===f.game.context.losTarget.id));
      assert.ok(frame.view.observedCells.length>0);frames.push(frame);f.port.leave();
    }
    assert.deepEqual(frames[0],frames[1],level.id+'/'+side);
  }
});

test('migration sight still rejects unregistered sessions, unsupported profiles, versions, modes and unchecked data',async()=>{
  const f=await fixture(training[0]);
  f.game.run(`globalThis.admittedSession=legacySession;
    globalThis.a=units.find(unit=>unit.team==='player');globalThis.b=units.find(unit=>unit.team==='enemy');
    Object.assign(a,{x:3,y:0});Object.assign(b,{x:4,y:0});`);
  assert.equal(f.game.run('lineOfSight(a,b)'),true);
  const clones=[
    '({...admittedSession})',
    'Object.freeze({...admittedSession})',
    'Object.freeze({...admittedSession,ruleProfileId:"UNSUPPORTED_PROFILE"})',
    'Object.freeze({...admittedSession,scenarioVersion:2})',
    'Object.freeze({...admittedSession,effectiveRules:Object.freeze({...admittedSession.effectiveRules,losMode:"legacy-pixel-los-v1"})})'
  ];
  for(const expression of clones){
    f.game.run('legacySession='+expression);
    assert.equal(f.game.run('lineOfSight(a,b)'),false,expression);
  }
  f.game.run('legacySession=admittedSession');
  assert.throws(()=>f.game.run('ScenarioRuleProfiles.registerFullMission(source.id,{...prepared})'),{code:'SCENARIO_PROFILE_MISMATCH'});
  assert.equal(f.game.run('lineOfSight(a,b)'),true);f.port.leave();
});
