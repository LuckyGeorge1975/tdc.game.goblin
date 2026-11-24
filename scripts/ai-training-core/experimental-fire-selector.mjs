import assert from 'node:assert/strict';
import {createScorer, validateInput} from './fire-network.mjs';
import {candidateFingerprint, canonicalJson, jsonBytes, semanticCandidate, sha256} from './sealed-artifacts.mjs';

const fire = candidate => ['fire','hex-fire'].includes(candidate?.kind);
const same = (left, right) => canonicalJson(left)===canonicalJson(right);

// The native base selector (including its production exploration state) is
// supplied by the native controller wrapper, not recreated here.
export function createExperimentalFireSelector({mode, side, encode, model, intervention}) {
  assert.ok(['player','enemy'].includes(side), 'EXPERIMENT_SIDE_INVALID');
  assert.ok(['single-fire-intervention','frozen-fire-model'].includes(mode), 'EXPERIMENT_MODE_INVALID');
  assert.equal(typeof encode, 'function');
  const usesModel = mode==='frozen-fire-model';
  assert.ok(usesModel ? model && intervention===undefined : intervention && model===undefined,
    'EXPERIMENT_ARTIFACT_BRANCH_INVALID');
  const score = usesModel ? createScorer(model) : null;
  // A copied spec cannot change after the policy was prepared.
  const spec = intervention===undefined ? null : structuredClone(intervention);
  if (spec) {
    assert.equal(spec.side, side);
    assert.equal(spec.phase, 'fire');
    assert.ok(Number.isSafeInteger(spec.commandIndex) && spec.commandIndex>=0);
    for (const field of ['offerSha256','referenceSha256','alternativeSha256','prefixSha256'])
      assert.match(spec[field], /^[a-f0-9]{64}$/);
    validateInput(spec.referenceFeatures);
    validateInput(spec.alternativeFeatures);
    assert.ok(!same(spec.referenceFeatures,spec.alternativeFeatures), 'EXPERIMENT_FEATURES_NOT_DISTINCT');
  }
  let applied = false;

  return Object.freeze({
    select(batch, chooseNativeBase, context) {
      assert.ok(batch?.ok && batch.side===side && batch.view?.side===side, 'EXPERIMENT_BATCH_SCOPE_INVALID');
      assert.ok(Array.isArray(batch.candidates) && batch.candidates.length>0);
      const baseKey = chooseNativeBase(); // Exactly once, with the unmodified full offer.
      assert.ok(!baseKey || typeof baseKey.then!=='function', 'EXPERIMENT_BASE_MUST_BE_SYNCHRONOUS');
      const baseline = batch.candidates.find(candidate => candidate.key===baseKey);
      assert.ok(baseline, 'EXPERIMENT_BASE_KEY_NOT_OFFERED');
      const targetPoint = spec && context?.commandIndex===spec.commandIndex;
      if (spec) {
        assert.ok(Number.isSafeInteger(context?.commandIndex) && context.commandIndex>=0);
        assert.ok(applied || context.commandIndex<=spec.commandIndex, 'EXPERIMENT_INTERVENTION_MISSED');
      }
      const rows = batch.candidates.map(candidate => {
        const sameGroup = fire(baseline) && fire(candidate) && candidate.actorId===baseline.actorId &&
          candidate.weaponRef===baseline.weaponRef;
        let features = null;
        if (sameGroup) {
          features = encode(batch, candidate);
          if (features!==null) validateInput(features);
        }
        return {key:candidate.key, candidate:semanticCandidate(candidate),
          fingerprint:candidateFingerprint(candidate), features,
          status:!fire(candidate)?'not-fire':!sameGroup?'outside-actor-weapon':features===null?'not-encodable':'eligible',
          baseline:candidate===baseline, score:null};
      });
      let selected = baseline;
      let reason = 'native-base';
      if (targetPoint) {
        assert.ok(!applied, 'EXPERIMENT_SECOND_INTERVENTION');
        assert.equal(batch.phase, spec.phase, 'EXPERIMENT_PHASE_DRIFT');
        assert.equal(batch.slot, spec.slot, 'EXPERIMENT_SLOT_DRIFT');
        assert.equal(batch.view.turn, spec.turn, 'EXPERIMENT_TURN_DRIFT');
        assert.equal(context.prefixSha256, spec.prefixSha256, 'EXPERIMENT_PREFIX_DRIFT');
        assert.equal(sha256(jsonBytes(rows.map(row=>row.candidate))), spec.offerSha256, 'EXPERIMENT_OFFER_DRIFT');
        const reference = rows.find(row=>row.key===baseKey);
        assert.equal(reference.fingerprint, spec.referenceSha256, 'EXPERIMENT_BASE_DRIFT');
        assert.ok(same(reference.features,spec.referenceFeatures), 'EXPERIMENT_BASE_FEATURE_DRIFT');
        const alternatives = rows.filter(row=>row.fingerprint===spec.alternativeSha256);
        assert.equal(alternatives.length,1,'EXPERIMENT_ALTERNATIVE_AMBIGUOUS_OR_MISSING');
        const alternative = alternatives[0];
        assert.equal(alternative.status,'eligible','EXPERIMENT_ALTERNATIVE_OUTSIDE_SLOT');
        assert.ok(same(alternative.features,spec.alternativeFeatures),'EXPERIMENT_ALTERNATIVE_FEATURE_DRIFT');
        selected = batch.candidates.find(candidate=>candidate.key===alternative.key);
        applied = true;
        reason = 'sealed-single-fire-intervention';
      } else if (usesModel && fire(baseline)) {
        assert.equal(batch.phase,'fire','EXPERIMENT_FIRE_PHASE_INVALID');
        const reference = rows.find(row=>row.key===baseKey);
        assert.equal(reference.status,'eligible','EXPERIMENT_BASE_FEATURES_UNAVAILABLE');
        for (const row of rows) if (row.status==='eligible') row.score=score(row.features);
        let bestScore=reference.score;
        for (const row of rows) {
          if (row.status==='eligible' && row.score>bestScore) {
            selected=batch.candidates.find(candidate=>candidate.key===row.key);
            bestScore=row.score;
          }
        }
        reason = selected===baseline ? 'model-kept-native-base' : 'model-higher-score';
        // Dense rank makes equal scores explicit; selection still starts at baseline.
        const levels=[...new Set(rows.filter(row=>row.score!==null).map(row=>row.score))].sort((a,b)=>b-a);
        for(const row of rows) row.rank=row.score===null?null:levels.indexOf(row.score)+1;
      }
      for(const row of rows) {
        row.selected=row.key===selected.key;
        row.reason=row.selected?reason:row.status!=='eligible'?row.status:
          row.score===null?'not-scored-in-intervention-mode':
          row.score===rows.find(other=>other.key===selected.key).score?'equal-score-kept-earlier':'lower-score';
      }
      return {key:selected.key, baselineKey:baseKey, reason, rows, interventionApplied:applied};
    },
    finish(completion) {
      assert.ok(['native','technical-limit','error'].includes(completion));
      if (spec && completion==='native') assert.ok(applied,'EXPERIMENT_NATIVE_END_BEFORE_INTERVENTION');
      return {interventionApplied:applied};
    },
  });
}
