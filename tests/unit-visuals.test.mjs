import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function visualContext(){
  const context=vm.createContext({document:{createElementNS(_ns,name){return {name,attributes:{},classList:{add(){}},setAttribute(key,value){this.attributes[key]=String(value)}}}}});
  vm.runInContext(readFileSync(new URL('../unit-visuals.js',import.meta.url),'utf8'),context);
  return context;
}

test('visuals resolve by visualKey before stable unit id',()=>{
  const {UnitVisuals}=visualContext();
  UnitVisuals.register('scenario-variant',{shape:'objective',label:'V'});
  assert.equal(UnitVisuals.resolve({id:'gev',visualKey:'scenario-variant'}).label,'V');
  assert.equal(UnitVisuals.resolve({id:'gev'}).shape,'skimmer');
});

test('a local asset can replace a vector without changing the unit',()=>{
  const {UnitVisuals}=visualContext(),children=[];
  UnitVisuals.setAsset('heavy-tank','assets/units/assault-tank.svg',{size:46});
  const node=UnitVisuals.draw({appendChild(child){children.push(child)}},{id:'heavy-tank',icon:'A',team:'player'},{x:40,y:50},{ns:'svg',color:'#fff'});
  assert.equal(node.name,'image');
  assert.equal(node.attributes.href,'assets/units/assault-tank.svg');
  assert.equal(node.attributes.width,'46');
  assert.equal(children.length,1);
});

test('remote artwork URLs are rejected',()=>{
  const {UnitVisuals}=visualContext();
  assert.throws(()=>UnitVisuals.setAsset('gev','https://example.com/unit.svg'),/local project path/);
});
