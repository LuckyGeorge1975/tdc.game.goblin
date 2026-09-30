// Manual locale/layout audit. Open the local shell in a BrowserAct session, then
// pass that session's `browser-act get cdp-url` result as argv[2].
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const url = process.argv[2];
if (!url?.startsWith('ws://127.0.0.1:')) throw new Error('Pass the local BrowserAct CDP URL');
const socket = new WebSocket(url);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0, sessionId;
const pending = new Map();
const catalogs = Object.fromEntries(await Promise.all(['de', 'en', 'es', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../assets/ui-copy/content-02.${lang}.json`, import.meta.url))).messages])));
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(new Error(`${task.method}: ${message.error.message}`)) : task.resolve(message.result);
});
function send(method, params = {}, inSession = true) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params, ...(inSession && sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function ready() {
  for (let i = 0; i < 50; i++) {
    if (await evaluate("!!document.querySelector('#choose-mission')?.textContent && !!window.__GOBLIN_QA__")) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Shell did not become ready');
}
async function measure() {
  return evaluate(`(() => {
    const visible = selector => { const el = document.querySelector(selector); return !!el && !!el.getClientRects().length; };
    const text = selector => document.querySelector(selector)?.textContent?.trim();
    const code = text('#start-title')?.startsWith('ui.') || text('#game-ready')?.startsWith('ui.');
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, route: [...document.querySelectorAll('.screen')].find(el => !el.hidden)?.id,
      code, title: document.title, eyebrow: text('#start-eyebrow'), subtitle: text('#start-subtitle'),
      mission: text('#game-mission'), phase: text('#game-phase'), ready: text('#game-ready'),
      briefing: text('#briefing-copy'), help: text('#help-copy'), settingsNote: text('#settings-note'),
      mapAria: document.querySelector('#battle-map')?.getAttribute('aria-label'),
      zoomAria: document.querySelector('#zoom-in')?.getAttribute('aria-label'),
      pauseVisible: visible('#pause'), actionVisible: visible('#end-phase') };
  })()`);
}

try {
  const targets = await send('Target.getTargets', {}, false);
  const target = targets.targetInfos.find(item => item.type === 'page' && item.url.includes('/src/app/shell.html?qa=1'));
  assert.ok(target, 'BrowserAct shell QA tab not found');
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');
  const sizes = [['PC', 1440, 900], ['Tablet', 768, 1024], ['Mobile', 390, 844], ['Mobile narrow', 320, 568], ['Mobile landscape', 844, 390]];
  for (const lang of ['de', 'en', 'es', 'fr']) {
    for (const [name, width, height] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900, screenWidth: width, screenHeight: height });
      await send('Page.navigate', { url: `http://127.0.0.1:4173/src/app/shell.html?qa=1&lang=${lang}` });
      await ready();
      let state = await measure();
      assert.equal(state.route, 'screen-start');
      assert.ok(state.subtitle && state.eyebrow && !state.code);
      assert.equal(state.subtitle, catalogs[lang]['ui.start.subtitle']);
      assert.equal(state.eyebrow, catalogs[lang]['ui.start.eyebrow']);
      assert.ok(state.scrollWidth <= width, `${lang}/${name} start: horizontal overflow`);
      await evaluate("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click()");
      state = await measure();
      assert.equal(state.route, 'screen-briefing');
      assert.equal(state.briefing, catalogs[lang]['mission.reference-v1.briefing.full']);
      assert.ok(state.scrollWidth <= width, `${lang}/${name} briefing: horizontal overflow`);
      await evaluate("document.querySelector('#begin-mission').click()");
      state = await measure();
      assert.equal(state.route, 'screen-game');
      assert.ok(state.mission && state.phase && state.ready && state.mapAria && state.zoomAria && !state.code);
      assert.equal(state.mapAria, catalogs[lang]['ui.hud.map']);
      assert.equal(state.zoomAria, catalogs[lang]['ui.hud.zoomIn']);
      assert.ok(state.pauseVisible && state.actionVisible);
      assert.ok(state.scrollWidth <= width, `${lang}/${name} game: horizontal overflow`);
      await evaluate("document.querySelector('#pause').click(); document.querySelector('#pause-settings').click()");
      state = await measure();
      assert.equal(state.route, 'screen-settings');
      assert.equal(state.settingsNote, catalogs[lang]['ui.settings.note']);
      assert.ok(state.scrollWidth <= width, `${lang}/${name} settings: horizontal overflow`);
      await evaluate("document.querySelector('#settings-back').click(); document.querySelector('#pause-help').click()");
      state = await measure();
      assert.equal(state.route, 'screen-help');
      assert.equal(state.help, catalogs[lang]['screen.help.reference-v1.full']);
      assert.ok(state.scrollWidth <= width, `${lang}/${name} help: horizontal overflow`);
      await evaluate("document.querySelector('#help-back').click(); document.querySelector('#restart').click()");
      const dialog = await evaluate("({open:document.querySelector('#confirm-dialog').open, title:document.querySelector('#dialog-title').textContent, body:document.querySelector('#dialog-body').textContent})");
      assert.ok(dialog.open && dialog.title && dialog.body && !dialog.body.startsWith('ui.'), `${lang}/${name} restart dialog`);
      assert.equal(dialog.body, catalogs[lang]['dialog.restart.body']);
      const nextLang = ['de', 'en', 'es', 'fr'][(['de', 'en', 'es', 'fr'].indexOf(lang) + 1) % 4];
      await evaluate(`GoblinLanguage.choose(${JSON.stringify(nextLang)})`);
      assert.equal(await evaluate("document.querySelector('#dialog-body').textContent"), catalogs[nextLang]['dialog.restart.body']);
      await evaluate("document.querySelector('#dialog-cancel').click()");
      console.log(`${lang}/${name}: start, briefing, game, settings, help, dialog, ARIA and width OK`);
    }
  }
} finally {
  if (sessionId) await send('Target.detachFromTarget', { sessionId }, false).catch(() => {});
  socket.close();
}
