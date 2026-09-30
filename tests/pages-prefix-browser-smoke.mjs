// BrowserAct CDP smoke for the static GitHub Pages project prefix.
// Run tests/pages-prefix-server.mjs and open the printed shell URL in a BrowserAct session.
// Then: node tests/pages-prefix-browser-smoke.mjs <browser-act get cdp-url>
import assert from 'node:assert/strict';

const url = process.argv[2];
if (!url?.startsWith('ws://127.0.0.1:')) throw new Error('Local BrowserAct CDP URL required');
const socket = new WebSocket(url);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0, sessionId, navigation = 0;
const pending = new Map(), failures = [], requests = new Set();
const origin = 'http://127.0.0.1:4174';
const prefix = '/tdc.game.goblin/';
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Network.requestWillBeSent' && message.sessionId === sessionId) {
    const request = message.params.request.url;
    if (request.startsWith(origin)) {
      requests.add(request);
      if (!new URL(request).pathname.startsWith(prefix)) failures.push(`outside prefix: ${request}`);
    }
  }
  if (message.method === 'Network.responseReceived' && message.sessionId === sessionId && message.params.response.status >= 400) {
    failures.push(`HTTP ${message.params.response.status}: ${message.params.response.url}`);
  }
  if (message.method === 'Runtime.exceptionThrown' && message.sessionId === sessionId) {
    failures.push(`JavaScript: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
  }
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(new Error(`${task.method}: ${message.error.message}`)) : task.resolve(message.result);
});
function send(method, params = {}, attach = true) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params, ...(attach && sessionId ? { sessionId } : {}) }));
  });
}
async function js(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function page(lang) {
  const run = ++navigation;
  await send('Page.navigate', { url: `${origin}${prefix}src/app/shell.html?qa=1&lang=${lang}&run=${run}` });
  let ready = false;
  for (let n = 0; n < 60; n++) {
    ready = await js(`location.search.includes('run=${run}') && !!window.__GOBLIN_QA__ && !!document.querySelector('#choose-mission')?.textContent`);
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `${lang} did not load: ${failures.join('; ')}`);
  assert.equal(await js('document.documentElement.lang'), lang);
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"), 'screen-start');
  await js("document.querySelector('#choose-mission').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"), 'screen-levels');
  await js("document.querySelector('#mission-list button:first-child').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"), 'screen-briefing');
  await js("document.querySelector('#begin-mission').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"), 'screen-game');
  const info = await js("({title:document.title,lang:document.documentElement.lang,mission:document.querySelector('#game-mission').textContent,style:window.__GOBLIN_QA__.snapshot().view.styleSetId,options:[...document.querySelector('#terrain-set').options].map(o=>o.value)})");
  assert.ok(info.mission && info.title);
  assert.deepEqual(info.options, ['hex', 'verdant', 'dryland', 'natural', 'field-atlas']);
  return info;
}

try {
  const targets = await send('Target.getTargets', {}, false);
  const target = targets.targetInfos.find(item => item.type === 'page' && item.url.includes(`${prefix}src/app/shell.html`));
  assert.ok(target, 'BrowserAct prefix tab not found');
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  for (const lang of ['de', 'en', 'es', 'fr']) console.log('locale', JSON.stringify(await page(lang)));

  await page('de');
  for (const style of ['verdant', 'dryland', 'natural', 'field-atlas']) {
    const result = await js(`(() => {
      const select=document.querySelector('#terrain-set'); select.value=${JSON.stringify(style)};
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return {value:select.value,view:window.__GOBLIN_QA__.snapshot().view.styleSetId,
        ground:!!document.querySelector('[data-layer=ground]'),
        picking:!!document.querySelector('[data-layer=picking] polygon[data-x][data-y]'),
        assets:[...document.querySelectorAll('image[data-detail-layer]')].map(e=>e.getAttribute('href'))};
    })()`);
    assert.equal(result.value, style);
    assert.equal(result.view, style);
    assert.ok(result.ground && result.picking, JSON.stringify(result));
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('style', JSON.stringify(result));
  }

  const before = await js('window.__GOBLIN_QA__.snapshot()');
  await js("document.querySelector('g[data-unit-id=\"p-1\"]').dispatchEvent(new MouseEvent('click',{bubbles:true})); document.querySelector('polygon[data-x=\"2\"][data-y=\"4\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  const preview = await js('window.__GOBLIN_QA__.snapshot()');
  assert.equal(preview.view.pendingIntent?.type, 'Move');
  assert.deepEqual(preview.state, before.state);
  assert.equal(preview.commands.length, 0);
  await js("document.querySelector('#confirm-intent').click()");
  const after = await js('window.__GOBLIN_QA__.snapshot()');
  assert.equal(after.commands.length, 1);
  assert.equal(after.commands[0].command.type, 'Move');
  assert.notDeepEqual(after.state, before.state);
  console.log('command', JSON.stringify({preview:preview.view.pendingIntent.type, confirmed:after.commands[0].command.type, count:after.commands.length}));

  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(failures, [], failures.join('\n'));
  console.log('network', JSON.stringify({requests:requests.size, failures:failures.length, prefix}));
} finally {
  if (sessionId) await send('Target.detachFromTarget', { sessionId }, false).catch(() => {});
  socket.close();
}
