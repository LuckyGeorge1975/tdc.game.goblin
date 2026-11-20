import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {environment,level,play,humanSeats,policyPackage,fireIntervention} from './helpers/full-training-provenance.mjs';
import {prepareFullExperimentCatalog,registerFullExperimentController} from '../scripts/full-experiment-policies.mjs';
import {bytes,hash,textHash} from '../scripts/full-training-artifacts.mjs';
import {importFullTrainingArchive} from '../scripts/full-training-import.mjs';
import {fullShell} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from '../src/core/full-catalog-ai-adapter.mjs';
import {productionOwner} from './helpers/full-production-owner.mjs';

test('both experiment kinds and seats round-trip only with explicit matching local packages and never execute archive selector code',async()=>{
 const env=await environment(), map=await level();
 for(const side of ['player','enemy'])for(const mode of ['single-fire-intervention','frozen-fire-model']){
  const branch=mode==='single-fire-intervention'?await fireIntervention(map,side):null;
  const pkg=await policyPackage(env,side,mode,{selectorSource:"throw Error('ARCHIVE_SELECTOR_MUST_NEVER_EXECUTE');\n",
   intervention:branch?.spec});
  const catalog=await prepareFullExperimentCatalog(pkg), seats=humanSeats();
  seats[side]={controller:'ai',policy:pkg.id,difficulty:mode==='frozen-fire-model'?null:'medium'};
  const original=await play(map,seats,{experimentCatalog:catalog,
   commands:branch&&new Map([[branch.spec.commandIndex,branch.command]])});
  assert.ok(original.archive);
  const result=await importFullTrainingArchive(original.archive,{experimentCatalog:catalog});
  assert.equal(result.provenance.status,'declared-replay');assert.deepEqual(result.demonstrations,[]);
  await assert.rejects(()=>importFullTrainingArchive(original.archive),/FULL_EXPERIMENT_NOT_TRUSTED/);
  await assert.rejects(()=>importFullTrainingArchive(original.archive,{experimentCatalog:{}}));
  const forged=structuredClone(original.archive);forged.seats[side].difficulty=seats[side].difficulty===null?'medium':null;
  await assert.rejects(()=>importFullTrainingArchive(forged,{experimentCatalog:catalog}));
  await writeFile(resolve(pkg.packageRoot,'experimental-fire-selector.mjs'),'// changed after catalog verification\n');
  await assert.rejects(()=>importFullTrainingArchive(original.archive,{experimentCatalog:catalog}),/FULL_TRAINING_ARTIFACT_HASH/);
 }
});

test('runtime qualification invokes exactly the registered native Medium callback and keeps its tactical view for frozen models',async()=>{
 const env=await environment(), map=await level();
 for(const side of ['player','enemy']){
  const pkg=await policyPackage(env,side,'frozen-fire-model'), catalog=await prepareFullExperimentCatalog(pkg);
  const game=fullShell();await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
  game.run(await readFile(new URL('../editor-draft.js',import.meta.url),'utf8'));
  const full=game.context.GoblinCatalogFullRuntime;
  let calls=0,seen;
  full.registerQualifiedController({side,id:side+'-medium',difficulty:'medium',select(batch){calls++;seen=batch;return batch.candidates[0].key;}});
  assert.throws(()=>full.registerQualifiedController({side,id:'full-experiment:'+'0'.repeat(64),difficulty:null,select(){}}),/FULL_AI_QUALIFICATION_INVALID/);
  const registered=await registerFullExperimentController({catalog,id:pkg.id,full,root:game.context});
  const config=await game.context.GoblinEditorDraft.prepare(map.draft);
  game.context.config=config;game.context.controls={roles:{player:side==='player'?'ai':'human',enemy:side==='enemy'?'ai':'human'},
   policyIds:{[side]:pkg.id},seed:7,ui:{handoff(_side,take){take();}}};
  const port=game.run('loadEditorDraft(config,controls)');
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  if(side==='enemy')for(let i=0;i<3;i++)assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'},player.dispatch).ok,true);
  const adapter=createOwnedFullCatalogAiAdapter(port,player), batch=adapter.open(side);
  assert.equal(batch.ok,true);assert.ok(batch.view.tactics?.crt);
  const selected=port.qualifiedSelector()(batch);
  assert.equal(selected,batch.candidates[0].key);assert.equal(calls,1);assert.equal(seen,batch);
  assert.deepEqual(registered.finish('native'),{synthetic:true});
  port.leave();assert.equal(port.qualifiedSelector(),null);
 }
});

