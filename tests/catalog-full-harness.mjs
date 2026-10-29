import fs from 'node:fs';import {webcrypto} from 'node:crypto';
import {artilleryScene,queryBridge} from './artillery-product-harness.mjs';
export async function fullScene(id='catalog-full-specialists',seed=7,observe=false){
 const g=artilleryScene(observe,seed,true,['catalog-full-model.js','catalog-waves.js','catalog-visibility.js','catalog-full-runtime.js']);g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;
 g.context.data=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url)));
 g.context.levelData=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/levels/catalog-full-levels.v1.json',import.meta.url)));
 await g.run('GoblinCatalogFullModel.initialize(data,levelData)');g.run(`Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs);loadScenario(${JSON.stringify(id)});`);queryBridge(g);return g;
}
