import {
  createIronDustProfile, validateIronDustProfile, projectIronDustProfile,
  IRON_DUST_PROFILE_HEADER
} from './src/core/iron-dust-executable-profile.mjs';
import {buildIronDustV2View, renderIronDustV2View,
  resetIronDustV2View} from './iron-dust-v2-view.mjs';

// This bridge only opens the validated profile. Rendering and actions follow in later slices.
export const IRON_DUST_V2_SELECTOR_ID = 'iron-dust-v2';
export const IRON_DUST_V2_START_SEED = 0x1d057;

export function createIronDustBrowserSession(profile = createIronDustProfile(IRON_DUST_V2_START_SEED)) {
  validateIronDustProfile(profile);
  const projection = projectIronDustProfile(profile);
  if (profile.header.ruleProfileId !== IRON_DUST_PROFILE_HEADER.ruleProfileId ||
      projection.state.rng.seed !== IRON_DUST_V2_START_SEED ||
      projection.state.turn !== 1 || projection.state.phase !== 'movement' ||
      projection.mode !== 'player') {
    throw Object.assign(new Error('IRON_DUST_V2_START_INVALID'),
      {code: 'IRON_DUST_V2_START_INVALID'});
  }
  return Object.freeze({profile, projection});
}

if (typeof document !== 'undefined') {
  const option = document.querySelector('#scenario-select option[value="iron-dust-v2"]');
  const localTest = ['localhost', '127.0.0.1'].includes(location.hostname) &&
    new URLSearchParams(location.search).get('iron-dust-v2-test') === '1';
  if (option && localTest && !globalThis.goblinBootProfileError) option.disabled = false;

  let session = null;
  let mode = 'inactive';
  function renderCurrent() {
    if (mode !== 'ready' || !session) return;
    renderIronDustV2View(buildIronDustV2View(session.projection,
      session.profile.header.ruleProfileId));
  }
  const legacyDraw = draw;
  draw = function(...args) {
    if (mode === 'ready') return renderCurrent();
    return legacyDraw(...args);
  };
  globalThis.addEventListener?.('goblin-language-change', renderCurrent);
  function showGate(message) {
    document.body.classList.add('iron-dust-v2-gated');
    document.body.classList.remove('iron-dust-v2-ready');
    document.querySelector('.map-frame').dataset.v2Message = message;
    document.querySelector('#mission-kicker').textContent = 'IRON DUST v2 / INTERNAL TEST';
    document.querySelector('#mission-title').textContent = 'Profil-Anbindung in Arbeit';
    document.querySelector('#mission-sub').textContent = message;
    document.querySelector('#objective-text').textContent = 'V2-PROFIL · GESPERRT';
    document.querySelector('#objective-progress').style.width = '0%';
    document.querySelector('#phase-title').textContent = 'INTEGRATION GESPERRT';
    document.querySelector('#end-turn').disabled = true;
    document.querySelector('#auto-end-turn').disabled = true;
    document.querySelector('#undo-command').disabled = true;
    document.querySelectorAll('.view-option').forEach(button => { button.disabled = true; });
    document.querySelector('#quick-start-open').disabled = true;
    document.querySelector('#unit-guide-open').disabled = true;
    selected = null;
    focusedCell = null;
    phase = 'v2-gated';
    turnPhase = 'v2-gated';
    gameOver = true;
    currentScenario = IRON_DUST_V2_SELECTOR_ID;
    document.querySelector('#scenario-select').value = IRON_DUST_V2_SELECTOR_ID;
  }
  function start(profile) {
    if (!localTest || globalThis.goblinBootProfileError) return false;
    try {
      session = createIronDustBrowserSession(profile);
      mode = 'ready';
      showGate('V2-Profil validiert. Spielfläche bis zum vollständigen Browser-Gate gesperrt.');
      resetIronDustV2View();
      renderCurrent();
      document.body.classList.add('iron-dust-v2-ready');
    } catch (error) {
      session = null;
      mode = 'error';
      showGate(`V2-Start gesperrt: ${error.code || error.message || 'UNBEKANNTER_FEHLER'}`);
    }
    return mode === 'ready';
  }
  function stop() {
    session = null;
    mode = 'inactive';
    document.body.classList.remove('iron-dust-v2-gated');
    document.body.classList.remove('iron-dust-v2-ready');
    resetIronDustV2View();
    document.querySelector('.map-frame').removeAttribute('data-v2-message');
    document.querySelector('#auto-end-turn').disabled = false;
    document.querySelector('#undo-command').disabled = false;
    document.querySelectorAll('.view-option').forEach(button => { button.disabled = false; });
    document.querySelector('#quick-start-open').disabled = false;
    document.querySelector('#unit-guide-open').disabled = false;
  }
  globalThis.IronDustBrowserV2 = Object.freeze({
    selectorId: IRON_DUST_V2_SELECTOR_ID,
    available: !!option && localTest && !globalThis.goblinBootProfileError,
    get active() { return mode !== 'inactive'; },
    get mode() { return mode; },
    get session() { return session; },
    start, restart: () => start(), stop
  });
}
