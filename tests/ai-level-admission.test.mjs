import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {read,execute} from './artillery-product-harness.mjs';
import {fullShell,fullScene} from './catalog-full-harness.mjs';
import {apply,route,snapshot,trainingScene} from './training-product-harness.mjs';
import {createIronDustSpectatorMatch} from '../spectator-session.mjs';
import {createIronDustBrowserSession,createIronDustDecisionHost,dispatchIronDustBrowserAction} from '../iron-dust-browser-v2.mjs';
import {IRON_DUST_LEVEL_V3} from '../src/levels/iron-dust.v3.mjs';
import {validateIronDustLevelV3} from '../src/levels/iron-dust.v1.mjs';
import {playIronDustProfileReplay} from '../src/core/iron-dust-profile-replay.mjs';
import {recordIronDustCommands} from './helpers/iron-dust-commit-replay.mjs';

const source=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const ui=source('ui-v2.js');
test('Core admission ignores inherited permission and validates own values', () => {
  for (const inherited of [false, 'false']) {
    const level = Object.assign(Object.create({aiAllowed:inherited}), IRON_DUST_LEVEL_V3);
    assert.deepEqual(validateIronDustLevelV3(level), validateIronDustLevelV3(IRON_DUST_LEVEL_V3));
  }
  for (const aiAllowed of [true, false])
    assert.equal(validateIronDustLevelV3({...IRON_DUST_LEVEL_V3,aiAllowed}).aiAllowed, aiAllowed);
  for (const aiAllowed of [undefined, null, 'false'])
    assert.throws(() => validateIronDustLevelV3({...IRON_DUST_LEVEL_V3,aiAllowed}), /SCENARIO_AI_PERMISSION_INVALID/);
});
function installHost(game){
  game.run(ui.split('\n').find(line=>line.startsWith('    const targetOccupant ='))+'\n'+
    ui.slice(ui.indexOf('    function legacyCommands('),ui.indexOf('    const targetCommands =')));
  return game.run('legacyAiHost()');
}

for(const id of ['training-t01','training-t02','training-t03'])test(`${id} blocks both policy entries before phase or UI state is changed`,async()=>{
  const game=await trainingScene(id);
  game.context.newLevels=JSON.parse(source('assets/training/levels.v3.json'));
  assert.ok(game.context.newLevels.levels.every(level=>level.aiAllowed===false));
  await game.run('GoblinTrainingModel.initialize(newLevels,trainingScripts)');
  const host=installHost(game);
  const commands=route(id);
  const move=commands.find(step=>step.command).command;
  assert.equal(execute(game,move).ok,true);
  game.run('selected=units[0]');
  const before=snapshot(game), timers=[...game.timers];
  assert.equal(host.revision(),null);
  for(const expression of ['startEnemyTurn(()=>{})','startEnemyTurn(undefined,()=>{})','enemyTurn(()=>{})','enemyTurn(undefined,()=>{})']){
    assert.throws(()=>game.run(expression),{code:'AI_LEVEL_FORBIDDEN'});
    assert.deepEqual(snapshot(game),before);
    assert.deepEqual([...game.timers],timers);
    assert.equal(game.run('selected===units[0]'),true);
  }
  const denied=[true,'false',1,null];
  for(const bad of denied){
    game.context.bad=bad;
    await assert.rejects(game.run('GoblinTrainingModel.initialize({ ...newLevels,levels:newLevels.levels.map(level=>({...level,aiAllowed:bad})) },trainingScripts)'),/TRAINING_SOURCE_VERSION/);
  }
  game.run(`loadScenario('${id}')`);
  for(const action of commands)apply(game,action);
  assert.equal(read(game,'GoblinTrainingRuntime.status()'),'lesson-complete');
});

