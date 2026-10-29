// UI-only source bridge to the fixed original training candidate. No trace values change.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
const paths=['ui-v2.css','index.html','game.js','tests/helpers/training-source-compatibility.mjs','tests/training-product-trace.test.mjs'];
const added=['tests/training-ui-fix-source-compatibility.test.mjs'];
const manifest=JSON.parse(fs.readFileSync(new URL('../fixtures/training-ui-fix-source-compatibility.v1.json',import.meta.url)));
const prior=JSON.parse(fs.readFileSync(new URL('../fixtures/training-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
function verify(reference){
 assert.equal(manifest.version,'training-ui-fix-source-compatibility-v1');assert.equal(manifest.baseCommit,'2dcd4bac91d7912bc59f913566994fd296a2fe56');assert.equal(manifest.sourceProvenanceOnly,true);
 assert.deepEqual(manifest.references,[...prior.originalTraceDigests,'training-t01','training-t02','training-t03']);assert.ok(manifest.references.includes(reference),'foreign UI-fix trace');
 assert.deepEqual(Object.keys(manifest.sourcePairs).sort(),[...paths].sort(),'UI-fix scope widened');assert.deepEqual(Object.keys(manifest.addedSources).sort(),[...added].sort(),'UI-fix checker scope widened');
 assert.equal(hash(source('tests/fixtures/training-source-compatibility.v1.json')),manifest.priorManifestSha256,'original training provenance changed');
 assert.equal(hash(source('tests/helpers/training-ui-fix-source-compatibility.mjs')),manifest.providerSha256,'UI-fix provider drift');
 for(const[path,pair]of Object.entries(manifest.sourcePairs))assert.equal(hash(source(path)),pair.to,'undeclared UI-fix source: '+path);
 for(const[path,expected]of Object.entries(manifest.addedSources))assert.equal(hash(source(path)),expected,'undeclared UI-fix checker: '+path);
 const expectedPaths=[...Object.keys(prior.originalFixtureSha256),'training-t01.game-teaching.v1.json.gz','training-t02.game-teaching.v1.json.gz','training-t03.game-teaching.v1.json.gz'];
 assert.deepEqual(Object.keys(manifest.immutableFixtures).sort(),expectedPaths.sort());
 for(const[path,expected]of Object.entries(manifest.immutableFixtures)){if(Object.hasOwn(prior.originalFixtureSha256,path))assert.equal(expected,prior.originalFixtureSha256[path]);assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+path,import.meta.url))),expected,'immutable UI-fix fixture: '+path)}
}
export function uiFixBasisHash(path,current,reference){verify(reference);const pair=manifest.sourcePairs[path];if(!pair)return current;assert.equal(current,pair.to,'incorrect UI-fix fingerprint: '+path);return pair.from}
export function uiFixBasisSources(current,reference){verify(reference);const out={...current};for(const[path,pair]of Object.entries(manifest.sourcePairs))if(Object.hasOwn(out,path)){assert.equal(out[path],pair.to,'incorrect UI-fix header: '+path);out[path]=pair.from}return out}
export function compatibleUiFixSources(current,expected,reference){const basis=uiFixBasisSources(current,reference);assert.deepEqual(basis,expected,'source drift outside exact UI-fix boundary');return basis}
