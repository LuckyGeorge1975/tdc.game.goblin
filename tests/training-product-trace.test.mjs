import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';
import{trainingScene,apply,snapshot,sourceHashes}from './training-product-harness.mjs';
import{compatibleUiFixSources}from './helpers/training-ui-fix-source-compatibility.mjs';
for(const id of ['training-t01','training-t02','training-t03'])test(id+' complete actual Game and Teaching replay',async()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+id+'.game-teaching.v1.json.gz',import.meta.url))));
 compatibleUiFixSources(sourceHashes(),fixture.header.sourceHashes,id);
 const g=await trainingScene(id);assert.deepEqual(snapshot(g),fixture.states[0]);
 for(const [i,action]of fixture.actions.entries()){apply(g,action);assert.deepEqual(snapshot(g),fixture.states[i+1],JSON.stringify({id,step:i+1,action}))}
 assert.equal(snapshot(g).director.progress.status,'lesson-complete');assert.ok(snapshot(g).audit.every(entry=>entry.error===null));
});
