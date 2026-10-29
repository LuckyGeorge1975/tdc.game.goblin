import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {digest,replayArtilleryProductTrace} from './artillery-product-trace.mjs';
const bundle=JSON.parse(fs.readFileSync(new URL('./fixtures/artillery-product-traces.v1.json',import.meta.url),'utf8'));
test('frozen real product victory/defeat JSON replays every command, complete state, RNG, facing/wreck sidecar and event delta',async()=>{
  for(const trace of Object.values(bundle.traces))await replayArtilleryProductTrace(trace);
  const win=bundle.traces.victory.steps.at(-1),loss=bundle.traces.defeat.steps.at(-1);
  assert.equal(win.state.gameOver,true);assert.equal(win.state.units.find(unit=>unit.core).hp,0);
  assert.ok(win.state.units.some(unit=>unit.team==='player'&&unit.hp>0));assert.equal(win.rng.draws,4);
  assert.equal(loss.state.gameOver,true);assert.equal(loss.state.units.some(unit=>unit.team==='player'&&unit.hp>0),false);
});
test('product queries/rejections/selection consume zero RNG, Undo preserves cached roll, actual mode/spotter lives in fire events',()=>{
  const trace=bundle.traces.victory;let prior=trace.initial;
  for(const step of trace.steps){
    if(step.command.kind==='Query'||step.query?.ok===false){assert.deepEqual(step.rng,prior.rng);assert.deepEqual(step.state,prior.state);assert.deepEqual(step.presentation,prior.presentation);}
    if(step.command.kind==='Select')assert.deepEqual(step.rng,prior.rng);
    if(step.command.kind==='Undo'){assert.deepEqual(step.rng,prior.rng);assert.equal(step.state.phaseRollCursor,0);assert.equal(step.state.phaseRolls.length,1);assert.equal(step.state.units[0].artilleryFire.fired,false);}
    prior=step;
  }
  const fires=trace.steps.flatMap(step=>step.events.addedOrChanged).filter(entry=>entry.event.kind==='fire').map(entry=>entry.event);
  assert.ok(fires.some(event=>event.weapon.mode==='direct'&&event.weapon.spotterId===null));
  assert.ok(fires.some(event=>event.weapon.mode==='indirect'&&event.weapon.spotterId==='recon-tank'));
  assert.ok(trace.steps.some(step=>step.query?.code==='DIRECT_LOS_REQUIRED'));
  assert.ok(trace.steps.some(step=>step.query?.code==='WEAPON_SPENT'));
});
test('foreign profile/source, modified seed/roster/state/events and mode/spotter/order reject instead of replaying a different product',async()=>{
  for(const mutation of [
    trace=>{trace.header.ruleProfileId='CORE_ARTILLERY_SPOTTER_PROBE_v1'},
    trace=>{trace.header.sources['game.js']='fake'},
    trace=>{trace.header.seed++},trace=>{trace.initial.state.units[0].hp=9},
    trace=>{trace.header.productSession.effectiveRules.units[0].hp=1},
    trace=>{trace.commands[8].command.mode='indirect'},
    trace=>{trace.commands[13].command.spotterId='missing'},
    trace=>{trace.commands.reverse()},
    trace=>{trace.steps[8].state.units[0].artilleryFire.fired=false},
    trace=>{trace.steps[8].events.digest='fake'}
  ]){
    const trace=structuredClone(bundle.traces.victory);mutation(trace);
    const {traceDigest,...value}=trace;trace.traceDigest=digest(value);
    await assert.rejects(()=>replayArtilleryProductTrace(trace));
  }
});
