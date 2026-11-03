import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createHash}from 'node:crypto';
import{reportBasisHash,reportBasisSources}from './helpers/user-report-source-compatibility.mjs';
const fixture=p=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+p,import.meta.url)));
const m=fixture('user-report-source-compatibility.v1.json'),ground=fixture('full-ground-source-compatibility.v1.json');
const hash=p=>createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex');
test('user-report link maps exactly the declared UI sources back to the pre-report basis',()=>{
 const current=Object.fromEntries(Object.keys(m.sourcePairs).map(p=>[p,hash(p)]));
 assert.deepEqual(reportBasisSources(current,'training-t01'),Object.fromEntries(Object.entries(m.sourcePairs).map(([p,v])=>[p,v.from])));
 assert.equal(reportBasisHash('catalog-full-runtime.js','unchanged','training-t01'),'unchanged','undeclared sources pass through');
 assert.throws(()=>reportBasisSources(current,'foreign'));
 for(const p of Object.keys(current))assert.throws(()=>reportBasisHash(p,'forged','training-t01'));
});
test('user-report link sits directly on the accepted ground link and names the report changes',()=>{
 assert.equal(m.priorManifestSha256,hash('tests/fixtures/full-ground-source-compatibility.v1.json'));
 assert.deepEqual(m.references,ground.references);assert.deepEqual(m.immutableFixtures,ground.immutableFixtures);
 const declared=new Set(Object.values(m.changes).flatMap(change=>change.sources));
 for(const p of Object.keys(m.sourcePairs))assert.ok(declared.has(p),'source without report issue: '+p);
 for(const p of declared)assert.ok(Object.hasOwn(m.sourcePairs,p),'report issue names undeclared source: '+p);
});
