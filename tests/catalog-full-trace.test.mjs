import {assertHistoricalFullTransition} from './helpers/historical-full-transition.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {decode} from './helpers/trace-object-table.mjs';import {replay} from './catalog-full-trace.mjs';import {streamDigest} from './catalog-specialists-trace.mjs';
import {bindReplaySources} from './helpers/replay-source-binding.mjs';
const dir=new URL('./fixtures/catalog-full/',import.meta.url),index=JSON.parse(fs.readFileSync(new URL('index.v2.json',dir),'utf8'));
const load=info=>{const raw=fs.readFileSync(new URL(info.file,dir));assert.equal(createHash('sha256').update(raw).digest('hex'),info.sha256);const trace=decode(JSON.parse(gunzipSync(raw)));assert.equal(trace.traceDigest,info.traceDigest);return trace};
test('all ten FULL fixtures have the current profile, bound sources and the indexed route',()=>{
 assert.equal(index.version,'catalog-full-product-traces-v2');
 assert.equal(index.publicSaveFormat,false);
 assert.equal(index.profile,'FULL_CATALOG_v1');
 assert.equal(Object.keys(index.traces).length,10);
 for(const id of ['atlas','terrain-course','advance','siege','specialists'])for(const outcome of ['victory','defeat']){
  const info=index.traces[`catalog-full-${id}-${outcome}`];
  const trace=load(info);
  assert.equal(trace.header.profile,index.profile);
  assert.equal(trace.header.session.ruleProfileId,index.profile);
  assert.equal(trace.route.id,'catalog-full-'+id);
  assert.equal(trace.route.seed,info.seed);
  assert.equal(trace.route.intendedWin,outcome==='victory');
  assert.equal(trace.route.intendedWin,info.outcome);
  assert.equal(trace.route.commands.length,info.steps);
  assert.equal(trace.steps.length,info.steps);
  assert.equal(bindReplaySources(trace.header.sources,trace.traceDigest),trace.header.sources);
 }
});
// Only the Atlas test level (every unit, every terrain type; see test-level-coverage) is replayed; the other levels keep their fixtures.
for(const [key,info] of Object.entries(index.traces).filter(([key])=>key.startsWith('catalog-full-atlas-')))test(key+' retains its immutable complete oracle and rejects the authorised inactive-side initial-state transition',async()=>{const trace=load(info);await assertHistoricalFullTransition(trace);const end=trace.steps.at(-1);assert.equal(end.world.gameOver,true);assert.equal(end.full.terminalOutcome,info.outcome);assert.equal(end.rng.draws,info.rngDraws);assert.ok(trace.steps.filter(s=>s.command.kind==='Command').every(s=>s.result.query.ok&&s.result.result.ok))});
test('full trace rejects foreign profiles/sources/seed/owner/state/clock/order/event changes without rebinding oracle values',async()=>{
 const original=load(index.traces['catalog-full-advance-victory']);
 for(const mutate of [t=>t.header.profile='CATALOG_FULL_CANDIDATE_v1',t=>t.header.sources['catalog-full-runtime.js']='foreign',t=>t.route.seed++,t=>t.initial.full.ownTurns.player++,t=>t.initial.world.units[0].catalogSystems.unitId='foreign',t=>t.steps[0].world.units[0].x=99,t=>t.route.commands.reverse(),t=>t.steps.at(-1).events[0].actor.positionBefore.x=99]){const trace=structuredClone(original);mutate(trace);const {traceDigest,...body}=trace;trace.traceDigest=streamDigest(body);await assert.rejects(()=>replay(trace))}
});
