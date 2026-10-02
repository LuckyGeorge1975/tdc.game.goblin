// Run against a local BrowserAct CDP session opened at the Pages-prefix index.
import assert from 'node:assert/strict';

const socket=new WebSocket(process.argv[2]);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
let serial=0,sessionId;
const pending=new Map();
socket.addEventListener('message',({data})=>{const message=JSON.parse(data),task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result)});
function send(method,params={},attached=true){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(attached&&sessionId?{sessionId}:{})}))})}
async function js(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value}
async function viewport(width,height,mobile){await send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:mobile?2:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:mobile?2:1});await new Promise(resolve=>setTimeout(resolve,100))}
try{
  const targets=await send('Target.getTargets',{},false);
  const target=targets.targetInfos.find(item=>item.type==='page'&&item.url.includes('/tdc.game.goblin/'));
  assert.ok(target,'local game tab missing');
  sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
  await send('Runtime.enable');
  for(const [width,height,lang] of [[390,844,'de'],[320,568,'fr'],[844,390,'de']]){
    await viewport(width,height,true);
    await send('Page.navigate',{url:`http://127.0.0.1:4174/tdc.game.goblin/index.html?lang=${lang}&scenario=showcase-specialists`});
    for(let n=0;n<50&&!await js('!!globalThis.GoblinMobileViews&&!!document.querySelector("#unit-roster .unit-card")');n++)await new Promise(resolve=>setTimeout(resolve,100));
    for(let n=0;n<50&&await js("document.querySelector('.battlefield').getBoundingClientRect().top>120");n++)await new Promise(resolve=>setTimeout(resolve,100));
    const initial=await js(`({view:document.documentElement.dataset.mobileView,mapTop:document.querySelector('.battlefield').getBoundingClientRect().top,mapVisible:getComputedStyle(document.querySelector('.battlefield')).display!=='none',forceHidden:getComputedStyle(document.querySelector('.left-rail')).display==='none',nav:getComputedStyle(document.querySelector('.mobile-views')).display,actionBottom:document.querySelector('#end-turn').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth})`);
    assert.equal(initial.view,'map');assert.equal(initial.mapVisible,true);assert.equal(initial.forceHidden,true);assert.notEqual(initial.nav,'none');assert.ok(initial.mapTop<120,JSON.stringify(initial));assert.ok(initial.actionBottom<=height&&initial.actionBottom>height-100,JSON.stringify(initial));assert.equal(initial.overflow,false,JSON.stringify(initial));
    await js("document.querySelector('[data-mobile-view=force]').click()");
    assert.equal(await js("getComputedStyle(document.querySelector('.left-rail')).display!=='none'"),true);
    await js("document.querySelector('[data-mobile-view=intel]').click()");
    assert.equal(await js("getComputedStyle(document.querySelector('.right-rail')).display!=='none'"),true);
    if(lang==='fr'){
      await js("document.querySelector('#unit-guide-open').click();guideIndex=unitGuideEntries.findIndex(entry=>entry.name==='ARTILLERY DRONE');renderUnitGuide()");
      const drone=await js(`({copy:document.querySelector('#guide-copy').textContent,move:document.querySelector('#guide-facts .guide-fact:nth-child(2) b').textContent,actions:document.querySelector('#guide-action-list').textContent})`);
      assert.match(drone.copy,/peut se déplacer seul/);assert.equal(drone.move,'2');assert.match(drone.actions,/Se déplacer/);
    }else await js("document.querySelector('#unit-guide-open').click();guideIndex=unitGuideEntries.findIndex(entry=>entry.name===units[0].name);renderUnitGuide()");
    await js("document.querySelector('#guide-find').click()");
    const found=await js(`({view:document.documentElement.dataset.mobileView,focus:document.activeElement.id,top:document.querySelector('.battlefield').getBoundingClientRect().top,selected:!!selected})`);
    assert.equal(found.view,'map');assert.equal(found.focus,'battlefield-map');assert.equal(found.selected,true);
    assert.ok(found.top>=0&&found.top<height,JSON.stringify(found));
    console.log(`${width}x${height} ${lang}`,JSON.stringify({initial,found}));
  }
  await viewport(1440,900,false);
  const desktop=await js(`({nav:getComputedStyle(document.querySelector('.mobile-views')).display,force:getComputedStyle(document.querySelector('.left-rail')).display,map:getComputedStyle(document.querySelector('.battlefield')).display,intel:getComputedStyle(document.querySelector('.right-rail')).display})`);
  assert.equal(desktop.nav,'none');for(const key of ['force','map','intel'])assert.notEqual(desktop[key],'none');
  console.log('desktop',JSON.stringify(desktop));
}finally{socket.close()}
