import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const localization = readFileSync(new URL('../localization.js', import.meta.url), 'utf8');
const match = source.match(/      function mark\(cell, kind\) \{[\s\S]*?\n      \}\n      const areaKind/);
assert.ok(match, 'area mark must remain inside renderAreaPreview');
const markSource = match[0].slice(0, -'      const areaKind'.length);

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

test('movement keeps the area shape without cost digits at desktop scale', () => {
  const {mark,children}=scene(1.2,true);
  mark({x:3,y:4,cost:2},'movement');
  assert.deepEqual(children.map(node=>node.tag),['polygon']);
  assert.equal(children[0].attrs['stroke-width'],undefined);
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
  const end = source.indexOf('      legend.textContent = ', start);
  assert.ok(start > 0 && end > start);
  const intel={textContent:'Unit → D-05 · Mountain'};
  const card={hidden:cardHidden};
  const context = {mode,view,data:{legal},message:'Reachable',showCostChips,
    t:key=>key==='v2.ui.sector'?'SECTOR':key,
    hexLabel:()=> 'D-05',
    GoblinLanguage:{translate:()=> 'MOVE COST'},
    at:key=>({'#v2-command-intel':intel,'#v2-command-card':card})[key]};
  runInNewContext(`${source.slice(start,end)}\nglobalThis.result = message;`,context);
  return {message:context.result,intel:intel.textContent};
}

test('focused legal field keeps its authoritative cost in the existing status view', () => {
  const context=focusScene({view:{infoCell:{x:3,y:4}},legal:[{x:3,y:4,cost:2}],showCostChips:true});
  assert.equal(context.message,'Reachable · SECTOR D-05 · MOVE COST 2');
});

test('fire and sight fill the whole cell like movement, without per-cell outline', () => {
  for (const kind of ['fire','sight']) {
    const {mark,children}=scene(2,true);
    mark({x:5,y:2},kind);
    assert.deepEqual(children.map(node=>node.classes[0]),[`v2-area-${kind}`]);
    assert.equal(children[0].attrs.points,'44,100 72,52 128,52 156,100 128,148 72,148');
    assert.equal(children[0].attrs['stroke-width'],undefined);
  }
});

test('the area outline keeps only sides that are not shared by two cells of the range', () => {
  const edge=source.match(/    function areaEdge\(cells, kind\) \{[\s\S]*?\n    \}\n/);
  assert.ok(edge,'areaEdge must stay a renderAreaPreview helper');
  const S=10,W=Math.sqrt(3)*S;
  const hexPoints=(x,y)=>{const cx=x*W+(y%2?W/2:0),cy=y*1.5*S;
    return Array.from({length:6},(_,i)=>{const a=Math.PI/180*(60*i-30);return `${cx+S*Math.cos(a)},${cy+S*Math.sin(a)}`;}).join(' ');};
  const document={createElementNS:()=>({attrs:{},classes:[],setAttribute(k,v){this.attrs[k]=v;},classList:{add(...v){document.last.classes.push(...v);}}})};
  const create=document.createElementNS;document.createElementNS=(...a)=>(document.last=create(...a));
  const context={document,NS:'svg',hexPoints};
  runInNewContext(`${edge[0]}\nglobalThis.areaEdge=areaEdge;`,context);
  const segments=cells=>context.areaEdge(cells,'fire').attrs.d.match(/M/g).length;
  assert.equal(segments([{x:0,y:0}]),6);
  assert.equal(segments([{x:0,y:0},{x:1,y:0}]),10);
  assert.equal(segments([{x:0,y:0},{x:1,y:0},{x:0,y:1}]),12);
  assert.deepEqual(context.areaEdge([{x:0,y:0}],'movement').classes,['v2-area-edge','v2-area-edge-movement']);
});

test('hidden chips expose only current legal focus cost above the map and in open move intel', () => {
  const legal=[{x:3,y:4,cost:2}];
  const selected=focusScene({view:{target:{x:3,y:4}},legal,showCostChips:false});
  assert.equal(selected.message,'Reachable · SECTOR D-05 · MOVE COST 2');
  assert.equal(selected.intel,'Unit → D-05 · Mountain');
  const focused=focusScene({view:{focusCell:{x:3,y:4}},legal,showCostChips:false,cardHidden:true});
  assert.equal(focused.message,'Reachable · SECTOR D-05 · MOVE COST 2');
  assert.equal(focused.intel,'Unit → D-05 · Mountain');
  const stale=focusScene({view:{target:{x:7,y:7},infoCell:{x:3,y:4}},legal,showCostChips:false});
  assert.equal(stale.message,'Reachable');
  assert.equal(stale.intel,'Unit → D-05 · Mountain');
  const phase=focusScene({view:{target:{x:3,y:4}},legal,showCostChips:false,mode:'fire'});
  assert.equal(phase.message,'Reachable');
  assert.equal(phase.intel,'Unit → D-05 · Mountain');
});

test('movement and empty selection have no redundant status prompt or reachable count', () => {
  const start=source.indexOf('      let message = ');
  const end=source.indexOf("      if (data.reason)",start);
  assert.ok(start>0 && end>start);
  const status=source.slice(start,end);
  for (const [state,expected] of [['move',''],['select',''],['blocked','v2.area.status.blocked:2']]) {
    const context={data:{status:state,legal:[{},{}]},
      t:(name,{count})=>`${name}:${count}`};
    runInNewContext(`${status}\nglobalThis.result=message;`,context);
    assert.equal(context.result,expected);
  }
});

test('movement button labels path length as steps in all four languages', () => {
  const match=localization.match(/'v2\.ui\.pathSteps': (\{[^\n]+\}),/);
  assert.ok(match);
  const labels=runInNewContext(`(${match[1]})`);
  assert.deepEqual(Object.keys(labels),['de','en','es','fr']);
  for (const label of Object.values(labels)) assert.match(label,/\{count\}/);
  assert.match(source,/v2\.ui\.pathSteps/);
  const compact=localization.match(/'v2\.area\.status\.moveCompact': (\{[^\n]+\}),/);
  assert.ok(compact);
  assert.deepEqual(Object.keys(runInNewContext(`(${compact[1]})`)),['de','en','es','fr']);
});
