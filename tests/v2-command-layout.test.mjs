import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
const rule=selector=>{
  const start=css.indexOf(`${selector} {`);
  assert.ok(start>=0,selector);
  return css.slice(start,css.indexOf('}',start)+1);
};

test('action menu stacks label chip, scrollable option rows and one icon bar with actions and info/cancel',()=>{
  const markup=source.match(/<section class="v2-card v2-command-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(markup);
  const parents=new Map(),stack=[];
  for(const tag of markup.matchAll(/<(\/)?(section|div|span|p|strong)\b([^>]*)>/g)){
    if(tag[1]){stack.pop();continue;}
    const id=tag[3].match(/\bid="([^"]+)"/)?.[1],className=tag[3].match(/\bclass="([^"]+)"/)?.[1];
    const node={id,className,parent:stack.at(-1)};
    if(id)parents.set(id,node);
    stack.push(node);
  }
  const card=parents.get('v2-command-card'),body=parents.get('v2-command-body');
  assert.match(markup,/role="group"/);
  assert.doesNotMatch(markup,/aria-modal/);
  assert.equal(parents.get('v2-command-target').parent.className,'v2-command-hint');
  assert.equal(parents.get('v2-command-intel').parent,parents.get('v2-command-target').parent);
  assert.equal(body.parent,card);
  assert.equal(parents.get('v2-command-weapons').parent,body);
  assert.equal(parents.get('v2-actions').parent.className,'v2-command-bar');
  assert.equal(parents.get('v2-command-footer').parent,parents.get('v2-actions').parent);
  assert.equal(parents.get('v2-actions').parent.parent,card);
  assert.match(rule('.v2-command-body'),/min-height:\s*0/);
  assert.match(rule('.v2-command-body'),/overflow-y:\s*auto/);
  assert.match(rule('.v2-actions'),/display:\s*flex/);
  assert.doesNotMatch(rule('.v2-actions'),/overflow/);
  assert.match(rule('.v2-actions button, .v2-command-footer button'),/min-height:\s*48px/);
});

test('action menu is not modal: no focus trap, map clicks retarget and the bar follows the selected unit',()=>{
  assert.equal(source.includes("at('#v2-command-card').addEventListener('keydown'"),false);
  assert.match(source,/if \(performance\.now\(\) < suppressTapUntil\) return;/);
  const position=source.slice(source.indexOf('    function positionCommandMenu(state) {'),source.indexOf('    const COMMAND_ICONS'));
  assert.match(position,/if \(card\.hidden \|\| !view\.actorId\) return;/);
  assert.match(position,/pointer:'down'/);
  assert.match(source,/function syncLayout\(\) \{\n      if \(view\.target && view\.pendingAction\) render\(\);\n      else if \(view\.actorId\) positionCommandMenu/);
});
