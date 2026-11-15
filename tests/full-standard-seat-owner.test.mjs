import assert from 'node:assert/strict';
import test from 'node:test';
import {selectStandardFullDefender, standardFullSeatOffers} from '../full-standard-seat-owner.mjs';

test('only an admitted FULL defender gets the standard option', () => {
  const full = {ruleProfileId:'FULL_CATALOG_v1'};
  const offers = standardFullSeatOffers(full, 'Standardverteidiger');
  assert.deepEqual(offers, {player:[],enemy:[
    {id:'full-native-standard-defender',label:'Standardverteidiger'}
  ]});
  for (const config of [null, {ruleProfileId:'FIELD_TEST_LEGACY_v2'},
    {...full,aiAllowed:false}, {...full,minimumDifficulty:'weak'},
    Object.assign(Object.create({minimumDifficulty:'strong'}),full)])
    assert.equal(standardFullSeatOffers(config,'Standardverteidiger'), null);
});

test('the native baseline is chosen only from defender candidates', () => {
  const candidates = [{key:'alternative',facts:{}},{key:'baseline',facts:{baseline:true}}];
  assert.equal(selectStandardFullDefender({side:'enemy',candidates}), 'baseline');
  assert.equal(selectStandardFullDefender({side:'player',candidates}), undefined);
  assert.equal(selectStandardFullDefender({side:'enemy',candidates:candidates.slice(0,1)}), undefined);
});
