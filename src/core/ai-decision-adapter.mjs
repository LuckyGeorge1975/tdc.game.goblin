export const AI_DECISION_SCHEMA_VERSION = 1;
let adapterSequence = 0;

const reject = code => ({ok: false, code});
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// The trusted host owns read() and installs the resulting engine state in
// the same synchronous step. Policies receive only the frozen decision DTO.
export function createAiDecisionAdapter({read, describe, apply}) {
  const adapterId = ++adapterSequence;
  let serial = 0;
  let active = null;
  let consumed = null;

  function open(side, scope) {
    const context = read();
    if (consumed && context.state === consumed.state && context.generation === consumed.generation)
      return reject('AI_STATE_NOT_ADVANCED');
    const batch = describe(context.state, side, scope);
    if (!batch.ok) return batch;
    const decisionId = `decision:${adapterId}:${++serial}`;
    const revision = `revision:${adapterId}:${serial}`;
    const options = new Map();
    const candidates = batch.options.map(({command, executeKind, candidate}, index) => {
      const key = `${decisionId}:${index}`;
      options.set(key, {command, executeKind});
      return {key, ...candidate};
    });
    active = {context: {state: context.state, generation: context.generation}, decisionId, revision, options};
    return freeze({ok: true, schemaVersion: AI_DECISION_SCHEMA_VERSION, decisionId, revision,
      side, phase: batch.phase, slot: batch.slot, view: batch.view, candidates});
  }

  function execute(request,evidence) {
    if (!request || typeof request !== 'object' || Object.keys(request).length !== 4 ||
        request.schemaVersion !== AI_DECISION_SCHEMA_VERSION || !Object.hasOwn(request, 'key') ||
        !Object.hasOwn(request, 'decisionId') || !Object.hasOwn(request, 'revision'))
      return reject('AI_INVALID_SELECTION');
    if (!active || request.decisionId !== active.decisionId || request.revision !== active.revision)
      return reject('AI_STALE_DECISION');
    const current = read();
    if (current.state !== active.context.state || current.generation !== active.context.generation) {
      active = null;
      return reject('AI_STALE_DECISION');
    }
    const option = active.options.get(request.key);
    if (!option) return reject('AI_UNKNOWN_CANDIDATE');
    active = null;
    // This output is for the trusted engine host. It contains raw events.
    const bound = evidence?.decisionId===request.decisionId && evidence.revision===request.revision &&
      evidence.key===request.key ? evidence : undefined;
    const result = apply(current.state,option,bound);
    if (result.error) return reject(result.error.code);
    consumed = {state: current.state, generation: current.generation};
    return {ok: true, decisionId: request.decisionId, key: request.key, ...result};
  }

  return Object.freeze({open, execute, invalidate() {active = null}});
}
