import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup(){
  const listeners={},storage=new Map();let dialog;
  const document={activeElement:null,addEventListener(t,fn){listeners[t]=fn},body:{appendChild(n){dialog=n}},createElement(){return element()}};
  function element(){const children=new Map();return {hidden:false,checked:false,isConnected:true,open:false,setAttribute(){},querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s)},addEventListener(t,fn){this[t]=fn},showModal(){this.open=true},close(){this.open=false},focus(){document.activeElement=this}}}
  const trigger=element();document.activeElement=trigger;
  const context=vm.createContext({document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
  vm.runInContext(readFileSync(new URL('../dialogs.js',import.meta.url),'utf8'),context);
  return {api:vm.runInContext('GameDialogs',context),dialog,document,trigger,listeners,storage};
}
test('cancel restores focus; messages use literal text',async()=>{
  const {api,dialog,document,trigger}=setup();const result=api.confirm({title:'Restart?',message:'<b>discard?</b>'});
  assert.equal(dialog.open,true);assert.equal(document.activeElement,dialog.querySelector('.dialog-cancel'));
  assert.equal(dialog.querySelector('p').textContent,'<b>discard?</b>');
  dialog.querySelector('.dialog-cancel').onclick();assert.equal(await result,false);assert.equal(document.activeElement,trigger);
});
test('requests queue and warnings share the dialog; idle waits for every dialog',async()=>{
  const {api,dialog}=setup();const first=api.confirm({title:'First'}),second=api.warn({title:'Second'});
  dialog.querySelector('.dialog-accept').onclick();assert.equal(await first,true);
  assert.equal(dialog.querySelector('h2').textContent,'Second');assert.equal(dialog.querySelector('.dialog-cancel').hidden,true);
  let idle=false;const waiting=api.whenIdle().then(()=>{idle=true});await Promise.resolve();assert.equal(idle,false);
  dialog.querySelector('.dialog-accept').onclick();await second;await waiting;assert.equal(idle,true);
});
test('remember preference requires acceptance and applies only to its dialog key',async()=>{
  const {api,dialog,storage}=setup();let answer=api.confirm({title:'Phase',rememberKey:'phase'});
  dialog.querySelector('input').checked=true;dialog.querySelector('.dialog-cancel').onclick();await answer;assert.equal(storage.has('phase'),false);
  answer=api.confirm({title:'Phase',rememberKey:'phase'});dialog.querySelector('input').checked=true;dialog.querySelector('.dialog-accept').onclick();await answer;
  assert.equal(await api.confirm({rememberKey:'phase'}),true);
  answer=api.confirm({title:'Restart'});assert.equal(api.isOpen(),true);dialog.querySelector('.dialog-cancel').onclick();await answer;
});
test('Escape cancels and blocks gameplay keyboard propagation',async()=>{
  const {api,listeners}=setup();const answer=api.confirm({title:'Phase'});let stopped=false;
  listeners.keydown({key:'Escape',stopImmediatePropagation(){stopped=true},preventDefault(){}});
  assert.equal(await answer,false);assert.equal(stopped,true);
});
