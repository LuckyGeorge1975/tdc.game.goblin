import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';

const atlas='catalog-full-atlas';
const script=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const full=()=>fullScene(atlas,7,false,'FULL_CATALOG_v1');
const snapshot=game=>read(game,'({units,turn,phase,turnPhase,gameOver,full:GoblinCatalogFullRuntime.snapshot()})');
const portOf=game=>game.run('GoblinCatalogFullRuntime.controllerPort()');
const nextPlayerPhase={type:'EndPhase'};

function load(game,roles,ui={}){
  game.context.control={roles,ui};
  return game.run('loadScenario("catalog-full-atlas",control)');
}

function playerHost(game){
  return createFullCatalogAiHost(game.context.GoblinCatalogFullRuntime,game.context.GoblinSpecialistsUI,
    game.context.GoblinCatalogFullRuntime.nativePlayerGateway,()=>game.run('phase'),game.context.GoblinSpecialistsRuntime);
}

function controller(game,port,select,onCommit){
  return createOwnedFullCatalogSessionHost({port,player:playerHost(game),select,onCommit});
}

function chooseEndPhase(batch){
  return batch.candidates.find(option=>option.kind==='end-phase').key;
}

function endPlayer(port,role){
  for(let phase=0;phase<3;phase++)assert.equal(port.commit(role,port.open(role).permit,nextPlayerPhase).ok,true);
}

function keepBaseline(game,port,role){
  const player=playerHost(game);
  for(let count=0;port.state()?.side==='enemy'&&count<100;count++){
    const opened=port.open(role);
    const command=game.context.GoblinCatalogFullRuntime.referenceCommand();
    assert.ok(opened&&command);
    assert.equal(port.commit(role,opened.permit,command,player.dispatch).ok,true);
  }
  assert.notEqual(port.state()?.side,'enemy');
}

function placeFight(game){
  game.run(`{
    const dread=units.find(u=>u.id==='catalog-full-atlas-20');
    const target=units.find(u=>u.id==='catalog-full-atlas-1');
    dread.x=1;dread.y=1;target.x=2;target.y=1;
    terrain.clear();terrainTypes.clear();GoblinCatalogFullRuntime.refresh();
  }`);
}

test('shared native phase and reference choices match direct own-port commits including seeded dice',async()=>{
  async function make(){
    const game=await full();for(const file of ['level-events.js','editor-draft.js'])game.run(script(file));
    game.context.source={version:'goblin-level-v3',width:6,height:5,objective:'core-and-escort',terrain:[],units:[
      {id:'p',assetId:'assault-tank',team:'player',x:1,y:2},
      {id:'e',assetId:'guard-tank',team:'enemy',x:2,y:2},
      {id:'core',assetId:'command-core',team:'enemy',x:5,y:4}]};
    await game.run('GoblinEditorDraft.prepare(source).then(config=>{globalThis.port=loadEditorDraft(config,{roles:{player:"ai",enemy:"ai"},seed:7})})');
    return {game,port:game.context.port};
  }
  const expected=await make();endPlayer(expected.port,'ai');keepBaseline(expected.game,expected.port,'ai');
  const {game,port}=await make();game.run("GameDialogs.confirm=()=>{throw Error('unexpected phase ACK')}");
  const commits=[],owners=[];
  const host=controller(game,port,{
    player:batch=>{owners.push(batch.side);return chooseEndPhase(batch)},
    enemy:batch=>{owners.push(batch.side);return (batch.candidates.find(c=>c.facts.baseline)||batch.candidates.find(c=>c.kind==='end-phase')).key}
  },receipt=>commits.push(receipt.action));
  for(let count=0;game.run('turn')===1&&count<30;count++)assert.equal((await host.advance()).ok,true);
  assert.deepEqual(commits.slice(0,3).map(c=>c.type),['EndPhase','EndPhase','EndPhase']);
  assert.deepEqual(owners.slice(0,3),['player','player','player']);
  assert.ok(owners.slice(3).every(side=>side==='enemy'));
  assert.deepEqual(snapshot(game),snapshot(expected.game));
  const replay=port.simulationSnapshot(port.ticket('ai')).replay;
  assert.deepEqual(JSON.parse(JSON.stringify(replay)),
    JSON.parse(JSON.stringify(expected.port.simulationSnapshot(expected.port.ticket('ai')).replay)));
  assert.equal(replay.entries.reduce((count,entry)=>count+entry.draws,0),1);
});

