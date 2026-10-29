// Explicit source-only chain for the reviewed 2dee22c display patch. Frozen gameplay fixtures stay untouched.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash}from 'node:crypto';import {isDeepStrictEqual}from 'node:util';
const paths=['ui-v2.js','catalog-specialists-ui.js','index.html','tests/artillery-product-trace.mjs','tests/catalog-product-trace.mjs','tests/catalog-specialists-trace.mjs','tests/catalog-specialists-boundary-trace.mjs','tests/helpers/catalog-display-source-compatibility.mjs'];
const manifest=JSON.parse(fs.readFileSync(new URL('../fixtures/catalog-specialists-display-source-compatibility.v1.json',import.meta.url),'utf8'));
export function displayBasisSources(current,traceDigest){
 assert.equal(manifest.version,'catalog-display-source-compatibility-v1');assert.equal(manifest.baseCommit,'2dee22c76533c9a37dc8a0b175bebed357644fa8');assert.equal(manifest.scopeOnlyDisplay,true);assert.ok(manifest.originalTraceDigests.includes(traceDigest),'unlisted frozen display-patch oracle');assert.deepEqual(Object.keys(manifest.sourcePairs).sort(),[...paths].sort(),'display compatibility cannot authorize other sources');
 const out={...current};for(const path of paths){const pair=manifest.sourcePairs[path],actual=createHash('sha256').update(fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex');assert.equal(pair.to,actual,'undeclared display source drift: '+path);if(Object.hasOwn(current,path)){assert.equal(current[path],pair.to,'wrong current source: '+path);if(pair.from===null)delete out[path];else out[path]=pair.from}}
 return out;
}
export function compatibleDisplaySources(current,expected,traceDigest){if(isDeepStrictEqual(current,expected))return current;const basis=displayBasisSources(current,traceDigest);assert.deepEqual(basis,expected,'source change outside the declared display boundary');return basis}
