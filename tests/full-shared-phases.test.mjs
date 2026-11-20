import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createHeadlessFullEngine} from '../src/core/full-worker-engine.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from '../src/core/full-catalog-ai-adapter.mjs';
import {fullScene} from './catalog-full-harness.mjs';
import {importFullTrainingArchive} from '../scripts/full-training-import.mjs';
import {createSimulationPort} from '../src/core/full-strong-simulation.mjs';
import {evaluateStrongBranch} from '../src/core/strong-search.mjs';

const readSource=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const registry=JSON.parse(readSource('assets/unit-art/rules/unit-profiles.catalog-approved.v1.json'));
const levels=JSON.parse(readSource('assets/unit-art/levels/catalog-full-levels.v3.json'));
const unit=(id,assetId,team,x,y,extra={})=>({id,assetId,team,x,y,...extra});
const draft=(units,terrain=[])=>({version:'goblin-level-v3',width:8,height:8,objective:'eliminate-opponent',terrain,units});
const hostFor=(full,ui,port,specialists)=>createFullCatalogAiHost(full,ui,full.nativePlayerGateway,()=>port.state()?.side,specialists);
async function fixture(source,side='player',seed=7){
  const engine=await createHeadlessFullEngine({readSource});
  await engine.initialize(registry,levels);
  const {port}=await engine.loadConfig(null,seed,'editor-draft',source);
  const full=engine.root.GoblinCatalogFullRuntime;
  const host=hostFor(full,engine.root.GoblinSpecialistsUI,port,engine.root.GoblinSpecialistsRuntime);
  const accept=command=>{const result=port.commit('ai',port.open('ai').permit,command,host.dispatch);assert.equal(result.ok,true,result.code);};
  if(side==='enemy')for(let i=0;i<3;i++)accept({type:'EndPhase'});
  return {engine,port,full,host,accept,options:()=>host.playerOptions(true),
    own:id=>full.roster(side).find(unit=>unit.id===id)};
}

test('both FULL seats share movement/fire/GEV and the mirrored native engineer permission',async()=>{
  const f=await fixture(draft([unit('p','field-engineers','player',1,1),unit('e','field-engineers','enemy',6,6)],
    [{x:1,y:2,type:'rubble-field'},{x:6,y:5,type:'rubble-field'}]));
  try{
    for(const [side,id,x,y]of [['player','p',1,2],['enemy','e',6,5]]){
      assert.equal(f.port.state().side,side);
      const clear=f.options().find(({command})=>command.type==='Engineer'&&command.actorId===id&&command.job==='clear');
      assert.deepEqual(clear.command,{type:'Engineer',actorId:id,job:'clear',target:{kind:'cell',x,y},option:null});
      const actor=f.full.roster(side).find(unit=>unit.id===id),material=actor.material;
      f.accept(clear.command);
      assert.equal(actor.material,material-1);
      assert.equal(actor.moved,true);
      assert.equal(actor.fired,true);
      assert.equal(f.host.playerOptions(true).some(({command})=>command.type==='Engineer'&&command.actorId===id),false);
      for(const phase of ['movement','fire','gev']){
        assert.equal(f.port.state().phase,phase);
        f.accept({type:'EndPhase'});
      }
    }
    assert.equal(f.engine.state().turn,2);
    assert.equal(f.port.state().side,'player');
    assert.equal(f.full.roster('player').find(unit=>unit.id==='p').material,2);
    const token=f.port.ticket('ai'),before=JSON.stringify(f.full.snapshot());
    assert.equal(f.port.commit('ai',token,{type:'Move',actorId:'e',x:5,y:5},f.host.dispatch).ok,false);
    assert.equal(JSON.stringify(f.full.snapshot()),before);
    f.accept({type:'EndPhase'});
    assert.equal(f.port.commit('ai',token,{type:'EndPhase'},f.host.dispatch).ok,false);
  }finally{f.engine.dispose();}
});

