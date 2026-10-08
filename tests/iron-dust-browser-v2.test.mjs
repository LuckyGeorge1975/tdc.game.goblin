import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIronDustBrowserSession, IRON_DUST_V2_SELECTOR_ID,
  IRON_DUST_V2_START_SEED
} from '../iron-dust-browser-v2.mjs';
import {createIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';

test('v2 browser session has a fixed validated identity and rejects a changed header', () => {
  const session = createIronDustBrowserSession();
  assert.equal(IRON_DUST_V2_SELECTOR_ID, 'iron-dust-v2');
  assert.equal(session.profile.header.ruleProfileId, 'CORE_IRON_DUST_v2');
  assert.equal(session.projection.state.rng.seed, IRON_DUST_V2_START_SEED);
  assert.equal(session.projection.mode, 'player');
  assert.equal(session.projection.state.phase, 'movement');
  assert.throws(() => createIronDustBrowserSession({
    ...session.profile,
    header: {...session.profile.header, ruleProfileId: 'FIELD_TEST_LEGACY_v1'}
  }), /IRON_DUST_PROFILE_MISMATCH/);
  assert.throws(() => createIronDustBrowserSession(createIronDustProfile(IRON_DUST_V2_START_SEED + 1)),
    /IRON_DUST_V2_START_INVALID/);
});

test('public host keeps the unfinished v2 option disabled', async () => {
  const option = {disabled:true};
  const previous = {document:globalThis.document,location:globalThis.location,
    bridge:globalThis.IronDustBrowserV2};
  globalThis.document = {querySelector:() => option};
  globalThis.location = {hostname:'example.com',search:'?iron-dust-v2-test=1'};
  try {
    await import('../iron-dust-browser-v2.mjs?public-gate=1');
    assert.equal(option.disabled,true);
    assert.equal(globalThis.IronDustBrowserV2.available,false);
    assert.equal(globalThis.IronDustBrowserV2.start(),false);
    assert.equal(globalThis.IronDustBrowserV2.active,false);
  } finally {
    globalThis.document = previous.document;
    globalThis.location = previous.location;
    globalThis.IronDustBrowserV2 = previous.bridge;
  }
});

test('local test path gates the board, can restart, and locks a failed v2 start', async () => {
  const nodes = new Map();
  const classes = new Set();
  const element = () => ({disabled:false, value:'', textContent:'', dataset:{}, style:{},
    classList:{add(name){classes.add(name)}, remove(name){classes.delete(name)},
      contains(name){return classes.has(name)}},
    removeAttribute(name){delete this.dataset[name]}});
  const document = {
    body: element(),
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector, element());return nodes.get(selector)},
    querySelectorAll(){return [element(),element()]}
  };
  const previous = {document:globalThis.document,location:globalThis.location,
    bridge:globalThis.IronDustBrowserV2};
  globalThis.document = document;
  globalThis.location = {hostname:'localhost',search:'?iron-dust-v2-test=1'};
  globalThis.selected = null;
  globalThis.focusedCell = null;
  globalThis.phase = 'player';
  globalThis.turnPhase = 'movement';
  globalThis.gameOver = false;
  globalThis.currentScenario = 'iron-dust';
  try {
    await import('../iron-dust-browser-v2.mjs?browser-test=1');
    const bridge = globalThis.IronDustBrowserV2;
    assert.equal(bridge.available,true);
    assert.equal(document.querySelector('#scenario-select option[value="iron-dust-v2"]').disabled,false);
    assert.equal(bridge.start(),true);
    assert.equal(bridge.mode,'ready');
    assert.equal(globalThis.currentScenario,'iron-dust-v2');
    assert.equal(globalThis.gameOver,true);
    assert.equal(document.body.classList.contains('iron-dust-v2-gated'),true);
    const first = bridge.session.profile;
    assert.equal(bridge.restart(),true);
    assert.notEqual(bridge.session.profile,first);
    assert.equal(bridge.session.profile.digest,first.digest);
    assert.equal(bridge.start({...first, header:{...first.header, ruleProfileId:'BAD'}}),false);
    assert.equal(bridge.mode,'error');
    assert.equal(bridge.session,null);
    assert.match(document.querySelector('#mission-sub').textContent,/V2-Start gesperrt/);
    assert.equal(document.body.classList.contains('iron-dust-v2-gated'),true);
    bridge.stop();
    assert.equal(bridge.active,false);
    assert.equal(document.body.classList.contains('iron-dust-v2-gated'),false);
  } finally {
    globalThis.document = previous.document;
    globalThis.location = previous.location;
    globalThis.IronDustBrowserV2 = previous.bridge;
    delete globalThis.selected;
    delete globalThis.focusedCell;
    delete globalThis.phase;
    delete globalThis.turnPhase;
    delete globalThis.gameOver;
    delete globalThis.currentScenario;
  }
});
