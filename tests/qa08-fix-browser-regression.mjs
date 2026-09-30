// Targeted browser regression for QA-08 issues goblin-tne, goblin-xej and goblin-ege.
// Start the local server and a BrowserAct session on shell.html?qa=1, then pass its CDP URL.
import assert from 'node:assert/strict';

const url = process.argv[2];
if (!url?.startsWith('ws://127.0.0.1:')) throw new Error('Local BrowserAct CDP URL required');
const socket = new WebSocket(url);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0, sessionId;
let navigation = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), task = pending.get(message.id);
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
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function viewport(width, height, touch) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: touch ? 2 : 1, mobile: touch, screenWidth: width, screenHeight: height });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 2 });
  await new Promise(resolve => setTimeout(resolve, 100));
}
async function start(lang) {
  const run = ++navigation;
  await send('Page.navigate', { url: `http://127.0.0.1:4173/src/app/shell.html?qa=1&lang=${lang}&run=${run}` });
  for (let n = 0; n < 50; n++) {
    if (await js(`location.search.includes('run=${run}') && !!document.querySelector('#choose-mission')?.textContent && !!window.__GOBLIN_QA__`)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"), 'screen-game');
}
async function snapshot() { return js('window.__GOBLIN_QA__.snapshot()'); }
async function tap(selector) {
  const p = await js(`(() => { const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  assert.ok(p, `Missing touch target ${selector}`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

try {
  const targets = await send('Target.getTargets', {}, false);
  const target = targets.targetInfos.find(item => item.type === 'page' && item.url.includes('/src/app/shell.html?qa=1'));
  assert.ok(target, 'BrowserAct shell tab not found');
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');

  for (const [width, height] of [[844, 390], [320, 568]]) {
    await viewport(width, height, true);
    await start('fr');
    const bounds = await js(`(() => {
      for (const id of ['game-phase','game-ready','end-phase']) {
        const e = document.getElementById(id); e.textContent += ' ' + e.textContent;
      }
      const ids = ['game-phase','game-ready','end-phase'];
      const action = document.getElementById('end-phase').getBoundingClientRect();
      return { clipped:ids.filter(id => { const e=document.getElementById(id); return e.scrollWidth>e.clientWidth+2; }),
        scrollWidth:document.documentElement.scrollWidth, actionBottom:action.bottom,
        actionHeight:action.height, innerWidth, innerHeight };
    })()`);
    assert.deepEqual(bounds.clipped, [], JSON.stringify(bounds));
    assert.ok(bounds.scrollWidth <= width && bounds.actionBottom <= height && bounds.actionHeight >= 44, JSON.stringify(bounds));
    console.log('goblin-tne', `${width}x${height}`, JSON.stringify(bounds));
  }

  await viewport(1440, 900, false);
  for (const lang of ['de', 'en', 'es', 'fr']) {
    await start(lang);
    const access = await js(`(() => {
      const cell=document.querySelector('polygon[data-x][data-y]'), unit=document.querySelector('g[data-unit-id]');
      const info=e=>({ role:e?.getAttribute('role'), name:e?.getAttribute('aria-label'), tabindex:e?.getAttribute('tabindex') });
      return { map:info(document.querySelector('#battle-map')), cell:info(cell), unit:info(unit) };
    })()`);
    assert.equal(access.map.role, 'group');
    for (const target of [access.cell, access.unit]) {
      assert.equal(target.role, 'button'); assert.equal(target.tabindex, '0'); assert.ok(target.name);
    }
    console.log('goblin-xej labels', lang, JSON.stringify(access));
  }
  await start('de');
  const beforeKey = await snapshot();
  const focus = await js(`(() => {
    const unit=document.querySelector('g[data-unit-id="p-1"]'); unit.focus();
    return { id:document.activeElement?.dataset?.unitId, ring:!!document.querySelector('[data-keyboard-focus]') };
  })()`);
  assert.deepEqual(focus, { id: 'p-1', ring: true });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  const afterUnit = await snapshot();
  assert.equal(afterUnit.view.selectedUnitId, 'p-1');
  assert.deepEqual(afterUnit.state, beforeKey.state);
  assert.equal(afterUnit.commands.length, 0);
  const retained = await js("({ id:document.activeElement?.dataset?.unitId, ring:!!document.querySelector('[data-keyboard-focus]') })");
  assert.deepEqual(retained, { id: 'p-1', ring: true });
  await js("document.querySelector('polygon[data-x=\"2\"][data-y=\"4\"]').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  const afterCell = await snapshot();
  assert.equal(afterCell.view.pendingIntent?.type, 'Move');
  assert.deepEqual(afterCell.state, beforeKey.state);
  assert.equal(afterCell.commands.length, 0);
  assert.equal(await js("document.activeElement?.getAttribute('data-x')"), '2');
  console.log('goblin-xej keyboard', JSON.stringify({ selected:afterCell.view.selectedUnitId, pending:afterCell.view.pendingIntent?.type, commands:afterCell.commands.length }));

  await js("(() => { const s=document.querySelector('#terrain-set'); s.value='verdant'; s.dispatchEvent(new Event('change',{bubbles:true})); })()");
  const visual = await js("({cell:document.querySelector('[data-layer=picking] polygon[data-x][data-y]')?.getAttribute('aria-label'),unit:document.querySelector('g[data-unit-id]')?.getAttribute('aria-label')})");
  assert.ok(visual.cell && visual.unit, JSON.stringify(visual));
  assert.equal((await snapshot()).commands.length, 0);
  console.log('goblin-xej visual map', JSON.stringify(visual));

  await viewport(390, 844, true);
  await start('de');
  const beforePinch = await snapshot();
  const map = await js("(() => { const r=document.querySelector('#map-viewport').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()");
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{x:map.x-25,y:map.y},{x:map.x+25,y:map.y}] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x:map.x-75,y:map.y},{x:map.x+75,y:map.y}] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const afterPinch = await snapshot();
  assert.ok(afterPinch.view.mapZoom > beforePinch.view.mapZoom, JSON.stringify(afterPinch.view));
  assert.deepEqual(afterPinch.state, beforePinch.state);
  assert.equal(afterPinch.commands.length, 0);
  console.log('goblin-ege', JSON.stringify({ from:beforePinch.view.mapZoom, to:afterPinch.view.mapZoom, pan:afterPinch.view.mapPan }));
  await tap('#recenter');
  await tap('g[data-unit-id="p-1"]');
  await tap('polygon[data-x="2"][data-y="4"]');
  const afterTouch = await snapshot();
  assert.equal(afterTouch.view.pendingIntent?.type, 'Move');
  assert.deepEqual(afterTouch.state, beforePinch.state);
  assert.equal(afterTouch.commands.length, 0);
  console.log('goblin-ege picking after pinch', JSON.stringify({ selected:afterTouch.view.selectedUnitId, pending:afterTouch.view.pendingIntent?.type, commands:afterTouch.commands.length }));
} finally {
  if (sessionId) await send('Target.detachFromTarget', { sessionId }, false).catch(() => {});
  socket.close();
}