test('both seats get exactly the catalog primary move and the separate GEV move',async()=>{
  for(const side of ['player','enemy']){
    const f=await fixture(draft([unit('p','combat-skimmer','player',1,1),unit('e','combat-skimmer','enemy',6,6)]),side);
    try{
      const id=side==='player'?'p':'e',actor=f.own(id);
      f.accept(f.options().find(({command})=>command.type==='Move'&&command.actorId===id).command);
      assert.equal(actor.moved,true);
      assert.equal(f.options().some(({command})=>command.type==='Move'&&command.actorId===id),false);
      f.accept({type:'EndPhase'});f.accept({type:'EndPhase'});
      assert.equal(f.port.state().phase,'gev');
      const second=f.options().find(({command})=>command.type==='Move'&&command.actorId===id);
      assert.ok(second);
      f.accept(second.command);
      assert.equal(actor.secondMoved,true);
      assert.equal(f.options().some(({command})=>command.type==='Move'&&command.actorId===id),false);
    }finally{f.engine.dispose();}
  }
});

test('infantry transport consumes the same cargo movement and prevents a same-turn unload on both seats',async()=>{
  for(const side of ['player','enemy']){
    const f=await fixture(draft([unit('pc','skimmer-carrier','player',2,1),unit('pi','infantry-squad','player',1,1,{squads:1}),
      unit('ec','skimmer-carrier','enemy',5,6),unit('ei','infantry-squad','enemy',6,6,{squads:1})]),side);
    try{
      const prefix=side==='player'?'p':'e';
      const load=f.options().find(({command})=>command.type==='Embark'&&command.actorId===prefix+'i');
      assert.ok(load);
      f.accept(load.command);
      assert.equal(f.own(prefix+'i').embarkedOn,prefix+'c');
      assert.equal(f.own(prefix+'i').moved,true);
      assert.equal(f.own(prefix+'c').moved,false);
      assert.equal(f.options().some(({command})=>command.type==='Unload'),false);
    }finally{f.engine.dispose();}
  }
});

test('Forge loading and deployment retain their own-turn drone budgets on both seats',async()=>{
  for(const side of ['player','enemy']){
    const f=await fixture(draft([unit('pf','forge-engineer','player',2,1),unit('pd','artillery-drone','player',1,1),
      unit('ef','forge-engineer','enemy',5,6),unit('ed','artillery-drone','enemy',6,6)]),side);
    try{
      const prefix=side==='player'?'p':'e';
      const load=f.options().find(({command})=>command.type==='CatalogLoad'&&command.actorId===prefix+'d');
      assert.ok(load);
      f.accept(load.command);
      assert.equal(f.own(prefix+'f').moved,true);
      assert.equal(f.own(prefix+'d').moved,true);
      assert.equal(f.own(prefix+'d').fired,true);
      assert.equal(f.options().some(({command})=>command.type==='CatalogDeploy'&&command.actorId===prefix+'f'),false);
      for(let i=0;i<6;i++)f.accept({type:'EndPhase'});
      assert.equal(f.port.state().side,side);
      const deploy=f.options().find(({command})=>command.type==='CatalogDeploy'&&command.actorId===prefix+'f');
      assert.ok(deploy);
      f.accept(deploy.command);
      assert.equal(f.own(prefix+'d').embarkedOn,null);
      assert.equal(f.own(prefix+'d').fired,true);
      assert.equal(f.own(prefix+'d').droneReadyTurn,f.engine.state().turn+1);
    }finally{f.engine.dispose();}
  }
});

test('both seats can ram the same legal vehicle class and spend the primary movement',async()=>{
  for(const side of ['player','enemy']){
    const f=await fixture(draft([unit('po','goblin-dreadnaught','player',1,1),unit('pg','guard-tank','player',5,6),
      unit('eo','goblin-dreadnaught','enemy',6,6),unit('eg','guard-tank','enemy',2,1)]),side);
    try{
      const id=side==='player'?'po':'eo',target=side==='player'?'eg':'pg';
      const ram=f.options().find(({command})=>command.type==='CatalogRam'&&command.actorId===id&&command.targetId===target);
      assert.ok(ram);
      f.accept(ram.command);
      assert.equal(f.own(id).moved,true);
      assert.equal(f.full.roster(side).find(unit=>unit.id===target).hp,0);
    }finally{f.engine.dispose();}
  }
});

