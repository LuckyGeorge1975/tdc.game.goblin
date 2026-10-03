// BrowserAct CDP smoke for the isolated Unit-Art integration checkout.
// Start tests/pages-prefix-server.mjs, open its /tdc.game.goblin/index.html URL
// in a BrowserAct session, then pass `browser-act get cdp-url` as argv[2].
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
  if(!process.env.GOBLIN_BROWSER_EVIDENCE_DIR)return;
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(process.env.GOBLIN_BROWSER_EVIDENCE_DIR,`${name}.png`), Buffer.from(shot.data, 'base64'));
}
async function measure() {
  return js(`(() => {
    const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
    const image=document.querySelector('#guide-symbol img');
    const card=document.querySelector('.guide-card');
    const body=document.querySelector('.guide-body');
    return {viewport:{width:innerWidth,height:innerHeight},style:UnitVisuals.currentStyle(),card:rect('.guide-card'),symbol:rect('#guide-symbol'),image:rect('#guide-symbol img'),
      src:image?.getAttribute('src'),currentSrc:image?.currentSrc,source:document.querySelector('#guide-symbol source')?.getAttribute('srcset'),
      natural:{width:image?.naturalWidth,height:image?.naturalHeight},fit:getComputedStyle(image).objectFit,
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
  await js("localStorage.removeItem('goblin-art-style')");
  await send('Page.reload');
  for (let n = 0; n < 50 && !await js('!!window.UnitVisuals && document.querySelectorAll("#art-style-select option").length===6'); n++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await js('UnitVisuals.currentStyle()'), '02-technical-illustration');
  await js("document.querySelector('#unit-guide-open').click()");
  for (let n = 0; n < 30 && !await js('document.querySelector("#guide-symbol img")?.naturalWidth'); n++) await new Promise(resolve => setTimeout(resolve, 100));
  const first = await measure();
  assert.match(first.src, /sets\/02-technical-illustration\/library\/goblin-siegebreaker@768\.png$/);
  assert.match(first.currentSrc, /sets\/02-technical-illustration\/library\/goblin-siegebreaker@1024\.webp$/);
  assert.match(first.source, /goblin-siegebreaker@1024\.webp$/);
  assert.deepEqual(first.natural, { width: 1024, height: 683 });
  assert.equal(first.fit, 'contain');
  assert.equal(first.clip, 'none');
  assert.ok(first.symbol.width >= 240 && first.symbol.height >= 180, JSON.stringify(first));
  await screenshot('0t0-guide-desktop');
  assert.equal(await js("document.querySelector('#guide-range-map svg')?.querySelectorAll('polygon').length"),217);
  console.log('desktop', JSON.stringify(first));

  const styles=['01-tabletop-miniatures','02-technical-illustration','03-industrial-realism','04-pixel-strategy','05-cel-shaded-comic','06-military-symbols'];
  for(const style of styles){
    await js("document.querySelector('#unit-guide-close').click()");
    await js(`(() => { const picker=document.querySelector('#art-style-select'); picker.value='${style}'; picker.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    for(let n=0;n<30&&await js(`UnitVisuals.currentStyle()!=='${style}'`);n++) await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(await js('UnitVisuals.currentStyle()'),style);
    const art=await js("({roster:document.querySelector('#unit-roster .unit-art-image')?.getAttribute('src'),map:document.querySelector('.unit-svg image.unit-artwork')?.getAttribute('href'),terrain:UnitVisuals.terrainAssetFor('forest')})");
    assert.equal(art.roster,`assets/unit-art/sets/${style}/icons/goblin-siegebreaker.svg`);
    assert.equal(art.map,art.roster);
    assert.match(art.terrain,/sets\/01-modular-stealth-geometry\/terrain\//);
    await js("document.querySelector('#unit-guide-open').click()");
    for(let n=0;n<30&&!await js('document.querySelector("#guide-symbol img")?.naturalWidth');n++) await new Promise(resolve=>setTimeout(resolve,100));
    const guide=await measure();
    const military=style==='06-military-symbols';
    assert.equal(guide.src,`assets/unit-art/sets/${style}/library/goblin-siegebreaker${military?'':'@768'}.${military?'svg':'png'}`);
    assert.match(guide.currentSrc,new RegExp(`/${style}/library/goblin-siegebreaker${military?'':'@1024'}\\.${military?'svg':'webp'}$`));
    assert.deepEqual(guide.natural,military?{width:1024,height:768}:{width:1024,height:683});
    assert.equal(guide.fit,'contain'); assert.equal(guide.clip,'none');
    console.log('style switch',JSON.stringify({style,art,guide:guide.src}));
  }
  await screenshot('0t0-guide-military-desktop');
  await js("document.querySelector('#unit-guide-close').click()");
  await js("(() => { const picker=document.querySelector('#art-style-select'); picker.value='02-technical-illustration'; picker.dispatchEvent(new Event('change',{bubbles:true})); })()");
  await js("document.querySelector('#unit-guide-open').click()");

  for (const [width, height, name] of [[390, 844, '0t0-guide-mobile'], [320, 568, '0t0-guide-mobile-min']]) {
    await viewport(width, height, true);
    await js("document.querySelector('.guide-body').scrollTop=0");
    const layout = await measure();
    const miniMap=await js(`(() => { const rect=s=>document.querySelector(s).getBoundingClientRect();return {visualBottom:rect('.guide-visual').bottom,informationTop:rect('.guide-information').top,mapBottom:rect('.guide-range-svg').bottom,summaryTop:rect('#guide-range-summary').top}; })()`);
    assert.ok(miniMap.visualBottom<=miniMap.informationTop+1 && miniMap.mapBottom<=miniMap.summaryTop+1,JSON.stringify(miniMap));
    assert.ok(layout.card.left >= 0 && layout.card.right <= width && layout.card.bottom <= height, JSON.stringify(layout));
    assert.ok(layout.header.scrollWidth <= layout.header.rect.width + 1, JSON.stringify(layout));
    assert.ok(layout.symbol.width <= layout.card.width && layout.image.width <= layout.symbol.width, JSON.stringify(layout));
    assert.match(layout.src,/\/02-technical-illustration\/library\/goblin-siegebreaker@768\.png$/);
    assert.match(layout.currentSrc,/\/02-technical-illustration\/library\/goblin-siegebreaker@1024\.webp$/);
    assert.deepEqual(layout.natural,{width:1024,height:683});
    assert.equal(layout.fit, 'contain'); assert.equal(layout.clip, 'none');
    await screenshot(name);
    const nav = await js(`(() => { const card=document.querySelector('.guide-card'),body=document.querySelector('.guide-body'); body.scrollTop=body.scrollHeight; const r=document.querySelector('.guide-nav').getBoundingClientRect(),c=card.getBoundingClientRect(),last=document.querySelector('#guide-action-list').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,cardBottom:c.bottom,lastActionBottom:last.bottom,bodyBottom:body.getBoundingClientRect().bottom}; })()`);
    assert.ok(nav.bottom <= nav.cardBottom + 1, JSON.stringify(nav));
    assert.ok(nav.lastActionBottom <= nav.bodyBottom + 1, JSON.stringify(nav));
    console.log('mobile', JSON.stringify({ layout, nav }));
  }
  const loaded=await js("performance.getEntriesByType('resource').map(item=>item.name).filter(name=>name.includes('/library/')&&(name.includes('@1024.')||name.includes('@768.')))");
  assert.ok(loaded.some(name=>name.endsWith('@1024.webp')));
  assert.equal(loaded.filter(name=>name.endsWith('@768.png')).length,0,'supported WebP must not also fetch PNG fallback');
  await js("document.querySelector('#guide-symbol source').type='image/x-unsupported'");
  for(let n=0;n<30&&!await js("document.querySelector('#guide-symbol img')?.currentSrc.endsWith('@768.png')");n++)await new Promise(resolve=>setTimeout(resolve,100));
  const fallback=await measure();
  assert.match(fallback.currentSrc,/@768\.png$/,'unsupported source must use PNG fallback');
  assert.deepEqual(fallback.natural,{width:768,height:512});
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('network', JSON.stringify({errors:errors.length}));
} finally {
  if (sessionId) await send('Target.detachFromTarget', { sessionId }, false).catch(() => {});
  socket.close();
}
