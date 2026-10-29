// Exact e71 -> training source provenance. No gameplay or existing fixture is rewritten.
import {uiFixBasisHash,uiFixBasisSources} from './training-ui-fix-source-compatibility.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
const paths=['assets/ui-copy/briefing-01.de.json','assets/ui-copy/briefing-01.en.json','assets/ui-copy/briefing-01.es.json','assets/ui-copy/briefing-01.fr.json','game.js','index.html','localization.js','m1-unit-markers.js','scenario-profile-manifest.js','scenario.js','ui-v2-flow.js','ui-v2.css','ui-v2.js','tests/catalog-full-harness.mjs','tests/scenario-profile-manifest.test.mjs','tests/helpers/catalog-full-source-compatibility.mjs','tests/helpers/catalog-full-activation-source-compatibility.mjs'];
const added=['training-director.js','training-model.js','training-runtime.js','training-loader.js','assets/training/levels.v1.json','assets/training/scripts.v1.json','tests/training-product-harness.mjs'];
const manifest=JSON.parse(fs.readFileSync(new URL('../fixtures/training-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
function verify(digest){
 assert.equal(manifest.version,'training-source-compatibility-v1');assert.equal(manifest.baseCommit,'e71e1969c041806c649bb77e656b5ce50bf14e0d');assert.equal(manifest.sourceProvenanceOnly,true);
 assert.ok(manifest.originalTraceDigests.includes(digest),'foreign pre-training trace');
 assert.deepEqual(Object.keys(manifest.sourcePairs).sort(),[...paths].sort(),'training source boundary widened');assert.deepEqual(Object.keys(manifest.addedSources).sort(),[...added].sort(),'training added-source boundary widened');
 assert.equal(uiFixBasisHash('tests/helpers/training-source-compatibility.mjs',hash(source('tests/helpers/training-source-compatibility.mjs')),digest),manifest.providerSha256,'training provider drift');
 const basis=uiFixBasisSources(Object.fromEntries(paths.map(path=>[path,hash(source(path))])),digest);
 for(const [path,pair]of Object.entries(manifest.sourcePairs))assert.equal(basis[path],pair.to,'undeclared training source: '+path);
 for(const [path,expected]of Object.entries(manifest.addedSources))assert.equal(hash(source(path)),expected,'undeclared training addition: '+path);
 for(const [path,expected]of Object.entries(manifest.originalFixtureSha256))assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+path,import.meta.url))),expected,'immutable old fixture: '+path);
}
export function trainingBasisHash(path,current,digest){verify(digest);current=uiFixBasisHash(path,current,digest);const pair=manifest.sourcePairs[path];if(!pair)return current;assert.equal(current,pair.to,'incorrect training fingerprint: '+path);return pair.from}
export function trainingBasisSources(current,digest){verify(digest);const out=uiFixBasisSources(current,digest);for(const[path,pair]of Object.entries(manifest.sourcePairs))if(Object.hasOwn(out,path)){assert.equal(out[path],pair.to,'incorrect training header: '+path);out[path]=pair.from}return out}