test('the editor preserves explicit permissions and permits historical absent values',async()=>{
  const game=await fullScene('catalog-full-terrain-course',7,false,'FULL_CATALOG_v1');
  game.run(source('editor-draft.js'));
  const start=game.run('GoblinEditorDraft.copyTemplate()');
  assert.equal(Object.hasOwn(start,'aiAllowed'),false);
  for(const permission of [true,false]){
    game.context.permission=permission;
    const prepared=await game.run(`GoblinEditorDraft.prepare(GoblinEditorDraft.importLevels(JSON.stringify({
      version:'goblin-level-package-v3',levels:[{...GoblinEditorDraft.copyTemplate(),id:'ai-test',scenarioVersion:1,aiAllowed:permission}]
    }))[0])`);
    assert.equal(prepared.aiAllowed,permission);
    assert.equal(game.run('GoblinEditorDraft.parse(GoblinEditorDraft.exportJson({...GoblinEditorDraft.copyTemplate(),aiAllowed:permission})).aiAllowed'),permission);
    game.context.prepared=prepared;
    game.run('loadEditorDraft(prepared)');
    assert.equal(game.run("!!GoblinCatalogFullRuntime.aiProjection('player')"),permission);
    assert.equal(game.run("!!GoblinCatalogFullRuntime.aiProjection('enemy')"),permission);
  }
  for(const invalid of ['false',1,null,[],{}]){
    game.context.invalid=invalid;
    assert.throws(()=>game.run('GoblinEditorDraft.parse(JSON.stringify({...GoblinEditorDraft.copyTemplate(),aiAllowed:invalid}))'),/schema/);
  }
});

test('curated FULL v3 forwards permission over the pinned historical layout',async()=>{
  const game=fullShell();
  game.context.levelPackage=JSON.parse(source('assets/unit-art/levels/catalog-full-levels.v3.json'));
  game.context.levelPackage.levels[0].aiAllowed=false;
  await game.run("GoblinCatalogFullModel.initialize(data,levelPackage,{profile:'FULL_CATALOG_v1'})");
  game.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
  const config=game.run('scenarioCatalog[levelPackage.levels[0].id]');
  assert.equal(config.aiAllowed,false);
  game.run('loadScenario(levelPackage.levels[0].id)');
  assert.equal(game.run("GoblinCatalogFullRuntime.aiProjection('enemy')"),null);
});

test('the Core start requires both compatible controller inputs and honors declarative false',async()=>{
  let calls=0;
  const select=decision=>{calls++;return decision.candidates[0].key};
  const denied={...IRON_DUST_LEVEL_V3,aiAllowed:false};
  assert.throws(()=>createIronDustSpectatorMatch({player:select,enemy:select},{level:denied}),{code:'AI_LEVEL_FORBIDDEN'});
  assert.throws(()=>createIronDustSpectatorMatch({enemy:select}),{code:'AI_CONTROLLERS_REQUIRED'});
  assert.throws(()=>createIronDustSpectatorMatch({player:select}),{code:'AI_CONTROLLERS_REQUIRED'});
  assert.throws(()=>createIronDustSpectatorMatch(select,{level:{...denied,aiAllowed:'false'}}),/SCENARIO_AI_PERMISSION_INVALID/);
  const blocked=createIronDustBrowserSession(undefined,8,denied);
  for(const spectator of [true,false])assert.throws(()=>createIronDustDecisionHost({readSession:()=>blocked,spectator}),
    {code:'AI_LEVEL_FORBIDDEN'});
  assert.equal(dispatchIronDustBrowserAction(blocked,{type:'EndPhase',playerId:'player'}).session.aiAllowed,false);
  assert.equal(calls,0);
  const commands=[{type:'EndPhase',playerId:'player'}];
  const standard=recordIronDustCommands(createIronDustBrowserSession(undefined,8).profile,commands);
  assert.deepEqual(recordIronDustCommands(blocked.profile,commands),standard);
  assert.equal(playIronDustProfileReplay(standard).steps.length,1);
  const match=createIronDustSpectatorMatch({player:select,enemy:select});
  assert.equal((await match.advance()).ok,true);
  assert.equal(calls,1);
  match.stop();
});
