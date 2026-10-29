import fs from 'node:fs';import {webcrypto} from 'node:crypto';
import {artilleryScene,queryBridge} from './artillery-product-harness.mjs';
export function fullShell(seed=7,observe=false){
 const g=artilleryScene(observe,seed,true,['catalog-full-model.js','catalog-waves.js','catalog-visibility.js','catalog-full-runtime.js','training-director.js','training-model.js','training-runtime.js']);g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;
 g.context.data=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url)));
 g.context.levelData=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/levels/catalog-full-levels.v1.json',import.meta.url)));
 return g;
}
export async function fullScene(id='catalog-full-specialists',seed=7,observe=false,profile='CATALOG_FULL_CANDIDATE_v1'){
 const g=fullShell(seed,observe);g.context.admissionProfile=profile;
 await g.run('GoblinCatalogFullModel.initialize(data,levelData,{profile:admissionProfile})');g.run(`Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs);loadScenario(${JSON.stringify(id)});`);queryBridge(g);return g;
}
