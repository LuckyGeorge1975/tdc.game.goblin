import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function theme() {
  const symbol = {classList:{add(){}},replaceChildren(node){this.art=node;this.image=node.tag==='picture'?node.children[1]:node}};
  const storageCalls = [];
  const context = vm.createContext({
    document:{querySelector(selector){return selector==='#guide-symbol'?symbol:null},querySelectorAll(){return []},
      createElement(tag){return {tag,children:[],append(...nodes){this.children.push(...nodes)}}}},
    localStorage:{getItem(key){storageCalls.push(key)},setItem(key){storageCalls.push(key)}},
    units:[],selected:null,unitGuideEntries:[{name:'ASSAULT TANK'}],guideIndex:0,
    updateRoster(){},showCarrierCargo(){},updateSelection(){},renderUnitGuide(){},draw(){}
  });
  for (const file of ['unit-visuals.js','art-theme.js'])
    vm.runInContext(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
  return {context,storageCalls,symbol};
}

test('technical illustration does not use a stored style', () => {
  const {context,storageCalls} = theme();
  assert.equal(context.UnitVisuals.currentStyle(),'02-technical-illustration');
  assert.deepEqual(storageCalls,[]);
  assert.equal(context.UnitVisuals.assetFor({name:'ASSAULT TANK',team:'player'}),
    'assets/unit-art/sets/02-technical-illustration/map-icons/own/assault-tank.webp');
  assert.equal(context.UnitVisuals.assetFor({name:'ASSAULT TANK',team:'neutral'}),null);
});

test('guide uses the fixed WebP with PNG fallback', () => {
  const {context,symbol} = theme();
  context.renderUnitGuide();
  assert.equal(symbol.art.tag,'picture');
  assert.equal(symbol.art.children[0].srcset,
    'assets/unit-art/sets/02-technical-illustration/library/assault-tank@1024.webp');
  assert.equal(symbol.image.src,
    'assets/unit-art/sets/02-technical-illustration/library/assault-tank@768.png');
});
