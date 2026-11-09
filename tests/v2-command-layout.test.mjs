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

test('target placement reserves the phase notice on the map and in the resized fallback',()=>{
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  let frame=rect(285,247,1302,637);
  let noticeBox=rect(824,362,224,88);
  let anchor={x:919,y:489};
  const notice={hidden:false,getBoundingClientRect:()=>noticeBox};
  const card={style:{},dataset:{},getBoundingClientRect:()=>rect(0,0,157,54)};
  const nativeMap={createSVGPoint:()=>({matrixTransform(){return {x:this.x,y:this.y}}}),getScreenCTM:()=>null};
  const context={nativeMap,innerHeight:984,hexCenter:(_x,y)=>({x:anchor.x,y:anchor.y+y*40}),
    at:selector=>selector==='#v2-map'?{getBoundingClientRect:()=>frame}:notice};
  runInNewContext(source.slice(source.indexOf('    function placeNearHex('),source.indexOf('    const COMMAND_ICONS')),context);
  const place=()=>context.placeNearHex(card,{x:0,y:0},[],[]);
  const top=()=>parseFloat(card.style.top);
  place();
  assert.equal(card.dataset.placement,'hex');
  assert.ok(top()>=noticeBox.bottom+8);

  frame=rect(300,115,200,75);
  noticeBox=rect(310,122,180,130);
  anchor={x:400,y:150};
  context.innerHeight=290;
  place();
  assert.equal(card.dataset.placement,'panel');
  assert.ok(top()+54<=noticeBox.top-8);

  noticeBox=rect(310,40,180,210);
  place();
  assert.equal(card.style.overflowY,'auto');
  assert.ok(top()>=noticeBox.bottom+8 || top()+parseFloat(card.style.maxHeight)<=noticeBox.top-8);

  notice.hidden=true;
  place();
  assert.equal(card.style.maxHeight,'');
  assert.equal(card.style.overflowY,'');
});
