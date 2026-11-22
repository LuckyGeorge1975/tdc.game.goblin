import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fullScene} from '../catalog-full-harness.mjs';
import {read} from '../artillery-product-harness.mjs';
import {createFullCatalogAiHost} from '../../src/core/full-catalog-ai-adapter.mjs';
import {gameplaySourceHashes,verifyGameplay} from './replay-source-binding.mjs';
import {createFullRoundSource} from '../../full-round-source.mjs';

const source=path=>fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
export const currentTraceDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const end={type:'EndPhase'};
export const currentCases=['player','enemy','draw'].map(outcome=>({outcome,seed:30,
  draft:{version:'goblin-level-v3',width:8,height:8,objective:'eliminate-opponent',terrain:[],units:[
    {id:'p',assetId:outcome==='enemy'?'field-engineers':'strategic-missile-carrier',team:'player',x:outcome==='enemy'?4:1,y:1},
    {id:'e',assetId:outcome==='enemy'?'strategic-missile-carrier':'field-engineers',team:'enemy',x:outcome==='enemy'?1:outcome==='draw'?2:4,y:1}
  ]}}));

export async function playCurrentCase(definition,expected){
  const game=await fullScene('catalog-full-atlas',7,true);
  for(const path of ['level-events.js','editor-draft.js','m1-unit-markers.js'])game.run(source(path));
  game.context.currentDraft=definition.draft;
  game.context.currentSeed=definition.seed;
  const events=[];let port;
  const round=createFullRoundSource(()=>({...game.run('({session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver})'),port}));
  game.context.GoblinFullRoundSource=Object.freeze({...round,
    record(event,frames){events.push({event:plain(event),frames:plain(frames)});round.record(event,frames);},
    recordPrivate(event){events.push({private:plain(event)});round.recordPrivate(event);}});
  port=await game.run(`GoblinEditorDraft.prepare(currentDraft).then(config=>loadEditorDraft(config,
    {roles:{player:'human',enemy:'human'},seed:currentSeed,ui:{handoff(_seat,take){take()}}}))`);
  const full=game.context.GoblinCatalogFullRuntime;
  const host=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  function facts(){return {world:JSON.parse(game.state()),full:plain(full.snapshot()),
    markers:read(game,"M1UnitMarkers.legacy(legacySession,units,'current-full',gameOver?victoryOutcome(victoryProfile(legacySession.effectiveRules),units):null)"),
    history:read(game,'phaseCommands.map(({log,...entry})=>entry)'),
    ambientRng:game.rng(),presentation:{legacy:read(game,'GoblinPresentation.read()'),round:plain(round.view())},events:plain(events)};}
  const result={definition,initial:facts(),steps:[]};
  if(expected)assert.deepEqual(result.initial,expected.initial,'current initial world/events/RNG');
  function accept(command){
    const before=port.open('human');assert.equal(before.entries,null);
    const offer=[...host.humanPlayerOptions(port).map(item=>plain(item.command)),end];
    assert.ok(offer.some(item=>JSON.stringify(item)===JSON.stringify(command)),'command absent from complete offer');
    const applied=port.commit('human',before.permit,command,host.dispatch);
    assert.equal(applied.ok,true,applied.code);
    const step={op:'commit',side:before.permit.side,phase:before.permit.phase,command,offer,result:plain(applied),after:facts()};
    if(expected)assert.deepEqual(step,expected.steps[result.steps.length],'current step '+result.steps.length);
    result.steps.push(step);
    const snapshot=facts();
    assert.equal(port.commit('human',before.permit,command,host.dispatch).code,'FULL_CONTROL_STALE');
    assert.deepEqual(facts(),snapshot,'consumed permission mutation');
  }
  // A real movement, its nonempty history and the native undo branch precede a
  // complete round. No world edit or injected combat roll is used in this capture.
  const move=host.humanPlayerOptions(port).find(item=>item.command.type==='Move');
  assert.ok(move);accept(plain(move.command));
  assert.equal(port.undo(port.ticket('human')),true);
  const undone={op:'undo',after:facts()};
  if(expected)assert.deepEqual(undone,expected.steps[result.steps.length],'current undo');
  result.steps.push(undone);
  for(let phase=0;phase<6;phase++)accept(end);
  if(definition.outcome==='enemy')for(let phase=0;phase<3;phase++)accept(end);
  accept(end);
  const shooter=definition.outcome==='enemy'?'e':'p';
  accept({type:'CatalogHexFire',actorId:shooter,x:definition.outcome==='draw'?1:4,y:1});
  assert.equal(port.state().ended,true);
  assert.equal(port.state().outcome,definition.outcome==='draw'?'draw':definition.outcome==='player');
  result.archive=plain(port.trainingArchive());
  assert.equal(result.archive.outcome,definition.outcome);
  assert.equal(result.archive.replay.entries.at(-1).draws,definition.outcome==='draw'?2:1);
  assert.equal(result.archive.replay.entries.some(entry=>entry.command.type==='Move'),false,'undone command leaked into effective journal');
  if(expected){assert.equal(result.steps.length,expected.steps.length);assert.deepEqual(result.archive,expected.archive,'current native archive');}
  return result;
}

export async function captureCurrentTrace(){
  verifyGameplay();
  const cases=[];for(const definition of currentCases)cases.push(await playCurrentCase(definition));
  return {version:'current-full-native-oracle-v1',runtimeCommit:'a6ed74f05ac9cfb190655fb4046cddf97124311b',
    sources:gameplaySourceHashes(),cases};
}
export async function replayCurrentTrace(trace){
  assert.equal(trace.version,'current-full-native-oracle-v1');
  assert.equal(trace.runtimeCommit,'a6ed74f05ac9cfb190655fb4046cddf97124311b');
  assert.deepEqual(trace.sources,gameplaySourceHashes(),'current source guard');
  assert.deepEqual(trace.cases.map(item=>item.definition),currentCases,'current scenario/seed contract');
  for(const item of trace.cases)await playCurrentCase(item.definition,item);
}
