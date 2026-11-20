import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {listAiTrainingCorpus} from '../scripts/ai-training-corpus.mjs';
import {openFullTrainingReplay} from '../scripts/full-training-import.mjs';
import {createFullGameManager,fullNativeSetup} from '../full-standard-seat-owner.mjs';
import {selectWeakFullCatalog,selectMediumFullCatalog} from '../src/core/full-catalog-difficulty.mjs';
import {prepareFullAttack2a,FULL_ATTACK_2A_ID,FULL_ATTACK_2A_ENGINE} from '../src/core/full-attack-2a.mjs';
import {prepareDefenderTrial} from '../src/core/full-defender-trial.mjs';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const packageText=source('assets/unit-art/levels/ai-training-missions.v3.json').replaceAll('\r\n','\n');
const levels=JSON.parse(packageText).levels;
const proof=JSON.parse(source('docs/ai-training-levels-source.json'));
const hash=value=>createHash('sha256').update(value).digest('hex');
async function editor(){
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js'])game.run(source(file));
  return game.context.GoblinEditorDraft;
}

test('the four approved maps retain all source terrain, roster and infantry strength declarations',async()=>{
  const api=await editor();
  assert.ok(packageText.length<=65536);
  assert.equal(hash(packageText),proof.package.sha256);
  const imported=api.importLevels(packageText);
  assert.equal(imported.length,4);
  for(const [index,level] of levels.entries()){
    assert.equal(hash(JSON.stringify(level)),proof.levels[index].canonicalLevelSha256);
    assert.equal(level.objective,'eliminate-opponent');
    const sides=['player','enemy'].map(side=>level.units.filter(unit=>unit.team===side));
    assert.deepEqual(sides.map(units=>units.length),Array(2).fill([6,8,12,18][index]));
    for(const [unitIndex,unit] of sides[0].entries()){
      const opposite=sides[1][unitIndex];
      assert.equal(opposite.x,level.width-1-unit.x);
      assert.equal(opposite.y,level.height-1-unit.y);
      const state=({id,team,x,y,...state})=>state;
      assert.deepEqual(state(opposite),state(unit));
    }
    const prepared=await api.prepare(level);
    assert.equal(prepared.objective,level.objective);
    assert.equal(prepared.width,level.width);
    assert.equal(prepared.height,level.height);
    assert.equal(prepared.units.length,level.units.length);
    const text=api.exportJson(level);
    assert.ok(text.length<=65536);
    assert.deepEqual(JSON.parse(JSON.stringify(api.parse(text))),level);
  }
});

test('size and objective admission remains strict without changing the level format',async()=>{
  const api=await editor();
  assert.deepEqual(JSON.parse(JSON.stringify(api.size)),{minWidth:6,maxWidth:24,minHeight:5,maxHeight:24});
  for(const patch of [{width:25},{height:25},{objective:'arbitrary-script'},
    {version:'goblin-ai-test-level-proposal-v1'},{objectiveVersion:1}])
    assert.throws(()=>api.validate({...levels[0],...patch}),/schema/);
  assert.throws(()=>api.validate({...levels[0],units:levels[0].units.filter(unit=>unit.team==='player')}),/enemy/);
  assert.throws(()=>api.validate({...levels[0],goals:[{type:'enemy-turn-limit',turns:3}]}),/goalCombination/);
  assert.throws(()=>api.validate({...levels[0],waveTemplates:[],events:[]}),/goalCombination/);
  const ordinaryCores={version:'goblin-level-v3',width:8,height:8,objective:'eliminate-opponent',terrain:[],units:[
    {id:'friendly-command',assetId:'command-core',team:'player',x:1,y:1},
    {id:'enemy-command',assetId:'command-core',team:'enemy',x:6,y:6}]};
  assert.doesNotThrow(()=>api.validate(ordinaryCores));
  assert.throws(()=>api.validate({...ordinaryCores,objective:'core-and-escort'}),/core/);
  const dialog={id:'start-message',when:{event:'UnitMoved',unitId:levels[0].units[0].id},
    effect:{type:'dialog',title:'Briefing',text:'Hold the crossing.'}};
  const withDialog={...levels[0],events:[dialog]};
  assert.doesNotThrow(()=>api.parse(api.exportJson(withDialog)));
});

test('all four maps save and reload through normal and working editor storage',async()=>{
  const game=await fullScene(),disk=new Map();
  game.context.localStorage={getItem:key=>disk.get(key)??null,setItem:(key,value)=>disk.set(key,value),
    removeItem:key=>disk.delete(key)};
  for(const file of ['level-events.js','editor-draft.js','saved-levels.js'])game.run(source(file));
  const api=game.context.GoblinEditorDraft,store=game.context.GoblinSavedLevels;
  for(const level of levels){
    const saved=store.save(level.id,level);
    const reread=store.read().find(entry=>entry.id===saved.id);
    assert.deepEqual(JSON.parse(JSON.stringify(api.parse(reread.level))),level);
    assert.ok(Buffer.byteLength(reread.level)<=65536);
    store.saveWorking(level.id,level);
    assert.deepEqual(JSON.parse(JSON.stringify(store.readWorking().draft)),level);
  }
  assert.equal(store.read().length,4);
  assert.equal(store.readWorking().draft.width,24);
  assert.equal(store.readWorking().draft.height,24);
});

