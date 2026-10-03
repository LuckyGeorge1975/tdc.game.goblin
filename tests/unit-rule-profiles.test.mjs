import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_CATALOG,OGRE_SYSTEMS,UNIT_RULES} from '../rules.mjs';

const profiles=JSON.parse(readFileSync(new URL('../assets/unit-art/rules/unit-profiles.v1.json',import.meta.url),'utf8'));
const catalogKeys={
  'rocket-artillery':'missileTank','infantry-squad':'infantry','assault-tank':'heavyTank',
  'recon-tank':'lightTank','siege-tank':'superheavyTank','long-range-battery':'howitzer',
  'mobile-siege-gun':'mobileHowitzer','combat-skimmer':'gev','light-skimmer':'lightGev',
  'skimmer-carrier':'gevPc','strategic-missile-carrier':'missileCrawler',
  'artillery-drone':'lightArtilleryDrone','amphibious-infantry':'marines',
  'field-engineers':'combatEngineers','local-defense':'militia','command-hub':'commandPost'
};
const systemKeys={'goblin-siegebreaker':'mkIII','forge-engineer':'vulcan',
  'goblin-dreadnaught':'mkV','phantom-platform':'ninja'};

test('the published ATLAS tuples remain an immutable 26-unit Legacy snapshot',()=>{
  const rows=Object.entries(profiles.units).map(([id,record])=>[id,record.legacy]);
  assert.equal(rows.length,26);
  assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    'ecf9e3ad05c5b4156ae3e25c06ee821ea4b17bfa583dec4e4c27cad6a0706871');
});

test('the target profile mirrors the numeric catalog and declared traits',()=>{
  assert.equal(profiles.schemaVersion,1);
  assert.equal(profiles.targetActive,false);
  assert.equal(Object.keys(profiles.units).length,26);
  for(const [id,key] of Object.entries(catalogKeys)){
    const expected=UNIT_CATALOG[key],actual=profiles.units[id].target;
    assert.equal(actual.source,`UNIT_CATALOG.${key}`,id);
    for(const field of ['attack','range','defense','mode','halfUnit','maxSquads','splitFire',
      'antipersonnel','setupValue','transportSquads','splashAttack','blastRadius',
      'ammunition','cruiseMissile','transportable','waterCombat','engineering',
      'cannonFodder','commandUnit']){
      assert.equal(actual[field],expected[field],`${id}.${field}`);
    }
    assert.deepEqual(actual.movement,expected.movement,`${id}.movement`);
    assert.equal('hp' in actual,false,id);
  }
});

test('platform and stealth targets preserve system contracts without invented HP',()=>{
  for(const [id,key] of Object.entries(systemKeys)){
    const expected=OGRE_SYSTEMS[key],actual=profiles.units[id].target;
    assert.equal(actual.source,`OGRE_SYSTEMS.${key}`,id);
    assert.equal(actual.system,key,id);
    for(const field of ['tread','mainBatteries','secondaryBatteries','missiles',
      'antipersonnel','engineering','drones','stealth']){
      assert.equal(actual[field],expected[field],`${id}.${field}`);
    }
    if(expected.movement)assert.deepEqual(actual.movement,expected.movement,id);
    assert.equal('hp' in actual,false,id);
    assert.equal('defense' in actual,false,id);
  }
});

test('six catalog gaps have explicit Guide/Legacy definitions',()=>{
  const gaps=['skimmer-scout','infantry-platoon','command-core','relay-node','guard-tank','raider-skimmer'];
  for(const id of gaps)assert.match(profiles.units[id].target.source,/Guide\/Legacy|UNIT_RULES.gev/);
  const scout=profiles.units['skimmer-scout'].target;
  assert.deepEqual(scout.movement,[UNIT_RULES.gev.move,UNIT_RULES.gev.secondMove]);
  assert.equal(scout.range,UNIT_RULES.gev.range);
  assert.equal(scout.attack,UNIT_RULES.gev.damage);
  assert.equal(profiles.units['infantry-platoon'].target.mode,'infantry');
  assert.equal(profiles.units['command-core'].target.mode,'fixed');
  assert.equal(profiles.units['raider-skimmer'].target.mode,'gev');
});
