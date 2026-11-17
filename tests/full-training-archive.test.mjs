import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullShell} from './catalog-full-harness.mjs';
import {importFullTrainingArchive,openFullTrainingReplay} from '../scripts/full-training-import.mjs';

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
      replay:{version:'full-native-journal-v1',seed,level,initial:'',entries:[]}
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
      assert.equal(host.port.undo(),true);
    }
    commit(treads);
    const effectiveRoll=roll();
    if(undo) assert.equal(effectiveRoll,oldRoll);
    for(let step=0;step<40&&!host.port.state().ended;step++){
      const frame=host.inspect();
      const command=frame.state.side==='player'?{type:'EndPhase'}:
        frame.opened.entries.find(entry=>entry.baseline).command;
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