test('newly sealed IDs cannot bypass model dimensions/header, schema, configuration or dependency verification',async()=>{
 const env=await environment();
 const badModel=[model=>{model.side='enemy';},model=>{model.hidden[0].weights.pop();},
  model=>{model.output.weights[0]=null;},model=>{model.featureVersion='wrong';},model=>{model.rewardVersion='wrong';},
  model=>{model.runtimeCommit='0'.repeat(40);},model=>{model.trainingDataSha256='0'.repeat(64);},
  model=>{model.hidden[0].extra=true;}];
 for(const change of badModel){
  const pkg=await policyPackage(env,'player','frozen-fire-model',{transform(entry,files){
   const model=JSON.parse(files['model.json']);change(model);files['model.json']=bytes(model);entry.modelRawSha256=hash(files['model.json']);
  }});
  await assert.rejects(()=>prepareFullExperimentCatalog(pkg));
 }
 for(const change of [
  (entry,files)=>{files['feature.json']=bytes({version:'goblin-full-fire-effects-v1',inputs:19,fields:[]});entry.featureSchemaSha256=textHash(files['feature.json']);},
  (entry,files)=>{const outcome=JSON.parse(files['outcome.json']);outcome.draw=0;files['outcome.json']=bytes(outcome);entry.outcomeSchemaSha256=textHash(files['outcome.json']);},
  (entry,files)=>{files['selection.json']=bytes({mode:entry.mode,side:'enemy',basePolicyId:entry.basePolicyId});entry.selectionConfigSha256=textHash(files['selection.json']);},
  entry=>{entry.selectorArtifacts=entry.selectorArtifacts.filter(item=>item.path!=='engine/src/core/hex.mjs');},
  entry=>{entry.selectorArtifacts[0].sha256='0'.repeat(64);},
  entry=>{entry.modelRef='../model.json';},
  entry=>{entry.interventionSpecRef='extra';entry.interventionSpecSha256='0'.repeat(64);},
  (entry,files)=>{files['experimental-fire-selector.mjs']=Buffer.from("import './unbound.mjs';\n");entry.selectorArtifacts.find(item=>item.path==='experimental-fire-selector.mjs').sha256=textHash(files['experimental-fire-selector.mjs']);}
 ]){
  const pkg=await policyPackage(env,'player','frozen-fire-model',{transform:change});
  await assert.rejects(()=>prepareFullExperimentCatalog(pkg));
 }
 const valid=await policyPackage(env,'player','single-fire-intervention');
 await assert.rejects(()=>prepareFullExperimentCatalog({...valid,entries:[{...valid.entries[0],sha256:'0'.repeat(64)}]}));
});

test('recomputed native journals cannot hide a changed intervention prefix, offer, reference command or selected alternative',async()=>{
 const env=await environment(), map=await level(), branch=await fireIntervention(map,'player');
 for(const field of ['prefixSha256','offerSha256','referenceCommandSha256']){
  const spec={...branch.spec,[field]:'0'.repeat(64)};
  const pkg=await policyPackage(env,'player','single-fire-intervention',{intervention:spec});
  const catalog=await prepareFullExperimentCatalog(pkg), seats=humanSeats();
  seats.player={controller:'ai',policy:pkg.id,difficulty:'medium'};
  const original=await play(map,seats,{experimentCatalog:catalog,commands:new Map([[spec.commandIndex,branch.command]])});
  await assert.rejects(()=>importFullTrainingArchive(original.archive,{experimentCatalog:catalog}),/FULL_EXPERIMENT_(PREFIX|OFFER|COMMAND)_DRIFT/);
 }
 const pkg=await policyPackage(env,'player','single-fire-intervention',{intervention:branch.spec});
 const catalog=await prepareFullExperimentCatalog(pkg), seats=humanSeats();
 seats.player={controller:'ai',policy:pkg.id,difficulty:'medium'};
 const noIntervention=await play(map,seats,{experimentCatalog:catalog});
 await assert.rejects(()=>importFullTrainingArchive(noIntervention.archive,{experimentCatalog:catalog}),/FULL_EXPERIMENT_COMMAND_DRIFT/);
});

