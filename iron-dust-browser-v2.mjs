import {
  createIronDustProfile, validateIronDustProfile, projectIronDustProfile,
  queryIronDustProfile, preflightIronDustProfile, dispatchIronDustProfile,
  IRON_DUST_PROFILE_HEADER
} from './src/core/iron-dust-executable-profile.mjs';
import {buildIronDustV2View, renderIronDustV2View, formatIronDustV2Error,
  formatIronDustV2Event,
  resetIronDustV2View} from './iron-dust-v2-view.mjs?v=4';

// Browser commands cross the same validated profile boundary as the Core probes.
export const IRON_DUST_V2_SELECTOR_ID = 'iron-dust-v2';
export const IRON_DUST_V2_START_SEED = 8;
export function ironDustV2StartSeed(hostname, search) {
  return ['localhost', '127.0.0.1'].includes(hostname) &&
    new URLSearchParams(search).get('iron-dust-v2-seed') === '2'
    ? 2 : IRON_DUST_V2_START_SEED;
}

export function createIronDustBrowserSession(
  profile = createIronDustProfile(IRON_DUST_V2_START_SEED),
  expectedSeed = IRON_DUST_V2_START_SEED) {
  validateIronDustProfile(profile);
  const projection = projectIronDustProfile(profile);
  if (profile.header.ruleProfileId !== IRON_DUST_PROFILE_HEADER.ruleProfileId ||
      projection.state.rng.seed !== expectedSeed ||
      projection.state.turn !== 1 || projection.state.phase !== 'movement' ||
      projection.mode !== 'player') {
    throw Object.assign(new Error('IRON_DUST_V2_START_INVALID'),
      {code: 'IRON_DUST_V2_START_INVALID'});
  }
  return Object.freeze({profile, projection});
}

export function dispatchIronDustBrowserAction(session, command) {
  if (!['Move', 'Ram', 'SelectWeapon', 'PlayerFire', 'EndPhase',
    'AutoEnemyAdvance'].includes(command?.type))
    return {error:{code:'BROWSER_ACTION_UNSUPPORTED'}};
  const query = queryIronDustProfile(session.profile, command);
  const preflight = preflightIronDustProfile(session.profile, command);
  if (JSON.stringify(query) !== JSON.stringify(preflight))
    return {error:{code:'IRON_DUST_PREFLIGHT_MISMATCH'}};
  if (!query.available) return {error:query.error};
  const result = dispatchIronDustProfile(session.profile, command);
  if (!result.profile) return {error:result.error};
  return {session:Object.freeze({profile:result.profile,
    projection:projectIronDustProfile(result.profile, result.events)})};
}

export function createIronDustEnemyFlow({getSession, advance,
  schedule = (callback, delay) => setTimeout(callback, delay),
  clear = handle => clearTimeout(handle), delay = 140}) {
  let generation = 0, handle = null, running = false;
  const cancel = () => {
    generation++;
    if (handle !== null) clear(handle);
    handle = null;
    running = false;
  };
  const start = () => {
    if (running || getSession()?.projection.mode !== 'enemy') return false;
    running = true;
    const current = ++generation;
    const step = () => {
      handle = null;
      if (current !== generation || !running ||
          getSession()?.projection.mode !== 'enemy') return;
      const result = advance();
      if (current !== generation) return;
      if (!result?.session || result.session.projection.mode !== 'enemy') {
        running = false;
        return;
      }
      handle = schedule(step, delay);
    };
    handle = schedule(step, delay);
    return true;
  };
  return Object.freeze({start, cancel, get running() {return running;}});
}

