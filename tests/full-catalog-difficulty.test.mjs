import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene,fullShell} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
import {selectWeakFullCatalog,selectMediumFullCatalog} from '../src/core/full-catalog-difficulty.mjs';
import {fullSeatFallback} from '../full-standard-seat-owner.mjs';

const atlas='catalog-full-atlas';
const text=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const imported=()=>JSON.parse(text('tests/fixtures/full-draft-core-deadline.v3.json'));
const scorched=()=>JSON.parse(text('assets/unit-art/levels/scorched-earth.v3.json'))[0];
const boot=()=>fullScene(atlas,720,false,'FULL_CATALOG_v1');
const human={player:'human',enemy:'human'};
const setupEditor=game=>['level-events.js','editor-draft.js'].forEach(file=>game.run(text(file)));
const register=(game,side,difficulty,select)=>(game.context.GoblinCatalogFullRuntime.registerQualifiedController({
  side,id:`${side}-${difficulty}`,difficulty,select
}));

function playerHost(game) {
  const full=game.context.GoblinCatalogFullRuntime;
  return createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>game.run('phase'),game.context.GoblinSpecialistsRuntime);
}

function start(game,expression,roles,policyIds={},ui={}) {
  game.context.controls={roles,policyIds,ui};
  return game.run(`${expression}(controls)`);
}

test('authored FULL minimum round-trips through import, export and save, without changing battlefield identity',async()=>{
  const game=await boot();
  setupEditor(game);
  const stored=new Map();
  game.context.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
  game.run(text('saved-levels.js'));
  game.context.draftWithFloor={...imported(),minimumDifficulty:'medium'};
  game.context.plainDraft=imported();
  for (const minimum of [null,0,'Medium','easy',[],{}]) {
    game.context.badDraft={...imported(),minimumDifficulty:minimum};
    assert.throws(()=>game.run('GoblinEditorDraft.validate(badDraft)'),{code:'FULL_AI_MINIMUM_INVALID'});
  }
  assert.throws(()=>game.run(`GoblinEditorDraft.validate({...draftWithFloor,version:'goblin-level-v1'})`),/schema/);
  await game.run(`Promise.all([GoblinEditorDraft.prepare(plainDraft),
    GoblinEditorDraft.prepare(GoblinEditorDraft.importLevels(JSON.stringify(draftWithFloor))[0])])
    .then(value=>globalThis.prepared=value)`);
  assert.equal(game.run('prepared[0].catalog.levelDigest'),game.run('prepared[1].catalog.levelDigest'));
  assert.equal(game.run('prepared[1].minimumDifficulty'),'medium');
  assert.equal(game.run('JSON.parse(GoblinEditorDraft.exportJson(draftWithFloor)).minimumDifficulty'),'medium');
  assert.equal(game.run(`GoblinSavedLevels.save('Minimum',draftWithFloor);
    GoblinEditorDraft.parse(GoblinSavedLevels.read()[0].level).minimumDifficulty`),'medium');

  const historical=game.run(`GoblinCatalogFullModel.configs['${atlas}'].catalog.levelDigest`);
  const curated=fullShell(720);
  curated.context.packageV3=JSON.parse(text('assets/unit-art/levels/catalog-full-levels.v3.json'));
  await curated.run(`packageV3.levels.find(level=>level.id==='${atlas}').minimumDifficulty='strong';
    GoblinCatalogFullModel.initialize(data,packageV3,{profile:'FULL_CATALOG_v1'})`);
  assert.equal(curated.run(`GoblinCatalogFullModel.configs['${atlas}'].catalog.levelDigest`),historical);
  assert.equal(curated.run(`GoblinCatalogFullModel.configs['${atlas}'].minimumDifficulty`),'strong');
  curated.run('Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs)');
  assert.throws(()=>curated.run(`loadScenario('${atlas}')`),{code:'FULL_AI_MINIMUM_REQUIRES_SELECTION'});
  assert.equal(start(curated,`(control=>loadScenario('${atlas}',control))`,human).state().controller,'human');
});