test('a sealed intervention cannot be skipped by pointing at the other seat, another phase, or beyond the accepted journal',async()=>{
 const env=await environment(), map=await level();
 for(const side of ['player','enemy']){
  const branch=await fireIntervention(map,side), opponent=side==='player'?'enemy':'player';
  const wrongIndices=side==='player'?[4,0,2,6]:[1,3,5,6];
  for(const commandIndex of wrongIndices){
   const pkg=await policyPackage(env,side,'single-fire-intervention',{intervention:{...branch.spec,commandIndex},
    selectorSource:"throw Error('DATA_ONLY_INTERVENTION_SCOPE_TEST');\n"});
   const catalog=await prepareFullExperimentCatalog(pkg);
   for(const opponentController of ['human','ai']){
    const seats=humanSeats();seats[side]={controller:'ai',policy:pkg.id,difficulty:'medium'};
    if(opponentController==='ai')seats[opponent]={controller:'ai',policy:opponent+'-medium',difficulty:'medium'};
    const original=await play(map,seats,{experimentCatalog:catalog});
    assert.equal(original.archive.replay.entries.length,6);
    await assert.rejects(()=>importFullTrainingArchive(original.archive,{experimentCatalog:catalog}),
     /FULL_EXPERIMENT_(INTERVENTION_SCOPE|PREFIX_DRIFT|INTERVENTION_MISSED)/,
     `${side} intervention index ${commandIndex}, opponent ${opponentController}`);
   }
  }
 }
});

test('module comments cannot hide dynamic imports or uninventoried static requests',async()=>{
 const variants=[
  "import /* guarded, never executed */ ('./unlisted.mjs');\n",
  "import {nothing} from /* guarded, never executed */ './unlisted.mjs';\n",
  "import /* side effect */ './unlisted.mjs';\n",
  "export * from /* re-export */ './unlisted.mjs';\n",
  "const sample = `${import /* embedded expression */ ('./unlisted.mjs')}`;\n",
  "import {nothing} from './un\\u006cisted.mjs';\n"
 ];
 for(const selectorSource of variants){
  const env=await environment(), pkg=await policyPackage(env,'player','frozen-fire-model',{selectorSource});
  await assert.rejects(()=>prepareFullExperimentCatalog(pkg),/FULL_EXPERIMENT_(DYNAMIC_IMPORT|UNBOUND_DEPENDENCY)/);
 }
 const env=await environment(), pkg=await policyPackage(env,'player','frozen-fire-model',{selectorSource:
  "import /* real listed dependency */ {nothing} from /* legal comment */ './fire-network.mjs';\n"+
  "const note = \"import /* text */ ('./unlisted.mjs')\";\n"+
  "const expression = /import.*from/; const template = `import('text')`;\n"+
  "// import('./unlisted.mjs')\n/* export * from './unlisted.mjs' */\n"});
 await prepareFullExperimentCatalog(pkg);
});

test('experiment base delegation preserves the actual production Medium exploration and accepted-command lifecycle on both seats',async()=>{
 const env=await environment();
 for(const side of ['player','enemy']){
  const pkg=await policyPackage(env,side,'frozen-fire-model'), catalog=await prepareFullExperimentCatalog(pkg);
  async function run(experiment){
   const game=fullShell();await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
   game.run(await readFile(new URL('../editor-draft.js',import.meta.url),'utf8'));
   const owner=await productionOwner(game),full=game.context.GoblinCatalogFullRuntime;
   if(experiment)await registerFullExperimentController({catalog,id:pkg.id,full,root:game.context});
   const policy=experiment?pkg.id:side+'-medium', selection={player:side==='player'?policy:null,enemy:side==='enemy'?policy:null};
   const config=await game.context.GoblinEditorDraft.prepare({version:'goblin-level-v3',width:16,height:8,
    objective:'core-and-escort',terrain:[],units:[{id:'lead',assetId:'assault-tank',team:'player',x:1,y:3},
     {id:'guard',assetId:'guard-tank',team:'enemy',x:12,y:3},{id:'core',assetId:'command-core',team:'enemy',x:13,y:3}],
    goals:[{type:'enemy-turn-limit',turns:1}]});
   game.context.config=config;game.context.controls={...owner.nativeSetup(config,selection),seed:7,ui:{handoff(_side,take){take();}}};
   const port=game.run('loadEditorDraft(config,controls)'), host=owner.bind(game.run('legacySession'),selection,{refresh(){}},port);
   const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
   try{
    for(let step=0;step<40&&!port.state().ended;step++){
     if(port.state().controller==='ai')assert.deepEqual(await host.advance(),{ok:true});
     else assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'},player.dispatch).ok,true);
    }
    assert.equal(port.state().ended,true);
    const archive=JSON.parse(JSON.stringify(port.trainingArchive()));
    assert.ok(archive.replay.entries.some(entry=>entry.side===side&&entry.command.type==='Move'));
    return {outcome:archive.outcome,entries:archive.replay.entries.map(({digest,...entry})=>entry),
     units:JSON.parse(game.run('JSON.stringify(units)'))};
   }finally{host.leave();}
  }
  assert.deepEqual(await run(true),await run(false));
 }
});
