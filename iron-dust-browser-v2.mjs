import {createIronDustTrainingArchive} from './training-archive.mjs?v=1';
import {createCorePresentationObserver} from './core-presentation.mjs?v=2';
import {createGameManager,createPlayerController} from './src/core/game-manager.mjs?v=1';
import {createIronDustHumanDefensePort} from './src/core/iron-dust-human-defense-port.mjs?v=2';
import {captureIronDustRoundCommit, createIronDustRoundRecorder} from './iron-dust-round-source.mjs?v=8';
import {createIronDustAiAdapter} from './src/core/iron-dust-ai-adapter.mjs?v=7';
import {createAiSessionHost} from './src/core/ai-session-host.mjs?v=3';
import {createAiPolicyRegistry} from './src/core/ai-policy-registry.mjs?v=1';
import {prepareIronDustTrainedPolicy, IRON_DUST_TRAINED_SCOPE} from './src/core/iron-dust-trained-policy.mjs?v=2';
import {choosePlayerAction} from './src/core/iron-dust-objective-policy.mjs?v=1';
import {selectWeakIronDustAttack} from './src/core/iron-dust-weak-policy.mjs?v=1';
import {hexDistance} from './src/core/hex.mjs';
import {createIronDustCommitRecorder} from './src/core/iron-dust-profile-replay.mjs?v=3';

function observePresentation(observer,method,...args){
  try{return observer?.[method]?.(...args);}catch{return null;}
}

import {
  createIronDustProfile, validateIronDustProfile, projectIronDustProfile,
  queryIronDustProfile, queryIronDustCrtPreview, preflightIronDustProfile, dispatchIronDustProfile,
  IRON_DUST_PROFILE_HEADER, IRON_DUST_ENEMY_DIFFICULTIES
} from './src/core/iron-dust-executable-profile.mjs?v=4';
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
const objectiveReasons = {
  'advance-toward-objective':'v2.round.objectiveMove',
  'select-weapon-for-objective':'v2.round.objectiveWeapon',
  'select-weapon-for-threat':'v2.round.objectiveWeapon',
  'no-usable-action':'v2.round.objectivePass',
  'no-objective':'v2.round.objectivePass'
};

