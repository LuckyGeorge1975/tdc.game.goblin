import assert from 'node:assert/strict';
import {verifyCase} from './recording.mjs';
import {readArtifact,jsonBytes,sha256,candidateFingerprint,semanticCandidate} from './sealed-artifacts.mjs';
import {describeFullCatalogOptions} from '../../src/core/full-catalog-ai-adapter.mjs';
import {encodeFullFireEffects} from '../../src/core/full-attack-2a.mjs';
import {nativePairLabel} from './fire-network.mjs';
import {openFullTrainingReplay} from '../full-training-import.mjs';
import {prepareFullExperimentCatalog} from '../full-experiment-policies.mjs';
import {createRecordingGame} from './headless.mjs';
import {resolve} from 'node:path';
const same=(a,b)=>assert.deepEqual(a,b,'AI_CORE_PAIR_CONTEXT');
export async function buildPair({reference,alternative,side}){
  assert.ok(['player','enemy'].includes(side));
  await verifyCase({caseRoot:reference.caseRoot,result:reference});
  await verifyCase({caseRoot:alternative.caseRoot,result:alternative});
  same(reference.binding,alternative.binding);same(reference.manifestSha256,alternative.manifestSha256);
  same(reference.levelDigest,alternative.levelDigest);same(reference.seed,alternative.seed);same(reference.seats,alternative.seats);
  if(reference.completion!=='native'||alternative.completion!=='native')return null;
  assert.ok(!reference.intervention&&!reference.model&&!alternative.model,'AI_CORE_PAIR_BRANCH');
  const intervention=alternative.intervention;assert.equal(intervention?.side,side,'AI_CORE_PAIR_INTERVENTION');
  const source=reference.sampled.find(item=>item.side===side&&item.commandIndex===intervention.commandIndex);
  assert.ok(source,'AI_CORE_PAIR_SAMPLE_MISSING');
  const clean=value=>{const copy={...value};delete copy.caseId;return copy;};same(clean(source),clean(intervention));
  const delta=nativePairLabel(reference,alternative,side);if(delta===null)return null;
  const read=async(result,name)=>{const ref=result.artifactRefs[name];return JSON.parse(await readArtifact(result.caseRoot,ref.path,ref.sha256));};
  const r=await read(reference,'archive.json'),a=await read(alternative,'archive.json'),trace=await read(reference,'trace.json');
  const n=source.commandIndex;assert.ok(n<r.replay.entries.length&&n<a.replay.entries.length);
  for(let i=0;i<n;i++)same(r.replay.entries[i].command,a.replay.entries[i].command);
  assert.notDeepEqual(r.replay.entries[n].command,a.replay.entries[n].command,'AI_CORE_PAIR_NO_INTERVENTION');
  const catalog=reference.experiment?await prepareFullExperimentCatalog({artifactRoot:reference.caseRoot,entries:reference.experiment.entries,
    runtimeCommit:reference.binding.runtimeCommit,engineArchivePath:resolve(reference.caseRoot,reference.binding.engineArchivePath)}):undefined;
  const host=await openFullTrainingReplay(r,{createGame:createRecordingGame,experimentCatalog:catalog});
  let frame;
  try{
    for(let i=0;i<n;i++)assert.equal(host.commit(host.inspect({record:true}),r.replay.entries[i].command).ok,true);
    frame=host.inspect({record:true});
    assert.equal(sha256(jsonBytes(JSON.parse(JSON.stringify(host.port.simulationSnapshot(host.port.ticket('ai')).replay)))),source.prefixSha256);
  }finally{host.game.dispose();}
  const row=trace.decisions[n];assert.equal(row.side,side);
  const candidates=describeFullCatalogOptions(frame.candidates,side).map(item=>semanticCandidate(item.candidate));
  const ref=candidates[row.selected],alt=candidates.find(item=>candidateFingerprint(item)===source.alternativeSha256);
  assert.ok(alt);assert.equal(candidateFingerprint(ref),source.referenceSha256);
  assert.equal(sha256(jsonBytes(candidates)),source.offerSha256);
  assert.equal(sha256(jsonBytes(row.candidates[row.selected].command)),source.referenceCommandSha256);
  same(encodeFullFireEffects({view:row.view},ref),source.referenceFeatures);
  same(encodeFullFireEffects({view:row.view},alt),source.alternativeFeatures);
  const familyId=sha256(jsonBytes({level:reference.levelDigest,seed:reference.seed,seats:reference.seats}));
  return {version:'goblin-ai-fire-pair-v1',familyId,side,level:reference.level,levelDigest:reference.levelDigest,seed:reference.seed,
    reference:source.referenceFeatures,alternative:source.alternativeFeatures,delta,
    source:{reference:{caseId:reference.caseId,caseRoot:reference.caseRoot,final:reference.artifactRefs.final},
      alternative:{caseId:alternative.caseId,caseRoot:alternative.caseRoot,final:alternative.artifactRefs.final}},
    commandIndex:n,referenceOutcome:reference.outcome,alternativeOutcome:alternative.outcome,
    seats:reference.seats,modes:{reference:'native',alternative:'single-fire-intervention'},
    codeSha256:reference.binding.codeSha256,manifestSha256:reference.manifestSha256};
}
