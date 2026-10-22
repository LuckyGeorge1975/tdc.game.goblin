import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const start=source.indexOf('    function selectedFirePreview(');
const end=source.indexOf('    function renderAreaPreview(',start);
assert.ok(start>0 && end>start);
const selectionSource=source.slice(start,end);

const actor={id:'ogre',x:1,y:2,weapons:{main:{}}};
const target={id:'guard',team:'enemy',hp:3,x:4,y:3};
const state={profile:'PROFILE',revision:'REVISION',units:[actor,target]};
const legal=[{x:4,y:3}];
const bound={profileId:'PROFILE',stateRevision:'REVISION',actorId:'ogre',targetId:'guard',
  weaponKey:'main',from:{x:1,y:2},to:{x:4,y:3},legal:true,
  ratioCategory:'2-1',meaning:'crt-attack-effective-defense'};

function selection({view={target:{x:4,y:3}},profile=state,preview=bound,
  key='main',cells=legal,mode='fire',isCore=true}={}) {
  let queries=0,command=null;
  const context={view,core:()=>isCore,previewFire:value=>{queries++;command=value;return preview;}};
  runInNewContext(`${selectionSource}\nglobalThis.select=selectedFirePreview;`,context);
  const result=context.select(profile,profile.units[0],profile.units[0],mode,key,cells);
  return {result,queries,command};
}

test('current legal target uses the same Core or Legacy weapon command', () => {
  const core=selection();
  assert.equal(core.result?.ratioCategory,'2-1');
  assert.equal(JSON.stringify(core.command),JSON.stringify({type:'PlayerFire',playerId:'player',
    unitId:'ogre',targetId:'guard',weaponKey:'main'}));
  const legacy=selection({isCore:false,profile:{...state,units:[{...actor,weapons:null,ogreSystems:{weapons:{main:{}}}},target]}});
  assert.equal(JSON.stringify(legacy.command),JSON.stringify({type:'Fire',actorId:'ogre',x:4,y:3,weaponKey:'main'}));
});

test('selection clears invalid targets and every stale binding', () => {
  for (const value of [null,{target:{x:7,y:7}}])
    assert.equal(selection({view:value??{target:null}}).queries,0);
  assert.equal(selection({cells:[]}).queries,0);
  assert.equal(selection({mode:'movement'}).queries,0);
  for(const field of ['profileId','stateRevision','actorId','targetId','weaponKey']) {
    const stale={...bound,[field]:'OLD'};
    assert.equal(selection({preview:stale}).result,null,field);
  }
  for(const field of ['from','to']) {
    const stale={...bound,[field]:{x:9,y:9}};
    assert.equal(selection({preview:stale}).result,null,field);
  }
  assert.equal(selection({preview:{...bound,legal:false}}).result,null);
  assert.equal(selection({preview:null}).result,null);
});

const drawStart=source.indexOf('      const firePreview = selectedFirePreview(');
const drawEnd=source.indexOf('      let message = t(',drawStart);
assert.ok(drawStart>0 && drawEnd>drawStart);
const drawSource=source.slice(drawStart,drawEnd);
function draw(preview,pixelScale,cardHidden=false) {
  const children=[];
  const intel={textContent:'Target info'};
  const card={hidden:cardHidden};
  const document={createElementNS:(_ns,tag)=>{
    const element={tag,attrs:{},classes:[],setAttribute(key,value){this.attrs[key]=value;}};
    element.classList={add(value){element.classes.push(value);}};
    return element;
  }};
  const context={selectedFirePreview:()=>preview,state,actor,runtime:actor,mode:'fire',
    weaponKey:'main',data:{legal},document,NS:'svg',hexCenter:(x,y)=>({x:x*100,y:y*100}),
    overlay:{append(...nodes){children.push(...nodes);}},pixelScale,
    hexWidth:Math.sqrt(3)*34,referenceScale:Math.sqrt(3)*34/112,
    matchMedia:()=>({matches:false}),at:key=>key==='#v2-command-card'?card:intel};
  runInNewContext(drawSource,context);
  return {children,intel:intel.textContent};
}

test('connection uses paired 8/4 reference strokes and centered 38x22 CRT chip', () => {
  const {children,intel}=draw(bound,2);
  assert.deepEqual(children.map(node=>node.tag),['line','line','rect','text']);
  assert.deepEqual(children.slice(0,2).map(node=>node.classes[0]),
    ['v2-fire-link-underlay','v2-fire-link-signal']);
  const scale=112/(Math.sqrt(3)*34);
  assert.equal(children[0].attrs['stroke-width']*scale,8);
  assert.equal(children[1].attrs['stroke-width']*scale,4);
  assert.equal(children[2].attrs.width*scale,38);
  assert.equal(children[2].attrs.height*scale,22);
  assert.equal(children[3].textContent,'2:1');
  assert.equal(children[3].attrs.x,(children[0].attrs.x1+children[0].attrs.x2)/2);
  assert.equal(intel,'Target info · CRT 2:1');
  assert.match(css,/#v2-grid-overlay, body\.ui-v2-active #v2-area-overlay \{ pointer-events: none; \}/);
});

test('tiny fit keeps readable CRT in command intel; unknown quote keeps line only', () => {
  const small=draw(bound,.4);
  assert.deepEqual(small.children.map(node=>node.tag),['line','line']);
  assert.equal(small.intel,'Target info · CRT 2:1');
  const unknown=draw({...bound,ratioCategory:null},2);
  assert.deepEqual(unknown.children.map(node=>node.tag),['line','line']);
  assert.equal(unknown.intel,'Target info');
  const invalid=draw(null,2);
  assert.equal(invalid.children.length,0);
  assert.equal(invalid.intel,'Target info');
});
