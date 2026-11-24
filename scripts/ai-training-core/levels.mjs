import assert from 'node:assert/strict';
import {createRecordingGame} from './headless.mjs';
import {installStrategies} from './strategies.mjs';
import {policyId} from './binding.mjs';
export async function validateLevel({level}){
  const game=createRecordingGame();let installed;
  try{
    await game.run("GoblinCatalogFullModel.initialize(data,levelData,{profile:'FULL_CATALOG_v1'})");
    installed=await installStrategies(game);
    const clean=JSON.parse(JSON.stringify(level));
    const config=await game.context.GoblinEditorDraft.prepare(clean);
    assert.equal(clean.objective,'eliminate-opponent','AI_CORE_FORCE_OBJECTIVE_REQUIRED');
    const manager=installed.owner.configure(config);
    assert.equal(manager.maxSeats,2,'AI_CORE_TWO_SEATS_REQUIRED');
    const strategies={};
    for(const side of ['player','enemy']){
      const seat=manager.seats.find(seat=>seat.id===side);assert.ok(seat,'AI_CORE_TWO_SEATS_REQUIRED');
      strategies[side]=['weak','medium','strong','trained'].filter(id=>seat.ai.some(policy=>policy.id===policyId(side,id)));
      assert.ok(strategies[side].length,'AI_CORE_NO_LEGAL_AI_SEAT');
    }
    return {level:clean,strategies,pairStrategies:Object.fromEntries(Object.entries(strategies).map(([side,ids])=>[side,ids.filter(id=>id!=='trained')])),levelDigest:config.catalog.levelDigest};
  }finally{await installed?.dispose();game.dispose();}
}
