import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const source=ui.slice(ui.indexOf('    function applyMapSize() {'),ui.indexOf('    let compactDetails = null;'));
function scene(width=323,height=205,zoom=1){
 let callback,notifying=false,nextFrame=0;const frames=[],writes=[],reads=[];const size={width,height},values={};
 const frameById=new Map();
 function geometry(){const vertical=parseFloat(values.height)>size.height,horizontal=parseFloat(values.width)>size.width-(vertical?15:0);return {width:Math.max(0,size.width-(vertical?15:0)),height:Math.max(0,size.height-(horizontal?15:0))}}
 const mapPanel={get clientWidth(){reads.push('width');return geometry().width},get clientHeight(){reads.push('height');return geometry().height}};
 const nativeMap={viewBox:{baseVal:{width:790,height:480}},style:new Proxy(values,{set(target,key,value){assert.equal(notifying,false,'no CSS writes inside RO delivery');writes.push([key,value]);target[key]=value;return true}})};
 const context=vm.createContext({mapPanel,nativeMap,view:{zoom},requestAnimationFrame:fn=>{const id=++nextFrame;frames.push(fn);frameById.set(id,fn);return id},cancelAnimationFrame:id=>{const fn=frameById.get(id);if(fn){const idx=frames.indexOf(fn);if(idx>=0)frames.splice(idx,1);frameById.delete(id)}},ResizeObserver:class{constructor(fn){callback=fn}observe(node){assert.equal(node,mapPanel)}}});
 vm.runInContext(source+'\nglobalThis.sizeMap=applyMapSize;globalThis.resumeSize=resumeMapSize;',context);
 return {context,size,values,writes,reads,frames,notify(){notifying=true;try{callback()}finally{notifying=false}},flush(){const fn=frames.shift();fn?.()},direct(){context.sizeMap()},geometry};
}
test('actual map observer performs no writes on delivery and coalesces to one frame with latest size',()=>{
 const g=scene();g.notify();g.notify();g.notify();assert.equal(g.frames.length,1);assert.equal(g.writes.length,0);assert.equal(g.reads.length,0);
 g.size.width=500;g.size.height=300;g.flush();assert.equal(g.frames.length,0);assert.equal(g.writes.length,3);assert.deepEqual(g.reads,['width','height']);
 const count=g.writes.length;g.notify();g.flush();assert.equal(g.writes.length,count,'stable geometry must not rewrite SVG styles');
});

test('shot presentation holds the fit through layout changes and resumes once at the latest size', () => {
 const map = scene(1302, 775, 1);
 let presentingFire = true;
 map.context.GoblinMovement = {presentingFire: () => presentingFire};
 map.direct();
 const before = {...map.values};
 map.size.height = 790;
 map.notify();
 map.flush();
 assert.deepEqual(map.values, before);
 map.size.width = 1200;
 map.notify();
 map.flush();
 assert.deepEqual(map.values, before);
 map.context.resumeSize();
 assert.equal(map.frames.length, 0);

 presentingFire = false;
 map.context.resumeSize();
 map.context.resumeSize();
 assert.equal(map.frames.length, 1);
 map.flush();
 assert.equal(map.values.width, '1200px');
 assert.notDeepEqual(map.values, before);
 map.context.resumeSize();
 assert.equal(map.frames.length, 0);
});

test('explicit zoom still applies immediately during a shot', () => {
 const map = scene(900, 450, 1);
 map.context.GoblinMovement = {presentingFire: () => true};
 map.direct();
 const before = parseFloat(map.values.width);
 map.context.view.zoom = 1.25;
 map.direct();
 assert.equal(parseFloat(map.values.width), before * 1.25);
 assert.equal(map.frames.length, 0);
});
test('actual map sizing remains synchronous for explicit zoom, handles scrollbars, hidden/show and CSSOM decimals',()=>{
 const g=scene(323,205,2);g.direct();assert.equal(g.writes.length,3);assert.equal(g.frames.length,0);
 for(let n=0;n<4;n++){g.notify();g.flush()}
 const settled=g.writes.length;g.direct();assert.equal(g.writes.length,settled);assert.deepEqual(g.geometry(),{width:308,height:190});
 const saved={...g.values};g.size.width=0;g.size.height=0;g.notify();g.flush();assert.deepEqual(g.values,saved);
 g.size.width=500;g.size.height=300;g.notify();g.size.width=600;g.flush();assert.notDeepEqual(g.values,saved);
 const serialization=scene(300,500,1);serialization.direct();serialization.values.height=String(parseFloat(serialization.values.height)+0.001)+'px';const before=serialization.writes.length;serialization.direct();assert.equal(serialization.writes.length,before);
});
