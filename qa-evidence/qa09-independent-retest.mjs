// Independent QA-08 browser run against the local, read-only ?qa=1 shell probe.
// Usage: node qa-evidence/qa09-independent-audit.mjs <BrowserAct CDP URL>
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const cdpUrl = process.argv[2];
if (!cdpUrl?.startsWith('ws://127.0.0.1:')) throw new Error('Local BrowserAct CDP URL required');
const socket = new WebSocket(cdpUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let serial = 0;
let sessionId;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  message.error ? entry.reject(new Error(`${entry.method}: ${message.error.message}`)) : entry.resolve(message.result);
});
function send(method, params = {}, attach = true) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params, ...(attach && sessionId ? { sessionId } : {}) }));
  });
}
async function js(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function ready() {
  for (let i = 0; i < 50; i++) {
    if (await js("!!document.querySelector('#choose-mission')?.textContent && !!window.__GOBLIN_QA__")) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Shell not ready');
}
async function viewport(width, height, touch) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: touch ? 2 : 1, mobile: touch, screenWidth: width, screenHeight: height });
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 2 });
  await new Promise(resolve => setTimeout(resolve, 100));
}
async function navigate(url) {
  await send('Page.navigate', { url });
  await ready();
}
async function snapshot() { return js('window.__GOBLIN_QA__.snapshot()'); }
async function center(selector) {
  const rect = await js(`(() => { const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? { x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height } : null })()`);
  assert.ok(rect && rect.w > 0 && rect.h > 0, `Missing visible target ${selector}`);
  return rect;
}
async function tap(selector) {
  const p = await center(selector);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(name, import.meta.url), Buffer.from(shot.data, 'base64'));
}
const results = [];
async function check(id, task) {
  try { const evidence = await task(); results.push({ id, status: 'pass', evidence }); }
  catch (error) { results.push({ id, status: 'fail', error: error.message }); }
}
const shell = 'http://127.0.0.1:4173/src/app/shell.html?qa=1';
try {
  const targets = await send('Target.getTargets', {}, false);
  const target = targets.targetInfos.find(item => item.type === 'page' && item.url.includes('/src/app/shell.html?qa=1'));
  assert.ok(target, 'QA BrowserAct page not found');
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Runtime.enable');
  await send('Page.enable');

  const devices = [
    ['PC', 1440, 900, false], ['PC-small', 1280, 720, false],
    ['Tablet-landscape', 1024, 768, true], ['Tablet-portrait', 768, 1024, true],
    ['Mobile-landscape', 844, 390, true], ['Mobile-portrait', 390, 844, true], ['Mobile-min', 320, 568, true],
  ];
  for (const lang of ['de', 'en', 'es', 'fr']) {
    for (const [device, width, height, touch] of devices) {
      await check(`N01/L01/I01 ${lang} ${device}`, async () => {
        await viewport(width, height, touch);
        await navigate(`${shell}&lang=${lang}`);
        const route = await js("document.querySelector('.screen:not([hidden])')?.id");
        assert.equal(route, 'screen-start');
        await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
        const p = await snapshot();
        assert.ok(p?.state && p.commands.length === 0);
        const m = await js(`(() => {
          const r = s => { const a=document.querySelector(s)?.getBoundingClientRect(); return a && { top:a.top, bottom:a.bottom, width:a.width, height:a.height }; };
          const visible = s => !!document.querySelector(s)?.getClientRects().length;
          return { innerWidth, innerHeight, scrollWidth:document.documentElement.scrollWidth,
            route:document.querySelector('.screen:not([hidden])')?.id, lang:document.documentElement.lang,
            map:r('#map-viewport'), action:r('#end-phase'), pause:r('#pause'), objective:r(visible('#objective-toggle')?'#objective-toggle':'#game-objective'),
            actionVisible:visible('#end-phase'), pauseVisible:visible('#pause'),
            clipped:[...document.querySelectorAll('#game-mission,#game-objective,#game-phase,#game-ready,#end-phase,#pause')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.id) };
        })()`);
        assert.equal(m.route, 'screen-game');
        assert.equal(m.lang, lang);
        assert.ok(m.map.width > 0 && m.map.height > 0);
        assert.ok(m.scrollWidth <= width, `horizontal overflow ${m.scrollWidth}/${width}`);
        assert.ok(m.actionVisible && m.pauseVisible);
        assert.ok(m.action.bottom <= height && m.pause.bottom <= height && m.objective.bottom <= height);
        assert.deepEqual(m.clipped, []);
        if (lang === 'de' && ['PC', 'Tablet-portrait', 'Mobile-landscape', 'Mobile-portrait', 'Mobile-min'].includes(device)) await screenshot(`qa09-${device.toLowerCase()}.png`);
        return m;
      });
    }
  }

  await check('N01 route, pause, settings and help preserve state', async () => {
    await viewport(390, 844, true);
    await navigate(`${shell}&lang=de`);
    const route = () => js("document.querySelector('.screen:not([hidden])')?.id");
    await js("document.querySelector('#start-settings').click()");
    assert.equal(await route(), 'screen-settings');
    await js("document.querySelector('#settings-back').click(); document.querySelector('#start-help').click()");
    assert.equal(await route(), 'screen-help');
    await js("document.querySelector('#help-back').click(); document.querySelector('#choose-mission').click()");
    assert.equal(await route(), 'screen-levels');
    await js("document.querySelector('#mission-list button:first-child').click()");
    assert.equal(await route(), 'screen-briefing');
    await js("document.querySelector('#begin-mission').click()");
    const before = await snapshot();
    await tap('#pause');
    assert.equal(await route(), 'screen-pause');
    await js("document.querySelector('#pause-settings').click()");
    assert.equal(await route(), 'screen-settings');
    await js("document.querySelector('#settings-back').click(); document.querySelector('#pause-help').click()");
    assert.equal(await route(), 'screen-help');
    await js("document.querySelector('#help-back').click(); document.querySelector('#resume').click()");
    assert.equal(await route(), 'screen-game');
    const after = await snapshot();
    assert.deepEqual(after.state, before.state);
    assert.equal(after.commands.length, 0);
    return { route:'screen-game', commands:0 };
  });

  await check('I02 SVG cells and units have accessible names and keyboard focus', async () => {
    await viewport(1440, 900, false);
    await navigate(`${shell}&lang=de`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    const access = await js(`(() => {
      const cell=document.querySelector('polygon[data-x][data-y]'), unit=document.querySelector('g[data-unit-id]');
      const info=e=>({ tag:e?.tagName, role:e?.getAttribute('role'), name:e?.getAttribute('aria-label'), tabindex:e?.getAttribute('tabindex') });
      return { map:info(document.querySelector('#battle-map')), cell:info(cell), unit:info(unit) };
    })()`);
    assert.ok(access.cell.name && access.cell.tabindex === '0', JSON.stringify(access));
    assert.ok(access.unit.name && access.unit.tabindex === '0', JSON.stringify(access));
    return access;
  });

  await check('I02 trusted Enter and Space preserve state until confirmation', async () => {
    await viewport(1440, 900, false);
    await navigate(`${shell}&lang=de`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    const initial = await snapshot();
    await js("document.querySelector('g[data-unit-id]').focus()");
    assert.equal(await js("document.activeElement?.dataset?.unitId"), 'p-1');
    assert.equal(await js("!!document.querySelector('[data-keyboard-focus]')"), true);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    const selected = await snapshot();
    assert.equal(selected.view.selectedUnitId, 'p-1');
    assert.deepEqual(selected.state, initial.state);
    assert.equal(selected.commands.length, 0);
    assert.equal(await js("document.activeElement?.dataset?.unitId"), 'p-1');
    await js("document.querySelector('polygon[data-x=\"2\"][data-y=\"4\"]').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    const pending = await snapshot();
    assert.equal(pending.view.pendingIntent?.type, 'Move');
    assert.deepEqual(pending.state, initial.state);
    assert.equal(pending.commands.length, 0);
    assert.equal(await js("document.activeElement?.dataset?.x"), '2');
    await js("document.querySelector('#confirm-intent').click()");
    const confirmed = await snapshot();
    assert.equal(confirmed.commands.length, 1);
    assert.equal(confirmed.commands[0].command.type, 'Move');
    return { selected:selected.view.selectedUnitId, pending:pending.view.pendingIntent.type, commands:confirmed.commands.length };
  });

  await check('A01/M01/M02/D01 touch safe action and modal', async () => {
    await viewport(390, 844, true);
    await navigate(`${shell}&lang=de`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    const initial = await snapshot();
    await tap('g[data-unit-id="p-1"]');
    await tap('polygon[data-x="2"][data-y="4"]');
    const pendingState = await snapshot();
    assert.equal(pendingState.view.pendingIntent?.type, 'Move');
    assert.equal(pendingState.commands.length, 0);
    assert.deepEqual(pendingState.state, initial.state);
    for (const mode of ['verdant', 'dryland', 'hex']) {
      await js(`(() => { const s=document.querySelector('#terrain-set'); s.value=${JSON.stringify(mode)}; s.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#grid').click(); document.querySelector('#zoom-in').click(); })()`);
      const changed = await snapshot();
      assert.deepEqual(changed.state, initial.state);
      assert.deepEqual(changed.areas, pendingState.areas);
      assert.equal(changed.commands.length, 0);
    }
    const map = await center('#map-viewport');
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: map.x, y: map.y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: map.x + 60, y: map.y + 25 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal((await snapshot()).commands.length, 0);
    await tap('polygon[data-x="2"][data-y="4"]');
    assert.equal((await snapshot()).view.pendingIntent?.type, 'Move');
    await tap('#confirm-intent');
    const moved = await snapshot();
    assert.equal(moved.commands.length, 1);
    assert.equal(moved.commands[0].command.type, 'Move');
    await tap('#end-phase');
    assert.equal(await js("document.querySelector('#confirm-dialog').open"), true);
    const beforeModal = await snapshot();
    await js("document.querySelector('svg polygon').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
    assert.deepEqual((await snapshot()).state, beforeModal.state);
    assert.equal((await snapshot()).commands.length, 1);
    await tap('#dialog-cancel');
    assert.equal(await js('document.activeElement.id'), 'end-phase');
    assert.equal((await snapshot()).state.phase, 'movement');
    return { pending:pendingState.view.pendingIntent, pan:(await snapshot()).view.mapPan, commands:moved.commands.length };
  });

  await check('D02/I01 language switch in modal', async () => {
    await viewport(844, 390, true);
    await navigate(`${shell}&lang=de`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    await tap('#end-phase');
    assert.equal(await js("document.querySelector('#confirm-dialog').open"), true);
    const before = await snapshot();
    await js("GoblinLanguage.choose('fr')");
    const text = await js("({lang:document.documentElement.lang,title:document.querySelector('#dialog-title').textContent,body:document.querySelector('#dialog-body').textContent,focus:document.activeElement.id})");
    assert.equal(text.lang, 'fr');
    assert.deepEqual((await snapshot()).state, before.state);
    assert.equal((await snapshot()).commands.length, 0);
    await js("document.querySelector('#dialog-cancel').click()");
    assert.equal(await js('document.activeElement.id'), 'end-phase');
    return text;
  });

  await check('L02 landscape details access', async () => {
    await viewport(844, 390, true);
    await navigate(`${shell}&lang=en`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    const before = await snapshot();
    await tap('#details-toggle');
    assert.equal(await js("document.querySelector('#details-dialog').open"), true);
    await tap('[data-detail="intel"]');
    await tap('[data-detail="log"]');
    await tap('#details-close');
    assert.equal(await js('document.activeElement.id'), 'details-toggle');
    assert.deepEqual((await snapshot()).state, before.state);
    return { focus:'details-toggle', commands:(await snapshot()).commands.length };
  });

  await check('D02 phase preference does not suppress restart dialog', async () => {
    await viewport(390, 844, true);
    await navigate(`${shell}&lang=de`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    await tap('#end-phase');
    assert.equal(await js("document.querySelector('#confirm-dialog').open"), true);
    await js("document.querySelector('#remember-phase').click(); document.querySelector('#dialog-confirm').click()");
    const afterPhase = await snapshot();
    assert.equal(afterPhase.state.phase, 'fire');
    await tap('#pause');
    await tap('#restart');
    assert.equal(await js("document.querySelector('#confirm-dialog').open"), true);
    const copy = await js("({title:document.querySelector('#dialog-title').textContent,body:document.querySelector('#dialog-body').textContent})");
    await tap('#dialog-cancel');
    assert.deepEqual((await snapshot()).state, afterPhase.state);
    return copy;
  });

  await check('A02 phase-v2 fixture starts separately', async () => {
    await viewport(1440, 900, false);
    await navigate(`${shell}&lang=es`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:nth-child(2)').click(); document.querySelector('#begin-mission').click()");
    const p = await snapshot();
    assert.ok(p.state && p.commands.length === 0);
    const text = await js("({mission:document.querySelector('#game-mission').textContent,phase:document.querySelector('#game-phase').textContent,progress:document.querySelector('#game-progress').textContent})");
    assert.match(text.progress, /3\/3/);
    return { text, phase:p.state.phase, units:p.state.units.length };
  });

  await check('M02 two-finger pinch zooms without commands', async () => {
    await viewport(390, 844, true);
    await navigate(`${shell}&lang=de`);
    await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
    const before = await snapshot();
    const map = await center('#map-viewport');
    const x=map.x, y=map.y;
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y},{x:x+25,y}]});
    await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-75,y},{x:x+75,y}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after = await snapshot();
    assert.deepEqual(after.state, before.state);
    assert.equal(after.commands.length, 0);
    assert.ok(after.view.mapZoom > before.view.mapZoom, `zoom ${before.view.mapZoom} -> ${after.view.mapZoom}; pan ${JSON.stringify(after.view.mapPan)}`);
    const target = await js(`(() => {
      const viewport=document.querySelector('#map-viewport').getBoundingClientRect();
      const units=new Set(window.__GOBLIN_QA__.snapshot().state.units.map(u=>u.x+','+u.y));
      const choices=[...document.querySelectorAll('polygon[data-x][data-y]')].map(e=>{
        const r=e.getBoundingClientRect(); return {x:Number(e.dataset.x),y:Number(e.dataset.y),px:r.left+r.width/2,py:r.top+r.height/2};
      }).filter(p=>p.px>viewport.left+15&&p.px<viewport.right-15&&p.py>viewport.top+15&&p.py<viewport.bottom-15&&!units.has(p.x+','+p.y));
      choices.sort((a,b)=>Math.hypot(a.px-${x},a.py-${y})-Math.hypot(b.px-${x},b.py-${y}));
      return choices[0]??null;
    })()`);
    assert.ok(target, 'No visible empty hex after pinch');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.px,y:target.py}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const picked = await snapshot();
    assert.deepEqual(picked.view.focusedCell, {x:target.x,y:target.y});
    assert.deepEqual(picked.state, before.state);
    assert.equal(picked.commands.length, 0);
    return { from:before.view.mapZoom, to:after.view.mapZoom, pan:after.view.mapPan, picked:target };
  });

  for (const [device, width, height] of [['Mobile-portrait',390,844],['Mobile-landscape',844,390],['Tablet-portrait',768,1024]]) {
    await check(`H01 ${device} 40 safe taps`, async () => {
      await viewport(width, height, true);
      await navigate(`${shell}&lang=de`);
      await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
      const initial = await snapshot();
      for (let n = 0; n < 20; n++) {
        await tap('g[data-unit-id="p-1"]');
        await tap('polygon[data-x="2"][data-y="4"]');
      }
      const after = await snapshot();
      assert.equal(after.commands.length, 0);
      assert.deepEqual(after.state, initial.state);
      return { taps:40, commands:after.commands.length, pending:after.view.pendingIntent?.type ?? null };
    });
  }

  for (const [device, width, height] of [['Mobile-min',320,568],['Mobile-landscape',844,390]]) {
    await check(`I01 2x long text ${device}`, async () => {
      await viewport(width, height, true);
      await navigate(`${shell}&lang=fr`);
      await js("document.querySelector('#choose-mission').click(); document.querySelector('#mission-list button:first-child').click(); document.querySelector('#begin-mission').click()");
      const baseline = await snapshot();
      const bounds = await js(`(() => {
        for (const id of ['game-phase','game-ready','end-phase']) {
          const e=document.getElementById(id); e.textContent = e.textContent + ' ' + e.textContent;
        }
        const r = e => { const a=e.getBoundingClientRect(); return { top:a.top,bottom:a.bottom,left:a.left,right:a.right }; };
        return { overflow:document.documentElement.scrollWidth>innerWidth,
          clipped:['game-phase','game-ready','end-phase'].filter(id=>{ const e=document.getElementById(id); return e.scrollWidth>e.clientWidth+2 }),
          action:r(document.getElementById('end-phase')), pause:r(document.getElementById('pause')),
          objective:r(document.getElementById('objective-toggle')), map:r(document.getElementById('map-viewport')) };
      })()`);
      await screenshot(`qa09-long-text-${device.toLowerCase()}.png`);
      assert.equal(bounds.overflow, false);
      assert.deepEqual(bounds.clipped, []);
      assert.ok(bounds.action.bottom <= height, JSON.stringify(bounds));
      assert.ok(bounds.pause.right <= width && bounds.pause.bottom <= height, JSON.stringify(bounds));
      assert.deepEqual((await snapshot()).state, baseline.state);
      return bounds;
    });
  }

  await writeFile(new URL('qa09-independent-audit.json', import.meta.url), JSON.stringify({ checkpoint:'7fef083', browser:'goblin-local', results }, null, 2));
  console.log(JSON.stringify({ passed:results.filter(x=>x.status==='pass').length, failed:results.filter(x=>x.status==='fail').length, failures:results.filter(x=>x.status==='fail') }, null, 2));
} finally {
  if (sessionId) await send('Target.detachFromTarget', { sessionId }, false).catch(() => {});
  socket.close();
}

