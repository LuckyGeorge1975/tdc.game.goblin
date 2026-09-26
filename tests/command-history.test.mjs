import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function game() {
  const nodes = new Map(), timers = new Map();
  let timerId = 0;
  function element() {
    return {innerHTML:'',textContent:'',checked:false,disabled:false,style:{},dataset:{},
      classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},
      appendChild(){},before(){},querySelector(){return null},animate(){},
      insertAdjacentHTML(_, html){this.innerHTML=html+this.innerHTML}};
  }
  const document = {querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)},
    querySelectorAll(){return []},createElement:element,createElementNS:element,addEventListener(){}};
  const context = vm.createContext({document,structuredClone,console,window:{},GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},
    localStorage:{getItem(){return null}},
    setTimeout(fn){timers.set(++timerId,fn);return timerId},clearTimeout(id){timers.delete(id)}});
  const run = source => vm.runInContext(source,context);
  for(const file of ['game.js','scenario.js','command-history.js'])run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>{}; updateSelection=()=>{}; loadScenario('unit-trial');");
  return {run,timers};
}

test('restart and scenario change wait for approval and preserve canceled commands',async()=>{
  const {run}=game();run("selected=units[0];handleHex(0,6);GameDialogs.confirm=()=>new Promise(resolve=>globalThis.answer=resolve)");
  const restart=run('resetScenario()');assert.equal(run('units[0].x'),0);run('answer(false)');await restart;assert.equal(run('units[0].x'),0);
  run("document.querySelector('#scenario-select').value='iron-dust'");
  const change=run("document.querySelector('#scenario-select').onchange({target:document.querySelector('#scenario-select')})");
  assert.equal(run('currentScenario'),'unit-trial');assert.equal(run("document.querySelector('#scenario-select').value"),'unit-trial');
  run('answer(true)');await change;assert.equal(run('currentScenario'),'iron-dust');assert.equal(run('phaseCommands.length'),0);
});

test('phase cancellation and open-dialog AUTO guard preserve the phase',async()=>{
  const {run}=game();run("GameDialogs.confirm=()=>new Promise(resolve=>globalThis.answer=resolve)");
  const pending=run("confirmPhaseAdvance(()=>setTurnPhase('fire'))");assert.equal(run('turnPhase'),'movement');run('answer(false)');await pending;
  run("GameDialogs.isOpen=()=>true;document.querySelector('#auto-end-turn').checked=true;units.forEach(u=>u.moved=true);maybeAutoAdvancePhase()");assert.equal(run('turnPhase'),'movement');
});

test('L opens loading or the first passenger unloading, respecting phase and focus',()=>{
  const {run}=game();
  run("selected=units[2];handleTransportShortcut({key:'l',preventDefault(){}})");
  assert.equal(run('transportLoadMode.id'),'gev-pc');
  assert.equal(run('phaseCommands.length'),0);
  run("embark(units[3],units[2]);handleTransportShortcut({key:'L',preventDefault(){}})");
  assert.equal(run('transportUnloadMode.cargo.id'),'infantry');
  run("setTurnPhase('fire');handleTransportShortcut({key:'l',preventDefault(){}})");
  assert.equal(run('transportUnloadMode'),null);
  run("setTurnPhase('movement');handleTransportShortcut({key:'l',target:{closest(){return true}},preventDefault(){}})");
  assert.equal(run('transportUnloadMode'),null);
  run("phase='enemy';handleTransportShortcut({key:'l',preventDefault(){}})");
  assert.equal(run('transportUnloadMode'),null);
});

test('movement commands undo in reverse order, restoring log and action budgets',()=>{
  const {run}=game();
  run("selected=units[0]; handleHex(0,6); selected=units[1]; handleHex(2,5)");
  assert.equal(run('phaseCommands.length'),2);
  run('undoPhaseCommand()');
  assert.equal(run('units[1].y'),6);
  assert.equal(run('!!units[1].moved'),false);
  assert.equal(run('units[0].x'),0);
  run('undoPhaseCommand()');
  assert.equal(run('units[0].x'),1);
  assert.equal(run('units[0].moveCount'),0);
  assert.equal(run("logEl.innerHTML.includes('bewegt')"),false);
  assert.equal(run("document.querySelector('#undo-command').disabled"),true);
});

test('loading and unloading restore passenger placement and carrier flags',()=>{
  const {run}=game();
  run('selected=units[2]; embark(units[3],units[2]); unloadAt(units[2],units[3],3,7)');
  assert.equal(run('phaseCommands.length'),2);
  run('undoPhaseCommand()');
  assert.equal(run('units[3].embarkedOn'),'gev-pc');
  run('undoPhaseCommand()');
  assert.equal(run('units[3].embarkedOn'),undefined);
  assert.equal(run('units[3].y'),7);
  assert.equal(run('!!units[2].moved'),false);
});

test('fire undo restores damage and firing budget; repeating a shot cannot reroll',()=>{
  const {run}=game();
  run("setTurnPhase('fire'); terrain.clear(); units[0].damage=4; units[5].defense=3; selected=units[0]; attack(units[0],units[5]);");
  const result=run('units[5].lastOutcome');
  assert.equal(run('phaseCommands.length'),1);
  run('undoPhaseCommand()');
  assert.equal(run('units[5].hp'),5);
  assert.equal(run('!!units[5].disabled'),false);
  assert.equal(run('!!units[0].fired'),false);
  run('attack(units[0],units[5])');
  assert.equal(run('units[5].lastOutcome'),result);
});

test('phase changes, scenario resets, and game over close the command history',()=>{
  for(const boundary of ["setTurnPhase('fire')","loadScenario('iron-dust')","finish(true)"]) {
    const {run}=game();run('selected=units[0];handleHex(0,6)');run(boundary);
    assert.equal(run('phaseCommands.length'),0);
    assert.equal(run("document.querySelector('#undo-command').disabled"),true);
  }
});

test('AUTO waits after last command and BACK cancels its pending phase change',()=>{
  const {run,timers}=game();
  run("document.querySelector('#auto-end-turn').checked=true;units.forEach(u=>u.moved=true);units[0].moved=false;selected=units[0];handleHex(0,6)");
  assert.equal(run('turnPhase'),'movement');
  const id=run('autoPhaseTimer');assert.ok(timers.has(id));
  run('undoPhaseCommand()');assert.equal(timers.has(id),false);
  assert.equal(run('turnPhase'),'movement');assert.equal(run('!!units[0].moved'),false);
});

test('GEV second movement restores only its second-move budget',()=>{
  const {run}=game();
  run("units[2].moved=true;setTurnPhase('gev');selected=units[2];handleHex(3,5)");
  assert.equal(run('units[2].secondMoved'),true);
  run('undoPhaseCommand()');
  assert.equal(run('units[2].y'),6);
  assert.equal(run('units[2].moved'),true);
  assert.equal(run('!!units[2].secondMoved'),false);
});

test('ramming restores the destroyed target and rejected commands add no history',()=>{
  const {run}=game();
  run("loadScenario('iron-dust');terrain.clear();units[5].x=2;units[5].y=5;selected=units[0];handleHex(2,5)");
  assert.equal(run('units[5].hp'),0);
  assert.equal(run('phaseCommands.length'),1);
  run('undoPhaseCommand()');
  assert.equal(run('units[5].hp'),3);
  assert.equal(run('units[0].x'),1);
  run('selected=units[0];handleHex(11,0)');
  assert.equal(run('phaseCommands.length'),0);
});
