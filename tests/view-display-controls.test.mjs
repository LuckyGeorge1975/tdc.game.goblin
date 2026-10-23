import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../view-display-controls.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const flow=readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
function scene(width=779,widths=[90,52,49,58,54,65]){
  let resized;
  const document={activeElement:null};
  class Node{
    constructor(){this.children=[];this.dataset={};this.attrs={};this.width=0;this.hidden=false;}
    append(...nodes){this.children.push(...nodes)}
    replaceChildren(...nodes){this.children=nodes}
    setAttribute(key,value){this.attrs[key]=String(value)}
    removeAttribute(key){delete this.attrs[key]}
    contains(node){return node===this||this.children.some(child=>child.contains(node))}
    cloneNode(){const clone=new Node();clone.width=this.width;return clone}
    focus(){document.activeElement=this}
    getBoundingClientRect(){return {width:this.children.reduce((sum,child)=>sum+child.width,0)+Math.max(0,this.children.length-1)*4}}
  }
  document.createElement=()=>new Node();
  const container=new Node();container.clientWidth=width;
  const disclosure=new Node(),panel=new Node(),buttons=widths.map(width=>{const node=new Node();node.width=width;return node});
  container.append(...buttons.slice(0,3),disclosure,panel);panel.append(...buttons.slice(3));
  const context=vm.createContext({document,ResizeObserver:class{constructor(fn){resized=fn}observe(){}}});
  vm.runInContext(source,context);
  const control=context.GoblinDisplayControls.create(container,{disclosure,panel,buttons});
  return {control,container,disclosure,panel,buttons,document,resize:()=>resized()};
}

test('actual six-button intrinsic width selects direct access or inline disclosure, regardless of viewport rule',()=>{
  for(const widths of [[90,52,49,58,54,65],[55,48,56,48,66,71],[102,61,65,89,82,52],[104,44,45,58,76,61]]){
    const model=scene(779,widths);model.control.update();
    assert.equal(model.disclosure.hidden,true);assert.equal(model.panel.hidden,false);
    for(const width of [325,255]){
      model.container.clientWidth=width;model.resize();
      assert.equal(model.disclosure.hidden,false);assert.equal(model.panel.hidden,true);
      model.disclosure.onclick();assert.equal(model.panel.hidden,false);
      model.disclosure.onclick();assert.equal(model.panel.hidden,true);
    }
    const probe=model.container.children.at(-1);
    assert.equal(probe.inert,true);assert.equal(probe.attrs['aria-hidden'],'true');
    assert.ok(probe.children[0].children.every(button=>button.tabIndex===-1));
  }
});

test('resize preserves the same focused child; Escape closes only the disclosure and restores its focus',()=>{
  const model=scene();model.control.update();model.buttons[4].focus();
  model.container.clientWidth=255;model.resize();
  assert.equal(model.document.activeElement,model.buttons[4]);assert.equal(model.panel.hidden,false);
  for(const key of ['Enter',' '])assert.equal(model.control.handleKeydown({key,target:model.disclosure}),false);
  let prevented=0,stopped=0;
  assert.equal(model.control.handleKeydown({key:'Escape',target:model.buttons[4],
    preventDefault(){prevented++},stopImmediatePropagation(){stopped++}}),true);
  assert.equal(model.panel.hidden,true);assert.equal(model.document.activeElement,model.disclosure);
  assert.equal(prevented,1);assert.equal(stopped,1);
  model.container.clientWidth=779;model.resize();
  assert.equal(model.disclosure.hidden,true);assert.equal(model.document.activeElement,model.buttons[3]);
  assert.equal(model.control.handleKeydown({key:'Escape',target:model.buttons[3]}),false);
});

