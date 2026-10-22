import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const match = source.match(/      function mark\(cell, kind\) \{[\s\S]*?\n      \}\n      for \(const cell of data\.legal\)/);
assert.ok(match, 'area mark must remain inside renderAreaPreview');
const markSource = match[0].slice(0, -'      for (const cell of data.legal)'.length);

function scene(pixelScale, showCostChips) {
  const children = [];
  const document = {createElementNS:(_ns,tag) => ({tag, attrs:{}, dataset:{}, classes:[],
    setAttribute(name,value){this.attrs[name]=Number.isFinite(value)?Number(value):String(value);},
    classList:{add(value){this.owner.classes.push(value);}}})};
  const create = document.createElementNS;
  document.createElementNS = (ns,tag) => {
    const node = create(ns,tag);
    node.classList.owner = node;
    return node;
  };
  const context = {document, NS:'http://www.w3.org/2000/svg', S:34,
    referenceScale:Math.sqrt(3)*34/112, pixelScale, showCostChips,
    hexPoints:()=> 'points', hexCenter:()=>({x:100,y:100}),
    overlay:{append(...nodes){children.push(...nodes);}}};
  runInNewContext(`${markSource}\nglobalThis.mark = mark;`,context);
  return {mark:context.mark, children};
}

test('movement keeps the legal cost in a bottom chip at readable projected size', () => {
  const {mark,children}=scene(1.2,true);
  mark({x:3,y:4,cost:2},'movement');
  assert.deepEqual(children.map(node=>node.tag),['polygon','rect','text']);
  assert.equal(children[0].attrs['stroke-width']*112/(Math.sqrt(3)*34),2);
  assert.equal(children[1].classes[0],'v2-area-cost-chip');
  assert.equal(children[2].textContent,'2');
  assert.equal(children[1].dataset.x,'3');
  assert.equal(children[1].attrs.width*1.2>=24,true);
  assert.equal(children[1].attrs.height*1.2>=20,true);
  assert.equal(children[2].attrs['font-size']*1.2>=11,true);
  assert.equal(children[1].attrs.y>100,true);
});

test('small fit omits illegible chips without changing the legal movement shape', () => {
  const {mark,children}=scene(.4,false);
  mark({x:3,y:4,cost:2},'movement');
  assert.deepEqual(children.map(node=>node.tag),['polygon']);
  assert.equal(children[0].dataset.x,'3');
  assert.equal(children[0].dataset.y,'4');
});

test('focused legal field keeps its authoritative cost in the existing status view', () => {
  const start = source.indexOf("      if (mode === 'movement') {\n        const focused");
  const end = source.indexOf('      if (view.target && mode', start);
  assert.ok(start > 0 && end > start);
  const context = {mode:'movement',view:{infoCell:{x:3,y:4}},
    data:{legal:[{x:3,y:4,cost:2}]},message:'Reachable',
    t:key=>key==='v2.ui.sector'?'SECTOR':key,
    hexLabel:()=> 'D-05',
    GoblinLanguage:{translate:()=> 'MOVE COST'}};
  runInNewContext(`${source.slice(start,end)}\nglobalThis.result = message;`,context);
  assert.equal(context.result,'Reachable · SECTOR D-05 · MOVE COST 2');
});

test('fire uses a dark underlay and danger ring with reference-width proportions', () => {
  const {mark,children}=scene(1.2,true);
  mark({x:5,y:2},'fire');
  assert.deepEqual(children.map(node=>node.classes[0]),['v2-area-fire-underlay','v2-area-fire']);
  const refToSvg = 112/(Math.sqrt(3)*34);
  assert.equal(children[0].attrs['stroke-width']*refToSvg,5.5);
  assert.equal(children[1].attrs['stroke-width']*refToSvg,2.5);
  assert.equal(children[0].attrs.points,children[1].attrs.points);
});
