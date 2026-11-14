import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

test('Core readiness reuses stable selections and refreshes on native ownership changes', () => {
  const source = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
  const start = source.indexOf('    let coreReadiness;');
  const end = source.indexOf('    // Own units that can still act', start);
  assert.ok(start >= 0 && end > start);
  let queries = 0;
  let available = true;
  const host = {session:{}, epoch:1, queryReady:true, query() {
    queries++;
    return {available};
  }};
  const context = {IronDustBrowserV2:host, unitAlive:() => true};
  runInNewContext(source.slice(start, end), context);
  const view = () => ({mode:'player', phase:'movement', cells:[{x:1,y:1}],
    units:[{id:'gev',team:'player'}]});
  const ready = () => context.coreOpenUnits(view()).length;
  assert.equal(ready(), 1);
  assert.equal(ready(), 1);
  assert.equal(queries, 1);
  host.queryReady = false;
  assert.equal(ready(), 0);
  host.queryReady = true;
  assert.equal(ready(), 1);
  assert.equal(queries, 1);
  for (const next of ['command', 'phase']) {
    available = !available;
    host.session = {next};
    assert.equal(ready(), Number(available));
  }
  host.epoch++;
  assert.equal(ready(), 1);
  context.IronDustBrowserV2 = {...host};
  assert.equal(ready(), 1);
  assert.equal(queries, 5);
});
