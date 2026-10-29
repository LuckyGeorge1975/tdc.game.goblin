// Exact display-source provenance only. Full-v2 gameplay fixtures remain immutable.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const paths=['assets/ui-copy/briefing-01.de.json','assets/ui-copy/briefing-01.en.json','assets/ui-copy/briefing-01.es.json','assets/ui-copy/briefing-01.fr.json','catalog-full-runtime.js','index.html','ui-v2-flow.js','ui-v2.js','unit-guide-range.js','tests/catalog-full-trace.mjs'];
const manifest=JSON.parse(fs.readFileSync(new URL('../fixtures/catalog-full-display-fix-source-compatibility.v1.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex'),source=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
export function compatibleFullDisplaySources(current,expected,traceDigest){
 assert.equal(manifest.version,'catalog-full-display-fix-source-compatibility-v1');assert.equal(manifest.baseCommit,'ea4e229293555cae790359862e0b3b5f59673228');assert.equal(manifest.displayOnly,true);assert.ok(manifest.originalTraceDigests.includes(traceDigest),'unlisted Full-v2 trace');assert.deepEqual(Object.keys(manifest.sourcePairs).sort(),[...paths].sort(),'display path boundary widened');
 assert.equal(hash(source('tests/helpers/catalog-full-display-fix-source-compatibility.mjs')),manifest.providerSha256,'undeclared compatibility provider');
 for(const [file,digest]of Object.entries(manifest.originalFixtureSha256))assert.equal(hash(fs.readFileSync(new URL('../fixtures/'+file,import.meta.url))),digest,'immutable fixture drift: '+file);
 const out={...current};for(const [p,pair]of Object.entries(manifest.sourcePairs)){assert.equal(hash(source(p)),pair.to,'undeclared display source: '+p);assert.equal(current[p],pair.to,'wrong current source: '+p);assert.equal(expected[p],pair.from,'wrong original source: '+p);out[p]=pair.from}assert.deepEqual(out,expected,'source change beyond explicit display boundary');return out;
}
