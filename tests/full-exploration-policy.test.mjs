import assert from 'node:assert/strict';
import test from 'node:test';
import {createFullExplorationPolicy} from '../src/core/full-exploration-policy.mjs';

const cell=x=>({x,y:0});
const view=(side='player',observed=[cell(0)])=>({
  side,terrain:{width:6,height:2},observedCells:observed,
  units:[{id:'own',relation:'own',alive:true,disabled:false,embarkedOn:null}],
  objectives:[{kind:side==='player'?'destroy-escort':'destroy-player-force',remaining:1,satisfied:false}]
});
const move=(key,x,coverage=[cell(x)])=>({key,kind:'move',actorId:'own',target:{kind:'cell',...cell(x)},
  facts:{observedCellsAfterMove:coverage}});
const batch=(ownView,candidates)=>({ok:true,side:ownView.side,view:ownView,candidates});

for(const side of ['player','enemy']) test('the '+side+' seat searches new coverage without using an undisclosed target',()=>{
  const policy=createFullExplorationPolicy({side});
  const visible=view(side);
  assert.equal(policy.observe(visible),true);
  const options=[move('old',0),move('fresh',1),move('more',2,[cell(1),cell(2)])];
  const offered=batch(visible,options);
  const initial=JSON.stringify(offered),memory=policy.snapshot();
  assert.equal(policy.select(offered),'more');
  assert.equal(policy.select({...offered,hiddenPosition:{x:1,y:1}}),'more');
  assert.equal(policy.select({...offered,hiddenPosition:{x:5,y:1}}),'more');
  assert.equal(JSON.stringify(offered),initial);
  assert.deepEqual(policy.snapshot(),memory);
});

test('when every area has been observed the search patrols the oldest coverage in cycles',()=>{
  const policy=createFullExplorationPolicy({side:'player'});
  policy.observe(view('player',[cell(0),cell(1),cell(2)]));
  policy.accepted(view('player',[cell(0)]));
  const offered=batch(view(),[move('middle',1),move('right',2),move('current',0)]);
  assert.equal(policy.select(offered),'middle');
  policy.accepted(view('player',[cell(1)]));
  assert.equal(policy.select(offered),'right');
  policy.accepted(view('player',[cell(2)]));
  assert.equal(policy.select(offered),'current');
});

test('only an own accepted action advances search age; foreign views and repeated selection do not',()=>{
  const policy=createFullExplorationPolicy({side:'player'});
  policy.observe(view());
  const before=policy.snapshot();
  policy.observe(view());
  policy.select(batch(view(),[move('next',1)]));
  assert.equal(policy.accepted(view('enemy')),false);
  assert.deepEqual(policy.snapshot(),before);
  assert.equal(policy.select(batch(view('enemy'),[move('foreign',1)])),undefined);
  policy.accepted();
  assert.equal(policy.snapshot().step,1);
  policy.observe(view('player',[cell(1)]));
  assert.equal(policy.snapshot().observed.find(row=>row.x===1).lastStep,1);
});

test('known enemies, completed objectives and absent legal movement keep the strategy in charge',()=>{
  const policy=createFullExplorationPolicy({side:'player'});
  policy.observe(view());
  const visible=view();
  visible.units.push({id:'seen',relation:'opponent',alive:true,embarkedOn:null});
  assert.equal(policy.select(batch(visible,[move('next',1)])),undefined);
  const complete=view();
  complete.objectives[0]={kind:'destroy-escort',remaining:0,satisfied:true};
  assert.equal(policy.select(batch(complete,[move('next',1)])),undefined);
  assert.equal(policy.select(batch(view(),[{key:'end',kind:'end-phase',facts:{}}])),undefined);
});

test('search uses only eligible own moves and native observation coverage with stable ties',()=>{
  const policy=createFullExplorationPolicy({side:'player'});
  policy.observe(view());
  const foreign={...move('foreign',5),actorId:'another'};
  const missing={...move('missing',5),facts:{}};
  const outside=move('outside',5,[{x:99,y:99}]);
  assert.equal(policy.select(batch(view(),[foreign,missing,outside,move('first',1),move('second',2)])),'first');
  const disabled=view();
  disabled.units[0].disabled=true;
  assert.equal(policy.select(batch(disabled,[move('next',1)])),undefined);
});

test('a worker receives an independent copy of the own knowledge and reset discards the old session',()=>{
  const policy=createFullExplorationPolicy({side:'player'});
  policy.observe(view());
  policy.accepted(view('player',[cell(1)]));
  const state=policy.snapshot();
  const copy=createFullExplorationPolicy({side:'player',initialState:state});
  assert.deepEqual(copy.snapshot(),state);
  copy.accepted(view('player',[cell(2)]));
  assert.deepEqual(policy.snapshot(),state);
  state.observed[0].lastStep=99;
  assert.notEqual(policy.snapshot().observed[0].lastStep,99);
  assert.throws(()=>createFullExplorationPolicy({side:'enemy',initialState:policy.snapshot()}),
    /FULL_EXPLORATION_STATE_INVALID/);
  policy.reset();
  assert.deepEqual(policy.snapshot(),createFullExplorationPolicy({side:'player'}).snapshot());
  assert.equal(policy.select(batch(view(),[move('next',1)])),undefined);
  assert.doesNotThrow(()=>createFullExplorationPolicy({side:'player',initialState:policy.snapshot()}));
});
