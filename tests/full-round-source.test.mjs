import assert from 'node:assert/strict';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {execute} from './artillery-product-harness.mjs';
import {createFullRoundSource} from '../full-round-source.mjs';

test('native U13 terminal shot retains the selected hex and concrete hit',async()=>{
  const g=await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  const source=createFullRoundSource(()=>g.run('({session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver})'));
  g.context.GoblinFullRoundSource=source;
  source.start();
  const actor=g.run(`(()=>{
    const missile=units.find(u=>u.catalogId==='U13');
    missile.x=0; missile.y=0;
    for (const u of units.filter(u=>u.team==='enemy')) {
      if (u.core) {u.x=2;u.y=0;u.hp=1;}
      else {u.hp=0;if(u.catalogSystems)u.alive=false;}
    }
    terrain.clear();terrainTypes.clear();
    setTurnPhase('fire');
    return missile.id;
  })()`);
  g.context.rollQueue=[.99];
  assert.ok(execute(g,{type:'CatalogHexFire',actorId:actor,x:2,y:0}).ok);
  const shot=source.view().terminalPartial.rows.find(row=>row.kind==='fire');
  assert.deepEqual(shot.targetCell,{x:2,y:0});
  assert.ok(shot.hits.some(hit=>hit.target.labelKey==='library.unit.command-core.name'&&hit.resultKey==='X'));
});

test('native FULL commits publish a completed round and rewind discarded actions',async()=>{
  const g = await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  const source = createFullRoundSource(() => g.run('GoblinCatalogFullRuntime.active() && ({session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver})'));
  g.context.GoblinFullRoundSource = source;
  source.start();
  const actor = g.run("units.find(u=>u.team==='player'&&u.move>0).id");
  const moves = g.run(`(()=>{const actor=units.find(unit=>unit.id===${JSON.stringify(actor)});return hexNeighbors(actor.x,actor.y).filter(cell=>GoblinCatalogFullRuntime.moveQuery({type:'Move',actorId:actor.id,...cell}).ok)})()`);
  assert.ok(moves.length >= 2);
  assert.ok(execute(g,{type:'Move',actorId:actor,...moves[0]}).ok);
  g.run('undoPhaseCommand()');
  assert.ok(execute(g,{type:'Move',actorId:actor,...moves[1]}).ok);
  assert.equal(source.view().latestComplete,null);
  g.run("setTurnPhase('fire');setTurnPhase('gev');startEnemyTurn()");
  const job = [...g.timers].find(([,callback])=>String(callback).includes('const foes='));
  assert.ok(job);
  g.timers.delete(job[0]);
  job[1]();
  const round = source.view().latestComplete;
  assert.equal(round.roundNumber,1);
  assert.equal(round.perspective,'player');
  assert.equal(round.rows.filter(row=>row.side==='player'&&row.kind==='move').length,1);
  assert.ok(round.rows.some(row=>row.side==='enemy'));
  assert.ok(round.rows.filter(row=>row.side==='enemy').every(row=>!row.snapshot?.visiblePathSegments.length&&!row.options));
  assert.equal(source.view().terminalPartial,null);
  g.run('finish(false)');
  assert.equal(source.view().terminalPartial.roundNumber,2);
  assert.equal(source.view().latestComplete.perspective,'post-mission');
  g.run("loadScenario('catalog-full-atlas')");
  assert.equal(source.view().latestComplete,null);
});
