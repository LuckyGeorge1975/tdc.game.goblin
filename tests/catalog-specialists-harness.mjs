import fs from 'node:fs';import {webcrypto} from 'node:crypto';import {artilleryScene,read,queryBridge} from './artillery-product-harness.mjs';
export {read};
export async function specialistsScene(id='catalog-siege',seed=7){
 const g=artilleryScene(true,seed);g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;g.context.approvedData=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',import.meta.url),'utf8'));
 await g.run('GoblinCatalogSpecialistsModel.initialize(approvedData)');g.run(`Object.assign(scenarioCatalog,GoblinCatalogSpecialistsModel.configs);loadScenario(${JSON.stringify(id)})`);g.run(fs.readFileSync(new URL('../catalog-specialists-ui.js',import.meta.url),'utf8'));queryBridge(g);return g;
}
