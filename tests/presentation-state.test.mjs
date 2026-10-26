import test from 'node:test';
import assert from 'node:assert/strict';
import presentation from '../presentation-state.js';

const binding={runtime:'legacy',scenarioId:'test',scenarioVersion:1,
  ruleProfileId:'TEST',sourceStateVersion:'test-v1',sessionId:1};
const before={units:[{id:'unit',team:'player',visualKey:'tank',x:1,y:2,hp:3}],turn:1,phase:'movement'};
const path=[{x:2,y:2},{x:2,y:3},{x:3,y:3}];
const after={...before,units:[{...before.units[0],x:3,y:3}]};
function record(owner,route=path){
  const ticket=owner.begin({type:'Move'},before);
  const results=[{type:'UnitMoved',path:route}];
  return {ticket,events:owner.confirm(ticket,after,results,[{kind:'move',actorId:'unit',
    from:{x:1,y:2},to:{x:3,y:3},path:route,sourceEventIndex:0}])};
}

test('one instant queue owner preserves the exact route and freezes accepted facts',()=>{
  const owner=presentation.createOwner();owner.bind(binding,before);
  const {ticket,events}=record(owner);
  assert.equal(events.length,1);
  assert.deepEqual(events[0].path,path);
  assert.equal(Object.isFrozen(events[0].after.units[0]),true);
  assert.throws(()=>{events[0].after.units[0].hp=0;},TypeError);
  assert.deepEqual(owner.endState(),after);
  assert.equal(owner.events()[0].status,'settled');
  assert.equal(owner.settleToAfter(events[0].eventId),false);
  assert.deepEqual(owner.confirm(ticket,after,[],[]),[]);
  assert.equal(owner.events().length,1);
  assert.equal(owner.read().facingByUnit[0].angleDegrees,0);
  assert.equal(owner.read().facingByUnit[0].origin,'confirmed-movement');
});

test('invalid paths settle neutrally without inventing an endpoint shortcut',()=>{
  const owner=presentation.createOwner();owner.bind(binding,before);
  const {events}=record(owner,[{x:3,y:3}]);
  assert.equal(events[0].path,null);
  assert.equal(events[0].diagnostic,'INVALID_CONFIRMED_PATH');
  assert.deepEqual(owner.endState(),after);
  assert.equal(owner.read().facingByUnit[0].origin,'baseline');
});

test('Undo/reissue and session replacement invalidate old callbacks and keep IDs distinct',()=>{
  const owner=presentation.createOwner();owner.bind(binding,before);
  const saved=owner.read();const first=record(owner).events[0];
  let calls=0;const late=owner.guard(()=>calls++);
  const stale=owner.begin({type:'Move'},after);
  assert.equal(owner.rewind(saved,before),true);
  late();assert.equal(calls,0);
  assert.deepEqual(owner.confirm(stale,after,[],[]),[]);
  const second=record(owner).events[0];
  assert.notEqual(first.eventId,second.eventId);
  assert.equal(second.binding.branchGeneration,1);
  assert.equal(second.action.acceptedSequence,2);
  const oldSession=owner.guard(()=>calls++);
  owner.bind({...binding,sessionId:2},before);oldSession();
  assert.equal(calls,0);assert.equal(owner.events().length,0);
  assert.equal(owner.restore(saved,before),false);
});

test('sidecar JSON restore validates versions, exact revision, identity and unit membership',()=>{
  const owner=presentation.createOwner();owner.bind(binding,before);record(owner);
  const saved=JSON.parse(JSON.stringify(owner.read()));
  assert.equal(owner.restore(saved,after),true);
  assert.deepEqual(owner.read(),saved);
  const bads=[{...saved,schemaVersion:2},{...saved,settledRevision:'stale'},
    {...saved,binding:{...binding,sessionId:100}},
    {...saved,facingByUnit:[{...saved.facingByUnit[0],unitId:'foreign'}]},
    {...saved,facingByUnit:[{...saved.facingByUnit[0],team:'enemy'}]},
    {...saved,facingByUnit:[{...saved.facingByUnit[0],angleDegrees:null}]},null];
  for(const bad of bads){assert.equal(owner.restore(bad,after),false);
    assert.equal(owner.read().facingByUnit[0].origin,'baseline');}
});

test('visual identity and deterministic utility do not touch gameplay randomness',()=>{
  const random=Math.random;Math.random=()=>{throw Error('gameplay random touched');};
  try{const owner=presentation.createOwner();owner.bind(binding,before);record(owner);
    assert.equal(presentation.visualRandom('event','salt'),presentation.visualRandom('event','salt'));
    assert.notEqual(presentation.visualRandom('event','salt'),presentation.visualRandom('other','salt'));
  }finally{Math.random=random;}
});
