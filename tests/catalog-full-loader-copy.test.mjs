import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';
const loader=fs.readFileSync(new URL('../catalog-full-loader.js',import.meta.url),'utf8');
test('Classic loader remains absent; explicit internal candidate entry validates five missions',async()=>{
 for(const search of ['?ui=classic','?catalogCandidate=1&ui=classic']){
  let calls=0;const c=vm.createContext({URLSearchParams,location:{search},fetch(){calls++;throw Error('unexpected fetch')}});await vm.runInContext(loader,c);assert.equal(calls,0);
 }
 const g=await fullScene();g.run("for(const id of Object.keys(scenarioCatalog))if(id.startsWith('catalog-full-'))delete scenarioCatalog[id]");g.context.location={search:'?catalogCandidate=1&scenario=catalog-full-terrain-course'};
 g.context.fetch=async path=>({ok:true,json:async()=>structuredClone(path.includes('levels')?g.context.levelData:g.context.data)});
 await g.run(loader);assert.equal(read(g,"Object.keys(scenarioCatalog).filter(id=>id.startsWith('catalog-full-')).length"),5);assert.equal(read(g,'legacySession.ruleProfileId'),'CATALOG_FULL_CANDIDATE_v1');assert.equal(read(g,'currentScenario'),'catalog-full-terrain-course');
});
test('four locale catalogs retain the exact approved 29-key E/F/G copy and complete new mission consumer keys',()=>{
 const languages=['de','en','es','fr'],catalogs=Object.fromEntries(languages.map(lang=>[lang,JSON.parse(fs.readFileSync(new URL(`../assets/ui-copy/briefing-01.${lang}.json`,import.meta.url),'utf8')).messages]));
 const bundle=Object.fromEntries(languages.map(lang=>[lang,Object.fromEntries(Object.entries(catalogs[lang]).filter(([k])=>k.startsWith('v2.full.')&&!['v2.full.wave.entries','v2.full.profile'].includes(k)))]));
 assert.equal(createHash('sha256').update(JSON.stringify(bundle)).digest('hex'),'bbe1ac180a31ef81822cd8662eac5c22b7729b4a61cb36c93a856080f217b9bb');
 const u2keys=['mission.catalog-full-siege.title','mission.catalog-full-siege.briefing.short','mission.catalog-full-siege.briefing.full'];
 const u2=Object.fromEntries(languages.map(lang=>[lang,Object.fromEntries(u2keys.map(key=>[key,catalogs[lang][key]]))]));assert.equal(createHash('sha256').update(JSON.stringify(u2)).digest('hex'),'537e6c49d04317e9cb7dcb3580b31ad9eeac20477d95121a66ef30123ddccc62');
 const placeholders=s=>[...s.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]).sort();
 for(const lang of languages){assert.equal(Object.keys(bundle[lang]).length,29);for(const key of Object.keys(bundle.de))assert.deepEqual(placeholders(bundle[lang][key]),placeholders(bundle.de[key]));for(const id of ['atlas','terrain-course','advance','siege','specialists'])for(const suffix of ['title','budget','objective.short','objective.full','briefing.short','briefing.full','briefing.victory','briefing.defeat','end.victory'])assert.ok(catalogs[lang][`mission.catalog-full-${id}.${suffix}`],`${lang}/${id}/${suffix}`)}
});
