import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const rule=selector=>{
  const start=css.indexOf(`${selector} {`);
  assert.ok(start>=0,selector);
  return css.slice(start,css.indexOf('}',start)+1);
};

test('one non-modal target card has bounded scrollable alternatives',()=>{
  assert.equal((source.match(/id="v2-target-card"/g)??[]).length,1);
  assert.doesNotMatch(source,/id="v2-command-card"|id="v2-action-chip"/);
  assert.match(source,/<section class="v2-card v2-target-card" id="v2-target-card" role="group"/);
  assert.match(rule('.v2-target-choices'),/overflow: auto/);
  assert.match(rule('.v2-target-choices'),/max-height/);
});

test('retarget and layout reposition use the map hex and never confirm',()=>{
  assert.match(source,/if \(cell\) chooseHex\(cell\.x, cell\.y\);/);
  const sync=source.slice(source.indexOf('    function syncLayout()'),source.indexOf("    window.addEventListener('resize', syncLayout)"));
  assert.match(sync,/placeNearHex\(card, view\.target/);
  assert.doesNotMatch(sync,/dispatch|runCommand/);
});

test('desktop panels use independent preferences and preserve the old intel choices',()=>{
  const start=source.indexOf('    const intelSectionsKey'), end=source.indexOf('    function statBar(',start);
  let stored='{"unit":false,"field":true}', renders=0;
  const context={localStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value}},render:()=>renders++};
  const load=()=>runInNewContext(source.slice(start,end)+'\n({intelSections,setPanelVisible})',{...context});
  const initial=load();
  assert.deepEqual({...initial.intelSections},{roster:true,unit:false,field:true,legend:true});
  initial.setPanelVisible('roster',false);
  initial.setPanelVisible('legend',false);
  assert.equal(renders,2);
  assert.deepEqual({...load().intelSections},{roster:false,unit:false,field:true,legend:false});
  assert.doesNotMatch(source,/id="v2-intel-switches"/);
  assert.match(css,/@media \(min-width: 851px\) and \(min-height: 501px\)\s*\{\s*\.v2-layout \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css,/\.v2-own\[hidden\], \.v2-target:has\(> #v2-intel:empty\) \{ display: none; \}/);
  assert.match(rule('.v2-layout .v2-intel-systems .v2-system-row'),/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(rule('.v2-layout .v2-intel-systems .v2-system-row :is(span, strong)'),/overflow-wrap: anywhere/);
  assert.match(rule('.v2-layout .v2-intel-stat > span'),/overflow-wrap: anywhere/);
});

test('target placement reserves the phase notice on the map and in the resized fallback',()=>{
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  let frame=rect(285,247,1302,637);
  let noticeBox=rect(824,362,224,88);
  let toolbarBox=rect(0,0,0,0), toolsBox=toolbarBox;
  let anchor={x:919,y:489};
  const notice={hidden:false,getBoundingClientRect:()=>noticeBox};
  let cardHeight=54;
  const card={style:{},dataset:{},getBoundingClientRect:()=>rect(0,0,157,cardHeight)};
  const nativeMap={createSVGPoint:()=>({matrixTransform(){return {x:this.x,y:this.y}}}),getScreenCTM:()=>null};
  const nodes={'#v2-map':{getBoundingClientRect:()=>frame},'#v2-phase-notice':notice,
    '#v2-area-controls':{getBoundingClientRect:()=>toolbarBox},'#v2-map-tools':{getBoundingClientRect:()=>toolsBox},
    '#v2-roster-panel':{hidden:true},'#v2-intel-panel':{hidden:true},'#v2-area-legend':{hidden:true}};
  const context={nativeMap,innerWidth:1902,innerHeight:984,hexCenter:(_x,y)=>({x:anchor.x,y:anchor.y+y*40}),
    at:selector=>nodes[selector]};
  runInNewContext(source.slice(source.indexOf('    function targetObstacles('),source.indexOf('    const COMMAND_ICONS')),context);
  const place=()=>context.placeNearHex(card,{x:0,y:0},[],[]);
  const top=()=>parseFloat(card.style.top);
  place();
  assert.equal(card.dataset.placement,'hex');
  assert.ok(top()>=noticeBox.bottom+8);

  const separate=obstacle=>{
    const left=parseFloat(card.style.left), height=parseFloat(card.style.maxHeight)||54;
    assert.ok(left+157<=obstacle.left-8 || left>=obstacle.right+8 ||
      top()+height<=obstacle.top-8 || top()>=obstacle.bottom+8);
  };
  context.innerWidth=1280;
  context.innerHeight=560;
  frame=rect(285,247,680,213);
  noticeBox=rect(500,319,250,100);
  toolbarBox=rect(295,257,294,54);
  toolsBox=rect(761,406,194,44);
  anchor={x:619,y:336};
  place();
  [toolbarBox,toolsBox,noticeBox].forEach(separate);
  const panels=[rect(296,319,200,85),rect(748,320,206,80),rect(296,416,290,34)];
  for(const [id,box] of [['#v2-roster-panel',panels[0]],['#v2-intel-panel',panels[1]],['#v2-area-legend',panels[2]]])
    Object.assign(nodes[id],{hidden:false,getBoundingClientRect:()=>box});
  place();
  [toolbarBox,toolsBox,noticeBox,...panels].forEach(separate);
  notice.hidden=true;
  place();
  [toolbarBox,toolsBox,...panels].forEach(separate);
  for(const id of ['#v2-roster-panel','#v2-intel-panel','#v2-area-legend'])nodes[id].hidden=true;
  anchor={x:500,y:337};
  place();
  [toolbarBox,toolsBox].forEach(separate);

  // The selected Legacy fire card in the 1280×660 advisory layout used to run into the footer.
  context.innerHeight=660;
  frame=rect(13,276.171875,1254,283.78125);
  toolbarBox=rect(23,286,320,54);
  toolsBox=rect(1057,506,200,44);
  noticeBox=rect(515,327,250,120);
  notice.hidden=false;
  anchor={x:640,y:461};
  cardHeight=167;
  place();
  assert.notEqual(card.style.visibility,'hidden');
  assert.ok(top()>=frame.top+8 && top()+(parseFloat(card.style.maxHeight)||cardHeight)<=frame.bottom-8);

  context.innerWidth=200;
  frame=rect(0,0,200,190);
  toolbarBox=rect(0,0,0,0);
  toolsBox=toolbarBox;
  notice.hidden=false;
  noticeBox=rect(10,122,180,130);
  anchor={x:210,y:150};
  cardHeight=54;
  context.innerHeight=290;
  place();
  assert.equal(card.dataset.placement,'panel');
  assert.ok(top()+54<=noticeBox.top-8);

  noticeBox=rect(10,40,180,210);
  place();
  assert.equal(card.style.overflowY,'auto');
  assert.ok(top()>=noticeBox.bottom+8 || top()+parseFloat(card.style.maxHeight)<=noticeBox.top-8);

  notice.hidden=true;
  place();
  assert.equal(card.style.maxHeight,'');
  assert.equal(card.style.overflowY,'');
});

test('map instruction and target card coexist in the short desktop viewport', () => {
  const rect = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});
  const fixed = box => ({getBoundingClientRect: () => box});
  const floating = (width, height) => ({
    style: {}, dataset: {},
    getBoundingClientRect() {
      return rect(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0,
        parseFloat(this.style.maxWidth) || width, parseFloat(this.style.maxHeight) || height);
    }
  });
  const frame = rect(13, 80, 1254, 402);
  const training = floating(480, 122);
  const target = floating(300, 165);
  const controls = {
    '#v2-area-controls': fixed(rect(23, 90, 380, 54)),
    '#v2-map-tools': fixed(rect(1040, 428, 217, 44)),
    '#v2-phase': fixed(rect(1080, 90, 177, 30)),
    '#v2-phase-notice': fixed(rect(500, 152, 280, 94)),
    '#v2-roster-panel': fixed(rect(24, 153, 205, 230)),
    '#v2-intel-panel': fixed(rect(1026, 144, 230, 270)),
    '#v2-area-legend': fixed(rect(23, 424, 560, 48))
  };
  const nodes = {...controls, '#v2-map': fixed(frame), '#v2-training': training};
  const context = {
    at: selector => nodes[selector], innerWidth: 1280, innerHeight: 560,
    hexCenter: (x, y) => ({x: 630 + x * 40, y: 347 + y * 40}),
    nativeMap: {createSVGPoint: () => ({matrixTransform() { return this; }}), getScreenCTM: () => null}
  };
  runInNewContext(source.slice(source.indexOf('    function targetObstacles('), source.indexOf('    const COMMAND_ICONS')), context);
  context.placeMapCard(training);
  context.placeNearHex(target, {x: 0, y: 0}, [], []);
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const card of [training, target]) {
    const box = card.getBoundingClientRect();
    assert.notEqual(card.style.visibility, 'hidden');
    assert.ok(box.left >= frame.left && box.right <= frame.right && box.top >= frame.top && box.bottom <= frame.bottom);
    assert.ok(Object.values(controls).every(control => !overlaps(box, control.getBoundingClientRect())));
  }
  assert.equal(overlaps(training.getBoundingClientRect(), target.getBoundingClientRect()), false);
});