test('the pinned training corpus enumerates both controlled sides for every requested seed',async()=>{
  const samples=await listAiTrainingCorpus({seeds:[7,101]});
  assert.equal(samples.length,16);
  for(const level of levels)for(const seed of [7,101]){
    const pair=samples.filter(sample=>sample.id===level.id&&sample.seed===seed);
    assert.deepEqual(pair.map(sample=>sample.controlledSide),['player','enemy']);
    assert.deepEqual(pair.map(sample=>sample.opponentSide),['enemy','player']);
    assert.deepEqual(pair[0].level,level);
    pair[0].level.units[0].x=99;
    assert.notEqual(pair[1].level.units[0].x,99);
  }
  for(const seeds of [[],[7,7],[-1],[0x100000000]])
    await assert.rejects(()=>listAiTrainingCorpus({seeds}),/AI_CORPUS_SEEDS_INVALID/);
});

test('all 100 new mission seat pairings bind native controllers without starting a policy',async()=>{
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js'])game.run(source(file));
  const full=game.context.GoblinCatalogFullRuntime;
  for(const side of ['player','enemy']){
    full.registerQualifiedController({side,id:side+'-weak',difficulty:'weak',select:selectWeakFullCatalog});
    full.registerQualifiedController({side,id:side+'-medium',difficulty:'medium',select:selectMediumFullCatalog});
    full.registerQualifiedController({side,id:side+'-strong',difficulty:'strong',
      select(){throw Error('Admission must not execute a worker');}});
  }
  const attacker=await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,
    modelBytes:Buffer.from(JSON.parse(source('assets/ai/full-attack-2a.json')).base64,'base64')});
  const defender=await prepareDefenderTrial('full-defender-control-trial',
    readFileSync(new URL('../assets/ai/full-defender-control-trial.json',import.meta.url)));
  full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select:attacker});
  full.registerQualifiedController({side:'enemy',id:'full-defender-control-trial',difficulty:null,
    select:(batch,_port,report)=>defender(batch,report)});
  let pairings=0;
  for(const level of levels){
    game.context.level=level;
    game.context.prepared=await game.context.GoblinEditorDraft.prepare(level);
    game.run('ScenarioRuleProfiles.registerFullMission(level.id,prepared);scenarioCatalog[level.id]=prepared');
    const manager=createFullGameManager(game.context.prepared,full);
    assert.deepEqual(manager.seats.map(seat=>seat.ai.length),[4,4]);
    const [players,enemies]=manager.seats.map(seat=>[null,...seat.ai.map(policy=>policy.id)]);
    for(const player of players)for(const enemy of enemies){
      game.context.control={...fullNativeSetup(manager,{player,enemy}),seed:7,ui:{handoff(){return true;}}};
      const port=game.run('loadScenario(level.id,control)');
      assert.equal(port.state().ended,false);
      assert.equal(port.controlBinding().roles.player,player===null?'human':'ai');
      assert.equal(port.controlBinding().roles.enemy,enemy===null?'human':'ai');
      assert.equal(game.run('legacySession.effectiveRules.objective'),'eliminate-opponent');
      assert.deepEqual(JSON.parse(game.run('JSON.stringify([W,H])')),[level.width,level.height]);
      pairings++;
    }
  }
  assert.equal(pairings,100);
});

test('new regular mission archive IDs reconstruct trusted levels and reject forged digests',async()=>{
  const api=await editor();
  for(const level of levels){
    const prepared=await api.prepare(level);
    const archive={seats:{player:{controller:'human'},enemy:{controller:'human'}},replay:{
      version:'full-native-journal-v1',seed:7,level:{id:level.id,digest:prepared.catalog.levelDigest},initial:'',entries:[]}};
    const host=await openFullTrainingReplay(archive);
    assert.equal(host.game.run('currentScenario'),level.id);
    assert.equal(host.port.state().levelDigest,prepared.catalog.levelDigest);
    assert.deepEqual(JSON.parse(host.game.run('JSON.stringify([W,H])')),[level.width,level.height]);
    assert.equal(host.commit(host.inspect(),{type:'EndPhase'}).ok,true);
    const forged=structuredClone(archive);
    forged.replay.level.digest='forged';
    await assert.rejects(()=>openFullTrainingReplay(forged),/FULL_TRAINING_ARCHIVE_INVALID/);
  }
});

test('regular mission choices and objective markers use all new IDs and actual dimensions',async()=>{
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js','m1-unit-markers.js'])game.run(source(file));
  for(const level of levels){
    game.context.level=level;
    game.context.prepared=await game.context.GoblinEditorDraft.prepare(level);
    game.run('ScenarioRuleProfiles.registerFullMission(level.id,prepared);scenarioCatalog[level.id]=prepared');
  }
  game.context.GoblinFullMissions={ids:levels.map(level=>level.id),has:id=>levels.some(level=>level.id===id)};
  const flow=source('ui-v2-flow.js');
  game.run(`{
    const fieldCampaigns={},savedTab=false,t=key=>key;
    let missionId='ai-coast-24';
    ${flow.slice(flow.indexOf('    function missionData('),flow.indexOf('    function missionPreview('))}
    ${flow.slice(flow.indexOf('    function levelChoices('),flow.indexOf('    function ironDustAttackerControl('))}
    globalThis.newMissionChoices=levelChoices();
  }`);
  const choices=JSON.parse(game.run('JSON.stringify(newMissionChoices.choices)'));
  for(const level of levels){
    const choice=choices.find(choice=>choice.id===level.id);
    assert.ok(choice?.data);
    assert.deepEqual([choice.data.width,choice.data.height],[level.width,level.height]);
    assert.equal(choice.summary,'v2.full.symmetricObjective');
    game.context.missionId=level.id;
    game.run('loadScenario(missionId)');
    const markers=game.run('M1UnitMarkers.legacy(legacySession,GoblinCatalogFullRuntime.roster(),"test",null)');
    assert.equal(markers.supported,true);
    assert.equal(markers.objective.code,'eliminate-opponent');
  }
});
