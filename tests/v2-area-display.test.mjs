import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const localization = readFileSync(new URL('../localization.js', import.meta.url), 'utf8');
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
    hexPoints:()=> '44,100 72,52 128,52 156,100 128,148 72,148', hexCenter:()=>({x:100,y:100}),
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

function focusScene({view,legal,showCostChips,mode='movement',cardHidden=false}) {
  const start = source.indexOf("      if (mode === 'movement') {\n        const focused");
  const end = source.indexOf('      if (view.target && mode', start);
  assert.ok(start > 0 && end > start);
  const caption={textContent:'12 × 8 · Pan'}, intel={textContent:'Unit → D-05 · Mountain'};
  const card={hidden:cardHidden};
  const context = {mode,view,data:{legal},message:'Reachable',showCostChips,
    t:key=>key==='v2.ui.sector'?'SECTOR':key,
    hexLabel:()=> 'D-05',
    GoblinLanguage:{translate:()=> 'MOVE COST'},
    at:key=>({'#v2-map-caption':caption,'#v2-command-intel':intel,'#v2-command-card':card})[key]};
  runInNewContext(`${source.slice(start,end)}\nglobalThis.result = message;`,context);
  return {message:context.result,caption:caption.textContent,intel:intel.textContent};
}

test('focused legal field keeps its authoritative cost in the existing status view', () => {
  const context=focusScene({view:{infoCell:{x:3,y:4}},legal:[{x:3,y:4,cost:2}],showCostChips:true});
  assert.equal(context.message,'Reachable · SECTOR D-05 · MOVE COST 2');
});

test('fire uses a centered inner ring with reference-width proportions', () => {
  const {mark,children}=scene(2,true);
  mark({x:5,y:2},'fire');
  assert.deepEqual(children.map(node=>node.classes[0]),['v2-area-fire-underlay','v2-area-fire']);
  const refToSvg = 112/(Math.sqrt(3)*34);
  assert.equal(children[0].attrs['stroke-width']*refToSvg,5.5);
  assert.equal(children[1].attrs['stroke-width']*refToSvg,2.5);
  assert.equal(children[0].attrs.points,children[1].attrs.points);
  const xs=children[0].attrs.points.split(' ').map(pair=>Number(pair.split(',')[0]));
  assert.equal(Math.max(...xs)-Math.min(...xs),92);
  assert.equal((Math.max(...xs)+Math.min(...xs))/2,100);
});

test('tiny fire ring keeps a visible projected stroke floor', () => {
  const {mark,children}=scene(.3,true);
  mark({x:5,y:2},'fire');
  assert.ok(Math.abs(children[0].attrs['stroke-width']*.3-3.5)<1e-9);
  assert.ok(Math.abs(children[1].attrs['stroke-width']*.3-1.5)<1e-9);
});

test('hidden chips expose only current legal focus cost above the map and in open move intel', () => {
  const legal=[{x:3,y:4,cost:2}];
  const selected=focusScene({view:{target:{x:3,y:4}},legal,showCostChips:false});
  assert.equal(selected.message,'Reachable · SECTOR D-05 · MOVE COST 2');
  assert.equal(selected.caption,'D-05 · MOVE COST 2');
  assert.equal(selected.intel,'Unit → D-05 · Mountain · MOVE COST 2');
  const focused=focusScene({view:{focusCell:{x:3,y:4}},legal,showCostChips:false,cardHidden:true});
  assert.equal(focused.caption,'D-05 · MOVE COST 2');
  assert.equal(focused.intel,'Unit → D-05 · Mountain');
  const stale=focusScene({view:{target:{x:7,y:7},infoCell:{x:3,y:4}},legal,showCostChips:false});
  assert.equal(stale.caption,'12 × 8 · Pan');
  assert.equal(stale.intel,'Unit → D-05 · Mountain');
  const phase=focusScene({view:{target:{x:3,y:4}},legal,showCostChips:false,mode:'fire'});
  assert.equal(phase.caption,'12 × 8 · Pan');
  assert.equal(phase.intel,'Unit → D-05 · Mountain');
});

test('compact movement status points to the focused cost instead of claiming a visible number', () => {
  assert.match(source,/const showCostChips = hexWidth \* pixelScale >= 50 && !matchMedia\('\(max-width: 599px\)'\)\.matches;/);
  const start=source.indexOf('      let message = t(mode ===');
  const end=source.indexOf("      if (weapon && mode === 'fire')",start);
  assert.ok(start>0 && end>start);
  const status=source.slice(start,end);
  for (const [visible,key] of [[true,'v2.area.status.move'],[false,'v2.area.status.moveCompact']]) {
    const context={mode:'movement',data:{status:'move',legal:[{},{}]},showCostChips:visible,
      t:(name,{count})=>`${name}:${count}`};
    runInNewContext(`${status}\nglobalThis.result=message;`,context);
    assert.equal(context.result,`${key}:2`);
  }
});

test('movement button labels path length as steps in all four languages', () => {
  const match=localization.match(/'v2\.ui\.pathSteps': (\{[^\n]+\}),/);
  assert.ok(match);
  const labels=runInNewContext(`(${match[1]})`);
  assert.deepEqual(Object.keys(labels),['de','en','es','fr']);
  for (const label of Object.values(labels)) assert.match(label,/\{count\}/);
  assert.match(source,/command\.type === 'Move' && availability\.path \? ` · \$\{t\('v2\.ui\.pathSteps', \{count:availability\.path\.length\}\)\}`/);
  const compact=localization.match(/'v2\.area\.status\.moveCompact': (\{[^\n]+\}),/);
  assert.ok(compact);
  assert.deepEqual(Object.keys(runInNewContext(`(${compact[1]})`)),['de','en','es','fr']);
});
