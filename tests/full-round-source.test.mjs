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

test('FULL round uses the authorized seat and keeps concealed event coordinates private',async()=>{
  const game=await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  const seats=[];
  game.context.control={roles:{player:'human',enemy:'human'},ui:{handoff:(seat,take)=>seats.push({seat,take})}};
  const port=game.run("loadScenario('catalog-full-atlas',control)");
  const source=createFullRoundSource(()=>game.run(`({
    session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver,
    port:GoblinCatalogFullRuntime.controllerPort()
  })`));
  game.context.GoblinFullRoundSource=source;
  source.start();
  assert.equal(source.view(),null);
  assert.equal(seats.at(-1).take(),true);

  game.run(`{
    const phantom=units.find(unit=>unit.catalogId==='U21'&&unit.team==='enemy');
    phantom.x=11;phantom.y=7;phantom.moveFrom={x:10,y:7};
    GoblinCatalogFullRuntime.refresh();
    if(GoblinCatalogFullRuntime.known(phantom.id,'player'))throw Error('expected concealed unit');
    GoblinCatalogFullRuntime.recordRoundAction(phantom,{},{kind:'move',acceptedPrefix:[{x:11,y:7}]});
  }`);
  assert.equal(source.view().latestComplete,null);
  function endPlayer() {
    for(let step=0;step<3;step++) {
      const offer=port.open('human');
      assert.equal(port.commit('human',offer.permit,{type:'EndPhase'}).ok,true);
    }
  }
  endPlayer();
  assert.equal(source.view(),null);
  assert.equal(seats.at(-1).take(),true);
  for(let step=0;step<80&&port.state().side==='enemy';step++) {
    const offer=port.open('human');
    assert.equal(port.commit('human',offer.permit,offer.entries.find(entry=>entry.baseline).command).ok,true);
  }
  assert.equal(seats.at(-1).seat.side,'player');
  assert.equal(source.view(),null);
  assert.equal(seats.at(-1).take(),true);
  const player=source.view();
  const recordedPath=[{x:10,y:7},{x:11,y:7}];
  const hasPath=row=>row.snapshot?.visiblePathSegments.some(path=>JSON.stringify(path.cells)===JSON.stringify(recordedPath));
  assert.equal(player.latestComplete.rows.some(hasPath),false);
  assert.equal(player.terminalPartial,null);
  assert.equal(player.trace,undefined);
  endPlayer();
  assert.equal(seats.at(-1).seat.side,'enemy');
  assert.equal(source.view(),null);
  assert.equal(seats.at(-1).take(),true);
  const defender=source.view().latestComplete;
  assert.equal(defender.perspective,'player');
  assert.ok(defender.rows.some(hasPath));
  assert.ok(defender.rows.every(row=>!row.options&&!row.explanationKey));
  game.run("loadScenario('catalog-full-atlas',control)");
  assert.equal(source.view(),null);
});
