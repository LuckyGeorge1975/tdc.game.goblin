import {createCorePresentationObserver} from './core-presentation.mjs?v=2';
import {captureIronDustRoundCommit, createIronDustRoundRecorder} from './iron-dust-round-source.mjs?v=6';
import {createIronDustAiAdapter} from './src/core/iron-dust-ai-adapter.mjs?v=5';
import {createAiSessionHost} from './src/core/ai-session-host.mjs?v=2';
import {createAiPolicyRegistry} from './src/core/ai-policy-registry.mjs';
import {prepareIronDustTrainedPolicy, IRON_DUST_TRAINED_SCOPE} from './src/core/iron-dust-trained-policy.mjs?v=1';
import {choosePlayerAction} from './src/core/iron-dust-objective-policy.mjs?v=1';
import {hexDistance} from './src/core/hex.mjs';
import {createIronDustCommitRecorder} from './src/core/iron-dust-profile-replay.mjs?v=2';

function observePresentation(observer,method,...args){
  try{return observer?.[method]?.(...args);}catch{return null;}
}

import {
  createIronDustProfile, validateIronDustProfile, projectIronDustProfile,
  queryIronDustProfile, queryIronDustCrtPreview, preflightIronDustProfile, dispatchIronDustProfile,
  IRON_DUST_PROFILE_HEADER, IRON_DUST_ENEMY_DIFFICULTIES
} from './src/core/iron-dust-executable-profile.mjs?v=3';
import {buildIronDustV2View, renderIronDustV2View, formatIronDustV2Error,
  formatIronDustV2Event,
  resetIronDustV2View} from './iron-dust-v2-view.mjs?v=10';
import {IRON_DUST_CORE_DATA_V1, validateIronDustCoreDataV1}
  from './src/levels/iron-dust-core-data.v1.mjs';
import {IRON_DUST_LEVEL_V3} from './src/levels/iron-dust.v3.mjs';
import {validateIronDustLevelV3} from './src/levels/iron-dust.v1.mjs?v=2';

// Browser commands cross the same validated profile boundary as the Core probes.
export const IRON_DUST_V2_SELECTOR_ID = 'iron-dust-v2';
export const IRON_DUST_V2_START_SEED = 8;
// A future spectator owner supplies the approved policies, then schedules
// advance() at the end of each committed engine action.
const browserPolicies = createAiPolicyRegistry([]);

export function createIronDustDecisionHost({readSession, readEpoch, select, policy, feature, install, spectator,
  fireTarget}) {
  if(readSession()?.aiAllowed===false)
    throw Object.assign(Error('AI control is disabled for this level'),{code:'AI_LEVEL_FORBIDDEN'});
  const native = createIronDustAiAdapter(() => ({state:readSession()?.profile,generation:readEpoch()}));
  const adapter = fireTarget ? {
    open: side => native.open(side,fireTarget.scope()),
    execute: native.execute,
    invalidate: native.invalidate
  } : native;
  return createAiSessionHost({
    adapter, select, policy, spectator,
    read() {
      const session = readSession();
      if (!session || session.aiAllowed===false) return null;
      const {activeTeam:side,phase} = session.projection.state;
      if (fireTarget && (side !== 'player' || phase !== 'fire' || !fireTarget.scope())) return null;
      return {session:readEpoch(),side,ended:session.projection.mode === 'ended',
        engine:fireTarget?.engine ?? session.profile.profileVersion,
        profile:session.profile.header.ruleProfileId,feature};
    },
    commit(result) {
      install(Object.freeze({profile:result.profile,projection:projectIronDustProfile(result.profile,result.events)}),result.action);
    }
  });
}
export function ironDustV2StartSeed(hostname, search) {
  return ['localhost', '127.0.0.1'].includes(hostname) &&
    new URLSearchParams(search).get('iron-dust-v2-seed') === '2'
    ? 2 : IRON_DUST_V2_START_SEED;
}

