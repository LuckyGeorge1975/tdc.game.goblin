import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullShell} from './catalog-full-harness.mjs';
import {importFullTrainingArchive,openFullTrainingReplay} from '../scripts/full-training-import.mjs';
import {gameplaySourceHashes} from './helpers/replay-source-binding.mjs';

const draft={
  id:'journal-undo-test',version:'goblin-level-v3',scenarioVersion:1,width:10,height:7,
  objective:'core-and-escort',ruleProfile:'FULL_CATALOG_v1',terrain:[],
  units:[
    {id:'lead',assetId:'assault-tank',team:'player',x:3,y:3},
    {id:'core',assetId:'command-core',team:'enemy',x:7,y:3},
    {id:'phantom',assetId:'phantom-platform',team:'enemy',x:4,y:3},
    {id:'guard',assetId:'guard-tank',team:'enemy',x:3,y:2}
  ],
  goals:[{type:'enemy-turn-limit',turns:1}]
};
const plain=value=>JSON.parse(JSON.stringify(value));

test('migrated mission archive replay keeps the original mission ID and rejects an unknown ID or digest',async()=>{
  const game=fullShell();
  await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
  for(const file of ['level-events.js','editor-draft.js'])
    game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  const levels=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/full-migrated-missions.v3.json',import.meta.url),'utf8')).levels;
  for(const level of levels){
    const config=await game.context.GoblinEditorDraft.prepare(level);
    const archive={seats:{player:{controller:'human'},enemy:{controller:'human'}},replay:{
      version:'full-native-journal-v1',sources:gameplaySourceHashes(),seed:7,level:{id:level.id,digest:config.catalog.levelDigest},
      initial:'',entries:[]}};
    const host=await openFullTrainingReplay(archive);
    assert.equal(host.port.state().levelDigest,config.catalog.levelDigest);
    assert.equal(host.game.run('currentScenario'),level.id);
    assert.equal(host.game.run('legacySession.ruleProfileId'),'FULL_CATALOG_v1');
    assert.equal(host.commit(host.inspect(),{type:'EndPhase'}).ok,true);
    const forged=structuredClone(archive);
    forged.replay.level.digest='forged';
    await assert.rejects(()=>openFullTrainingReplay(forged),/FULL_TRAINING_ARCHIVE_INVALID/);
  }
  await assert.rejects(()=>openFullTrainingReplay({seats:{player:{controller:'human'},enemy:{controller:'human'}},
    replay:{version:'full-native-journal-v1',sources:gameplaySourceHashes(),seed:7,level:{id:'unknown-mission',digest:'forged'},
      initial:'',entries:[]}}),/FULL_TRAINING_ARCHIVE_INVALID/);
});

test('all qualified rule and trained seats round-trip native FULL archives with strict metadata',async()=>{
  const level=await fixture();
  for(const side of ['player','enemy'])for(const difficulty of ['weak','medium','strong',null]){
    const policy=difficulty===null?
      side==='player'?'full-attack-2a':'full-defender-control-trial':side+'-'+difficulty;
    const seats={player:{controller:'human'},enemy:{controller:'human'}};
    seats[side]={controller:'ai',policy,difficulty};
    const host=await openFullTrainingReplay({seats,replay:{version:'full-native-journal-v1',sources:gameplaySourceHashes(),
      seed:313,level,initial:'',entries:[]}});
    for(let step=0;step<40&&!host.port.state().ended;step++){
      const frame=host.inspect();
      const command=frame.state.side==='player'?{type:'EndPhase'}:
        host.game.context.GoblinCatalogFullRuntime.referenceCommand();
      assert.equal(host.commit(frame,command).ok,true);
    }
    assert.equal(host.port.state().ended,true,policy);
    const archive=plain(host.port.trainingArchive());
    assert.deepEqual(archive.seats,seats);
    const imported=await importFullTrainingArchive(archive);
    assert.equal(imported.outcome,archive.outcome);
    assert.ok(imported.demonstrations.length>0);
    assert.ok(imported.demonstrations.every(row=>row.side!==side));
    for(const replacement of [
      {...seats[side],difficulty:difficulty==='weak'?'strong':'weak'},
      {...seats[side],policy:(side==='player'?'enemy':'player')+'-strong'},
      {...seats[side],policy:'unqualified-policy'},
      {...seats[side],extra:true}
    ]){
      const invalid=structuredClone(archive);
      invalid.seats[side]=replacement;
      await assert.rejects(()=>importFullTrainingArchive(invalid),/FULL_TRAINING_ARCHIVE_INVALID/);
    }
  }
});

async function fixture() {
  const game=fullShell();
  await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
  for(const file of ['level-events.js','editor-draft.js'])
    game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  game.context.draft=JSON.stringify(draft);
  const digest=await game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(draft)).then(config=>config.catalog.levelDigest)');
  return {id:'editor-draft',digest,draft};
}

