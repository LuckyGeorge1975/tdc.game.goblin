import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {read} from './artillery-product-harness.mjs';
import {createFullRoundSource} from '../full-round-source.mjs';
import {selectStandardFullDefender} from '../full-standard-seat-owner.mjs';
import {prepareFullAttack2a,FULL_ATTACK_2A_ENGINE,FULL_ATTACK_2A_ID} from '../src/core/full-attack-2a.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';

const text = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const modelBytes = Buffer.from(JSON.parse(text('assets/ai/full-attack-2a.json')).base64,'base64');
const deadlines = 'tests/fixtures/full-draft-core-deadline.v3.json';

async function setup() {
  const game = await fullScene('catalog-full-atlas',720,false,'FULL_CATALOG_v1');
  for (const file of ['level-events.js','editor-draft.js']) game.run(text(file));
  const source = createFullRoundSource(() => game.run(`({
    session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver,
    spectator:!!GoblinCatalogFullRuntime.controllerPort()?.spectator()
  })`));
  game.context.GoblinFullRoundSource=source;
  const full = game.context.GoblinCatalogFullRuntime;
  const player = createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    () => game.run('phase'),game.context.GoblinSpecialistsRuntime);
  return {game,source,full,player};
}

const state = game => read(game,`({
  units,turn,phase,turnPhase,gameOver,full:GoblinCatalogFullRuntime.snapshot()
})`);

async function run(reporting,reference,select) {
  const context = await setup();
  const {game,source,full,player} = context;
  game.context.draft=JSON.parse(text(deadlines));
  await game.run('GoblinEditorDraft.prepare(draft).then(level=>globalThis.admitted=level)');
  const reported=[], commands=[];
  full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,
    select(batch,port,report) {
      return select(batch,port,reporting ? (evidence)=>{
        if (evidence.options?.length) {
          const selected=batch.candidates.find(candidate=>candidate.key===evidence.key);
          const baseline=batch.candidates.find(candidate=>candidate.key===evidence.options.find(option=>option.baseline).key);
          assert.equal(selected.actorId,baseline.actorId);
          assert.equal(selected.weaponRef,baseline.weaponRef);
          for (const option of evidence.options.filter(option=>Number.isFinite(option.scores.model))) {
            const candidate=batch.candidates.find(candidate=>candidate.key===option.key);
            assert.equal(candidate.actorId,baseline.actorId);
            assert.equal(candidate.weaponRef,baseline.weaponRef);
          }
        }
        reported.push(evidence);
        report(evidence);
      } : undefined);
    }
  });
  const port=game.run(`loadEditorDraft(admitted,{roles:{player:'ai',enemy:'ai'},
    policyIds:{player:'${FULL_ATTACK_2A_ID}'}})`);
  const host=createOwnedFullCatalogSessionHost({port,player,select:{enemy:reporting?
    selectStandardFullDefender:batch=>selectStandardFullDefender(batch)},
    onCommit({action}) { commands.push(action); }
  });
  const snapshots=[];
  for (let index=0; !port.state()?.ended && index<80; index++) {
    assert.equal((await host.advance()).ok,true);
    const current={action:structuredClone(commands.at(-1)),state:state(game),rng:game.rng()};
    if (reference) assert.deepEqual(current,reference[index]);
    snapshots.push(current);
    if (game.run('turn')>1 && !port.state().ended)
      assert.equal(source.view().latestComplete.perspective,'spectator');
  }
  assert.equal(port.state()?.ended,true);
  assert.equal(port.state()?.outcome,true);
  if (reference) assert.equal(snapshots.length,reference.length);
  return {context,commands,snapshots,reported,rounds:source.view().trace};
}

test('native FULL attaches only actual deadline and model evidence without affecting commands or draws',async t=>{
  const select=await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,modelBytes});
  const control=await run(false,null,select);
  const active=await run(true,control.snapshots,select);
  const rows=active.rounds.flatMap(round=>round.rows);
  const protectedShots=rows.filter(row=>row.explanationKey==='v2.round.deadlinePriority');
  const modelShots=rows.filter(row=>['v2.round.modelTarget','v2.round.modelBaseline'].includes(row.explanationKey));
  assert.ok(protectedShots.length>0 && modelShots.length>0);
  assert.ok(rows.some(row=>row.explanationKey==='v2.round.objectiveMove'));
  assert.equal(rows.filter(row=>row.explanationKey==='v2.round.objectivePass').length,
    active.commands.filter(action=>action.type==='EndPhase').length);
  assert.ok(rows.some(row=>row.explanationKey==='v2.round.standardAction'));
  for (const row of [...protectedShots,...modelShots]) {
    assert.equal(row.kind,'fire');
    assert.equal(row.options.filter(option=>option.selected).length,1);
    assert.equal(row.options.filter(option=>option.baseline).length,1);
    assert.ok(row.options.every(option=>Number.isFinite(option.scores.basis)));
    assert.ok(row.options.every(option=>option.actor && Object.hasOwn(option,'weaponRef')));
    assert.equal(row.options.some(option=>Number.isFinite(option.scores.model)),modelShots.includes(row));
    assert.equal(row.options.find(option=>option.selected).target?.labelKey,row.target?.labelKey);
  }
  const compared=rows.filter(row=>protectedShots.includes(row)||modelShots.includes(row));
  const reports=active.reported.filter(report=>report.options?.length);
  assert.equal(compared.length,reports.length);
  for (let index=0; index<compared.length; index++) {
    const row=compared[index], report=reports[index];
    assert.equal(row.explanationKey,report.explanationKey);
    assert.deepEqual(row.options.map(option=>option.scores),
      JSON.parse(JSON.stringify(report.options.map(option=>option.scores))));
  }
  assert.equal(control.rounds.flatMap(round=>round.rows).some(row=>
    row.options?.some(option=>option.scores)),false);
  t.diagnostic(JSON.stringify({commands:active.commands.length,deadlineShots:protectedShots.length,
    modelShots:modelShots.length,rng:active.context.game.rng()}));
});

test('FULL resume carries a reason only onto the accepted same-revision command',async()=>{
  for (const changed of [false,true]) {
    const {game,source,player}=await setup();
    const port=game.run('loadScenario("catalog-full-terrain-course",{roles:{player:"ai",enemy:"ai"}})');
    const wait=Promise.withResolvers();
    let planned;
    const host=createOwnedFullCatalogSessionHost({port,player,select:{player:async(batch,report)=>{
      const candidate=batch.candidates.find(item=>item.kind==='move');
      planned=candidate.key;
      report({key:planned,explanationKey:'v2.round.approach'});
      await wait.promise;
      return planned;
    }}});
    const pending=host.advance();
    assert.ok(planned);
    host.pause();
    wait.resolve();
    assert.equal((await pending).code,'AI_HOST_STALE');
    if (changed) game.run('GoblinCatalogFullRuntime.refresh()');
    const before=state(game), rng=game.rng();
    host.resume();
    const resumed=await host.advance();
    assert.equal(resumed.ok,!changed);
    if (changed) {
      assert.deepEqual(state(game),before);
      assert.deepEqual(game.rng(),rng);
    }
    game.run('finish(false)');
    const rows=source.view().terminalPartial.rows.filter(row=>row.explanationKey==='v2.round.approach');
    assert.equal(rows.length,changed?0:1);
    game.run('loadScenario("catalog-full-terrain-course")');
    assert.equal(source.view().latestComplete,null);
    assert.equal(source.view().terminalPartial,null);
  }
});