test('admission binds the actual qualified policy per side before start, preserves human fallback and revalidates restart',async()=>{
  const game=await boot();
  setupEditor(game);
  game.context.draft={...imported(),minimumDifficulty:'medium'};
  await game.run('GoblinEditorDraft.prepare(draft).then(value=>globalThis.admitted=value)');
  const qualified=batch=>batch.candidates.find(candidate=>candidate.kind==='end-phase').key;
  register(game,'player','weak',selectWeakFullCatalog);
  register(game,'player','medium',qualified);
  register(game,'enemy','weak',selectWeakFullCatalog);
  const offers=read(game,'GoblinCatalogFullRuntime.controllerOffers(admitted)');
  assert.deepEqual(offers,{minimumDifficulty:'medium',legacyStartAllowed:false,
    player:{choices:[{id:'player-medium',difficulty:'medium'}],reason:null},
    enemy:{choices:[],reason:'FULL_AI_MINIMUM_UNAVAILABLE'}});
  const startDraft='(control=>loadEditorDraft(admitted,control))';
  const humanPort=start(game,startDraft,human);
  assert.deepEqual(fullSeatFallback(game.run('legacySession'),{player:null,enemy:null},humanPort),{});
  const initial={rng:game.rng(),revision:game.run('GoblinCatalogFullRuntime.commandRevision()'),timers:game.timers.size};
  assert.throws(()=>game.run('loadEditorDraft(admitted)'),{code:'FULL_AI_MINIMUM_REQUIRES_SELECTION'});
  assert.throws(()=>start(game,startDraft,{...human,player:'ai'},{player:'player-weak'}),{code:'FULL_AI_BELOW_MINIMUM'});
  assert.throws(()=>start(game,startDraft,{...human,enemy:'ai'},{enemy:'player-medium'}),{code:'FULL_AI_MINIMUM_UNAVAILABLE'});
  assert.throws(()=>start(game,startDraft,{...human,enemy:'ai'}),{code:'FULL_AI_MINIMUM_UNAVAILABLE'});
  assert.throws(()=>start(game,startDraft,human,{enemy:'enemy-weak'}),{code:'FULL_AI_FOR_HUMAN'});
  assert.deepEqual({rng:game.rng(),revision:game.run('GoblinCatalogFullRuntime.commandRevision()'),timers:game.timers.size},initial);
  assert.ok(humanPort.state());
  const roles={...human,player:'ai'}, ids={player:'player-medium'};
  const aiPort=start(game,startDraft,roles,ids);
  assert.equal(humanPort.state(),null);
  assert.equal(aiPort.qualifiedSelector(),qualified);
  assert.equal(aiPort.state().difficulty,'medium');
  assert.deepEqual(fullSeatFallback(game.run('legacySession'),{player:'player-medium',enemy:null},aiPort),{});
  assert.throws(()=>fullSeatFallback(game.run('legacySession'),{player:'player-weak',enemy:null},aiPort),/FULL_CONTROLLER_NOT_OFFERED/);
  let action;
  const host=createOwnedFullCatalogSessionHost({port:aiPort,player:playerHost(game),
    select:{player:()=>assert.fail('external callback replaced the native policy')},onCommit:result=>action=result.action});
  assert.equal((await host.advance()).ok,true);
  assert.equal(action.type,'EndPhase');
  const restarted=start(game,startDraft,roles,ids);
  assert.equal(aiPort.state(),null);
  assert.equal(restarted.qualifiedSelector(),qualified);
  assert.equal(restarted.state().phase,'movement');
  await game.run('GoblinEditorDraft.prepare({...draft,aiAllowed:false}).then(value=>globalThis.forbidden=value)');
  assert.equal(game.run('GoblinCatalogFullRuntime.controllerOffers(forbidden).player.reason'),'AI_LEVEL_FORBIDDEN');
  assert.throws(()=>start(game,'(control=>loadEditorDraft(forbidden,control))',roles,ids),{code:'AI_LEVEL_FORBIDDEN'});
  assert.ok(start(game,'(control=>loadEditorDraft(forbidden,control))',human).state());
});

