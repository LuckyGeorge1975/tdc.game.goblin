import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function theme(){
  const picker={value:'',options:[],appendChild(option){this.options.push(option)},
    addEventListener(type,listener){this[type]=listener}};
  const storage=new Map();
  let progress=false,accept=true,restarts=0;
  const context=vm.createContext({
    document:{querySelector(selector){return selector==='#art-style-select'?picker:null},querySelectorAll(){return []},
      createElement(tag){return {tag,value:'',textContent:''}}},
    localStorage:{getItem(key){return storage.get(key)||null},setItem(key,value){storage.set(key,value)}},
    GameDialogs:{isOpen(){return false},confirm:async()=>accept},
    units:[],selected:null,unitGuideEntries:[],guideIndex:0,currentScenario:'iron-dust',gameOver:false,
    updateRoster(){},showCarrierCargo(){},updateSelection(){},renderUnitGuide(){},
    hasScenarioProgress(){return progress},loadScenario(){restarts++},draw(){}
  });
  for(const file of ['unit-visuals.js','art-theme.js'])
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  return {picker,context,storage,setProgress(value){progress=value},setAccept(value){accept=value},restarts:()=>restarts};
}

test('icon-set selector lists all five sets and restarts the current scenario',async()=>{
  const state=theme(),next=state.picker.options[1].value;
  assert.equal(state.picker.options.length,5);
  assert.equal(state.context.UnitVisuals.currentStyle(),state.picker.options[0].value);
  const before=state.context.UnitVisuals.assetFor({name:'ASSAULT TANK'});
  state.picker.value=next;
  await state.picker.change();
  assert.equal(state.context.UnitVisuals.currentStyle(),next);
  assert.notEqual(state.context.UnitVisuals.assetFor({name:'ASSAULT TANK'}),before);
  assert.equal(state.restarts(),1);
  assert.equal(state.storage.get('goblin-art-style'),next);
});

test('canceling an icon-set change preserves both artwork and game state',async()=>{
  const state=theme(),initial=state.context.UnitVisuals.currentStyle();
  state.setProgress(true);
  state.setAccept(false);
  state.picker.value=state.picker.options[2].value;
  await state.picker.change();
  assert.equal(state.context.UnitVisuals.currentStyle(),initial);
  assert.equal(state.picker.value,initial);
  assert.equal(state.restarts(),0);
  state.setAccept(true);
  state.picker.value=state.picker.options[2].value;
  await state.picker.change();
  assert.equal(state.restarts(),1);
});
