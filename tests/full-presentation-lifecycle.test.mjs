import assert from 'node:assert/strict';
import test from 'node:test';
import movement from '../movement-presentation.js';
import {withFullPresentationBarrier} from '../full-standard-seat-owner.mjs';
import {createFullPhaseLifecycle} from '../src/core/full-phase-lifecycle.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
import {createOwnedFullCatalogSessionHost} from '../src/core/full-catalog-session-host.mjs';
import {fullScene} from './catalog-full-harness.mjs';
import {productionOwner} from './helpers/full-production-owner.mjs';
import {readFileSync} from 'node:fs';

const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function visual(mode='high'){
  let time=0;const frames=new Set();
  const q=movement.createQueue({now:()=>time,request:fn=>{frames.add(fn);return fn;},cancel:fn=>frames.delete(fn),render(){},finish(){}});
  const before={units:[{id:'a',x:2,y:2,hp:3}]},after={units:[{id:'a',x:3,y:2,hp:3}]};
  const enqueue=()=>q.enqueue({after,sidecar:{},beforeSidecar:{facingByUnit:[]},event:{eventId:'accepted-move',kind:'move',
    actor:{unitId:'a',team:'enemy',visualKey:'guard-tank',positionBefore:{x:2,y:2}},
    path:[{x:3,y:2}],before,after,action:{animationPreference:{mode}}}});
  return {q,frames,enqueue,finish(){q.skip();time+=220;const current=[...frames];frames.clear();current.forEach(fn=>fn());}};
}
function fixture(advance){
  let state={sessionId:1,side:'enemy',controller:'ai',paused:false,ended:false},calls=0;
  const v=visual(),port={state:()=>state};
  const host=withFullPresentationBarrier(port,{advance(){calls++;return advance?.(v)??{ok:true};},
    pause(){state={...state,paused:true};},resume(){state={...state,paused:false};},leave(){state=null;}},()=>v.q);
  return {host,v,port,calls:()=>calls,state:next=>{state=next;}};
}

test('the AI lifecycle waits for actual queued presentation completion before its next command',async()=>{
  const f=fixture(v=>{if(f.calls()===1)v.enqueue();else f.state({sessionId:1,side:'player',controller:'human'});return {ok:true};});
  const scheduled=new Set(),life=createFullPhaseLifecycle({port:f.port,host:f.host,
    schedule:fn=>{scheduled.add(fn);return fn;},cancel:fn=>scheduled.delete(fn)});
  life.sync();const next=scheduled.values().next().value;scheduled.delete(next);
  const running=next();await flush();
  assert.equal(f.calls(),1);assert.equal(f.v.q.busy(),true);assert.equal(scheduled.size,0);
  f.v.finish();await running;assert.equal(scheduled.size,1);
  const last=scheduled.values().next().value;scheduled.delete(last);await last();
  assert.equal(f.calls(),2);assert.equal(scheduled.size,0);life.leave();
});

test('presentation admission rechecks the active seat and does no strategy work in a human turn',async()=>{
  const f=fixture();f.v.enqueue();const pending=f.host.advance();await flush();assert.equal(f.calls(),0);
  f.state({sessionId:1,side:'player',controller:'human'});f.v.finish();
  assert.equal((await pending).code,'AI_HOST_STALE');assert.equal(f.calls(),0);
  f.v.enqueue();assert.equal((await f.host.advance()).code,'AI_HOST_WRONG_SIDE');assert.equal(f.calls(),0);f.host.leave();
});

test('pause/resume cancels old waiting work and a fresh advance commits only once',async()=>{
  const f=fixture();f.v.enqueue();const pending=f.host.advance();await flush();
  assert.equal((await f.host.advance()).code,'AI_HOST_UNAVAILABLE');
  f.host.pause();f.host.resume();assert.equal((await pending).code,'AI_HOST_STALE');assert.equal(f.calls(),0);
  const fresh=f.host.advance();await flush();assert.equal(f.calls(),0);
  f.v.finish();assert.equal((await fresh).ok,true);assert.equal(f.calls(),1);f.host.leave();
});

test('leave and session replacement during presentation prevent late commits and stale frame work',async()=>{
  for(const replace of [false,true]){
    const f=fixture();f.v.enqueue();const staleFrames=[...f.v.frames],pending=f.host.advance();await flush();
    if(replace)f.state({sessionId:2,side:'enemy',controller:'ai'});else f.host.leave();
    f.v.q.clear();staleFrames.forEach(fn=>fn());
    assert.equal((await pending).code,'AI_HOST_STALE');assert.equal(f.calls(),0);f.host.leave();
  }
});

test('cancelling presentation after an accepted command keeps its single receipt without a late second commit',async()=>{
  const f=fixture(v=>{v.enqueue();return {ok:true};});const pending=f.host.advance();await flush();
  assert.equal(f.calls(),1);f.host.pause();assert.equal((await pending).ok,true);
  f.host.resume();f.v.q.clear();await flush();assert.equal(f.calls(),1);f.host.leave();
});

