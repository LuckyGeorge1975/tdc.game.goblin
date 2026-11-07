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
