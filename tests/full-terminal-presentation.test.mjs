import assert from 'node:assert/strict';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
async function setup(roles={player:'human',enemy:'human'},take=true){
  const game=await fullScene();game.context.controls={roles,seed:30,ui:{handoff(_seat,accept){if(take)accept();}}};
  const port=game.run('loadScenario(currentScenario,controls)'),full=game.context.GoblinCatalogFullRuntime;
  const host=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  const commit=command=>{const mode=port.state().controller;return port.commit(mode,port.open(mode)?.permit,command,host.dispatch);};
  return {game,port,full,commit};
}
test('terminal read keeps the last accepted human perspective across side changes and never grants actions',async()=>{
  for(const last of ['player','enemy'])for(const outcome of [true,false,'draw']){
    const {game,port,full,commit}=await setup(last==='player'?{player:'human',enemy:'ai'}:undefined);
    if(last==='enemy')for(let i=0;i<3;i++)assert.equal(commit({type:'EndPhase'}).ok,true);
    const oldTicket=port.ticket('human');
    if(last==='player')for(let i=0;i<3;i++)assert.equal(commit({type:'EndPhase'}).ok,true);
    game.context.result=outcome;game.run('finish(result)');
    assert.equal(port.state().side,null);assert.equal(port.state().phase,'over');assert.equal(port.state().humanReady,false);
    const before=JSON.stringify([full.snapshot(),game.state(),game.rng(),port.trainingArchive()]);
    for(let i=0;i<3;i++){
      const frame=port.project('human');assert.equal(frame.view.side,last);assert.equal(frame.view.activeSide,null);
      assert.equal(frame.view.ended,true);assert.equal(frame.view.outcome,outcome);assert.equal(frame.view.terrain.width,12);
    }
    assert.equal(port.project('ai'),null);assert.equal(port.open('human'),null);assert.equal(port.open('ai'),null);
    assert.equal(port.ticket('human'),null);assert.equal(port.canUndo(),false);assert.equal(port.undo(oldTicket),false);
    assert.equal(port.commit('human',oldTicket,{type:'EndPhase'},hostNever).ok,false);
    assert.equal(port.simulationSnapshot(oldTicket),null);assert.equal(port.qualifiedSelector(),null);
    assert.equal(JSON.stringify([full.snapshot(),game.state(),game.rng(),port.trainingArchive()]),before);
    port.pause();assert.equal(port.project('human'),null);
    port.resume();assert.equal(port.project('human').view.side,last);
    if(outcome===true){game.run('loadScenario(currentScenario,controls)');assert.equal(port.project('human'),null);}
    else{port.leave();assert.equal(port.project('human'),null);assert.equal(port.trainingArchive(),null);}
  }
});
const hostNever=()=>{throw Error('terminal dispatch must not run');};
test('terminal frame does not bypass handoff, hidden roster or audience log boundaries',async()=>{
  for(const roles of [{player:'human',enemy:'human'},{player:'ai',enemy:'ai'}]){
    const {game,port}=await setup(roles,false);game.run('finish(true)');assert.equal(port.project('human'),null);
  }
  const {game,port}=await setup();
  game.run(`{const phantom=units.find(unit=>unit.catalogId==='U21');phantom.x=11;phantom.y=7;
    GoblinCatalogFullRuntime.refresh();GoblinCatalogFullRuntime.log('hidden-terminal-action',{},[phantom.id]);
    GoblinCatalogFullRuntime.log('enemy-only-terminal-log',{},[],'enemy');}`);
  const phantom=game.run("units.find(unit=>unit.catalogId==='U21').id");
  assert.ok(!JSON.stringify(port.project('human')).includes(phantom));
  game.run('finish(false)');const terminal=JSON.stringify(port.project('human'));
  assert.ok(!terminal.includes(phantom));assert.ok(!terminal.includes('hidden-terminal-action'));assert.ok(!terminal.includes('enemy-only-terminal-log'));
});
