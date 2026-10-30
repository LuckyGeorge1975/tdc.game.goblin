import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import{createHash}from 'node:crypto';import{resizeBasisHash,resizeBasisSources}from './helpers/resize-observer-source-compatibility.mjs';
const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const source=ui.slice(ui.indexOf('    function applyMapSize() {'),ui.indexOf('    let compactDetails = null;'));
function scene(width=323,height=205,zoom=1){
 let callback,notifying=false,nextFrame=0;const frames=[],writes=[],reads=[];const size={width,height},values={};
 function geometry(){const vertical=parseFloat(values.height)>size.height,horizontal=parseFloat(values.width)>size.width-(vertical?15:0);return {width:Math.max(0,size.width-(vertical?15:0)),height:Math.max(0,size.height-(horizontal?15:0))}}
 const mapPanel={get clientWidth(){reads.push('width');return geometry().width},get clientHeight(){reads.push('height');return geometry().height}};
 const nativeMap={viewBox:{baseVal:{width:790,height:480}},style:new Proxy(values,{set(target,key,value){assert.equal(notifying,false,'no CSS writes inside RO delivery');writes.push([key,value]);target[key]=value;return true}})};
 const context=vm.createContext({mapPanel,nativeMap,view:{zoom},requestAnimationFrame:fn=>{frames.push(fn);return ++nextFrame},ResizeObserver:class{constructor(fn){callback=fn}observe(node){assert.equal(node,mapPanel)}}});
 vm.runInContext(source+'\nglobalThis.sizeMap=applyMapSize;',context);
 return {context,size,values,writes,reads,frames,notify(){notifying=true;try{callback()}finally{notifying=false}},flush(){frames.shift()?.()},direct(){context.sizeMap()},geometry};
}
test('actual map observer performs no writes on delivery and coalesces to one frame with latest size',()=>{
 const g=scene();g.notify();g.notify();g.notify();assert.equal(g.frames.length,1);assert.equal(g.writes.length,0);assert.equal(g.reads.length,0);
 g.size.width=500;g.size.height=300;g.flush();assert.equal(g.frames.length,0);assert.equal(g.writes.length,3);assert.deepEqual(g.reads,['width','height']);
 const count=g.writes.length;g.notify();g.flush();assert.equal(g.writes.length,count,'stable geometry must not rewrite SVG styles');
});
test('actual map sizing remains synchronous for explicit zoom, handles scrollbars, hidden/show and CSSOM decimals',()=>{
 const g=scene(323,205,2);g.direct();assert.equal(g.writes.length,3);assert.equal(g.frames.length,0);
 for(let n=0;n<4;n++){g.notify();g.flush()}
 const settled=g.writes.length;g.direct();assert.equal(g.writes.length,settled);assert.deepEqual(g.geometry(),{width:308,height:190});
 const saved={...g.values};g.size.width=0;g.size.height=0;g.notify();g.flush();assert.deepEqual(g.values,saved);
 g.size.width=500;g.size.height=300;g.notify();g.size.width=600;g.flush();assert.notDeepEqual(g.values,saved);
 const serialization=scene(300,500,1);serialization.direct();serialization.values.height=String(parseFloat(serialization.values.height)+0.001)+'px';const before=serialization.writes.length;serialization.direct();assert.equal(serialization.writes.length,before);
});
test('resize provenance rejects foreign references and every forged observer/cache/provider fingerprint',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('./fixtures/resize-observer-source-compatibility.v1.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');
 const current=Object.fromEntries(Object.keys(m.sourcePairs).map(path=>[path,hash(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n'))])),expected=Object.fromEntries(Object.entries(m.sourcePairs).map(([path,pair])=>[path,pair.from]));
 assert.deepEqual(resizeBasisSources(current,'training-t01'),expected);assert.throws(()=>resizeBasisSources(current,'foreign'));
 for(const path of Object.keys(current))assert.throws(()=>resizeBasisSources({...current,[path]:'forged'},'training-t01'));
 const incomplete={...current};delete incomplete['ui-v2.js'];assert.throws(()=>assert.deepEqual(resizeBasisSources(incomplete,'training-t01'),expected));
 assert.throws(()=>resizeBasisHash('tests/helpers/training-ui-fix-source-compatibility.mjs','forged','training-t01'));
});
