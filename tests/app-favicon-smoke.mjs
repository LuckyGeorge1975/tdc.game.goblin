// Optional CDP smoke: observe favicon requests in a dedicated Edge/Chromium
// profile while the local comparison server is running.
import assert from 'node:assert/strict';

const url = process.env.COMPARE_URL ?? 'http://127.0.0.1:4174/src/app/compare.html';
const cdp = process.env.CDP_URL ?? 'http://127.0.0.1:9225';
const tabs = await (await fetch(`${cdp}/json/list`)).json();
const tab = tabs.find((candidate) => candidate.url === url);
assert.ok(tab, `Compare tab ${url} not found`);
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const faviconResponses = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Network.responseReceived' && /favicon\.(ico|svg)(?:\?|$)/.test(message.params.response.url)) {
    faviconResponses.push({ url: message.params.response.url, status: message.params.response.status });
  }
  if (!message.id) return;
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};

try {
  await send('Network.enable');
  await send('Page.reload', { ignoreCache: true });
  await evaluate(`new Promise((resolve, reject) => {
    const until = Date.now() + 7000;
    const poll = () => document.querySelector('#game-frame')?.contentDocument?.querySelector('#phase')
      ? resolve(true) : Date.now() > until ? reject(new Error('Core path not ready')) : setTimeout(poll, 50);
    poll();
  })`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(faviconResponses.some((item) => item.url.endsWith('/src/app/favicon.svg') && item.status === 200));
  assert.ok(!faviconResponses.some((item) => item.status === 404), `Favicon 404: ${JSON.stringify(faviconResponses)}`);
  console.log('DEV-05 favicon smoke passed:', faviconResponses);
} finally {
  socket.close();
}
