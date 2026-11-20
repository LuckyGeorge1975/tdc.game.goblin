import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {bindingManifest,gameplaySourceHashes as nodeHashes,readSource} from './helpers/replay-source-binding.mjs';
import {prepareBrowserTrainingSources,canonicalSources,normalizeSource} from '../full-training-source-binding.mjs';

const root=new URL('../',import.meta.url);
const generated=()=>JSON.parse(fs.readFileSync(new URL('assets/training/full-native-sources.json',root)));
const sri=text=>'sha256-'+createHash('sha256').update(text).digest('base64');
function browser({lineEnding='raw',change=()=>{},expected=generated()}={}) {
  const scripts=[...readSource('index.html').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match=>({
    src:new URL(match[1],root).href,integrity:match[0].match(/integrity="([^"]+)"/)?.[1]??''
  }));
  const requests=[];
  return {scripts,requests,document:{baseURI:root.href,querySelectorAll:()=>scripts},async fetch(url){
    const path=new URL(url,root).pathname.slice(root.pathname.length);
    requests.push(path);
    if(path==='assets/training/full-native-sources.json')return {ok:true,json:async()=>expected};
    let text=fs.readFileSync(new URL(path,root),'utf8');
    if(lineEnding!=='raw')text=normalizeSource(text).replaceAll('\n',lineEnding==='crlf'?'\r\n':'\n');
    const resource={text};change(path,resource,scripts);
    return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(resource.text).buffer};
  }};
}

test('native browser hashes equal the current classified sources and SRI covers LF archives and CRLF checkouts',async()=>{
  assert.deepEqual(generated(),nodeHashes());
  assert.deepEqual(Object.keys(generated()).sort(),Object.keys(bindingManifest().gameplaySources).sort());
  for(const lineEnding of ['raw','lf','crlf']){
    const host=browser({lineEnding});
    const {sources}=await prepareBrowserTrainingSources(host);
    assert.equal(Object.isFrozen(sources),true);
    assert.equal(canonicalSources(sources),canonicalSources(nodeHashes()));
    for(const ignored of Object.keys(bindingManifest().ignoredPaths))assert.equal(host.requests.includes(ignored),false);
  }
});

test('a modified directly loaded native engine script fails its original SRI',async()=>{
  await assert.rejects(()=>prepareBrowserTrainingSources(browser({change(path,resource){
    if(path==='unit-life.js')resource.text=resource.text.replace('unit.hp>0','unit.hp>1');
  }})),/FULL_TRAINING_SOURCE_BINDING/);
});

test('new server source metadata cannot attest old executed script bytes after a deployment',async()=>{
  const expected=nodeHashes();
  const changed=readSource('unit-life.js').replace('unit.hp>0','unit.hp>1');
  const actual=vm.runInNewContext(changed+';GoblinUnitLife.alive({hp:1})');
  assert.equal(actual,false,'this is an effective liveness rule change');
  expected['unit-life.js']=createHash('sha256').update(changed).digest('hex');
  await assert.rejects(()=>prepareBrowserTrainingSources(browser({expected,change(path,resource){
    if(path==='unit-life.js')resource.text=changed;
  }})),/FULL_TRAINING_SOURCE_BINDING/);
  // A complete new deployment has its own distinct binding, which old archives cannot match.
  const host=browser({expected,change(path,resource,scripts){
    if(path!=='unit-life.js')return;
    resource.text=changed;
    scripts.find(script=>new URL(script.src).pathname.endsWith('/unit-life.js')).integrity=sri(changed);
  }});
  assert.equal(canonicalSources((await prepareBrowserTrainingSources(host)).sources),canonicalSources(expected));
  assert.notEqual(canonicalSources(expected),canonicalSources(nodeHashes()));
});

test('a missing script integrity proof disables browser binding; UI and presentation are never attested',async()=>{
  const host=browser();
  host.scripts.find(script=>new URL(script.src).pathname.endsWith('/game.js')).integrity='';
  await assert.rejects(()=>prepareBrowserTrainingSources(host),/FULL_TRAINING_SOURCE_BINDING/);
  const uiOnly=browser({change(path){assert.equal(Object.hasOwn(bindingManifest().ignoredPaths,path),false);}});
  assert.deepEqual((await prepareBrowserTrainingSources(uiOnly)).sources,generated());
});

test('FULL admission uses captured verified catalog data even if later server responses change',async()=>{
  const path='assets/unit-art/rules/unit-profiles.catalog-approved.v1.json';
  const host=browser();
  const bound=await prepareBrowserTrainingSources(host);
  const original=bound.readSource(path);
  const before=host.requests.filter(request=>request===path).length;
  host.fetch=async()=>{throw Error('server changed after binding');};
  assert.equal(bound.readSource(path),original);
  assert.equal(createHash('sha256').update(normalizeSource(original)).digest('hex'),bound.sources[path]);
  assert.equal(host.requests.filter(request=>request===path).length,before);
  let admitted;
  const loader=readSource('catalog-full-loader.js').replace("import('./full-training-source-binding.mjs')",'globalThis.bindingModule');
  await vm.runInNewContext(loader,{URLSearchParams,console,scenarioCatalog:{},renderScenarioObjective(){},
    bindingModule:{prepareBrowserTrainingSources:async()=>bound},
    fetch:host.fetch,GoblinCatalogFullModel:{publicProfile:'FULL_CATALOG_v1',has:()=>false,
      initialize:async(data)=>{admitted=data;return {};}}});
  assert.deepEqual(JSON.parse(JSON.stringify(admitted)),JSON.parse(original));
  await assert.rejects(()=>prepareBrowserTrainingSources(browser({change(candidate,resource){
    if(candidate!==path)return;
    const before=resource.text;
    resource.text=resource.text.replace(/("attack"\s*:\s*)(\d+)/,(_,key,value)=>key+(Number(value)+1));
    assert.notEqual(resource.text,before,'change an actual catalog attack value');
  }})),/FULL_TRAINING_SOURCE_BINDING/);
});
