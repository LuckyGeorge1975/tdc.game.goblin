// Notify scheduling/style-idempotence provenance only; all gameplay oracles remain exact.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
const paths=['ui-v2.js','view-display-controls.js','index.html','tests/helpers/training-ui-fix-source-compatibility.mjs','tests/view-display-controls.test.mjs'];
const added=['tests/resize-observer-geometry.test.mjs'];
const manifest=JSON.parse(fs.readFileSync(new URL('../fixtures/resize-observer-source-compatibility.v1.json',import.meta.url)));
const prior=JSON.parse(fs.readFileSync(new URL('../fixtures/training-ui-fix-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
function verify(reference){
 assert.equal(manifest.version,'resize-observer-source-compatibility-v1');assert.equal(manifest.baseCommit,'039356787ddbba318fc1d63479ed0fd17cad45c7');assert.equal(manifest.sourceProvenanceOnly,true);
 assert.deepEqual(manifest.references,prior.references);assert.ok(manifest.references.includes(reference),'foreign resize-source reference');
 assert.deepEqual(Object.keys(manifest.sourcePairs).sort(),[...paths].sort());assert.deepEqual(Object.keys(manifest.addedSources).sort(),[...added].sort());
 assert.equal(hash(source('tests/fixtures/training-ui-fix-source-compatibility.v1.json')),manifest.priorManifestSha256,'prior UI-fix provenance changed');
 assert.equal(hash(source('tests/helpers/resize-observer-source-compatibility.mjs')),manifest.providerSha256,'resize provider drift');
 for(const[path,pair]of Object.entries(manifest.sourcePairs))assert.equal(hash(source(path)),pair.to,'undeclared resize source: '+path);
 for(const[path,expected]of Object.entries(manifest.addedSources))assert.equal(hash(source(path)),expected,'undeclared resize checker: '+path);
 assert.deepEqual(manifest.immutableFixtures,prior.immutableFixtures);
 for(const[path,expected]of Object.entries(manifest.immutableFixtures))assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+path,import.meta.url))),expected,'immutable resize fixture: '+path);
}
export function resizeBasisHash(path,current,reference){verify(reference);const pair=manifest.sourcePairs[path];if(!pair)return current;assert.equal(current,pair.to,'wrong resize fingerprint: '+path);return pair.from}
export function resizeBasisSources(current,reference){verify(reference);const out={...current};for(const[path,pair]of Object.entries(manifest.sourcePairs))if(Object.hasOwn(out,path)){assert.equal(out[path],pair.to,'wrong resize source header: '+path);out[path]=pair.from}return out}
