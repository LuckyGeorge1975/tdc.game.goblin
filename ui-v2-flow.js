// V2 navigation over the validated Legacy scenarios and separate Core mission.
if (globalThis.GoblinUIV2 && !globalThis.goblinBootProfileError) {
  (() => {
    const shell = document.querySelector('.v2-shell');
    const surface = document.createElement('section');
    surface.id = 'v2-screen';
    surface.className = 'v2-screen';
    shell.appendChild(surface);
    const t = (key, params) => GoblinLanguage.t(key, params);
    const trainingPanel=document.querySelector('#v2-training');
    const targetTrainingCopy = {
      'training.selectActor':'v2.training.selectActor', 'training.previewMove':'v2.training.previewMove',
      'training.confirmMove':'v2.training.confirmMove', 'training.inspectShot':'v2.training.inspectShot',
      'training.cancelIntent':'v2.training.closeTarget'
    };
    function renderTraining(){
      const activeAction=document.activeElement?.dataset?.trainingAction;
      const v=globalThis.GoblinTrainingRuntime?.view();trainingPanel.hidden=screen!=='play'||!v;
      document.querySelectorAll('.training-highlight').forEach(node=>node.classList.remove('training-highlight'));
      const p=v?.progress,step=v?.definition.steps.find(s=>s.id===p.stepId);
      if(v?.definition.mode==='advisory'&&(!step.messageKey||p.status==='abandoned'))trainingPanel.hidden=true;
      if(trainingPanel.hidden){
        if(activeAction&&screen==='play')document.querySelector('#v2-map')?.focus({preventScroll:true});
        return;
      }
      const params=Object.fromEntries(Object.entries(step.paramRefs).map(([key,ref])=>[key,v.params[ref]??'']));
      const projection=GoblinUIV2.project(),controls={back:'#v2-undo',phase:'#v2-phase-action',cancel:'#v2-map',confirm:'#v2-action-execute',exit:'#v2-pause'};
      const t02=projection.scenario==='training-t02';
      const waiting=t02&&((p.status==='ready-for-debrief'&&globalThis.GoblinMovement?.busy())||
        (p.status!=='lesson-failed'&&p.stepId==='round'&&projection.phase==='enemy'));
      if(projection.scenario==='training-t01'||t02){
        for(const [key,ref] of Object.entries(step.paramRefs)){
          if(ref.startsWith('actor:')){
            const id=v.definition.actorTags[ref.slice(6)];
            params[key]=projection.units.find(unit=>unit.id===id)?.name??params[key];
          }
        }
        params.back=GoblinLanguage.translate('BACK');
        params.phase=t('dialog.phaseAdvance.confirm.toFire');
      }
      for(const ref of step.highlightRefs){
        if(ref.kind==='control'){document.querySelector(controls[ref.ref])?.classList.add('training-highlight');continue}
        const cells=ref.kind==='region'?v.regions[ref.ref]:projection.units.filter(u=>u.id===v.definition.actorTags[ref.ref]);
        cells?.forEach(c=>document.querySelector(`#battlefield-map .hex[data-x="${c.x}"][data-y="${c.y}"]`)?.classList.add('training-highlight'));
      }
      const canAcknowledge=step.category==='explanation'||
        (step.category==='instruction'&&step.completeWhen?.op==='uiFact'&&step.completeWhen.type==='acknowledgeInstruction');
      trainingPanel.classList.toggle('v2-training-confirmation',!waiting&&(canAcknowledge||p.status==='ready-for-debrief'));
      trainingPanel.replaceChildren();
      const title=document.createElement('strong');
      title.id='v2-training-title';
      title.textContent=t(v.definition.mode==='advisory'?'ui.nav.missions':'training.learningGoal');
      if(waiting){
        trainingPanel.append(title,paragraph(t('v2.training.waitForEnemy')));
        if(activeAction)document.querySelector('#v2-map')?.focus({preventScroll:true});
        return;
      }
      const key=p.status==='lesson-failed'?'training.failure.title':p.status==='lesson-complete'?'training.complete.title':p.recoveryOffered?'training.recovery':step.messageKey;
      const effect=t02&&p.stepId==='result'?GoblinTrainingRuntime.shotEffect():null;
      if(effect)params.effect=t(`v2.training.effect.${effect}`);
      let copy=targetTrainingCopy[key]??key;
      if(t02&&key==='training.inspectShot')copy='v2.training.inspectShotPanel';
      if(key==='training.confirmShot'){
        copy='v2.training.confirmAttack';
      }
      if(t02&&key==='training.enterPhase')copy='v2.training.enterPhase';
      if(t02&&key==='training.advanceRound'){
        copy=projection.turnPhase==='gev'?'v2.training.startEnemy':'v2.training.finishFire';
        params.action=t(projection.turnPhase==='gev'?'dialog.phaseAdvance.confirm.toEnemy':'dialog.phaseAdvance.confirm.toGev');
      }
      trainingPanel.append(title,paragraph(t(copy,params)));
      const preview=t02&&GoblinUIV2.trainingFirePreview(projection);
      if(preview)trainingPanel.append(paragraph([
        t('v2.training.previewRatio',{ratio:preview.ratio}),
        t('v2.target.hit',{percent:Math.round(preview.hit*100)}),
        t('v2.target.destroy',{percent:Math.round(preview.destroy*100)})
      ].join(' · '),'v2-training-preview'));
      if(t02&&key==='training.readyForDebrief')trainingPanel.append(paragraph(t('training.roundComplete',{phase:t('v2.phase.movement')})));
      if (campaign?.sessionId === p.binding.sessionId) trainingPanel.append(paragraph(campaignPosition()));
      if(p.stepId==='terrain'&&v.params['query:cost']!=='')trainingPanel.append(paragraph(t('training.moveCost',{cost:v.params['query:cost'],available:v.params['query:available']})));
      if(['infantry','practice'].includes(p.stepId))trainingPanel.append(paragraph(t('v2.training.confirmMove',{region:v.params['region:practice']})));
      if(p.status==='ready-for-debrief')trainingPanel.append(paragraph(t('training.debrief.skills',{skills:t(`mission.${currentScenario}.objective.short`)})));
      const trainingButton=(key,action,className)=>{
        const node=button(t(key),action,className);
        node.dataset.trainingAction=key;
        return node;
      };
      const row=actions(trainingButton('training.repeatInstruction',()=>GoblinTrainingRuntime.ack('repeat')));
      if(canAcknowledge)row.append(trainingButton('ui.dialog.confirm',event=>{
        // This acknowledges a hint without acting on the selected hex.
        event.stopPropagation();
        GoblinTrainingRuntime.ack();
        if(v.definition.mode==='advisory'||t02&&p.stepId==='result')GoblinUIV2.refresh();
      }));
      if(p.status==='ready-for-debrief')row.append(trainingButton('training.debrief.confirm',async()=>{const binding=p.binding.sessionId,sequence=p.sequence;const accepted=await GameDialogs.confirm({id:'training-debrief',title:t('training.debrief.title'),message:t('training.readyForDebrief'),acceptLabel:t('training.debrief.confirm'),cancelLabel:t('ui.dialog.cancel')});const current=GoblinTrainingRuntime.view()?.progress;if(accepted&&current?.binding.sessionId===binding&&current.sequence===sequence){GoblinTrainingRuntime.ack('debrief');GoblinUIV2.refresh()}},'primary'));
      if(v.definition.mode==='advisory')row.append(trainingButton('ui.dialog.cancel',()=>GoblinTrainingRuntime.setAdvisory(false)));
      else row.append(trainingButton('training.restartLesson',confirmRestart),trainingButton('training.exit',goToLevels));
      trainingPanel.append(row);
      if(activeAction)(row.querySelector(`[data-training-action="${activeAction}"]`)??document.querySelector('#v2-map'))?.focus({preventScroll:true});
    }
    const requestedScenario=new URLSearchParams(globalThis.location?.search||'').get('scenario');
    let missionId = globalThis.GoblinCatalogFullModel?.has(requestedScenario)&&currentScenario===requestedScenario?requestedScenario:'iron-dust', started = false, startError = '';
    let screen = 'menu', returnScreen = 'menu', pauseActive = false, savedAuto = false, playScrollY = 0;
    let roundAnalysis = null;
    let fullSeatBinding = null;
    let fullHandoff = null;
    let fullSetupDialog = null;
    let spectatorInput = null;
    let spectatorEscapeHeld = false;
    const campaignLessons = ['training-t01', 'training-t02'];
    const fieldCampaigns = {
      relay: {file:'relay-line', ids:['relay-line-bridge', 'relay-line-relay'], unlocked:1},
      scorched: {file:'scorched-earth', ids:['ash-road','black-ridge','salt-flats','floodline',
        'cut-the-relay','dead-ground','cinder-yard','ignition','forge-crossing','steel-gate',
        'ghost-quarter','last-ember'].map(id => 'scorched-' + id), unlocked:1}
    };
    let fieldKey = 'relay', fieldLoading = false, fieldError = '';
    let campaign = null;
    let editorDraft = null, editorCell = {x:0,y:0}, editorError = '', editorBusy = false, editorMoving = false;
    let editorConfig = null, editorReturnScenario = null;
    let savedConfig = null, savedTitle = '', savedTab = false, savedStarting = false, savedError = '';
    let editorSaved = null, editorName = '', editorSavedMessage = '';
    let editorMissionOpen = false, editorImportLevels = null;
    let optionsScrollObserver = null;
    let briefingDifficulty = 'medium';
    let libraryIndex = 0, libraryTab = 'description', libraryArtSide = 'own', libraryMapMode = 'move';
    let libraryWeapon = null, libraryRule = null, libraryLiveId = null;
    let libraryKind = 'units', terrainIndex = 0;
    const focusMemory = new Map(), scrollMemory = new Map();
    const waiting = [];
    globalThis.GoblinV2PauseGate = Object.freeze({
      whenResumed: () => pauseActive ? new Promise(resolve => waiting.push(resolve)) : Promise.resolve()
    });

    function releasePause(refreshPlay = true, resumeCore = true) {
      if (!pauseActive) return;
      pauseActive = false;
      if (resumeCore) globalThis.IronDustBrowserV2?.resume();
      document.querySelector('#auto-end-turn').checked = savedAuto;
      waiting.splice(0).forEach(resolve => resolve());
      if (refreshPlay && screen === 'play') {
        GoblinUIV2.refresh();
        maybeAutoAdvancePhase();
      }
    }
    function holdPlay(clearMovement = true) {
      if (GameDialogs.isOpen() || pauseActive) return false;
      if (clearMovement) globalThis.GoblinMovement?.clear();
      savedAuto = document.querySelector('#auto-end-turn').checked;
      document.querySelector('#auto-end-turn').checked = false;
      pauseActive = true;
      if (globalThis.IronDustBrowserV2?.mode === 'ready') IronDustBrowserV2.pause();
      return true;
    }
    function enterPause() {
      if (holdPlay()) show('pause');
    }
    function chooseFullSeats(config) {
      const owner = globalThis.GoblinFullSeatOwner;
      if (fullSetupDialog) return Promise.resolve(false);
      if (!owner || config?.ruleProfileId !== 'FULL_CATALOG_v1' ||
          !ScenarioRuleProfiles.aiAllowed(config)) return null;
      const offers = owner.offers(config);
      if (!offers) return null;
      const dialog = document.createElement('dialog');
      dialog.className = 'game-dialog';
      const form = document.createElement('form');
      form.method = 'dialog';
      const title = heading(t('v2.full.seats'));
      dialog.setAttribute('aria-labelledby', title.id = 'v2-full-seat-heading');
      form.append(title);
      const selectors = ['player', 'enemy'].map(side => {
        const label = document.createElement('label');
        label.textContent = t('v2.full.seat.' + side) + ' ';
        const select = document.createElement('select');
        const choices = new Set();
        for (const {id, label:copy} of [{id:'',label:t('v2.full.human')}, ...offers[side]]) {
          const option = document.createElement('option');
          option.value = id;
          option.textContent = copy;
          select.append(option);
          choices.add(id);
        }
        label.append(select);
        form.append(label);
        return {side, select, choices};
      });
      const submit = document.createElement('button');
      submit.value = 'configured';
      submit.textContent = t('screen.briefing.startMission');
      const standard = document.createElement('button');
      standard.value = 'standard';
      standard.textContent = t('v2.full.standard');
      const cancel = document.createElement('button');
      cancel.value = 'cancel';
      cancel.textContent = t('ui.dialog.cancel');
      form.append(actions(submit, standard, cancel));
      dialog.append(form);
      document.body.append(dialog);
      return new Promise(resolve => {
        dialog.addEventListener('close', () => {
          fullSetupDialog = null;
          dialog.remove();
          if (dialog.returnValue === 'standard') return resolve(null);
          if (dialog.returnValue !== 'configured' ||
              selectors.some(({select, choices}) => !choices.has(select.value))) return resolve(false);
          resolve({owner, selection:Object.freeze(Object.fromEntries(
            selectors.map(({side, select}) => [side, select.value || null])))});
        }, {once:true});
        dialog.showModal();
        fullSetupDialog = dialog;
      });
    }
    function bindFullSeats(setup) {
      fullHandoff = null;
      fullSeatBinding = null;
      if (!setup || legacySession.ruleProfileId !== 'FULL_CATALOG_v1' || setup.owner !== globalThis.GoblinFullSeatOwner ||
          !ScenarioRuleProfiles.aiAllowed(legacySession.config)) return;
      const session = legacySession;
      const binding = {...setup, session, generation:-1};
      fullSeatBinding = binding;
      setup.owner.bind(session, setup.selection, {
        handoff(seat, takeSeat) {
          if (legacySession !== session || fullSeatBinding !== binding || fullHandoff ||
              seat?.sessionId !== session.sessionId || !['player', 'enemy'].includes(seat.side) ||
              !Number.isSafeInteger(seat.generation) || seat.generation <= binding.generation ||
              typeof takeSeat !== 'function') return false;
          binding.generation = seat.generation;
          fullHandoff = {session, takeSeat, taking:false};
          GoblinUIV2.cancelMapPointers();
          if (globalThis.GoblinCatalogFullRuntime?.ownsPresentation?.()) GoblinUIV2.refresh();
          show('full-handoff');
          return true;
        }
      });
    }
    function takeFullSeat() {
      const handoff = fullHandoff;
      if (!handoff || handoff.session !== legacySession || handoff.taking) return;
      handoff.taking = true;
      if (handoff.takeSeat() !== true) return;
      if (handoff !== fullHandoff || handoff.session !== legacySession) return;
      fullHandoff = null;
      show('play');
    }
    // The caller owns the isolated match; the screen owns browser input and
    // restoration of the underlying play session.
    function acquireSpectatorInput(dialog, stop, focus = document.activeElement) {
      if (spectatorInput || GameDialogs.isOpen() || dialog.open || !dialog.isConnected ||
          !['menu', 'play', 'pause'].includes(screen)) return null;
      const core = globalThis.IronDustBrowserV2;
      if (screen === 'play' && (pauseActive || core?.mode !== 'ready' || core.enemyRunning ||
          globalThis.GoblinMovement?.busy() || GoblinUIV2.project().gameOver)) return null;
      const owner = legacySession, epoch = core?.epoch, origin = screen;
      const ownsPause = origin === 'play' && holdPlay(false);
      const leave = () => {
        if (spectatorInput?.leave !== leave) return;
        try {
          stop();
        } finally {
          dialog.removeEventListener('cancel', cancel);
          dialog.removeEventListener('close', leave);
          if (dialog.open) dialog.close();
          const sameSession = screen === origin && legacySession === owner && core?.epoch === epoch;
          spectatorInput = null;
          if (ownsPause) releasePause(false, sameSession);
          if (sameSession) (focus?.isConnected ? focus : document.getElementById(focus?.id))?.focus({preventScroll:true});
        }
      };
      function cancel(event) {
        event.preventDefault();
        leave();
      }
      spectatorInput = {dialog, leave};
      GoblinUIV2.cancelMapPointers();
      dialog.addEventListener('cancel', cancel);
      dialog.addEventListener('close', leave);
      try {
        dialog.showModal();
      } catch (error) {
        leave();
        throw error;
      }
      return leave;
    }
    globalThis.GoblinV2SpectatorInput = Object.freeze({acquire: acquireSpectatorInput});
    function button(label, action, className = '') {
      const node = document.createElement('button');
      node.type = 'button'; node.className = className;
      node.textContent = label; node.onclick = action;
      return node;
    }
    function paragraph(copy, className = '') {
      const node = document.createElement('p'); node.className = className; node.textContent = copy;
      return node;
    }
    function heading(copy) {
      const node = document.createElement('h2'); node.id = 'v2-screen-heading'; node.tabIndex = -1;
      node.textContent = copy; return node;
    }
    function actions(...nodes) {
      const row = document.createElement('div'); row.className = 'v2-screen-actions';
      row.append(...nodes); return row;
    }
    function missionData(id) {
      for (const field of Object.values(fieldCampaigns)) {
        const config = field.configs?.[field.ids.indexOf(id)];
        if (config) return {width:config.width??12,height:config.height??8,defaultTerrain:'open-ground',terrain:config.terrainTypes,
          units:GoblinCatalogFullRuntime.initialRoster(config)};
      }
      if (id === 'iron-dust-v2') {
        const source = globalThis.IronDustBrowserV2?.previewData;
        if (!globalThis.IronDustBrowserV2?.available ||
            source?.dataContractVersion !== 'iron-dust-core-data-v1' ||
            source.executable !== false || !Object.isFrozen(source) ||
            source.map?.width !== 12 || source.map?.height !== 8 ||
            !Array.isArray(source.map.terrain) || !Array.isArray(source.units)) return null;
        return {width: source.map.width, height: source.map.height,
          defaultTerrain: source.map.defaultTerrain, terrain: source.map.terrain,
          units: source.units};
      }
      if (!Object.hasOwn(ScenarioRuleProfiles.entries, id)) return null;
      const config = scenarioCatalog[id];
      if (!config) return null;
      try { ScenarioRuleProfiles.validate(id, config); } catch { return null; }
      if (!Array.isArray(config.terrain) || !Array.isArray(config.units) ||
          (config.terrainTypes !== undefined && !Array.isArray(config.terrainTypes))) return null;
      return {width: 12, height: 8, defaultTerrain: 'open-ground',
        terrain: [
          ...config.terrain.map(key => {
            const [x, y] = key.split(',').map(Number);
            return {x, y, type: 'rubble-field'};
          }),
          ...(config.terrainTypes || [])
        ], units: globalThis.GoblinCatalogFullRuntime?.initialRoster(config)??config.units};
    }
    function missionPreview(data) {
      if (!data) return paragraph(t('screen.briefing.dataUnavailable'), 'v2-status');
      const figure = document.createElement('figure'); figure.className = 'v2-mission-map';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${460+(data.width-12)*36} ${254+(data.height-8)*30}`);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', t('v2.ui.previewMap'));
      const terrain = new Map(data.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
      const tiled = globalThis.TerrainTiles?.drawBoard(svg, (x, y) => terrain.get(`${x},${y}`) || data.defaultTerrain,
        data.width, data.height, (x, y) => ({x: 23 + x * 36 + (y % 2 ? 18 : 0), y: 20 + y * 30}), 36) ?? new Set();
      for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
        const cx = 23 + x * 36 + (y % 2 ? 18 : 0), cy = 20 + y * 30;
        const type = terrain.get(`${x},${y}`) || data.defaultTerrain;
        const illustrated = tiled.has(`${x},${y}`);
        const polygon = document.createElementNS(svg.namespaceURI, 'polygon');
        polygon.setAttribute('points', Array.from({length: 6}, (_, i) => {
          const angle = Math.PI / 3 * i + Math.PI / 6;
          return `${cx + 20 * Math.cos(angle)},${cy + 20 * Math.sin(angle)}`;
        }).join(' '));
        polygon.setAttribute('class', illustrated ? 'v2-preview-tiled' : type !== data.defaultTerrain ? 'v2-preview-terrain' : 'v2-preview-open');
        polygon.setAttribute('data-terrain-id', type);
        const title = document.createElementNS(svg.namespaceURI, 'title');
        title.textContent = TerrainDisplay.label(type);
        polygon.append(title);
        svg.append(polygon);
        const icon = illustrated ? null : TerrainDisplay.svgIcon(type, cx - 18, cy - 21);
        if (icon) svg.append(icon);
      }
      for (const unit of data.units) {
        const cx = 23 + unit.x * 36 + (unit.y % 2 ? 18 : 0), cy = 20 + unit.y * 30;
        const radius = unit.core ? 10 : 8;
        const marker = document.createElementNS(svg.namespaceURI, 'polygon');
        marker.setAttribute('points', unit.team === 'player'
          ? Array.from({length: 6}, (_, i) => {
            const angle = Math.PI / 3 * i + Math.PI / 6;
            return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
          }).join(' ')
          : `${cx},${cy - radius} ${cx + radius},${cy} ${cx},${cy + radius} ${cx - radius},${cy}`);
        marker.setAttribute('class', unit.team === 'player' ? 'v2-preview-own' : 'v2-preview-enemy');
        svg.append(marker);
        const artwork = UnitVisuals.assetFor(unit);
        if (artwork) {
          const image = document.createElementNS(svg.namespaceURI, 'image');
          image.setAttribute('x', cx - 12); image.setAttribute('y', cy - 12);
          image.setAttribute('width', 24); image.setAttribute('height', 24);
          image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          image.setAttribute('pointer-events', 'none');
          svg.append(image);
          UnitVisuals.watchMapImage(image, artwork, () => image.remove());
          image.setAttribute('href', artwork);
        }
      }
      figure.append(svg);
      return figure;
    }
    // Lists scroll without system scrollbars; step buttons above and below page through the items.
    function steppedList(list, extraClass = '') {
      // Start as overflowing so a restored scroll position is not clamped before the first measurement.
      const frame = document.createElement('div'); frame.className = 'v2-stepped-list v2-overflowing';
      if (extraClass) frame.classList.add(extraClass);
      const step = direction => {
        const node = button('', () => list.scrollBy({
          top: direction * Math.max(list.clientHeight - 72, 48), behavior: 'smooth'
        }), 'v2-list-step');
        // Disabled until measured, out of tab order and never focused by a click: focus restore skips them.
        node.tabIndex = -1; node.disabled = true;
        node.onpointerdown = event => event.preventDefault();
        node.setAttribute('aria-label', t(direction < 0 ? 'v2.ui.list.up' : 'v2.ui.list.down'));
        node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction < 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'}"/></svg>`;
        return node;
      };
      const up = step(-1), down = step(1);
      const sync = () => {
        const overflowing = list.scrollHeight > list.clientHeight + 1;
        frame.classList.toggle('v2-overflowing', overflowing);
        up.disabled = !overflowing || list.scrollTop <= 1;
        down.disabled = !overflowing || list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      };
      list.addEventListener('scroll', sync, {passive: true});
      new ResizeObserver(sync).observe(list);
      frame.append(up, list, down);
      return frame;
    }
    function missionStats(data) {
      if (!data) return document.createElement('div');
      const stats = document.createElement('div'); stats.className = 'v2-mission-stats';
      for (const [key, count] of [['own', data.units.filter(unit => unit.team === 'player').length], ['enemy', data.units.filter(unit => unit.team === 'enemy').length]]) {
        const item = document.createElement('div');
        const label = document.createElement('span'); label.textContent = t(`v2.ui.preview.${key}`);
        const value = document.createElement('strong'); value.textContent = String(count);
        item.append(label, value); stats.append(item);
      }
      return stats;
    }
    // Range overlay opacity (UR-F), a local display preference between 10 % and 60 %.
    const overlayAlphaKey = 'goblin.v2.overlayAlpha';
    function overlayAlpha() {
      let value = NaN;
      try { value = Number(localStorage.getItem(overlayAlphaKey)); } catch {}
      return Number.isFinite(value) && value >= .1 && value <= .6 ? value : .28;
    }
    function applyOverlayAlpha(value) {
      document.body.style.setProperty('--v2-overlay-alpha', String(value));
      try { localStorage.setItem(overlayAlphaKey, String(value)); } catch {}
    }
    document.body.style.setProperty('--v2-overlay-alpha', String(overlayAlpha()));
    function show(next, focus = true) {
      if (fullHandoff && next !== 'full-handoff') return;
      const previous = screen;
      if (previous === 'editor' && next !== 'editor') editorMoving = false;
      const active = document.activeElement;
      if (previous === 'levels') focusMemory.set(previous, savedTab ? 'v2-level-tab-own' : `v2-level-${missionId}`);
      else if (surface.contains(active) && active.id) focusMemory.set(previous, active.id);
      const currentPanel = surface.querySelector('.v2-screen-panel');
      if (currentPanel) scrollMemory.set(previous, {
        panel: currentPanel.scrollTop,
        options: currentPanel.querySelector('.v2-options-main')?.scrollTop || 0,
        list: currentPanel.querySelector('.v2-level-list, .v2-library-list')?.scrollTop || 0,
        libraryLayout: currentPanel.querySelector('.v2-library-layout')?.scrollTop || 0
      });
      if (previous === 'play' && next !== 'play') {
        playScrollY = globalThis.scrollY;
        GoblinUIV2.closeTarget();
        globalThis.GoblinMovement?.clear();
      }
      if (next === 'briefing' && previous !== 'briefing') briefingDifficulty = 'medium';
      screen = next;
      renderTraining();
      const overlay = next !== 'play';
      document.body.classList.toggle('v2-screen-open', overlay);
      surface.hidden = !overlay;
      renderScreen(focus);
      if (!overlay) GoblinUIV2.refresh();
      if (overlay) globalThis.scrollTo(0, 0);
      else {
        const map = document.querySelector('#v2-map');
        map.focus({ preventScroll: true });
        requestAnimationFrame(() => {
          if (screen !== 'play') return;
          if (previous === 'briefing') globalThis.scrollTo(0, 0);
          else globalThis.scrollTo(0, playScrollY);
        });
      }
    }
    function openSection(next) { if (next === 'catalog') libraryLiveId = null; returnScreen = screen; show(next); }
    function goBack() { show(returnScreen === 'play' && GoblinUIV2.project().gameOver ? 'end' : returnScreen); }
    async function openRoundAnalysis(round) {
      const host = globalThis.IronDustBrowserV2;
      const origin = screen, epoch = host?.epoch, owner = legacySession;
      const {renderRoundAnalysis} = await import('./round-analysis-ui.mjs?v=2');
      if (screen !== origin || host?.epoch !== epoch || legacySession !== owner) return;
      const resume = origin === 'log' && returnScreen === 'play' && !GoblinUIV2.project().gameOver && holdPlay();
      roundAnalysis = {round, origin, renderRoundAnalysis, selected:0, resume, epoch};
      show('round-analysis');
    }
    function closeRoundAnalysis() {
      const {origin,resume,epoch} = roundAnalysis;
      roundAnalysis = null;
      show(origin);
      if (resume && globalThis.IronDustBrowserV2?.epoch === epoch) releasePause();
    }
    function selectLevel(id) {
      missionId = id;
      startError = '';
      renderScreen(false);
    }
    function stepLevelSelection(event) {
      const direction = {ArrowUp: -1, ArrowDown: 1}[event.key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || GameDialogs.isOpen()) return;
      const list = event.currentTarget;
      const focused = event.target.closest('.v2-level-choice');
      if (!focused || !list.contains(focused)) return;
      const rows = [...list.querySelectorAll('.v2-level-choice:not(:disabled)')];
      const active = rows.findIndex(row => row.id === `v2-level-${missionId}`);
      const next = rows[(active < 0 ? rows.indexOf(focused) : active) + direction];
      event.preventDefault();
      if (!next) return;
      selectLevel(next.id.slice('v2-level-'.length));
      const row = document.getElementById(next.id);
      row?.scrollIntoView({block:'nearest', inline:'nearest'});
      row?.focus({preventScroll:true});
    }
    function returnToSelectedLevel() {
      show('levels', false);
      const row = document.getElementById(`v2-level-${missionId}`);
      const panel = surface.querySelector('.v2-screen-panel');
      const list = panel?.querySelector('.v2-level-list');
      const footer = panel?.querySelector('.v2-screen-footer');
      const rowBounds = row?.getBoundingClientRect();
      const listBounds = list?.getBoundingClientRect();
      const panelBounds = panel?.getBoundingClientRect();
      const footerBounds = footer?.getBoundingClientRect();
      const rowVisible = rowBounds && listBounds && panelBounds && footerBounds &&
        rowBounds.top >= Math.max(listBounds.top, panelBounds.top) &&
        rowBounds.bottom <= Math.min(listBounds.bottom, footerBounds.top);
      (rowVisible ? row : document.getElementById('v2-levels-select') || row)
        ?.focus({ preventScroll: true });
    }
    function campaignAvailable() {
      return campaignLessons.every(id => !!missionData(id));
    }
    function campaignPosition() {
      return t(`v2.${campaign.field ?? 'campaign'}.position`,
        {current:campaign.index + 1, total:(campaign.field ? fieldCampaigns[campaign.field].ids : campaignLessons).length});
    }
    function fieldStorageKey(field) {
      return `tdc.game.goblin.${field.file}.v1`;
    }
    function fieldUnlocked(field) {
      try {
        const saved = localStorage.getItem(fieldStorageKey(field));
        const count = Number(saved);
        if (String(count) === saved && Number.isInteger(count) && count >= 1 && count <= field.ids.length)
          return Math.max(field.unlocked, count);
      } catch {}
      return field.unlocked;
    }
    async function openFieldCampaign(key) {
      if (screen !== 'menu' || fieldLoading || !GoblinEditorDraft.available()) return;
      const field = fieldCampaigns[key];
      fieldLoading = true;
      fieldError = '';
      renderScreen(false);
      try {
        if (!field.configs) {
          const response = await fetch(`assets/unit-art/levels/${field.file}.v3.json?v=${key === 'scorched' ? 2 : 1}`);
          if (!response.ok) throw Error('campaign levels');
          const levels = await response.json();
          if (!Array.isArray(levels) || levels.length !== field.ids.length) throw Error('campaign levels');
          field.configs = await Promise.all(levels.map(level => GoblinEditorDraft.prepare(GoblinEditorDraft.parse(JSON.stringify(level)))));
        }
        if (screen === 'menu') {
          fieldKey = key;
          show('relay-campaign');
        }
      } catch {
        fieldError = t('screen.briefing.dataUnavailable');
      } finally {
        fieldLoading = false;
        if (screen === 'menu') renderScreen(false);
      }
    }
    function chooseFieldMission(index) {
      const field = fieldCampaigns[fieldKey];
      if (screen !== 'relay-campaign' || !field.configs?.[index] || index >= fieldUnlocked(field)) return;
      campaign = {field:fieldKey,index,sessionId:null,previousMission:missionId};
      missionId = field.ids[index];
      startError = '';
      show('briefing');
    }
    function recordFieldVictory(state) {
      if (!campaign?.field || campaign.sessionId !== legacySession.sessionId ||
          !state.gameOver || state.objective.outcome !== true) return;
      const field = fieldCampaigns[campaign.field];
      const next = campaign.index + 2;
      if (next > field.ids.length || next <= fieldUnlocked(field)) return;
      field.unlocked = next;
      try { localStorage.setItem(fieldStorageKey(field), String(next)); }
      catch { fieldError = t(`v2.${campaign.field}.storageError`); }
    }
    function advanceFieldCampaign() {
      if (!campaign?.field || screen !== 'end' || campaign.sessionId !== legacySession.sessionId) return;
      const state = GoblinUIV2.project();
      if (!state.gameOver || state.objective.outcome !== true) return;
      const field = fieldCampaigns[campaign.field];
      if (campaign.index === field.ids.length - 1) { show('campaign-complete'); return; }
      campaign.index++;
      campaign.sessionId = null;
      missionId = field.ids[campaign.index];
      startError = '';
      show('briefing');
    }
    function openCampaign() {
      if (screen !== 'menu' || !campaignAvailable()) return;
      campaign = {index:0, sessionId:null, previousMission:missionId};
      missionId = campaignLessons[0];
      startError = '';
      show('briefing');
    }
    function bindCampaignLesson() {
      if (campaign) campaign.sessionId = campaign.field ? legacySession.sessionId :
        globalThis.GoblinTrainingRuntime?.view()?.progress.binding.sessionId ?? null;
    }
    function advanceCampaign() {
      const progress = globalThis.GoblinTrainingRuntime?.view()?.progress;
      if (!campaign || screen !== 'end' || currentScenario !== campaignLessons[campaign.index] ||
          progress?.status !== 'lesson-complete' || progress.binding.sessionId !== campaign.sessionId) return;
      if (campaign.index + 1 === campaignLessons.length) {
        show('campaign-complete');
        return;
      }
      campaign.index++;
      campaign.sessionId = null;
      missionId = campaignLessons[campaign.index];
      startError = '';
      show('briefing');
    }
    function clearCampaign() {
      if (campaign) missionId = campaign.previousMission;
      campaign = null;
      startError = '';
    }
    function returnToCampaignMenu() {
      const fieldBriefing = campaign?.field && screen === 'briefing';
      clearCampaign();
      started = false;
      show(fieldBriefing ? 'relay-campaign' : 'menu');
    }
    async function confirmRestart() {
      if (GameDialogs.isOpen()) return;
      const accepted = await GameDialogs.confirm({
        id: 'v2-flow-restart', title: t('dialog.restart.title'),
        message: t('dialog.restart.body'), acceptLabel: t('dialog.restart.confirm'), cancelLabel: t('dialog.restart.cancel')
      });
      if (!accepted) { renderScreen(false); return; }
      const setup = globalThis.GoblinFullSeatOwner && fullSeatBinding?.session === legacySession ? fullSeatBinding : null;
      if (campaign?.field) loadEditorDraft(fieldCampaigns[campaign.field].configs[campaign.index]);
      else if (editorConfig || savedConfig) loadEditorDraft(editorConfig || savedConfig);
      else if (globalThis.IronDustBrowserV2?.mode === 'ready') IronDustBrowserV2.restart();
      else loadScenario(currentScenario);
      bindCampaignLesson();
      GoblinUIV2.resetView();
      if (globalThis.GoblinFullSeatOwner) bindFullSeats(setup);
      if (screen !== 'full-handoff') show('play');
      releasePause();
      if (screen === 'play') GoblinUIV2.startView();
    }
    async function goToLevels() { return leaveMission('levels'); }
    // Leaves a running mission (after confirmation) for the mission list or the main menu.
    async function leaveMission(next) {
      if (GameDialogs.isOpen()) return;
      const training=globalThis.GoblinTrainingRuntime?.view()?.definition.mode==='learning';
      if (screen === 'pause' || screen === 'end' || screen === 'play') {
        const menu = next === 'menu';
        const accepted = await GameDialogs.confirm({
          id: 'v2-flow-leave', title: t(menu ? 'v2.dialog.mainMenu.title' : 'dialog.changeMission.title'),
          message: t(editorConfig ? 'v2.editor.returnConfirm' : campaign && !campaign.field ? 'v2.campaign.exitConfirm' : training?'training.exitConfirm':menu ? 'v2.dialog.mainMenu.body' : 'ui.dialog.leaveMission.body'),
          acceptLabel: t(editorConfig ? 'v2.editor.return' : menu ? 'v2.dialog.mainMenu.confirm' : 'dialog.changeMission.confirm'), cancelLabel: t('dialog.changeMission.cancel')
        });
        if (!accepted) { renderScreen(false); return; }
        if (editorConfig) {
          editorConfig = null;
          loadScenario(editorReturnScenario);
          GoblinUIV2.resetView();
          started = false;
          releasePause();
          show('editor');
          return;
        }
        if (campaign) clearCampaign();
        if(training)GoblinTrainingRuntime.ack('exit');
        if (globalThis.IronDustBrowserV2?.mode === 'ready') {
          IronDustBrowserV2.stop();
          loadScenario('iron-dust');
        } else loadScenario(savedConfig || currentScenario === 'editor-draft' ? (scenarioCatalog[missionId] ? missionId : 'iron-dust') : currentScenario);
        savedConfig = null;
        savedTitle = '';
        GoblinUIV2.resetView();
        started = false;
        releasePause();
      }
      show(next);
    }
    async function startMission() {
      if (GameDialogs.isOpen()) return;
      if (!missionData(missionId)) {
        startError = t('screen.briefing.dataUnavailable'); renderScreen(false); return;
      }
      const selectedMission = missionId;
      const config = campaign?.field ? fieldCampaigns[campaign.field].configs[campaign.index] : scenarioCatalog[missionId];
      const selection = globalThis.GoblinFullSeatOwner && chooseFullSeats(config);
      const setup = selection && await selection;
      if (selection && (setup === false || screen !== 'briefing' || missionId !== selectedMission ||
          config !== (campaign?.field ? fieldCampaigns[campaign.field].configs[campaign.index] : scenarioCatalog[missionId]))) return;
      if (campaign?.field) loadEditorDraft(config);
      else if (missionId === 'iron-dust-v2') {
        if (!globalThis.IronDustBrowserV2?.available || !IronDustBrowserV2.startWithDifficulty(briefingDifficulty)) {
          startError = t('v2.reject.start'); renderScreen(false); return;
        }
      } else {
        if (!scenarioCatalog[missionId]) return;
        globalThis.IronDustBrowserV2?.stop();
        loadScenario(missionId);
      }
      if (!campaign?.field) document.querySelector('#scenario-select').value = missionId;
      bindCampaignLesson();
      started = true;
      startError = '';
      GoblinUIV2.resetView();
      if (globalThis.GoblinFullSeatOwner) bindFullSeats(setup);
      if (screen !== 'full-handoff') show('play');
      releasePause();
      if (screen === 'play') GoblinUIV2.startView();
    }
    function openEditor() {
      if (!globalThis.GoblinEditorDraft?.available()) return;
      editorDraft ??= GoblinEditorDraft.copyTemplate();
      editorError = '';
      show('editor');
    }
    function editSavedLevel(entry) {
      try { editorDraft = GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(GoblinEditorDraft.parse(entry.level))); }
      catch { savedError = t('v2.saved.readError'); renderScreen(false); return; }
      editorSaved = entry;
      editorImportLevels = null;
      editorName = entry.name;
      editorSavedMessage = '';
      editorCell = {x:0,y:0};
      openEditor();
    }
    async function saveEditorLevel(overwrite) {
      if (editorBusy || screen !== 'editor' || GameDialogs.isOpen()) return;
      const previous = overwrite ? editorSaved : null;
      if (previous && !await GameDialogs.confirm({id:'saved-level-overwrite',
        title:t('v2.saved.overwrite'),message:t('v2.saved.overwriteBody'),
        acceptLabel:t('v2.saved.overwrite'),cancelLabel:t('ui.dialog.cancel')})) return;
      if (screen !== 'editor') return;
      try {
        editorSaved = GoblinSavedLevels.save(editorName, editorDraft, previous);
        editorSavedMessage = t('v2.saved.success');
        editorError = '';
      } catch (error) {
        editorSavedMessage = t(error.message === 'name' ? 'v2.saved.nameError' :
          error.message === 'conflict' ? 'v2.saved.conflict' : 'v2.saved.writeError');
        editorError = '';
      }
      renderScreen(false);
    }
    async function startSavedLevel(entry) {
      if (savedStarting || GameDialogs.isOpen()) return;
      savedStarting = true;
      savedError = '';
      const panel = surface.querySelector('.v2-screen-panel');
      try {
        const latest = GoblinSavedLevels.read().find(level => level.id === entry.id);
        if (!latest || latest.level !== entry.level || latest.name !== entry.name) throw Error('conflict');
        const config = await GoblinEditorDraft.prepare(GoblinEditorDraft.parse(latest.level));
        if (screen !== 'levels' || !savedTab || surface.querySelector('.v2-screen-panel') !== panel) return;
        if (config.briefing && !await acknowledgeLevelBriefing(config)) return;
        if (screen !== 'levels' || !savedTab || surface.querySelector('.v2-screen-panel') !== panel) return;
        const selection = globalThis.GoblinFullSeatOwner && chooseFullSeats(config);
        const setup = selection && await selection;
        if (selection && (setup === false || screen !== 'levels' || !savedTab ||
            surface.querySelector('.v2-screen-panel') !== panel ||
            !GoblinSavedLevels.read().some(level => level.id === latest.id && level.level === latest.level && level.name === latest.name))) return;
        globalThis.IronDustBrowserV2?.stop();
        loadEditorDraft(config);
        savedConfig = config;
        savedTitle = latest.name;
        started = true;
        GoblinUIV2.resetView();
        if (globalThis.GoblinFullSeatOwner) bindFullSeats(setup);
        if (screen !== 'full-handoff') show('play');
        releasePause();
        if (screen === 'play') GoblinUIV2.startView();
      } catch {
        if (surface.querySelector('.v2-screen-panel') === panel) savedError = t('v2.saved.readError');
      } finally {
        savedStarting = false;
        if (screen === 'levels' && savedTab) renderScreen(false);
      }
    }
    async function reloadGameCache() {
      if (GameDialogs.isOpen()) return;
      if (await GameDialogs.confirm({id:'v2-reload-cache',title:t('v2.cache.reload'),
        message:t('v2.cache.confirm'),acceptLabel:t('v2.cache.reload'),cancelLabel:t('ui.dialog.cancel')}))
        location.reload();
    }
    function renderSavedLevels(panel) {
      const list = document.createElement('section');
      list.className = 'v2-screen-main v2-saved-levels';
      try {
        const entries = GoblinSavedLevels.read();
        if (!entries.length) list.append(paragraph(t('v2.saved.empty')));
        for (const entry of entries) {
          const row = document.createElement('article');
          const title = document.createElement('strong');
          title.textContent = entry.name;
          const play = button(t('v2.saved.play'), () => startSavedLevel(entry));
          const edit = button(t('v2.saved.edit'), () => editSavedLevel(entry));
          let valid = false;
          if (GoblinEditorDraft.available()) {
            try { GoblinEditorDraft.parse(entry.level); valid = true; }
            catch { row.append(paragraph(t('v2.saved.readError'))); }
          }
          play.disabled = edit.disabled = savedStarting || !valid;
          row.append(title, actions(play, edit));
          list.append(row);
        }
      } catch { list.append(paragraph(t('v2.saved.readError'))); }
      if (savedError) list.append(paragraph(savedError));
      const footer = document.createElement('footer');
      footer.className = 'v2-screen-footer';
      footer.append(actions(button(t('ui.nav.back'), () => show('menu'))));
      panel.append(list, footer);
    }
    function difficultyControl() {
      const label = document.createElement('label');
      label.textContent = t('v2.difficulty.label') + ' ';
      const select = document.createElement('select');
      select.id = 'v2-briefing-difficulty';
      for (const difficulty of IronDustBrowserV2.difficulties) {
        const option = document.createElement('option');
        option.value = difficulty;
        option.textContent = t('v2.difficulty.' + difficulty);
        select.append(option);
      }
      if (!IronDustBrowserV2.difficulties.includes(briefingDifficulty)) briefingDifficulty = IronDustBrowserV2.difficulties[0];
      select.value = briefingDifficulty;
      select.onchange = () => { briefingDifficulty = select.value; };
      label.append(select);
      return label;
    }
    function updateEditor(draft, cell = editorCell) {
      try {
        GoblinEditorDraft.exportJson(draft);
        editorDraft = draft;
        editorSavedMessage = '';
        editorCell = cell;
        editorError = '';
        editorMoving = false;
      } catch (error) { editorError = error.message; }
      renderScreen(false);
    }
    function selectEditorCell(cell) {
      if (editorMoving) {
        const units = editorDraft.units.map(unit => unit.x === editorCell.x && unit.y === editorCell.y ? {...unit,...cell} : unit);
        updateEditor({...editorDraft,units},cell);
        return;
      }
      editorCell = cell;
      editorError = '';
      renderScreen(false);
    }
    function setEditorMoving(moving) {
      editorMoving = moving;
      editorError = '';
      renderScreen(false);
    }
    async function loadEditorPilot() {
      if (editorBusy || screen !== 'editor') return;
      editorBusy = true;
      renderScreen(false);
      try {
        const response = await fetch('assets/training/level-events-pilot.v3.json');
        if (!response.ok) throw Error('unavailable');
        const draft = GoblinEditorDraft.parse(await response.text());
        if (screen === 'editor') {
          editorSaved = null; editorSavedMessage = ''; editorImportLevels = null;
          updateEditor(draft,{x:1,y:3});
        }
      } catch (error) {
        editorError = error.message;
      } finally {
        editorBusy = false;
        if (screen === 'editor') renderScreen(false);
      }
    }
    async function playEditorDraft() {
      if (editorBusy || screen !== 'editor') return;
      const draft = editorDraft;
      editorBusy = true;
      renderScreen(false);
      try {
        const config = await GoblinEditorDraft.prepare(draft);
        if (screen !== 'editor' || editorDraft !== draft) return;
        if (config.briefing && !await acknowledgeLevelBriefing(config)) return;
        if (screen !== 'editor' || editorDraft !== draft) return;
        const selection = globalThis.GoblinFullSeatOwner && chooseFullSeats(config);
        const setup = selection && await selection;
        if (selection && (setup === false || screen !== 'editor' || editorDraft !== draft)) return;
        editorReturnScenario = currentScenario;
        loadEditorDraft(config);
        editorConfig = config;
        started = true;
        editorError = '';
        GoblinUIV2.resetView();
        if (globalThis.GoblinFullSeatOwner) bindFullSeats(setup);
        if (screen !== 'full-handoff') show('play');
        if (screen === 'play') GoblinUIV2.startView();
      } catch (error) {
        editorError = error.message;
      } finally {
        editorBusy = false;
        if (screen === 'editor') renderScreen(false);
      }
    }
    function acknowledgeLevelBriefing(config) {
      const copy = config.briefing;
      return GameDialogs.confirm({id:'editor-level-briefing',title:t('v2.editor.briefing'),
        message:typeof copy === 'string' ? copy : copy[GoblinLanguage.current] ?? copy.en,
        acceptLabel:t('screen.briefing.startMission'),cancelLabel:t('ui.dialog.cancel')});
    }
    function renderEditor(panel) {
      panel.append(heading(t('v2.editor.title')), paragraph(t('mission.editor-draft.objective.short')),
        paragraph(t('v2.editor.coreMark')));
      const label = document.createElement('label');
      const name = document.createElement('input');
      name.id = 'v2-saved-level-name'; name.maxLength = 80; name.value = editorName;
      name.oninput = () => { editorName = name.value; };
      label.append(document.createTextNode(t('v2.saved.name')), name);
      const save = button(t('v2.saved.saveNew'), () => saveEditorLevel(false));
      const overwrite = button(t('v2.saved.overwrite'), () => saveEditorLevel(true));
      save.disabled = editorBusy; overwrite.disabled = editorBusy;
      panel.append(label, actions(save, ...(editorSaved ? [overwrite] : [])));
      if (editorImportLevels) {
        const choices = document.createElement('select');
        choices.disabled = editorBusy;
        for (const level of editorImportLevels) {
          const option = document.createElement('option'); option.textContent = level.id;
          choices.append(option);
        }
        const choose = button(t('v2.editor.openPackageLevel'), () => {
          const draft = editorImportLevels[choices.selectedIndex];
          if (!draft) return;
          editorImportLevels = null;
          editorSaved = null;
          updateEditor(draft,{x:0,y:0});
        });
        choose.disabled = editorBusy;
        choices.setAttribute('aria-label',t('v2.editor.openPackageLevel'));
        panel.append(choices,choose);
      }
      if (editorSavedMessage) {
        const status = paragraph(editorSavedMessage);
        status.setAttribute('role','status');
        panel.append(status);
      }
      GoblinEditorUI.render(panel, {
        draft:editorDraft, cell:editorCell, busy:editorBusy, error:editorError, moving:editorMoving,
        missionOpen:editorMissionOpen, setMissionOpen:open => { editorMissionOpen = open; },
        select:selectEditorCell, setMoving:setEditorMoving,
        update:updateEditor, pilot:loadEditorPilot, play:playEditorDraft, back:() => show('menu'),
        import(text) {
          try {
            const levels = GoblinEditorDraft.importLevels(text);
            if (levels.length > 1) {
              editorImportLevels = levels;
              editorError = '';
              renderScreen(false);
              return;
            }
            const draft = GoblinEditorDraft.parse(GoblinEditorDraft.exportJson(levels[0]));
            editorImportLevels = null;
            editorSaved = null; editorSavedMessage = '';
            updateEditor(draft);
          }
          catch (error) { editorError = error.message; renderScreen(false); }
        }
      });
    }
    function libraryAssetId(entry) { return UnitVisuals.artKey(entry); }
    function libraryName(entry) {
      return t(`library.unit.${libraryAssetId(entry)}.name`);
    }
    function libraryDescription(entry, fullRule) {
      const key = `library.unit.${libraryAssetId(entry)}.description`;
      const description = fullRule ? t(key) : key;
      return description === key ? GoblinLanguage.translate(entry.copy) : description;
    }
    function libraryValue(value) {
      if (value === 'BY SYSTEM') return t('screen.library.value.bySystem');
      if (value === '1 / squad') return `1 / ${t('screen.library.value.perSquad')}`;
      return value;
    }
    function openLibraryEntry(index) {
      libraryIndex = index;
      libraryTab = 'description';
      if (matchMedia('(max-width: 900px)').matches) show('catalog-detail');
      else renderScreen(false);
    }
    function returnToLibrary() {
      show('catalog', false);
      const row = document.getElementById(libraryKind === 'terrain' ? `v2-library-terrain-${terrainIds[terrainIndex]}`
        : `v2-library-${libraryAssetId(unitGuideEntries[libraryIndex])}`);
      row?.scrollIntoView({block:'nearest'});
      const viewport = row?.closest('.v2-library-layout');
      if (viewport && matchMedia('(max-width: 900px)').matches) {
        const target = row.getBoundingClientRect(), area = viewport.getBoundingClientRect();
        if (target.bottom > area.bottom) viewport.scrollTop += target.bottom - area.bottom + 2;
        else if (target.top < area.top) viewport.scrollTop -= area.top - target.top + 2;
      }
      row?.focus({preventScroll:true});
    }
    function libraryTarget(entry, state) {
      if (!started || state.gameOver || !['play', 'pause', 'catalog', 'catalog-detail'].includes(returnScreen))
        return {reason:'screen.library.mapUnavailable.noMission'};
      const asset = libraryAssetId(entry);
      const matches = state.units.filter(unit => !unit.embarkedOn && (state.scenario === 'iron-dust-v2'
        ? unit.id === entry.coreUnitId : (unit.catalogAssetId ?? UnitVisuals.artKey(unit)) === asset));
      const match = matches.find(unit=>unit.id===libraryLiveId) ?? (matches.length === 1 ? matches[0] : null);
      if (!match && matches.length > 1) return {reason:'v2.library.ambiguous'};
      if (!match) return {reason:'screen.library.mapUnavailable.notPresent'};
      if (unitDead(match)) return {unit:match,reason:'screen.library.mapUnavailable.destroyed'};
      return {unit:match};
    }
    function libraryFullRegistry(state) {
      const model = globalThis.GoblinCatalogFullModel;
      if (started && state.profile !== 'FULL_CATALOG_v1') return null;
      return model?.editorProfile?.catalog.registry ?? null;
    }
    function librarySpecialRules(entry, state) {
      const id = libraryAssetId(entry);
      const config = started && legacySession.ruleProfileId === state.profile ? legacySession.config : null;
      const registry = started ? config?.catalog?.registry : libraryFullRegistry(state);
      const record = registry?.units[id];
      const full = !started || state.profile === 'FULL_CATALOG_v1';
      const specialist = full || state.profile === 'CATALOG_SPECIALISTS_v1';
      const refs = new Set();
      if (record?.target && (specialist || state.profile === 'CATALOG_BASE_TRANSPORT_v1')) {
        const rule = record.target;
        if (rule.gevPhaseEligible) refs.add('gev');
        else if (rule.mode === 'gev' && rule.movement[0] > 0) refs.add('raider');
        if (rule.strengthRef) refs.add('strength');
        if (rule.damageModel === 'infantry-fixed-crt-v1') refs.add('infantryFixed');
        if (rule.passengerRef || rule.cargoRef === 'carrier-cargo-v1') refs.add('passengers');
        if (['carrier-cargo-v1','drone-cargo-v1','forge-drone-bays-v1'].includes(rule.cargoRef)) refs.add('drones');
        if (specialist && rule.systemDefinitionRef) refs.add('systems');
        if (specialist && ['U01','U20'].includes(record.catalogId)) refs.add('ram');
        if (specialist && rule.engineeringRef) refs.add('engineering');
        if (specialist && rule.fireRuleRef === 'artillery-spotter-v1') refs.add('spotter');
        if (specialist && rule.fireRuleRef === 'siege-tank-fire-budget-v1') refs.add('siege');
        if (full && rule.missileRuleRef) refs.add('missile');
        if (full && rule.stealthRef) refs.add('stealth');
        return [...refs];
      }
      const unit = config?.units.find(unit => UnitVisuals.artKey(unit) === id);
      if (!unit) return null;
      if (unit.gevPhaseEligible || (unit.gev || unit.movementMode === 'gev') && config.movement?.secondary > 0) refs.add('gev');
      if (unit.id === 'ogre') refs.add('legacyRam');
      if (unit.ogreSystems || unit.id === 'ogre') refs.add('systems');
      if (unit.transportCapacity || unit.infantry || unit.engineering) refs.add('legacyPassengers');
      if (unit.artilleryFire) refs.add('spotter');
      if (unit.siegeFireBudget) refs.add('siege');
      if (unit.strategicMissile) refs.add('legacyMissile');
      return [...refs];
    }
    function libraryReferenceWeapons(entry, registry) {
      const id = libraryAssetId(entry), rule = registry?.units[id]?.target;
      const weapon = (id, spec, count = 1, icon = id) => ({id, ...spec, count, icon});
      if (!rule) {
        if (id === 'goblin-siegebreaker')
          return Object.entries(GoblinSystems.WEAPONS).map(([key, spec]) => weapon(key, spec, spec.count));
        const range = UnitGuideRange.profile(entry,null).range;
        return range > 0 ? [weapon('fire',{attack:entry.attack,range},1,'fire')] : [];
      }
      if (rule.systemDefinitionRef) {
        const system = GoblinSystems.createCatalogSystem(registry,id);
        const slots = system.rules.definition.components.filter(item => item.kind === 'weapon');
        return [...new Set(slots.map(slot => slot.weaponClassRef))].map(key =>
          weapon(key,system.rules.weaponClasses[key],slots.filter(slot=>slot.weaponClassRef===key).length));
      }
      if (rule.fireRuleRef === 'siege-tank-fire-budget-v1') {
        const specs = GoblinSiegeBudget.WEAPONS;
        return [weapon('main',specs['main-1'],2), weapon('combined',specs['main-both'],null,'main'),
          weapon('antipersonnel',specs['ap-1'],2)];
      }
      if (!rule.range || rule.fireRuleRef === 'no-fire-v1') return [];
      const key = rule.missileRuleRef ? 'missiles' : rule.fireRuleRef === 'artillery-spotter-v1' ? 'indirect' : 'fire';
      return [weapon(key,{attack:rule.strengthRef?2:rule.attack,range:rule.range},1,key)];
    }
    function libraryWeaponName(weapon) {
      return t(weapon.id === 'combined' ? 'v2.library.combined' :
        weapon.id === 'indirect' ? 'v2.library.artillery' :
        weapon.id === 'fire' ? 'v2.ui.fire' : `v2.ui.weapon.${weapon.id}`);
    }
    function libraryDetail(entry, state, mobile) {
      const registry = libraryFullRegistry(state), id = libraryAssetId(entry);
      const rule = registry?.units[id]?.target;
      const system = rule?.systemDefinitionRef ? GoblinSystems.createCatalogSystem(registry,id) : null;
      const target = libraryTarget(entry,state);
      const detail = document.createElement('section'); detail.className = 'v2-library-detail v2-library-unit-detail';
      const title = mobile ? heading(libraryName(entry)) : document.createElement('h3');
      if (!mobile) title.textContent = libraryName(entry);
      const identity = document.createElement('div'); identity.className = 'v2-library-identity';
      identity.append(title, paragraph(GoblinLanguage.translate(entry.role)));
      const top = document.createElement('div'); top.className = 'v2-library-unit-top';
      const artPanel = document.createElement('div'); artPanel.className = 'v2-library-art-panel';
      const artId = libraryAssetId(entry);
      const enemyArt = `assets/unit-art/sets/02-technical-illustration/library-enemy/${artId}`;
      const art = libraryArtSide === 'enemy' ? `${enemyArt}@768.png`
        : UnitVisuals.assetFor(entry, 'library', 'png') || UnitVisuals.resolve(entry).asset;
      if (art) {
        const figure = document.createElement('figure'); figure.className = 'v2-library-art';
        const picture = document.createElement('picture');
        const webp = libraryArtSide === 'enemy' ? `${enemyArt}@1024.webp`
          : UnitVisuals.assetFor(entry, 'library', 'webp');
        if (webp) {
          const source = document.createElement('source'); source.srcset = webp; source.type = 'image/webp';
          picture.append(source);
        }
        const image = document.createElement('img'); image.src = art; image.alt = libraryName(entry);
        image.onerror = () => picture.replaceWith(UnitVisuals.iconElement(entry, 'v2-library-fallback'));
        const caption = document.createElement('figcaption');
        caption.textContent = `${libraryName(entry)} · ${t(`v2.ui.preview.${libraryArtSide}`)}`;
        picture.append(image); figure.append(picture, caption); artPanel.append(figure);
      }

      const find = button(t('screen.library.showOnMap'), () => findUnit(target.unit.id));
      find.id = 'v2-library-find'; find.disabled = !!target.reason;
      const mapRow = document.createElement('div'); mapRow.className = 'v2-library-map-action';
      mapRow.append(find);
      if (target.reason) mapRow.append(paragraph(t(target.reason), 'v2-library-unavailable'));
      const artSwitch = document.createElement('div'); artSwitch.className = 'v2-library-art-switch';
      for (const side of ['own', 'enemy']) {
        const choice = button(t(`v2.ui.preview.${side}`), () => {
          if (libraryArtSide === side) return;
          libraryArtSide = side;
          renderScreen(false);
          document.getElementById(`v2-library-art-${side}`)?.focus({preventScroll:true});
        });
        choice.id = `v2-library-art-${side}`;
        choice.setAttribute('aria-pressed', String(libraryArtSide === side));
        artSwitch.append(choice);
      }

      artPanel.append(artSwitch);
      const weapons = libraryReferenceWeapons(entry,registry);
      const selectionKey = `${state.profile}:${registry?.dataVersion ?? 'legacy'}:${id}`;
      if (libraryWeapon?.key !== selectionKey || !weapons.some(weapon=>weapon.id===libraryWeapon.id))
        libraryWeapon = {key:selectionKey,id:weapons[0]?.id};
      const weapon = weapons.find(item=>item.id===libraryWeapon.id);
      const profile = rule ? {movement:rule.movement[0],bonus:rule.gevPhaseEligible ? rule.movement[1] : 0} : UnitGuideRange.profile(entry,null);
      const diagram = document.createElement('div'); diagram.className = 'v2-library-diagram';
      const modes = document.createElement('div'); modes.className = 'v2-library-tabs';
      for (const [mode,key] of [['move','v2.ui.move'],['attack','v2.ui.fire']]) {
        const choice = button(t(key),()=>{libraryMapMode=mode;renderScreen(false)});
        choice.id = `v2-library-map-${mode}`;
        choice.setAttribute('aria-pressed',String(libraryMapMode===mode));
        modes.append(choice);
      }
      const preview = document.createElement('div'); preview.className = 'v2-library-diagram-map';
      const figure = document.createElement('figure'); figure.className = 'v2-library-range';
      figure.innerHTML = UnitGuideRange.mapSvg({...profile,range:weapon?.range??0},libraryMapMode);
      const caption = document.createElement('p'); caption.className = 'v2-library-range-caption';
      caption.textContent = libraryMapMode === 'move' ? (profile.movement ?
        [t('v2.ui.movePoints',{cost:profile.movement}),profile.bonus ? `+ ${t('v2.ui.movePoints',{cost:profile.bonus})} ${t('screen.library.value.skimmerManeuver')}` : ''].filter(Boolean).join(' · ') :
        t('v2.library.noMovement')) : weapon ? `${libraryWeaponName(weapon)} · ${t('v2.ui.range')} ${weapon.range}` : t('v2.library.noWeapon');
      figure.title = t('v2.library.schematic');
      preview.append(figure, modes);
      if (libraryMapMode === 'attack' && weapons.length) {
        const rail = document.createElement('div'); rail.className = 'v2-library-weapon-rail';
        for (const option of weapons) {
          const name = libraryWeaponName(option);
          const choice = button('',()=>{libraryWeapon={key:selectionKey,id:option.id};renderScreen(false)});
          choice.innerHTML = GoblinUIV2.svgIcon(option.icon);
          choice.id = `v2-library-weapon-${option.id}`; choice.title = name;
          choice.setAttribute('aria-label',name);
          choice.setAttribute('aria-pressed',String(option===weapon));
          rail.append(choice);
        }
        preview.append(rail);
      }
      diagram.append(preview,caption);
      if (rule?.missileRuleRef && weapon) {
        const strike = StrategicMissile.STRIKE;
        caption.title = t('v2.ui.missileImpact',{direct:strike.directAttack,adjacent:strike.splashAttack});
        if (libraryMapMode === 'attack') caption.textContent += ' · ' + caption.title;
      }
      top.append(artPanel,diagram);
      const tabs = document.createElement('div'); tabs.className = 'v2-library-tabs';
      for (const tab of ['description','stats','specials','strategy']) {
        const item = button(t(`v2.library.detail.${tab}`),()=>{libraryTab=tab;renderScreen(false)});
        item.id = `v2-library-tab-${tab}`;
        item.setAttribute('aria-pressed',String(libraryTab===tab));
        tabs.append(item);
      }
      const body = document.createElement('div'); body.className = 'v2-library-detail-body';
      if (libraryTab === 'description') {
        body.append(paragraph(libraryDescription(entry, rule)),paragraph(t('v2.library.schematic')));
      } else if (libraryTab === 'stats') {
        const values = document.createElement('dl'); values.className = 'v2-library-values';
        const fields = [
          ['v2.ui.attack',weapon?.attack],['v2.ui.range',weapon?.range],
          ['v2.ui.defense',system ? 'BY SYSTEM' : rule?.defense ?? entry.defense],
          ['v2.ui.move',t('v2.ui.movePoints',{cost:profile.movement})],
          [system?'v2.ui.treads':rule?.strengthRef?'v2.ui.strength':'v2.ui.armorHp',
            system ? `${system.treads}/${system.maxTreads}` : rule?.strengthRef ? 2 : rule?.hp ?? entry.hp]
        ];
        for (const [key,value] of fields) {
          const field = document.createElement('div'), label = document.createElement('dt'), number = document.createElement('dd');
          label.textContent = t(key); number.textContent = libraryValue(value ?? '—');
          field.append(label,number); values.append(field);
        }
        body.append(paragraph(t('v2.library.referenceValues')),values);
        if (profile.bonus > 0) body.append(paragraph(t('screen.library.value.skimmerManeuver')));
        if (weapon?.count > 1) body.append(paragraph(t('v2.library.slotCount',{count:weapon.count})));
        if (system) body.append(paragraph(t('v2.library.systemBands',{points:rule.movement.join(' / ')})));
        if (target.unit && !target.reason) body.append(paragraph(t('v2.library.livePosition',{hex:`${String.fromCharCode(65+target.unit.x)}-${String(target.unit.y+1).padStart(2,'0')}`})));
      } else {
        const strategy = libraryTab === 'strategy';
        if (strategy) body.append(paragraph(rule ? t(`library.unit.${id}.tactics`) : t('v2.library.noStrategy')));
        const refs = strategy ? (rule ? (libraryFullUnitRules[id] ?? []).filter(ref=>['movement','fire'].includes(ref)) : []) :
          librarySpecialRules(entry, state);
        if (!strategy) {
          body.append(paragraph(t(started ? 'v2.library.referenceValues' : 'v2.library.fullReference')));
          if (refs === null) body.append(paragraph(t('v2.library.profileUnavailable')));
          else for (const ref of refs) body.append(paragraph(t(`library.rules.${ref}.body`)));
        }
        const links = libraryFullRegistry(state) ? (refs ?? []).filter(ref => libraryFullRules.includes(ref)).map(ref => button(t(`library.rules.${ref}.title`), () => {
          libraryRule = ref; libraryKind = 'rules'; show('catalog', false);
          const rule = document.getElementById(`v2-library-rule-${ref}`);
          rule?.scrollIntoView({block:'nearest'});
          rule?.querySelector('summary')?.focus({preventScroll:true});
        })) : [];
        if (links.length) body.append(actions(...links));
        if (!strategy && refs?.length === 0) body.append(paragraph(t('v2.library.noSpecials')));
      }
      detail.append(identity,top,tabs,body,mapRow);
      return detail;
    }
    // Terrain entries of the library (UR-D): the former terrain card of the game screen, with its rules.
    const terrainIds = Object.keys(TerrainDisplay.types);
    function terrainDetail(id, mobile) {
      const rules = TerrainRules.get(id), name = TerrainDisplay.label(id);
      const detail = document.createElement('section'); detail.className = 'v2-library-detail v2-library-terrain';
      const title = mobile ? heading(name) : document.createElement('h3');
      if (!mobile) title.textContent = name;
      const header = document.createElement('div'); header.className = 'v2-library-detail-head';
      const tile = TerrainDisplay.icon(id, 'v2-library-terrain-tile');
      if (tile) header.append(tile);
      const identity = document.createElement('div'); identity.className = 'v2-library-identity';
      identity.append(title, paragraph(t('v2.library.terrain.category'), 'v2-library-category'));
      header.append(identity);
      const values = document.createElement('dl'); values.className = 'v2-library-values';
      const cost = value => Number.isFinite(value) ? String(value) : t('v2.library.terrain.impassable');
      for (const [key, value] of [['ground', cost(rules.cost)], ['hover', cost(rules.hoverCost ?? rules.cost)],
        ['cover', rules.cover ? `+${rules.cover}` : '±0'], ['sight', t(rules.blocksLos ? 'v2.intel.blocks' : 'v2.intel.clear')]]) {
        const field = document.createElement('div');
        const label = document.createElement('dt'); label.textContent = t(`v2.library.terrain.${key}`);
        const number = document.createElement('dd'); number.textContent = value;
        field.append(label, number); values.append(field);
      }
      detail.append(header, values);
      if (rules.amphibiousCost !== undefined) detail.append(paragraph(t('v2.library.terrain.amphibious')));
      return detail;
    }
    function libraryKindSwitch() {
      const kinds = document.createElement('div'); kinds.className = 'v2-library-kinds'; kinds.setAttribute('role', 'group');
      kinds.setAttribute('aria-label', t('v2.library.title'));
      for (const kind of ['rules', 'units', 'terrain', 'tips']) {
        const choice = button(t(`v2.library.kind.${kind}`), () => { libraryKind = kind; renderScreen(false); });
        choice.id = `v2-library-kind-${kind}`;
        choice.setAttribute('aria-pressed', String(libraryKind === kind));
        kinds.append(choice);
      }
      return kinds;
    }
    function libraryReference(kind) {
      const section = document.createElement('section');
      section.className = 'v2-library-detail v2-library-reference v2-screen-main';
      const title = document.createElement('h3');
      title.textContent = t(`v2.library.${kind}.status`);
      section.append(title, paragraph(t(`v2.library.${kind}.intro`)));
      if (kind === 'rules') {
        if (libraryFullRegistry(GoblinUIV2.project())) {
          for (const id of libraryFullRules) {
            const rule = document.createElement('details');
            rule.id = `v2-library-rule-${id}`;
            rule.open = libraryRule === id;
            const summary = document.createElement('summary');
            summary.textContent = t(`library.rules.${id}.title`);
            rule.append(summary,paragraph(t(`library.rules.${id}.body`)));
            section.append(rule);
          }
          return section;
        }
        for (const [topic, items] of [
          ['general', ['turns', 'combat']],
          ['profiles', ['profiles', 'specials']],
          ['examples', ['training', 'core', 'siege', 'atlas']]
        ]) {
          const label = document.createElement('h4');
          label.textContent = t(`v2.library.rules.heading.${topic}`);
          const list = document.createElement('ul');
          for (const item of items) {
            const row = document.createElement('li');
            row.textContent = t(`v2.library.rules.item.${item}`);
            list.append(row);
          }
          section.append(label, list);
        }
      }
      return section;
    }
    // Opens the library from the field intel at the given unit or terrain type.
    function openLibrary(kind, key) {
      if (GameDialogs.isOpen()) return;
      returnScreen = screen;
      libraryKind = kind === 'terrain' ? 'terrain' : 'units';
      if (libraryKind === 'terrain') terrainIndex = Math.max(0, terrainIds.indexOf(key));
      else {
        const state = GoblinUIV2.project();
        libraryLiveId = key;
        const index = unitGuideEntries.findIndex(entry => libraryTarget(entry, {...state, gameOver: false}).unit?.id === key);
        if (index >= 0) { libraryIndex = index; libraryTab = 'description'; }
      }
      show(matchMedia('(max-width: 900px)').matches ? 'catalog-detail' : 'catalog');
    }
    function findUnit(id) {
      const unit = GoblinUIV2.project().units.find(item => item.id === id && unitAlive(item));
      if (!unit || !started) return;
      show('play');
      releasePause();
      GoblinUIV2.focusUnit(unit.id);
    }
    globalThis.GoblinV2Flow = Object.freeze({ findUnit, openLibrary, hasStarted: () => started });
    function renderScreen(focus = true) {
      optionsScrollObserver?.disconnect();
      optionsScrollObserver = null;
      if (screen === 'play') return;
      const lastFocus = focus ? null : document.activeElement?.id;
      const lastIndex = focus ? -1 : [...surface.querySelectorAll('button:not(.v2-list-step), select, input')].indexOf(document.activeElement);
      const currentPanel = surface.querySelector('.v2-screen-panel');
      if (!focus && currentPanel?.dataset.screen === screen) scrollMemory.set(screen, {
        panel: currentPanel.scrollTop,
        options: currentPanel.querySelector('.v2-options-main')?.scrollTop || 0,
        list: currentPanel.querySelector('.v2-level-list, .v2-library-list')?.scrollTop || 0,
        libraryLayout: currentPanel.querySelector('.v2-library-layout')?.scrollTop || 0
      });
      const panel = document.createElement('div'); panel.className = 'v2-screen-panel';
      panel.dataset.screen = screen;
      if (['menu', 'levels', 'options', 'briefing', 'catalog', 'catalog-detail', 'campaign-complete', 'relay-campaign', 'editor'].includes(screen))
        panel.classList.add('v2-foundation');
      surface.replaceChildren(panel);
      surface.setAttribute('aria-labelledby', 'v2-screen-heading');
      if (screen === 'full-handoff') {
        const accept = button(t('v2.full.takeSeat'), takeFullSeat, 'primary');
        panel.append(heading(t('v2.full.handoff')), actions(accept));
        accept.focus({preventScroll:true});
        return;
      }
      if (globalThis.GoblinCatalogFullRuntime?.ownsPresentation?.()) return;
      const state = GoblinUIV2.project();
      if (screen === 'menu') {
        const intro = document.createElement('div'); intro.className = 'v2-menu-intro';
        intro.classList.add('v2-screen-header');
        intro.append(paragraph(t('ui.start.eyebrow'), 'v2-menu-eyebrow'), heading(t('ui.start.title')),
          paragraph(t('ui.start.subtitle')));
        const menu = document.createElement('nav'); menu.className = 'v2-menu-links v2-screen-main';
        menu.setAttribute('aria-label', t('ui.start.title'));
        const choose = button(t('ui.start.choose'), () => show('levels'), 'primary'); choose.id = 'v2-menu-choose';
        const tutorial = button(t('v2.campaign.title'), openCampaign); tutorial.id = 'v2-menu-campaign';
        tutorial.disabled = !campaignAvailable();
        const editor = button(t('v2.editor.title'), openEditor); editor.id = 'v2-menu-editor';
        editor.disabled = !globalThis.GoblinEditorDraft?.available();
        const units = button(t('v2.library.title'), () => openSection('catalog')); units.id = 'v2-menu-units';
        const settings = button(t('ui.nav.settings'), () => openSection('options')); settings.id = 'v2-menu-settings';
        const legal = button(t('v2.ui.legalNotices'), () => openSection('legal')); legal.id = 'v2-menu-legal';
        const relay = button(t('v2.relay.title'), () => openFieldCampaign('relay'));
        relay.id = 'v2-menu-relay';
        relay.disabled = fieldLoading || !globalThis.GoblinEditorDraft?.available();
        const scorched = button(t('v2.scorched.title'), () => openFieldCampaign('scorched'));
        scorched.id = 'v2-menu-scorched';
        scorched.disabled = relay.disabled;
        const changelog = button(t('v2.ui.changelog'), () => openSection('changelog'));
        changelog.id = 'v2-menu-changelog';
        const campaigns = document.createElement('div');
        campaigns.className = 'v2-menu-campaigns';
        campaigns.append(relay, scorched);
        menu.append(choose, tutorial, campaigns, editor, units, settings);
        if (fieldError) menu.append(paragraph(fieldError, 'v2-status'));
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        footer.append(actions(changelog, legal), paragraph(document.querySelector('#build-version').textContent, 'v2-screen-meta'));
        panel.append(intro, menu, footer);
      } else if (screen === 'editor') {
        renderEditor(panel);
      } else if (screen === 'levels') {
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        const builtIn = button(t('v2.saved.builtIn'), () => { savedTab = false; renderScreen(false); });
        const own = button(t('v2.saved.own'), () => { savedTab = true; savedError = ''; renderScreen(false); });
        builtIn.id = 'v2-level-tab-built-in'; own.id = 'v2-level-tab-own';
        builtIn.setAttribute('aria-pressed', String(!savedTab)); own.setAttribute('aria-pressed', String(savedTab));
        header.append(heading(t('ui.levels.title')), actions(builtIn, own));
        panel.append(header);
        if (savedTab) {
          renderSavedLevels(panel);
          return finishScreen(panel, focus, lastFocus, lastIndex);
        }
        const layout = document.createElement('div'); layout.className = 'v2-level-layout v2-screen-main';
        const list = document.createElement('div'); list.className = 'v2-level-list';
        list.addEventListener('keydown', stepLevelSelection);
        const ids = [...Object.keys(ScenarioRuleProfiles.entries), 'iron-dust-v2'];
        if (!ids.includes(missionId)) missionId = ids[0];
        for (const id of ids) {
          const available = !!missionData(id);
          const choose = button('', () => selectLevel(id), 'v2-level-choice');
          const title = document.createElement('strong'); title.textContent = t(`mission.${id}.title`);
          const summary = document.createElement('span');
          summary.textContent = t(id === 'iron-dust-v2' ? 'v2.objective' : `mission.${id}.objective.short`);
          choose.append(title, summary);
          choose.id = `v2-level-${id}`;
          choose.setAttribute('aria-pressed', String(id === missionId));
          if (!available) choose.title = t('screen.briefing.dataUnavailable');
          choose.disabled = !available;
          list.append(choose);
        }
        const detail = document.createElement('section'); detail.className = 'v2-level-detail';
        detail.setAttribute('aria-label', t(`mission.${missionId}.title`));
        const detailTitle = document.createElement('h3'); detailTitle.textContent = t(`mission.${missionId}.title`);
        const data = missionData(missionId);
        detail.append(detailTitle, missionPreview(data),
          paragraph(t(missionId === 'iron-dust-v2' ? 'v2.objective' : `mission.${missionId}.objective.short`)),
          missionStats(data));
        layout.append(steppedList(list), detail);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), () => show('menu')); back.id = 'v2-levels-back';
        const select = button(t('ui.levels.select'), () => show('briefing'), 'primary');
        select.id = 'v2-levels-select';
        select.disabled = !data;
        select.setAttribute('aria-label', `${t('ui.levels.select')}: ${t(`mission.${missionId}.title`)}`);
        footer.append(actions(back, select));
        panel.append(layout, footer);
      } else if (screen === 'relay-campaign') {
        const field = fieldCampaigns[fieldKey];
        panel.append(heading(t(`v2.${fieldKey}.title`)), paragraph(t(`v2.${fieldKey}.intro`)));
        const unlocked = fieldUnlocked(field);
        const choices = document.createElement('div');
        choices.className = 'v2-screen-log';
        field.ids.forEach((id, index) => {
          const choice = button(t(`mission.${id}.title`), () => chooseFieldMission(index));
          choice.id = `v2-${fieldKey}-mission-${index + 1}`;
          choice.disabled = index >= unlocked;
          choices.append(actions(choice));
        });
        panel.append(choices);
        if (unlocked < field.ids.length) panel.append(paragraph(t(`v2.${fieldKey}.locked`)));
        panel.append(actions(button(t('ui.nav.back'), returnToCampaignMenu)));
      } else if (screen === 'briefing') {
        const data = missionData(missionId);
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        if (campaign) header.append(paragraph(campaignPosition(), 'v2-briefing-number'));
        const legacyNumber = missionId !== 'iron-dust-v2' &&
          scenarioCatalog[missionId]?.kicker?.match(/^(MISSION \d+|SHOWCASE \d+)/)?.[1];
        if (legacyNumber && !campaign) header.append(paragraph(legacyNumber, 'v2-briefing-number'));
        header.append(heading(t(`mission.${missionId}.title`)));
        if (campaign?.field === 'scorched')
          header.append(paragraph(t(`mission.${missionId}.story.briefing`), 'v2-briefing-intro'));
        header.append(paragraph(t(`mission.${missionId}.briefing.short`), 'v2-briefing-intro'));
        if (missionId === 'iron-dust-v2' && data) header.append(difficultyControl());
        if (campaign?.index === 0 && !campaign.field) header.append(paragraph(t('v2.campaign.session')));
        if(GoblinCatalogBase.has(missionId)||globalThis.GoblinCatalogSpecialistsModel?.has(missionId)||globalThis.GoblinCatalogFullModel?.has(missionId))header.append(paragraph(t(`mission.${missionId}.budget`)));
        if(missionId==='artillery-pilot')header.append(paragraph(t('mission.artillery-pilot.budget')));
        if(missionId==='siege-pilot')header.append(paragraph(t('mission.siege-pilot.budget')));
        if(missionId==='skimmer-pilot')header.append(paragraph(t('mission.skimmer-pilot.budget')));
        if(globalThis.GoblinCatalogFullModel?.has(missionId)){
          const full=scenarioCatalog[missionId].catalog.full;
          for(const wave of full.waves.waves){const unit=full.waveTemplates.find(u=>u.id===wave.templateId);header.append(paragraph(t('v2.full.wave.announcement',{team:t(`ui.team.${wave.team}`),unit:t(`library.unit.${unit.catalogAssetId}.name`),turn:wave.dueOwnTurn})));header.append(paragraph(t('v2.full.wave.entries',{entries:wave.entries.map(cell=>`${String.fromCharCode(65+cell.x)}-${String(cell.y+1).padStart(2,'0')}`).join(' → ')})));}
          if(full.waves.waves.length)header.append(paragraph(t('v2.full.wave.retryRule',{maxAttempts:3})));
          if(Number.isSafeInteger(full.turnLimit)&&full.turnLimit>0)header.append(paragraph(t('v2.full.limit.briefing',{limit:full.turnLimit})));
        }
        const conditions = document.createElement('section'); conditions.className = 'v2-briefing-conditions';
        conditions.append(document.createElement('div'), document.createElement('div'));
        conditions.children[0].className = 'v2-briefing-victory';
        conditions.children[1].className = 'v2-briefing-defeat';
        for (const [index, outcome] of ['victory', 'defeat'].entries()) {
          const label = document.createElement('h3'); label.textContent = t(`screen.briefing.${outcome}`);
          conditions.children[index].append(label,
            paragraph(t(campaign?.field === 'scorched' ? `v2.scorched.${outcome}` : `mission.${missionId}.briefing.${outcome}`)));
        }
        const preview = document.createElement('section'); preview.className = 'v2-briefing-preview';
        const previewLabel = document.createElement('h3');
        previewLabel.textContent = t('screen.briefing.startForces');
        preview.append(previewLabel, missionPreview(data), missionStats(data));
        const main = document.createElement('div'); main.className = 'v2-screen-main v2-briefing-main';
        main.append(conditions, preview);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t(campaign?.field ? 'ui.nav.back' : campaign ? 'v2.ui.mainMenu' : 'screen.briefing.backToLevels'),
          campaign ? returnToCampaignMenu : returnToSelectedLevel); back.id = 'v2-briefing-back';
        const start = button(t('screen.briefing.startMission'), startMission, 'primary'); start.id = 'v2-briefing-start';
        start.disabled = !data;
        footer.append(...(startError ? [paragraph(startError, 'v2-status')] : []), actions(back, start));
        panel.append(header, main, footer);
      } else if (screen === 'pause') {
        panel.append(heading(t('ui.nav.pause')),
          paragraph(state.mission.objective),
          actions(button(t('ui.nav.resume'), () => { show('play'); releasePause(); }, 'primary'),
            button(t('ui.nav.restart'), confirmRestart)),
          actions(button(t(editorConfig ? 'v2.editor.return' : 'ui.nav.missions'), goToLevels),
            button(t('v2.library.title'), () => openSection('catalog')),
            button(t('ui.nav.settings'), () => openSection('options')),
            ...(editorConfig ? [] : [button(t('v2.ui.mainMenu'), () => leaveMission('menu'))])));
      } else if (screen === 'campaign-complete') {
        panel.append(heading(t(`v2.${campaign?.field ?? 'campaign'}.complete`)),
          paragraph(t(`v2.${campaign?.field ?? 'campaign'}.completeBody`)),
          actions(button(t('v2.ui.mainMenu'), returnToCampaignMenu, 'primary')));
      } else if (screen === 'end') {
        const training=globalThis.GoblinTrainingRuntime?.view();
        if(training?.definition.mode==='learning'){
          const complete=training.progress.status==='lesson-complete';
          panel.append(heading(t(complete?'training.complete.title':'training.failure.title')),paragraph(t(`mission.${state.scenario}.objective.short`)),actions(button(t('training.restartLesson'),confirmRestart),button(t('training.exit'),goToLevels)));
          if (campaign) {
            panel.append(paragraph(campaignPosition()));
            if (complete) panel.append(actions(button(t(campaign.index + 1 === campaignLessons.length ?
              'v2.campaign.finish' : 'training.nextLesson'), advanceCampaign, 'primary')));
          } else if(complete&&training.next)panel.append(actions(button(t('training.nextLesson'),()=>{missionId=training.next;show('briefing')},'primary')));
        }else{
        const won = state.objective.outcome === true;
        panel.append(heading(t(won ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title')),
          paragraph(t(won && state.scenario === 'iron-dust-v2' ? 'v2.win' : won ? `mission.${campaign?.field ? missionId : state.scenario}.end.victory` : globalThis.GoblinCatalogFullRuntime?.active()&&state.objective.playerAlive?'v2.full.limit.defeat':'screen.missionEnd.defeat.allUnits')),
          paragraph(t('ui.hud.turn', { turn: state.turn })),
          actions(button(t('screen.missionEnd.action.retry'), confirmRestart, 'primary'),
            button(t(editorConfig ? 'v2.editor.return' : 'screen.missionEnd.action.chooseMission'), goToLevels),
            button(t('screen.missionEnd.action.log'), () => openSection('log'))));
        if (campaign?.field) {
          panel.append(paragraph(campaignPosition()));
          if (won) panel.append(actions(button(t(`v2.${campaign.field}.${campaign.index + 1 < fieldCampaigns[campaign.field].ids.length ? 'next' : 'finish'}`), advanceFieldCampaign, 'primary')));
          if (fieldError) panel.append(paragraph(fieldError, 'v2-status'));
        }
        }
      } else if (screen === 'log') {
        panel.append(heading(t(state.gameOver ? 'screen.missionEnd.action.log' : 'ui.details.log')));
        const entries = document.createElement('div'); entries.className = 'v2-screen-log';
        // Newest entry first in every runtime; reachable during play from the command bar and after the mission.
        (state.scenario === 'iron-dust-v2' ? state.log.toReversed().map(message => ({message})) : globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.logEntries(true):
          [...document.querySelectorAll('#combat-log .log-line')].map(line => ({time: line.querySelector('.log-time')?.textContent.trim() || '',
            message: [line.querySelector('strong')?.textContent.trim(), line.dataset.phaseSkipKey ? t(line.dataset.phaseSkipKey) :
              [...line.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim()].filter(Boolean).join(' ')})))
          .forEach(entry => {
            const line = paragraph('', 'v2-log-entry');
            if (entry.time) { const time = document.createElement('time'); time.className = 'v2-log-time'; time.textContent = entry.time; line.append(time); }
            line.append(Object.assign(document.createElement('span'), {className: 'v2-log-message', textContent: entry.message}));
            entries.append(line);
          });
        if (!entries.childElementCount) entries.append(paragraph(t('v2.log.empty'), 'v2-screen-log-empty'));
        const back = button(t('ui.nav.back'), goBack); back.id = 'v2-log-back';
        const rounds = state.scenario === 'iron-dust-v2' ? globalThis.IronDustBrowserV2?.roundView() :
          globalThis.GoblinFullRoundSource?.view();
        const roundActions = [];
        if (rounds?.latestComplete)
          roundActions.push(button(t('v2.round.latest'), () => openRoundAnalysis(rounds.latestComplete)));
        if (rounds?.terminalPartial)
          roundActions.push(button(t('v2.round.partial', {round:rounds.terminalPartial.roundNumber}),
            () => openRoundAnalysis(rounds.terminalPartial)));
        panel.append(entries, actions(back,...roundActions));
      } else if (screen === 'round-analysis') {
        const analysis = roundAnalysis;
        analysis.renderRoundAnalysis(panel,analysis.round,{
          t, previewMap:missionPreview, back:closeRoundAnalysis, selected:analysis.selected,
          onSelect:index => { analysis.selected = index; }
        });
      } else if (screen === 'catalog') {
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        header.append(heading(t('v2.library.title')), libraryKindSwitch());
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), goBack); back.id = 'v2-library-exit';
        footer.append(actions(back));
        if (libraryKind === 'rules' || libraryKind === 'tips') {
          panel.append(header, steppedList(libraryReference(libraryKind), 'v2-library-detail-scroll'), footer);
        } else {
          header.append(paragraph(t(libraryKind === 'terrain' ? 'v2.library.terrain.note' : 'v2.ui.catalogNote')));
          const layout = document.createElement('div'); layout.className = 'v2-library-layout v2-screen-main';
          const list = document.createElement('div'); list.className = 'v2-library-list';
          if (libraryKind === 'terrain') terrainIds.forEach((id, index) => {
            const item = button(TerrainDisplay.label(id), () => {
              terrainIndex = index;
              if (matchMedia('(max-width: 900px)').matches) show('catalog-detail'); else renderScreen(false);
            }, 'v2-library-choice');
            item.id = `v2-library-terrain-${id}`;
            item.setAttribute('aria-current', index === terrainIndex ? 'true' : 'false');
            const tile = TerrainDisplay.icon(id, 'v2-library-map-icon');
            if (tile) item.prepend(tile);
            list.append(item);
          });
          else unitGuideEntries.forEach((entry, index) => {
            const item = button(libraryName(entry), () => openLibraryEntry(index), 'v2-library-choice');
            item.id = `v2-library-${libraryAssetId(entry)}`;
            item.setAttribute('aria-current', index === libraryIndex ? 'true' : 'false');
            if (UnitVisuals.resolve(entry).asset ||
                (UnitVisuals.artKey(entry) && ['player', 'enemy'].includes(entry.team)))
              item.prepend(UnitVisuals.iconElement(entry, 'v2-library-map-icon'));
            list.append(item);
          });
          layout.append(steppedList(list));
          if (!matchMedia('(max-width: 900px)').matches) {
            const detail = libraryKind === 'terrain' ? terrainDetail(terrainIds[terrainIndex], false)
              : libraryDetail(unitGuideEntries[libraryIndex], state, false);
            layout.append(steppedList(detail, 'v2-library-detail-scroll'));
          }
          panel.append(header, layout, footer);
        }
      } else if (screen === 'catalog-detail') {
        const terrain = libraryKind === 'terrain';
        const detail = terrain ? terrainDetail(terrainIds[terrainIndex], true)
          : libraryDetail(unitGuideEntries[libraryIndex], state, true);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer v2-library-footer';
        const back = button(t('screen.library.back'), returnToLibrary); back.id = 'v2-library-back';
        const count = paragraph(t('screen.library.count', {current:(terrain ? terrainIndex : libraryIndex) + 1,
          total:terrain ? terrainIds.length : unitGuideEntries.length}), 'v2-library-count');
        const next = button(t('screen.library.next'), () => {
          if (terrain) terrainIndex = (terrainIndex + 1) % terrainIds.length;
          else { libraryIndex = (libraryIndex + 1) % unitGuideEntries.length; libraryTab = 'description'; }
          renderScreen(false);
        });
        next.id = 'v2-library-next';
        const mapAction = detail.querySelector('.v2-library-map-action');
        footer.append(actions(back, count, next), ...(mapAction ? [mapAction] : []));
        panel.append(detail, footer);
      } else if (screen === 'legal') {
        const notice = paragraph('G.O.B.L.I.N. is an independent game prototype by Think Design Code, available as a noncommercial public preview. It is not affiliated with or endorsed by any third-party game or product line and is not an official adaptation. The project uses code-generated artwork and AI-assisted design. Unit Guide illustrations, including enemy variants, were generated with ChatGPT.');
        notice.lang = 'en';
        const provenance = document.createElement('a');
        provenance.href = new URL('docs/CONTENT-NOTICES.md', document.baseURI).href;
        provenance.textContent = 'Content & Asset Notices';
        provenance.lang = 'en';
        panel.append(heading(t('v2.ui.legalNotices')), paragraph(t('v2.ui.legalEnglish'), 'v2-screen-meta'),
          notice, provenance, actions(button(t('ui.nav.back'), goBack)));
      } else if (screen === 'changelog') {
        panel.append(heading(t('v2.ui.changelog')), paragraph(t('v2.ui.changelogGerman'), 'v2-screen-meta'));
        const notice = document.createElement('pre'); notice.className = 'v2-legal-text';
        notice.lang = 'de';
        notice.tabIndex = 0;
        notice.textContent = t('v2.ui.changelogLoading');
        panel.append(notice, actions(button(t('ui.nav.back'), goBack)));
        fetch(new URL('CHANGELOG.md', document.baseURI), {cache:'no-cache'})
          .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); })
          .then(copy => { if (notice.isConnected) notice.textContent = copy; })
          .catch(() => { if (notice.isConnected) notice.textContent = t('v2.ui.changelogUnavailable'); });
      } else if (screen === 'options') {
        panel.classList.add('v2-options-panel');
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        header.append(heading(t('ui.nav.settings')));
        const content = document.createElement('div'); content.className = 'v2-screen-main v2-options-main';
        const language = document.createElement('label');
        language.textContent = t('ui.settings.language');
        const languageSelect = document.createElement('select'); languageSelect.id = 'v2-language';
        for (const code of GoblinLanguage.languages) {
          const option = document.createElement('option'); option.value = code;
          option.textContent = { de: 'Deutsch', en: 'English', es: 'Español', fr: 'Français' }[code];
          languageSelect.append(option);
        }
        languageSelect.value = GoblinLanguage.current;
        languageSelect.onchange = () => GoblinLanguage.choose(languageSelect.value);
        language.append(languageSelect);
        const animation=document.createElement('fieldset');animation.className='v2-animation-options';
        const animationTitle=document.createElement('legend');animationTitle.textContent=t('ui.settings.animation');
        const animationChoices=document.createElement('div');animationChoices.className='v2-animation-segments';
        for(const mode of GoblinPresentationPreferences.modes){
          const choice=button(t(`ui.settings.animation.${mode}`),()=>{
            GoblinPresentationPreferences.set(mode);
            for(const item of animationChoices.children)
              item.setAttribute('aria-pressed',String(item.dataset.animationMode===GoblinPresentationPreferences.read().mode));
          });
          choice.dataset.animationMode=mode;
          choice.setAttribute('aria-pressed',String(GoblinPresentationPreferences.read().mode===mode));
          animationChoices.append(choice);
        }
        animation.append(animationTitle,animationChoices);
        const grid = document.createElement('label'); grid.className = 'v2-setting-check';
        const gridInput = document.createElement('input'); gridInput.type = 'checkbox'; gridInput.id = 'v2-grid';
        gridInput.checked = GoblinUIV2.gridVisible;
        gridInput.onchange = () => GoblinUIV2.setGridVisible(gridInput.checked);
        grid.append(gridInput, document.createTextNode(t('ui.settings.grid')));
        const displayOptions=[];
        for(const [key,label] of [['targets','missionTargets'],['damage','damage']]){
          const row=document.createElement('label');row.className='v2-setting-check';
          const input=document.createElement('input');input.type='checkbox';input.id=`v2-${key}`;
          input.setAttribute('aria-label',t(`v2.display.${label}`));
          input.checked=GoblinUIV2[`${key}Visible`];
          input.onchange=()=>GoblinUIV2[key==='targets'?'setTargetsVisible':'setDamageVisible'](input.checked);
          row.append(input,document.createTextNode(t(`v2.display.${key}`)));displayOptions.push(row);
        }
        for(const key of ['roster','unit','field','legend']){
          const row=document.createElement('label');row.className='v2-setting-check';
          const input=document.createElement('input');input.type='checkbox';input.id=`v2-panel-${key}`;
          input.checked=GoblinUIV2.panelVisible(key);
          input.onchange=()=>GoblinUIV2.setPanelVisible(key,input.checked);
          row.append(input,document.createTextNode(t(`v2.panel.${key}`)));displayOptions.push(row);
        }
        const alpha = document.createElement('label'); alpha.className = 'v2-setting-range';
        const alphaValue = document.createElement('output');
        const alphaInput = document.createElement('input'); alphaInput.type = 'range'; alphaInput.id = 'v2-overlay-alpha';
        alphaInput.min = '10'; alphaInput.max = '60'; alphaInput.step = '2';
        alphaInput.value = String(Math.round(overlayAlpha() * 100)); alphaValue.textContent = `${alphaInput.value} %`;
        alphaInput.oninput = () => { applyOverlayAlpha(Number(alphaInput.value) / 100); alphaValue.textContent = `${alphaInput.value} %`; };
        alpha.append(document.createTextNode(t('v2.display.overlayAlpha')), alphaInput, alphaValue);
        const phaseNotice = document.createElement('label');
        phaseNotice.className = 'v2-setting-range';
        const phaseInput = document.createElement('input');
        phaseInput.type = 'range';
        phaseInput.id = 'v2-phase-notice-option';
        phaseInput.min = '0'; phaseInput.max = '5'; phaseInput.step = '1';
        phaseInput.value = String(GoblinUIV2.phaseNoticeSeconds);
        const phaseValue = document.createElement('output');
        const updatePhaseValue = () => { phaseValue.textContent = `${phaseInput.value} s`; };
        phaseInput.oninput = () => { GoblinUIV2.setPhaseNoticeSeconds(Number(phaseInput.value)); updatePhaseValue(); };
        updatePhaseValue();
        phaseNotice.append(document.createTextNode(t('v2.phaseNotice.setting')), phaseInput, phaseValue);
        const autoSelect = document.createElement('label');
        autoSelect.className = 'v2-setting-check';
        const autoSelectInput = document.createElement('input');
        autoSelectInput.type = 'checkbox'; autoSelectInput.id = 'v2-auto-select-ready';
        autoSelectInput.checked = GoblinUIV2.autoSelectReady;
        autoSelectInput.onchange = () => GoblinUIV2.setAutoSelectReady(autoSelectInput.checked);
        autoSelect.append(autoSelectInput, document.createTextNode(t('v2.autoSelectReady')));
        content.tabIndex = 0;
        content.setAttribute('aria-label', t('v2.options.scrollArea'));
        content.append(language, animation, grid, ...displayOptions, phaseNotice, autoSelect, alpha,
          button(t('v2.cache.reload'), reloadGameCache), paragraph(t('ui.settings.note')));
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), goBack); back.id = 'v2-options-back';
        const up = button('↑', () => content.scrollBy({top:-content.clientHeight * .8}));
        const down = button('↓', () => content.scrollBy({top:content.clientHeight * .8}));
        up.setAttribute('aria-label', t('v2.options.scrollUp'));
        down.setAttribute('aria-label', t('v2.options.scrollDown'));
        const updateScroll = () => {
          const limit = content.scrollHeight - content.clientHeight;
          up.hidden = down.hidden = limit <= 1;
          up.disabled = content.scrollTop <= 1;
          down.disabled = content.scrollTop >= limit - 1;
        };
        content.addEventListener('scroll', updateScroll);
        footer.append(actions(back, up, down));
        if (globalThis.GOBLIN_SUPPORT_URL) {
          footer.classList.add('v2-options-footer-with-support');
          const support = document.createElement('a');
          support.className = 'v2-project-support';
          support.href = globalThis.GOBLIN_SUPPORT_URL;
          support.referrerPolicy = 'no-referrer';
          support.textContent = t('v2.options.supportProject');
          footer.append(support);
        }
        const observer = new ResizeObserver(updateScroll);
        observer.observe(content);
        for (const child of content.children) observer.observe(child);
        optionsScrollObserver = observer;
        panel.append(header, content, footer);
      }
      finishScreen(panel, focus, lastFocus, lastIndex);
    }
    function finishScreen(panel, focus, lastFocus, lastIndex) {
      const savedScroll = scrollMemory.get(screen);
      if (savedScroll) {
        panel.scrollTop = savedScroll.panel;
        const options=panel.querySelector('.v2-options-main');
        if(options)options.scrollTop=savedScroll.options || 0;
        const list = panel.querySelector('.v2-level-list, .v2-library-list');
        if (list) list.scrollTop = savedScroll.list;
        const libraryLayout = panel.querySelector('.v2-library-layout');
        if (libraryLayout) libraryLayout.scrollTop = savedScroll.libraryLayout || 0;
      }
      const controls = [...panel.querySelectorAll('button:not(:disabled), select, input')];
      const targetId = focus ? focusMemory.get(screen) : lastFocus;
      const target = targetId && document.getElementById(targetId);
      const fallback = focus ? controls[0] : controls[lastIndex];
      (target && panel.contains(target) ? target : fallback || panel.querySelector('#v2-screen-heading'))
        ?.focus({ preventScroll: true });
    }
    document.querySelector('#v2-pause').onclick = enterPause;
    document.querySelector('#v2-log-open').onclick = () => { if (!GameDialogs.isOpen()) openSection('log'); };
    globalThis.addEventListener('goblin-view-settings-change',()=>{
      for(const key of ['grid','targets','damage']){
        const input=surface.querySelector(`#v2-${key}`);
        if(input)input.checked=GoblinUIV2[`${key}Visible`];
      }
    });
    new MutationObserver(() => { if (screen === 'levels') renderScreen(false); })
      .observe(document.querySelector('#scenario-select'), { childList: true });
    function showMissionEnd() {
      if (globalThis.GoblinCatalogFullRuntime?.ownsPresentation?.()) return;
      if (spectatorInput || screen !== 'play' || globalThis.GoblinMovement?.busy() || globalThis.GoblinLevelEvents?.pending(legacySession)) return;
      const state = GoblinUIV2.project();
      if (!state.gameOver) return;
      if (campaign?.field) recordFieldVictory(state);
      show('end');
    }
    globalThis.addEventListener('goblin-v2-render', () => {
      if (savedTitle && currentScenario === 'editor-draft')
        document.querySelector('#v2-mission').textContent = savedTitle;
      if (campaign?.field && currentScenario === 'editor-draft') {
        document.querySelector('#v2-mission').textContent = t(`mission.${missionId}.title`);
        document.querySelector('#v2-objective').textContent = t(campaign.field === 'scorched' ? 'v2.scorched.victory' : `mission.${missionId}.objective.short`);
      }
      showMissionEnd();
    });
    globalThis.addEventListener('goblin-movement-finished', showMissionEnd);
    globalThis.addEventListener('goblin-language-change', () => renderScreen(false));
    globalThis.addEventListener('goblin-language-change',renderTraining);
    globalThis.addEventListener('goblin-training-change',renderTraining);
    globalThis.addEventListener('goblin-v2-render',renderTraining);
    globalThis.addEventListener('goblin-training-ready',()=>{if(['menu','levels','briefing'].includes(screen))renderScreen(false)});
    globalThis.addEventListener('goblin-catalog-ready', () => {
      const requested=new URLSearchParams(globalThis.location?.search||'').get('scenario');
      if(!started&&!campaign&&GoblinCatalogFullModel.has(requested)&&missionData(requested))missionId=requested;
      if (['menu','levels','briefing'].includes(screen)) renderScreen(false);
    });
    globalThis.addEventListener('goblin-core-v2-ready', () => {
      if (screen === 'levels' || screen === 'briefing') renderScreen(false);
    });
    GoblinLanguage.ready.then(() => renderScreen(false));
    for (const type of ['pointerdown', 'click', 'contextmenu', 'wheel']) {
      globalThis.addEventListener(type, event => {
        const boundary = spectatorInput?.dialog ?? fullSetupDialog ?? (screen === 'full-handoff' ? surface : null);
        if (!boundary || event.composedPath().includes(boundary)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, {capture:true, passive:false});
    }
    globalThis.addEventListener('keyup', event => {
      if (event.key === 'Escape') spectatorEscapeHeld = false;
    }, true);
    globalThis.addEventListener('keydown', event => {
      if (fullSetupDialog || screen === 'full-handoff') {
        event.stopImmediatePropagation();
        if (screen === 'full-handoff' && event.key === 'Escape') event.preventDefault();
        return;
      }
      if (event.key === 'Escape' && !event.repeat) spectatorEscapeHeld = false;
      if (spectatorEscapeHeld && event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (spectatorInput) {
        event.stopImmediatePropagation();
        if (event.key === 'Escape') {
          spectatorEscapeHeld = true;
          event.preventDefault();
          spectatorInput.leave();
        }
        return;
      }
      if (screen !== 'play' && event.key === 'Escape' && !GameDialogs.isOpen() && document.querySelector('#unit-guide-modal').classList.contains('hidden')) {
        if (['options','catalog','legal','changelog'].includes(screen)) goBack();
        else if (screen === 'briefing') (campaign ? returnToCampaignMenu : returnToSelectedLevel)();
        else if (screen === 'campaign-complete' || screen === 'relay-campaign') returnToCampaignMenu();
        else if (screen === 'editor' && !editorBusy) {
          if (editorMoving) setEditorMoving(false);
          else show('menu');
        }
        else if (screen === 'catalog-detail') returnToLibrary();
        else if (screen === 'levels') show('menu');
        else if (screen === 'pause') { show('play'); releasePause(); }
        else if (screen === 'log') goBack();
        else if (screen === 'round-analysis') closeRoundAnalysis();
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    show('menu');
  })();
}
