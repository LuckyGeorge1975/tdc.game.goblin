import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {artilleryScene,queryBridge,read,execute,enemy} from './artillery-product-harness.mjs';
export {read,execute,enemy};
export async function catalogScene(id='catalog-transport',seed=7){
 const g=artilleryScene(true,seed);g.run(fs.readFileSync(new URL('../m1-unit-markers.js',import.meta.url),'utf8'));g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;
 const data=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url)));
 g.context.catalogData=data;
 await g.run('GoblinCatalogBase.initialize(catalogData)');
 g.run(`Object.assign(scenarioCatalog,GoblinCatalogBase.configs);loadScenario(${JSON.stringify(id)})`);
 queryBridge(g);return g;
}
