// Default presentation over the selected Legacy or Core session; explicit non-V2 UI values keep the prior test path.
const goblinUiChoice = new URLSearchParams(location.search).get('ui');
if ((goblinUiChoice === null || goblinUiChoice === 'v2') && !globalThis.goblinBootProfileError) {
  (() => {
    const nativeMap = document.querySelector('#battlefield-map');
    const nativeShell = document.querySelector('.app-shell');
    const view = { actorId: null, target: null, infoCell: null, focusCell: null,
      intentRevision: null, busy: false, message: '', zoom: 1, areaMode: null, gridVisible: false,
      targetsVisible:true,damageVisible:true,
      phaseSkip: null, targetBranch: [], targetOption: null, afterWeaponSwitch: false };
    const shell = document.createElement('div');
    shell.className = 'v2-shell';
    // Line icons for the game shell; every icon button carries its text as aria-label and title.
    const ICONS = {
      pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
      settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
      movement: '<path d="M12 2v20M2 12h20"/><path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
      fire: '<circle cx="12" cy="12" r="9"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>',
      main: '<path d="M3 16h9v4H3zM8 16l12-11 2 2-10 9"/>',
      secondary: '<path d="M3 17h9v3H3zM7 17l7-10m-3 10 7-10"/>',
      missiles: '<path d="M5 17l4-1L20 5l-5 1L4 17zM8 13l-4-1 2-2h5m0 5v5l3-3v-5"/>',
      antipersonnel: '<path d="M4 17l9-9M9 19l8-8M3 12l7-7"/>',
      indirect: '<path d="M3 18Q10 1 20 13m-5 0h5V8"/>',
      los: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
      targets: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      damage: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/><path d="m12 5-2 4 4 3-2 4"/>',
      zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
      zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
      center: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
      fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
      ram: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
      embark: '<path d="M4 14v6h16v-6"/><path d="M12 3v11M8 10l4 4 4-4"/>',
      unload: '<path d="M4 14v6h16v-6"/><path d="M12 14V3M8 7l4-4 4 4"/>',
      tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
      action: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      log: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'
    };
    const svgIcon = name => `<svg class="v2-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
    const iconButton = (id, name, extra = '') => `<button type="button" class="v2-icon-button" id="${id}"${extra}>${svgIcon(name)}</button>`;
    shell.innerHTML = `
      <header class="v2-head"><div class="v2-head-mission"><span class="v2-label" id="v2-profile"></span><h1 id="v2-mission"></h1></div><div class="v2-head-turn"><p id="v2-turn"></p></div><div class="v2-head-goal"><p id="v2-objective"></p></div>${iconButton('v2-pause', 'settings')}</header>
      <div class="v2-layout"><aside class="v2-own" id="v2-roster-panel"><section class="v2-card v2-units-card"><div class="v2-card-head"><span class="v2-label" id="v2-units-label"></span><span class="v2-units-ready" id="v2-units-ready"></span></div><div class="v2-units" id="v2-units"></div></section></aside><main class="v2-card v2-map-card"><span class="v2-sr" id="v2-map-label"></span><div class="v2-map-frame"><div class="v2-map" id="v2-map" tabindex="0"></div><section id="v2-training" class="v2-card v2-training" aria-labelledby="v2-training-title" hidden></section><div id="v2-map-hover" class="v2-map-hover" hidden></div><strong id="v2-phase" role="status" aria-live="polite"></strong><dialog id="v2-phase-notice" class="v2-phase-notice" aria-labelledby="v2-phase-notice-title" hidden><strong id="v2-phase-notice-title"></strong><label><input type="checkbox"><span></span></label></dialog><div class="v2-map-overlay v2-map-overlay-top"><div class="v2-area-controls" role="group" id="v2-area-controls">${iconButton('v2-mode-movement', 'movement', ' data-area="movement"')}${iconButton('v2-mode-fire', 'fire', ' data-area="fire"')}${iconButton('v2-mode-los', 'los', ' data-area="los"')}<button type="button" id="v2-display-toggle" aria-expanded="false" aria-controls="v2-display-controls" hidden></button><div id="v2-display-controls" class="v2-display-controls" role="group">${iconButton('v2-area-grid', 'grid')}${iconButton('v2-area-targets', 'targets')}${iconButton('v2-area-damage', 'damage')}</div></div><p id="v2-area-legend" class="v2-area-legend" role="status"></p></div><div class="v2-map-overlay v2-map-overlay-bottom"><div class="v2-map-tools" role="group" id="v2-map-tools">${iconButton('v2-zoom-in', 'zoomIn')}${iconButton('v2-zoom-out', 'zoomOut')}${iconButton('v2-zoom-center', 'center')}${iconButton('v2-zoom-fit', 'fit')}</div></div></div></main><aside class="v2-target" id="v2-intel-panel"><div id="v2-intel"></div></aside></div>
      <footer class="v2-controls"><div class="v2-context"><strong id="v2-terminal" hidden></strong><p id="v2-message" class="v2-status" role="status"></p></div>${iconButton('v2-log-open', 'log')}<button type="button" id="v2-undo"></button><button type="button" id="v2-phase-action"></button><button type="button" id="v2-next-unit"></button></footer><section class="v2-card v2-target-card" id="v2-target-card" role="group" aria-labelledby="v2-target-title" hidden></section>`;
    document.body.insertBefore(shell, nativeShell);
    shell.querySelector('#v2-map').appendChild(nativeMap);
    document.body.classList.add('ui-v2-active');
    const at = selector => shell.querySelector(selector);
    const displayControls=GoblinDisplayControls.create(at('#v2-area-controls'),{
      disclosure:at('#v2-display-toggle'),panel:at('#v2-display-controls'),
      buttons:[...at('#v2-area-controls').querySelectorAll('[data-area]'),at('#v2-area-grid'),
        at('#v2-area-targets'),at('#v2-area-damage')]});
    const t = (key, params) => globalThis.GoblinLanguage?.t(key, params) || key;
    const core = () => globalThis.IronDustBrowserV2?.mode === 'ready';
    function addRosterArt(button, unit) {
      button.prepend(UnitVisuals.iconElement(unit, 'v2-roster-art'));
    }
    function strengthText(unit) {
      if(unit.catalogSystems)return `${t('v2.ui.treads')} ${unit.catalogSystems.treads}/${unit.catalogSystems.maxTreads}`;
      return unit.ogreSystems
        ? `${t('v2.ui.treads')} ${unit.ogreSystems.treads}/${unit.ogreSystems.maxTreads}`
        : `${unit.hp}/${unit.maxHp} ${unit.infantry ? 'SP' : 'HP'}`;
    }
    function renderM1Markers(state, actor) {
      renderUnitHoverNames(state.units);
      nativeMap.querySelectorAll('.target-ring,.unit-selection-ring,.focus-marker').forEach(node => node.remove());
      M1UnitMarkers.render(nativeMap, state.markers, {actor, target:view.target, focus:view.focusCell, t,
        targetsVisible:view.targetsVisible,damageVisible:view.damageVisible});
      const members=state.markers.objective?.members || [];
      const done=members.filter(member => member.state==='satisfied').length;
      let status=at('#v2-objective-members');
      if(!status){status=document.createElement('p');status.id='v2-objective-members';at('#v2-objective').after(status);}
      status.textContent=members.length?t('v2.ui.objectiveMembers',{done,total:members.length}):'';
      if(state.fullStatus){if(state.fullStatus.pendingEnemy)status.textContent+=' · '+t('v2.full.objective.pendingWaves');if(Number.isSafeInteger(state.fullStatus.turnLimit)&&state.fullStatus.turnLimit>0)status.textContent+=' · '+t('v2.full.limit.status',{current:state.fullStatus.enemyTurns,limit:state.fullStatus.turnLimit});}
      status.title=members.map(member => `${state.units.find(unit=>unit.id===member.unitId)?.name || member.unitId}: ${t(member.state==='satisfied'?'v2.ui.destroyed':'v2.ui.objectivePending')}`).join('\n');
    }

    function renderUnitHoverNames(projectedUnits) {
      const names = new Map();
      for (const unit of projectedUnits) {
        if (unitAlive(unit) && !unit.embarkedOn) names.set(`${unit.x},${unit.y}`, unit.name);
      }
      for (const hex of nativeMap.querySelectorAll('.hex[data-x][data-y]')) {
        const name = names.get(`${hex.dataset.x},${hex.dataset.y}`);
        let title = hex.querySelector('title[data-v2-unit-name]');
        if (!name) { title?.remove(); continue; }
        if (!title) {
          title = document.createElementNS(NS, 'title');
          title.setAttribute('data-v2-unit-name', '');
          hex.prepend(title);
        }
        if (title.textContent !== name) title.textContent = name;
      }
    }

    function revision() {
      if (core()) return `core:${IronDustBrowserV2.epoch}:${IronDustBrowserV2.session.profile.digest}`;
      if(globalThis.GoblinCatalogFullRuntime?.active())return GoblinCatalogFullRuntime.commandRevision();
      return legacyRuleRevision();
    }
    function legacyLogEntries() {
      if(globalThis.GoblinCatalogFullRuntime?.active())return GoblinCatalogFullRuntime.logEntries();
      return [...logEl.querySelectorAll('.log-line')].slice(0, 4).map(line => ({
        time:line.querySelector('.log-time')?.textContent.trim() || '',
        source:line.querySelector('strong')?.textContent.trim() || '',
        message:line.dataset.phaseSkipKey ? t(line.dataset.phaseSkipKey) :
          [...line.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent).join('').trim()
      }));
    }
    function notifyPhaseSkip(phaseName) {
      if (!['movement', 'fire', 'gev'].includes(phaseName) || core() || phaseCommands.length || phaseHasCommittedCommand) return;
      const key = `v2.phaseSkip.${phaseName}`;
      if (globalThis.GoblinCatalogFullRuntime?.active()) GoblinCatalogFullRuntime.log(key, {}, []);
      else {
        const previous = logEl.firstElementChild;
        addLog(t(key));
        const line = logEl.firstElementChild;
        if (line && line !== previous) line.dataset.phaseSkipKey = key;
      }
      view.phaseSkip = {key, turn};
      clearTimeout(view.phaseSkipTimer);
      view.phaseSkipTimer = setTimeout(() => { view.phaseSkip = null; render(); }, 9000);
    }
    let idleCoreLog=[],idleLegacyLogEntries=[];
    function project() {
      const displayed=globalThis.GoblinMovement?.projectedState();
      if (core()) {
        let source = IronDustBrowserV2.view;
        if(displayed){
          const roster=source.units.map(unit=>{
            const raw=displayed.units.find(item=>item.id===unit.id);if(!raw)return unit;
            const systems=raw.ogreSystems;
            return {...unit,...raw,attack:raw.damage??unit.attack,treads:systems?.treads??null,maxTreads:systems?.maxTreads??null,
              selectedWeapon:systems?.selectedWeapon??null,weapons:systems?Object.fromEntries(Object.entries(systems.weapons).map(([key,weapon])=>
                [key,{...weapon,ready:GoblinSystems.weaponReady(weapon)}])):null};
          });
          const objective=roster.find(unit=>unit.id==='core');
          source={...source,units:roster,turn:displayed.turn,phase:displayed.phase,victory:displayed.victory,
            mode:displayed.victory.status==='ended'?'ended':displayed.activeTeam,
            objective:{coreHp:objective.hp,coreMaxHp:objective.maxHp,progress:100*(objective.maxHp-objective.hp)/objective.maxHp}};
        }
        const snapshotRevision = revision();
        if(!displayed)idleCoreLog=source.events.map(event=>IronDustBrowserV2.formatEvent(event));
        return {
          revision: snapshotRevision, scenario: 'iron-dust-v2', profile: source.ruleProfileId,
          markers:M1UnitMarkers.core(source, IronDustBrowserV2.epoch, snapshotRevision),
          mission: {title:t('mission.iron-dust-v2.title'), objective:t('v2.objective')},
          turn:source.turn, phase:source.mode === 'player' ? 'player' : source.mode,
          turnPhase:source.phase, gameOver:source.mode === 'ended',
          objective:{goalMode:'core', coreHp:source.objective.coreHp,
            coreMax:source.objective.coreMaxHp, outcome:source.victory.winner === 'player' ? true :
              source.mode === 'ended' ? false : null},
          ready:coreOpenCount(source),
          undo:{available:false,count:0}, units:source.units, cells:source.cells,
          systems:source.units.filter(unit => unit.team === 'player' && unit.weapons).map(unit => ({id:unit.id,
            summary:{treads:unit.treads,weapons:Object.fromEntries(Object.entries(unit.weapons)
              .map(([key, weapon]) => [key, weapon.ready]))}})),
          log:idleCoreLog
        };
      }
      const roster=displayed?.units??(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units);
      const shownPhase=displayed?.activeTeam??phase,shownTurnPhase=displayed?.phase??turnPhase,shownGameOver=displayed?.gameOver??gameOver;
      const objective = objectiveSnapshot(victoryProfile(legacySession.effectiveRules), globalThis.GoblinCatalogFullRuntime?.active()?units:roster);
      if(!displayed)idleLegacyLogEntries=legacyLogEntries();
      const logEntries = idleLegacyLogEntries;
      const snapshotRevision = revision();
      return {
        ...(globalThis.GoblinCatalogFullRuntime?.active()?{fullStatus:GoblinCatalogFullRuntime.status()}:{}),
        revision: snapshotRevision, scenario: currentScenario, profile: legacySession.ruleProfileId,
        markers:M1UnitMarkers.legacy(legacySession, roster, snapshotRevision, objective.outcome),
        mission: { title: t(`mission.${currentScenario}.title`), objective: t(`mission.${currentScenario}.objective.short`) },
        turn:displayed?.turn??turn, phase:shownPhase, turnPhase:shownTurnPhase, gameOver:shownGameOver, objective: structuredClone(objective),
        ready: phase === 'player' && !gameOver ? phaseReadyUnits().length : 0,
        undo: { available: phaseCommands.length > 0 && phase === 'player' && !gameOver, count: phaseCommands.length },
        units: roster.map(source=>{const { id, name, type, team, x, y, hp, maxHp, visualKey, catalogId, catalogAssetId, halfUnit, forceBudgetWeight, droneReadyTurn, artilleryFire, artilleryChoice, siegeFireBudget, siegeWeapon, attack, defense, move, range, damage, disabled, embarkedOn, core, infantry, engineering, ogreSystems, transportCapacity, strategicMissile, missilesRemaining }=source;const projected={ id, name:catalogId?GoblinCatalogRuntime.name({id}):name, type, team, x, y, hp, maxHp, visualKey, catalogId, catalogAssetId, halfUnit, forceBudgetWeight, droneReadyTurn, artilleryChoice, artilleryFire:artilleryFire?structuredClone(artilleryFire):null, siegeWeapon, siegeFireBudget:siegeFireBudget?structuredClone(siegeFireBudget):null, disabled: !!disabled, embarkedOn: embarkedOn || null,
            attack: attack ?? damage ?? null, defense: defense ?? null, move: move ?? null, secondaryMove: movementBudget({id,team,move,gev:isGevUnit(roster.find(item=>item.id===id))},true), range: range ?? null,
            core: !!core, infantry: !!infantry, engineering:!!engineering,
            ogreSystems:ogreSystems ? structuredClone(ogreSystems) : null,
            transportCapacity: transportCapacity || 0, strategicMissile: !!strategicMissile,
            missilesRemaining: missilesRemaining ?? null };if(globalThis.GoblinSpecialistsRuntime?.active()){Object.assign(projected,GoblinSpecialistsRuntime.projectUnit(source));if(source.catalogSystems){delete projected.hp;delete projected.maxHp;delete projected.infantry;delete projected.defense}}return projected;}),
        systems: roster.filter(unit => unit.team === 'player' && (unit.ogreSystems||unit.catalogSystems))
          .map(unit => ({ id: unit.id, summary: unit.catalogSystems?GoblinSystems.catalogSummary(unit.catalogSystems,GoblinSpecialistsRuntime.registry()):GoblinSystems.summary(unit.ogreSystems) })),
        logEntries,
        log: logEntries.map(entry => [entry.time, entry.source, entry.message]
          .filter(Boolean).join(' '))
      };
    }
    function query(command) {
      if(globalThis.GoblinMovement?.busy())return {ok:false,reason:''};
      if (core()) {
        if (GameDialogs.isOpen() || document.body.classList.contains('v2-screen-open'))
          return {ok:false,reason:t('ui.error.INVALID_COMMAND')};
        const result = IronDustBrowserV2.query(command);
        return result.available ? {ok:true,...result} : {ok:false,reason:IronDustBrowserV2.formatError(result.error?.code)};
      }
      const draft = ScenarioRuleProfiles.isDraftSession?.(legacySession);
      if ((!draft && (!scenarioCatalog[currentScenario] || !ScenarioRuleProfiles.entries[currentScenario])) ||
          legacySession?.scenarioId !== currentScenario ||
          (!draft && legacySession.ruleProfileId !== ScenarioRuleProfiles.entries[currentScenario].ruleProfileId &&
            !(globalThis.GoblinCatalogFullRuntime?.active()&&legacySession.ruleProfileId===GoblinCatalogFullModel.candidateProfile)) ||
          globalThis.IronDustBrowserV2?.active)
        return { ok: false, reason: t('ui.error.UNSUPPORTED_COMMAND') };
      if (GameDialogs.isOpen()) return { ok: false, reason: t('ui.error.INVALID_COMMAND') };
      if (phase !== 'player' || gameOver) return { ok: false, reason: t(gameOver ? 'ui.error.GAME_ENDED' : 'ui.error.NOT_ACTIVE_TEAM') };
      if(globalThis.GoblinCatalogFullRuntime?.active()){if(command?.type==='CatalogHexFire'){const q=GoblinCatalogFullRuntime.hexQuery(command);return q.ok?{ok:true,footprint:q.footprint,friendlies:q.friendlies,weapon:q.weapon}:q}if(command?.type==='Move')return GoblinCatalogFullRuntime.moveQuery(command);}
      if(globalThis.GoblinSpecialistsRuntime?.active()){if(['CatalogFire','CatalogRam','CatalogLoad','CatalogDeploy','Engineer'].includes(command?.type))return GoblinSpecialistsRuntime.query(command);if(['Fire','FireArtillery','Ram'].includes(command?.type))return {ok:false,reason:t('ui.error.UNSUPPORTED_COMMAND')};}
      if(globalThis.GoblinCatalogRuntime?.active())return GoblinCatalogRuntime.query(command);
      if (!['Move', 'Ram', 'Fire', 'FireArtillery', 'Embark', 'Unload'].includes(command?.type)) return { ok: false, reason: t('ui.error.UNKNOWN_COMMAND') };
      const actor = units.find(unit => unit.id === command.actorId);
      if (!actor) return { ok: false, reason: t('ui.error.UNIT_NOT_FOUND') };
      if (actor.team !== 'player') return { ok: false, reason: t('ui.error.UNIT_NOT_OWNED') };
      if (unitDead(actor)) return { ok: false, reason: t('ui.error.UNIT_DESTROYED') };
      if (actor.disabled) return { ok: false, reason: t('ui.error.UNIT_DISABLED') };
      if (!Number.isInteger(command.x) || !Number.isInteger(command.y) || command.x < 0 || command.x >= W || command.y < 0 || command.y >= H)
        return { ok: false, reason: t('ui.error.OUT_OF_BOUNDS') };
      const target = units.find(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === command.x && unit.y === command.y);
      if(command.type==='FireArtillery')return globalThis.GoblinArtilleryWeapons?.active(actor)?GoblinArtilleryWeapons.query(actor,target,command):{ok:false,reason:t('ui.error.UNSUPPORTED_COMMAND')};
      if(command.type==='Fire'&&globalThis.GoblinArtilleryWeapons?.active(actor))return {ok:false,reason:t('ui.error.UNSUPPORTED_COMMAND')};
      if (command.type === 'Embark') {
        if (target?.id === command.carrierId && canEmbark(actor, target)) return { ok: true };
        const reason = target?.disabled ? 'ui.error.UNIT_DISABLED' :
          target?.transportCapacity && carrierLoad(target) + Math.max(1, actor.hp) > target.transportCapacity ?
            'v2.target.transportFull' : 'v2.reject.catalog.cargoNotReady';
        return { ok: false, reason: t(reason) };
      }
      if (command.type === 'Unload') {
        const cargo = units.find(unit => unit.id === command.cargoId);
        if (!actor.transportCapacity || !canUnloadTo(actor, cargo, command.x, command.y))
          return { ok: false, reason: t(cargo?.embarkedThisTurn ? 'v2.reject.catalog.sameTurn' : 'v2.reject.catalog.deployCell') };
        return { ok: true };
      }
      if (command.type === 'Move') {
        if (turnPhase !== 'movement' && turnPhase !== 'gev') return { ok: false, reason: t('ui.error.WRONG_PHASE') };
        if (actor.embarkedOn) return { ok: false, reason: t('ui.error.UNIT_EMBARKED') };
        const second = turnPhase === 'gev';
        if (!canMoveUnit(actor, second)) return { ok: false, reason: t('ui.error.ACTION_SPENT') };
        if (target) return { ok: false, reason: t('ui.error.INVALID_TARGET') };
        const path = findMovementPath(actor, { x: command.x, y: command.y }, movementBudget(actor, second), actor);
        return path?.length ? { ok: true, path: path.map(cell => ({ ...cell })) }
          : { ok: false, reason: t('ui.error.UNREACHABLE') };
      }
      if (!target || target.team !== 'enemy') return { ok: false, reason: t('ui.error.TARGET_NOT_ATTACKABLE') };
      if (command.type === 'Ram') {
        if (turnPhase !== 'movement' || actor.id !== 'ogre' || actor.embarkedOn || actor.moved || target.core)
          return { ok: false, reason: t('ui.error.UNSUPPORTED_COMMAND') };
        const path = findMovementPath(actor, { x: command.x, y: command.y }, actor.move, actor);
        return path?.length ? { ok: true, path: path.map(cell => ({ ...cell })) }
          : { ok: false, reason: t('ui.error.UNREACHABLE') };
      }
      if(globalThis.GoblinSiegeWeapons?.active(actor))return GoblinSiegeWeapons.query(actor,target,command.weaponKey??actor.siegeWeapon);
      if (turnPhase !== 'fire' || !phaseCanAct(actor, 'fire')) return { ok: false, reason: t(turnPhase !== 'fire' ? 'ui.error.WRONG_PHASE' : 'ui.error.NO_ATTACKABLE_TARGET') };
      if (actor.ogreSystems) {
        const weapon = actor.ogreSystems.weapons[command.weaponKey];
        if (!weapon || !SiegebreakerWeapons.targetAllowed(actor, target, command.weaponKey))
          return { ok: false, reason: t('ui.error.NO_ATTACKABLE_TARGET') };
        return { ok: true, weapon: { key: command.weaponKey, label: weapon.label, attack: weapon.attack, range: weapon.range } };
      }
      if (dist(actor, target) > actor.range || !lineOfSight(actor, target))
        return { ok: false, reason: t('ui.error.TARGET_NOT_ATTACKABLE') };
      return weaponTargetAllowed(actor, target) ? { ok: true }
        : { ok: false, reason: t('ui.error.TARGET_NOT_ATTACKABLE') };
    }
    function previewFire(command) {
      if (core()) return query(command).ok ? IronDustBrowserV2.previewFire(command) : null;
      if (!['Fire','FireArtillery','CatalogFire'].includes(command?.type)) return null;
      const legal = query(command);
      if (!legal.ok) return null;
      const actor = units.find(unit => unit.id === command.actorId);
      const target = command.type==='CatalogFire'?units.find(unit=>unit.id===command.target.runtimeUnitId):units.find(unit => unitAlive(unit) && !unit.embarkedOn &&
        unit.x === command.x && unit.y === command.y);
      if (!actor || !target) return null;
      const attack = command.type === 'Fire' && actor.strategicMissile
        ? globalThis.StrategicMissile.STRIKE.directAttack : legal.weapon?.attack ?? actor.damage;
      const defense = command.type==='CatalogFire'?legal.defense:effectiveDefense(target);
      const ratioCategory = Number.isFinite(attack) && Number.isFinite(defense)
        ? combatRatio(attack, defense) : command.type==='CatalogFire'&&command.target.componentId==='treads'?'1-1':null;
      return Object.freeze({profileId: legacySession.ruleProfileId,
        stateRevision: revision(), actorId: actor.id, targetId: target.id,
        weaponKey: command.type==='CatalogFire'?command.weaponId:actor.artilleryFire ? legal.weapon.key : actor.ogreSystems||actor.siegeFireBudget ? command.weaponKey??actor.siegeWeapon : null,
        from: {x: actor.x, y: actor.y}, to: {x: target.x, y: target.y},
        legal: true, ratioCategory, ...(command.type==='CatalogFire'&&command.target.componentId==='treads'?{attack,meaning:'tread-roll-5-6'}:{meaning:'crt-attack-effective-defense'})});
    }
    function dispatch(command, expectedRevision, confirmedTarget = false) {
      if(globalThis.GoblinMovement?.busy()){globalThis.GoblinMovement.skip();return {ok:false,reason:''};}
      startZoomPending = null;
      if (core()) {
        if (view.busy || expectedRevision !== revision()) return {ok:false,reason:t('ui.error.INVALID_COMMAND')};
        const check = query(command);
        if (!check.ok) return check;
        view.busy = true;
        try {
          const result = IronDustBrowserV2.dispatch(command);
          return result.session ? {ok:true} : {ok:false,reason:IronDustBrowserV2.formatError(result.error?.code)};
        } finally {view.busy = false; render();}
      }
      if (view.busy) return { ok: false, reason: t('ui.error.INVALID_COMMAND') };
      if (typeof expectedRevision !== 'string' || expectedRevision !== revision()) return { ok: false, reason: t('ui.error.INVALID_COMMAND') };
      const check = query(command);
      if (!check.ok) {globalThis.GoblinTrainingRuntime?.rejected(command);return check;}
      view.busy = true;
      try {
        const actor = units.find(unit => unit.id === command.actorId);
        selected = actor;
        const beforeExecution = revision();
        if(['CatalogFire','CatalogRam','CatalogLoad','CatalogDeploy','Engineer','CatalogHexFire'].includes(command.type)||globalThis.GoblinCatalogFullRuntime?.active()&&command.type==='Move'){executeSpecialistCommand(command);return revision()!==beforeExecution?{ok:true}:{ok:false,reason:t('ui.error.INVALID_COMMAND')};}
        // A confirmed target-card load has its own undo label. A map command retains its history and focus.
        if (confirmedTarget && command.type === 'Embark') {
          embark(actor, units.find(unit => unit.id === command.carrierId));
          return revision() !== beforeExecution ? { ok: true } : { ok: false, reason: t('ui.error.INVALID_COMMAND') };
        }
        if (command.type === 'Unload') {
          const cargo = units.find(unit => unit.id === command.cargoId);
          unloadAt(actor, cargo, command.x, command.y);
          return revision() !== beforeExecution ? { ok: true } : { ok: false, reason: t('ui.error.INVALID_COMMAND') };
        }
        if(command.type==='FireArtillery'&&!GoblinArtilleryWeapons.selectWeapon(actor,GoblinArtilleryWeapons.choice(command.mode,command.spotterId)))return {ok:false,reason:t('ui.error.NO_ATTACKABLE_TARGET')};
        if(command.type==='Fire'&&globalThis.GoblinSiegeWeapons?.active(actor)&&!GoblinSiegeWeapons.selectWeapon(actor,command.weaponKey??actor.siegeWeapon))return {ok:false,reason:t('ui.error.NO_ATTACKABLE_TARGET')};
        if (command.type === 'Fire' && actor.ogreSystems && !SiegebreakerWeapons.selectWeapon(actor, command.weaponKey))
          return { ok: false, reason: t('ui.error.NO_ATTACKABLE_TARGET') };
        const beforeHex = revision();
        // handleHex is the final, command-history-wrapped Legacy path and checks again.
        handleHex(command.x, command.y);
        return revision() !== beforeHex ? { ok: true } : { ok: false, reason: t('ui.error.INVALID_COMMAND') };
      } finally { view.busy = false; render(); }
    }
    function undo() {
      if (core()) return {ok:false,reason:t('v2.undo')};
      if (view.busy || !phaseCommands.length || phase !== 'player' || gameOver) return { ok: false, reason: t('ui.error.ACTION_SPENT') };
      clearContext();
      undoPhaseCommand();
      render();
      return { ok: true };
    }
    function resetView() {
      startZoomPending = null;
      view.actorId = null; view.infoCell = null; view.focusCell = null; clearContext();
      view.zoom = 1; view.areaMode = null;
      fireZoomPhase = null;
      phaseNoticeKey = null;
      hidePhaseNotice();
      view.phaseSkip = null; clearTimeout(view.phaseSkipTimer); applyMapSize();
      at('#v2-map').scrollLeft = 0; at('#v2-map').scrollTop = 0;
      render();
    }
    globalThis.GoblinUIV2 = Object.freeze({ project, query, previewFire, dispatch, undo, resetView, startView, focusUnit, notifyPhaseSkip, legacyAiHost,
      get gridVisible() { return view.gridVisible; }, setGridVisible(value) { setViewFlag('gridVisible',value); },
      get targetsVisible() { return view.targetsVisible; }, setTargetsVisible(value) { setViewFlag('targetsVisible',value); },
      get damageVisible() { return view.damageVisible; }, setDamageVisible(value) { setViewFlag('damageVisible',value); },
      get phaseNoticeSeconds() { return phaseNoticeSeconds; }, setPhaseNoticeSeconds,
      get autoSelectReady() { return view.autoSelectReady; }, setAutoSelectReady,
      closeTarget: () => { if (view.target) clearContext(); },
      cancelMapPointers,
      trainingFirePreview, svgIcon,
      panelVisible: key => intelSections[key],
      setPanelVisible,
      refresh: () => { areaCache.key = null; targetCache.key = null; render(); } });
    function setViewFlag(key,value){
      view[key]=!!value;render();
      globalThis.dispatchEvent(new Event('goblin-view-settings-change'));
    }

    function clearContext() {
      // A synchronous draw can retire the menu before the active dispatch publishes its training receipt.
      if (!view.busy) globalThis.GoblinTrainingRuntime?.cancel();
      view.targetBranch = [];
      view.targetOption = null;
      view.afterWeaponSwitch = false;
      view.target = null;
      view.intentRevision = null;
      view.message = '';
    }
    const hexLabel = cell => `${String.fromCharCode(65 + cell.x)}-${String(cell.y + 1).padStart(2, '0')}`;
    function coreOpenCount(source) { return coreOpenUnits(source).length; }
    function coreOpenUnits(source) {
      if (source.mode !== 'player') return [];
      const enemies = source.units.filter(unit => unit.team === 'enemy' && unitAlive(unit));
      return source.units.filter(unit => unit.team === 'player' && unitAlive(unit) && !unit.disabled)
        .filter(unit => {
          if (source.phase === 'movement' || source.phase === 'gev') {
            if (source.phase === 'gev' && unit.id !== 'gev') return false;
            if (source.cells.some(cell => IronDustBrowserV2.query({type:'Move',playerId:'player',unitId:unit.id,
              to:{x:cell.x,y:cell.y}}).available)) return true;
            return source.phase === 'movement' && enemies.some(enemy => IronDustBrowserV2.query({
              type:'Ram',playerId:'player',unitId:unit.id,targetId:enemy.id}).available);
          }
          if (source.phase !== 'fire') return false;
          if (enemies.some(enemy => IronDustBrowserV2.query({type:'PlayerFire',playerId:'player',
            unitId:unit.id,targetId:enemy.id,...(unit.weapons ? {weaponKey:unit.selectedWeapon} : {})}).available)) return true;
          return unit.weapons && Object.entries(unit.weapons).some(([key,weapon]) => key !== unit.selectedWeapon && weapon.ready > 0 &&
            IronDustBrowserV2.query({type:'SelectWeapon',playerId:'player',unitId:unit.id,weaponKey:key}).available);
        });
    }
    // Own units that can still act in the current phase, in roster order.
    function readyUnitIds() {
      if (core()) return coreOpenUnits(IronDustBrowserV2.view).map(unit => unit.id);
      return phase === 'player' && !gameOver ? phaseReadyUnits().map(unit => unit.id) : [];
    }
    function nextReadyUnit(state = project()) {
      const ids = readyUnitIds(), order = state.units.filter(unit => unit.team === 'player').map(unit => unit.id);
      const current = order.indexOf(view.actorId);
      return ids.find(id => order.indexOf(id) > current) ?? ids[0] ?? null;
    }
    function backLabel(button, count) {
      button.replaceChildren(Object.assign(document.createElement('span'), {className: 'v2-back-arrow', textContent: '«'}),
        Object.assign(document.createElement('span'), {className: 'v2-back-label', textContent: GoblinLanguage.translate('BACK') + (count ? ` (${count})` : '')}));
      button.setAttribute('aria-label', GoblinLanguage.translate('BACK'));
    }
    // Phase button in two lines (next phase, open units); the text content keeps the single-line form.
    function splitPhaseLabel(button) {
      const [title, ...rest] = button.textContent.split(' · ');
      if (!rest.length) return;
      button.replaceChildren(el('span', 'v2-phase-title', title), el('span', 'v2-sr', ' · '), el('small', 'v2-phase-sub', rest.join(' · ')));
    }
    function renderTurnControls(state) {
      const count = state.phase === 'player' && !state.gameOver ? readyUnitIds().length : 0;
      const next = at('#v2-next-unit');
      next.replaceChildren(Object.assign(document.createElement('span'), {className: 'v2-next-label', textContent: t('v2.ui.nextUnitShort')}),
        Object.assign(document.createElement('span'), {className: 'v2-next-arrow', textContent: '»'}),
        Object.assign(document.createElement('span'), {className: 'v2-next-count', textContent: String(count)}));
      next.setAttribute('aria-label', t('v2.ui.nextUnit', {count}));
      next.title = next.getAttribute('aria-label');
      next.disabled = !count || GameDialogs.isOpen() || view.busy;
    }
    const el = (tag, className = '', text = '') => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== '') node.textContent = text;
      return node;
    };
    function intelLabel(label, fullLabel) {
      if (!fullLabel || label === fullLabel) return el('span', '', label);
      const node = el('span', 'v2-intel-compact-label');
      const visible = el('span', '', label);
      visible.setAttribute('aria-hidden', 'true');
      node.title = fullLabel;
      node.append(visible, el('span', 'v2-sr', fullLabel));
      return node;
    }
    function compactWeaponLabel(key, fullLabel) {
      const translationKey = `v2.target.short.${key}`;
      const shortLabel = t(translationKey);
      return shortLabel === translationKey ? fullLabel : shortLabel;
    }
    // Weapon and system rows of a Goblin-class unit (Legacy systems or catalog components).
    function renderSystems(host, state, unit) {
      const entry = state.systems.find(item => item.id === unit.id);
      if (unit.catalogSystems) { GoblinSpecialistsUI.renderSystemFacts(host, unit); return; }
      const weapons = entry?.summary.weapons || Object.fromEntries(Object.entries(unit.weapons || {}).map(([key, weapon]) => [key, weapon.ready]));
      for (const [key, count] of Object.entries(weapons)) {
        const raw = unit.ogreSystems?.weapons[key];
        const line = el('div', 'v2-system-row');
        const fullLabel = t(`v2.ui.weapon.${key}`);
        line.append(intelLabel(compactWeaponLabel(key, fullLabel), fullLabel), el('strong', '', raw
          ? `${Math.max(0, Math.min(raw.remaining, raw.count - raw.destroyed))}/${raw.count} · ${t('v2.ui.weaponDamage', {count: raw.destroyed})}` : String(count)));
        host.append(line);
      }
    }
    // Left column: own units with art, strength and whether they can still act this phase.
    function renderRoster(state, details) {
      at('#v2-roster-panel').hidden = !intelSections.roster;
      const ready = new Set(state.phase === 'player' && !state.gameOver ? readyUnitIds() : []);
      const own = state.units.filter(unit => unit.team === 'player');
      at('#v2-units-ready').textContent = t('v2.ui.unitsReady', {ready: ready.size, total: own.filter(unitAlive).length});
      const roster = at('#v2-units'); roster.replaceChildren();
      for (const unit of own) {
        const status = unitDead(unit) ? 'destroyed' : unit.disabled ? 'disabled' : unit.embarkedOn ? 'embarked' :
          ready.has(unit.id) ? 'ready' : state.phase === 'player' && !state.gameOver && !unit.move ? 'static' : 'done';
        const button = el('button', `v2-unit v2-unit-${status}`);
        button.type = 'button';
        const text = el('span', 'v2-unit-text');
        const sub = details(unit).filter(Boolean);
        if (status === 'destroyed' || status === 'disabled') sub.push(t(`v2.ui.${status}`));
        else if (status === 'ready' || status === 'static') sub.push(t(`v2.ui.unitState.${status}`));
        text.append(el('strong', '', unit.name), el('small', '', sub.join(' · ')));
        const mark = el('span', 'v2-unit-mark'); mark.setAttribute('aria-hidden', 'true');
        button.append(text, mark);
        addRosterArt(button, unit);
        button.setAttribute('aria-label', `${unit.name} · ${sub.join(' · ')}`);
        button.setAttribute('aria-pressed', String(unit.id === view.actorId));
        button.disabled = unitDead(unit);
        button.onclick = () => chooseActor(unit.id);
        roster.append(button);
      }
    }
    // Keep the previous unit/field preferences and default the two additional panels to visible.
    const intelSectionsKey = 'goblin.v2.intelSections';
    const intelSections = (() => {
      let stored;
      try { stored = JSON.parse(localStorage.getItem(intelSectionsKey)); } catch {}
      return Object.fromEntries(['roster','unit','field','legend'].map(key => [key,stored?.[key] !== false]));
    })();
    function setPanelVisible(key, visible) {
      if (!Object.hasOwn(intelSections,key)) return;
      intelSections[key] = !!visible;
      try { localStorage.setItem(intelSectionsKey, JSON.stringify(intelSections)); } catch {}
      render();
    }
    function statBar(label, value, max, className = '') {
      const row = el('div', `v2-intel-bar ${className}`.trim());
      const head = el('div', 'v2-intel-bar-head');
      head.append(el('span', '', label), el('strong', '', `${value} / ${max}`));
      const track = el('div', 'v2-intel-track');
      if (max <= 12) for (let index = 0; index < max; index++) track.append(el('i', index < value ? 'v2-on' : ''));
      else { const fill = el('i', 'v2-on v2-intel-fill'); fill.style.width = `${Math.round(100 * Math.max(0, value) / max)}%`; track.append(fill); }
      row.append(head, track);
      return row;
    }
    function statGrid(cells) {
      const grid = el('div', 'v2-intel-grid');
      for (const [label, value, share, tone, fullLabel] of cells) {
        const cell = el('div', `v2-intel-stat${tone ? ` v2-tone-${tone}` : ''}`);
        cell.append(intelLabel(label, fullLabel), el('strong', '', String(value)));
        if (share != null) { const track = el('div', 'v2-intel-meter'); const fill = el('i'); fill.style.width = `${Math.round(100 * share)}%`; track.append(fill); cell.append(track); }
        grid.append(cell);
      }
      return grid;
    }
    function libraryButton(kind, key, name) {
      const button = el('button', 'v2-icon-button v2-intel-help');
      button.type = 'button'; button.innerHTML = svgIcon('help');
      button.title = t('v2.intel.library', {name}); button.setAttribute('aria-label', button.title);
      button.onclick = () => globalThis.GoblinV2Flow?.openLibrary(kind, key);
      return button;
    }
    function renderFieldInfo(state, actor, terrainAt) {
      const intel = at('#v2-intel'); intel.replaceChildren();
      const focus = view.target || view.infoCell;
      const occupant = focus && state.units.find(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === focus.x && unit.y === focus.y);
      const unit = occupant || (unitAlive(actor) ? actor : null);
      const cell = focus || (unit && !unit.embarkedOn ? {x: unit.x, y: unit.y} : null);
      if (unit && intelSections.unit) {
        const section = el('section', 'v2-intel-section v2-intel-unit');
        const head = el('div', 'v2-intel-head');
        head.append(UnitVisuals.iconElement(unit, 'v2-intel-art'));
        const name = el('div', 'v2-intel-name');
        name.append(el('strong', '', unit.name), el('small', '', t(unit.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')));
        head.append(name, libraryButton('unit', unit.id, unit.name));
        section.append(head);
        const treads = unit.ogreSystems ? [unit.ogreSystems.treads, unit.ogreSystems.maxTreads] : unit.catalogSystems
          ? [unit.catalogSystems.treads, unit.catalogSystems.maxTreads] : unit.treads != null ? [unit.treads, unit.maxTreads] : null;
        if (treads) section.append(statBar(t('v2.ui.treads'), treads[0], treads[1], 'v2-intel-hp'));
        else if (Number.isFinite(unit.maxHp)) section.append(statBar(unit.infantry ? 'SP' : 'HP', unit.hp, unit.maxHp, 'v2-intel-hp'));
        if (unit.strategicMissile) section.append(statGrid([[t('v2.ui.missile'), unit.missilesRemaining ?? 0]]));
        const max = key => Math.max(1, ...state.units.map(item => item[key]).filter(Number.isFinite));
        const weaponKey = unit.selectedWeapon ?? unit.ogreSystems?.selectedWeapon;
        const weapon = (unit.weapons || unit.ogreSystems?.weapons)?.[weaponKey];
        const siegeWeapon = globalThis.GoblinSiegeWeapons?.weapons(unit)?.[unit.siegeWeapon];
        const catalog = globalThis.GoblinSpecialistsRuntime;
        const catalogSiege = unit.catalogFire?.ruleRef === 'siege-tank-fire-budget-v1';
        const catalogWeapon = (unit.catalogSystems || catalogSiege) ? catalog?.selectedSpec(unit) : null;
        const rangeWeaponName = catalogWeapon ? unit.catalogSystems ? catalog.slotLabel(unit,catalogWeapon.id) :
          GoblinSiegeWeapons.label(catalogWeapon.id) : weapon ? t(`v2.ui.weapon.${weaponKey}`) : siegeWeapon?.label;
        const compactRangeWeapon = weapon && !catalogWeapon ? compactWeaponLabel(weaponKey, rangeWeaponName) : rangeWeaponName;
        const weaponRange = (catalogWeapon ?? weapon ?? siegeWeapon)?.range;
        // A Goblin moves according to its remaining treads.
        const treadMove = treads && !unit.catalogSystems ? globalThis.GoblinSystems?.movementForTreads(treads[0]) : null;
        const value = key => key === 'range' && Number.isFinite(weaponRange) ? weaponRange :
          Number.isFinite(unit[key]) ? unit[key] : Number.isFinite(weapon?.[key]) ? weapon[key] : key === 'move' && Number.isFinite(treadMove) ? treadMove : null;
        section.append(statGrid(['attack', 'defense', 'range', 'move'].map(key =>
          [key === 'range' && rangeWeaponName ? t('v2.intel.weaponRange', {weapon:compactRangeWeapon}) : t(`v2.intel.${key}`),
            value(key) ?? '–', value(key) == null ? null : Math.min(1, value(key) / max(key)), null,
            key === 'range' && rangeWeaponName ? t('v2.intel.weaponRange', {weapon:rangeWeaponName}) : null])));
        const systems = el('div', 'v2-intel-systems'); systems.id = 'v2-systems';
        if (unit.ogreSystems || unit.catalogSystems || unit.weapons) renderSystems(systems, state, unit);
        if (systems.childElementCount) section.append(systems);
        const cargo = state.units.filter(item => item.embarkedOn === unit.id && unitAlive(item));
        if (unit.transportCapacity) section.append(el('p', 'v2-intel-cargo',
          `${t('v2.ui.cargo')} ${cargo.length ? cargo.map(item => item.name).join(', ') : '–'}`));
        if (unit.catalogId && globalThis.GoblinCatalogRuntime) section.append(el('p', 'v2-intel-facts', GoblinCatalogRuntime.summary(unit, state.units)));
        intel.append(section);
      }
      if (cell && intelSections.field) {
        const type = terrainAt(cell), rules = TerrainRules.get(type);
        const section = el('section', 'v2-intel-section v2-intel-field');
        const head = el('div', 'v2-intel-head');
        const tile = TerrainDisplay.icon(type, 'v2-intel-tile');
        if (tile) head.append(tile);
        const name = el('div', 'v2-intel-name');
        name.append(el('strong', '', TerrainDisplay.label(type)), el('small', '', `${t('v2.ui.sector')} ${hexLabel(cell)}`));
        head.append(name, libraryButton('terrain', type, TerrainDisplay.label(type)));
        section.append(head);
        for (const wreck of globalThis.UnitVisuals?.wrecksAt?.(cell.x, cell.y) ?? [])
          section.append(el('p', 'v2-intel-wreck', globalThis.UnitVisuals.wreckLabel(wreck)));
        const cost = TerrainRules.movementCost(type, unit && unit.team === 'player' ? unit : null);
        section.append(statGrid([[t('v2.intel.cover'), rules.cover ? `+${rules.cover}` : '±0', null, rules.cover ? 'good' : ''],
          [t('v2.intel.cost'), Number.isFinite(cost) ? cost : '–', null, Number.isFinite(cost) ? '' : 'bad'],
          [t('v2.intel.sight'), t(rules.blocksLos ? 'v2.intel.blocks' : 'v2.intel.clear'), null, rules.blocksLos ? 'warn' : '']]));
        intel.append(section);
      }
    }
    // Anchored cards prefer space next to the hex and away from units. Unanchored cards
    // share the fallback placement, which keeps the map controls clear.
    function targetObstacles() {
      return ['#v2-area-controls', '#v2-map-tools', '#v2-phase-notice', '#v2-roster-panel', '#v2-intel-panel', '#v2-area-legend', '#v2-training'].map(at);
    }
    function placeMapCard(card, anchorCell, others = [], keepClear = []) {
      card.style.left = '-9999px'; card.style.top = '0';
      card.style.maxHeight = ''; card.style.maxWidth = ''; card.style.overflowY = ''; card.style.visibility = '';
      card.dataset.scrollable = 'false';
      const inset = 8, frame = at('#v2-map').getBoundingClientRect();
      const leftEdge = Math.max(0,frame.left) + inset, rightEdge = Math.min(innerWidth,frame.right) - inset;
      const topEdge = Math.max(0,frame.top) + inset, bottomEdge = Math.min(innerHeight,frame.bottom) - inset;
      if (rightEdge <= leftEdge || bottomEdge <= topEdge) { card.style.visibility = 'hidden'; return; }
      if (card.getBoundingClientRect().width > rightEdge - leftEdge) card.style.maxWidth = `${rightEdge-leftEdge}px`;
      const box = card.getBoundingClientRect();
      const obstacles = targetObstacles();
      if (!anchorCell) obstacles.push(at('#v2-phase'));
      const reserved = obstacles.filter(node => node && node !== card && !node.hidden).map(node => node.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0);
      const screen = cell => { const point = nativeMap.createSVGPoint(); Object.assign(point, hexCenter(cell.x, cell.y)); return point.matrixTransform(nativeMap.getScreenCTM()); };
      const anchor = anchorCell && screen(anchorCell);
      const clear = keepClear.map(screen), units = others.map(screen);
      const w = box.width, h = box.height;
      const crossesX = (rect,x) => x < rect.right + inset && x + w > rect.left - inset;
      const hitsControl = (x,y) => reserved.some(rect => crossesX(rect,x) &&
        y < rect.bottom + inset && y + h > rect.top - inset);
      const clampX = x => Math.max(leftEdge, Math.min(x, rightEdge - w));
      const gap = anchor ? Math.max(26, Math.abs(screen({x: anchorCell.x, y: anchorCell.y + 1}).y - anchor.y) * .62) : 0;
      const centered = anchor && clampX(anchor.x - w / 2);
      const candidates = anchor ? [
        {x:centered,y:anchor.y-gap-h,pointer:'down'}, {x:centered,y:anchor.y+gap,pointer:'up'},
        {x:anchor.x+gap,y:anchor.y-h/2,pointer:''}, {x:anchor.x-gap-w,y:anchor.y-h/2,pointer:''}
      ] : [];
      const fits = blockers => candidates.find(({x,y}) => x>=leftEdge && y>=topEdge &&
        x+w<=rightEdge && y+h<=bottomEdge && !hitsControl(x,y) &&
        !blockers.some(point => point.x>=x-20 && point.x<=x+w+20 && point.y>=y-20 && point.y<=y+h+20));
      const placement = anchor && anchor.x >= frame.left && anchor.x <= frame.right && anchor.y >= frame.top && anchor.y <= frame.bottom
        ? fits([...clear, ...units]) || fits(clear) : null;
      let left = placement ? placement.x : clampX(frame.left + (frame.width - w) / 2);
      let top = placement ? placement.y : topEdge;
      if (!placement && (top + h > bottomEdge || hitsControl(left,top))) {
        const columns = [left, leftEdge, clampX(rightEdge), ...reserved.flatMap(rect =>
          [clampX(rect.left - inset - w), clampX(rect.right + inset)])];
        let best = {x:left,y:top,height:0,distance:Infinity};
        for (const x of columns) {
          const blockers = reserved.filter(rect => crossesX(rect,x));
          for (const y of [topEdge, ...blockers.map(rect => rect.bottom + inset)]) {
            if (y < topEdge || y >= bottomEdge || blockers.some(rect =>
              y > rect.top - inset && y < rect.bottom + inset)) continue;
            const bottom = Math.min(bottomEdge, ...blockers.filter(rect => rect.top - inset >= y)
              .map(rect => rect.top - inset));
            const height = Math.min(h, bottom - y);
            const distance = Math.hypot(x-left,y-top);
            if (height > best.height || height === best.height && distance < best.distance) best = {x,y,height,distance};
          }
        }
        if (best.height <= 0) { card.style.visibility = 'hidden'; return; }
        left = best.x; top = best.y;
        if (best.height < h) {
          card.style.maxHeight = `${best.height}px`;
          card.style.overflowY = 'auto';
          card.dataset.scrollable = 'true';
        }
      }
      card.dataset.placement = placement ? 'hex' : 'panel';
      card.dataset.pointer = placement?.pointer || '';
      card.style.left = `${left}px`; card.style.top = `${top}px`;
      if (anchor) card.style.setProperty?.('--v2-pointer-x', `${Math.round(anchor.x - left)}px`);
    }
    function placeNearHex(card, anchorCell, others, keepClear) {
      if (anchorCell) placeMapCard(card, anchorCell, others, keepClear);
    }
    function revealTargetControl(card, button) {
      if (!button || card.style?.overflowY !== 'auto' || !card.contains(button)) return;
      const bounds = card.getBoundingClientRect(), control = button.getBoundingClientRect();
      if (control.bottom > bounds.bottom) card.scrollTop += control.bottom - bounds.bottom;
      else if (control.top < bounds.top) card.scrollTop -= bounds.top - control.top;
    }
    const COMMAND_ICONS = {Move:'movement', Fire:'fire', PlayerFire:'fire', CatalogFire:'fire', CatalogHexFire:'fire', Ram:'ram', CatalogRam:'ram',
      Embark:'embark', CatalogLoad:'embark', Unload:'unload', CatalogDeploy:'unload', Engineer:'tool'};
    const commandIcon = command => command.type === 'SelectWeapon' ? 'fire' : COMMAND_ICONS[command.type] ?? (command.type.includes('Fire') ? 'fire' : 'action');
    const commandKey = entry => JSON.stringify(entry.command);
    const targetCache = {key: null, cells: new Map()};
    function entriesAt(state, actor, cell) {
      if (!actor || state.phase !== 'player' || state.gameOver || actor.disabled || !unitAlive(actor) ||
          globalThis.GoblinMovement?.busy() || GameDialogs.isOpen()) return [];
      const key = JSON.stringify([state.revision, state.turnPhase, GoblinLanguage.current]);
      if (targetCache.key !== key) { targetCache.key = key; targetCache.cells.clear(); }
      const position = JSON.stringify([actor.id, cell.x, cell.y]);
      if (!targetCache.cells.has(position)) targetCache.cells.set(position, targetCommands(state, actor, cell));
      return targetCache.cells.get(position);
    }
    function entryResult(entry) {
      return entry.result ??= query(entry.command);
    }
    function entryChance(entry, occupant) {
      if (Object.hasOwn(entry, 'chance')) return entry.chance;
      const chance = entryResult(entry).ok ? hitChance(previewFire(entry.command), occupant, entry.command.target?.kind === 'component') : null;
      entry.chance = chance;
      return chance;
    }
    const targetOccupant = (state, cell) => state.units.find(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === cell.x && unit.y === cell.y);
    function inspectTrainingTarget(actor, cell, phase) {
      const training = globalThis.GoblinTrainingRuntime;
      if (!training?.active() || !actor) return;
      const command = {type: phase === 'fire' ? 'Fire' : 'Move', actorId: actor.id, ...cell};
      training.inspect(command, query(command), phase === 'fire' ? previewFire(command) : null);
    }
    function hitChance(preview, target, component = false) {
      if (!preview) return null;
      if (preview.meaning === 'tread-roll-5-6') return {ratio: '5–6', hit: 2 / 6, destroy: null};
      const band = preview.ratioCategory === '5-1' ? Array(6).fill('X') : COMBAT_RULES.crt[preview.ratioCategory];
      const infantry = target?.infantry === true || target?.engineering === true || target?.type === 'infantry' || target?.id === 'infantry';
      const lastStep = !!target && (infantry ? Number(target.hp) <= 1 : target.disabled === true);
      if (band && component) {
        const destroy = band.filter(result => result === 'X').length / band.length;
        return {ratio: preview.ratioCategory.replace('-', ':'), hit: destroy, destroy};
      }
      return band ? {ratio: preview.ratioCategory.replace('-', ':'), hit: band.filter(result => result !== 'NE').length / 6,
        disable: target && !infantry && !target.disabled ? band.filter(result => result === 'D').length / 6 : null,
        destroy: band.filter(result => result === 'X' || result === 'D' && lastStep).length / 6} : null;
    }
    function trainingFirePreview(state) {
      const cell = view.target;
      if (state.scenario !== 'training-t02' || state.turnPhase !== 'fire' || !cell ||
          view.intentRevision !== state.revision || document.body.classList.contains('v2-screen-open')) return null;
      const actor = state.units.find(unit => unit.id === view.actorId);
      const entry = entriesAt(state,actor,cell).find(option => option.command.type === 'Fire' && entryResult(option).ok);
      return entry ? entryChance(entry,targetOccupant(state,cell)) : null;
    }
    function targetMenuRows(entries) {
      const groups = new Map();
      const labels = {embark:'v2.ui.embark', unload:'v2.ui.unload', movement:'v2.ui.move'};
      for (const entry of entries) {
        const command = entry.command, icon = commandIcon(command);
        const indirect = command.mode === 'indirect';
        const key = indirect ? 'indirect' : icon === 'fire'
          ? JSON.stringify([command.type, command.weaponKey, command.weaponId, command.mode])
          : JSON.stringify([command.type, command.job, command.option]);
        if (!groups.has(key)) groups.set(key, {
          icon: indirect ? 'indirect' : entry.attack?.icon ?? icon,
          label: indirect ? t('v2.ui.artillery.indirect') : entry.attack?.name ??
            (icon === 'tool' ? entry.label.split(' · ')[0] : labels[icon] ? t(labels[icon]) : entry.label),
          entries: []
        });
        groups.get(key).entries.push(entry);
      }
      const leaves = options => options.map(entry => ({
        entry, icon: entry.attack?.icon ?? commandIcon(entry.command),
        label: entry.componentLabel ? [entry.attack?.shortName ?? entry.attack?.name, entry.componentLabel].filter(Boolean).join(' · ')
          : entry.attack?.shortName ?? entry.attack?.name ?? entry.label
      }));
      const branch = (label, icon, children, choice) => ({label, icon, children, choice});
      const rows = [];
      for (const group of groups.values()) {
        const first = group.entries[0];
        const observers = new Map();
        for (const entry of group.entries) {
          const id = entry.command.spotterId;
          if (!observers.has(id)) observers.set(id, []);
          observers.get(id).push(entry);
        }
        const components = !!first.componentLabel;
        let choices = leaves(group.entries);
        if (observers.size > 1) choices = [...observers.values()].flatMap(options => options.length === 1 ? leaves(options) :
          [branch(options[0].attack?.name ?? options[0].weaponLabel, group.icon, leaves(options), 'v2.target.componentChoice')]);
        const choice = observers.size > 1 ? 'v2.target.observerChoice' : components ? 'v2.target.componentChoice' : 'v2.target.detailChoice';
        if (choices.length > 1 && groups.size > 1) {
          rows.push(branch(group.label, group.icon, choices, choice));
        } else rows.push(...choices);
      }
      return rows;
    }

    function missileWarning(state, entry, cell) {
      const strike = globalThis.StrategicMissile.STRIKE;
      const affected = state.units.filter(unit => unitAlive(unit) && !unit.embarkedOn &&
        (entry.command.type !== 'CatalogHexFire' || unit.team === 'player') && dist(unit, cell) <= strike.radius)
        .map(unit => unit.name + ' (' + t(unit.team === 'player' ? 'ui.team.player' : 'ui.team.enemy') + ')');
      return [t('v2.ui.missileSplash'), t('v2.ui.missileImpact',{direct:strike.directAttack,adjacent:strike.splashAttack}),
        affected.join(', ')].filter(Boolean).join(' · ');
    }

    function targetFireChance(entry, occupant, details) {
      if (entry.command.type !== 'CatalogHexFire') return entryChance(entry, occupant);
      const attack = entryResult(entry).weapon?.attack;
      if (!occupant || !Number.isFinite(attack)) return null;
      if (!occupant.catalogSystems) return hitChance({ratioCategory:combatRatio(attack, effectiveDefense(occupant))}, occupant);
      const rules = GoblinSpecialistsRuntime.registry();
      const component = GoblinSystems.catalogChooseTarget(occupant.catalogSystems, rules);
      if (!component) return null;
      details.push(t('v2.target.componentChoice') + ' · ' + GoblinSpecialistsRuntime.slotLabel(occupant, component.id));
      if (component.type === 'treads') return hitChance({meaning:'tread-roll-5-6'}, occupant, true);
      const defense = component.defense + TerrainRules.coverBonus(terrainTypeAt(occupant.x, occupant.y));
      return hitChance({ratioCategory:combatRatio(attack, defense)}, occupant, true);
    }

    function targetRowFacts(entry, state, actor, occupant) {
      const command = entry.command, result = entryResult(entry);
      const details = [], metrics = [];
      if (command.type === 'Move' && result.path) {
        details.push(t('v2.ui.pathSteps', {count:result.path.length}));
        const cost = core() ? result.cost : result.path.reduce((sum, step) => sum + movementCost(units.find(unit => unit.id === actor.id), step.x + ',' + step.y), 0);
        if (Number.isFinite(cost)) {
          const points = t('v2.ui.movePoints', {cost});
          details.push(GoblinLanguage.translate('MOVE COST') + ' ' + points);
          metrics.push(points);
        }
      }
      if (command.type === 'Engineer') {
        if (result.cost) { details.push(t('v2.engineer.cost', {cost:result.cost})); metrics.push('−' + result.cost); }
        if (result.materialGain) {
          details.push(t('v2.engineer.gain', {gain:result.materialGain})); metrics.push('+' + result.materialGain);
          const wreck = state.units.find(unit => unitDead(unit) && !unit.salvaged && !unit.embarkedOn &&
            GoblinSpecialistsRuntime.wreckKey(unit) === command.target.wreckId);
          if (wreck) details.push(wreck.name);
        }
      }
      if (Number.isSafeInteger(entry.attack?.shots)) details.push(t('v2.target.shotsLeft', {count:entry.attack.shots}));
      if (command.type !== 'SelectWeapon' && commandIcon(command) === 'fire') {
        const chance = targetFireChance(entry, occupant, details);
        if (chance) {
          const percent = value => Math.round(value * 100);
          details.push(t('v2.training.previewRatio', {ratio:chance.ratio}), t('v2.target.hit', {percent:percent(chance.hit)}));
          metrics.push(t('v2.target.hitShort', {percent:percent(chance.hit)}));
          if (chance.disable != null) details.push(t('v2.target.disable', {percent:percent(chance.disable)}));
          if (chance.destroy != null) {
            details.push(t('v2.target.destroyChance', {percent:percent(chance.destroy)}));
            metrics.push(t('v2.target.destroyShort', {percent:percent(chance.destroy)}));
          }
        }
      }
      return {details, metrics};
    }

    function renderTargetCard(state, actor) {
      const card = at('#v2-target-card'), cell = view.target;
      const intel = at('#v2-intel-panel');
      card.replaceChildren();
      card.hidden = !cell || !actor || view.intentRevision !== state.revision || GameDialogs.isOpen() ||
        document.body.classList.contains('v2-screen-open') || !!globalThis.GoblinMovement?.busy();
      if (card.hidden) {
        if (intel && card.parentElement === intel) shell.append(card);
        return;
      }
      const occupant = targetOccupant(state, cell);
      const entries = entriesAt(state, actor, cell);
      const legal = entries.filter(entry => entryResult(entry).ok);
      const rows = targetMenuRows(legal);
      if (occupant?.team === 'player' && occupant.id !== actor.id) rows.push({
        label: t('v2.target.selectUnit', {name:occupant.name}), icon: 'action', select: occupant.id
      });
      const blocked = view.afterWeaponSwitch ? entries.find(entry => entry.command.type === 'PlayerFire' && !entryResult(entry).ok) : null;
      if (!rows.length && !blocked) {
        card.hidden = true;
        if (intel && card.parentElement === intel) shell.append(card);
        return;
      }

      const location = [occupant?.name, hexLabel(cell)].filter(Boolean).join(' · ');
      let page = rows;
      let componentPage = false;
      for (const index of view.targetBranch ?? []) {
        componentPage = page[index]?.choice === 'v2.target.componentChoice';
        page = page[index]?.children ?? page;
      }
      componentPage ||= page.some(row => row.entry?.componentLabel);
      const title = el('strong', componentPage ? '' : 'v2-sr', location);
      title.id = 'v2-target-title';
      card.append(title);

      const warning = legal.find(entry => entry.confirmSplash);
      if (warning) card.append(el('p', 'v2-target-warning', missileWarning(state, warning, cell)));
      if (blocked) card.append(el('p', 'v2-target-blocked', entryResult(blocked).reason));
      for (const entry of entries.filter(option => option.transport && !entryResult(option).ok)) {
        const cargo = entry.command.type === 'CatalogDeploy' && state.units.find(unit => unit.id === entry.command.cargoId);
        const reason = cargo?.embarkedThisTurn ? t('v2.reject.catalog.sameTurn') : entryResult(entry).reason;
        card.append(el('p', 'v2-target-blocked', [entry.label, reason].filter(Boolean).join(' · ')));
      }
      const compare = page.filter(row => row.entry && commandIcon(row.entry.command) === 'fire' && row.entry.command.type !== 'SelectWeapon').length > 1;
      const list = el('div', compare ? 'v2-target-choices v2-target-compare' : 'v2-target-choices');
      for (const [index, row] of page.entries()) {
        const {entry, children, select} = row;
        const button = el('button', 'v2-target-row');
        button.type = 'button';
        button.disabled = !!view.busy;
        const facts = entry ? targetRowFacts(entry, state, actor, occupant) : {details:[], metrics:[]};
        const description = [
          entry && commandIcon(entry.command) === 'fire' && entry.command.type !== 'SelectWeapon' ? t('v2.target.attack') : '',
          entry && actor.name, entry?.label ?? row.label, entry?.singleWeapon, location, ...facts.details,
          entry?.confirmSplash && missileWarning(state, entry, cell),
          children ? t('v2.target.openChoice', {choice:t(row.choice)}) :
            entry?.command.type === 'SelectWeapon' ? t('v2.target.switchOnly') :
            entry?.confirmSplash ? t('v2.target.splashReview') : t('v2.target.executeRow')
        ].filter(Boolean).join(' · ');
        button.title = description;
        button.setAttribute('aria-label', description);
        const name = el('span', 'v2-target-row-name');
        name.append(Object.assign(el('span', 'v2-action-icon'), {innerHTML:svgIcon(row.icon)}), el('span', '', row.label));
        if (entry?.attack?.shots > 1) name.append(el('span', 'v2-weapon-budget', String(entry.attack.shots)));
        const metrics = el('span', 'v2-target-row-metrics', facts.metrics.join(' · '));
        const cue = el('span', 'v2-target-row-cue', children || entry?.confirmSplash ? '›' : '✓');
        cue.setAttribute('aria-hidden', 'true');
        button.append(name, metrics, cue);
        if (entry && index === 0) button.id = 'v2-action-execute';
        if (entry && commandIcon(entry.command) === 'fire' && entry.command.type !== 'SelectWeapon' && !entry.confirmSplash) {
          button.onpointerenter = button.onfocus = () => {
            if (view.target !== cell || view.intentRevision !== state.revision) return;
            view.targetOption = commandKey(entry);
            renderAreaPreview(state, actor);
          };
        }
        button.onclick = () => {
          if (children) {
            view.targetBranch = [...(view.targetBranch ?? []), index];
            view.targetOption = null;
            render(); focusTargetCard();
          } else if (select) chooseActor(select);
          else runCommand(state, entry, cell, state.revision);
        };
        list.append(button);
      }
      card.append(list);
      card.dataset.components = String(componentPage);
      positionTargetCard(card, cell, state, actor, occupant);
    }
    function positionTargetCard(card, cell, state, actor, occupant) {
      const intel = at('#v2-intel-panel');
      const dock = card.dataset.components === 'true' && window.matchMedia('(min-width: 851px) and (min-height: 501px)').matches;
      if (dock) {
        if (card.parentElement !== intel) intel.append(card);
        card.dataset.pointer = '';
        card.style.removeProperty('left');
        card.style.removeProperty('top');
        card.style.removeProperty('max-height');
        card.style.removeProperty('overflow-y');
        return;
      }
      if (intel && card.parentElement === intel) shell.append(card);
      placeNearHex(card, cell, state.units.filter(unit => unitAlive(unit) && !unit.embarkedOn && unit.id !== actor.id && unit !== occupant), [actor]);
    }
    function renderTargetBlast(overlay, state, actor) {
      const target = view.target;
      if (!target || view.intentRevision !== state.revision || document.body.classList.contains('v2-screen-open')) return;
      const entry = entriesAt(state, actor, target).find(option => option.confirmSplash && entryResult(option).ok);
      if (!entry) return;
      const footprint = entryResult(entry).footprint ?? [target, ...hexNeighbors(target.x, target.y)
        .filter(cell => cell.x >= 0 && cell.x < W && cell.y >= 0 && cell.y < H)];
      for (const [index, cell] of footprint.entries()) {
        const shape = document.createElementNS(NS, 'polygon');
        shape.setAttribute('points', hexPoints(cell.x, cell.y));
        shape.classList.add('v2-full-blast', index === 0 ? 'v2-full-blast-center' : 'v2-full-blast-adjacent');
        shape.setAttribute('aria-hidden', 'true');
        overlay.append(shape);
      }
    }
    function focusTargetCard() {
      const button = at('#v2-action-execute') || at('#v2-target-card button:not(:disabled)');
      if (!button) return;
      button.focus({preventScroll:true});
      revealTargetControl(at('#v2-target-card'), button);
    }
    async function runCommand(state, entry, target = view.target, expectedRevision = view.intentRevision) {
      const {command, confirmSplash} = entry;
      const cell = view.target;
      if (!cell || target !== cell || expectedRevision !== view.intentRevision || expectedRevision !== revision() || !query(command).ok) return;
      if (confirmSplash) {
        const accepted = await GameDialogs.confirm({id:'v2-splash-confirm',title:t('v2.ui.missile'),
          message:[t('v2.ui.sector') + ' ' + hexLabel(cell), missileWarning(state, entry, cell), t('v2.ui.missileCancel')].join(' · '),
          acceptLabel:t('ui.hud.intent.confirm'),cancelLabel:t('ui.dialog.cancel')});
        if (!accepted || view.target !== cell || expectedRevision !== revision() || !query(command).ok) { render(); return; }
      }
      const result = dispatch(command, expectedRevision, true);
      if (result.ok) {
        clearContext();
        if (command.type === 'SelectWeapon') {
          view.target = cell; view.afterWeaponSwitch = true; view.intentRevision = revision();
        }
      }
      if (result.ok && command.type !== 'SelectWeapon' && view.autoSelectReady) selectReadyActor(project(), true);
      view.message = result.ok ? '' : result.reason;
      render();
      if (result.ok && command.type === 'SelectWeapon') focusTargetCard();
      else if (result.ok && !at('#v2-phase-notice')?.open) at('#v2-map').focus({preventScroll:true});
    }
    function chooseActor(id, toggle = true) {
      startZoomPending = null;
      const roster = core() ? IronDustBrowserV2.view.units : globalThis.GoblinCatalogFullRuntime?.active() ? GoblinCatalogFullRuntime.roster() : units;
      const unit = roster.find(item => item.id === id && (!toggle || item.id !== view.actorId) && item.team === 'player' && unitAlive(item));
      view.actorId = unit?.id || null;

      if (unit) { view.focusCell = {x:unit.x,y:unit.y}; view.infoCell = view.focusCell; }
      clearContext(); render();
      if (unit) globalThis.GoblinTrainingRuntime?.select(unit.id);
    }
    function focusUnit(id) {
      const unit = (core() ? project().units : globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units).find(item => item.id === id && unitAlive(item));
      if (!unit) return;
      if (unit.team === 'player') chooseActor(id, false);
      else {
        view.actorId = null; view.focusCell = { x: unit.x, y: unit.y };
        view.infoCell = { ...view.focusCell }; clearContext(); render();
      }
      at('#v2-map').focus({ preventScroll: true });
      const hex = unit && nativeMap.querySelector(`.hex[data-x="${unit.x}"][data-y="${unit.y}"]`);
      centerOnHex(hex);
    }
    function chooseHex(x, y) {
      startZoomPending = null;
      const state = project(), cell = {x,y};
      const unit = targetOccupant(state, cell), actor = state.units.find(item => item.id === view.actorId);
      if (unit && unit === actor) { chooseActor(unit.id); return; }
      const entries = entriesAt(state, actor, cell);
      const available = entries.some(entry => entryResult(entry).ok);
      const blockedTransport = !available && entries.find(entry => entry.transport);
      if (!available && unit?.team === 'player') { chooseActor(unit.id); return; }
      clearContext(); view.infoCell = cell; view.focusCell = cell;
      inspectTrainingTarget(actor, cell, state.turnPhase);
      if (available) { view.target = cell; view.intentRevision = state.revision; }
      else view.actorId = null;
      if (blockedTransport) view.message = entryResult(blockedTransport).reason;
      render();
      if (available) focusTargetCard();
    }
    const areaCache = { key: null, actors: new Map() };
    let areaPhase = null;
    let fireZoomPhase = null;
    let startZoomMission = null, startZoomPending = null;
    function syncAreaPhase(state) {
      const key = `${state.phase}:${state.turnPhase}`;
      if (areaPhase !== key) {
        if (areaPhase !== null) clearContext();
        areaPhase = key;
        if (view.autoSelectReady) selectReadyActor(state);
      }
    }
    function activeAreaMode(state) {
      if (view.areaMode === 'none') return null;
      return view.areaMode || (state.turnPhase === 'fire' ? 'fire' :
        state.turnPhase === 'movement' || state.turnPhase === 'gev' ? 'movement' : null);
    }
    function areaQuery(command) {
      if (!core()) return query(command);
      const result = IronDustBrowserV2.query(command);
      return result.available ? { ok: true, ...result } :
        { ok: false, reason: IronDustBrowserV2.formatError(result.error?.code) };
    }
    function areaData(state, actor, mode) {
      const data = { legal: [], blocked: [], status: '', reason: '' };
      if (!actor) { data.status = 'select'; return data; }
      if (state.phase !== 'player' || state.gameOver) { data.status = 'phase'; return data; }
      if (actor.disabled || unitDead(actor)) { data.status = 'unavailable'; data.reason = t('v2.ui.disabled'); return data; }
      const runtime = core() ? actor : units.find(unit => unit.id === actor.id);
      if (mode === 'movement') {
        if (state.turnPhase !== 'movement' && state.turnPhase !== 'gev') { data.status = 'phase'; return data; }
        if (runtime.embarkedOn) { data.status = 'unavailable'; data.reason = t('ui.error.UNIT_EMBARKED'); return data; }
        if (!core() && state.turnPhase === 'movement') {
          const neighbors = hexNeighbors(actor.x, actor.y).filter(cell => cell.x >= 0 && cell.x < W && cell.y >= 0 && cell.y < H);
          data.load = neighbors.filter(cell => entriesAt(state, actor, cell).some(entry =>
            commandIcon(entry.command) === 'embark' && entryResult(entry).ok));
          if (actor.transportCapacity || actor.droneBays) data.unload = neighbors.filter(cell => entriesAt(state, actor, cell).some(entry =>
            commandIcon(entry.command) === 'unload' && entryResult(entry).ok));
        }
        const transport = data.load?.length || data.unload?.length;
        if (state.turnPhase === 'movement' && runtime.moved || state.turnPhase === 'gev' && runtime.secondMoved) {
          data.status = transport ? 'move' : 'moveSpent';
          return data;
        }
        const width = core() ? Math.max(...state.cells.map(cell => cell.x)) + 1 : W;
        const height = core() ? Math.max(...state.cells.map(cell => cell.y)) + 1 : H;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if (x === actor.x && y === actor.y || state.units.some(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === x && unit.y === y)) continue;
          const result = core() ? areaQuery({ type: 'Move', playerId: 'player', unitId: actor.id, to: { x, y } }) :
            areaQuery({ type: 'Move', actorId: actor.id, x, y });
          if (result.ok) data.legal.push({ x, y, cost: core() ? result.cost :
            result.path.reduce((sum, step) => sum + movementCost(runtime, `${step.x},${step.y}`), 0) });
        }
        data.status = data.legal.length || transport ? 'move' : 'blocked';
        return data;
      }
      if (mode === 'fire' && state.turnPhase !== 'fire') { data.status = 'phase'; return data; }
      if (mode === 'los' && core() && state.turnPhase !== 'fire') {
        data.status = 'unavailable'; data.reason = t('v2.area.coreSightLimit'); return data;
      }
      if (mode === 'los' && !core()) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (x !== actor.x || y !== actor.y)
            (lineOfSight(runtime, { x, y }) ? data.legal : data.blocked).push({ x, y });
        }
        data.status = 'sight';
        return data;
      }
      if (globalThis.GoblinSpecialistsRuntime?.rules?.(actor)?.missileRuleRef || runtime?.strategicMissile) {
        const type = globalThis.GoblinCatalogFullRuntime?.active() ? 'CatalogHexFire' : 'Fire';
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const result = areaQuery({type, actorId:actor.id, x, y});
          if (result.ok) data.legal.push({x,y});
        }
        data.status = data.legal.length ? 'fire' : 'blocked'; return data;
      }
      for (const target of state.units.filter(unit => unit.team === 'enemy' && unitAlive(unit) && !unit.embarkedOn)) {
        const options = entriesAt(state, actor, {x:target.x,y:target.y}).filter(entry => entry.command.type !== 'SelectWeapon');
        if (options.some(entry => entryResult(entry).ok)) data.legal.push({x:target.x,y:target.y});
        else if (mode === 'fire') data.blocked.push({x:target.x,y:target.y,reason:options[0] && entryResult(options[0]).reason});
      }
      data.status = mode === 'los' ? 'coreSight' :
        data.legal.length ? 'fire' : 'blocked';
      data.reason = mode === 'fire' && !data.legal.length ? t('v2.area.noLegalTarget') : '';
      return data;
    }
    function selectedFirePreview(state, actor, mode, legal) {
      if (mode !== 'fire' || !actor || !view.target) return null;
      const target = state.units.find(unit => unit.team === 'enemy' && unitAlive(unit) &&
        !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
      if (!target || !legal.some(cell => cell.x === target.x && cell.y === target.y)) return null;
      const options = entriesAt(state, actor, view.target).filter(entry => commandIcon(entry.command) === 'fire' && entry.command.type !== 'SelectWeapon' && entryResult(entry).ok);
      const chosen = options.find(entry => commandKey(entry) === view.targetOption) ?? (options.length === 1 ? options[0] : null);
      const preview = chosen ? previewFire(chosen.command) : null;
      const weaponKey = chosen?.command.weaponKey ?? chosen?.command.weaponId ??
        (chosen?.command.type === 'FireArtillery' ? entryResult(chosen).weapon?.key : null);
      return preview?.legal && ['crt-attack-effective-defense','tread-roll-5-6'].includes(preview.meaning) &&
        preview.profileId === state.profile && preview.stateRevision === state.revision &&
        preview.actorId === actor.id && preview.targetId === target.id &&
        preview.weaponKey === weaponKey && preview.from?.x === actor.x &&
        preview.from?.y === actor.y && preview.to?.x === target.x &&
        preview.to?.y === target.y ? preview : null;
    }
    function planningWeapons(actor, runtime, turn) {
      const weaponName = key => t('v2.ui.weapon.' + key);
      if (actor.ogreSystems) {
        return Object.entries(actor.ogreSystems.weapons).filter(([, weapon]) =>
          weapon.count > weapon.destroyed && (!weapon.expendable || weapon.remaining > 0)).map(([key, weapon]) =>
          ({name:weaponName(key), range:weapon.range, ready:GoblinSystems.weaponReady(weapon)}));
      }
      if (runtime.strategicMissile || actor.cruiseMissile) {
        return [{name:t('v2.ui.missile'), range:runtime.range,
          ready:!runtime.fired && (actor.cruiseMissile ? runtime.ammunition > 0 : runtime.missilesRemaining > 0)}];
      }
      const specialists = globalThis.GoblinSpecialistsRuntime;
      if (!core() && specialists?.active()) {
        const rules = specialists.rules(runtime);
        return specialists.weapons(runtime).filter(weapon => {
          const slot = actor.catalogSystems?.components.find(component => component.id === weapon.id);
          return !slot?.destroyed && !slot?.spent;
        }).map(weapon => ({
          name: actor.catalogSystems ? specialists.slotLabel(runtime, weapon.id) :
            rules.fireRuleRef === 'siege-tank-fire-budget-v1' ? GoblinSiegeWeapons.label(weapon.id) :
            t(rules.fireRuleRef === 'artillery-spotter-v1' ? 'v2.plan.artillery' : 'v2.plan.standardWeapon'),
          range:weapon.range, ready:weapon.ready && (rules.cargoRef !== 'drone-cargo-v1' || (runtime.droneReadyTurn ?? 1) <= turn)
        }));
      }
      const options = globalThis.GoblinSiegeWeapons?.weapons(runtime) ?? globalThis.GoblinArtilleryWeapons?.weapons(runtime);
      if (options) return Object.values(options).map(weapon => ({name:weapon.label, range:weapon.range, ready:weapon.ready}));
      return [{name:t('v2.plan.standardWeapon'), range:runtime.range, ready:!runtime.fired}];
    }
    function planningArea(state, actor, mode) {
      if (!unitAlive(actor) || actor.embarkedOn || !['movement', 'fire'].includes(mode)) return null;
      const isCore = core(), runtime = isCore ? actor : units.find(unit => unit.id === actor.id);
      const cells = isCore ? state.cells : Array.from({length:W * H}, (_, i) => ({x:i % W,y:Math.floor(i / W)}));
      if (mode === 'fire') {
        const weapons = planningWeapons(actor, runtime, state.turn).filter(weapon => Number.isFinite(weapon.range) && weapon.range > 0);
        const ready = actor.disabled ? [] : weapons.filter(weapon => weapon.ready);
        const weapon = (ready.length ? ready : weapons).reduce((best, item) => !best || item.range > best.range ? item : best, null);
        if (!weapon) return {cells:[], label:t('v2.plan.noWeapon')};
        return {cells:cells.filter(cell => dist(actor, cell) > 0 && dist(actor, cell) <= weapon.range),
          label:t(ready.length ? 'v2.plan.fire' : 'v2.plan.fireSpent', weapon)};
      }
      const secondary = state.turnPhase === 'gev' && (isCore ? actor.id === 'gev' : isGevUnit(runtime));
      const budget = isCore ? secondary ? 2 : actor.treads == null ? actor.move : GoblinSystems.movementForTreads(actor.treads) :
        movementBudget(runtime, secondary);
      const label = t(secondary ? 'v2.plan.skimmer' : 'v2.plan.movement', {budget:budget ?? 0});
      if (!(budget > 0)) return {cells:[], label};
      // A terrain-only search never reads occupants or queries a hypothetical command.
      const key = cell => cell.x + ',' + cell.y;
      const board = new Map(cells.map(cell => [key(cell), cell]));
      const start = key(actor), best = new Map([[start, 0]]), pending = [{x:actor.x,y:actor.y,cost:0}];
      const mover = isCore && actor.id === 'gev' ? {...actor,movementMode:'gev'} : runtime;
      while (pending.length) {
        const from = pending.pop();
        if (from.cost !== best.get(key(from))) continue;
        for (const to of hexNeighbors(from.x, from.y)) {
          const position = key(to), cell = board.get(position);
          if (!cell) continue;
          const cost = from.cost + (isCore ? TerrainRules.movementCost(cell.type, mover) : movementCost(mover, position));
          if (cost > budget || cost >= (best.get(position) ?? Infinity)) continue;
          best.set(position, cost);
          pending.push({...to,cost});
        }
      }
      return {cells:cells.filter(cell => key(cell) !== start && best.has(key(cell))), label};
    }
    function freeRatioChipCenter(from, to, width, height, pixelScale, state) {
      const box = nativeMap.viewBox.baseVal;
      const pins = globalThis.M1UnitMarkers?.obstacles(state.markers,{targetsVisible:view.targetsVisible}) || [];
      const occupied = [...state.units.filter(unit => !unit.embarkedOn), view.focusCell]
        .filter(cell => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
        .map(cell => hexCenter(cell.x, cell.y));
      const clearance = S + 10 + 6 / pixelScale;
      for (const fraction of [0.5, 0.375, 0.625, 0.25, 0.75]) {
        const x = from.x + (to.x - from.x) * fraction;
        const y = from.y + (to.y - from.y) * fraction;
        if (x - width / 2 < box.x || x + width / 2 > box.x + box.width ||
            y - height / 2 < box.y || y + height / 2 > box.y + box.height) continue;
        if (pins.some(pin => x+width/2+6/pixelScale>pin.left && x-width/2-6/pixelScale<pin.right &&
            y+height/2+6/pixelScale>pin.top && y-height/2-6/pixelScale<pin.bottom)) continue;
        if (occupied.every(center => Math.abs(x - center.x) >= width / 2 + clearance ||
            Math.abs(y - center.y) >= height / 2 + clearance)) return {x, y};
      }
      return null;
    }
    // Outline of a range: hex sides that belong to exactly one cell of the area.
    function areaEdge(cells, kind) {
      const sides = new Map();
      for (const cell of cells) {
        const corners = hexPoints(cell.x, cell.y).split(' ');
        corners.forEach((corner, index) => {
          const ends = [corner, corners[(index + 1) % corners.length]];
          const key = ends.map(end => end.split(',').map(value => Number(value).toFixed(1)).join(',')).sort().join('|');
          sides.set(key, sides.has(key) ? null : ends);
        });
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', [...sides.values()].filter(Boolean).map(([from, to]) => `M${from}L${to}`).join(''));
      path.classList.add('v2-area-edge', `v2-area-edge-${kind}`);
      return path;
    }
    // Own units that already acted this phase are drawn brighter (legacy marks them in game.js).
    function syncActedUnits(state) {
      if (!core()) return;
      const open = new Set(state.phase === 'player' && !state.gameOver ? readyUnitIds() : []);
      for (const group of nativeMap.querySelectorAll('.unit-svg[data-unit-id]')) {
        const unit = state.units.find(item => item.id === group.dataset.unitId);
        group.classList.toggle('acted-unit', !!unit && unit.team === 'player' && unitAlive(unit) && !unit.disabled &&
          state.phase === 'player' && !state.gameOver && !open.has(unit.id));
      }
    }
    function renderAreaPreview(state, actor) {
      syncActedUnits(state);
      const mode = activeAreaMode(state);
      for (const button of at('#v2-area-controls').querySelectorAll('[data-area]')) {
        const key = button.dataset.area;
        button.title = t(`v2.overlayHint.${key}`); button.setAttribute('aria-label', t(`v2.area.${key}`));
        button.setAttribute('aria-pressed', String(mode === key));
      }
      const gridButton = at('#v2-area-grid');
      gridButton.title = t('v2.overlayHint.grid'); gridButton.setAttribute('aria-label', t('v2.area.grid'));
      gridButton.setAttribute('aria-pressed', String(view.gridVisible));
      for(const [key,label] of [['targets','missionTargets'],['damage','damage']]){
        const button=at(`#v2-area-${key}`);
        button.title=t(`v2.overlayHint.${key}`);
        button.setAttribute('aria-label',t(`v2.display.${label}`));
        button.setAttribute('aria-pressed',String(view[`${key}Visible`]));
      }
      at('#v2-display-toggle').textContent=t('v2.display.group');
      at('#v2-display-controls').setAttribute('aria-label',t('v2.display.group'));
      displayControls.update();
      at('#v2-area-controls').setAttribute('aria-label', t('v2.area.controls'));
      const nativeGrid = document.querySelector('#grid-toggle');
      nativeGrid.setAttribute('aria-pressed', String(view.gridVisible));
      nativeGrid.classList.toggle('active', view.gridVisible);
      let grid = nativeMap.querySelector('#v2-grid-overlay');
      if (view.gridVisible) {
        if (!grid) { grid = document.createElementNS(NS, 'g'); grid.id = 'v2-grid-overlay';
          grid.setAttribute('pointer-events', 'none'); nativeMap.insertBefore(grid, nativeMap.querySelector('.unit-svg,#v2-team-markers')); }
        if (!grid.childElementCount) {
          const cells = core() ? state.cells : Array.from({ length: W * H }, (_, index) => ({ x: index % W, y: Math.floor(index / W) }));
          for (const cell of cells) { const shape = document.createElementNS(NS, 'polygon');
            shape.setAttribute('points', hexPoints(cell.x, cell.y)); shape.classList.add('v2-grid-line'); grid.append(shape); }
        }
      } else grid?.remove();
      let overlay = nativeMap.querySelector('#v2-area-overlay');
      if (!overlay) { overlay = document.createElementNS(NS, 'g'); overlay.id = 'v2-area-overlay';
        overlay.setAttribute('pointer-events', 'none'); nativeMap.insertBefore(overlay, nativeMap.querySelector('.unit-svg,#v2-team-markers')); }
      overlay.replaceChildren();
      const legend = at('#v2-area-legend');
      legend.hidden = !intelSections.legend;
      if (!mode || document.body.classList.contains('v2-screen-open')) {
        renderTargetBlast(overlay, state, actor);
        legend.textContent = '';
        return;
      }
      const key = JSON.stringify([core(), state.revision, state.phase, state.turnPhase,
        mode, GoblinLanguage.current, !!globalThis.GoblinMovement?.busy(), GameDialogs.isOpen()]);
      if (areaCache.key !== key) { areaCache.key = key; areaCache.actors.clear(); }
      const actorId = actor?.id ?? null;
      if (!areaCache.actors.has(actorId)) areaCache.actors.set(actorId, areaData(state, actor, mode));
      const data = areaCache.actors.get(actorId);
      const hexWidth = Math.sqrt(3) * S;
      const referenceScale = hexWidth / 112;
      const mapWidth = nativeMap.getBoundingClientRect().width || nativeMap.clientWidth ||
        Number.parseFloat(nativeMap.style.width) || nativeMap.viewBox.baseVal.width;
      const pixelScale = mapWidth / nativeMap.viewBox.baseVal.width;
      function mark(cell, kind) {
        const shape = document.createElementNS(NS, 'polygon');
        shape.setAttribute('points', hexPoints(cell.x, cell.y)); shape.classList.add(`v2-area-${kind}`);
        shape.dataset.x = String(cell.x); shape.dataset.y = String(cell.y);
        overlay.append(shape);
      }
      const areaKind = mode === 'movement' ? 'movement' : mode === 'fire' ? 'fire' : 'sight';
      if (!Object.hasOwn(data, 'plan')) data.plan = globalThis.GoblinMovement?.busy() ? null : planningArea(state, actor, mode);
      for (const cell of data.legal) mark(cell, areaKind);
      for (const cell of data.load ?? []) mark(cell, 'load');
      for (const cell of data.unload ?? []) mark(cell, 'unload');
      if (data.legal.length) overlay.append(areaEdge(data.legal, areaKind));
      if (data.plan?.cells.length) overlay.append(areaEdge(data.plan.cells, 'plan'));
      if (mode !== 'los') for (const cell of data.blocked) mark(cell, 'blocked');
      renderTargetBlast(overlay, state, actor);
      const firePreview = selectedFirePreview(state, actor, mode, data.legal);
      if (firePreview) {
        const from = hexCenter(firePreview.from.x, firePreview.from.y);
        const to = hexCenter(firePreview.to.x, firePreview.to.y);
        for (const [kind, width] of [['underlay', 8], ['signal', 4]]) {
          const line = document.createElementNS(NS, 'line');
          line.classList.add(`v2-fire-link-${kind}`);
          line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
          line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
          line.setAttribute('stroke-width', width * referenceScale);
          line.setAttribute('aria-hidden', 'true');
          overlay.append(line);
        }
        const category = firePreview.ratioCategory;
        const ratioLabel = firePreview.meaning==='tread-roll-5-6'?'5–6':typeof category === 'string' && /^(?:1-2|[1-5]-1)$/.test(category)
          ? category.replace('-', ':') : null;
        if (ratioLabel) {
          if (hexWidth * pixelScale >= 50 && !matchMedia('(max-width: 599px)').matches) {
            const width = Math.max(38 * referenceScale, 32 / pixelScale);
            const height = Math.max(22 * referenceScale, 20 / pixelScale);
            const center = freeRatioChipCenter(from, to, width, height, pixelScale, state);
            if (center) {
              const chip = document.createElementNS(NS, 'rect');
              chip.classList.add('v2-fire-ratio-chip');
              chip.setAttribute('x', center.x - width / 2); chip.setAttribute('y', center.y - height / 2);
              chip.setAttribute('width', width); chip.setAttribute('height', height);
              chip.setAttribute('rx', 4 * referenceScale);
              chip.setAttribute('aria-hidden', 'true');
              const label = document.createElementNS(NS, 'text');
              label.classList.add('v2-fire-ratio');
              label.setAttribute('x', center.x); label.setAttribute('y', center.y);
              label.setAttribute('font-size', Math.max(13 * referenceScale, 11 / pixelScale));
              label.setAttribute('aria-hidden', 'true');
              label.textContent = ratioLabel;
              overlay.append(chip, label);
            }
          }
        }
      }
      let message = ['select', 'move'].includes(data.status) ? '' : t(`v2.area.status.${data.status}`, { count: data.legal.length });
      if (data.reason) message += ` · ${data.reason}`;
      if (mode === 'movement') {
        const focused = view.target || view.infoCell || view.focusCell;
        const cell = focused && data.legal.find(item => item.x === focused.x && item.y === focused.y);
        if (cell && Number.isFinite(cell.cost)) {
          const costText = `${hexLabel(focused)} · ${GoblinLanguage.translate('MOVE COST')} ${t('v2.ui.movePoints', {cost:cell.cost})}`;
          message = [message, `${t('v2.ui.sector')} ${costText}`].filter(Boolean).join(' · ');
        }
      }
      legend.textContent = [data.plan?.label, data.plan && data.legal.length && t('v2.plan.legal'), message,
        data.load?.length && t('v2.area.loadAvailable'), data.unload?.length && t('v2.area.unloadAvailable')].filter(Boolean).join(' · ');
    }
    function coreCommands(state, actor, cell) {
      const target = targetOccupant(state, cell);
      const own = {playerId:'player', unitId:actor.id};
      if (state.turnPhase !== 'fire') {
        if (target?.team === 'enemy') return [{command:{type:'Ram', ...own, targetId:target.id}, label:t('v2.ui.ram')}];
        return target ? [] : [{command:{type:'Move', ...own, to:{x:cell.x,y:cell.y}}, label:t('v2.ui.move')}];
      }
      if (target?.team !== 'enemy') return [];
      const shot = {type:'PlayerFire', ...own, targetId:target.id};
      if (!actor.weapons) return [{command:shot, label:t('v2.ui.fire')}];
      return Object.entries(actor.weapons).sort(([left], [right]) =>
        Number(right === actor.selectedWeapon) - Number(left === actor.selectedWeapon)).map(([weaponKey, weapon]) => {
        const current = weaponKey === actor.selectedWeapon;
        const name = t('v2.ui.weapon.' + weaponKey);
        const shortName = t('v2.target.short.' + weaponKey);
        return {command:current ? {...shot, weaponKey} : {type:'SelectWeapon', ...own, weaponKey},
          attack:{name:current ? name : t('v2.target.switchWeapon', {weapon:name}), shortName:current ? shortName : `${shortName} ↔`, icon:weaponKey, shots:weapon.ready},
          label:[current ? name : t('v2.target.switchWeapon', {weapon:name}), 'A' + weapon.attack + ' R' + weapon.range,
            t('v2.specialists.readyCount', {count:weapon.ready})].join(' · ')};
      });
    }
    function legacyCommands(state, actor, cell) {
      if (globalThis.GoblinSpecialistsRuntime?.active()) return GoblinSpecialistsUI.commands(state, actor, cell);
      const runtime = units.find(unit => unit.id === actor.id), target = targetOccupant(state, cell);
      const intent = {actorId:actor.id, ...cell};
      if (state.turnPhase === 'fire') {
        if (target?.team !== 'enemy' && !runtime?.strategicMissile) return [];
        if (globalThis.GoblinArtilleryWeapons?.active(runtime)) {
          return Object.entries(GoblinArtilleryWeapons.weapons(runtime)).filter(([key]) => key !== 'indirect').map(([key, weapon]) =>
            ({command:GoblinArtilleryWeapons.command(runtime, cell, key), label:weapon.label + ' · ' + weapon.ready + '/1',
              attack:{name:weapon.label, icon:key.startsWith('indirect/') ? 'indirect' : 'fire'}}));
        }
        if (globalThis.GoblinSiegeWeapons?.active(runtime)) {
          return Object.entries(GoblinSiegeWeapons.weapons(runtime)).map(([weaponKey, weapon]) =>
            ({command:{type:'Fire', ...intent, weaponKey}, label:weapon.label + ' · ' + weapon.ready + '/1',
              attack:{name:weapon.label, icon:weaponKey.startsWith('ap-') ? 'antipersonnel' : 'main',
                shots:weaponKey === 'main-both' ? null : weapon.ready}}));
        }
        if (runtime?.ogreSystems) {
          return Object.entries(runtime.ogreSystems.weapons).map(([weaponKey, weapon]) =>
            ({command:{type:'Fire', ...intent, weaponKey},
              label:t('v2.ui.weapon.' + weaponKey) + ' · ' + t('v2.specialists.readyCount',{count:GoblinSystems.weaponReady(weapon)}),
              attack:{name:t('v2.ui.weapon.' + weaponKey), shortName:t('v2.target.short.'+weaponKey), icon:weaponKey, shots:GoblinSystems.weaponReady(weapon)}}));
        }
        if (runtime?.strategicMissile) return [{command:{type:'Fire', ...intent}, label:t('v2.ui.missile'), confirmSplash:true}];
        const weaponClass = globalThis.GoblinFireAnchors?.[runtime?.visualKey]?.klasse;
        const singleWeapon = t(weaponClass === 'cannon' ? 'v2.target.weapon.cannon' : 'v2.plan.standardWeapon');
        return [{command:{type:'Fire', ...intent}, label:t('v2.ui.fire'), singleWeapon}];
      }
      if (target?.team === 'enemy') return [{command:{type:'Ram', ...intent}, label:t('v2.ui.ram')}];
      if (target?.team === 'player' && target.id !== actor.id && state.turnPhase === 'movement' && dist(actor,target) === 1) {
        const carrier = actor.transportCapacity ? actor : target;
        const cargo = carrier === actor ? target : actor;
        const catalog = globalThis.GoblinCatalogRuntime;
        const compatible = catalog?.active() ? catalog.passenger(cargo) || catalog.drone(cargo) : cargo.infantry || cargo.engineering;
        if (carrier.transportCapacity && compatible)
          return [{command:{type:'Embark',actorId:cargo.id,carrierId:carrier.id,x:carrier.x,y:carrier.y},
            label:t('v2.ui.embark') + ' · ' + cargo.name,transport:true}];
      }
      if (target) return [];
      return [{command:{type:'Move', ...intent}, label:t('v2.ui.move')},
        ...(runtime?.transportCapacity && state.turnPhase === 'movement' && dist(actor,cell) === 1 ?
          carrierCargo(runtime).map(cargo => ({command:{type:'Unload', ...intent, cargoId:cargo.id},transport:true,
          label:t(globalThis.GoblinCatalogRuntime?.drone(cargo) ? 'v2.ui.catalog.deployDrone' : 'v2.ui.unload') + ' · ' +
            (globalThis.GoblinCatalogRuntime?.record(cargo) ? GoblinCatalogRuntime.name(cargo) : cargo.name)})) : [])];
    }
    function legacyAiHost() {
      const active = () => ScenarioRuleProfiles.aiAllowed(legacySession?.config) && !core() && !globalThis.IronDustBrowserV2?.active &&
        !globalThis.GoblinCatalogFullRuntime?.active() && legacySession?.scenarioId === currentScenario &&
        !ScenarioRuleProfiles.isDraftSession?.(legacySession) &&
        ScenarioRuleProfiles.entries[currentScenario]?.ruleProfileId === legacySession?.ruleProfileId;
      const current = () => active() && !gameOver && !view.busy && !GameDialogs.isOpen() && !globalThis.GoblinMovement?.busy();
      const generation = () => `${commandEpoch}:${commandUndoRevision}:${W}:${H}`;
      function projectSide(side) {
        // These admitted profiles expose the same on-map roster to each team.
        // The FULL visibility reducer has its own host.
        return {profileId:legacySession.ruleProfileId,side,phase:turnPhase,turn,
          terrain:{width:W,height:H,defaultTerrain:'open-ground',cells:[...terrainTypes].map(([key,type])=>{
            const [x,y]=key.split(',').map(Number);return {x,y,type};
          })},
          units:units.filter(unit=>unitAlive(unit)&&(!unit.embarkedOn||unit.team===side)).map(unit=>({
            id:unit.id,relation:unit.team===side?'own':'opponent',x:unit.x,y:unit.y,
            ...(unit.catalogSystems?{treads:unit.catalogSystems.treads}:{hp:unit.hp,maxHp:unit.maxHp}),
            disabled:!!unit.disabled,objectiveTarget:!!unit.core,embarked:!!unit.embarkedOn
          }))};
      }
      function playerOptions() {
        const state={turnPhase,units}, available=new Map();
        for(const actor of units){
          if(actor.team!=='player'||!unitAlive(actor)||actor.disabled)continue;
          for(let y=0;y<H;y++)for(let x=0;x<W;x++){
            const cell={x,y};
            for(const {command,confirmSplash} of legacyCommands(state,actor,cell)){
              const key=JSON.stringify(command);
              if(available.has(key))continue;
              const check=query(command);
              if(!check.ok)continue;
              const preview=previewFire(command), target=units.find(unit=>unit.id===preview?.targetId);
              available.set(key,{command,displayCell:cell,weaponRef:preview?.weaponKey,
                ...(target?{targetId:target.id}:{}),facts:{
                  ...(check.path?{path:check.path}:{}),...(Number.isFinite(check.cost)?{cost:check.cost}:{}),
                  ...(check.weapon?{attack:check.weapon.attack,range:check.weapon.range}:{}),
                  ...(preview?{ratioCategory:preview.meaning==='tread-roll-5-6'?null:preview.ratioCategory,
                    effectKind:confirmSplash?'area':preview.meaning==='tread-roll-5-6'?preview.meaning:
                      command.target?.kind==='component'?'component-crt':'unit-crt',
                    objectiveTarget:!!target?.core,disabledTarget:!!target?.disabled}:{}),
                  ...(command.mode?{spotterId:command.spotterId,mode:command.mode}:{}),
                  ...(command.cargoId?{cargoId:command.cargoId}:{}),
                  ...(command.bayId?{bayId:command.bayId}:{}),
                  ...(command.job?{job:command.job,option:command.option}:{})}});
            }
          }
        }
        return [...available.values()];
      }
      return Object.freeze({revision:()=>current()?revision():null,generation,
        side:()=>phase,project:projectSide,playerOptions,dispatch});
    }
    const targetCommands = (state, actor, cell) => actor && cell ? (core() ? coreCommands : legacyCommands)(state, actor, cell) : [];
    const phaseNotice = at('#v2-phase-notice');
    const phaseNoticePreference = 'goblin.v2.phaseNotice';
    const phaseDurationPreference = 'goblin.v2.phaseNoticeSeconds';
    const autoSelectPreference = 'goblin.v2.autoSelectReady';
    const phaseNoticeToggle = phaseNotice.querySelector('input');
    let phaseNoticeSeconds = 1, phaseNoticeKey = null, phaseNoticeTimer = null;
    view.autoSelectReady = false;
    try {
      const stored = localStorage.getItem(phaseDurationPreference);
      const seconds = Number(stored);
      if (localStorage.getItem(phaseNoticePreference) === 'off') phaseNoticeSeconds = 0;
      else if (stored != null && Number.isInteger(seconds) && seconds >= 0 && seconds <= 5) phaseNoticeSeconds = seconds;
      view.autoSelectReady = localStorage.getItem(autoSelectPreference) === 'on';
    } catch {}
    function setAutoSelectReady(enabled) {
      view.autoSelectReady = !!enabled;
      try { localStorage.setItem(autoSelectPreference, enabled ? 'on' : 'off'); } catch {}
    }
    function selectReadyActor(state, afterCommand = false) {
      if (state.phase !== 'player' || state.gameOver || globalThis.GoblinTrainingRuntime?.active()) return;
      if (afterCommand && view.actorId && readyUnitIds().includes(view.actorId)) return;
      const id = nextReadyUnit(state);
      const unit = state.units.find(item => item.id === id);
      view.actorId = unit?.id ?? null;
      if (unit) view.focusCell = view.infoCell = {x:unit.x,y:unit.y};
    }
    function hidePhaseNotice() {
      clearTimeout(phaseNoticeTimer);
      if (phaseNotice.open) phaseNotice.close();
      phaseNotice.hidden = true;
    }
    function setPhaseNoticeSeconds(value) {
      if (!Number.isInteger(value) || value < 0 || value > 5) return;
      phaseNoticeSeconds = value;
      try {
        localStorage.setItem(phaseDurationPreference, String(value));
        localStorage.setItem(phaseNoticePreference, value ? 'on' : 'off');
      } catch {}
      if (!value) hidePhaseNotice();
    }
    phaseNoticeToggle.onchange = () => {
      if (phaseNoticeToggle.checked) setPhaseNoticeSeconds(0);
    };
    phaseNotice.addEventListener('cancel', event => event.preventDefault());
    document.addEventListener('goblin-game-dialog-opening', hidePhaseNotice);
    function positionPhaseNotice() {
      const box = at('#v2-map').getBoundingClientRect();
      let top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom);
      let left = Math.max(0, box.left), right = Math.min(innerWidth, box.right);
      if (bottom - top < Math.min(160, innerHeight)) { top = 0; bottom = innerHeight; }
      if (right - left < Math.min(220, innerWidth)) { left = 0; right = innerWidth; }
      const xGap = Math.min(100, Math.max(0, (right - left) * .12));
      const yGap = Math.min(100, Math.max(0, (bottom - top) * .22));
      phaseNotice.style.inset = `${top + yGap}px ${innerWidth - right + xGap}px ${innerHeight - bottom + yGap}px ${left + xGap}px`;
    }
    function renderPhaseNotice(state) {
      const phase = state.phase === 'enemy' ? 'enemy' : state.turnPhase;
      const label = at('#v2-phase');
      label.dataset.phase = state.gameOver ? '' : phase;
      if (state.gameOver || document.body.classList.contains('v2-screen-open')) {
        hidePhaseNotice();
        return;
      }
      const {sessionId, epoch} = state.markers?.binding ?? {};
      const key = JSON.stringify([state.scenario, sessionId, epoch, state.turn, phase]);
      if (phaseNoticeKey !== key) {
        phaseNoticeKey = key;
        hidePhaseNotice();
        if (!phaseNoticeSeconds || GameDialogs.isOpen() || globalThis.GoblinTrainingRuntime?.active()) return;
        phaseNotice.dataset.phase = phase;
        phaseNoticeToggle.checked = false;
        phaseNotice.querySelector('strong').textContent = t(phase === 'enemy' ? 'phase.enemy.label' : `v2.phase.${phase}`);
        phaseNotice.querySelector('span').textContent = t('v2.phaseNotice.disable');
        phaseNotice.hidden = false;
        positionPhaseNotice();
        phaseNotice.showModal();
        phaseNoticeTimer = setTimeout(hidePhaseNotice, phaseNoticeSeconds * 1000);
      } else if (phaseNotice.open) positionPhaseNotice();
    }

    function renderCore(state) {
      const actor = state.units.find(unit => unit.id === view.actorId && unitAlive(unit));
      if (!actor) {view.actorId = null; clearContext();}
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-map-label').textContent = GoblinLanguage.translate('TACTICAL MAP');
      at('#v2-map').setAttribute('aria-label', `${t('ui.hud.map')}: ${t('v2.ui.selectHex')}`);
      at('#v2-profile').textContent = state.profile==='TRAINING_FIELD_TEST_v1'?t('training.label'):globalThis.GoblinCatalogFullRuntime?.active()?t('v2.full.profile'):state.profile==='CATALOG_SPECIALISTS_v1'?t('v2.specialists.profile'):state.profile==='CATALOG_BASE_TRANSPORT_v1'?t('v2.catalog.profile'):state.profile;
      at('#v2-phase').textContent = state.gameOver ? t(state.objective.outcome ? 'v2.win' : 'v2.lose') :
        state.phase === 'enemy' ? t('v2.enemy') : t(`v2.phase.${state.turnPhase}`);
      renderPhaseNotice(state);
      at('#v2-turn').textContent = `${t('ui.hud.turn',{turn:state.turn})} · ${t('v2.ui.coreHp')} ${state.objective.coreHp}/${state.objective.coreMax}`;
      const terminal = at('#v2-terminal'); terminal.hidden = !state.gameOver;
      terminal.classList.toggle('v2-failed', state.gameOver && !state.objective.outcome);
      terminal.textContent = state.gameOver ? t(state.objective.outcome ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title') : '';
      const phaseButton = at('#v2-phase-action');
      const next = {movement:'dialog.phaseAdvance.confirm.toFire',
        fire:'dialog.phaseAdvance.confirm.toGev',gev:'dialog.phaseAdvance.confirm.toEnemy'}[state.turnPhase];
      phaseButton.textContent = state.phase === 'enemy' ? t('v2.enemy') : state.gameOver ? t('v2.ended') :
        `${t(next)} · ${t('dialog.phaseAdvance.pending',{pendingCount:state.ready})}`;
      phaseButton.setAttribute('aria-label',phaseButton.textContent);
      splitPhaseLabel(phaseButton);
      phaseButton.disabled = state.phase !== 'player' || !IronDustBrowserV2.query({type:'EndPhase',playerId:'player'}).available ||
        GameDialogs.isOpen() || view.busy;
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      const coreUndo = at('#v2-undo');
      coreUndo.hidden = false; coreUndo.disabled = true;
      backLabel(coreUndo, 0);
      renderTurnControls(state);
      at('#v2-units-label').textContent = t('ui.hud.units');
      at('#v2-message').textContent = view.message;
      renderRoster(state, unit => [strengthText(unit), unit.secondMoved ? t('v2.ui.secondMoved') :
        unit.fired ? t('v2.ui.fired') : unit.moved ? t('v2.ui.moved') : '']);
      renderFieldInfo(state, actor, cell => state.cells.find(item => item.x === cell.x && item.y === cell.y)?.type);
      renderTargetCard(state, actor);
      renderM1Markers(state, actor);
      renderAreaPreview(state, actor);
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    let hoverState = null, hoverCell = null;
    function render() {
      resumeMapSize();
      const state = project();
      hoverState = state;
      clearMapHover();
      syncAreaPhase(state);
      if (view.target && view.intentRevision !== state.revision) clearContext();
      const fireZoom = fireZoomEntry(state);
      const centerFireActor = fireZoom ? zoomOnFireEntry(fireZoom.target) : false;
      if (fireZoom) fireZoomPhase = fireZoom.key;
      const zoomOut = at('#v2-zoom-out'), zoomIn = at('#v2-zoom-in');
      const fit = at('#v2-zoom-fit'), center = at('#v2-zoom-center');
      for (const [button, key] of [[zoomOut, 'ui.hud.zoomOut'], [zoomIn, 'ui.hud.zoomIn'], [fit, 'v2.ui.mapFit'],
        [center, 'v2.ui.centerSelection'], [at('#v2-pause'), 'ui.nav.pause'], [at('#v2-log-open'), 'ui.details.log']]) { button.title = t(key); button.setAttribute('aria-label', button.title); }
      at('#v2-map-tools').setAttribute('aria-label', t('ui.hud.map'));
      zoomOut.disabled = view.zoom <= 1;
      zoomIn.disabled = view.zoom >= 4;
      center.disabled = !view.actorId;
      if (core()) { renderCore(state); if (centerFireActor) centerSelectedActor(state); return; }
      const learningResult=state.objective.goalMode==='learning'?t(globalThis.GoblinTrainingRuntime?.status()==='lesson-complete'?'training.complete.title':'training.failure.title'):null;
      const actor = state.units.find(unit => unit.id === view.actorId);
      if (!actor || unitDead(actor)) { view.actorId = null; clearContext(); }
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-map-label').textContent = GoblinLanguage.translate('TACTICAL MAP');
      at('#v2-units-label').textContent = t('ui.hud.units');
      at('#v2-profile').textContent = state.profile==='TRAINING_FIELD_TEST_v1'?t('training.label'):globalThis.GoblinCatalogFullRuntime?.active()?t('v2.full.profile'):state.profile==='CATALOG_SPECIALISTS_v1'?t('v2.specialists.profile'):state.profile==='CATALOG_BASE_TRANSPORT_v1'?t('v2.catalog.profile'):state.profile;
      at('#v2-phase').textContent = state.gameOver ? learningResult??t(state.objective.outcome ? 'v2.win' : 'v2.lose') :
        view.phaseSkip?.turn === state.turn ? t(view.phaseSkip.key) : t(`phase.${state.turnPhase}.label`);
      renderPhaseNotice(state);
      at('#v2-turn').textContent = `${t('ui.hud.turn', { turn: state.turn })} · ${state.objective.goalMode === 'learning'?t('training.learningGoal'):state.objective.goalMode === 'core'
        ? t('hud.objective.progress.core', { currentHp: state.objective.coreHp, maxHp: state.objective.coreMax })
        : t('hud.objective.progress.enemies', { remainingEnemies: state.objective.enemyAlive, totalEnemies: globalThis.GoblinCatalogFullRuntime?.active()&&state.objective.goalMode==='core-and-escort'?state.objective.total:state.objective.enemyTotal })}`;
      at('#v2-map').setAttribute('aria-label', `${t('ui.hud.map')}: ${t('v2.ui.selectHex')}`);
      const terminal = at('#v2-terminal');
      terminal.hidden = !state.gameOver;
      terminal.classList.toggle('v2-failed', state.gameOver && (state.objective.goalMode==='learning'?globalThis.GoblinTrainingRuntime?.status()==='lesson-failed':state.objective.outcome === false));
      terminal.textContent = state.gameOver ? learningResult??t(state.objective.outcome ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title') : '';
      const next = { movement: 'dialog.phaseAdvance.confirm.toFire', fire: 'dialog.phaseAdvance.confirm.toGev', gev: 'dialog.phaseAdvance.confirm.toEnemy' }[state.turnPhase];
      const phaseButton = at('#v2-phase-action');
      phaseButton.textContent = next ? `${t(next)} · ${t('dialog.phaseAdvance.pending', { pendingCount: state.ready })}`
        : state.gameOver&&learningResult?learningResult:t(state.gameOver ? (state.objective.outcome ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title') : 'phase.enemy.label');
      phaseButton.setAttribute('aria-label', phaseButton.textContent);
      splitPhaseLabel(phaseButton);
      phaseButton.disabled = !next || state.phase !== 'player' || state.gameOver || GameDialogs.isOpen() || view.busy ||
        !!globalThis.GoblinTrainingRuntime?.holdingShotResult();
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      const undoButton = at('#v2-undo');
      undoButton.hidden = false;
      undoButton.disabled = !state.undo.available || view.busy;
      backLabel(undoButton, state.undo.count);
      renderTurnControls(state);
      at('#v2-message').textContent = view.message;
      renderRoster(state, unit => {
        const system = state.systems.find(item => item.id === unit.id);
        const carrier = unit.embarkedOn && state.units.find(item => item.id === unit.embarkedOn);
        const cargo = unit.transportCapacity ? units.find(item => item.id === unit.id) : null;
        return [system ? `${t('v2.ui.treads')} ${system.summary.treads}${unit.catalogSystems?'/'+system.summary.maxTreads:''}` :
          `${unit.hp}/${unit.maxHp} ${unit.infantry ? 'SP' : 'HP'}`, carrier ? `${t('v2.ui.embarked')} ${carrier.name}` : '',
          cargo ? `${t('v2.ui.cargo')} ${unit.catalogId?GoblinCatalogRuntime.loadWeight(unit,state.units):carrierLoad(cargo)}/${unit.transportCapacity}` : '',
          unit.strategicMissile ? `${t('v2.ui.missile')} ${unit.missilesRemaining}` : ''];
      });
      renderFieldInfo(state, actor, cell => terrainTypeAt(cell.x, cell.y));
      renderTargetCard(state, actor);
      renderM1Markers(state, unitAlive(actor) ? actor : null);
      renderAreaPreview(state, unitAlive(actor) ? actor : null);
      if (centerFireActor) centerSelectedActor(state);
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    for (const button of at('#v2-area-controls').querySelectorAll('[data-area]'))
      button.onclick = () => { view.areaMode = activeAreaMode(project()) === button.dataset.area ? 'none' : button.dataset.area; render(); };
    at('#v2-area-grid').onclick = () => GoblinUIV2.setGridVisible(!view.gridVisible);
    at('#v2-area-targets').onclick=()=>GoblinUIV2.setTargetsVisible(!view.targetsVisible);
    at('#v2-area-damage').onclick=()=>GoblinUIV2.setDamageVisible(!view.damageVisible);
    at('#v2-next-unit').onclick = () => { const id = nextReadyUnit(); if (id) focusUnit(id); };
    at('#v2-undo').onclick = () => { const result = undo(); if (!result.ok) { view.message = result.reason; render(); } };
    at('#v2-phase-action').onclick = () => {
      view.phaseSkip = null; clearTimeout(view.phaseSkipTimer);
      if (core()) {
        const command={type:'EndPhase',playerId:'player'};
        const expected=revision();
        const result=dispatch(command,expected);
        clearContext();view.message=result.ok?'':result.reason;render();
        return;
      }
      if (phase !== 'player' || gameOver || GameDialogs.isOpen()) return;
      clearContext();
      document.querySelector('#end-turn').click();
      render();
      GameDialogs.whenIdle().then(render);
    };
    const mapPanel = at('#v2-map');
    function showMapCard() {
      const card = at('.v2-map-card'), head = at('.v2-head');
      const top = card.getBoundingClientRect().top + scrollY - head.getBoundingClientRect().height - 8;
      scrollTo(0, Math.max(0, top));
    }
    function centerOnHex(hex) {
      if (!hex) return;
      const box = hex.getBoundingClientRect(), frame = mapPanel.getBoundingClientRect();
      mapPanel.scrollLeft += box.left + box.width / 2 - frame.left - frame.width / 2;
      mapPanel.scrollTop += box.top + box.height / 2 - frame.top - frame.height / 2;
    }
    function centerSelectedActor(state) {
      const actor = state.units.find(unit => unit.id === view.actorId && unitAlive(unit));
      if (actor) centerOnHex(nativeMap.querySelector(`.hex[data-x="${actor.x}"][data-y="${actor.y}"]`));
    }
    function startView() {
      const state = project(), binding = state.markers?.binding;
      if (!binding) return;
      const key = JSON.stringify([binding.scenarioId, binding.profileId, binding.sessionId, binding.epoch]);
      if (startZoomMission === key) return;
      startZoomMission = key;
      if (!matchMedia('(max-width: 599px), (max-height: 500px)').matches) return;
      const actor = state.units.find(unit => unit.team === 'player' && unitAlive(unit) && !unit.embarkedOn);
      if (!actor) return;
      chooseActor(actor.id, false);
      const request = { key, actorId:actor.id, revision:revision() };
      startZoomPending = request;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (startZoomPending !== request) return;
        startZoomPending = null;
        if (startZoomMission !== request.key || view.actorId !== request.actorId ||
            revision() !== request.revision || GameDialogs.isOpen() || document.body.classList.contains('v2-screen-open') ||
            !mapPanel.clientWidth || !mapPanel.clientHeight) return;
        zoomOnFireEntry(52);
        render();
        centerSelectedActor(project());
        showMapCard();
      }));
    }
    function fireZoomEntry(state) {
      if (globalThis.GoblinMovement?.presentingFire?.() || state.phase !== 'player' || state.turnPhase !== 'fire' || state.gameOver ||
          activeAreaMode(state) !== 'fire' || !mapPanel.clientWidth || !mapPanel.clientHeight) return null;
      const key = `${state.scenario}:${state.turn}:${state.phase}:${state.turnPhase}`;
      if (fireZoomPhase === key) return null;
      const box = nativeMap.viewBox.baseVal;
      const visibleHex = Math.sqrt(3) * S * nativeMap.getBoundingClientRect().width / (box.width || 790);
      return {key,target:Math.max(50, view.zoom > 1 ? visibleHex : 0)};
    }
    function zoomOnFireEntry(target) {
      const originalZoom = view.zoom;
      const box = nativeMap.viewBox.baseVal;
      const width = box.width || 790, height = box.height || 480;
      for (let attempt = 0; attempt < 4; attempt++) {
        const panelWidth = mapPanel.clientWidth, panelHeight = mapPanel.clientHeight;
        const fit = Math.min(panelWidth / width, panelHeight / height);
        view.zoom = Math.min(4, Math.max(view.zoom, target / (Math.sqrt(3) * S * fit)));
        applyMapSize();
        const actualHex = Math.sqrt(3) * S * nativeMap.getBoundingClientRect().width / width;
        if (mapPanel.clientWidth === panelWidth && mapPanel.clientHeight === panelHeight &&
            (actualHex >= target - 0.01 || view.zoom >= 4)) break;
      }
      return view.zoom > originalZoom + 0.0001;
    }
    function applyMapSize() {
      if(mapResizeFrame!==null){cancelAnimationFrame(mapResizeFrame);mapResizeFrame=null;}
      mapResizeDeferred = false;
      const panelWidth=mapPanel.clientWidth,panelHeight=mapPanel.clientHeight;
      if (!panelWidth || !panelHeight) return;
      const box = nativeMap.viewBox.baseVal;
      const width = box.width || 790, height = box.height || 480;
      const fit = Math.min(panelWidth / width, panelHeight / height);
      const scaledWidth = width * fit * view.zoom, scaledHeight = height * fit * view.zoom;
      const desired={width:scaledWidth,height:scaledHeight,marginTop:Math.max(0,(panelHeight-scaledHeight)/2)};
      for(const [key,value]of Object.entries(desired)){
        const current=Number.parseFloat(nativeMap.style[key]);
        // CSSOM may serialize fewer decimals; avoid rewriting the same visual size.
        if(!Number.isFinite(current)||Math.abs(current-value)>=0.01)nativeMap.style[key]=`${value}px`;
      }
    }
    let mapResizeFrame=null;
    let mapResizeDeferred = false;
    function scheduleMapSize(){
      if(mapResizeFrame!==null)return;
      mapResizeFrame=requestAnimationFrame(()=>{
        mapResizeFrame=null;
        // A command can resize the footer while the shot still uses the current map scale.
        if (globalThis.GoblinMovement?.presentingFire?.()) {
          mapResizeDeferred = true;
          return;
        }
        applyMapSize();
      });
    }
    function resumeMapSize() {
      if (mapResizeDeferred && !globalThis.GoblinMovement?.presentingFire?.()) scheduleMapSize();
    }
    new ResizeObserver(scheduleMapSize).observe(mapPanel);
    // Unused since the event log moved behind its button; the line ends the map sizing source read by resize-observer-geometry.
    let compactDetails = null;
    function syncLayout() {
      const training = at('#v2-training');
      if (!training.hidden) placeMapCard(training);
      const card = at('#v2-target-card');
      if (!view.target || card.hidden) return;
      const state = hoverState, actor = state?.units.find(unit => unit.id === view.actorId);
      if (!actor) return;
      positionTargetCard(card, view.target, state, actor, targetOccupant(state, view.target));
      revealTargetControl(card, document.activeElement);
    }
    function syncPanelLayout() {
      const layout = at('.v2-layout');
      layout.style.setProperty('--v2-toolbar-height', `${at('#v2-area-controls').offsetHeight}px`);
      layout.style.setProperty('--v2-legend-height', `${at('#v2-area-legend').offsetHeight}px`);
      syncLayout();
    }
    window.addEventListener('resize', syncLayout);
    window.addEventListener('scroll', syncLayout, {passive:true});
    mapPanel.addEventListener('scroll', syncLayout, {passive:true});
    const targetLayoutObserver = new ResizeObserver(syncPanelLayout);
    targetLayoutObserver.observe(mapPanel);
    targetObstacles().forEach(node => targetLayoutObserver.observe(node));
    targetLayoutObserver.observe(at('#v2-phase'));
    function dismissTargetOnOutsideClick(event) {
      if (!view.target || at('#v2-phase-notice')?.open || at('#v2-target-card').hidden ||
          event.target.closest?.('dialog, #v2-target-card, #v2-training button, #v2-pause')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearContext(); render();
      at('#v2-map').focus({preventScroll:true});
    }
    document.addEventListener('click', dismissTargetOnOutsideClick, true);
    const pointers = new Map();
    let pinch = null, suppressTapUntil = 0;
    function cellAt(clientX, clientY) {
      const point = nativeMap.createSVGPoint(); point.x = clientX; point.y = clientY;
      const local = point.matrixTransform(nativeMap.getScreenCTM().inverse());
      const cell = core() ? IronDustBrowserV2.view.cells.reduce((best,next) => {
        const center=hexCenter(next.x,next.y),distance=Math.hypot(center.x-local.x,center.y-local.y);
        return !best || distance<best.distance ? {x:next.x,y:next.y,distance} : best;
      },null) : nearestHex(local.x, local.y);
      return cell && Math.hypot(hexCenter(cell.x, cell.y).x - local.x, hexCenter(cell.x, cell.y).y - local.y) <= S ? cell : null;
    }
    function clearMapHover() {
      hoverCell = null; at('#v2-map-hover').hidden = true;
    }
    mapPanel.addEventListener('pointerleave', clearMapHover);
    mapPanel.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || event.buttons || view.target || !hoverState || GameDialogs.isOpen()) { clearMapHover(); return; }
      const cell = cellAt(event.clientX, event.clientY);
      if (!cell) { clearMapHover(); return; }
      const key = cell.x + ',' + cell.y;
      if (hoverCell === key) return;
      hoverCell = key;
      const state = hoverState, actor = state.units.find(unit => unit.id === view.actorId), occupant = targetOccupant(state, cell);
      const options = entriesAt(state, actor, cell), info = at('#v2-map-hover');
      info.replaceChildren();
      if (occupant) info.append(el('strong', '', occupant.name));
      if (state.turnPhase === 'fire') {
        const shot = options.find(entry => commandIcon(entry.command) === 'fire' && entry.command.type !== 'SelectWeapon' && entryResult(entry).ok);
        if (shot) {
          const chance = entryChance(shot, occupant);
          const mode = shot.command.mode === 'indirect' ? 'indirect' : 'direct';
          info.append(Object.assign(el('span','v2-action-icon'),{innerHTML:svgIcon('fire')}), el('span','',
            [t('v2.ui.artillery.' + mode), shot.label, chance && t('v2.target.hit',{percent:Math.round(chance.hit * 100)})].filter(Boolean).join(' · ')));
        }
      } else {
        const shown = new Set();
        for (const entry of options) {
          const kind = commandIcon(entry.command);
          if (kind === 'movement' || shown.has(kind) || !entryResult(entry).ok) continue;
          shown.add(kind);
          info.append(Object.assign(el('span','v2-action-icon'),{innerHTML:svgIcon(kind), title:entry.label}));
        }
      }
      info.hidden = !info.childElementCount;
      if (!info.hidden) {
        const frame = at('.v2-map-frame').getBoundingClientRect();
        info.style.left = Math.max(4, Math.min(event.clientX - frame.left + 14, frame.width - info.offsetWidth - 4)) + 'px';
        info.style.top = Math.max(4, Math.min(event.clientY - frame.top + 14, frame.height - info.offsetHeight - 4)) + 'px';
      }
    });
    function setZoom(value, clientX = mapPanel.getBoundingClientRect().left + mapPanel.clientWidth / 2,
      clientY = mapPanel.getBoundingClientRect().top + mapPanel.clientHeight / 2) {
      startZoomPending = null;
      const next = Math.max(1, Math.min(4, value));
      if (next === view.zoom) return;
      const point = nativeMap.createSVGPoint();
      point.x = clientX; point.y = clientY;
      const world = point.matrixTransform(nativeMap.getScreenCTM().inverse());
      view.zoom = next;
      applyMapSize();
      const screen = world.matrixTransform(nativeMap.getScreenCTM());
      mapPanel.scrollLeft += screen.x - clientX;
      mapPanel.scrollTop += screen.y - clientY;
      render();
    }
    at('#v2-zoom-out').onclick = () => setZoom(view.zoom / 1.25);
    at('#v2-zoom-in').onclick = () => setZoom(view.zoom * 1.25);
    function fitMap() { startZoomPending = null; view.zoom = 1; applyMapSize(); mapPanel.scrollTo(0, 0); render(); }
    at('#v2-zoom-fit').onclick = fitMap;
    at('#v2-zoom-center').onclick = () => {
      startZoomPending = null;
      const actor = project().units.find(unit => unit.id === view.actorId);
      if (actor) centerOnHex(nativeMap.querySelector(`.hex[data-x="${actor.x}"][data-y="${actor.y}"]`));
    };
    function pointerDistance() {
      const [first, second] = [...pointers.values()];
      return Math.hypot(first.x - second.x, first.y - second.y);
    }
    mapPanel.addEventListener('pointerdown', event => {
      startZoomPending = null;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const pointer = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
        scrollX: mapPanel.scrollLeft, scrollY: mapPanel.scrollTop, moved: false, timer: null };
      pointers.set(event.pointerId, pointer);
      if (event.pointerType === 'touch') pointer.timer = setTimeout(() => {
        if (pointers.size !== 1 || pointer.moved) return;
        const cell = cellAt(pointer.x, pointer.y);
        if (cell) { view.infoCell = cell; view.message = t('ui.hud.intel'); render(); }
        pointer.moved = true; suppressTapUntil = performance.now() + 500;
      }, 500);
      if (pointers.size === 2) {
        for (const item of pointers.values()) { item.moved = true; clearTimeout(item.timer); }
        pinch = { distance: pointerDistance(), zoom: view.zoom };
        suppressTapUntil = performance.now() + 500;
      }
    });
    window.addEventListener('pointermove', event => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      pointer.x = event.clientX; pointer.y = event.clientY;
      if (pointers.size === 2 && pinch) {
        setZoom(pinch.zoom * pointerDistance() / Math.max(1, pinch.distance), event.clientX, event.clientY);
        suppressTapUntil = performance.now() + 500; event.preventDefault(); return;
      }
      if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= 8) {
        pointer.moved = true; clearTimeout(pointer.timer);
      }
      if (pointer.moved) {
        mapPanel.scrollLeft = pointer.scrollX + pointer.startX - pointer.x;
        mapPanel.scrollTop = pointer.scrollY + pointer.startY - pointer.y;
        suppressTapUntil = performance.now() + 500; event.preventDefault();
      }
    }, { passive: false });
    function endPointer(event) {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;
      clearTimeout(pointer.timer);
      if (pointer.moved) suppressTapUntil = performance.now() + 500;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
    }
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    function cancelMapPointers() {
      for (const pointer of pointers.values()) clearTimeout(pointer.timer);
      pointers.clear();
      pinch = null;
    }
    window.addEventListener('blur', cancelMapPointers);
    mapPanel.addEventListener('wheel', event => {
      startZoomPending = null;
      event.preventDefault();
      setZoom(view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), event.clientX, event.clientY);
      syncLayout();
    }, { passive: false });
    mapPanel.addEventListener('contextmenu', event => {
      event.preventDefault();
      const cell = cellAt(event.clientX, event.clientY);
      if (cell && !(view.target && view.actorId)) { view.infoCell = cell; view.message = t('ui.hud.intel'); render(); }
    });
    nativeMap.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (performance.now() < suppressTapUntil) return;
      const cell = cellAt(event.clientX, event.clientY);
      if (cell) chooseHex(cell.x, cell.y);
    }, true);
    document.addEventListener('keydown', event => {
      if (phaseNotice.open) { event.stopImmediatePropagation(); return; }
      startZoomPending = null;
      if(displayControls.handleKeydown(event))return;
      if (document.body.classList.contains('v2-screen-open')) {
        if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'l') {
          event.preventDefault(); event.stopImmediatePropagation();
        }
        return;
      }
      if (GameDialogs.isOpen()) return;
      if (event.repeat && event.target === at('#v2-phase-action') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.key === 'Escape') {
        if (view.target) clearContext(); else view.actorId = null;
        render(); mapPanel.focus(); event.preventDefault();
        event.stopImmediatePropagation(); return;
      }
      const mapFocused = document.activeElement === mapPanel || document.activeElement === nativeMap;
      if (mapFocused && !(view.target && view.actorId)) {
        const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (step) {
          const previous = view.focusCell || { x: 0, y: 0 };
          view.focusCell = { x: Math.max(0, Math.min(W - 1, previous.x + step[0])),
            y: Math.max(0, Math.min(H - 1, previous.y + step[1])) };
          render();
          const hex = nativeMap.querySelector(`.hex[data-x="${view.focusCell.x}"][data-y="${view.focusCell.y}"]`);
          const box = hex?.getBoundingClientRect(), frame = mapPanel.getBoundingClientRect();
          if (box) {
            if (box.left < frame.left) mapPanel.scrollLeft -= frame.left - box.left;
            if (box.right > frame.right) mapPanel.scrollLeft += box.right - frame.right;
            if (box.top < frame.top) mapPanel.scrollTop -= frame.top - box.top;
            if (box.bottom > frame.bottom) mapPanel.scrollTop += box.bottom - frame.bottom;
          }
          event.preventDefault(); event.stopImmediatePropagation(); return;
        } else if ((event.key === 'Enter' || event.key === ' ') && view.focusCell) {
          chooseHex(view.focusCell.x, view.focusCell.y); event.preventDefault(); event.stopImmediatePropagation(); return;
        } else if (event.key === '+' || event.key === '=') { setZoom(view.zoom * 1.1); event.preventDefault(); event.stopImmediatePropagation(); return; }
        else if (event.key === '-') { setZoom(view.zoom * 0.9); event.preventDefault(); event.stopImmediatePropagation(); return; }
      }
      if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'l') {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    globalThis.addEventListener('goblin-language-change', () => render());
    globalThis.addEventListener('goblin-presentation-state', () => render());
    globalThis.addEventListener('goblin-movement-finished', () => render());
    globalThis.addEventListener('goblin-core-v2-render', () => {if(core()) render();});
    globalThis.addEventListener('goblin-unit-art-fallback', () => render());
    new MutationObserver(changes => {
      resumeMapSize();
      const own = node => node.nodeType === 1 && /^(goblin-movement-layer|v2-(m1-markers|team-markers|actor-marker|target-marker|focus-marker|grid-overlay|area-overlay))$/.test(node.id);
      if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => !own(node)))) render();
    }).observe(nativeMap, { childList: true });
    render();
    globalThis.GoblinLanguage?.ready.then(render);
  })();
}
