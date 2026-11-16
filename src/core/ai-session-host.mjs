// The owning engine supplies the current side and installs any committed state
// synchronously. The policy receives only its own adapter's decision DTO.
export function createAiSessionHost({adapter, read, select, policy, commit, remember, spectator = false}) {
  let generation = 0;
  let stopped = false;
  let paused = false;
  let pending = null;
  const reject = code => ({ok:false,code});

  function invalidate() {
    generation++;
    pending = null;
    adapter.invalidate();
  }

  async function advance() {
    if (stopped || paused || pending) return reject('AI_HOST_UNAVAILABLE');
    const before = read();
    if (!before || before.ended || (before.side !== 'enemy' && !spectator))
      return reject('AI_HOST_WRONG_SIDE');
    const decision = adapter.open(before.side);
    if (!decision.ok) return decision;
    if (decision.side !== before.side) {
      adapter.invalidate();
      return reject('AI_HOST_WRONG_SIDE');
    }
    if (!decision.candidates.length) return reject('AI_HOST_NO_CANDIDATES');
    const request = {generation};
    pending = request;
    try {
      let key, reported;
      const report = value => { reported = value; };
      try {
        key = await (policy ? policy.select(before,decision,report) : select(decision,report));
      } catch {
        return reject('AI_HOST_SELECTION_FAILED');
      }
      const evidence = describeSelection(decision,key,reported);
      remember?.(decision,key,evidence);
      const current = read();
      if (request.generation !== generation || current?.session !== before.session ||
          current?.side !== before.side || current?.ended || current?.engine !== before.engine ||
          current?.profile !== before.profile || current?.feature !== before.feature)
        return reject('AI_HOST_STALE');
      if (!decision.candidates.some(candidate=>candidate.key === key)) return reject('AI_UNKNOWN_CANDIDATE');
      const result = adapter.execute({schemaVersion:decision.schemaVersion,
        decisionId:decision.decisionId,revision:decision.revision,key},evidence);
      if (result.ok) commit(result,before,evidence);
      return result.ok ? {ok:true} : result;
    } finally {
      if (pending === request) {
        pending = null;
        adapter.invalidate();
      }
    }
  }

  return Object.freeze({advance, invalidate, get spectator() {return spectator;},
    pause() { paused = true; invalidate(); },
    resume() { if (!stopped) paused = false; },
    stop() { stopped = true; invalidate(); }});
}

const fire = candidate => candidate.kind==='fire' || candidate.kind==='hex-fire';

function describeSelection(decision,key,reported) {
  if (reported?.key!==key || typeof reported?.explanationKey!=='string' ||
      !/^v2\.round\.[A-Za-z]+$/.test(reported.explanationKey)) return undefined;
  const selected = decision.candidates.find(candidate=>candidate.key===key);
  if (!selected) return undefined;
  const options = [];
  if (fire(selected) && Array.isArray(reported.options)) {
    const offered = new Map(decision.candidates.filter(fire).map(candidate=>[candidate.key,candidate]));
    for (const entry of reported.options) {
      const candidate = offered.get(entry?.key);
      if (!candidate) continue;
      offered.delete(entry.key);
      const scores = {};
      for (const scale of ['basis','model']) {
        if (Number.isFinite(entry.scores?.[scale])) scores[scale] = entry.scores[scale];
      }
      options.push(Object.freeze({candidate,selected:candidate===selected,baseline:entry.baseline===true,
        scores:Object.freeze(scores)}));
    }
  }
  return Object.freeze({decisionId:decision.decisionId,revision:decision.revision,key,
    explanationKey:reported.explanationKey,options:Object.freeze(options)});
}