test('FULL archives keep the seeded stream on the effective undo branch across unit and tread fire',async()=>{
  const level=await fixture();
  async function play(seed,undo) {
    const host=await openFullTrainingReplay({
      seats:{player:{controller:'human'},enemy:{controller:'human'}},
      replay:{version:'full-native-journal-v1',sources:gameplaySourceHashes(),seed,level,initial:'',entries:[]}
    });
    const ambient=host.game.run('Math.random');
    const ambientRng=host.game.rng();
    assert.equal(host.port.trainingArchive(),null);
    const commit=(command)=>assert.equal(host.commit(host.inspect(),command).ok,true);
    commit({type:'EndPhase'});
    const available=host.inspect().candidates.map(item=>item.command);
    const unit=available.find(command=>command.type==='CatalogFire'&&command.target.kind==='unit'&&
      command.target.runtimeUnitId==='guard');
    const treads=available.find(command=>command.type==='CatalogFire'&&command.target.componentId==='treads');
    assert.ok(unit&&treads);
    const roll=()=>host.game.run('units.find(unit=>unit.id==="lead").specialistJournal.at(-1).result.outcome.roll');
    let oldRoll;
    if(undo){
      commit(unit);
      oldRoll=roll();
      assert.equal(host.port.undo(host.port.ticket('human')),true);
    }
    commit(treads);
    const effectiveRoll=roll();
    if(undo) assert.equal(effectiveRoll,oldRoll);
    for(let step=0;step<40&&!host.port.state().ended;step++){
      const frame=host.inspect();
      const command=frame.state.side==='player'?{type:'EndPhase'}:
        host.game.context.GoblinCatalogFullRuntime.referenceCommand();
      assert.equal(host.commit(frame,command).ok,true);
    }
    assert.equal(host.game.run('Math.random'),ambient);
    assert.deepEqual(host.game.rng(),ambientRng);
    const archive=plain(host.port.trainingArchive());
    assert.ok(archive);
    assert.equal(archive.replay.entries.filter(step=>step.command.target?.runtimeUnitId==='guard'&&step.side==='player').length,0);
    const oldPort=host.port;
    const replacement=await host.game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(draftText)).then(config=>loadEditorDraft(config,control))');
    assert.equal(oldPort.trainingArchive(),null);
    assert.equal(replacement.trainingArchive(),null);
    return {archive,effectiveRoll};
  }

  const clean=await play(313,false);
  assert.deepEqual(await play(313,true),clean);
  assert.notEqual((await play(911,false)).effectiveRoll,clean.effectiveRoll);
  const imported=await importFullTrainingArchive(clean.archive);
  const choice=imported.demonstrations.find(step=>step.command.target?.componentId==='treads');
  assert.equal(choice.candidates[choice.selected].facts.effectKind,'tread-roll-5-6');
  assert.doesNotMatch(JSON.stringify(choice.candidates),/"(?:rng|seed|roll|draws)":/i);
  const damaged=structuredClone(clean.archive);
  damaged.replay.entries.pop();
  await assert.rejects(importFullTrainingArchive(damaged),/FULL_TRAINING_ARCHIVE_INVALID/);
  const counterfeit=structuredClone(clean.archive);
  counterfeit.replay.entries[1].draws++;
  await assert.rejects(importFullTrainingArchive(counterfeit));
});

test('native archive import rejects unbound, forged and genuinely different gameplay sources',async()=>{
  const level=await fixture();
  const original=gameplaySourceHashes();
  const host=await openFullTrainingReplay({seats:{player:{controller:'human'},enemy:{controller:'human'}},
    replay:{version:'full-native-journal-v1',sources:original,seed:313,level,initial:'',entries:[]}});
  // Changing the page's later metadata must not rebind a journal already started.
  host.game.context.GoblinFullTrainingSources={current:()=>({'game.js':'f'.repeat(64)})};
  while(!host.port.state().ended)assert.equal(host.commit(host.inspect(),{type:'EndPhase'}).ok,true);
  const archive=plain(host.port.trainingArchive());
  assert.equal(host.port.canExportTraining(),true);
  assert.deepEqual(archive.replay.sources,original);
  assert.equal((await importFullTrainingArchive(archive)).acceptedCommands,6);
  const missing=structuredClone(archive);delete missing.replay.sources;
  await assert.rejects(()=>importFullTrainingArchive(missing),/FULL_TRAINING_ARCHIVE_INVALID/);
  for(const path of ['game.js','terrain-rules.js']){
    const forged=structuredClone(archive);forged.replay.sources[path]='f'.repeat(64);
    await assert.rejects(()=>importFullTrainingArchive(forged),/FULL_TRAINING_SOURCE_BINDING/);
  }
  const changed=structuredClone(archive);
  const {createHash}=await import('node:crypto');
  const next=readFileSync(new URL('../unit-life.js',import.meta.url),'utf8').replaceAll('\r\n','\n')
    .replace('unit.hp>0','unit.hp>1');
  changed.replay.sources['unit-life.js']=createHash('sha256').update(next).digest('hex');
  await assert.rejects(()=>importFullTrainingArchive(changed),/FULL_TRAINING_SOURCE_BINDING/);
  const extra=structuredClone(archive);extra.replay.sources['ui-v2.js']='f'.repeat(64);
  await assert.rejects(()=>importFullTrainingArchive(extra),/FULL_TRAINING_SOURCE_BINDING/);
  delete host.game.context.GoblinFullTrainingSources;
  host.game.context.control.ui.handoff=(_seat,take)=>take();
  const unbound=await host.game.run('GoblinEditorDraft.prepare(GoblinEditorDraft.parse(draftText)).then(config=>loadEditorDraft(config,control))');
  while(!unbound.state().ended)
    assert.equal(unbound.commit('human',unbound.open('human').permit,{type:'EndPhase'}).ok,true);
  assert.equal(unbound.canExportTraining(),false);
  assert.equal(unbound.trainingArchive(),null);
  assert.equal(host.port.canExportTraining(),false,'detached bound port cannot export');
});