test('Medium can commit a legal conventional transport through the same native player port',async()=>{
  const game=await boot();
  setupEditor(game);
  const {goals,events,...level}=imported();
  game.context.cargoDraft={...level,units:[
    {id:'drone',assetId:'artillery-drone',team:'player',x:1,y:3},
    {id:'carrier',assetId:'skimmer-carrier',team:'player',x:2,y:3},
    {id:'core',assetId:'command-core',team:'enemy',x:6,y:3}
  ]};
  await game.run(`GoblinEditorDraft.prepare(cargoDraft).then(value=>globalThis.admitted=value)`);
  let options;
  register(game,'player','medium',batch=>{
    options=batch.candidates.filter(candidate=>['load','end-phase'].includes(candidate.kind));
    return selectMediumFullCatalog({...batch,candidates:options});
  });
  const port=start(game,'(control=>loadEditorDraft(admitted,control))',{...human,player:'ai'},{player:'player-medium'});
  const host=createOwnedFullCatalogSessionHost({port,player:playerHost(game)});
  const command={type:'Embark',actorId:'drone',carrierId:'carrier',x:2,y:3};
  const gateway=game.context.GoblinCatalogFullRuntime.nativePlayerGateway;
  assert.equal(gateway.query(command).ok,true);
  assert.equal(gateway.dispatch(command,game.run('GoblinCatalogFullRuntime.commandRevision()')).code,'FULL_CONTROL_STALE');
  assert.equal((await host.advance()).ok,true);
  assert.ok(options.some(candidate=>candidate.kind==='load'));
  assert.equal(game.run("units.find(unit=>unit.id==='drone').embarkedOn"),'carrier');
});

for (const [level,levelSource] of [['Atlas',null],['Scorched Earth',scorched],['import',imported]]) {
  test(`both named selectors execute native turns on both sides of ${level}`,async()=>{
    const differences=new Set();
    for (const [side,difficulty,selector] of [
      ['player','weak',selectWeakFullCatalog],['player','medium',selectMediumFullCatalog],
      ['enemy','weak',selectWeakFullCatalog],['enemy','medium',selectMediumFullCatalog]
    ]) {
      const game=await boot();
      setupEditor(game);
      game.run(`GameDialogs.confirm=()=>{throw Error('unexpected confirmation')};
        GameDialogs.warn=async ({id})=>{if(id!=='level-event')throw Error('unexpected warning')}`);
      let expression=`(control=>loadScenario('${atlas}',control))`;
      if (levelSource) {
        game.context.input=JSON.stringify(levelSource());
        await game.run(`GoblinEditorDraft.prepare(GoblinEditorDraft.importLevels(input)[0])
          .then(value=>globalThis.level=value)`);
        expression='(control=>loadEditorDraft(level,control))';
      }
      const seenActions=new Set();
      let plans=0, commits=0;
      register(game,side,difficulty,batch=>{
        assert.equal(batch.side,side);
        assert.ok(Object.isFrozen(batch));
        assert.ok(batch.view.tactics);
        assert.ok(batch.view.units.every(unit=>unit.relation==='own'||unit.relation==='opponent'));
        assert.equal(plans,commits,'new planning before the previous native commit');
        plans++;
        if(selectWeakFullCatalog(batch)!==selectMediumFullCatalog(batch))differences.add(side);
        const key=selector(batch);
        assert.ok(batch.candidates.some(candidate=>candidate.key===key));
        return key;
      });
      const port=start(game,expression,{...human,[side]:'ai'},{[side]:`${side}-${difficulty}`},
        {handoff(_seat,takeSeat){assert.equal(takeSeat(),true)}});
      const host=createOwnedFullCatalogSessionHost({port,player:playerHost(game),onCommit:receipt=>{
        commits++;
        seenActions.add(receipt.action.type);
      }});
      host.pause();
      assert.equal((await host.advance()).ok,false);
      assert.equal(plans,0);
      host.resume();
      if(side==='enemy') {
        assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
        assert.equal(plans,0);
        for(let phase=0;phase<3;phase++)
          assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'}).ok,true);
      }
      assert.equal(port.state().side,side);
      for(let attempt=0;port.state().side===side&&!port.state().ended&&attempt<100;attempt++) {
        const result=await host.advance();
        assert.equal(result.ok,true,`${level} ${side} ${difficulty}: ${result.code}`);
      }
      assert.ok(port.state().side!==side||port.state().ended);
      assert.ok(seenActions.size);
      assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
      assert.equal(plans,commits);
    }
    assert.ok(differences.size,`${level}: identical choices throughout`);
  });
}