export function createIronDustBrowserSession(
  profile,
  expectedSeed = IRON_DUST_V2_START_SEED,
  level = IRON_DUST_LEVEL_V3) {
  const admitted=validateIronDustLevelV3(level);
  profile??=createIronDustProfile(expectedSeed,{level:admitted});
  validateIronDustProfile(profile);
  const projection = projectIronDustProfile(profile);
  if (profile.header.ruleProfileId !== IRON_DUST_PROFILE_HEADER.ruleProfileId ||
      projection.state.rng.seed !== expectedSeed ||
      projection.state.turn !== 1 || projection.state.phase !== 'movement' ||
      projection.mode !== 'player') {
    throw Object.assign(new Error('IRON_DUST_V2_START_INVALID'),
      {code: 'IRON_DUST_V2_START_INVALID'});
  }
  return Object.freeze({profile, projection,...(admitted.aiAllowed===false?{aiAllowed:false}:{})});
}

export function dispatchIronDustBrowserAction(session, command, observer = null) {
  if (!['Move', 'Ram', 'SelectWeapon', 'PlayerFire', 'EndPhase',
    'AutoEnemyAdvance'].includes(command?.type))
    return {error:{code:'BROWSER_ACTION_UNSUPPORTED'}};
  const query = queryIronDustProfile(session.profile, command);
  const preflight = preflightIronDustProfile(session.profile, command);
  if (JSON.stringify(query) !== JSON.stringify(preflight))
    return {error:{code:'IRON_DUST_PREFLIGHT_MISMATCH'}};
  if (!query.available) return {error:query.error};
  const presentation = observePresentation(observer,'begin',session,command,query);
  const result = dispatchIronDustProfile(session.profile, command);
  if (!result.profile) return {error:result.error};
  const nextSession=Object.freeze({...session,profile:result.profile,
    projection:projectIronDustProfile(result.profile, result.events)});
  observePresentation(observer,'confirm',presentation,nextSession);
  return {session:nextSession};
}

