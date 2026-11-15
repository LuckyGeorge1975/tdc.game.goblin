import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {execute, read} from './artillery-product-harness.mjs';
import {createFullCatalogAiAdapter, createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';

const script = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const fixture = () => JSON.parse(script('tests/fixtures/full-draft-core-deadline.v3.json'));
const coreShot = fire('lead-tank', 'core');
const deadline = team => `GoblinCatalogFullRuntime.aiProjection('${team}').objectives.find(goal=>goal.kind==='enemy-turn-limit')??null`;
const entries = "GoblinCatalogFullRuntime.snapshot().logs.filter(row=>row.key==='v2.full.limit.removed')";
const journal = "GoblinCatalogFullRuntime.snapshot().journal.filter(row=>row.type==='deadline-removed')";

function fire(actorId, runtimeUnitId) {
  return {type:'CatalogFire',actorId,target:{kind:'unit',runtimeUnitId},weaponId:null,mode:'direct',spotterId:null};
}

async function setup(draft = fixture()) {
  const game = await fullScene('catalog-full-terrain-course',7,false,'FULL_CATALOG_v1');
  for (const name of ['level-events.js','editor-draft.js']) game.run(script(name));
  game.context.documentText = JSON.stringify(draft);
  game.run(`const goalDraft=GoblinEditorDraft.parse(documentText);
    GameDialogs.warn=GameDialogs.confirm=()=>{throw Error('unexpected dialog')};`);
  await game.run('const preparedDraft=GoblinEditorDraft.prepare(goalDraft);preparedDraft.then(loadEditorDraft)');
  return game;
}

function moveLead(game) {
  assert.equal(execute(game,{type:'Move',actorId:'lead-tank',x:4,y:3}).ok,true);
}

function advanceOpponent(game) {
  game.run("if(turnPhase==='movement')setTurnPhase('fire');if(turnPhase==='fire')setTurnPhase('gev');startEnemyTurn()");
  const task = [...game.timers].find(([,callback])=>String(callback).includes('const foes='));
  assert.ok(task);
  game.timers.delete(task[0]);
  task[1]();
}

function adapterFor(game) {
  const player = game.run('({query,dispatch})');
  const host = createFullCatalogAiHost(game.context.GoblinCatalogFullRuntime, game.context.GoblinSpecialistsUI,
    player, () => game.run('phase'), game.context.GoblinSpecialistsRuntime);
  return createFullCatalogAiAdapter(host, () => game.run('legacySession.sessionId'));
}

function request(batch, option) {
  return {schemaVersion:batch.schemaVersion,decisionId:batch.decisionId,revision:batch.revision,key:option.key};
}

test('the FULL test draft round-trips an explicit deadline event and rejects incompatible declarations', async () => {
  const game = await setup();
  const canonical = game.run('GoblinEditorDraft.exportJson(goalDraft)');
  assert.equal(game.run('GoblinEditorDraft.exportJson(GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(goalDraft)))'),canonical);
  assert.deepEqual(JSON.parse(canonical).events,fixture().events);
  for (const mutate of [
    "draft.events[0].when.unitId='guard'",
    "draft.events[0].when.event='UnitActed'",
    "draft.events[0].effect.turns=9",
    "draft.events.push({...draft.events[0],id:'second-event'})",
    "delete draft.goals",
    "draft.ruleProfile='CORE_IRON_DUST_v2'"
  ]) assert.throws(()=>game.run(`{const draft=structuredClone(goalDraft);${mutate};GoblinEditorDraft.validate(draft)}`),
    /events|goals|schema/);
});

test('core destruction in turn 2 removes the deadline once, rejects stale KI and keeps the later BACK range', async () => {
  const game = await setup();
  moveLead(game);
  game.context.rollQueue=[0.01,0.01,0.01];
  advanceOpponent(game);
  assert.equal(game.run('turn'),2);
  game.run("setTurnPhase('fire')");
  assert.deepEqual(read(game,deadline('player')),{kind:'enemy-turn-limit',turns:2,completedEnemyTurns:1});
  assert.deepEqual(read(game,deadline('enemy')),read(game,deadline('player')));
  const adapter = adapterFor(game);
  game.context.rollQueue=[0.01,0.99,0.01,0.99];
  assert.equal(execute(game,fire('first-tank','guard')).ok,true);
  assert.equal(game.run('phaseCommands.length'),1);
  const old = adapter.open('player');
  const oldShot = old.candidates.find(option=>option.kind==='fire'&&option.actorId==='second-tank');
  assert.ok(oldShot);
  assert.equal(execute(game,coreShot).ok,true);
  assert.equal(game.run('gameOver'),false);
  assert.equal(game.run('phaseCommands.length'),0);
  const beforeStale = game.rng();
  const revision = game.run('GoblinCatalogFullRuntime.commandRevision()');
  assert.equal(adapter.execute(request(old,oldShot)).code,'AI_STALE_DECISION');
  assert.deepEqual(game.rng(),beforeStale);
  assert.equal(game.run('GoblinCatalogFullRuntime.commandRevision()'),revision);
  const current = adapter.open('player');
  assert.ok(current.view.objectives.some(goal=>goal.kind==='destroy-core'&&goal.satisfied));
  assert.ok(current.view.objectives.some(goal=>goal.kind==='destroy-escort'));
  assert.ok(read(game,'GoblinCatalogFullRuntime.aiProjection("enemy").objectives')
    .some(goal=>goal.kind==='protect-core'&&!goal.satisfied));
  assert.equal(read(game,deadline('player')),null);
  assert.equal(read(game,deadline('enemy')),null);
  assert.equal(read(game,entries).length,1);
  assert.equal(read(game,journal).length,1);
  const later = current.candidates.find(option=>option.kind==='fire'&&option.actorId==='second-tank');
  assert.equal(adapter.execute(request(current,later)).ok,true);
  assert.equal(game.run('phaseCommands.length'),1);
  const afterShot = game.rng();
  game.run('undoPhaseCommand();undoPhaseCommand()');
  assert.deepEqual(read(game,`['first-tank','lead-tank','second-tank'].map(id=>units.find(unit=>unit.id===id).fired)`),
    [true,true,false]);
  assert.equal(game.run('phaseCommands.length'),0);
  const redo = adapter.open('player');
  const option = redo.candidates.find(candidate=>candidate.kind==='fire'&&candidate.actorId==='second-tank');
  assert.equal(adapter.execute(request(redo,option)).ok,true);
  assert.deepEqual(game.rng(),afterShot);
  game.context.rollQueue=[0.01,0.01,0.01];
  advanceOpponent(game);
  assert.equal(game.run('turn'),3);
  assert.equal(game.run('gameOver'),false);
  assert.equal(read(game,entries).length,1);
  await game.run('preparedDraft.then(loadEditorDraft)');
  assert.equal(game.run('turn'),1);
  assert.deepEqual(read(game,deadline('player')),{kind:'enemy-turn-limit',turns:2,completedEnemyTurns:0});
  assert.equal(read(game,entries).length,0);
  assert.equal(read(game,journal).length,0);
});

test('the final shot applies and logs the goal transition before terminal victory', async () => {
  const draft = fixture();
  draft.units = draft.units.filter(unit=>unit.id!=='guard');
  const game = await setup(draft);
  moveLead(game);
  game.run(`setTurnPhase('fire');
    const nativeFinish=finish, terminalEntries=[];
    finish=win=>{
      terminalEntries.push({win,limit:GoblinCatalogFullRuntime.status().turnLimit,logs:${entries}});
      return nativeFinish(win);
    };`);
  game.context.rollQueue=[0.99];
  const adapter = adapterFor(game);
  const batch = adapter.open('player');
  const shot = batch.candidates.find(option=>option.kind==='fire'&&option.actorId==='lead-tank');
  assert.equal(adapter.execute(request(batch,shot)).ok,true);
  assert.deepEqual(read(game,'terminalEntries'),[{win:true,limit:null,
    logs:[{key:'v2.full.limit.removed',params:{},subjects:[]}]}]);
  assert.equal(game.run('GoblinCatalogFullRuntime.terminalOutcome()'),true);
  assert.equal(game.rolls(),1);
  assert.equal(adapter.execute(request(batch,shot)).code,'AI_STALE_DECISION');
  assert.equal(game.rolls(),1);
});

test('a disabled core leaves the deadline active and the unfulfilled mission loses at the second enemy end', async () => {
  const draft = fixture();
  draft.units = draft.units.filter(unit=>unit.id!=='guard');
  const game = await setup(draft);
  moveLead(game);
  game.run("setTurnPhase('fire')");
  game.context.rollQueue=[0.75];
  assert.equal(execute(game,coreShot).ok,true);
  assert.deepEqual(read(game,"units.filter(unit=>unit.id==='core').map(unit=>[unitAlive(unit),unit.disabled])"),[[true,true]]);
  assert.equal(read(game,deadline('player')).turns,2);
  assert.equal(read(game,entries).length,0);
  advanceOpponent(game);
  assert.equal(game.run('turn'),2);
  assert.equal(game.run('gameOver'),false);
  advanceOpponent(game);
  assert.equal(game.run('turn'),2);
  assert.equal(game.run('GoblinCatalogFullRuntime.terminalOutcome()'),false);
  assert.equal(read(game,entries).length,0);
});
