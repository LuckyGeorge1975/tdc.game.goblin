import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene,fullShell} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
import {selectWeakFullCatalog,selectMediumFullCatalog} from '../src/core/full-catalog-difficulty.mjs';
import {fullSeatFallback} from '../full-standard-seat-owner.mjs';
import {hexDistance} from '../src/core/hex.mjs';
import {prepareFullAttack2a,FULL_ATTACK_2A_ENGINE,FULL_ATTACK_2A_ID} from '../src/core/full-attack-2a.mjs';

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

test('Medium only replaces a voluntary movement pass with the best legal approach to an open visible objective',()=>{
  const actor={id:'attacker',relation:'own',alive:true,hp:3,maxHp:3,x:0,y:0};
  const guard={id:'guard',relation:'opponent',alive:true,hp:3,maxHp:3,x:3,y:0};
  const end={key:'end',kind:'end-phase',facts:{}};
  const move=(key,x,y)=>({key,kind:'move',actorId:actor.id,target:{kind:'cell',x,y},facts:{}});
  const first=move('first',1,0), tied=move('tied',1,1), away=move('normal',0,1);
  const batch={side:'player',phase:'movement',slot:'movement',
    view:{units:[actor,guard],objectives:[{kind:'destroy-core',satisfied:true},{kind:'destroy-escort'}],
      tactics:{cover:[],unitFacts:{guard:{range:2}},crt:{}}},candidates:[end,first,tied]};
  assert.equal(selectMediumFullCatalog(batch),first.key);
  assert.equal(selectMediumFullCatalog({...batch,candidates:[end,tied,first]}),tied.key);
  assert.equal(selectMediumFullCatalog({...batch,phase:'fire',slot:'fire'}),end.key);
  assert.equal(selectMediumFullCatalog({...batch,view:{...batch.view,objectives:[{kind:'destroy-escort',satisfied:true}]}}),end.key);
  assert.equal(selectMediumFullCatalog({...batch,view:{...batch.view,units:[actor]},candidates:[end,first]}),end.key);
  assert.equal(selectMediumFullCatalog({...batch,candidates:[end,away]}),end.key);
  const covered={...batch,view:{...batch.view,tactics:{...batch.view.tactics,cover:[away.target]}},candidates:[end,first,away]};
  assert.equal(selectMediumFullCatalog(covered),away.key);
  const shot={key:'shot',kind:'fire',actorId:actor.id,target:{kind:'unit',unitId:guard.id},
    facts:{attack:6,ratioCategory:'5-1',effectKind:'unit-crt'}};
  assert.equal(selectMediumFullCatalog({...batch,side:'enemy',slot:'first',phase:'enemy',
    view:{...batch.view,objectives:[{kind:'destroy-player-force',satisfied:false}]},candidates:[{...end,kind:'hold'},first,shot]}),shot.key);
});

test('the pinned trained attacker is session-bound and follows the central AI selection rank',async()=>{
  const game=await boot();
  setupEditor(game);
  game.context.draft=imported();
  await game.run(`Promise.all([draft,{...draft,minimumDifficulty:'weak'},{...draft,aiAllowed:false}]
    .map(GoblinEditorDraft.prepare)).then(levels=>globalThis.trainedLevels=levels)`);
  const full=game.context.GoblinCatalogFullRuntime;
  const modelBytes=Buffer.from(JSON.parse(text('assets/ai/full-attack-2a.json')).base64,'base64');
  const damaged=Uint8Array.from(modelBytes);
  damaged[0]^=1;
  await assert.rejects(prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes:damaged}),/AI_POLICY_HASH_MISMATCH/);
  assert.equal(game.run('GoblinCatalogFullRuntime.controllerOffers(trainedLevels[0]).player.choices.length'),0);
  const select=await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes});
  assert.throws(()=>full.registerQualifiedController({side:'enemy',id:FULL_ATTACK_2A_ID,difficulty:null,select}),
    {code:'FULL_AI_QUALIFICATION_INVALID'});
  assert.throws(()=>full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:'medium',select}),
    {code:'FULL_AI_QUALIFICATION_INVALID'});
  full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select});
  const offers=game.run('trainedLevels.map(level=>GoblinCatalogFullRuntime.controllerOffers(level))');
  assert.deepEqual(JSON.parse(JSON.stringify(offers[0].player.choices)),[{id:FULL_ATTACK_2A_ID,difficulty:null}]);
  assert.equal(offers[0].enemy.choices.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(offers[1].player.choices)),[{id:FULL_ATTACK_2A_ID,difficulty:null}]);
  assert.equal(offers[2].player.choices.length,0);
  const roles={player:'ai',enemy:'human'}, ids={player:FULL_ATTACK_2A_ID};
  const startDraft=index=>`(control=>loadEditorDraft(trainedLevels[${index}],control))`;
  assert.equal(start(game,startDraft(1),roles,ids).state().policyId,FULL_ATTACK_2A_ID);
  assert.throws(()=>start(game,startDraft(2),roles,ids),{code:'AI_LEVEL_FORBIDDEN'});
  const port=start(game,startDraft(0),roles,ids);
  assert.equal(port.state().policyId,FULL_ATTACK_2A_ID);
  assert.equal(Object.hasOwn(port.state(),'difficulty'),false);
  assert.equal(port.project('ai').view.tactics,undefined);
  const oldSelector=port.qualifiedSelector();
  const host=createOwnedFullCatalogSessionHost({port,player:playerHost(game)});
  for(let step=0;port.state().side==='player'&&!port.state().ended&&step<100;step++)
    assert.equal((await host.advance()).ok,true);
  assert.equal(port.state().side,'enemy');
  assert.equal(port.qualifiedSelector(),null);
  assert.equal((await host.advance()).code,'AI_HOST_WRONG_SIDE');
  const next=start(game,startDraft(0),roles,ids);
  assert.equal(next.state().policyId,FULL_ATTACK_2A_ID);
  assert.equal(port.state(),null);
  assert.throws(()=>oldSelector({}),/AI_POLICY_SCOPE_MISMATCH/);
});

