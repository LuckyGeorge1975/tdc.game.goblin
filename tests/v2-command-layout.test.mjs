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

test('command head and actions share one scroll ancestor while footer remains outside it',()=>{
  const markup=source.match(/<section class="v2-card v2-command-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(markup);
  const parents=new Map(),stack=[];
  for(const tag of markup.matchAll(/<(\/)?(section|div|span|p)\b([^>]*)>/g)){
    if(tag[1]){stack.pop();continue;}
    const id=tag[3].match(/\bid="([^"]+)"/)?.[1];
    const node={id,parent:stack.at(-1)};
    if(id)parents.set(id,node);
    stack.push(node);
  }
  const card=parents.get('v2-command-card'),body=parents.get('v2-command-body');
  assert.equal(body.parent,card);
  assert.equal(parents.get('v2-command-target').parent.parent,body);
  assert.equal(parents.get('v2-command-weapons').parent.parent,body);
  assert.equal(parents.get('v2-actions').parent,body);
  assert.equal(parents.get('v2-command-footer').parent,card);
  assert.match(rule('.v2-command-body'),/min-height:\s*0/);
  assert.match(rule('.v2-command-body'),/overflow-y:\s*auto/);
  assert.doesNotMatch(rule('.v2-actions'),/overflow|min-height:\s*0/);
  assert.match(rule('.v2-command-card'),/grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/);
  assert.match(rule('.v2-actions button'),/min-height:\s*48px/);
});

test('Tab loop still includes enabled weapon, action and footer buttons across the wrapper',()=>{
  const start=source.indexOf("    at('#v2-command-card').addEventListener('keydown', event => {");
  const end=source.indexOf("    document.addEventListener('click'",start);
  assert.ok(start>=0&&end>start);
  let keydown;
  const document={activeElement:null},order=[];
  const buttons=['weapon','fire','fit','cancel','pause'].map(name=>({
    focus(){document.activeElement=this;order.push(name)}
  }));
  const context={document,at:()=>({addEventListener(type,handler){assert.equal(type,'keydown');keydown=handler},
    querySelectorAll(selector){assert.equal(selector,'button:not(:disabled)');return buttons}})};
  runInNewContext(source.slice(start,end),context);
  let prevented=0;
  const event=shiftKey=>({key:'Tab',shiftKey,preventDefault(){prevented++}});
  document.activeElement=buttons.at(-1);keydown(event(false));
  assert.equal(document.activeElement,buttons[0]);
  keydown(event(true));
  assert.equal(document.activeElement,buttons.at(-1));
  document.activeElement=buttons[1];keydown(event(false));
  assert.equal(prevented,2);
  assert.deepEqual(order,['weapon','pause']);
});
