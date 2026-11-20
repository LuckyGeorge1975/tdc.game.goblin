import assert from 'node:assert/strict';
import {fullScene} from '../catalog-full-harness.mjs';
import {read} from '../artillery-product-harness.mjs';
import {createFullCatalogAiHost,createOwnedFullCatalogAiAdapter} from '../../src/core/full-catalog-ai-adapter.mjs';
export async function nativeSession(id='catalog-full-atlas') {
  const game=await fullScene(id);
  game.context.controls={roles:{player:'ai',enemy:'ai'},seed:7};
  const port=game.run('loadScenario(currentScenario,controls)'),full=game.context.GoblinCatalogFullRuntime;
  const host=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  const adapter=createOwnedFullCatalogAiAdapter(port,host);
  const commit=command=>port.commit('ai',port.open('ai')?.permit,command,host.dispatch);
  const endPhase=()=>assert.equal(commit({type:'EndPhase'}).ok,true);
  return {game,port,full,host,adapter,commit,endPhase,
    facts:()=>[game.state(),read(game,'GoblinCatalogFullRuntime.snapshot()'),game.rng()]};
}
export function closeAtlas(game) {
  game.run(`{const shooter=units.find(u=>u.id==='catalog-full-atlas-20'),
    target=units.find(u=>u.id==='catalog-full-atlas-1');
    shooter.x=1;shooter.y=1;target.x=2;target.y=1;
    terrain.clear();terrainTypes.clear();GoblinCatalogFullRuntime.refresh()}`);
}
export const request=(batch,candidate)=>({schemaVersion:1,decisionId:batch.decisionId,revision:batch.revision,key:candidate.key});
