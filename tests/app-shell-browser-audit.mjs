// Manual browser audit for DEV-08. Start the local server and a BrowserAct
// session on shell.html?qa=1, then pass `browser-act get cdp-url` as argv[2].
// Uses the read-only QA probe and Chrome's device emulation; no game rules change.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const url = process.argv[2];
if (!url?.startsWith('ws://127.0.0.1:')) throw new Error('Pass the local BrowserAct CDP URL');
const socket = new WebSocket(url);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0, sessionId;
const pending = new Map();
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
async function viewport(width, height, touch) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: touch ? 2 : 1, mobile: touch, screenWidth: width, screenHeight: height });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 1 });
  await new Promise(resolve => setTimeout(resolve, 100));
}
async function point(selector) {
  return evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height} : null })()`);
}
async function tap(selector) {
  const p = await point(selector);
  assert.ok(p, `Missing tap target ${selector}`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return p;
}
async function probe() { return evaluate('window.__GOBLIN_QA__.snapshot()'); }

try {
  const targets = await send('Target.getTargets', {}, false);
  const target = targets.targetInfos.find(item => item.type === 'page' && item.url.includes('/src/app/shell.html?qa=1'));
  assert.ok(target, 'BrowserAct shell QA tab not found');
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await viewport(1440, 900, false);
  await evaluate("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
  assert.ok(await probe(), 'QA probe did not attach');

  const sizes = [
    ['P1',1440,900,false], ['P2',1280,720,false], ['TQ',1024,768,true],
    ['TH',768,1024,true], ['MQ',844,390,true], ['MH',390,844,true], ['M-min',320,568,true],
  ];
  const geometry = [];
  for (const [name,width,height,touch] of sizes) {
    await viewport(width,height,touch);
    const measurement = await evaluate(`(() => {
      const rect = id => { const r=document.querySelector(id).getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom),right:Math.round(r.right)}; };
      const objective = document.querySelector('#objective-toggle').getClientRects().length ? '#objective-toggle' : '#game-objective';
      return {vw:innerWidth,vh:innerHeight,scrollWidth:document.documentElement.scrollWidth,map:rect('#map-viewport'),tools:rect('.map-tools'),phase:rect('#game-phase'),pause:rect('#pause'),objective:rect(objective),selection:rect('#selection-title'),action:rect('#end-phase'),visibleAction:!!document.querySelector('#end-phase').getClientRects().length};
    })()`);
    geometry.push({name,...measurement});
    assert.ok(measurement.scrollWidth<=width, `${name}: horizontal overflow`);
    assert.ok(measurement.action.bottom<=height && measurement.pause.bottom<=height && measurement.objective.bottom<=height, `${name}: essential control outside viewport`);
    if (name === 'MQ' || name === 'M-min') {
      const shot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      await writeFile(new URL(`../qa-evidence/dev-08-${name.toLowerCase()}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
    }
  }
  console.log('GEOMETRY', JSON.stringify(geometry));

  await viewport(390,844,true);
  const before = await probe();
  const unit = await tap('g[data-unit-id="p-1"]');
  const picked = await probe();
  assert.equal(picked.view.selectedUnitId,'p-1');
  assert.equal(picked.commands.length,0);
  const targetPoint = await tap('polygon[data-x="2"][data-y="4"]');
  const selected = await probe();
  assert.equal(selected.view.pendingIntent?.type,'Move');
  assert.deepEqual(selected.state,before.state);
  assert.equal(selected.commands.length,0);

  await evaluate("document.querySelector('#terrain-set').value='verdant'; document.querySelector('#terrain-set').dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#grid').click(); document.querySelector('#zoom-in').click()");
  const transformed = await probe();
  assert.deepEqual(transformed.state,before.state);
  assert.deepEqual(transformed.areas,selected.areas);
  assert.equal(transformed.commands.length,0);
  assert.equal(transformed.view.pendingIntent?.type,'Move');
  const map = await point('#map-viewport');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:map.x,y:map.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:map.x+55,y:map.y+30}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const panned = await probe();
  assert.deepEqual(panned.state,before.state);
  assert.equal(panned.commands.length,0);
  assert.notDeepEqual(panned.view.mapPan,{x:0,y:0});
  await tap('#cancel-intent');
  assert.equal((await probe()).view.pendingIntent,null);
  await tap('polygon[data-x="2"][data-y="4"]');
  assert.equal((await probe()).view.pendingIntent?.type,'Move','picking changed after pan/zoom/style switch');
  assert.equal((await probe()).commands.length,0);
  await tap('#confirm-intent');
  const moved = await probe();
  assert.equal(moved.commands.length,1);
  assert.equal(moved.commands[0].command.type,'Move');
  assert.equal(moved.state.units.find(u=>u.id==='p-1').x,2);

  await tap('#end-phase');
  assert.equal(await evaluate("document.querySelector('#confirm-dialog').open"),true);
  const beforeBlocked = await probe();
  await evaluate("document.querySelector('svg polygon').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  const blocked = await probe();
  assert.deepEqual(blocked.state,beforeBlocked.state);
  assert.equal(blocked.commands.length,1);
  await tap('#dialog-cancel');
  const focus = await evaluate('document.activeElement.id');
  assert.equal(focus,'end-phase');
  assert.equal((await probe()).state.phase,'movement');
  await viewport(844,390,true);
  await tap('#details-toggle');
  assert.equal(await evaluate("document.querySelector('#details-dialog').open"),true);
  const beforeSheet = await probe();
  await evaluate("document.querySelector('svg polygon').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  assert.deepEqual((await probe()).state,beforeSheet.state);
  await tap('#details-close');
  assert.equal(await evaluate('document.activeElement.id'),'details-toggle');
  await tap('#details-toggle');
  await tap('#detail-units button:nth-child(2)');
  assert.equal((await probe()).view.selectedUnitId,'p-2');
  assert.equal(await evaluate("document.querySelector('#details-dialog').open"),false);
  assert.equal((await probe()).commands.length,1);
  console.log('TOUCH', JSON.stringify({unit,targetPoint,commands:moved.commands.length,panned:panned.view.mapPan,focus}));
} finally {
  if (sessionId) await send('Target.detachFromTarget',{sessionId},false).catch(()=>{});
  socket.close();
}
