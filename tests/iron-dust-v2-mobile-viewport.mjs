// Use an already approved local BrowserAct session with IRON DUST v2 selected.
// Pass that session's local CDP WebSocket URL; this script opens no browser session.
import assert from 'node:assert/strict';

const cdp = process.argv[2];
if (!cdp?.startsWith('ws://127.0.0.1:'))
  throw new Error('Pass the approved local BrowserAct CDP WebSocket URL');
const socket = new WebSocket(cdp);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, {once:true});
  socket.addEventListener('error', reject, {once:true});
});
let serial = 0, sessionId;
const pending = new Map();
socket.addEventListener('message', ({data}) => {
  const message = JSON.parse(data), task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result);
});
function send(method, params = {}, attached = true) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params,
      ...(attached && sessionId ? {sessionId} : {})}));
  });
}
async function js(expression) {
  const response = await send('Runtime.evaluate',
    {expression, returnByValue:true, awaitPromise:true});
  if (response.exceptionDetails) throw Error(response.exceptionDetails.text);
  return response.result.value;
}
try {
  const targets = await send('Target.getTargets', {}, false);
  const page = targets.targetInfos.find(target => target.type === 'page' &&
    /^http:\/\/(localhost|127\.0\.0\.1):4173\/(?:\?|$)/.test(target.url));
  assert.ok(page, 'open the approved local v2 test page first');
  sessionId = (await send('Target.attachToTarget',
    {targetId:page.targetId, flatten:true}, false)).sessionId;
  await send('Runtime.enable');
  assert.equal(await js('globalThis.IronDustBrowserV2?.mode'), 'ready',
    'select IRON DUST v2 in the approved session before running this check');
  const original = await js('JSON.stringify(IronDustBrowserV2.session.projection)');
  async function assertMobileView(expected) {
    const tabs = await js(`(() => {
      const names = ['map', 'force', 'intel'];
      return {view:document.documentElement.dataset.mobileView,
        pressed:Object.fromEntries(names.map(name => [name,
          document.querySelector('button[data-mobile-view=' + name + ']')
            .getAttribute('aria-pressed')])),
        visible:Object.fromEntries(names.map(name => {
          const panel = document.querySelector('.game-layout > [data-mobile-panel=' + name + ']');
          return [name, getComputedStyle(panel).display !== 'none' &&
            panel.getClientRects().length > 0];
        }))};
    })()`);
    assert.equal(tabs.view, expected, JSON.stringify(tabs));
    for (const name of ['map', 'force', 'intel']) {
      assert.equal(tabs.pressed[name], String(name === expected), JSON.stringify(tabs));
      assert.equal(tabs.visible[name], name === expected, JSON.stringify(tabs));
    }
  }
  for (const [width, height] of [[390, 844], [320, 568]]) {
    await send('Emulation.setDeviceMetricsOverride',
      {width, height, screenWidth:width, screenHeight:height,
        deviceScaleFactor:2, mobile:true});
    await send('Emulation.setTouchEmulationEnabled',
      {enabled:true, maxTouchPoints:2});
    await new Promise(resolve => setTimeout(resolve, 100));
    const state = await js(`({width:innerWidth,height:innerHeight,
      mobile:matchMedia('(max-width:760px)').matches,
      coarse:matchMedia('(pointer:coarse)').matches,
      touchPoints:navigator.maxTouchPoints,
      nav:getComputedStyle(document.querySelector('.mobile-views')).display,
      view:document.documentElement.dataset.mobileView,
      units:document.querySelectorAll('#battlefield-map .unit-svg').length,
      roster:document.querySelectorAll('#unit-roster .unit-card').length,
      scrollWidth:document.documentElement.scrollWidth})`);
    assert.equal(state.width, width, JSON.stringify(state));
    assert.equal(state.height, height, JSON.stringify(state));
    assert.equal(state.mobile, true, JSON.stringify(state));
    assert.equal(state.coarse, true, JSON.stringify(state));
    assert.ok(state.touchPoints > 0, JSON.stringify(state));
    assert.notEqual(state.nav, 'none', JSON.stringify(state));
    assert.ok(state.scrollWidth <= width,
      `horizontal overflow at ${width}x${height}: ${JSON.stringify(state)}`);
    assert.equal(state.units, 7);
    assert.equal(state.roster, 4);
    await js("GoblinMobileViews.show('map')");
    await assertMobileView('map');
    await js("document.querySelector('button[data-mobile-view=force]').click()");
    await assertMobileView('force');
    await js("document.querySelector('button[data-mobile-view=intel]').click()");
    await assertMobileView('intel');
    await js("document.querySelector('button[data-mobile-view=map]').click()");
    await assertMobileView('map');
    assert.equal(await js('JSON.stringify(IronDustBrowserV2.session.projection)'), original);
    console.log(`${width}x${height}: ${JSON.stringify(state)}`);
  }
} finally {
  if (sessionId) {
    await send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await send('Emulation.setTouchEmulationEnabled',
      {enabled:false, maxTouchPoints:1}).catch(() => {});
    await send('Target.detachFromTarget', {sessionId}, false).catch(() => {});
  }
  socket.close();
}
