import {createRoundRecorder} from './round-view-producer.mjs?v=7';

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
  function record(event, frames) {
    const active = current();
    if (!active) return;
    const commit = active.beginCommit();
    function evidence(side) {
      const after=frames[side];
      const visible=new Set(after.units.map(unit=>unit.id));
      const actor=visible.has(event.actor?.id), target=visible.has(event.target?.id);
      const ownAction=event.side===side && actor;
      return {after,disclosure:{
        actor:actor?'after':null,target:target?'after':null,
        boardVisible:actor||target||event.hits?.some(hit=>visible.has(hit.target.id)),
        resultVisible:target,targetCellVisible:ownAction,
        visibleSteps:ownAction?event.snapshot.paths[0]?.cells.map(()=>true):undefined
      }};
    }
    const capture=commit.captureFullSeatEvent(event,evidence('player'),evidence('enemy'));
    commit.accept({roundNumber:read().round,events:[capture]});
  }
  function view() {
    const authority=read();
    const active=current();
    if (!active) return null;
    if (!authority.port || authority.spectator || authority.ended) return active.view();
    const seat=authority.port.state();
    return seat?.humanReady?active.view(seat.side):null;
  }
  return Object.freeze({
    start, record,
    recordPrivate(event) {
      const commit = current()?.beginCommit();
      if (commit) commit.accept({roundNumber:read().round,events:[commit.captureRoundEvent(event)]});
    },
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
    view
  });
}

if (typeof document !== 'undefined') {
  globalThis.GoblinFullRoundSource = createFullRoundSource(() =>
    GoblinCatalogFullRuntime.active() && legacySession.ruleProfileId === 'FULL_CATALOG_v1'
      ? {session:legacySession,round:turn,side:phase,phase:turnPhase,ended:gameOver,
        port:GoblinCatalogFullRuntime.controllerPort(), spectator:!!GoblinCatalogFullRuntime.controllerPort()?.spectator?.()} : null);
  GoblinFullRoundSource.start();
}
