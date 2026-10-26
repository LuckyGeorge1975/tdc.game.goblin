import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const load=(context,file)=>vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const key='goblin.presentation.animation.v1';
function scene(storage,extra={}){
  const context=vm.createContext({localStorage:storage,...extra});
  load(context,'presentation-preferences.js');return context;
}
function store(saved){
  const entries=new Map([['other-setting','keep'],...(saved===undefined?[]:[[key,saved]])]);
  return {entries,getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
}

test('versioned preference defaults high without OS policy or writes to existing settings',()=>{
  let osQueries=0;
  const storage=store(),context=scene(storage,{matchMedia(){osQueries++;return {matches:true};}});
  assert.equal(context.GoblinPresentationPreferences.read().mode,'high');
  assert.equal(osQueries,0);
  assert.equal(storage.entries.size,1);assert.equal(storage.entries.get('other-setting'),'keep');
  assert.equal(context.GoblinPresentationPreferences.set('unknown'),false);
  assert.equal(storage.entries.size,1);
});

test('all explicit choices persist across reload under their own key and return immutable snapshots',()=>{
  const storage=store();
  for(const mode of ['high','normal','off']){
    const api=scene(storage).GoblinPresentationPreferences;
    assert.equal(api.set(mode),true);
    assert.equal(scene(storage).GoblinPresentationPreferences.read().mode,mode);
    assert.equal(JSON.parse(storage.entries.get(key)).schemaVersion,1);
    assert.equal(storage.entries.get('other-setting'),'keep');
    assert.equal(Object.isFrozen(api.read()),true);
  }
});

test('unknown, corrupt and incompatible storage values fall back high without overwriting them',()=>{
  for(const saved of ['bad JSON','null','[]','"off"','{"schemaVersion":2,"mode":"off"}',
    '{"schemaVersion":1,"mode":"weird"}','{"schemaVersion":1,"mode":"off","other":1}']){
    const storage=store(saved),api=scene(storage).GoblinPresentationPreferences;
    assert.equal(api.read().mode,'high');assert.equal(storage.entries.get(key),saved);
    api.set('normal');assert.equal(api.read().mode,'normal');
  }
});

test('security/getter/quota storage failures keep default and functional session selection',()=>{
  for(const propertyFailure of [false,true]){
    const context=vm.createContext({});
    if(propertyFailure)Object.defineProperty(context,'localStorage',{get(){throw new Error('SecurityError');}});
    else context.localStorage={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceededError');}};
    load(context,'presentation-preferences.js');const api=context.GoblinPresentationPreferences;
    assert.equal(api.read().mode,'high');assert.doesNotThrow(()=>api.set('off'));assert.equal(api.read().mode,'off');
  }
});

for(const runtime of ['core','legacy'])for(const team of ['player','enemy'])test(`${runtime}/${team}: action freezes preference until the next accepted action; session changes keep explicit choice`,()=>{
  const context=scene(store(),{Math:Object.assign(Object.create(Math),{random(){throw Error('presentation called RNG');}})});
  load(context,'presentation-state.js');
  const api=context.GoblinPresentationPreferences,owner=context.GoblinPresentation;
  const state={units:[{id:'actor',team,visualKey:'guard-tank',x:1,y:2,hp:3}]};
  const binding={runtime,sessionId:1};owner.bind(binding,state);
  api.set('normal');const ticket=owner.begin({type:'Move'},state);
  assert.equal(ticket.animationPreference.mode,'normal');assert.equal(Object.isFrozen(ticket.animationPreference),true);
  api.set('off');owner.synchronize(state);assert.equal(owner.read().animationPreference.mode,'high');
  const after={units:[{...state.units[0],x:2}]},beforeJson=JSON.stringify(after);
  owner.confirm(ticket,after,[],[{kind:'move',actorId:'actor',from:{x:1,y:2},to:{x:2,y:2},path:[{x:2,y:2}],sourceEventIndex:0}]);
  assert.equal(owner.read().animationPreference.mode,'normal');
  assert.equal(owner.events()[0].event.action.animationPreference.mode,'normal');
  assert.equal(owner.events()[0].status,'settled','all preferences retain current instant end-state behavior');
  assert.equal(JSON.stringify(after),beforeJson);
  owner.confirm({},after,[],[]);assert.equal(owner.read().animationPreference.mode,'normal','invalid ticket cannot activate choice');
  const next=owner.begin({type:'SelectWeapon'},after);owner.confirm(next,after,[],[]);
  assert.equal(owner.read().animationPreference.mode,'off');
  owner.stop();owner.bind({...binding,sessionId:2},state);
  assert.equal(api.read().mode,'off');assert.equal(owner.read().animationPreference.mode,'off');
});

test('active options use labeled native segments, exact four-language labels and 44px targets',async()=>{
  const source=readFileSync(new URL('../ui-v2-flow.js',import.meta.url),'utf8');
  const first=source.indexOf("        const animation=document.createElement('fieldset')");
  const last=source.indexOf("        const grid = document.createElement('label')",first);
  assert.ok(first>source.indexOf("screen === 'options'"));
  const code=source.slice(first,last)+'\nglobalThis.output=animation;';
  const node=tag=>({tag,children:[],attributes:{},dataset:{},append(...items){this.children.push(...items);},
    setAttribute(k,v){this.attributes[k]=v;}});
  const context=scene(store(),{URL,URLSearchParams,console,
    document:{readyState:'loading',currentScript:{src:'http://localhost/localization.js'},addEventListener(){},createElement:node},
    location:{href:'http://localhost/',search:''},navigator:{language:'de'},fetch:async()=>({ok:true,json:async()=>({messages:{}})})});
  load(context,'localization.js');await context.GoblinLanguage.ready;
  const expectations={de:['Animation','Hoch','Normal','Aus'],en:['Animation','High','Normal','Off'],
    es:['Animación','Alta','Normal','Desactivada'],fr:['Animation','Élevée','Normale','Désactivée']};
  for(const [lang,labels] of Object.entries(expectations)){
    context.t=key=>context.GoblinLanguage.t(key,{},lang);
    context.button=(label,action)=>Object.assign(node('button'),{type:'button',textContent:label,onclick:action});
    vm.runInContext(`{${code}}`,context);
    const [legend,choices]=context.output.children;
    assert.equal(legend.tag,'legend');assert.equal(legend.textContent,labels[0]);
    assert.deepEqual(choices.children.map(item=>item.textContent),labels.slice(1));
    for(const choice of choices.children){
      assert.equal(choice.tag,'button');assert.equal(choice.type,'button');choice.onclick();
      assert.equal(context.GoblinPresentationPreferences.read().mode,choice.dataset.animationMode);
      assert.equal(choice.attributes['aria-pressed'],'true');
      assert.equal(choices.children.filter(item=>item.attributes['aria-pressed']==='true').length,1);
    }
  }
  const css=readFileSync(new URL('../ui-v2.css',import.meta.url),'utf8');
  assert.match(css,/\.v2-animation-segments button \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(css,/:is\(button, select, input\):focus-visible/);
});
