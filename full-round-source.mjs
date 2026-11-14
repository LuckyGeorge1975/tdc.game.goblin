import {createRoundRecorder} from './round-view-producer.mjs?v=3';

export function createFullRoundSource(read) {
  let owner, recorder;
  const checkpoints = new WeakMap();
  function start() {
    const state = read();
    if (!state) { owner = null; recorder = null; return; }
    owner = state.session;
    recorder = createRoundRecorder({session:owner,mode:'player',initialRound:state.round,
      readAuthority:() => ({...read(),mode:'player'})});
  }
  const current = () => owner && read()?.session === owner ? recorder : null;
  function record(event, after, visibleIds) {
    const active = current();
    if (!active) return;
    const commit = active.beginCommit();
    const ownPath = event.side === 'player' && visibleIds.has(event.actor?.id);
    const actor = visibleIds.has(event.actor?.id);
    const target = visibleIds.has(event.target?.id);
    const capture = commit.captureFullRoundEvent(event,{after,disclosure:{
      actor:actor ? 'after' : null,target:target ? 'after' : null,
      boardVisible:actor || target,resultVisible:target,
      targetCellVisible:actor && event.side === 'player',
      visibleSteps:ownPath ? event.snapshot.paths[0]?.cells.map(() => true) : undefined
    }});
    commit.accept({roundNumber:read().round,events:[capture]});
  }
  return Object.freeze({
    start, record,
    beginBoundary:() => current()?.beginCommit(),
    complete(commit, roundNumber, boundary) { commit?.accept({roundNumber,events:[],boundary}); },
    checkpoint(snapshot) {
      const handle = current()?.checkpoint();
      if (handle) checkpoints.set(snapshot,handle);
    },
    rewind(snapshot) {
      const handle = checkpoints.get(snapshot);
      if (handle) current()?.rewind(handle);
    },
    view:() => current()?.view() ?? null
  });
}

if (typeof document !== 'undefined') {
  globalThis.GoblinFullRoundSource = createFullRoundSource(() =>
    GoblinCatalogFullRuntime.active() && legacySession.ruleProfileId === 'FULL_CATALOG_v1'
      ? {session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver} : null);
  GoblinFullRoundSource.start();
}
