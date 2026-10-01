import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
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

test('six art sets resolve current scenario variants by unit name',()=>{
  const {UnitVisuals}=visualContext();
  const manifest=JSON.parse(readFileSync(new URL('../assets/unit-art/manifest.json',import.meta.url),'utf8'));
  assert.equal(UnitVisuals.styles.length,6);
  assert.equal(manifest.styles.length,6);
  for(const style of UnitVisuals.styles){
    assert.ok(UnitVisuals.setStyle(style.id));
    const metadata=manifest.styles.find(entry=>entry.id===style.id);
    assert.ok(metadata);
    assert.ok(existsSync(new URL(`../assets/unit-art/${metadata.logoFallback||`sets/${style.id}/logo.svg`}`,import.meta.url)));
    for(const {id,name} of manifest.units){
      const unit={id:'scenario-alias',name};
      assert.equal(UnitVisuals.artKey(unit),id);
      for(const view of ['icons','library']){
        const path=UnitVisuals.assetFor(unit,view);
        assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),`${style.id}/${view}/${id}`);
        if(style.id==='06-technical-illustration'&&view==='icons')assert.match(path,/06-technical-illustration\/icons/);
      }
    }
    assert.match(UnitVisuals.resolve({id:'infantry',name:'FIELD ENGINEERS'}).asset,/field-engineers\.svg$/);
    assert.match(UnitVisuals.resolve({id:'core',name:'RELAY NODE'}).asset,/relay-node\.svg$/);
    assert.match(UnitVisuals.resolve({id:'guard',name:'SIEGE TANK'}).asset,/siege-tank\.svg$/);
  }
  assert.equal(UnitVisuals.setStyle('unknown'),false);
});

test('large military library symbol is independent of map style for all 26 units',()=>{
  const {UnitVisuals}=visualContext();
  const manifest=JSON.parse(readFileSync(new URL('../assets/unit-art/manifest.json',import.meta.url),'utf8'));
  for(const style of UnitVisuals.styles){
    UnitVisuals.setStyle(style.id);
    for(const unit of manifest.units){
      const path=UnitVisuals.librarySymbolFor(unit);
      assert.equal(path,`assets/unit-art/library/military-symbols/${unit.id}.svg`);
      assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),path);
    }
  }
});

test('explicit local artwork still overrides the active art set',()=>{
  const {UnitVisuals}=visualContext();
  UnitVisuals.setStyle(UnitVisuals.styles[0].id);
  UnitVisuals.setAsset('heavy-tank','assets/custom-tank.svg');
  assert.equal(UnitVisuals.resolve({id:'heavy-tank',name:'ASSAULT TANK'}).asset,'assets/custom-tank.svg');
});

test('all twelve terrain visuals exist for each runtime style',()=>{
  const {UnitVisuals}=visualContext();
  const types=['open-ground','rubble-field','mountain','ridge','forest','marsh','water','river','road','bridge','urban','crater'];
  for(const style of UnitVisuals.styles){
    UnitVisuals.setStyle(style.id);
    for(const type of types){
      const path=UnitVisuals.terrainAssetFor(type);
      assert.ok(path?.includes(`/terrain/${type}.svg`));
      if(style.id==='06-technical-illustration')assert.ok(path.includes('/01-modular-stealth-geometry/'));
      assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),path);
    }
  }
  assert.equal(UnitVisuals.terrainAssetFor('not-terrain'),null);
});