test('a busy race resumes the same native intent with one selector call, one commit and unchanged RNG',async()=>{
  const game=await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  game.context.controls={roles:{player:'ai',enemy:'ai'},seed:7};
  const port=game.run('loadScenario("catalog-full-atlas",controls)'),full=game.context.GoblinCatalogFullRuntime,v=visual();
  game.context.GoblinMovement=v.q;
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  let choices=0,commits=0;
  const native=createOwnedFullCatalogSessionHost({port,player,select:{player:batch=>{
    choices++;v.enqueue();return batch.candidates.find(c=>c.kind==='move').key;
  }},onCommit(){commits++;}});
  const host=withFullPresentationBarrier(port,native,()=>v.q),rng=game.rng();
  const running=host.advance();await flush();assert.equal(choices,1);assert.equal(commits,0);
  v.finish();assert.equal((await running).ok,true);assert.equal(choices,1);assert.equal(commits,1);
  assert.equal(port.simulationSnapshot(port.ticket('ai')).replay.entries.length,1);assert.deepEqual(game.rng(),rng);host.leave();
});

test('presentation gating does not retry a genuine native command rejection',async()=>{
  const f=fixture(()=>({ok:false,code:'FULL_CONTROL_ACTOR'}));
  assert.equal((await f.host.advance()).code,'FULL_CONTROL_ACTOR');assert.equal(f.calls(),1);f.host.leave();
});

test('native Human busy admission still rejects early input without mutating state or RNG',async()=>{
  const game=await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  game.context.controls={roles:{player:'human',enemy:'ai'},seed:7,ui:{handoff(_side,take){take();}}};
  const port=game.run('loadScenario("catalog-full-atlas",controls)'),full=game.context.GoblinCatalogFullRuntime;
  const player=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  const command=player.humanPlayerOptions(port).find(item=>item.command.type==='Move').command;
  const before=full.commandRevision(),rng=game.rng();game.context.GoblinMovement={busy:()=>true};
  assert.equal(port.commit('human',port.open('human').permit,command,player.dispatch).code,'PRESENTATION_BUSY');
  assert.equal(full.commandRevision(),before);assert.deepEqual(game.rng(),rng);port.leave();
});

test('the actual production Weak owner has identical native commands, state and seeded dice with HIGH and OFF presentation scheduling',async()=>{
  async function run(mode){
    const game=await fullScene(),v=visual(mode),original=game.context.GoblinCatalogFullRuntime;
    for(const file of ['level-events.js','editor-draft.js'])game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
    const full={...original,nativePlayerGateway:{query:original.nativePlayerGateway.query,dispatch(command,revision){
      const result=original.nativePlayerGateway.dispatch(command,revision);
      if(result.ok)v.enqueue(); // Synthetic presentation of a genuinely accepted command.
      return result;
    }}};
    game.context.GoblinCatalogFullRuntime=full;game.context.GoblinMovement=v.q;
    const owner=await productionOwner(game),oldMovement=globalThis.GoblinMovement;
    globalThis.GoblinMovement=v.q;
    let host;
    try{
      const config=await game.context.GoblinEditorDraft.prepare({version:'goblin-level-v3',width:6,height:5,
        objective:'core-and-escort',terrain:[],units:[{id:'p',assetId:'assault-tank',team:'player',x:1,y:2},
          {id:'e',assetId:'guard-tank',team:'enemy',x:2,y:2},{id:'core',assetId:'command-core',team:'enemy',x:5,y:4}],
        goals:[{type:'enemy-turn-limit',turns:1}]});
      const selection={player:null,enemy:'enemy-weak'};
      game.context.prepared=config;game.context.controls={...owner.nativeSetup(config,selection),seed:7,
        mapPresentation:true,ui:{handoff(_seat,take){take();}}};
      const port=game.run('loadEditorDraft(prepared,controls)');
      host=owner.bind(game.run('legacySession'),selection,{refresh(){}},port);
      for(let i=0;i<3;i++)assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'},owner.dispatchPlayer).ok,true);
      for(let i=0;i<30&&!port.state().ended;i++){
        let settled=false;const advancing=host.advance().then(result=>{settled=true;return result;});
        await flush();
        if(v.q.busy()){assert.equal(settled,false);v.finish();}
        assert.equal((await advancing).ok,true);assert.equal(owner.failure(port),null);
      }
      assert.equal(port.state().ended,true);
      const archive=JSON.parse(JSON.stringify(port.trainingArchive()));
      assert.ok(archive.replay.entries.some(entry=>entry.command.type==='CatalogFire'));
      assert.ok(archive.replay.entries.reduce((sum,entry)=>sum+entry.draws,0)>0);
      return {archive,rng:game.rng(),world:game.run('JSON.stringify({units,phase,turnPhase,turn,gameOver})')};
    }finally{host?.leave();if(oldMovement===undefined)delete globalThis.GoblinMovement;else globalThis.GoblinMovement=oldMovement;}
  }
  assert.deepEqual(await run('high'),await run('off'));
});
