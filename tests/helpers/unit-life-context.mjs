import {readFileSync}from 'node:fs';import vm from 'node:vm';
// Isolated source-extraction tests must load the same shared life projection as the product.
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../../unit-life.js',import.meta.url),'utf8'),context);
export const lifeGlobals={unitAlive:context.GoblinUnitLife.alive,unitDead:context.GoblinUnitLife.dead};
