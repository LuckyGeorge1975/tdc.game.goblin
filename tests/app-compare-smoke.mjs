// Optional browser smoke: node tests/app-local-server.mjs; open a dedicated
// Edge/Chromium CDP tab at /src/app/compare.html; node this file.
import assert from 'node:assert/strict';

const targetUrl = process.env.COMPARE_URL ?? 'http://127.0.0.1:4174/src/app/compare.html';
const tabs = await (await fetch(`${process.env.CDP_URL ?? 'http://127.0.0.1:9223'}/json/list`)).json();
const expected = new URL(targetUrl);
const tab = tabs.find((candidate) => { try { const url = new URL(candidate.url); return url.origin === expected.origin && url.pathname === expected.pathname; } catch { return false; } });
assert.ok(tab, `Comparison tab ${targetUrl} not found`);
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let id = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data);
  if (!response.id) return;
  const task = pending.get(response.id);
  if (!task) return;
  pending.delete(response.id);
  response.error ? task.reject(new Error(response.error.message)) : task.resolve(response.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  socket.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};

try {
  await send('Page.navigate', { url: targetUrl });
  const result = await evaluate(`(async () => {
    const waitFor = (predicate) => new Promise((resolve, reject) => {
      const until = Date.now() + 12000;
      const poll = () => predicate() ? resolve(true) : Date.now() > until
        ? reject(new Error('Game path did not load')) : setTimeout(poll, 75);
      poll();
    });
    const frame = document.getElementById('game-frame');
    await waitFor(() => frame?.contentDocument?.querySelector('#phase')?.textContent?.includes('movement'));
    const core = { path: document.getElementById('path-select').value, phase: frame.contentDocument.querySelector('#phase').textContent };
    const select = document.getElementById('path-select');
    select.value = 'legacy';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => frame.contentDocument?.querySelector('#end-turn'));
    const legacy = { path: select.value, title: frame.contentDocument.title, button: frame.contentDocument.querySelector('#end-turn').textContent, url: frame.contentWindow.location.pathname };
    select.value = 'core';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => frame.contentDocument?.querySelector('#phase')?.textContent?.includes('movement'));
    const returnedCore = { path: select.value, phase: frame.contentDocument.querySelector('#phase').textContent };
    select.value = 'phase';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => frame.contentDocument?.querySelector('#scenario')?.textContent?.includes('ARCH-02'));
    const harness = frame.contentWindow.__goblinHarness;
    const phase = { path: select.value, version: harness.snapshot().state.scenarioVersion, seed: harness.snapshot().state.rng.seed, commands: harness.fixtureCommands().length };
    harness.dispatch(harness.fixtureCommands()[0]);
    phase.trace = harness.trace().map(({ result }) => result.error?.code ?? result.events?.[0]?.type);
    select.value = 'core';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => frame.contentDocument?.querySelector('#scenario')?.textContent?.includes('ARCH-01'));
    const game = frame.contentDocument;
    const click = (selector) => {
      const element = game.querySelector(selector);
      if (!element) throw new Error('Missing game element: ' + selector);
      element.click();
    };
    const cell = (x, y) => click('[aria-label^="Feld ' + x + ', ' + y + '"]');
    click('#roster .unit');
    cell(3, 5);
    click('#end-phase');
    cell(5, 4);
    click('#roster .unit:nth-child(2)');
    cell(5, 6);
    return { core, legacy, returnedCore, phase, victory: game.querySelector('#status').textContent, selectorUrl: location.search };
  })()`);
  assert.equal(result.core.path, 'core');
  assert.match(result.core.phase, /movement phase/);
  assert.equal(result.legacy.path, 'legacy');
  assert.match(result.legacy.url, /\/index\.html$/);
  assert.match(result.legacy.button, /END TURN|NEXT/i);
  assert.equal(result.returnedCore.path, 'core');
  assert.match(result.returnedCore.phase, /movement phase/);
  assert.deepEqual(result.phase, { path: 'phase', version: 'phase-v2', seed: 5, commands: 16, trace: ['UnitMoved'] });
  assert.match(result.victory, /Sieg: player/);
  assert.match(result.selectorUrl, /path=core/);
  console.log('DEV-03 local path comparison passed:', result);
} finally {
  socket.close();
}
