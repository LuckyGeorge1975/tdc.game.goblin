// Optional localhost browser smoke: start the reference server and a dedicated
// Chromium/Edge profile with --remote-debugging-port=9223, then run this file.
import assert from 'node:assert/strict';

const targetUrl = process.env.REFERENCE_URL ?? 'http://127.0.0.1:4174/src/app/reference.html';
const cdpUrl = process.env.CDP_URL ?? 'http://127.0.0.1:9223';
const tabs = await (await fetch(`${cdpUrl}/json/list`)).json();
const tab = tabs.find((candidate) => candidate.url === targetUrl);
assert.ok(tab, `Reference tab ${targetUrl} not found`);

const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 1;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data);
  if (!response.id) return;
  const task = pending.get(response.id);
  if (!task) return;
  pending.delete(response.id);
  response.error ? task.reject(new Error(response.error.message)) : task.resolve(response.result);
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

try {
  await send('Page.reload', { ignoreCache: true });
  await evaluate(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const poll = () => document.querySelector('#roster .unit') ? resolve(true)
      : Date.now() > deadline ? reject(new Error('Reference UI did not render'))
      : setTimeout(poll, 50);
    poll();
  })`);
  const result = await evaluate(`(() => {
    const click = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Missing element: ' + selector);
      element.click();
    };
    const cell = (x, y) => click('[aria-label^="Feld ' + x + ', ' + y + '"]');
    const initial = document.querySelector('#phase').textContent;
    const initialCount = document.querySelector('#phase-count').textContent;
    click('#roster .unit');
    const selected = document.querySelector('#status').textContent;
    cell(3, 5);
    const moved = document.querySelector('[aria-label^="Feld 3, 5"]')?.getAttribute('aria-label');
    const movedCount = document.querySelector('#phase-count').textContent;
    const moveLogCount = document.querySelectorAll('#events li').length;
    click('[data-area="sight"]');
    click('[data-area="movement"]');
    const afterViewLogCount = document.querySelectorAll('#events li').length;
    click('#end-phase');
    const firePhase = document.querySelector('#phase').textContent;
    const fireCount = document.querySelector('#phase-count').textContent;
    const fireAreaSelected = document.querySelector('[data-area="fire"]').getAttribute('aria-pressed');
    cell(5, 4);
    click('#roster .unit:nth-child(2)');
    cell(5, 6);
    return { initial, initialCount, selected, moved, movedCount, moveLogCount, afterViewLogCount, firePhase, fireCount, fireAreaSelected, status: document.querySelector('#status').textContent, buttonDisabled: document.querySelector('#end-phase').disabled, events: document.querySelectorAll('#events li').length };
  })()`);
  assert.match(result.initial, /Player · movement phase/);
  assert.match(result.initialCount, /Bereit 2\/2/);
  assert.match(result.selected, /p-1 gewählt/);
  assert.match(result.moved, /p-1/);
  assert.match(result.movedCount, /Bereit 1\/2/);
  assert.equal(result.moveLogCount, 1);
  assert.equal(result.afterViewLogCount, 1);
  assert.match(result.firePhase, /Player · fire phase/);
  assert.match(result.fireCount, /Bereit 2\/2/);
  assert.equal(result.fireAreaSelected, 'true');
  assert.match(result.status, /Sieg: player/);
  assert.equal(result.buttonDisabled, true);
  assert.equal(result.events, 5);
  console.log('DEV-01 browser smoke passed:', result);
} finally {
  socket.close();
}
