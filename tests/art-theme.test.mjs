import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const directory of ['', 'src/legacy/scripts/']) {
  function theme(saved = '06-military-symbols') {
    const symbol = {classList:{add(){}},replaceChildren(node){this.art=node;this.image=node.tag==='picture'?node.children[1]:node}};
    const storage = new Map([['goblin-art-style', saved]]);
    const context = vm.createContext({
      document:{querySelector(selector){return selector==='#guide-symbol'?symbol:null},querySelectorAll(){return []},
        createElement(tag){return {tag,children:[],append(...nodes){this.children.push(...nodes)}}}},
      localStorage:{getItem(key){return storage.get(key)||null},setItem(key,value){storage.set(key,value)}},
      units:[],selected:null,unitGuideEntries:[{name:'ASSAULT TANK'}],guideIndex:0,
      updateRoster(){},showCarrierCargo(){},updateSelection(){},renderUnitGuide(){},draw(){}
    });
    for (const file of ['unit-visuals.js','art-theme.js'])
      vm.runInContext(readFileSync(new URL(`../${directory}${file}`,import.meta.url),'utf8'),context);
    return {context,storage,symbol};
  }

  test(`${directory || 'root'} normalizes a saved foreign style to technical illustration`, () => {
    const {context,storage} = theme();
    assert.equal(context.UnitVisuals.currentStyle(),'02-technical-illustration');
    assert.equal(storage.get('goblin-art-style'),'02-technical-illustration');
    assert.equal(context.UnitVisuals.setStyle('03-industrial-realism'),false);
    assert.equal(context.UnitVisuals.assetFor({name:'ASSAULT TANK'}),
      'assets/unit-art/sets/02-technical-illustration/icons/assault-tank.png');
  });

  test(`${directory || 'root'} guide uses the fixed WebP with PNG fallback`, () => {
    const {context,symbol} = theme();
    context.renderUnitGuide();
    assert.equal(symbol.art.tag,'picture');
    assert.equal(symbol.art.children[0].srcset,
      'assets/unit-art/sets/02-technical-illustration/library/assault-tank@1024.webp');
    assert.equal(symbol.image.src,
      'assets/unit-art/sets/02-technical-illustration/library/assault-tank@768.png');
  });
}
