import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const start = source.indexOf('    function zoomOnFireEntry(state) {');
const end = source.indexOf('    function applyMapSize() {', start);
assert.ok(start > 0 && end > start);
const zoomSource = source.slice(start, end);

function scene({panelWidth = 325, panelHeight = 198, mapWidth = 790, mapHeight = 480, zoom = 1} = {}) {
  const view = {zoom};
  const mapPanel = {clientWidth:panelWidth,clientHeight:panelHeight};
  const nativeMap = {viewBox:{baseVal:{width:mapWidth,height:mapHeight}}};
  const applied = [];
  const context = {view,mapPanel,nativeMap,S:34,fireZoomPhase:null,
    activeAreaMode:state=>state.areaMode ?? state.turnPhase,
    applyMapSize:()=>applied.push(view.zoom)};
  runInNewContext(`${zoomSource}\nglobalThis.zoomOnFireEntry = zoomOnFireEntry;`,context);
  return {context,view,applied,enter:state=>context.zoomOnFireEntry(state)};
}

const fire = {scenario:'iron-dust-v2',turn:1,phase:'player',turnPhase:'fire',gameOver:false};

test('fire entry sizes the projected hex to 50 CSS pixels within the zoom limit', () => {
  for (const [width,height] of [[325,198],[255,145],[844,140]]) {
    const {view,enter,applied}=scene({panelWidth:width,panelHeight:height});
    assert.equal(enter(fire),true);
    const fit=Math.min(width/790,height/480);
    assert.ok(view.zoom>=1 && view.zoom<=4);
    assert.ok(Math.abs(Math.sqrt(3)*34*fit*view.zoom-50)<1e-8);
    assert.equal(applied.length,1);
  }
});

test('very small panels stop at the existing fourfold limit', () => {
  const {view,enter}=scene({panelWidth:80,panelHeight:50});
  assert.equal(enter(fire),true);
  assert.equal(view.zoom,4);
});

test('one fire phase does not reapply zoom after manual fit, actor, target, or weapon rerenders', () => {
  const {view,enter,applied}=scene();
  enter(fire);
  view.zoom=1;
  assert.equal(enter({...fire,actorId:'A',target:'B',weapon:'main'}),false);
  assert.equal(view.zoom,1);
  assert.equal(applied.length,1);
  assert.equal(enter({...fire,turn:2}),true);
  assert.equal(applied.length,2);
});

test('already readable manual zoom is preserved and nonfire phases do not trigger', () => {
  const {view,enter,applied}=scene({zoom:3});
  assert.equal(enter({...fire,turnPhase:'movement'}),false);
  assert.equal(enter(fire),false);
  assert.equal(view.zoom,3);
  assert.equal(applied.length,0);
});

test('hidden map defers fire entry until it has a measurable panel', () => {
  const {context,enter,applied}=scene({panelWidth:0});
  assert.equal(enter(fire),false);
  context.mapPanel.clientWidth=325;
  assert.equal(enter(fire),true);
  assert.equal(applied.length,1);
});
