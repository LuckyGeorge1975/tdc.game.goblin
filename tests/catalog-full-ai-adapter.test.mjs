import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeSession,closeAtlas,request} from './helpers/full-native-test-session.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
import {createFullRoundSource} from '../full-round-source.mjs';

test('FULL spectator host commits through the same native port on both seats',async()=>{
  const f=await nativeSession(),receipts=[];closeAtlas(f.game);
  const choose=batch=>batch.candidates.find(c=>c.kind==='end-phase').key;
  const session=createOwnedFullCatalogSessionHost({port:f.port,player:f.host,
    select:{player:choose,enemy:choose},onCommit:(receipt,before)=>receipts.push([receipt.action.type,before.side])});
  for(let step=0;step<6;step++)assert.equal((await session.advance()).ok,true);
  assert.deepEqual(receipts,[...Array.from({length:3},()=>['EndPhase','player']),...Array.from({length:3},()=>['EndPhase','enemy'])]);
  assert.equal(f.game.run('turn'),2);session.leave();
  assert.equal((await session.advance()).ok,false);
});

test('projection hides an undisclosed Phantom and revisions revoke native decisions',async()=>{
  const f=await nativeSession();
  f.game.run(`{const phantom=units.find(u=>u.catalogId==='U21');phantom.x=11;phantom.y=7;GoblinCatalogFullRuntime.refresh()}`);
  const before=f.facts(),batch=f.adapter.open('player');
  assert.equal(batch.ok,true);
  assert.equal(JSON.stringify(batch).includes(f.game.run("units.find(u=>u.catalogId==='U21').id")),false);
  assert.equal(f.adapter.open('enemy').ok,false);assert.deepEqual(f.facts(),before);
  const next=f.adapter.open('player'),move=next.candidates.find(c=>c.kind==='move');
  f.game.run('GoblinCatalogFullRuntime.refresh()');
  assert.equal(f.adapter.execute(request(next,move)).code,'AI_STALE_DECISION');
  const fresh=f.adapter.open('player'),choice=fresh.candidates.find(c=>c.kind==='move');
  assert.equal(f.adapter.execute(request(fresh,choice)).ok,true);
  assert.equal(f.adapter.execute(request(fresh,choice)).code,'AI_STALE_DECISION');
});

test('Atlas selects alternative component fire in its common fire phase with private round evidence',async()=>{
  const f=await nativeSession();closeAtlas(f.game);
  const source=createFullRoundSource(()=>f.game.run('({session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver})'));
  f.game.context.GoblinFullRoundSource=source;source.start();
  for(let i=0;i<4;i++)f.endPhase();
  const batch=f.adapter.open('enemy');assert.equal(batch.slot,'fire');
  const alternative=batch.candidates.find(c=>c.actorId==='catalog-full-atlas-20'&&c.target?.componentId==='treads');
  assert.ok(alternative);assert.equal(alternative.facts.effectKind,'tread-roll-5-6');
  assert.equal(alternative.facts.ratioCategory,null);
  assert.equal(batch.view.units.find(u=>u.id===alternative.actorId).relation,'own');
  assert.ok(batch.candidates.filter(c=>c.actorId===alternative.actorId&&c.weaponRef===alternative.weaponRef).length>1);
  const cmd=request(batch,alternative);
  assert.equal(f.adapter.execute(cmd,{...cmd,explanationKey:'v2.round.standardAction',options:[
    {candidate:alternative,selected:true,baseline:false,scores:{model:1}}]}).ok,true);
  assert.equal(f.adapter.execute(cmd).code,'AI_STALE_DECISION');
  const replay=f.port.simulationSnapshot(f.port.ticket('ai')).replay;
  assert.equal(replay.entries.at(-1).draws,1);
  assert.equal(f.game.run('units.find(u=>u.id==="catalog-full-atlas-20").specialistJournal.at(-1).command.target.componentId'),'treads');
  assert.ok(!(source.view().latestComplete?.rows??[]).some(row=>row.options));
  f.game.run('finish(false)');
  assert.ok(source.view().trace.flatMap(round=>round.rows).some(row=>row.options?.some(option=>option.selected&&option.component==='treads')));
});

test('all own native candidates remain in a batch and a replaced session cannot execute them',async()=>{
  const f=await nativeSession();closeAtlas(f.game);for(let i=0;i<4;i++)f.endPhase();
  const batch=f.adapter.open('enemy'),options=f.host.playerOptions(true);
  assert.equal(batch.candidates.filter(c=>c.kind!=='end-phase').length,options.length);
  assert.ok(batch.candidates.some(c=>c.actorId==='catalog-full-atlas-20'));
  f.game.run('loadScenario(currentScenario,controls)');const before=f.facts();
  assert.equal(f.adapter.execute(request(batch,batch.candidates[0])).code,'AI_STALE_DECISION');
  assert.deepEqual(f.facts(),before);
});

test('ending movement retains legal fire choices and ends with a separate GEV phase',async()=>{
  const f=await nativeSession();closeAtlas(f.game);for(let i=0;i<3;i++)f.endPhase();
  assert.equal(f.adapter.open('enemy').slot,'movement');f.endPhase();
  const batch=f.adapter.open('enemy');assert.equal(batch.slot,'fire');
  assert.ok(batch.candidates.some(c=>c.actorId==='catalog-full-atlas-20'&&c.kind==='fire'));
  f.endPhase();assert.equal(f.adapter.open('enemy').slot,'gev');f.endPhase();
  assert.equal(f.port.state().side,'player');assert.equal(f.game.run('turn'),2);
});
