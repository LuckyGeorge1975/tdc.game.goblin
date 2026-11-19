import assert from 'node:assert/strict';
import test from 'node:test';
import {isDeepFrozenData} from '../src/core/frozen-state-validation.mjs';
import {createIronDustProfile,validateIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {validateIronDustUnifiedStateProbe} from '../src/core/iron-dust-unified-state-probe.mjs';
import {listIronDustPlayerMoves,queryIronDustPlayerMove} from '../src/core/iron-dust-player-move-probe.mjs';

test('immutable validation caching excludes mutable descendants and accessors',()=>{
  assert.equal(isDeepFrozenData(Object.freeze({child:{value:1}})),false);
  assert.equal(isDeepFrozenData(Object.freeze({get value(){return 1;}})),false);
  assert.equal(isDeepFrozenData(Object.freeze({child:Object.freeze({value:1})})),true);
});

test('successful validation never caches a mutable or shallow-frozen profile',()=>{
  const original=createIronDustProfile(8);
  assert.equal(validateIronDustProfile(original),original);
  assert.equal(validateIronDustProfile(original),original);
  for(const shallow of [false,true]) {
    const copy=structuredClone(original);
    if(shallow) Object.freeze(copy);
    assert.equal(validateIronDustProfile(copy),copy);
    copy.entry.payload.units[0].x=99;
    assert.throws(()=>validateIronDustProfile(copy),/IRON_DUST_PROFILE_MISMATCH/);
  }
});

test('shallow-frozen native state is checked again after a mutable child changes',()=>{
  const state=structuredClone(createIronDustProfile(8).entry.payload);
  Object.freeze(state);
  validateIronDustUnifiedStateProbe(state);
  state.units[0].x=99;
  assert.throws(()=>validateIronDustUnifiedStateProbe(state),/UNIFIED_STATE_MISMATCH/);
});

test('cached native paths preserve caller ownership of the returned path array',()=>{
  const state=createIronDustProfile(8).entry.payload;
  const move=listIronDustPlayerMoves(state,'ogre')[0];
  const command={type:'Move',playerId:'player',unitId:'ogre',to:move.to};
  const first=queryIronDustPlayerMove(state,command);
  assert.equal(first.available,true);
  const expected=structuredClone(first);
  first.path.length=0;
  assert.deepEqual(queryIronDustPlayerMove(state,command),expected);
});
