import assert from 'node:assert/strict';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';

test('projection key reuse detects in-place inputs and remains equal to the uncached native projector',async()=>{
  const game=await fullScene('catalog-full-atlas');
  game.run(`globalThis.nativeVisibility=GoblinCatalogVisibility;globalThis.projectionCalls=0;
    globalThis.GoblinCatalogVisibility=Object.freeze({...nativeVisibility,
      project(...args){projectionCalls++;return nativeVisibility.project(...args)}});
    globalThis.observer=units.find(unit=>unit.team==='player'&&!unit.catalogSystems&&!unit.embarkedOn);
    globalThis.terrainKey=terrainTypes.keys().next().value;
    globalThis.savedProjectionInputs={turn,phase,turnPhase,W,H,terrain:[...terrain],terrainTypes:[...terrainTypes],
      units:units.map(unit=>({...unit})),visibility:GoblinCatalogFullRuntime.ensure().visibility};`);
  const check=()=>{
    for(const team of ['player','enemy']){
      game.context.viewer=team;
      const actual=game.run('JSON.stringify(GoblinCatalogFullRuntime.roster(viewer).map(unit=>unit.id))');
      const expected=game.run(`JSON.stringify((()=>{const full=GoblinCatalogFullRuntime,
        visibility=full.ensure().visibility;
        return nativeVisibility.project(visibility,viewer,full.facts(visibility.teamFire),
          legacySession.effectiveRules.catalog.registry).knownIds})())`);
      assert.equal(actual,expected);
    }
  };
  check();
  game.run('projectionCalls=0');
  check();
  assert.equal(game.run('projectionCalls'),0,'identical facts reuse both native projections');
  for(const mutation of ['turn++',"phase=phase==='player'?'enemy':'player'",
    "turnPhase=turnPhase==='movement'?'fire':'movement'",'W++','H++',
    "terrain.has('0,0')?terrain.delete('0,0'):terrain.add('0,0')",
    "terrainTypes.set(terrainKey,terrainTypes.get(terrainKey)==='forest'?'open-ground':'forest')",
    'observer.x=(observer.x+1)%W','observer.y=(observer.y+1)%H','observer.disabled=!observer.disabled',
    "observer.id='cache-observer'","observer.catalogId=observer.catalogId==='U04'?'U01':'U04'",
    "observer.catalogAssetId=observer.catalogAssetId==='assault-tank'?'field-engineers':'assault-tank'",
    'observer.hp=0','observer.embarkedOn=units.find(unit=>unit!==observer).id',
    "observer.team=observer.team==='player'?'enemy':'player'",'units.reverse()',
    'GoblinCatalogFullRuntime.ensure().visibility=JSON.parse(JSON.stringify(GoblinCatalogFullRuntime.ensure().visibility));GoblinCatalogFullRuntime.ensure().visibility.sequence++']){
    game.run(mutation+';projectionCalls=0');
    check();
    assert.ok(game.run('projectionCalls')>0,mutation);
    game.run(`({turn,phase,turnPhase,W,H}=savedProjectionInputs);
      terrain=new Set(savedProjectionInputs.terrain);terrainTypes=new Map(savedProjectionInputs.terrainTypes);
      units.splice(0,units.length,...savedProjectionInputs.units.map(unit=>({...unit})));
      observer=units.find(unit=>unit.team==='player'&&!unit.catalogSystems&&!unit.embarkedOn);
      GoblinCatalogFullRuntime.ensure().visibility=savedProjectionInputs.visibility;`);
    check();
  }
});