test('the enemy has the same distinct movement, fire and GEV opportunities with stale actor tickets rejected',async()=>{
  const game=await full(),port=load(game,{player:'ai',enemy:'ai'}),player=playerHost(game);
  placeFight(game);endPlayer(port,'ai');
  const movement=port.open('ai'),moves=player.playerOptions();
  assert.equal(movement.pass,'movement');
  assert.equal(movement.permit.actorId,null);
  assert.ok(moves.some(entry=>entry.command.type==='Move'));
  assert.ok(!moves.some(entry=>['CatalogFire','CatalogHexFire','EnemyHold'].includes(entry.command.type)));
  const move=moves.find(entry=>entry.command.type==='Move').command;
  const before=snapshot(game),rng=game.rng();
  assert.equal(port.commit('ai',movement.permit,{...move,actorId:'catalog-full-atlas-1'},player.dispatch).code,'FULL_CONTROL_ACTOR');
  assert.deepEqual(snapshot(game),before);assert.deepEqual(game.rng(),rng);
  assert.equal(port.commit('ai',movement.permit,{type:'EndPhase'}).ok,true);
  assert.equal(port.commit('ai',movement.permit,move,player.dispatch).code,'FULL_CONTROL_STALE');
  assert.equal(port.state().phase,'fire');
  const shots=player.playerOptions();
  assert.ok(shots.some(entry=>entry.command.type==='CatalogFire'&&entry.command.actorId==='catalog-full-atlas-20'));
  assert.ok(shots.every(entry=>['CatalogFire','CatalogHexFire'].includes(entry.command.type)));
  assert.equal(port.commit('ai',port.ticket('ai'),move,player.dispatch).ok,false);
  assert.equal(port.commit('ai',port.ticket('ai'),{type:'EndPhase'}).ok,true);
  assert.equal(port.state().phase,'gev');
  assert.ok(player.playerOptions().every(entry=>entry.command.type==='Move'));
});

test('human transfer exposes a side only after takeover; phase and input tickets are revoked at restart and leave',async()=>{
  const game=await full(), handoffs=[];
  const ui={handoff:(seat,accept)=>handoffs.push({seat,accept})};
  const port=load(game,{player:'human',enemy:'human'},ui);
  const host=controller(game,port,{player:()=>assert.fail('human planned'),enemy:()=>assert.fail('human planned')});
  assert.equal(port.project('human'),null);
  assert.equal(port.open('human'),null);
  assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
  const first=handoffs.at(-1);
  assert.equal(first.seat.side,'player');
  assert.equal(first.accept(),true);
  const human=port.project('human');
  assert.equal(human.view.side,'player');
  assert.ok(human.view.objectives.some(goal=>goal.kind==='destroy-core'));
  assert.equal(first.accept(),false);
  assert.equal(port.project('ai'),null);
  endPlayer(port,'human');
  const second=handoffs.at(-1);
  assert.equal(second.seat.side,'enemy');
  assert.equal(port.project('human'),null);
  assert.equal(first.accept(),false);
  assert.equal(second.accept(),true);
  assert.equal(port.project('human').view.side,'enemy');
  assert.ok(port.project('human').view.objectives.some(goal=>goal.kind==='protect-escort'));
  keepBaseline(game,port,'human');
  const waiting=handoffs.at(-1);
  assert.equal(waiting.seat.side,'player');
  const replaced=load(game,{player:'human',enemy:'human'},ui);
  assert.equal(port.project('human'),null);
  assert.equal(waiting.accept(),false);
  const fresh=handoffs.at(-1);
  assert.notEqual(fresh.seat.sessionId,waiting.seat.sessionId);
  replaced.leave();
  assert.equal(fresh.accept(),false);
  assert.equal(replaced.project('human'),null);
});

test('delayed enemy AI choice cannot affect a replacement session or trigger the native fallback',async()=>{
  const game=await full(), next=Promise.withResolvers();
  const port=load(game,{player:'ai',enemy:'ai'});
  endPlayer(port,'ai');
  let calls=0;
  const host=controller(game,port,{enemy:batch=>{
    calls++;
    return next.promise.then(()=>(batch.candidates.find(option=>option.facts.baseline)||batch.candidates.find(option=>option.kind==='end-phase')).key);
  }});
  const moving=host.advance();
  assert.equal((await host.advance()).code,'AI_HOST_UNAVAILABLE');
  const replacement=load(game,{player:'human',enemy:'human'});
  const before=snapshot(game), rng=game.rng();
  next.resolve();
  assert.equal((await moving).code,'AI_HOST_STALE');
  assert.equal(calls,1);
  assert.deepEqual(snapshot(game),before);
  assert.deepEqual(game.rng(),rng);
  assert.notEqual(replacement,port);
});

