import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameManager,createPlayerController} from '../src/core/game-manager.mjs';

const level={seatIds:['player','enemy'],maxSeats:2};
const capabilities={
  player:{human:true,ai:[{id:'player-weak',difficulty:'weak'},{id:'trained',difficulty:null}]},
  enemy:{human:true,ai:[{id:'enemy-weak',difficulty:'weak'},{id:'enemy-strong',difficulty:'strong'}]}
};

test('the configured seat order is stable and the level capacity limits occupancy',()=>{
  const manager=createGameManager(level,capabilities);
  assert.deepEqual(manager.seats.map(seat=>seat.id),['player','enemy']);
  assert.deepEqual(manager.assign({enemy:'enemy-weak',player:null}),[
    {seatId:'player',controller:'human'},
    {seatId:'enemy',controller:'ai',policyId:'enemy-weak',difficulty:'weak'}
  ]);
  assert.ok(Object.isFrozen(manager.seats));
  const defender=createGameManager({seatIds:['enemy'],maxSeats:1},capabilities);
  assert.deepEqual(defender.assign({enemy:null}),[{seatId:'enemy',controller:'human'}]);
  for (const invalid of [{...level,maxSeats:1},{...level,maxSeats:3},{...level,seatIds:['enemy','enemy']}])
    assert.throws(()=>createGameManager(invalid,capabilities),{code:'GAME_SEAT_LAYOUT_INVALID'});
  assert.throws(()=>manager.assign({player:null,enemy:null,third:null}),{code:'GAME_SEAT_SELECTION_INVALID'});
  assert.throws(()=>manager.assign({player:null}),{code:'GAME_SEAT_SELECTION_INVALID'});
});

test('AI permission and minimum govern only AI, qualification belongs to each seat',()=>{
  const minimum=createGameManager({...level,minimumDifficulty:'medium'},capabilities);
  assert.deepEqual(minimum.assign({player:null,enemy:null}),
    [{seatId:'player',controller:'human'},{seatId:'enemy',controller:'human'}]);
  assert.deepEqual(minimum.seats.map(seat=>seat.ai.map(option=>option.id)),[[],['enemy-strong']]);
  assert.throws(()=>minimum.assign({player:'trained',enemy:null}),{code:'AI_BELOW_MINIMUM'});
  assert.throws(()=>minimum.assign({player:null,enemy:'enemy-weak'}),{code:'AI_BELOW_MINIMUM'});
  assert.throws(()=>minimum.assign({player:null,enemy:'trained'}),{code:'AI_SEAT_NOT_QUALIFIED'});
  const learning=createGameManager({...level,aiAllowed:false},capabilities);
  assert.equal(learning.assign({player:null,enemy:null}).length,2);
  assert.throws(()=>learning.assign({player:null,enemy:'enemy-strong'}),{code:'AI_LEVEL_FORBIDDEN'});
  const noHumanDefender=createGameManager(level,{...capabilities,enemy:{...capabilities.enemy,human:false}});
  assert.throws(()=>noHumanDefender.assign({player:null,enemy:null}),{code:'HUMAN_SEAT_UNAVAILABLE'});
});

test('IPlayer calls the controller only for its own projected side and returns its offered reference',async()=>{
  let calls=0;
  const view=Object.freeze({side:'enemy'});
  const decision=Object.freeze({side:'enemy',view,candidates:Object.freeze([{key:'legal'}])});
  const controller=createPlayerController('enemy',async(offer,report)=>{
    calls++;
    assert.equal(offer.view,view);
    report(offer.candidates[0].key);
    return offer.candidates[0].key;
  });
  assert.equal(controller.nextCommand({...decision,side:'player'}),undefined);
  assert.equal(controller.nextCommand({...decision,view:{side:'player'}}),undefined);
  assert.equal(calls,0);
  assert.equal(await controller.nextCommand(decision,key=>assert.equal(key,'legal')),'legal');
  assert.equal(calls,1);
});
