import test from 'node:test';import fs from 'node:fs';import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {digest,replay} from './catalog-product-trace.mjs';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/catalog-base-product-traces.v1.json.gz',import.meta.url))).toString('utf8'));
const compatibility=JSON.parse(fs.readFileSync(new URL('./fixtures/catalog-base-source-compatibility.catalog-specialists.v1.json',import.meta.url),'utf8'));
test('both fixed catalogue missions replay normal victory and defeat with complete state, history, RNG, events and sidecar',async()=>{
 for(const [key,trace] of Object.entries(bundle.traces)){
  await replay(trace,compatibility);const last=trace.steps.at(-1);assert.equal(last.state.gameOver,true);
  assert.equal(last.state.units.find(u=>u.core).hp===0&&last.state.units.some(u=>u.team==='player'&&u.hp>0),key.endsWith('victory'));
 }
});
test('new product trace rejects foreign profile, source, data/roster/terrain digests, RNG, command order and event/state edits',async()=>{
 for(const change of [t=>t.header.ruleProfileId='CATALOG_ARTILLERY_PILOT_v1',t=>t.header.sources['game.js']='bad',t=>t.header.seed++,t=>t.header.session.effectiveRules.catalog.dataDigest='bad',t=>t.header.session.effectiveRules.catalog.rosterDigest='bad',t=>t.initial.state.terrainTypes.push(['0,0','water']),t=>t.steps[0].state.units[0].hp=99,t=>t.commands.reverse(),t=>t.steps[0].presentation='bad']){
  const t=structuredClone(bundle.traces['catalog-transport-victory']);change(t);const {traceDigest,...body}=t;t.traceDigest=digest(body);await assert.rejects(()=>replay(t,compatibility));
 }
});
test('real deploy Undo/reissue restores cargo identity and consumes no randomness',()=>{
 const t=bundle.traces['catalog-transport-victory'];const [deploy,undo,reissue]=t.steps;
 assert.equal(deploy.state.units.find(u=>u.id==='drone').embarkedOn,null);assert.equal(undo.state.units.find(u=>u.id==='drone').embarkedOn,'carrier-drone');
 assert.deepEqual(deploy.state.units,reissue.state.units);assert.deepEqual(deploy.rng,reissue.rng);assert.equal(deploy.rng.draws,0);
});

test('source compatibility explicitly rejects absent, incomplete and changed destination manifests',async()=>{const t=bundle.traces['catalog-transport-victory'];await assert.rejects(()=>replay(t));const bad=structuredClone(compatibility);bad.sourcePairs['game.js'].to='bad';await assert.rejects(()=>replay(t,bad));delete bad.sourcePairs['game.js'];await assert.rejects(()=>replay(t,bad))});
