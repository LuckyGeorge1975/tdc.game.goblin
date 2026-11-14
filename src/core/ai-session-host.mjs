// The owning engine supplies the current side and installs any committed state
// synchronously. The policy receives only its own adapter's decision DTO.
export function createAiSessionHost({adapter, read, select, commit, spectator = false}) {
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
    if (!decision.candidates.length) return reject('AI_HOST_NO_CANDIDATES');
    const request = {generation};
    pending = request;
    try {
      const key = await select(decision);
      const current = read();
      if (request.generation !== generation || current?.session !== before.session ||
          current?.side !== before.side || current?.ended)
        return reject('AI_HOST_STALE');
      const result = adapter.execute({schemaVersion:decision.schemaVersion,
        decisionId:decision.decisionId,revision:decision.revision,key});
      if (result.ok) commit(result, before);
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
