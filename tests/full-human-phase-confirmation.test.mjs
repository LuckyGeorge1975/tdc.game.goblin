import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fullShell} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const prefix=JSON.parse(read('tests/fixtures/full-migrated-los-prefix.json'));
const level=JSON.parse(read('assets/unit-art/levels/ai-training-missions.v3.json')).levels.find(level=>level.id===prefix.levelId);
async function frame(index){
  const game=fullShell(prefix.seed);
  await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
  game.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
  for(const path of ['level-events.js','editor-draft.js'])game.run(read(path));
  game.context.source=level;game.context.controls={roles:{player:'human',enemy:'human'},seed:prefix.seed,ui:{handoff(_seat,take){take();}}};
  await game.run(`GoblinEditorDraft.prepare(source).then(config=>{ScenarioRuleProfiles.registerFullMission(source.id,config);
    scenarioCatalog[source.id]=config;globalThis.port=loadScenario(source.id,controls);})`);
  const port=game.context.port,full=game.context.GoblinCatalogFullRuntime;
  const host=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  const commit=command=>port.commit('human',port.open('human')?.permit,command,host.dispatch);
  for(const command of prefix.commands.slice(0,index))assert.equal(commit(command).ok,true);
  assert.equal(port.state().phase,'fire');assert.ok(game.run('phaseReadyUnits().length')>0);
  return {game,port,full,commit,confirm(){
    game.run('GameDialogs.confirm=()=>new Promise(resolve=>{globalThis.answerPhase=resolve;})');
    let applied=0;const permit=port.open('human').permit;
    game.context.applyPhase=()=>{applied++;assert.equal(port.commit('human',permit,{type:'EndPhase'},host.dispatch).ok,true);};
    const done=game.run('confirmPhaseAdvance(applyPhase)');
    return {done,answer:value=>game.context.answerPhase(value),applied:()=>applied};
  }};
}
test('accepted phase confirmation advances both actual human fire seats with pending legal shots',async()=>{
  for(const [index,side]of [[16,'enemy'],[25,'player']]){
    const f=await frame(index);assert.equal(f.port.state().side,side);
    const revision=f.full.commandRevision(),dialog=f.confirm();dialog.answer(true);await dialog.done;
    assert.equal(dialog.applied(),1);assert.equal(f.port.state().side,side);assert.equal(f.port.state().phase,'gev');
    assert.notEqual(f.full.commandRevision(),revision);
  }
});
test('Cancel preserves the real pending shot and native state on both human seats',async()=>{
  for(const index of [16,25]){
    const f=await frame(index),before=JSON.stringify([f.full.snapshot(),f.game.state(),f.game.rng(),f.port.state()]);
    const dialog=f.confirm();dialog.answer(false);await dialog.done;assert.equal(dialog.applied(),0);
    assert.equal(JSON.stringify([f.full.snapshot(),f.game.state(),f.game.rng(),f.port.state()]),before);
  }
});
test('an accepted stale phase dialog never acts after revision, phase, seat, pause, leave or session changes',async()=>{
  for(const index of [16,25])for(const change of ['revision','phase','seat','pause','resume','leave','replacement','terminal']){
    const f=await frame(index),dialog=f.confirm();
    if(change==='revision'){
      // Use the real native actor/target command from the original observed fire frame.
      const [actorId,targetId]=index===16?['b-5','a-4']:['a-2','b-2'];
      assert.equal(f.commit({type:'CatalogFire',actorId,target:{kind:'unit',runtimeUnitId:targetId},weaponId:null,mode:'direct',spotterId:null}).ok,true);
    }else if(change==='phase'||change==='seat'){
      for(let count=0;count<(change==='seat'?2:1);count++)assert.equal(f.commit({type:'EndPhase'}).ok,true);
    }else if(change==='pause'||change==='resume'){
      f.port.pause();if(change==='resume')f.port.resume();
    }else if(change==='leave')f.port.leave();
    else if(change==='replacement')f.game.run('loadScenario(currentScenario,controls)');
    else f.game.run('finish(false)');
    const before=JSON.stringify([f.full.snapshot(),f.game.state(),f.game.rng(),f.port.state()]);
    dialog.answer(true);await dialog.done;assert.equal(dialog.applied(),0,change+'/'+index);
    assert.equal(JSON.stringify([f.full.snapshot(),f.game.state(),f.game.rng(),f.port.state()]),before,change+'/'+index);
  }
});