test('a rejected policy choice leaves the slot in place without automatic retry or extra rolls',async()=>{
  const game=await full(), calls=[];
  const port=load(game,{player:'ai',enemy:'ai'});
  endPlayer(port,'ai');
  const before=snapshot(game), rng=game.rng();
  const host=controller(game,port,{enemy:batch=>{
    calls.push(batch.slot);
    return 'not-a-native-candidate';
  }});
  assert.equal((await host.advance()).code,'AI_UNKNOWN_CANDIDATE');
  assert.equal((await host.advance()).code,'AI_FULL_NO_NEW_ACTION');
  assert.equal(calls.length,1);
  assert.deepEqual(snapshot(game),before);
  assert.deepEqual(game.rng(),rng);
});

test('a revision change invalidates a delayed choice without opening another plan on the same slot',async()=>{
  const game=await full(), choice=Promise.withResolvers();
  const port=load(game,{player:'ai',enemy:'ai'});
  endPlayer(port,'ai');
  let calls=0;
  const host=controller(game,port,{enemy:batch=>{
    calls++;
    return choice.promise.then(()=>(batch.candidates.find(option=>option.facts.baseline)||batch.candidates.find(option=>option.kind==='end-phase')).key);
  }});
  const before=port.ticket('ai');
  const pending=host.advance();
  game.run('GoblinCatalogFullRuntime.refresh()');
  const after=port.ticket('ai');
  assert.equal(after.slot,before.slot);
  assert.notEqual(after.revision,before.revision);
  const rng=game.rng(), unchanged=snapshot(game);
  choice.resolve();
  assert.equal((await pending).code,'AI_STALE_DECISION');
  assert.equal((await host.advance()).code,'AI_FULL_NO_NEW_ACTION');
  assert.equal(calls,1);
  assert.deepEqual(game.rng(),rng);
  assert.deepEqual(snapshot(game),unchanged);
});

test('seat projection omits concealed actors and opponent-only log activity',async()=>{
  const game=await full(), seats=[];
  const port=load(game,{player:'human',enemy:'human'},{handoff:(state,accept)=>seats.push(accept)});
  game.run(`{
    const phantom=units.find(unit=>unit.catalogId==='U21');
    phantom.x=11;phantom.y=7;
    GoblinCatalogFullRuntime.refresh();
    GoblinCatalogFullRuntime.log('hidden-test-action',{},[phantom.id]);
    GoblinCatalogFullRuntime.log('own-enemy-reinforcement',{},[],'enemy');
  }`);
  const phantom=game.run("units.find(unit=>unit.catalogId==='U21').id");
  assert.equal(seats.at(-1)(),true);
  assert.ok(!JSON.stringify(port.project('human')).includes(phantom));
  assert.ok(!JSON.stringify(port.project('human').log).includes('hidden-test-action'));
  assert.ok(!JSON.stringify(port.project('human').log).includes('own-enemy-reinforcement'));
  endPlayer(port,'human');
  assert.equal(port.project('human'),null);
  assert.equal(seats.at(-1)(),true);
  assert.ok(port.project('human').view.units.some(unit=>unit.id===phantom));
  assert.ok(JSON.stringify(port.project('human').log).includes('own-enemy-reinforcement'));
});

test('Scorched and a serialized draft use the same native owner; AI gate rejects before mutating a live session',async()=>{
  const game=await full();
  for(const name of ['level-events.js','editor-draft.js'])game.run(script(name));
  const scorched=JSON.parse(script('assets/unit-art/levels/scorched-earth.v3.json'))[0];
  game.context.text=JSON.stringify(scorched);
  game.context.control={roles:{player:'ai',enemy:'ai'}};
  await game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(text)).then(config=>loadEditorDraft(config,control))');
  const instance=portOf(game);
  assert.equal(instance.state().side,'player');
  assert.ok(instance.project('ai').view.objectives.some(goal=>goal.kind==='destroy-escort'));
  const host=controller(game,instance,{player:chooseEndPhase});
  assert.equal((await host.advance()).ok,true);
  const draft=JSON.parse(script('tests/fixtures/full-draft-core-deadline.v3.json'));
  game.context.text=JSON.stringify({...draft,aiAllowed:false});
  const before=snapshot(game), rng=game.rng();
  await assert.rejects(game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(text)).then(config=>loadEditorDraft(config,control))'),
    {code:'AI_LEVEL_FORBIDDEN'});
  assert.deepEqual(snapshot(game),before);
  assert.deepEqual(game.rng(),rng);
  game.context.text=JSON.stringify(draft);
  await game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(text)).then(config=>loadEditorDraft(config,control))');
  const imported=portOf(game);
  assert.notEqual(imported.state().sessionId,instance.state()?.sessionId);
  assert.equal(instance.project('ai'),null);
  assert.ok(imported.project('ai').view.objectives.some(goal=>goal.kind==='enemy-turn-limit'&&goal.turns===2));
});