export function queryIronDustBrowserCrtPreview(session, command) {
  return session?.profile ? queryIronDustCrtPreview(session.profile, command) : null;
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
  let rounds = null;
  let trainedPolicy = null;
  let trained = null;
  const presentation = globalThis.GoblinPresentation
    ? createCorePresentationObserver(globalThis.GoblinPresentation,()=>epoch) : null;
  const endButton = document.querySelector('#end-turn');
  const legacyEndClick = endButton.onclick;
  const enemyFlow = createIronDustEnemyFlow({getSession:() => mode === 'ready' ? session : null,
    advance:() => commitAction({type:'AutoEnemyAdvance', playerId:'enemy'})});
  void (async () => {
    const response=await fetch(new URL('./assets/ai/iron-dust-target-bpn.json?v=1',import.meta.url));
    if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
    const {base64}=await response.json();
    trainedPolicy=await prepareIronDustTrainedPolicy(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
    globalThis.dispatchEvent(new Event('goblin-iron-dust-trained-ready'));
  })().catch(error=>console.warn('Trained Iron Dust attacker unavailable:',error.message));

  function cancelTrained() {
    if (!trained) return;
    clearTimeout(trained.timer);
    trained.fire.stop();
    trained=null;
  }
  function scheduleTrained(owner, delay = session?.projection.mode==='enemy'?140:0) {
    if (owner!==trained || paused || owner.pending || owner.timer!==null || owner.failed ||
        mode!=='ready' || session.projection.mode==='ended') return;
    owner.timer=setTimeout(() => {
      owner.timer=null;
      if (owner!==trained || paused) return;
      if (globalThis.GoblinMovement?.busy()) { scheduleTrained(owner,16); return; }
      void advanceTrained(owner);
    },delay);
  }
  async function advanceTrained(owner) {
    owner.pending=true;
    try {
      if (session.projection.mode==='enemy') {
        if (!commitAction({type:'AutoEnemyAdvance',playerId:'enemy'}).session) owner.failed=true;
        return;
      }
      const {profile,projection}=session;
      const action=choosePlayerAction({state:projection.state,hexDistance,
        query:command=>queryIronDustProfile(profile,command),
        queryWithWeapon(command,fire) {
          const next=dispatchIronDustProfile(profile,command);
          return next.profile?queryIronDustProfile(next.profile,fire):{available:false,error:next.error};
        }
      }).command;
      if (action.type==='PlayerFire') {
        owner.shot=action;
        const result=await owner.fire.advance();
        if (!result.ok) throw Error(result.code);
      } else if (!commitAction(action).session) owner.failed=true;
    } catch(error) {
      if (owner===trained) {
        owner.failed=true;
        actionError=error.message;
        renderCurrent();
      }
    } finally {
      owner.shot=null;
      owner.pending=false;
      if (owner===trained) {
        if (paused) globalThis.GoblinMovement?.clear();
        else scheduleTrained(owner);
      }
    }
  }
  function enableTrained() {
    const owner=trained={timer:null,pending:false,failed:false,shot:null,
      replay:createIronDustCommitRecorder(session.profile)};
    const scope=IRON_DUST_TRAINED_SCOPE;
    owner.fire=createIronDustDecisionHost({
      // Pause keeps this atomic fire decision valid. Leaving or restarting replaces its owner.
      readSession:()=>trained===owner?session:null,
      readEpoch:()=>epoch,
      policy:{select:(context,batch)=>trainedPolicy.select(context,{...batch,baseline:owner.shot})},
      spectator:true,feature:scope.feature,
      fireTarget:{engine:scope.engine,scope:()=>owner.shot&&
        {actorId:owner.shot.unitId,weaponRef:owner.shot.weaponKey??null}},
      install(next,command) {
        const before=session;
        const roundCommit=rounds.beginCommit();
        const ticket=observePresentation(presentation,'begin',before,command,{action:{command}});
        observePresentation(presentation,'confirm',ticket,next);
        takeAccepted(next,command,before,roundCommit);
        actionError=null;
        renderCurrent();
      }
    });
    scheduleTrained(owner);
  }
  function renderCurrent() {
    if (mode !== 'ready' || !session) return;
    renderIronDustV2View(buildIronDustV2View(session.projection,
      session.profile.header.ruleProfileId, eventHistory),
    {onAction:dispatchAction, actionError});
    endButton.disabled = !!trained || session.projection.mode !== 'player';
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
    const before = session;
    const roundCommit = session.projection.mode === 'ended' ? null : rounds.beginCommit();
    const result = dispatchIronDustBrowserAction(session, command, presentation);
    if (result.session) takeAccepted(result.session,command,before,roundCommit);
    actionError = result.error?.code ?? null;
    renderCurrent();
    return result;
  }
  function takeAccepted(next,command,before,roundCommit) {
    session=next;
    const {profile}=next, {events}=next.projection;
    captureIronDustRoundCommit(roundCommit,before.profile,{profile,events});
    trained?.replay.accept(before.profile,{action:command,profile,events});
    const cursor=before.projection.cursor;
    eventHistory.push(...events.map(event=>({...event,
      cursorPass:command.type==='AutoEnemyAdvance'?cursor?.pass:null,
      cursorIndex:command.type==='AutoEnemyAdvance'?cursor?.index:null})));
    eventHistory=eventHistory.slice(-120);
  }
  function dispatchAction(command) {
    if (trained) return {error:{code:'V2_TRAINED_ATTACK'}};
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
  function start(profile, difficulty = 'medium', minimumDifficulty, attacker = 'human') {
    if (globalThis.goblinBootProfileError || !['human','trained'].includes(attacker) ||
        attacker==='trained'&&(!trainedPolicy||IRON_DUST_LEVEL_V3.aiAllowed===false||profile!==undefined)) return false;
    cancelTrained();
    enemyFlow.cancel();
    paused = false;
    epoch++;
    try {
      globalThis.GoblinPresentation?.stop();
      session = createIronDustBrowserSession(profile ?? createIronDustProfile(startSeed, {difficulty,minimumDifficulty}),
        startSeed);
      rounds = createIronDustRoundRecorder(session.profile, () => session?.profile,
        attacker==='trained'?'spectator':'player');
      mode = 'ready';
      observePresentation(presentation,'sync',session);
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
      if (attacker==='trained') enableTrained();
      renderCurrent();
    } catch {
      cancelTrained();
      session = null;
      rounds = null;
      mode = 'error';
      showGate(globalThis.GoblinLanguage?.t('v2.reject.start') ??
        'IRON DUST v2 could not start.');
    }
    return mode === 'ready';
  }
  function stop() {
    cancelTrained();
    enemyFlow.cancel();
    paused = false;
    epoch++;
    globalThis.GoblinPresentation?.stop('core');
    session = null;
    rounds = null;
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
  const queryReady = () => mode === 'ready' && !!session && !trained && !paused && !enemyFlow.running;
  globalThis.IronDustBrowserV2 = Object.freeze({
    selectorId: IRON_DUST_V2_SELECTOR_ID,
    available: !!option && !globalThis.goblinBootProfileError,
    // Read-only mission data for selection and briefing; no session is created here.
    previewData: validateIronDustCoreDataV1(IRON_DUST_CORE_DATA_V1),
    get active() { return mode !== 'inactive'; },
    get mode() { return mode; },
    get session() { return session; },
    get epoch() { return epoch; },
    get view() { return mode === 'ready' && session ? buildIronDustV2View(session.projection,
      session.profile.header.ruleProfileId, eventHistory) : null; },
    get enemyRunning() {return enemyFlow.running;},
    get trainedAvailable() {return !!trainedPolicy && IRON_DUST_LEVEL_V3.aiAllowed!==false;},
    get trainedActive() {return !!trained;},
    roundView: () => rounds?.view() ?? null,
    replaySnapshot: () => trained?.replay.snapshot() ?? null,
    policyChoices: scopes => browserPolicies.choices(scopes),
    get queryReady() { return queryReady(); },
    query: command => queryReady() &&
      command?.type !== 'AutoEnemyAdvance' ? queryIronDustProfile(session.profile, command)
      : {available:false, error:{code:'V2_NOT_READY'}},
    previewFire: command => {
      if (!queryReady()) return null;
      const preview = queryIronDustBrowserCrtPreview(session, command);
      return preview ? Object.freeze({...preview,
        stateRevision: `core:${epoch}:${preview.stateRevision}`}) : null;
    },
    formatError: formatIronDustV2Error,
    formatEvent: formatIronDustV2Event,
    pause: () => {
      paused=true;
      enemyFlow.cancel();
      if (trained) {clearTimeout(trained.timer);trained.timer=null;}
      globalThis.GoblinMovement?.clear();
    },
    resume: () => {
      paused=false;
      if (trained) scheduleTrained(trained);
      else if (mode==='ready') enemyFlow.start();
    },
    dispatch: dispatchAction,
    difficulties: Object.freeze(IRON_DUST_ENEMY_DIFFICULTIES.slice(
      Math.max(0,IRON_DUST_ENEMY_DIFFICULTIES.indexOf(IRON_DUST_LEVEL_V3.minimumDifficulty)))),
    start,
    startWithDifficulty: (difficulty, minimumDifficulty, attacker) => start(undefined,difficulty,minimumDifficulty,attacker),
    restart: () => start(undefined,session?.profile.header.enemyPolicy?.difficulty??'medium',
      session?.profile.header.minimumDifficulty,trained?'trained':'human'),
    stop
  });
  globalThis.dispatchEvent?.(new Event('goblin-core-v2-ready'));
}
