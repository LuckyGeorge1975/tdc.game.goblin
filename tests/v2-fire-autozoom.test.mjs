import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const start = source.indexOf('    function fireZoomEntry(state) {');
const end = source.indexOf('    new ResizeObserver(', start);
assert.ok(start > 0 && end > start);
const zoomSource = source.slice(start, end);
const hexWidth = Math.sqrt(3) * 34;
const fire = {scenario:'iron-dust-v2',turn:1,phase:'player',turnPhase:'fire',gameOver:false};

function scene({width=323,height=205,zoom=1,scrollbars=true}={}) {
  const size={width,height};
  const view={zoom};
  const nativeMap={viewBox:{baseVal:{width:790,height:480}},style:{},
    getBoundingClientRect(){return {width:Number.parseFloat(this.style.width)||0,
      height:Number.parseFloat(this.style.height)||0};}};
  const mapPanel={
    get clientWidth(){return Math.max(0,size.width-(scrollbars && Number.parseFloat(nativeMap.style.height)>size.height ? 15 : 0));},
    get clientHeight(){return Math.max(0,size.height-(scrollbars && Number.parseFloat(nativeMap.style.width)>this.clientWidth ? 15 : 0));}
  };
  const context={view,mapPanel,nativeMap,S:34,fireZoomPhase:null,
    activeAreaMode:state=>state.areaMode ?? state.turnPhase};
  runInNewContext(`${zoomSource}\nglobalThis.fireZoomEntry=fireZoomEntry;globalThis.zoomOnFireEntry=zoomOnFireEntry;globalThis.sizeMap=applyMapSize;`,context);
  context.sizeMap();
  let pendingKey=null;
  return {context,view,size,mapPanel,nativeMap,
    enter:state=>{const entry=context.fireZoomEntry(state);pendingKey=entry?.key||null;return entry;},
    settle:target=>{const changed=context.zoomOnFireEntry(target);
      if(pendingKey)context.fireZoomPhase=pendingKey;pendingKey=null;return changed;},
    visibleHex:()=>hexWidth*nativeMap.getBoundingClientRect().width/790};
}

test('fire zoom settles after a new 15px scrollbar on both portrait panels', () => {
  for (const [width,height,finalWidth] of [[323,205,308],[253,162,238]]) {
    const model=scene({width,height});
    const entry=model.enter(fire);
    assert.equal(entry.target,50);
    assert.equal(model.settle(entry.target),true);
    assert.equal(model.mapPanel.clientWidth,finalWidth);
    assert.ok(model.visibleHex()>=49.99 && model.visibleHex()<=50.01);
    assert.ok(model.view.zoom<4);
  }
});

test('fire entry retains a larger visible manual desktop scale after a 50px weapon row', () => {
  const model=scene({width:900,height:464,zoom:1.25**2,scrollbars:false});
  const before=model.visibleHex();
  assert.ok(before>88 && before<90);
  const entry=model.enter(fire);
  model.size.height-=50;
  assert.equal(model.settle(entry.target),true);
  assert.ok(Math.abs(model.visibleHex()-before)<0.01);
  assert.ok(model.view.zoom>1.25**2);
});

test('an unusually small panel stops at the existing fourfold limit', () => {
  const model=scene({width:80,height:50});
  model.settle(model.enter(fire).target);
  assert.equal(model.view.zoom,4);
  assert.ok(model.visibleHex()<50);
});

test('the phase guard leaves manual fit and later selection renders alone', () => {
  const model=scene();
  model.settle(model.enter(fire).target);
  model.view.zoom=1;
  model.context.sizeMap();
  assert.equal(model.enter({...fire,actorId:'A',target:'B',weapon:'main'}),null);
  assert.equal(model.view.zoom,1);
  assert.equal(model.enter({...fire,turn:2}).target,50);
});

test('nonfire, hidden panels, and already readable manual zoom do not alter the map', () => {
  const model=scene({width:900,height:464,zoom:3,scrollbars:false});
  assert.equal(model.enter({...fire,turnPhase:'movement'}),null);
  const entry=model.enter(fire);
  assert.equal(model.settle(entry.target),false);
  assert.equal(model.view.zoom,3);
  const hidden=scene({width:0,height:0});
  assert.equal(hidden.enter(fire),null);
  hidden.size.width=323; hidden.size.height=205;
  assert.equal(hidden.enter(fire).target,50);
});

test('the fire dialog fit button uses the shared fit handler and restores keyboard focus', () => {
  const start=source.indexOf("      if (state.turnPhase === 'fire') {\n        const fit = document.createElement('button');");
  const end=source.indexOf('      const cancel = document.createElement',start);
  assert.ok(start>0 && end>start);
  const buttons=[]; let fitted=0,focused=0;
  const context={state:fire,document:{createElement:()=>({})},
    t:()=> 'Fit',fitMap:()=>fitted++,at:()=>({focus:()=>focused++}),
    footer:{append:button=>buttons.push(button)}};
  runInNewContext(source.slice(start,end),context);
  assert.equal(buttons.length,1);
  assert.equal(buttons[0].textContent,'Fit');
  buttons[0].onclick();
  assert.equal(fitted,1);
  assert.equal(focused,1);
});
