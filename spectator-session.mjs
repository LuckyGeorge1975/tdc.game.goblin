import {createIronDustBrowserSession, createIronDustDecisionHost} from './iron-dust-browser-v2.mjs?v=23';
import {captureIronDustRoundCommit, createIronDustRoundRecorder} from './iron-dust-round-source.mjs?v=4';

export function createIronDustSpectatorMatch(select) {
  let session = createIronDustBrowserSession();
  let epoch = 0;
  const recorder = createIronDustRoundRecorder(session.profile, () => session?.profile, 'spectator');
  const host = createIronDustDecisionHost({
    readSession:() => session, readEpoch:() => epoch, spectator:true, select,
    install(next) {
      const commit = recorder.beginCommit();
      const before = session.profile;
      session = next;
      captureIronDustRoundCommit(commit,before, {
        profile:next.profile, events:next.projection.events
      });
    }
  });
  return Object.freeze({
    advance:host.advance,
    ended:() => session?.projection.mode === 'ended',
    view:() => recorder.view(),
    stop() { epoch++; host.stop(); session = null; }
  });
}

// The caller supplies an isolated, engine-backed match. Only this controller
// schedules its turns. The presentation receives controls and a read-only view.
export function createSpectatorSession(match, {
  schedule = callback => setTimeout(callback, 0),
  cancel = handle => clearTimeout(handle),
  changed = () => {}
} = {}) {
  let status = 'paused';
  let queued = null;
  let advancing = false;
  let generation = 0;
  function update(next) {
    status = next;
    changed();
  }
  function enqueue() {
    if (status !== 'running' || advancing || queued !== null) return;
    const epoch = generation;
    queued = schedule(async () => {
      if (epoch !== generation || status !== 'running') return;
      queued = null;
      advancing = true;
      try {
        const result = await match.advance();
        if (status === 'closed') return;
        if (match.ended()) update('ended');
        else if (status === 'pausing') update('paused');
        else if (!result?.ok) update('failed');
        else changed();
      } catch {
        if (status !== 'closed') update('failed');
      } finally {
        advancing = false;
        enqueue();
      }
    });
  }
  function clearQueued() {
    generation++;
    if (queued !== null) cancel(queued);
    queued = null;
  }
  return Object.freeze({
    get status() { return status; },
    view: () => status === 'closed' ? null : match.view(),
    resume() {
      if (status !== 'paused') return false;
      update('running');
      enqueue();
      return true;
    },
    pause() {
      if (status !== 'running') return false;
      clearQueued();
      update(advancing ? 'pausing' : 'paused');
      return true;
    },
    leave() {
      if (status === 'closed') return;
      clearQueued();
      status = 'closed';
      match.stop();
      changed();
    }
  });
}
