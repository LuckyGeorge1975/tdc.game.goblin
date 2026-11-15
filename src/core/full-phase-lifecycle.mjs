import {createSpectatorSession} from '../../spectator-session.mjs';

// One timer loop per continuous AI turn. The native owner remains responsible
// for the current ticket, including an in-flight choice across pause/resume.
export function createFullPhaseLifecycle({port, host, changed = () => {}, schedule, cancel}) {
  let runner = null;
  let paused = false;
  let closed = false;

  function sync() {
    if (closed || paused) return;
    const current = port.state();
    if (!current || current.ended || current.paused || current.controller !== 'ai') return;
    if (runner) {
      if (runner.status === 'paused') runner.resume();
      return;
    }
    const {sessionId, side} = current;
    const active = () => {
      const state = port.state();
      return state?.sessionId === sessionId && state.side === side && state.controller === 'ai' && !state.ended;
    };
    const next = createSpectatorSession({
      advance: () => active() && !paused ? host.advance() : {ok:false},
      ended: () => !active(),
      view: () => null,
      stop() {}
    }, {schedule, cancel, changed() {
      if (closed || runner !== next) return;
      if (next.status === 'ended') runner = null;
      changed();
      if (next.status === 'ended' || next.status === 'paused') sync();
    }});
    runner = next;
    next.resume();
  }

  return Object.freeze({
    sync,
    get paused() { return paused; },
    pause() {
      if (closed || paused) return;
      paused = true;
      runner?.pause();
      host.pause();
      changed();
    },
    resume() {
      if (closed || !paused) return;
      paused = false;
      host.resume();
      sync();
      changed();
    },
    leave() {
      if (closed) return;
      closed = true;
      runner?.leave();
      runner = null;
      host.leave();
      changed();
    }
  });
}