if (typeof document !== 'undefined') {
  const option = document.querySelector('#scenario-select option[value="iron-dust-v2"]');
  const startSeed = ironDustV2StartSeed(location.hostname, location.search);
  if (option) option.disabled = !!globalThis.goblinBootProfileError;

  let session = null;
  let mode = 'inactive';
  let actionError = null;
  let eventHistory = [];
  let epoch = 0;
  let paused = false;
  const endButton = document.querySelector('#end-turn');
  const legacyEndClick = endButton.onclick;
  const enemyFlow = createIronDustEnemyFlow({getSession:() => mode === 'ready' ? session : null,
    advance:() => commitAction({type:'AutoEnemyAdvance', playerId:'enemy'})});
  function renderCurrent() {
    if (mode !== 'ready' || !session) return;
    renderIronDustV2View(buildIronDustV2View(session.projection,
      session.profile.header.ruleProfileId, eventHistory),
    {onAction:dispatchAction, actionError});
    endButton.disabled = session.projection.mode !== 'player';
    const t = key => globalThis.GoblinLanguage?.t(key) ?? key;
    endButton.textContent = session.projection.mode === 'ended' ? t('v2.ended') :
      session.projection.mode === 'enemy' ? t('v2.enemy') :
        session.projection.state.phase === 'gev' ? t('v2.endTurn') : t('v2.next');
    const undo = document.querySelector('#undo-command');
    undo.disabled = true;
    undo.title = t('v2.undo');
    globalThis.dispatchEvent?.(new Event('goblin-core-v2-render'));
  }
  function commitAction(command) {
    if (mode !== 'ready' || !session) return {error:{code:'V2_NOT_READY'}};
    const cursor = session.projection.cursor;
    const result = dispatchIronDustBrowserAction(session, command);
    if (result.session) {
      session = result.session;
      eventHistory.push(...session.projection.events.map(event => ({...event,
        cursorPass:command.type === 'AutoEnemyAdvance' ? cursor?.pass : null,
        cursorIndex:command.type === 'AutoEnemyAdvance' ? cursor?.index : null})));
      eventHistory = eventHistory.slice(-120);
    }
    actionError = result.error?.code ?? null;
    renderCurrent();
    return result;
  }
  function dispatchAction(command) {
    if (paused) return {error:{code:'V2_PAUSED'}};
    if (command?.type === 'AutoEnemyAdvance' || enemyFlow.running) {
      actionError = command?.type === 'AutoEnemyAdvance' ?
        'ENEMY_TURN_AUTOMATED' : 'ENEMY_TURN_RUNNING';
      renderCurrent();
      return {error:{code:actionError}};
    }
    const result = commitAction(command);
    if (result.session?.projection.mode === 'enemy') enemyFlow.start();
    return result;
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
    document.querySelector('#mission-kicker').textContent = 'IRON DUST v2';
    document.querySelector('#mission-title').textContent = globalThis.GoblinLanguage?.t('mission.iron-dust-v2.title') ?? 'IRON DUST v2';
    document.querySelector('#mission-sub').textContent = message;
    document.querySelector('#objective-text').textContent = globalThis.GoblinLanguage?.t('v2.objective') ?? 'IRON DUST v2';
    document.querySelector('#objective-progress').style.width = '0%';
    document.querySelector('#phase-title').textContent = message;
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
    if (globalThis.goblinBootProfileError) return false;
    enemyFlow.cancel();
    paused = false;
    epoch++;
    try {
      session = createIronDustBrowserSession(profile ?? createIronDustProfile(startSeed),
        startSeed);
      mode = 'ready';
      showGate('');
      actionError = null;
      eventHistory = [];
      resetIronDustV2View();
      document.body.classList.remove('iron-dust-v2-gated');
      document.querySelector('.map-frame').removeAttribute('data-v2-message');
      document.body.classList.add('iron-dust-v2-ready');
      document.querySelector('#quick-start-open').disabled = false;
      document.querySelector('#unit-guide-open').disabled = false;
      endButton.onclick = () => dispatchAction({type:'EndPhase', playerId:'player'});
      renderCurrent();
    } catch {
      session = null;
      mode = 'error';
      showGate(globalThis.GoblinLanguage?.t('v2.reject.start') ??
        'IRON DUST v2 could not start.');
    }
    return mode === 'ready';
  }
  function stop() {
    enemyFlow.cancel();
    paused = false;
    epoch++;
    session = null;
    mode = 'inactive';
    actionError = null;
    eventHistory = [];
    endButton.onclick = legacyEndClick;
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
    available: !!option && !globalThis.goblinBootProfileError,
    get active() { return mode !== 'inactive'; },
    get mode() { return mode; },
    get session() { return session; },
    get epoch() { return epoch; },
    get view() { return mode === 'ready' && session ? buildIronDustV2View(session.projection,
      session.profile.header.ruleProfileId, eventHistory) : null; },
    get enemyRunning() {return enemyFlow.running;},
    query: command => mode === 'ready' && session && !paused && !enemyFlow.running &&
      command?.type !== 'AutoEnemyAdvance' ? queryIronDustProfile(session.profile, command)
      : {available:false, error:{code:'V2_NOT_READY'}},
    formatError: formatIronDustV2Error,
    formatEvent: formatIronDustV2Event,
    pause: () => {paused = true; enemyFlow.cancel();},
    resume: () => {paused = false; if (mode === 'ready') enemyFlow.start();},
    dispatch: dispatchAction,
    start, restart: () => start(), stop
  });
}
