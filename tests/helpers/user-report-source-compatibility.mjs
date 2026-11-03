// User Report 02.11.2026 (goblin-1md1): UI and presentation sources changed after the field test,
// declared against the pre-report basis c488fd0. Gameplay rules and every recorded
// trace, World, RNG and History fixture stay unchanged; this is the outermost provenance link.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
const paths=['game.js','index.html','localization.js','ui-v2-flow.js','ui-v2.css','ui-v2.js','tests/helpers/full-ground-source-compatibility.mjs'];
const added=['tests/user-report-provenance.test.mjs'];
const m=JSON.parse(fs.readFileSync(new URL('../fixtures/user-report-source-compatibility.v1.json',import.meta.url))),prior=JSON.parse(fs.readFileSync(new URL('../fixtures/full-ground-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
function verify(reference){
 assert.equal(m.version,'user-report-source-compatibility-v1');assert.equal(m.baseCommit,'c488fd0e6a546831b157e137d978dd9f8f6fb2b4');assert.equal(m.report,'goblin-1md1');assert.equal(m.sourceProvenanceOnly,true);
 assert.deepEqual(m.references,prior.references);assert.ok(m.references.includes(reference),'foreign user-report reference');
 assert.deepEqual(Object.keys(m.sourcePairs).sort(),[...paths].sort());assert.deepEqual(Object.keys(m.addedSources).sort(),[...added].sort());
 assert.equal(hash(source('tests/fixtures/full-ground-source-compatibility.v1.json')),m.priorManifestSha256,'accepted ground provenance changed');
 assert.equal(hash(source('tests/helpers/user-report-source-compatibility.mjs')),m.providerSha256,'user-report provider drift');
 for(const[path,pair]of Object.entries(m.sourcePairs))assert.equal(hash(source(path)),pair.to,'undeclared user-report source: '+path);
 for(const[path,expected]of Object.entries(m.addedSources))assert.equal(hash(source(path)),expected,'undeclared user-report checker: '+path);
 assert.deepEqual(m.immutableFixtures,prior.immutableFixtures);
 for(const[path,expected]of Object.entries(m.immutableFixtures))assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+path,import.meta.url))),expected,'original fixture changed: '+path);
}
export function reportBasisHash(path,current,reference){verify(reference);const pair=m.sourcePairs[path];if(!pair)return current;assert.equal(current,pair.to,'wrong user-report fingerprint: '+path);return pair.from}
export function reportBasisSources(current,reference){verify(reference);const out={...current};for(const[path,pair]of Object.entries(m.sourcePairs))if(Object.hasOwn(out,path)){assert.equal(out[path],pair.to,'wrong user-report header: '+path);out[path]=pair.from}return out}
