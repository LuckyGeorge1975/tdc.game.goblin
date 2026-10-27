import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createIronDustBrowserSession} from '../iron-dust-browser-v2.mjs';
import {buildIronDustV2View} from '../iron-dust-v2-view.mjs';

test('active Core sidebar/field/objective project the same frozen target and system values as the effect layer',()=>{
  const session=createIronDustBrowserSession(),source=buildIronDustV2View(session.projection,session.profile.header.ruleProfileId);
  const displayed=JSON.parse(JSON.stringify(session.projection.state));
  const target=displayed.units.find(unit=>unit.id==='core');target.hp=2;target.disabled=true;
  const actual=source.units.find(unit=>unit.id==='core');actual.hp=0;actual.disabled=true;
  source.victory={status:'ended',winner:'player'};source.mode='ended';
  const text=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
  const start=text.indexOf('    let idleCoreLog='),end=text.indexOf('    function query(command)',start);
  const context=vm.createContext({structuredClone,core:()=>true,revision:()=> 'canonical-final',t:key=>key,coreOpenCount:()=>0,
    GoblinMovement:{projectedState:()=>displayed},IronDustBrowserV2:{view:source,epoch:1,formatEvent:()=>''}});
  for(const file of ['ogre-systems.js','m1-unit-markers.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  vm.runInContext(text.slice(start,end)+'globalThis.projected=project();',context);
  const projected=context.projected,unit=projected.units.find(unit=>unit.id==='core');
  assert.equal(unit.hp,2);assert.equal(unit.disabled,true);assert.equal(projected.gameOver,false);
  assert.equal(projected.objective.coreHp,2);assert.equal(projected.markers.units.find(unit=>unit.unitId==='core').vitality.current,2);
  const actor=projected.units.find(unit=>unit.id==='ogre');
  assert.equal(actor.weapons.main.ready,context.GoblinSystems.weaponReady(actor.ogreSystems.weapons.main));
  assert.equal(source.units.find(unit=>unit.id==='core').hp,0,'display never rewrites canonical view');
});
