import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareBrowserTrainingSources} from '../../full-training-source-binding.mjs';

const root=new URL('../../',import.meta.url);
const nativePath='assets/training/full-native-sources.json';
const dataPaths=['assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',
  'assets/unit-art/levels/catalog-full-levels.v3.json'];

// VM scripts cannot import a browser module with VM-local default globals. Bind
// that one dependency explicitly, retaining the real source/SRI verifier and all
// admission code. Existing loader fixtures still control HTTP/data failure cases.
export async function runFullLoader(game,source){
  const request=game.context.fetch;
  const scripts=[...fs.readFileSync(new URL('index.html',root),'utf8')
    .matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match=>({
      src:new URL(match[1],root).href,
      integrity:match[0].match(/integrity="([^"]+)"/)?.[1]??''}));
  const host={document:{baseURI:root.href,querySelectorAll:()=>scripts},async fetch(url){
    const path=new URL(url,root).pathname.slice(root.pathname.length);
    const response=await request(path);
    if(!response.ok)return response;
    let text=fs.readFileSync(new URL(path,root),'utf8');
    if(path===nativePath)return {ok:true,json:async()=>JSON.parse(text)};
    if(dataPaths.includes(path)){
      const candidate=await response.json();
      if(JSON.stringify(candidate)!==JSON.stringify(JSON.parse(text)))text=JSON.stringify(candidate);
    }
    return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(text).buffer};
  }};
  game.context.__fullTrainingSourcesModule={prepareBrowserTrainingSources:()=>prepareBrowserTrainingSources(host)};
  const dependency="await import('./full-training-source-binding.mjs')";
  assert.equal(source.split(dependency).length,2,'loader source module seam changed');
  try{return await game.run(source.replace(dependency,'__fullTrainingSourcesModule'));}
  finally{delete game.context.__fullTrainingSourcesModule;}
}
