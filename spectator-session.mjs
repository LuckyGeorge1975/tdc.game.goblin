import {createIronDustBrowserSession, createIronDustDecisionHost,IRON_DUST_V2_START_SEED} from './iron-dust-browser-v2.mjs?v=29';
import {captureIronDustRoundCommit, createIronDustRoundRecorder} from './iron-dust-round-source.mjs?v=7';
import {createIronDustCommitRecorder} from './src/core/iron-dust-profile-replay.mjs?v=2';
import {validateIronDustLevelV3} from './src/levels/iron-dust.v1.mjs?v=2';

export function createIronDustSpectatorMatch(select, {level,recordReplay=false} = {}) {
  const admitted=level===undefined?undefined:validateIronDustLevelV3(level);
  if(admitted?.aiAllowed===false) throw Object.assign(Error('AI control is disabled for this level'),{code:'AI_LEVEL_FORBIDDEN'});
  // The existing single trusted selector can serve either side. If the host
  // supplies two selectors, both sides must be admitted before starting.
  const player=typeof select==='function'?select:select?.player;
  const enemy=typeof select==='function'?select:select?.enemy;
  if(typeof player!=='function'||typeof enemy!=='function')
    throw Object.assign(Error('AI controllers are required for both sides'),{code:'AI_CONTROLLERS_REQUIRED'});
  let session = createIronDustBrowserSession(undefined,IRON_DUST_V2_START_SEED,admitted);
  let epoch = 0;
  const recorder = createIronDustRoundRecorder(session.profile, () => session?.profile, 'spectator');
  const replay=recordReplay===true?createIronDustCommitRecorder(session.profile):null;
  const host = createIronDustDecisionHost({
    readSession:() => session, readEpoch:() => epoch, spectator:true,
    select:(decision,report)=>(decision.side==='player'?player:enemy)(decision,report),
    install(next,action,evidence) {
      const commit = recorder.beginCommit();
      const before = session.profile;
      session = next;
      captureIronDustRoundCommit(commit,before, {
        profile:next.profile,events:next.projection.events,action,evidence
      });
      replay?.accept(before,{action,profile:next.profile,events:next.projection.events});
    }
  });
  return Object.freeze({
    advance:host.advance,
    ended:() => session?.projection.mode === 'ended',
    view:() => recorder.view(),
    ...(replay?{replay:()=>session?replay.snapshot():null}:{}),
    board:recorder.board,
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
    board: () => status === 'closed' ? null : match.board?.() ?? null,
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
