import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const flow=readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
const startSource=source.slice(source.indexOf('    function startView() {'),source.indexOf('    function fireZoomEntry(state) {'));
const zoomSource=source.slice(source.indexOf('    function fireZoomEntry(state) {'),source.indexOf('    new ResizeObserver('));
function scene({width=323,height=205,compact=true}={}){
  const size={width,height},frames=[],effects=[];
  const state={markers:{binding:{scenarioId:'iron-dust-v2',profileId:'CORE_IRON_DUST_v2',epoch:1}},
    units:[{id:'enemy',team:'enemy',hp:3},{id:'cargo',team:'player',hp:2,embarkedOn:'own'},
      {id:'own',team:'player',hp:5,x:1,y:5}]};
  const view={zoom:1,actorId:null};
  const nativeMap={viewBox:{baseVal:{width:790,height:480}},style:{},
    getBoundingClientRect(){return {width:parseFloat(this.style.width)||0}}};
  const mapPanel={scrollTo(){effects.push('scroll-origin')},
    get clientWidth(){return size.width-(parseFloat(nativeMap.style.height)>size.height?15:0)},
    get clientHeight(){return size.height-(parseFloat(nativeMap.style.width)>this.clientWidth?15:0)}};
  const context={view,state,mapPanel,nativeMap,S:34,startZoomMission:null,startZoomPending:null,
    project:()=>state,revision:()=>context.rev,rev:'initial',
    matchMedia:()=>({matches:compact}),requestAnimationFrame:fn=>frames.push(fn),
    document:{body:{classList:{contains:()=>false}}},GameDialogs:{isOpen:()=>false},
    chooseActor(id){context.startZoomPending=null;view.actorId=id;effects.push('select:'+id)},
    render(){effects.push('render')},centerSelectedActor(){effects.push('center:'+view.actorId)},
    showMapCard(){effects.push('map')},activeAreaMode:state=>state.turnPhase,fireZoomPhase:null};
  runInNewContext(`${startSource}\n${zoomSource}\nglobalThis.start=startView;globalThis.sizeMap=applyMapSize;`,context);
  context.sizeMap();
  return {context,state,size,view,effects,
    frame(){for(const fn of frames.splice(0))fn()},
    hex:()=>Math.sqrt(3)*34*nativeMap.getBoundingClientRect().width/790};
}

test('390/FR320/landscape starts settle at 52px after final layout and scrollbar changes',()=>{
  for(const [width,height] of [[323,205],[253,162],[772,140]]){
    const model=scene({width,height});model.context.start();
    assert.equal(model.view.actorId,'own');
    assert.equal(model.view.zoom,1);
    model.frame();model.size.height-=12;model.frame();
    assert.ok(Math.abs(model.hex()-52)<.01);
    assert.ok(model.view.zoom<=4);
    assert.deepEqual(model.effects,['select:own','render','center:own','map']);
  }
});

test('a real mission identity arms once; fit, actor/phase/weapon/target changes do not rearm it',()=>{
  const model=scene();model.context.start();model.frame();model.frame();
  model.view.zoom=1;model.view.actorId='other';model.context.rev='after-controls';
  model.context.start();model.frame();model.frame();
  assert.equal(model.view.zoom,1);assert.equal(model.view.actorId,'other');
  model.state.markers.binding.epoch++;model.context.start();model.frame();model.frame();
  assert.ok(model.hex()>=51.99);
  model.state.markers.binding={scenarioId:'relay-run',profileId:'FIELD_TEST_LEGACY_v1',sessionId:7};
  model.context.start();model.frame();model.frame();
  assert.equal(model.effects.filter(effect=>effect==='center:own').length,3);
});

test('pending initial zoom never overwrites manual fit, a changed snapshot, reset, or a new actor',()=>{
  for(const interrupt of ['fit','revision','actor','reset']){
    const model=scene();model.context.start();model.frame();
    if(interrupt==='revision')model.context.rev='changed-phase-or-weapon';
    else if(interrupt==='actor')model.view.actorId='other';
    else if(interrupt==='reset')model.context.startZoomPending=null;
    else{
      const fit=source.match(/    function fitMap\(\) \{[^\n]+\}/)[0];
      runInNewContext(`${fit}\nfitMap();`,model.context);
    }
    model.frame();
    assert.equal(model.view.zoom,1,interrupt);
    assert.equal(model.effects.some(effect=>effect.startsWith('center:')),false,interrupt);
  }
});

test('desktop skips start selection and tiny layouts retain the existing fourfold ceiling',()=>{
  const desktop=scene({width:900,height:464,compact:false});desktop.context.start();desktop.frame();desktop.frame();
  assert.equal(desktop.view.zoom,1);assert.equal(desktop.view.actorId,null);
  assert.deepEqual(desktop.effects,[]);
  const tiny=scene({width:80,height:50});tiny.context.start();tiny.frame();tiny.frame();
  assert.equal(tiny.view.zoom,4);assert.ok(tiny.hex()<52);
});

test('only a successful start or accepted restart requests the initial view after showing play',async()=>{
  const restart=flow.slice(flow.indexOf('    async function confirmRestart() {'),flow.indexOf('    async function goToLevels() {'));
  for(const accepted of [false,true])for(const engine of ['core','legacy']){
    const calls=[];
    const context={GameDialogs:{isOpen:()=>false,confirm:async()=>accepted},t:key=>key,
      currentScenario:'relay-run',loadScenario:id=>calls.push('load:'+id),
      IronDustBrowserV2:{mode:engine==='core'?'ready':'inactive',restart(){calls.push('restart')}},
      GoblinUIV2:{resetView(){calls.push('reset')},startView(){calls.push('start-view')}},
      show:screen=>calls.push(screen),releasePause:()=>calls.push('resume'),renderScreen(){}};
    runInNewContext(restart+'\nglobalThis.restart=confirmRestart;',context);
    await context.restart();
    assert.deepEqual(calls,accepted?[engine==='core'?'restart':'load:relay-run','reset','play','resume','start-view']:[]);
  }
  const start=flow.slice(flow.indexOf('    async function startMission() {'),flow.indexOf('    function libraryAssetId('));
  for(const succeeds of [false,true]){
    const calls=[],context={GameDialogs:{isOpen:()=>false},missionData:()=>({}),missionId:'iron-dust-v2',
      t:key=>key,renderScreen(){},IronDustBrowserV2:{available:true,start:()=>succeeds},
      document:{querySelector:()=>({})},GoblinUIV2:{resetView(){calls.push('reset')},startView(){calls.push('start-view')}},
      show:screen=>calls.push(screen),releasePause:()=>calls.push('resume')};
    runInNewContext(start+'\nglobalThis.start=startMission;',context);
    await context.start();
    assert.deepEqual(calls,succeeds?['reset','play','resume','start-view']:[]);
  }
  const calls=[],context={GameDialogs:{isOpen:()=>false},missionData:()=>({}),missionId:'relay-run',
    scenarioCatalog:{'relay-run':{}},loadScenario:id=>calls.push('load:'+id),
    IronDustBrowserV2:{stop:()=>calls.push('stop-core')},document:{querySelector:()=>({})},
    GoblinUIV2:{resetView(){calls.push('reset')},startView(){calls.push('start-view')}},
    show:screen=>calls.push(screen),releasePause:()=>calls.push('resume')};
  runInNewContext(start+'\nglobalThis.start=startMission;',context);await context.start();
  assert.deepEqual(calls,['stop-core','load:relay-run','reset','play','resume','start-view']);
});
