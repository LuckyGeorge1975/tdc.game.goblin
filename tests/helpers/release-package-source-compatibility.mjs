import {groundBasisHash,groundBasisSources} from './full-ground-source-compatibility.mjs';
// Release metadata only, based on the final independently accepted df1 runtime.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
const paths=['index.html','tests/helpers/resize-observer-source-compatibility.mjs'];
const added=['tests/release-package.test.mjs'];
const m=JSON.parse(fs.readFileSync(new URL('../fixtures/release-package-source-compatibility.v1.json',import.meta.url))),prior=JSON.parse(fs.readFileSync(new URL('../fixtures/resize-observer-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
function verify(reference){
 assert.equal(m.version,'release-package-source-compatibility-v1');assert.equal(m.baseCommit,'df1ba35d935971f7cc28835ae7d8d32f3d65178a');assert.equal(m.releaseVersion,'0.1.27');assert.equal(m.sourceProvenanceOnly,true);
 assert.deepEqual(m.references,prior.references);assert.ok(m.references.includes(reference),'foreign release-package reference');
 assert.deepEqual(Object.keys(m.sourcePairs).sort(),[...paths].sort());assert.deepEqual(Object.keys(m.addedSources).sort(),[...added].sort());
 assert.equal(hash(source('tests/fixtures/resize-observer-source-compatibility.v1.json')),m.priorManifestSha256,'accepted runtime provenance changed');
 assert.equal(groundBasisHash('tests/helpers/release-package-source-compatibility.mjs',hash(source('tests/helpers/release-package-source-compatibility.mjs')),reference),m.providerSha256,'package provider drift');
 const basis=groundBasisSources(Object.fromEntries(paths.map(path=>[path,hash(source(path))])),reference);
 for(const[path,pair]of Object.entries(m.sourcePairs))assert.equal(basis[path],pair.to,'undeclared package source: '+path);
 for(const[path,expected]of Object.entries(m.addedSources))assert.equal(hash(source(path)),expected,'undeclared package checker: '+path);
 assert.deepEqual(m.immutableFixtures,prior.immutableFixtures);
 for(const[path,expected]of Object.entries(m.immutableFixtures))assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+path,import.meta.url))),expected,'original fixture changed: '+path);
}
export function packageBasisHash(path,current,reference){verify(reference);current=groundBasisHash(path,current,reference);const pair=m.sourcePairs[path];if(!pair)return current;assert.equal(current,pair.to,'wrong package fingerprint: '+path);return pair.from}
export function packageBasisSources(current,reference){verify(reference);const out=groundBasisSources(current,reference);for(const[path,pair]of Object.entries(m.sourcePairs))if(Object.hasOwn(out,path)){assert.equal(out[path],pair.to,'wrong package header: '+path);out[path]=pair.from}return out}
