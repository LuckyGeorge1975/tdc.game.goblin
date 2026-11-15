import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';

const loads = () => fullScene('catalog-full-atlas',7,true,'FULL_CATALOG_v1');
const initial = 'loadScenario("catalog-full-atlas",boundControl)';
const endPhase = {type:'EndPhase'};
const roles = (player,enemy) => ({player,enemy});

function load(game,selection,ui={}){
  game.context.boundControl={roles:selection,ui};
  return game.run(initial);
}

test('KI/KI exposes only a settled read-only spectator frame, including current full map and log',async()=>{
  const game=await loads();
  const port=load(game,roles('ai','ai'));
  const watcher=port.spectator();
  assert.deepEqual(Object.keys(watcher),['read']);
  assert.ok(Object.isFrozen(watcher));
  const start=watcher.read();
  assert.equal(port.project('spectator'),start);
  assert.equal(start.view.side,'spectator');
  assert.equal(start.view.terrain.width,12);
  assert.equal(start.view.terrain.height,8);
  assert.equal(start.view.units.length,game.run('units.length'));
  assert.equal(start.view.units.find(unit=>unit.id==='core').team,'enemy');
  assert.ok(Object.isFrozen(start.view.units));
  assert.ok(Object.isFrozen(start.view.units[0]));
  assert.ok(Object.isFrozen(start.log));
  const frozen=JSON.stringify(start);
  assert.equal(port.project('human'),null);
  assert.equal(port.open('spectator'),null);

  const phantom=game.run("units.find(unit=>unit.catalogId==='U21').id");
  game.run(`{
    const concealed=units.find(unit=>unit.catalogId==='U21');
    concealed.x=11;concealed.y=7;GoblinCatalogFullRuntime.refresh();
    GoblinCatalogFullRuntime.log('enemy-private-log',{},[],'enemy');
  }`);
  assert.equal(watcher.read(),start);
  assert.equal(port.commit('spectator',port.ticket('ai'),endPhase).code,'FULL_CONTROL_STALE');
  assert.equal(watcher.read(),start);
  const player=createFullCatalogAiHost(game.context.GoblinCatalogFullRuntime,game.context.GoblinSpecialistsUI,
    game.run('({query,dispatch})'),()=>game.run('phase'),game.context.GoblinSpecialistsRuntime);
  let sawBatch=false;
  const owner=createOwnedFullCatalogSessionHost({port,player,select:{player:batch=>{
    assert.ok(!JSON.stringify(batch).includes(phantom));
    assert.ok(!Object.hasOwn(batch.view,'log'));
    assert.ok(!Object.hasOwn(batch,'spectator'));
    assert.equal(watcher.read(),start);
    sawBatch=true;
    return batch.candidates.find(candidate=>candidate.kind==='end-phase').key;
  }}});
  assert.equal((await owner.advance()).ok,true);
  const next=watcher.read();
  assert.ok(sawBatch);
  assert.notEqual(next,start);
  assert.equal(next.view.phase,'fire');
  assert.equal(next.view.revision,start.view.revision+1);
  assert.ok(next.view.units.some(unit=>unit.id===phantom&&unit.x===11&&unit.y===7));
  assert.ok(next.log.some(entry=>entry.message==='enemy-private-log'));
  assert.equal(JSON.stringify(start),frozen);
  assert.equal(game.rolls(),0);

  const other=load(game,roles('ai','ai'));
  assert.equal(watcher.read(),null);
  assert.equal(port.project('spectator'),null);
  assert.notEqual(other.spectator().read().view.sessionId,start.view.sessionId);
  const newWatcher=other.spectator();
  other.leave();
  assert.equal(newWatcher.read(),null);
  assert.equal(other.project('spectator'),null);
});

test('a native enemy commit publishes a frame once; a foreign or stale commit publishes none',async()=>{
  const game=await loads();
  const port=load(game,roles('ai','ai'));
  for(let n=0;n<3;n++)assert.equal(port.commit('ai',port.open('ai').permit,endPhase).ok,true);
  const watcher=port.spectator();
  const before=watcher.read();
  assert.equal(before.view.activeSide,'enemy');
  const {permit,entries}=port.open('ai');
  const move=entries.find(option=>option.command.type==='EnemyMove');
  const action=(move??entries.find(option=>option.baseline)).command;
  assert.equal(port.commit('ai',permit,{...action,actorId:'core'}).code,'FULL_CONTROL_ACTOR');
  assert.equal(watcher.read(),before);
  assert.equal(port.commit('ai',permit,action).ok,true);
  const after=watcher.read();
  assert.equal(after.view.revision,before.view.revision+1);
  if(move){
    const actor=after.view.units.find(unit=>unit.id===action.actorId);
    assert.equal(actor.x,game.run(`units.find(u=>u.id===${JSON.stringify(action.actorId)}).x`));
    assert.equal(actor.y,game.run(`units.find(u=>u.id===${JSON.stringify(action.actorId)}).y`));
  }
  assert.equal(port.commit('ai',permit,action).code,'FULL_CONTROL_STALE');
  assert.equal(watcher.read(),after);
});

test('native output clears before first handoff and never rebuilds raw map, roster or log in a human match',async()=>{
  const game=await loads(), handoffs=[];
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  const start=source.indexOf('function draw(){');
  const stop=source.indexOf('\nfunction pointInMap',start);
  // The regular VM harness replaces draw. Use the real native draw body for this check.
  const end=stop>start?stop:source.indexOf('\nfunction ',source.indexOf('updateRoster();',start));
  assert.ok(end>start);
  const match=source.slice(start,end).match(/^function draw\(\)\{[\s\S]*?^\}/m);
  assert.ok(match);
  game.run('draw = '+match[0]);
  game.run(`{
    for(const selector of ['#battlefield-map','#unit-roster','#combat-log','#unit-intel-facts'])
      $(selector).innerHTML='old private world';
    GoblinLegacyPresentation.sync();
  }`);
  const empty=()=>game.run(`['#battlefield-map','#unit-roster','#combat-log','#unit-intel-facts']
    .every(selector=>$(selector).innerHTML==='')`);
  assert.ok(game.run('GoblinPresentation.read()'));
  const port=load(game,roles('human','human'),{handoff:(descriptor,accept)=>{
    assert.equal(game.run('GoblinCatalogFullRuntime.ownsPresentation()'),true);
    assert.equal(empty(),true);
    assert.equal(game.run('GoblinPresentation.read()'),null);
    handoffs.push({descriptor,accept});
  }});
  assert.equal(port.spectator(),null);
  assert.equal(port.project('spectator'),null);
  assert.equal(port.project('human'),null);
  function requestNativeOutput(){
    game.run("draw();updateRoster();addLog('private');showUnitInfo(units[0]);GoblinLegacyPresentation.sync()");
    assert.equal(empty(),true);
    assert.equal(game.run('GoblinPresentation.read()'),null);
  }
  requestNativeOutput();
  assert.equal(handoffs[0].accept(),true);
  assert.equal(port.project('human').view.side,'player');
  requestNativeOutput();
  for(let n=0;n<3;n++)assert.equal(port.commit('human',port.open('human').permit,endPhase).ok,true);
  assert.equal(handoffs[1].descriptor.side,'enemy');
  assert.equal(port.project('human'),null);
  requestNativeOutput();
  assert.equal(handoffs[1].accept(),true);
  assert.equal(port.project('human').view.side,'enemy');
  requestNativeOutput();
  port.leave();
  requestNativeOutput();
});
