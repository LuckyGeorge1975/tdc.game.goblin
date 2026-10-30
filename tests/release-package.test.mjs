import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import{createHash}from 'node:crypto';
import{packageBasisHash,packageBasisSources}from './helpers/release-package-source-compatibility.mjs';
const file=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),hash=b=>createHash('sha256').update(b).digest('hex');
test('Build27 package binds the accepted df1 runtime and rejects foreign/index/checker fingerprints',()=>{
 const m=JSON.parse(file('tests/fixtures/release-package-source-compatibility.v1.json')),current=Object.fromEntries(Object.keys(m.sourcePairs).map(p=>[p,hash(file(p).replaceAll('\r\n','\n'))])),expected=Object.fromEntries(Object.entries(m.sourcePairs).map(([p,v])=>[p,v.from]));
 assert.equal(m.baseCommit,'df1ba35d935971f7cc28835ae7d8d32f3d65178a');assert.deepEqual(packageBasisSources(current,'training-t01'),expected);assert.throws(()=>packageBasisSources(current,'foreign'));
 for(const p of Object.keys(current))assert.throws(()=>packageBasisSources({...current,[p]:'forged'},'training-t01'));
 const incomplete={...current};delete incomplete['index.html'];assert.throws(()=>assert.deepEqual(packageBasisSources(incomplete,'training-t01'),expected));assert.throws(()=>packageBasisHash('tests/helpers/resize-observer-source-compatibility.mjs','forged','training-t01'));
});
test('release metadata, fallback, notices, dated supplement and current handoff have concrete consistent values',()=>{
 const context=vm.createContext({});vm.runInContext(file('release.js'),context);const r=context.GOBLIN_RELEASE;
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{version:'0.1.27',build:27,releasedAt:'2026-10-30',tag:'v0.1.27',status:'release-candidate'});
 const index=file('index.html');assert.match(index,/id="build-version" class="build">FIELD TEST 0\.1\.27</);assert.match(index,/release\.js\?v=27/);
 assert.match(file('docs/CONTENT-NOTICES.md'),/\*\*Document version:\*\* 20/);assert.match(file('reports/REPORTS.md'),/CONTENT-CLEARANCE-DESKTOP-0\.1\.27-2026-10-30\.md/);
 for(const p of ['README.md','CHANGELOG.md','reports/TEST_HANDOFF.md','docs/CONTENT-NOTICES.md','reports/CONTENT-CLEARANCE-DESKTOP-0.1.27-2026-10-30.md'])assert.doesNotMatch(file(p),/\[(?:RELEASEVERSION|PAKETDATUM|RUNTIME-SHA|PAKET-SHA|ZUSATZ-DATEI)\]/);
 assert.match(file('reports/TEST_HANDOFF.md'),/df1ba35d935971f7cc28835ae7d8d32f3d65178a/);assert.match(file('README.md'),/historisch, aus Build 26/);
});
test('all 54 retained wreck/metadata runtime hashes match receipt and package links stay inside shipped files',()=>{
 const r=JSON.parse(file('assets/unit-art/wrecks-source.json')),rows=[...r.wrecks,...r.metadata];assert.equal(r.wrecks.length,52);assert.equal(rows.length,54);
 for(const row of rows){const bytes=fs.readFileSync(new URL('../'+row.runtimePath,import.meta.url));assert.equal(hash(bytes),row.runtimeSha256,row.runtimePath);assert.equal(bytes.length,row.runtimeBytes)}
 assert.equal(r.sourceCommit,'2fdce6ac1be30e8b2a360250b37724586469e71c');assert.equal(r.sourceImageTotalBytes,2383835);assert.equal(r.runtimeImageTotalBytes,1444610);
 for(const p of ['README.md','reports/TEST_HANDOFF.md','reports/REPORTS.md','docs/CONTENT-NOTICES.md','reports/CONTENT-CLEARANCE-DESKTOP-0.1.27-2026-10-30.md'])for(const match of file(p).matchAll(/\]\(([^)]+)\)/g)){
  const path=match[1].split('#')[0];if(!path||/^[a-z]+:/i.test(path))continue;assert.ok(fs.existsSync(new URL(path,new URL('../'+p,import.meta.url))),p+' -> '+path);
 }
});
test('shipped index resources resolve under the Pages project prefix without a server or private repository',()=>{
 const base=new URL('https://local.invalid/tdc.game.goblin/');let count=0;
 for(const match of file('index.html').matchAll(/\b(?:src|href)="([^"]+)"/g)){
  const path=match[1];if(path.startsWith('#')||/^[a-z]+:/i.test(path))continue;
  const resolved=new URL(path,base);assert.ok(resolved.pathname.startsWith(base.pathname));assert.ok(fs.existsSync(new URL('../'+path.split('?')[0],import.meta.url)),path);count++;
 }
 assert.ok(count>40);
});
