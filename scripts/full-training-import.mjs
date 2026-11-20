import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fullShell} from '../tests/catalog-full-harness.mjs';
import {queryBridge} from '../tests/artillery-product-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {FULL_ATTACK_2A_ID} from '../src/core/full-attack-2a.mjs';
import {TRAINING_ARCHIVE_VERSION} from '../training-archive.mjs';

const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function expect(condition){
  assert.ok(condition,'FULL_TRAINING_ARCHIVE_INVALID');
}
function exact(value,keys){
  return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&
    keys.every(key=>Object.hasOwn(value,key));
}

export async function openFullTrainingReplay(archive) {
  const {replay,seats}=archive;
  expect(exact(seats,['player','enemy']));
  expect(exact(replay,['version','seed','level','initial','entries']) && replay.version==='full-native-journal-v1' &&
    Number.isInteger(replay.seed)&&replay.seed>=0&&replay.seed<=0xffffffff &&
    Array.isArray(replay.entries));
  expect(exact(replay.level,['id','digest'])||exact(replay.level,['id','digest','draft']));
  const roles={}, policyIds={};
  const game=fullShell();
  await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
  game.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
  for(const file of ['level-events.js','editor-draft.js'])game.run(source(file));
  queryBridge(game);
  const full=game.context.GoblinCatalogFullRuntime;
  for(const side of ['player','enemy']) {
    const seat=seats[side];
    const human=exact(seat,['controller'])&&seat.controller==='human';
    const ai=exact(seat,['controller','policy','difficulty'])&&seat.controller==='ai';
    expect(human||ai);
    roles[side]=seat.controller;
    if(!ai)continue;
    if(seat.policy===null){
      expect(side==='enemy'&&seat.difficulty===null);
      continue;
    }
    expect(['weak','medium','strong'].includes(seat.difficulty)&&seat.policy===side+'-'+seat.difficulty ||
      side==='player'&&seat.policy===FULL_ATTACK_2A_ID&&seat.difficulty===null ||
      side==='enemy'&&seat.policy==='full-defender-control-trial'&&seat.difficulty===null);
    policyIds[side]=seat.policy;
    full.registerQualifiedController({side,id:seat.policy,difficulty:seat.difficulty,select:()=>null});
  }
  expect(Object.values(roles).includes('human'));
  let pending;
  game.context.control={roles,policyIds,seed:replay.seed,ui:{handoff(_seat,take){pending=take;}}};
  game.context.levelId=replay.level.id;
  game.context.draftText=JSON.stringify(replay.level.draft);
  let port;
  if(Object.hasOwn(replay.level,'draft')) {
    expect(replay.level.id==='editor-draft');
    port=await game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(draftText)).then(config=>loadEditorDraft(config,control))');
  } else {
    if(!game.context.GoblinCatalogFullModel.has(replay.level.id)){
      const levels=['full-migrated-missions','ai-training-missions'].flatMap(name=>
        game.context.GoblinEditorDraft.importLevels(source('assets/unit-art/levels/'+name+'.v3.json')));
      const level=levels.find(level=>level.id===replay.level.id);
      expect(level);
      game.context.migratedConfig=await game.context.GoblinEditorDraft.prepare(level);
      game.run('ScenarioRuleProfiles.registerFullMission(levelId,migratedConfig);scenarioCatalog[levelId]=migratedConfig');
    }
    port=game.run('loadScenario(levelId,control)');
  }
  expect(port?.state()?.levelDigest===replay.level.digest);
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  function inspect(){
    if(port.state()?.pending) expect(pending());
    const state=port.state();
    const opened=port.open(state.controller);
    expect(opened&&!state.ended);
    const view=port.project(state.controller).view;
    const candidates=state.controller!=='human'?null:
      opened.entries??[...player.humanPlayerOptions(port),{command:{type:'EndPhase'},facts:{}}];
    return {state,opened,view,candidates};
  }
  function commit(frame,command) {
    const {state,opened}=frame;
    return port.commit(state.controller,opened.permit,command,player.dispatch);
  }
  return {game,port,inspect,commit};
}

export async function importFullTrainingArchive(archive) {
  expect(exact(archive,['version','profile','seats','outcome','replay']) &&
    archive.version===TRAINING_ARCHIVE_VERSION&&archive.profile==='FULL_CATALOG_v1'&&
    ['player','enemy','draw'].includes(archive.outcome));
  const host=await openFullTrainingReplay(archive);
  const demonstrations=[];
  for (const [commandIndex,entry] of archive.replay.entries.entries()){
    expect(exact(entry,['side','slot','command','draws','digest']) &&
      Number.isInteger(entry.draws)&&entry.draws>=0&&typeof entry.digest==='string');
    const frame=host.inspect();
    const {state,view,candidates}=frame;
    expect(entry.side===state.side&&entry.slot===state.slot);
    if(candidates){
      const selected=candidates.findIndex(item=>JSON.stringify(item.command)===JSON.stringify(entry.command));
      expect(selected>=0);
      const clean=candidates.map(({command,facts})=>({command,facts}));
      demonstrations.push(plain({kind:'human-demonstration',commandIndex,side:entry.side,slot:entry.slot,
        view,command:entry.command,candidates:clean,selected}));
    }
    expect(host.commit(frame,entry.command).ok);
  }
  expect(host.port.state()?.ended);
  assert.deepEqual(plain(host.port.trainingArchive()),archive);
  return {profile:archive.profile,outcome:archive.outcome,seed:archive.replay.seed,
    acceptedCommands:archive.replay.entries.length,demonstrations};
}
