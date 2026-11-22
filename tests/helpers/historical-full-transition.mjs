import assert from 'node:assert/strict';
import {replay} from '../catalog-full-trace.mjs';

// The immutable historical record is deliberately not rewritten or played by a
// historical engine. Prove the precise authorised initial-state incompatibility;
// current native complete-state/terminal oracles live in current-full-native.
export async function assertHistoricalFullTransition(trace){
  await assert.rejects(()=>replay(trace),error=>{
    assert.equal(error.code,'ERR_ASSERTION');
    assert.equal(error.operator,'deepStrictEqual');
    assert.deepEqual(error.expected,trace.initial,'rejection must be at the historical initial oracle');
    const before=structuredClone(error.expected),after=structuredClone(error.actual);
    const flags=['moved','fired','secondMoved','embarkedThisTurn','disembarkedThisTurn'];
    assert.ok(before.world.units.some(unit=>unit.team==='enemy'));
    for(const unit of before.world.units.filter(unit=>unit.team==='enemy')){
      const current=after.world.units.find(item=>item.id===unit.id);
      for(const flag of flags){
        assert.equal(unit[flag],false,'original inactive-side flag '+unit.id+'/'+flag);
        assert.equal(Object.hasOwn(current,flag),false,'current inactive-side flag '+unit.id+'/'+flag);
        delete unit[flag];
      }
    }
    for(const field of ['baselineRevision','settledRevision']){
      assert.match(after.presentation[field],/^[a-f0-9]{8}$/);
      assert.notEqual(after.presentation[field],before.presentation[field]);
      delete before.presentation[field];delete after.presentation[field];
    }
    assert.deepEqual(after,before,'historical initial delta must contain only inactive-side flags and their revision');
    return true;
  });
}
