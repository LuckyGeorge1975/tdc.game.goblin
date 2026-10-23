import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const flow=readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const rule=selector=>{
  const start=css.indexOf(selector+' {');assert.ok(start>=0,selector);
  return css.slice(start,css.indexOf('}',start)+1);
};
function node(tag='div'){
  return {tag,children:[],className:'',classList:{add(){}},setAttribute(){},
    append(...children){this.children.push(...children)}};
}
test('Options alone gets separate header, content scrollport and non-sticky footer',()=>{
  const start=flow.indexOf("        panel.classList.add('v2-options-panel');");
  const end=flow.indexOf('        panel.append(header, content, footer);',start)+
    '        panel.append(header, content, footer);'.length;
  assert.ok(start>0&&end>start);
  const panel=node(),classes=[];panel.classList.add=value=>classes.push(value);
  const context={panel,t:key=>key,heading:()=>node('h2'),paragraph:()=>node('p'),
    button:(text,onclick)=>({...node('button'),textContent:text,onclick}),actions:(...children)=>{const el=node();el.append(...children);return el},
    document:{createElement:node,createTextNode:text=>({text})},goBack(){},
    GoblinLanguage:{languages:['de','en','es','fr'],current:'fr'},
    GoblinUIV2:{gridVisible:false,targetsVisible:true,damageVisible:true}};
  vm.runInNewContext(flow.slice(start,end),context);
  assert.deepEqual(classes,['v2-options-panel']);
  assert.deepEqual(panel.children.map(el=>el.className),['v2-screen-header','v2-screen-main v2-options-main','v2-screen-footer']);
  const descendants=el=>el.children?.flatMap(child=>[child,...descendants(child)])||[];
  assert.deepEqual(descendants(panel.children[1]).filter(el=>el.tag==='input').map(el=>el.id),['v2-grid','v2-targets','v2-damage']);
  assert.equal(descendants(panel.children[2]).find(el=>el.tag==='button').id,'v2-options-back');
  assert.match(rule('.v2-screen-panel.v2-foundation.v2-options-panel'),/grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(rule('.v2-screen-panel.v2-foundation.v2-options-panel'),/overflow:\s*hidden/);
  assert.doesNotMatch(rule('.v2-screen-panel.v2-foundation.v2-options-panel'),/max-height|height:/);
  assert.match(rule('.v2-options-panel > .v2-options-main'),/min-height:\s*0/);
  assert.match(rule('.v2-options-panel > .v2-options-main'),/overflow-y:\s*auto/);
  assert.match(rule('.v2-options-panel > .v2-screen-footer'),/position:\s*static/);
});

test('screen transition and language rerender preserve the new Options content scroll',()=>{
  const main={scrollTop:108};
  const currentPanel={scrollTop:0,dataset:{screen:'options'},querySelector:selector=>selector==='.v2-options-main'?main:null};
  const scrollMemory=new Map();
  const context={currentPanel,scrollMemory,previous:'options',screen:'options',focus:false};
  const transition=flow.slice(flow.indexOf('      if (currentPanel) scrollMemory.set(previous, {'),flow.indexOf("      if (previous === 'play'"));
  const rerender=flow.slice(flow.indexOf('      if (!focus && currentPanel?.dataset.screen === screen) scrollMemory.set(screen, {'),flow.indexOf("      const panel = document.createElement('div'); panel.className = 'v2-screen-panel';"));
  const restore=flow.slice(flow.indexOf('      const savedScroll = scrollMemory.get(screen);'),flow.indexOf("      const controls = [...panel.querySelectorAll('button:not(:disabled), select, input')];"));
  for(const snapshot of [transition,rerender]){
    main.scrollTop=108;vm.runInNewContext(snapshot,context);
    assert.equal(scrollMemory.get('options').options,108);
    main.scrollTop=0;vm.runInNewContext(restore,{...context,panel:currentPanel});
    assert.equal(main.scrollTop,108);
  }
});

test('focus clearance and original checkbox-row/Back sizes remain available',()=>{
  assert.match(rule('.v2-options-panel > .v2-options-main'),/padding:\s*5px/);
  assert.match(rule('.v2-options-panel > .v2-options-main'),/scroll-padding:\s*5px/);
  assert.match(rule('.v2-setting-check'),/min-height:\s*56px/);
  assert.match(rule('.v2-foundation button'),/min-height:\s*44px/);
});
