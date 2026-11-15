import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all three FULL routes deliver a native port before opening the human projection', async () => {
  const game = await fullScene('catalog-full-atlas', 7, false, 'FULL_CATALOG_v1');
  for (const file of ['level-events.js', 'editor-draft.js']) game.run(source(file));
  game.context.levels = JSON.parse(source('assets/unit-art/levels/scorched-earth.v3.json'));
  game.context.importText = source('tests/fixtures/full-draft-core-deadline.v3.json');
  await game.run('Promise.all([GoblinEditorDraft.prepare(levels[0]), GoblinEditorDraft.prepare(GoblinEditorDraft.importLevels(importText)[0])]).then(result => globalThis.drafts = result)');

  let prior;
  for (const start of ['loadScenario("catalog-full-atlas",control)',
    'loadEditorDraft(drafts[0],control)', 'loadEditorDraft(drafts[1],control)']) {
    let handoff, takeover;
    game.context.control = {roles:{player:'human',enemy:'human'},ui:{
      handoff(seat, takeSeat) { handoff = seat; takeover = takeSeat; }
    }};
    const port = game.run(start);
    assert.equal(handoff.sessionId, port.state().sessionId);
    assert.equal(handoff.side, 'player');
    assert.equal(port.project('human'), null);
    assert.equal(port.open('human'), null);
    if (prior) assert.equal(prior.state(), null);
    assert.equal(takeover(), true);
    assert.equal(takeover(), false);
    assert.equal(port.project('human').view.side, 'player');
    assert.ok(port.open('human').permit);
    prior = port;
  }
});