test('system weapon slots and expendable missiles have identical reset rules on both seats',async()=>{
  for(const side of ['player','enemy']){
    const f=await fixture(draft([unit('p','goblin-dreadnaught','player',1,2),unit('e','goblin-dreadnaught','enemy',4,2)]),side);
    try{
      const id=side==='player'?'p':'e',target=side==='player'?'e':'p';
      f.accept({type:'EndPhase'});f.engine.setModalRoll(0);
      const choose=weapon=>f.options().find(({command})=>command.type==='CatalogFire'&&command.actorId===id&&
        command.weaponId===weapon&&command.target.runtimeUnitId===target&&command.target.componentId==='treads');
      for(const weapon of ['main-1','main-2','missiles-1']){
        assert.ok(choose(weapon),weapon);
        f.accept(choose(weapon).command);
        assert.equal(choose(weapon),undefined);
      }
      for(let i=0;i<5;i++)f.accept({type:'EndPhase'});
      const slots=f.own(id).catalogSystems.components;
      assert.equal(slots.find(slot=>slot.id==='main-1').fired,false);
      assert.equal(slots.find(slot=>slot.id==='main-2').fired,false);
      assert.equal(slots.find(slot=>slot.id==='missiles-1').spent,true);
    }finally{f.engine.dispose();}
  }
});

test('a native simultaneous elimination is a distinct draw and its seeded archive replays as draw',async()=>{
  const game=await fullScene();for(const file of ['level-events.js','editor-draft.js'])game.run(readSource(file));
  game.context.source=draft([unit('p','strategic-missile-carrier','player',1,1),unit('e','field-engineers','enemy',2,1)]);
  await game.run(`GoblinEditorDraft.prepare(source).then(config=>{globalThis.port=loadEditorDraft(config,
    {roles:{player:'human',enemy:'human'},seed:30,ui:{handoff(_seat,take){take()}}})})`);
  const port=game.context.port,full=game.context.GoblinCatalogFullRuntime;
  const host=hostFor(full,game.context.GoblinSpecialistsUI,port,game.context.GoblinSpecialistsRuntime);
  const commit=command=>assert.equal(port.commit('human',port.open('human').permit,command,host.dispatch).ok,true);
  commit({type:'EndPhase'});commit({type:'CatalogHexFire',actorId:'p',x:1,y:1});
  assert.equal(game.run('units.filter(unitAlive).length'),0);
  assert.equal(port.state().outcome,'draw');
  assert.equal(port.state().ended,true);
  const archive=JSON.parse(JSON.stringify(port.trainingArchive()));
  assert.equal(archive.outcome,'draw');
  assert.equal(archive.replay.entries.at(-1).draws,2);
  const result=await importFullTrainingArchive(archive);
  assert.equal(result.outcome,'draw');
  assert.equal(result.acceptedCommands,2);
});