test('saved FULL seed 5 progresses through the former fixed point to native mission end',async t=>{
  const game=await fullScene(atlas,5,false,'FULL_CATALOG_v1');
  setupEditor(game);
  game.run(text('saved-levels.js'));
  const storage=new Map();
  game.context.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  game.context.seedDraft=imported();
  await game.run(`GoblinSavedLevels.save('Seed 5',seedDraft);
    GoblinEditorDraft.prepare(GoblinEditorDraft.parse(GoblinSavedLevels.read()[0].level)).then(value=>globalThis.admitted=value)`);
  let movesAfterCore=0, plans=0, commits=0, removalTurn;
  for(const side of ['player','enemy'])register(game,side,'medium',batch=>{
    assert.equal(plans++,commits);
    const key=selectMediumFullCatalog(batch);
    const candidate=batch.candidates.find(c=>c.key===key);
    assert.ok(candidate);
    const guard=batch.view.units.find(u=>u.id==='guard');
    const core=batch.view.units.find(u=>u.id==='core');
    if(side==='player'&&core?.alive===false&&guard?.alive&&candidate.kind==='move'){
      const actor=batch.view.units.find(u=>u.id===candidate.actorId);
      if(hexDistance(candidate.target,guard)<hexDistance(actor,guard))movesAfterCore++;
    }
    return key;
  });
  const port=start(game,'(control=>loadEditorDraft(admitted,control))',{player:'ai',enemy:'ai'},
    {player:'player-medium',enemy:'enemy-medium'});
  const host=createOwnedFullCatalogSessionHost({port,player:playerHost(game),onCommit:()=>commits++});
  const full=game.context.GoblinCatalogFullRuntime;
  for(let index=0;index<120&&!port.state().ended;index++){
    assert.ok((await host.advance()).ok);
    if(full.deadlineRemoved())removalTurn??=game.run('turn');
  }
  assert.equal(removalTurn,2);
  assert.ok(movesAfterCore>0);
  assert.ok(port.state().ended);
  assert.equal(port.state().outcome,true);
  assert.equal(game.run('turn'),3);
  assert.equal(plans,commits);
  t.diagnostic(JSON.stringify({seed:5,removalTurn,movesAfterCore,commits,turn:game.run('turn'),outcome:port.state().outcome,rng:game.rng()}));
});

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

test('an AI-disabled saved FULL level composes Player commands from the live human port',async()=>{
  const game=await boot();
  setupEditor(game);
  const stored=new Map();
  game.context.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
  game.run(text('saved-levels.js'));
  game.context.draft={...imported(),aiAllowed:false,minimumDifficulty:'medium'};
  await game.run(`GoblinSavedLevels.save('Human only',draft);
    GoblinEditorDraft.prepare(GoblinEditorDraft.parse(GoblinSavedLevels.read()[0].level))
      .then(value=>globalThis.admitted=value)`);
  let takeSeat;
  const startDraft='(control=>loadEditorDraft(admitted,control))';
  const port=start(game,startDraft,human,{}, {handoff(_seat,take){takeSeat=take}});
  const player=playerHost(game);
  assert.equal(player.project('player'),null);
  assert.equal(port.project('ai'),null);
  assert.deepEqual(player.humanPlayerOptions(port),[]);
  assert.equal(takeSeat(),true);
  assert.equal(port.project('human').view.side,'player');
  const move=player.humanPlayerOptions(port).find(entry=>entry.command.type==='Move');
  assert.ok(move);
  assert.equal(port.commit('human',port.open('human').permit,move.command,player.dispatch).ok,true);
  assert.equal(player.project('player'),null);
  port.pause();
  assert.deepEqual(player.humanPlayerOptions(port),[]);
  start(game,startDraft,human);
  assert.deepEqual(player.humanPlayerOptions(port),[]);
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
