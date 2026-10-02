// Local BrowserAct CDP review of the guide's mobile route to facts and notes.
import assert from 'node:assert/strict';

const socket=new WebSocket(process.argv[2]);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
let serial=0,sessionId;
const pending=new Map(),errors=[];
socket.addEventListener('message',({data})=>{
  const message=JSON.parse(data);
  if(message.sessionId===sessionId&&message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  const task=pending.get(message.id);if(!task)return;pending.delete(message.id);
  message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
});
function send(method,params={},attached=true){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(attached&&sessionId?{sessionId}:{})}))})}
async function js(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value}
async function viewport(width,height,mobile){await send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:mobile?2:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:mobile?2:1})}
async function key(name,shift=false){const code={Tab:9,Enter:13,Escape:27}[name],text=name==='Enter'?'\r':undefined;await send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,modifiers:shift?8:0,...(text?{text,unmodifiedText:text}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code,modifiers:shift?8:0})}
try{
  const targets=await send('Target.getTargets',{},false);
  const target=targets.targetInfos.find(item=>item.type==='page'&&item.url.includes('/tdc.game.goblin/index.html'));
  assert.ok(target,'local Legacy guide tab missing');
  sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
  await send('Runtime.enable');
  for(const [width,height,lang] of [[320,568,'fr'],[320,568,'es'],[390,844,'de']]){
    await viewport(width,height,true);
    await send('Page.navigate',{url:`http://127.0.0.1:4174/tdc.game.goblin/index.html?lang=${lang}`});
    for(let i=0;i<50&&!await js('!!globalThis.UnitGuideRange&&!!globalThis.UnitGuideVoice');i++)await new Promise(resolve=>setTimeout(resolve,100));
    await js("document.querySelector('#unit-guide-open').click()");
    const before=await js(`(() => {const r=s=>document.querySelector(s).getBoundingClientRect();return {jump:r('#guide-details-jump').top,schematic:r('#guide-schematic-label').top,button:getComputedStyle(document.querySelector('#guide-details-jump')).display,bodyTop:r('.guide-body').top,bodyBottom:r('.guide-body').bottom,voiceTop:r('.guide-voice').top,mapBottom:r('.guide-range-svg').bottom}})()`);
    assert.notEqual(before.button,'none');assert.ok(before.jump>=0&&before.jump<height,JSON.stringify(before));
    assert.ok(before.schematic<before.bodyTop,JSON.stringify(before));
    await js("document.querySelector('#guide-details-jump').click()");
    const after=await js(`(() => {const r=s=>document.querySelector(s).getBoundingClientRect();return {voiceLabelTop:r('#guide-voice-label').top,voiceBottom:r('.guide-voice').bottom,factsTop:r('#guide-facts').top,factsBottom:r('#guide-facts').bottom,bodyTop:r('.guide-body').top,bodyBottom:r('.guide-body').bottom,focused:document.activeElement.id,scroll:document.querySelector('.guide-body').scrollTop}})()`);
    assert.equal(after.focused,'guide-voice-label');assert.ok(after.scroll>0,JSON.stringify(after));
    assert.ok(after.voiceLabelTop>=after.bodyTop-1&&after.voiceBottom<=after.bodyBottom+1,JSON.stringify(after));
    assert.ok(after.factsTop>=after.bodyTop-1&&after.factsBottom<=after.bodyBottom+1,JSON.stringify(after));
    await js("guideIndex=unitGuideEntries.findIndex(item=>item.name==='STRATEGIC MISSILE CARRIER');renderUnitGuide()");
    const singular=await js("document.querySelector('#guide-range-summary').textContent");
    assert.match(singular,new RegExp(`1 ${{de:'Hex',en:'hex',es:'hexágono',fr:'hexagone'}[lang]}$`),singular);
    await key('Escape');
    assert.equal(await js("document.querySelector('#unit-guide-modal').classList.contains('hidden')"),true);
    console.log(`${width}x${height} ${lang}`,JSON.stringify({before,after}));
  }
  await viewport(1440,900,false);
  await send('Page.navigate',{url:'http://127.0.0.1:4174/tdc.game.goblin/index.html?lang=en'});
  for(let i=0;i<50&&!await js('!!globalThis.UnitGuideRange');i++)await new Promise(resolve=>setTimeout(resolve,100));
  await js("document.querySelector('#unit-guide-open').focus()");
  await key('Enter');
  assert.equal(await js("getComputedStyle(document.querySelector('#guide-details-jump')).display"),'none');
  await js("guideIndex=unitGuideEntries.findIndex(item=>item.name==='STRATEGIC MISSILE CARRIER');renderUnitGuide()");
  assert.match(await js("document.querySelector('#guide-range-summary').textContent"),/1 hex$/);
  assert.equal(await js("document.activeElement.id"),'unit-guide-close');
  assert.equal(await js("document.querySelector('.app-shell').inert"),true);
  await key('Tab',true);
  assert.equal(await js("document.activeElement.id"),'guide-next');
  await key('Tab');
  assert.equal(await js("document.activeElement.id"),'unit-guide-close');
  await js("document.querySelector('#end-turn').focus()");
  assert.equal(await js("document.querySelector('#unit-guide-modal').contains(document.activeElement)"),true);
  for(let i=0;i<16;i++){
    await key('Tab');
    assert.equal(await js("document.querySelector('#unit-guide-modal').contains(document.activeElement)"),true,`Tab ${i}`);
  }
  await key('Tab',true);
  assert.equal(await js("document.querySelector('#unit-guide-modal').contains(document.activeElement)"),true);
  await js("document.querySelector('#guide-range-attack').focus()");
  await key('Enter');
  assert.equal(await js("document.querySelector('#guide-range-attack').getAttribute('aria-pressed')"),'true');
  assert.equal(await js('GameDialogs.isOpen()'),false);
  await key('Escape');
  assert.equal(await js("document.querySelector('#unit-guide-modal').classList.contains('hidden')"),true);
  assert.equal(await js("document.activeElement.id"),'unit-guide-open');
  assert.equal(await js("document.querySelector('.app-shell').inert"),false);
  await js("document.querySelector('#unit-guide-open').click()");
  assert.equal(await js("document.activeElement.id"),'unit-guide-close');
  await key('Enter');
  assert.equal(await js("document.activeElement.id"),'unit-guide-open');
  assert.equal(await js('GameDialogs.isOpen()'),false);
  assert.deepEqual(errors,[]);
  console.log('desktop and JavaScript',JSON.stringify({errors:errors.length}));
}finally{socket.close()}
