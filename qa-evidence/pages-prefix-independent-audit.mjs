// Independent local Pages-prefix QA for goblin-ib3.3.
// Usage: node qa-evidence/pages-prefix-independent-audit.mjs <BrowserAct CDP URL>
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const cdp = process.argv[2];
if (!cdp?.startsWith('ws://127.0.0.1:')) throw new Error('Local BrowserAct CDP URL required');
const origin = 'http://127.0.0.1:4174';
const prefix = '/tdc.game.goblin/';
const shell = `${origin}${prefix}src/app/shell.html?qa=1`;
const socket = new WebSocket(cdp);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once:true });
  socket.addEventListener('error', reject, { once:true });
});
let serial = 0, sessionId = null, navigation = 0;
const pending = new Map(), requests = new Set(), httpErrors = [], jsErrors = [], loadErrors = [];
socket.addEventListener('message', ({data}) => {
  const m = JSON.parse(data);
  if (m.sessionId === sessionId && m.method === 'Network.requestWillBeSent') requests.add(m.params.request.url);
  if (m.sessionId === sessionId && m.method === 'Network.responseReceived' && m.params.response.status >= 400)
    httpErrors.push({status:m.params.response.status,url:m.params.response.url});
  if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown')
    jsErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.sessionId === sessionId && m.method === 'Network.loadingFailed' && m.params.errorText !== 'net::ERR_ABORTED')
    loadErrors.push(m.params.errorText);
  const entry = pending.get(m.id);
  if (!entry) return;
  pending.delete(m.id);
  m.error ? entry.reject(new Error(`${entry.method}: ${m.error.message}`)) : entry.resolve(m.result);
});
function send(method, params = {}, attach = true) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve,reject,method});
    socket.send(JSON.stringify({id,method,params,...(attach && sessionId ? {sessionId} : {})}));
  });
}
async function js(expression) {
  const r = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function waitReady(run) {
  for (let i=0;i<60;i++) {
    if (await js(`location.search.includes('run=${run}') && !!window.__GOBLIN_QA__ && !!document.querySelector('#choose-mission')?.textContent`)) return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Page did not become ready, run=${run}`);
}
async function viewport(width,height,touch) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:touch?2:1,mobile:touch,screenWidth:width,screenHeight:height});
  await send('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:2});
  await new Promise(resolve=>setTimeout(resolve,80));
}
async function openGame(lang) {
  const run=++navigation;
  await send('Page.navigate',{url:`${shell}&lang=${lang}&run=${run}`});
  await waitReady(run);
  assert.equal(await js('document.documentElement.lang'),lang);
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"),'screen-start');
  await js("document.querySelector('#choose-mission').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"),'screen-levels');
  await js("document.querySelector('#mission-list button:first-child').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"),'screen-briefing');
  await js("document.querySelector('#begin-mission').click()");
  assert.equal(await js("document.querySelector('.screen:not([hidden])')?.id"),'screen-game');
  return js("window.__GOBLIN_QA__.snapshot()");
}
async function shot(name) {
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(new URL(name,import.meta.url),Buffer.from(r.data,'base64'));
}
async function tap(selector) {
  const p=await js(`(() => { const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`);
  assert.ok(p && p.w>0 && p.h>0,`Missing touch target ${selector}`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
const checks=[];
async function check(id,fn) {
  try { checks.push({id,status:'pass',evidence:await fn()}); }
  catch(e) { checks.push({id,status:'fail',error:e.message}); }
}
try {
  const targets=await send('Target.getTargets',{},false);
  const target=targets.targetInfos.find(t=>t.type==='page' && t.url.includes(`${prefix}src/app/shell.html`));
  assert.ok(target,'Prefix shell tab not found');
  sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});

  for (const [profile,w,h,touch] of [['desktop',1440,900,false],['mobile',390,844,true]]) {
    await viewport(w,h,touch);
    for (const lang of ['de','en','es','fr']) {
      await check(`route ${profile} ${lang}`,async()=>{
        const start=await openGame(lang);
        assert.equal(start.commands.length,0);
        const m=await js(`(() => {
          const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
          return {url:location.href,lang:document.documentElement.lang,mission:document.querySelector('#game-mission').textContent,
            phase:document.querySelector('#game-phase').textContent,scrollWidth:document.documentElement.scrollWidth,
            action:rect('#end-phase'),pause:rect('#pause'),options:[...document.querySelector('#terrain-set').options].map(o=>o.value)};
        })()`);
        assert.ok(m.url.startsWith(shell) && m.mission && m.phase);
        assert.ok(m.scrollWidth<=w && m.action.bottom<=h && m.pause.bottom<=h);
        assert.deepEqual(m.options,['hex','verdant','dryland','natural','field-atlas']);
        return m;
      });
    }
  }

  for (const [profile,w,h,touch] of [['desktop',1440,900,false],['mobile',390,844,true]]) {
    await viewport(w,h,touch);
    await openGame('de');
    const before=await js('window.__GOBLIN_QA__.snapshot()');
    for (const style of ['verdant','dryland','natural','field-atlas']) {
      await check(`style ${profile} ${style}`,async()=>{
        const dom=await js(`(() => {
          const s=document.querySelector('#terrain-set'); s.value=${JSON.stringify(style)}; s.dispatchEvent(new Event('change',{bubbles:true}));
          return {value:s.value,features:document.querySelectorAll('[data-feature-id]').length,
            picks:document.querySelectorAll('[data-layer=picking] polygon[data-x][data-y]').length,
            images:[...document.querySelectorAll('image[data-detail-layer]')].map(e=>e.getAttribute('href'))};
        })()`);
        const current=await js('window.__GOBLIN_QA__.snapshot()');
        assert.equal(dom.value,style);
        assert.equal(current.view.styleSetId,style);
        assert.equal(dom.features,29);
        assert.equal(dom.picks,96);
        assert.equal(dom.images.length,2);
        assert.deepEqual(current.state,before.state);
        assert.deepEqual(current.areas,before.areas);
        assert.equal(current.commands.length,0);
        const assets=await js(`Promise.all(${JSON.stringify(dom.images)}.map(async href=>{const u=new URL(href,location.href);const r=await fetch(u);return {url:u.href,status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength}}))`);
        for (const asset of assets) {
          assert.ok(asset.url.startsWith(origin+prefix),asset.url);
          assert.equal(asset.status,200,asset.url);
          assert.ok(asset.bytes>1000,asset.url);
          assert.match(asset.type,/image\/(svg\+xml|png)/);
        }
        if (profile==='desktop') await shot(`pages-prefix-${style}.png`);
        return {dom,assets};
      });
    }
  }

  await check('mobile safe preview then exactly one Move',async()=>{
    await viewport(390,844,true);
    const before=await openGame('de');
    await js("(() => { const s=document.querySelector('#terrain-set');s.value='field-atlas';s.dispatchEvent(new Event('change',{bubbles:true})); })()");
    await tap('g[data-unit-id="p-1"]');
    await tap('polygon[data-x="2"][data-y="4"]');
    const preview=await js('window.__GOBLIN_QA__.snapshot()');
    assert.equal(preview.view.pendingIntent?.type,'Move');
    assert.deepEqual(preview.state,before.state);
    assert.equal(preview.commands.length,0);
    await tap('#confirm-intent');
    const after=await js('window.__GOBLIN_QA__.snapshot()');
    assert.equal(after.commands.length,1);
    assert.equal(after.commands[0].command.type,'Move');
    assert.notDeepEqual(after.state,before.state);
    await shot('pages-prefix-mobile-command.png');
    return {preview:preview.view.pendingIntent.type,command:after.commands[0].command.type,count:after.commands.length};
  });

  await new Promise(resolve=>setTimeout(resolve,250));
  await check('network stays inside project prefix without errors',async()=>{
    const requestList=[...requests];
    assert.ok(requestList.length>20,`Only ${requestList.length} requests observed`);
    const outside=requestList.filter(u=>u.startsWith('http:')||u.startsWith('https:')).filter(u=>!u.startsWith(origin+prefix));
    assert.deepEqual(outside,[]);
    assert.deepEqual(httpErrors,[]);
    assert.deepEqual(loadErrors,[]);
    assert.deepEqual(jsErrors,[]);
    return {requests:requestList.length,outside,httpErrors,loadErrors,jsErrors};
  });
  const result={commit:'42efa87',url:shell,checks,requests:[...requests],httpErrors,loadErrors,jsErrors};
  await writeFile(new URL('pages-prefix-independent-audit.json',import.meta.url),JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:checks.filter(c=>c.status==='pass').length,failed:checks.filter(c=>c.status==='fail').length,failures:checks.filter(c=>c.status==='fail')},null,2));
} finally {
  if (sessionId) await send('Target.detachFromTarget',{sessionId},false).catch(()=>{});
  socket.close();
}
