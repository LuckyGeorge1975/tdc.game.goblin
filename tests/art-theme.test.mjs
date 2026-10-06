import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function theme(){
  const picker={value:'',options:[],appendChild(option){this.options.push(option)},
    addEventListener(type,listener){this[type]=listener}};
  const symbol={classList:{add(){}},replaceChildren(node){this.art=node;this.image=node.tag==='picture'?node.children[1]:node}};
  const storage=new Map();
  let dialogOpen=false,restarts=0,draws=0,guideRenders=0,selectionRenders=0;
  const units=[{id:'ogre',name:'GOBLIN SIEGEBREAKER',team:'player',x:1,y:5,hp:3,maxHp:5,moveCount:1}];
  const context=vm.createContext({
    document:{querySelector(selector){return selector==='#art-style-select'?picker:selector==='#guide-symbol'?symbol:null},querySelectorAll(){return []},
      createElement(tag){return {tag,value:'',textContent:'',children:[],append(...nodes){this.children.push(...nodes)}}}},
    localStorage:{getItem(key){return storage.get(key)||null},setItem(key,value){storage.set(key,value)}},
    GameDialogs:{isOpen(){return dialogOpen}},
    units,selected:units[0],unitGuideEntries:[{name:'ASSAULT TANK'}],guideIndex:0,
    currentScenario:'iron-dust',gameOver:false,phase:'player',turnPhase:'fire',turn:3,
    updateRoster(){},showCarrierCargo(){},updateSelection(){selectionRenders++},renderUnitGuide(){guideRenders++},
    loadScenario(){restarts++},draw(){draws++}
  });
  for(const file of ['unit-visuals.js','art-theme.js'])
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  return {picker,symbol,context,storage,setDialogOpen(value){dialogOpen=value},
    restarts:()=>restarts,draws:()=>draws,guideRenders:()=>guideRenders,
    selectionRenders:()=>selectionRenders};
}

test('icon-set selector redraws both views without changing a running mission',()=>{
  const state=theme(),next=state.picker.options[0].value;
  assert.equal(state.picker.options.length,6);
  assert.equal(state.context.UnitVisuals.currentStyle(),'02-technical-illustration');
  const before=state.context.UnitVisuals.assetFor({name:'ASSAULT TANK'});
  const missionBefore=JSON.stringify({units:state.context.units,selected:state.context.selected,
    phase:state.context.phase,turnPhase:state.context.turnPhase,turn:state.context.turn,
    gameOver:state.context.gameOver,currentScenario:state.context.currentScenario});
  const drawsBefore=state.draws(),guideBefore=state.guideRenders(),selectionBefore=state.selectionRenders();
  state.picker.value=next;
  state.picker.change();
  assert.equal(state.context.UnitVisuals.currentStyle(),next);
  assert.notEqual(state.context.UnitVisuals.assetFor({name:'ASSAULT TANK'}),before);
  assert.equal(state.restarts(),0);
  assert.equal(state.draws(),drawsBefore+1);
  assert.equal(state.guideRenders(),guideBefore+1);
  assert.equal(state.selectionRenders(),selectionBefore+1);
  assert.equal(JSON.stringify({units:state.context.units,selected:state.context.selected,
    phase:state.context.phase,turnPhase:state.context.turnPhase,turn:state.context.turn,
    gameOver:state.context.gameOver,currentScenario:state.context.currentScenario}),missionBefore);
  assert.equal(state.storage.get('goblin-art-style'),next);
});

test('guide uses the large view paired with the chosen icon style',()=>{
  const state=theme();
  state.context.renderUnitGuide();
  const initial=state.symbol.image.src;
  assert.equal(initial,'assets/unit-art/sets/02-technical-illustration/library/assault-tank@768.png');
  assert.equal(state.symbol.art.tag,'picture');
  assert.equal(state.symbol.art.children[0].type,'image/webp');
  assert.equal(state.symbol.art.children[0].srcset,'assets/unit-art/sets/02-technical-illustration/library/assault-tank@1024.webp');
  state.context.UnitVisuals.setStyle('06-military-symbols');
  state.context.renderUnitGuide();
  assert.equal(state.symbol.art.tag,'img');
  assert.equal(state.symbol.image.src,'assets/unit-art/sets/06-military-symbols/library/assault-tank.svg');
  assert.notEqual(state.symbol.image.src,initial);
});

test('an open dialog defers icon changes without changing game state',()=>{
  const state=theme(),initial=state.context.UnitVisuals.currentStyle();
  state.setDialogOpen(true);
  state.picker.value=state.picker.options[2].value;
  state.picker.change();
  assert.equal(state.context.UnitVisuals.currentStyle(),initial);
  assert.equal(state.picker.value,initial);
  assert.equal(state.restarts(),0);
  state.setDialogOpen(false);
  state.picker.value=state.picker.options[2].value;
  state.picker.change();
  assert.equal(state.restarts(),0);
});
