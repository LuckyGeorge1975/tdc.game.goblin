// BrowserAct CDP smoke for the isolated Unit-Art integration checkout.
// Start tests/pages-prefix-server.mjs, open its /tdc.game.goblin/index.html URL
// in a BrowserAct session, then pass `browser-act get cdp-url` as argv[2].
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const cdp = process.argv[2];
if (!cdp?.startsWith('ws://127.0.0.1:')) throw new Error('Local BrowserAct CDP URL required');
const socket = new WebSocket(cdp);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0, sessionId;
const pending = new Map(), errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.sessionId === sessionId && message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.sessionId === sessionId && message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(`${message.params.response.status} ${message.params.response.url}`);
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(new Error(`${task.method}: ${message.error.message}`)) : task.resolve(message.result);
});
function send(method, params = {}, attached = true) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params, ...(attached && sessionId ? { sessionId } : {}) }));
  });
}
async function js(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function viewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 2 : 1 });
  await new Promise(resolve => setTimeout(resolve, 100));
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(`../qa-evidence/${name}.png`, import.meta.url), Buffer.from(shot.data, 'base64'));
}
async function measure() {
  return js(`(() => {
    const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
    const image=document.querySelector('#guide-symbol img');
    const card=document.querySelector('.guide-card');
    const body=document.querySelector('.guide-body');
    return {viewport:{width:innerWidth,height:innerHeight},style:UnitVisuals.currentStyle(),card:rect('.guide-card'),symbol:rect('#guide-symbol'),image:rect('#guide-symbol img'),
      src:image?.getAttribute('src'),natural:{width:image?.naturalWidth,height:image?.naturalHeight},fit:getComputedStyle(image).objectFit,
      clip:getComputedStyle(document.querySelector('#guide-symbol')).clipPath,header:{rect:rect('.guide-card .guide-head'),scrollWidth:document.querySelector('.guide-card .guide-head').scrollWidth},
      scroll:{height:card.scrollHeight,client:card.clientHeight,bodyHeight:body.scrollHeight,bodyClient:body.clientHeight}};
  })()`);
}

try {
  const targets = await send('Target.getTargets', {}, false);
  const target = targets.targetInfos.find(item => item.type === 'page' && item.url.includes('/tdc.game.goblin/index.html'));
  assert.ok(target, 'BrowserAct integration tab not found');
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await viewport(1440, 900, false);
  await send('Page.navigate', { url: 'http://127.0.0.1:4174/tdc.game.goblin/index.html?lang=de&unitArtAudit=1' });
  for (let n = 0; n < 50 && !await js('!!window.UnitVisuals && document.querySelectorAll("#art-style-select option").length===6'); n++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await js('document.querySelectorAll("#art-style-select option").length'), 6);
  await js("document.querySelector('#unit-guide-open').click()");
  for (let n = 0; n < 30 && !await js('document.querySelector("#guide-symbol img")?.complete'); n++) await new Promise(resolve => setTimeout(resolve, 100));
  const first = await measure();
  assert.match(first.src, /library\/military-symbols\/goblin-siegebreaker\.svg$/);
  assert.deepEqual(first.natural, { width: 1024, height: 768 });
  assert.equal(first.fit, 'contain');
  assert.equal(first.clip, 'none');
  assert.ok(first.symbol.width >= 240 && first.symbol.height >= 180, JSON.stringify(first));
  await screenshot('ur8-guide-desktop');
  console.log('desktop', JSON.stringify(first));

  await js("document.querySelector('#unit-guide-close').click(); const s=document.querySelector('#art-style-select'); s.value='06-technical-illustration'; s.dispatchEvent(new Event('change',{bubbles:true}))");
  for (let n = 0; n < 30 && await js("UnitVisuals.currentStyle()!=='06-technical-illustration'"); n++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await js('UnitVisuals.currentStyle()'), '06-technical-illustration');
  const art = await js("({roster:document.querySelector('#unit-roster .unit-art-image')?.getAttribute('src'),map:document.querySelector('.unit-svg image.unit-artwork')?.getAttribute('href'),terrain:document.querySelector('image.terrain-art')?.getAttribute('href')})");
  assert.match(art.roster, /06-technical-illustration\/icons\/goblin-siegebreaker\.svg$/);
  assert.match(art.map, /06-technical-illustration\/icons\/goblin-siegebreaker\.svg$/);
  await js("document.querySelector('#unit-guide-open').click()");
  const second = await measure();
  assert.equal(second.src, first.src);
  console.log('style switch', JSON.stringify({ art, guide: second.src }));

  for (const [width, height, name] of [[390, 844, 'ur8-guide-mobile'], [320, 568, 'ur8-guide-mobile-min']]) {
    await viewport(width, height, true);
    await js("document.querySelector('.guide-body').scrollTop=0");
    const layout = await measure();
    assert.ok(layout.card.left >= 0 && layout.card.right <= width && layout.card.bottom <= height, JSON.stringify(layout));
    assert.ok(layout.header.scrollWidth <= layout.header.rect.width + 1, JSON.stringify(layout));
    assert.ok(layout.symbol.width <= layout.card.width && layout.image.width <= layout.symbol.width, JSON.stringify(layout));
    assert.equal(layout.fit, 'contain'); assert.equal(layout.clip, 'none');
    await screenshot(name);
    const nav = await js(`(() => { const card=document.querySelector('.guide-card'),body=document.querySelector('.guide-body'); body.scrollTop=body.scrollHeight; const r=document.querySelector('.guide-nav').getBoundingClientRect(),c=card.getBoundingClientRect(),last=document.querySelector('#guide-action-list').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,cardBottom:c.bottom,lastActionBottom:last.bottom,bodyBottom:body.getBoundingClientRect().bottom}; })()`);
    assert.ok(nav.bottom <= nav.cardBottom + 1, JSON.stringify(nav));
    assert.ok(nav.lastActionBottom <= nav.bodyBottom + 1, JSON.stringify(nav));
    console.log('mobile', JSON.stringify({ layout, nav }));
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('network', JSON.stringify({errors:errors.length}));
} finally {
  if (sessionId) await send('Target.detachFromTarget', { sessionId }, false).catch(() => {});
  socket.close();
}