test('view flags default on and synchronize current option inputs and pressed toolbar state without game-state writes',()=>{
  const viewSource=ui.match(/    const view = \{[\s\S]*?\};/)[0];
  const setter=ui.slice(ui.indexOf('    function setViewFlag('),ui.indexOf('    function clearContext()'));
  const toolbar=ui.slice(ui.indexOf("      const gridButton = at('#v2-area-grid');"),ui.indexOf("      const nativeGrid = document.querySelector('#grid-toggle');"));
  const reset=ui.slice(ui.indexOf('    function resetView() {'),ui.indexOf('    globalThis.GoblinUIV2 ='));
  const inputs=Object.fromEntries(['grid','targets','damage'].map(key=>['#v2-'+key,{}]));
  const nodes=new Map(),events=new Map();
  const context=vm.createContext({Event:class{constructor(type){this.type=type}},
    at:selector=>{if(!nodes.has(selector))nodes.set(selector,{attrs:{},setAttribute(key,value){this.attrs[key]=String(value)}});return nodes.get(selector)},
    displayControls:{update(){}},t:key=>key,clearContext(){},clearTimeout(){},applyMapSize(){},
    startZoomPending:null,fireZoomPhase:null,surface:{querySelector:selector=>inputs[selector]}});
  context.addEventListener=(type,fn)=>events.set(type,fn);
  context.dispatchEvent=event=>events.get(event.type)?.();
  vm.runInContext(viewSource+setter+reset+'\nglobalThis.flags=view;globalThis.set=setViewFlag;globalThis.reset=resetView;',context);
  const options=flow.slice(flow.indexOf("    globalThis.addEventListener('goblin-view-settings-change'"),flow.indexOf('    new MutationObserver(() =>'));
  context.GoblinUIV2={get gridVisible(){return context.flags.gridVisible},get targetsVisible(){return context.flags.targetsVisible},get damageVisible(){return context.flags.damageVisible}};
  vm.runInContext(options,context);
  context.render=()=>vm.runInContext('{'+toolbar+'}',context);
  assert.equal(context.flags.gridVisible,false);assert.equal(context.flags.targetsVisible,true);assert.equal(context.flags.damageVisible,true);
  context.set('targetsVisible',false);context.set('damageVisible',false);context.set('gridVisible',true);
  assert.equal(inputs['#v2-targets'].checked,false);assert.equal(inputs['#v2-damage'].checked,false);assert.equal(inputs['#v2-grid'].checked,true);
  assert.equal(nodes.get('#v2-area-targets').attrs['aria-pressed'],'false');
  assert.equal(nodes.get('#v2-area-damage').attrs['aria-pressed'],'false');
  assert.equal(nodes.get('#v2-area-grid').attrs['aria-pressed'],'true');
  context.reset();
  assert.equal(context.flags.targetsVisible,false);assert.equal(context.flags.damageVisible,false);assert.equal(context.flags.gridVisible,true);
  const fresh=vm.createContext({});vm.runInContext(viewSource+'\nglobalThis.flags=view;',fresh);
  assert.equal(fresh.flags.targetsVisible,true);assert.equal(fresh.flags.damageVisible,true);
});

test('all four languages provide visible display labels and a distinct mission-pin accessibility name',()=>{
  const localization=readFileSync(new URL('../localization.js',import.meta.url),'utf8');
  for(const [key,values] of Object.entries({group:['Anzeige','Display','Visualización','Affichage'],
    targets:['Ziele','Targets','Objetivos','Objectifs'],damage:['Schaden','Damage','Daño','Dégâts']})){
    const literal=localization.match(new RegExp("'v2\\.display\\."+key+"': (\\{[^\\n]+\\})"))[1];
    const translated=vm.runInNewContext('('+literal+')');
    assert.deepEqual(['de','en','es','fr'].map(lang=>translated[lang]),values);
  }
  assert.match(ui,/<button type="button" id="v2-display-toggle" aria-expanded="false" aria-controls="v2-display-controls" hidden>/);
  assert.match(localization,/'v2\.display\.missionTargets':/);
});
