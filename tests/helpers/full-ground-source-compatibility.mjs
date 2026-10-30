// Render-only FULL OpenGround provenance, exact accepted Build27 package basis.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
const paths=['game.js','index.html','tests/helpers/release-package-source-compatibility.mjs'];
const added=['tests/full-ground-render.test.mjs'];
const m=JSON.parse(fs.readFileSync(new URL('../fixtures/full-ground-source-compatibility.v1.json',import.meta.url))),prior=JSON.parse(fs.readFileSync(new URL('../fixtures/release-package-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
function verify(reference){
 assert.equal(m.version,'full-ground-source-compatibility-v1');assert.equal(m.baseCommit,'594cd33a1184d0d2b0f8017371693a0200fc44c7');assert.equal(m.releaseVersion,'0.1.27');assert.equal(m.sourceProvenanceOnly,true);
 assert.deepEqual(m.references,prior.references);assert.ok(m.references.includes(reference),'foreign release-package reference');
 assert.deepEqual(Object.keys(m.sourcePairs).sort(),[...paths].sort());assert.deepEqual(Object.keys(m.addedSources).sort(),[...added].sort());
 assert.equal(hash(source('tests/fixtures/release-package-source-compatibility.v1.json')),m.priorManifestSha256,'accepted runtime provenance changed');
 assert.equal(hash(source('tests/helpers/full-ground-source-compatibility.mjs')),m.providerSha256,'package provider drift');
 for(const[path,pair]of Object.entries(m.sourcePairs))assert.equal(hash(source(path)),pair.to,'undeclared package source: '+path);
 for(const[path,expected]of Object.entries(m.addedSources))assert.equal(hash(source(path)),expected,'undeclared package checker: '+path);
 assert.deepEqual(m.immutableFixtures,prior.immutableFixtures);
 for(const[path,expected]of Object.entries(m.immutableFixtures))assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+path,import.meta.url))),expected,'original fixture changed: '+path);
}
export function groundBasisHash(path,current,reference){verify(reference);const pair=m.sourcePairs[path];if(!pair)return current;assert.equal(current,pair.to,'wrong package fingerprint: '+path);return pair.from}
export function groundBasisSources(current,reference){verify(reference);const out={...current};for(const[path,pair]of Object.entries(m.sourcePairs))if(Object.hasOwn(out,path)){assert.equal(out[path],pair.to,'wrong package header: '+path);out[path]=pair.from}return out}