export function createIronDustDecisionHost({readSession, readEpoch, select, policy, feature, install, spectator,
  fireTarget, weakAttack=false}) {
  if(readSession()?.aiAllowed===false)
    throw Object.assign(Error('AI control is disabled for this level'),{code:'AI_LEVEL_FORBIDDEN'});
  const native = createIronDustAiAdapter(() => ({state:readSession()?.profile,generation:readEpoch()}),{weakAttack});
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
      if (weakAttack && side!=='player') return null;
      if (fireTarget && (side !== 'player' || phase !== 'fire' || !fireTarget.scope())) return null;
      return {session:readEpoch(),side,ended:session.projection.mode === 'ended',
        engine:fireTarget?.engine ?? session.profile.profileVersion,
        profile:session.profile.header.ruleProfileId,feature};
    },
    commit(result,before,evidence) {
      install(Object.freeze({profile:result.profile,projection:projectIronDustProfile(result.profile,result.events)}),
        result.action,evidence);
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
  let attackerOwner = null;
  let manualDefense = null;
  let replay = null, trainingSeats = null;
  const presentation = globalThis.GoblinPresentation
    ? createCorePresentationObserver(globalThis.GoblinPresentation,()=>epoch) : null;
  const endButton = document.querySelector('#end-turn');
  const legacyEndClick = endButton.onclick;
  const enemyFlow = createIronDustEnemyFlow({getSession:() => mode === 'ready' && !defensePort.suppressesAutomaticDefense ? session : null,
    advance:() => commitAction({type:'AutoEnemyAdvance', playerId:'enemy'})});
  const defensePort = createIronDustHumanDefensePort({
    read:()=>({session,epoch,defenderIsHuman:!!manualDefense,
      defenderSeat:paused?null:manualDefense?.permit}),
    install(before,result) {
      const next=Object.freeze({...before,profile:result.profile,
        projection:projectIronDustProfile(result.profile,result.events)});
      installObserved(next,result.action);
    }
  });

  function seatManager() {
    return createGameManager({maxSeats:2,seatIds:['player','enemy'],aiAllowed:IRON_DUST_LEVEL_V3.aiAllowed!==false,
      minimumDifficulty:IRON_DUST_LEVEL_V3.minimumDifficulty??null},{
      player:{human:true,ai:[{id:'weak',difficulty:'weak'},...(trainedPolicy?[{id:'trained',difficulty:null}]:[])]},
      enemy:{human:true,ai:IRON_DUST_ENEMY_DIFFICULTIES.map(id=>({id,difficulty:id}))}
    });
  }
  function startSeats(selection) {
    let plan;
    try {plan=seatManager().assign(selection);}
    catch {return false;}
    const [attacker,defender]=plan;
    return start(undefined,defender.difficulty??'medium',IRON_DUST_LEVEL_V3.minimumDifficulty,
      attacker.policyId??'human',defender.controller==='human');
  }
  function switchHumanSeat(side) {
    if (!manualDefense) return;
    defensePort.invalidate();
    manualDefense.permit=null;
    manualDefense.pending=side?Object.freeze({side}):null;
  }
  function settleDefense() {
    const permit=manualDefense?.permit;
    while (permit && manualDefense?.permit===permit && defensePort.suppressesAutomaticDefense) {
      const offer=defensePort.open(permit);
      if (offer.kind!=='mechanical' || !defensePort.advanceMechanical(permit,offer.ticket).ok) return;
    }
  }
  function takeSeat(handoff) {
    if (paused || !handoff || manualDefense?.pending!==handoff) return false;
    manualDefense.pending=null;
    if (handoff.side==='enemy') {
      manualDefense.permit=Object.freeze({});
      settleDefense();
    }
    if (attackerOwner) scheduleAttacker(attackerOwner);
    renderCurrent();
    return true;
  }
  function defenseOffer() {
    if (!manualDefense?.permit) return null;
    const offer=defensePort.open(manualDefense.permit);
    return offer.kind==='choice'?offer:null;
  }
  function chooseDefense(ticket,key) {
    const offer=defenseOffer();
    if (!offer || ticket!==offer.ticket) return {ok:false,code:'IRON_DUST_DEFENDER_STALE'};
    const controller=createPlayerController('enemy',decision=>decision.candidates.find(item=>item.key===key)?.key);
    const choice=controller.nextCommand(offer);
    const result=defensePort.commit(manualDefense.permit,ticket,choice);
    if (result.ok) {
      settleDefense();
      if (attackerOwner) scheduleAttacker(attackerOwner);
      renderCurrent();
    }
    return result;
  }
  void (async () => {
    const response=await fetch(new URL('./assets/ai/iron-dust-target-bpn.json?v=1',import.meta.url));
    if (!response.ok) throw Error('AI_POLICY_MODEL_UNAVAILABLE');
    const {base64}=await response.json();
    trainedPolicy=await prepareIronDustTrainedPolicy(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
    globalThis.dispatchEvent(new Event('goblin-iron-dust-trained-ready'));
  })().catch(error=>console.warn('Trained Iron Dust attacker unavailable:',error.message));

  function cancelAttacker() {
    if (!attackerOwner) return;
    clearTimeout(attackerOwner.timer);
    attackerOwner.host.stop();
    attackerOwner=null;
  }
  function scheduleAttacker(owner, delay = session?.projection.mode==='enemy'?140:0) {
    if (owner!==attackerOwner || paused || owner.pending || owner.timer!==null || owner.failed ||
        mode!=='ready' || session.projection.mode==='ended' || defensePort.suppressesAutomaticDefense) return;
    owner.timer=setTimeout(() => {
      owner.timer=null;
      if (owner!==attackerOwner || paused || defensePort.suppressesAutomaticDefense) return;
      if (globalThis.GoblinMovement?.busy()) { scheduleAttacker(owner,16); return; }
      void advanceAttacker(owner);
    },delay);
  }
  async function advanceAttacker(owner) {
    owner.pending=true;
    try {
      if (session.projection.mode==='enemy') {
        if (!commitAction({type:'AutoEnemyAdvance',playerId:'enemy'}).session) owner.failed=true;
        return;
      }
      if (owner.id==='weak') {
        const result=await owner.host.advance();
        if (!result.ok) throw Error(result.code);
        return;
      }
      const {profile,projection}=session;
      const {command:action,explanation}=choosePlayerAction({state:projection.state,hexDistance,
        query:command=>queryIronDustProfile(profile,command),
        queryWithWeapon(command,fire) {
          const next=dispatchIronDustProfile(profile,command);
          return next.profile?queryIronDustProfile(next.profile,fire):{available:false,error:next.error};
        }
      });
      if (action.type==='PlayerFire') {
        owner.shot=action;
        const result=await owner.host.advance();
        if (!result.ok) throw Error(result.code);
      } else if (!commitAction(action,{explanationKey:objectiveReasons[explanation.reason]}).session) owner.failed=true;
    } catch(error) {
      if (owner===attackerOwner) {
        owner.failed=true;
        actionError=error.message;
        renderCurrent();
      }
    } finally {
      owner.shot=null;
      owner.pending=false;
      if (owner===attackerOwner) {
        if (paused) globalThis.GoblinMovement?.clear();
        else scheduleAttacker(owner);
      }
    }
  }
  function enableAttacker(id) {
    const owner=attackerOwner={id,timer:null,pending:false,failed:false,shot:null};
    const controller=id==='weak'?createPlayerController('player',selectWeakIronDustAttack):null;
    const scope=IRON_DUST_TRAINED_SCOPE;
    owner.host=createIronDustDecisionHost({
      // Pause keeps this atomic fire decision valid. Leaving or restarting replaces its owner.
      readSession:()=>attackerOwner===owner?session:null,
      readEpoch:()=>epoch,
      spectator:true,
      ...(controller?{weakAttack:true,select:controller.nextCommand}:{
        policy:{select:(context,batch,report)=>trainedPolicy.select(context,{...batch,baseline:owner.shot},report)},
        feature:scope.feature,
        fireTarget:{engine:scope.engine,scope:()=>owner.shot&&
          {actorId:owner.shot.unitId,weaponRef:owner.shot.weaponKey??null}}
      }),
      install(next,command,evidence) {
        installObserved(next,command,evidence);
        renderCurrent();
      }
    });
    scheduleAttacker(owner);
  }
  function renderCurrent() {
    if (mode !== 'ready' || !session) return;
    renderIronDustV2View(buildIronDustV2View(session.projection,
      session.profile.header.ruleProfileId, eventHistory),
    {onAction:dispatchAction, actionError});
    endButton.disabled = !!attackerOwner || session.projection.mode !== 'player';
    const t = key => globalThis.GoblinLanguage?.t(key) ?? key;
    endButton.textContent = session.projection.mode === 'ended' ? t('v2.ended') :
      session.projection.mode === 'enemy' ? t('v2.enemy') :
      attackerOwner ? t('v2.feedback.autoAttack') :
        session.projection.state.phase === 'gev' ? t('v2.endTurn') : t('v2.next');
    const undo = document.querySelector('#undo-command');
    undo.disabled = true;
    undo.title = t('v2.undo');
    globalThis.dispatchEvent?.(new Event('goblin-core-v2-render'));
  }
  function commitAction(command,evidence) {
    if (mode !== 'ready' || !session) return {error:{code:'V2_NOT_READY'}};
    const before = session;
    const roundCommit = session.projection.mode === 'ended' ? null : rounds.beginCommit();
    const result = dispatchIronDustBrowserAction(session, command, presentation);
    const choice=evidence??(command.type==='AutoEnemyAdvance'?{explanationKey:'v2.round.standardAction'}:undefined);
    if (result.session) takeAccepted(result.session,command,before,roundCommit,choice);
    actionError = result.error?.code ?? null;
    renderCurrent();
    return result;
  }
  function takeAccepted(next,command,before,roundCommit,evidence) {
    session=next;
    const {profile}=next, {events}=next.projection;
    captureIronDustRoundCommit(roundCommit,before.profile,{profile,events,action:command,evidence});
    replay?.accept(before.profile,{action:command,profile,events});
    if (manualDefense && before.projection.mode!==next.projection.mode)
      switchHumanSeat(next.projection.mode==='enemy'?'enemy':
        next.projection.mode==='player'&&!attackerOwner?'player':null);
    const cursor=before.projection.cursor;
    eventHistory.push(...events.map(event=>({...event,
      cursorPass:command.type==='AutoEnemyAdvance'?cursor?.pass:null,
      cursorIndex:command.type==='AutoEnemyAdvance'?cursor?.index:null})));
    eventHistory=eventHistory.slice(-120);
  }
  function installObserved(next,command,evidence) {
    const before=session;
    const roundCommit=rounds.beginCommit();
    const ticket=observePresentation(presentation,'begin',before,command,{action:{command}});
    observePresentation(presentation,'confirm',ticket,next);
    takeAccepted(next,command,before,roundCommit,evidence);
    actionError=null;
  }
  function dispatchAction(command) {
    if (attackerOwner) return {error:{code:attackerOwner.id==='trained'?'V2_TRAINED_ATTACK':'V2_SEAT_NOT_AUTHORIZED'}};
    if (paused) return {error:{code:'V2_PAUSED'}};
    if (manualDefense?.pending || defensePort.suppressesAutomaticDefense)
      return {error:{code:'V2_SEAT_NOT_AUTHORIZED'}};
    if (command?.type === 'AutoEnemyAdvance' || enemyFlow.running) {
      actionError = command?.type === 'AutoEnemyAdvance' ?
        'ENEMY_TURN_AUTOMATED' : 'ENEMY_TURN_RUNNING';
      renderCurrent();
      return {error:{code:actionError}};
    }
    const result = commitAction(command);
    if (result.session?.projection.mode === 'enemy' && !defensePort.suppressesAutomaticDefense) enemyFlow.start();
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
  function start(profile, difficulty = 'medium', minimumDifficulty, attacker = 'human', defenderHuman = false) {
    const aiAttacker=attacker!=='human';
    if (globalThis.goblinBootProfileError || aiAttacker&&(profile!==undefined||
        !seatManager().seats[0].ai.some(policy=>policy.id===attacker)||
        attacker==='weak'&&['medium','strong'].includes(minimumDifficulty))) return false;
    cancelAttacker();
    manualDefense=null;
    replay=null;
    trainingSeats=null;
    defensePort.invalidate();
    enemyFlow.cancel();
    paused = false;
    epoch++;
    try {
      globalThis.GoblinPresentation?.stop();
      session = createIronDustBrowserSession(profile ?? createIronDustProfile(startSeed, {difficulty,minimumDifficulty}),
        startSeed);
      rounds = createIronDustRoundRecorder(session.profile, () => session?.profile,
        aiAttacker&&!defenderHuman?'spectator':'player');
      if (defenderHuman) manualDefense={permit:null,pending:null};
      if (!profile || defenderHuman || aiAttacker) replay=createIronDustCommitRecorder(session.profile);
      trainingSeats=!profile && (!aiAttacker || defenderHuman)
        ? {attacker,defender:defenderHuman?'human':difficulty} : null;
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
      if (aiAttacker) enableAttacker(attacker);
      renderCurrent();
    } catch {
      cancelAttacker();
      manualDefense=null;
      replay=null;
      trainingSeats=null;
      session = null;
      rounds = null;
      mode = 'error';
      showGate(globalThis.GoblinLanguage?.t('v2.reject.start') ??
        'IRON DUST v2 could not start.');
    }
    return mode === 'ready';
  }
  function stop() {
    cancelAttacker();
    manualDefense=null;
    replay=null;
    trainingSeats=null;
    defensePort.invalidate();
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
  const canExportTraining=()=>!!trainingSeats && session?.projection.mode==='ended' && !!replay;
  function trainingArchive() {
    if (!canExportTraining()) return null;
    return createIronDustTrainingArchive(replay.snapshot(),{
      ...trainingSeats,outcome:session.projection.state.victory.winner
    });
  }
  const queryReady = () => mode === 'ready' && !!session && !attackerOwner && !paused && !enemyFlow.running &&
    !manualDefense?.pending && !defensePort.suppressesAutomaticDefense;
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
    get trainedActive() {return attackerOwner?.id==='trained';},
    get attackerActive() {return !!attackerOwner;},
    roundView: () => rounds?.view() ?? null,
    // Iron Dust has one shared battlefield projection. Both humans use the
    // existing redacted event view, scoped here to the active defense seat.
    defenseRoundView: () => defenseOffer() ? rounds?.view() ?? null : null,
    get canExportTraining() {return canExportTraining();},
    trainingArchive,
    replaySnapshot: () => manualDefense||attackerOwner ? replay?.snapshot() ?? null : null,
    seatManager,startSeats,takeSeat,defenseOffer,chooseDefense,
    get handoff() {return manualDefense?.pending??null;},
    get pendingSeat() {return manualDefense?.pending?.side??null;},
    get humanDefenseActive() {return defensePort.suppressesAutomaticDefense;},
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
      if (defensePort.suppressesAutomaticDefense) switchHumanSeat('enemy');
      enemyFlow.cancel();
      if (attackerOwner) {clearTimeout(attackerOwner.timer);attackerOwner.timer=null;}
      globalThis.GoblinMovement?.clear();
    },
    resume: () => {
      paused=false;
      if (attackerOwner) scheduleAttacker(attackerOwner);
      else if (mode==='ready' && !defensePort.suppressesAutomaticDefense) enemyFlow.start();
    },
    dispatch: dispatchAction,
    difficulties: Object.freeze(IRON_DUST_ENEMY_DIFFICULTIES.slice(
      Math.max(0,IRON_DUST_ENEMY_DIFFICULTIES.indexOf(IRON_DUST_LEVEL_V3.minimumDifficulty)))),
    start: (profile,difficulty,minimumDifficulty,attacker)=>start(profile,difficulty,minimumDifficulty,attacker),
    startWithDifficulty: (difficulty, minimumDifficulty, attacker) => start(undefined,difficulty,minimumDifficulty,attacker),
    restart: () => start(undefined,session?.profile.header.enemyPolicy?.difficulty??'medium',
      session?.profile.header.minimumDifficulty,attackerOwner?.id??'human',!!manualDefense),
    stop
  });
  globalThis.dispatchEvent?.(new Event('goblin-core-v2-ready'));
}