test('human Undo on either seat rewinds its effective journal and repeats the same native seeded shot',async()=>{
  for(const side of ['player','enemy']){
    const game=await fullScene();for(const file of ['level-events.js','editor-draft.js'])game.run(readSource(file));
    game.context.source=draft([unit('p','assault-tank','player',2,2),unit('e','assault-tank','enemy',3,2)]);
    await game.run(`GoblinEditorDraft.prepare(source).then(config=>{globalThis.port=loadEditorDraft(config,
      {roles:{player:'human',enemy:'human'},seed:7,ui:{handoff(_seat,take){take()}}})})`);
    const port=game.context.port,full=game.context.GoblinCatalogFullRuntime;
    const host=hostFor(full,game.context.GoblinSpecialistsUI,port,game.context.GoblinSpecialistsRuntime);
    const accept=command=>assert.equal(port.commit('human',port.open('human').permit,command,host.dispatch).ok,true);
    if(side==='enemy')for(let i=0;i<3;i++)accept({type:'EndPhase'});
    accept({type:'EndPhase'});
    const shot=host.humanPlayerOptions(port).find(({command})=>command.type==='CatalogFire').command;
    const before=JSON.stringify(full.snapshot());
    accept(shot);
    const roll=full.roster(side).find(unit=>unit.id===shot.actorId).specialistJournal.at(-1).result.outcome.roll;
    assert.equal(port.canUndo(),true);
    const stale=port.ticket('human');
    port.pause();assert.equal(port.undo(stale),false);port.resume();
    assert.equal(port.undo(stale),false);
    game.run('undoPhaseCommand()');
    assert.equal(port.canUndo(),true,'a direct background Back/Hotkey cannot bypass the current port ticket');
    assert.equal(port.undo(port.ticket('human')),true);
    assert.equal(JSON.stringify(full.snapshot()),before);
    assert.equal(port.canUndo(),false);
    accept(shot);
    assert.equal(full.roster(side).find(unit=>unit.id===shot.actorId).specialistJournal.at(-1).result.outcome.roll,roll);
    for(let step=0;!port.state().ended&&step<64;step++){
      const fire=host.humanPlayerOptions(port).find(({command})=>command.type==='CatalogFire');
      accept(fire?.command??{type:'EndPhase'});
    }
    assert.equal(port.state().ended,true);
    const archive=JSON.parse(JSON.stringify(port.trainingArchive()));
    const shots=archive.replay.entries.filter(entry=>entry.command.type==='CatalogFire');
    assert.equal(shots.length,3,'the discarded shot is absent from the effective journal');
    assert.ok(shots.every(entry=>entry.draws===1));
    assert.equal((await importFullTrainingArchive(archive)).acceptedCommands,archive.replay.entries.length);
  }
});

test('the common simulation carries a draw distinctly and unresolved public targets never invent a draw',async()=>{
  for(const side of ['player','enemy'])for(const hidden of [false,true]){
    const opposite=side==='player'?'enemy':'player';
    const f=await fixture(draft([unit('missile','strategic-missile-carrier',side,1,1),
      unit('target','infantry-squad',opposite,2,1,{squads:1}),
      ...(hidden?[unit('hidden','phantom-platform',opposite,7,7)]:[])]),side);
    try{
      f.accept({type:'EndPhase'});
      const adapter=createOwnedFullCatalogAiAdapter(f.port,f.host),batch=adapter.open(side);
      const packet=adapter.captureStrongDecision(batch);
      const model=await createSimulationPort(packet,{levelData:levels,engineFactory:()=>createHeadlessFullEngine({readSource})});
      try{
        model.commit({type:'CatalogHexFire',actorId:'missile',x:1,y:1});
        assert.equal(model.status().ended,true);
        assert.equal(model.status().winner,hidden?opposite:'draw');
        assert.equal(model.evaluate(side),hidden?-100000:0);
      }finally{model.dispose();}
    }finally{f.engine.dispose();}
  }
});

test('a Strong branch completes all three opponent phases under the same native turn contract',async()=>{
  for(const side of ['player','enemy']){
    const f=await fixture(draft([unit('p','assault-tank','player',1,1),unit('e','assault-tank','enemy',6,6)]),side);
    try{
      const adapter=createOwnedFullCatalogAiAdapter(f.port,f.host),batch=adapter.open(side);
      const packet=adapter.captureStrongDecision(batch),before=JSON.stringify(packet.snapshot);
      assert.equal(packet.actions.length,batch.candidates.length);
      const pass=packet.actions.findIndex(({action})=>action.type==='EndPhase');
      const result=await evaluateStrongBranch(packet,pass,
        captured=>createSimulationPort(captured,{levelData:levels,engineFactory:()=>createHeadlessFullEngine({readSource})}));
      const replies=result.continuation.filter(entry=>entry.side!==side);
      assert.equal(replies.filter(entry=>entry.action.type==='EndPhase').length,3);
      assert.ok(replies.some(entry=>entry.action.type==='Move'));
      assert.equal(result.final.side,side);
      assert.equal(result.final.turn,2);
      assert.equal(JSON.stringify(f.port.simulationSnapshot(f.port.ticket('ai'))),before);
    }finally{f.engine.dispose();}
  }
});
