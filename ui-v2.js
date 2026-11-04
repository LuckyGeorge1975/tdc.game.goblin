// Default presentation over the selected Legacy or Core session; explicit non-V2 UI values keep the prior test path.
const goblinUiChoice = new URLSearchParams(location.search).get('ui');
if ((goblinUiChoice === null || goblinUiChoice === 'v2') && !globalThis.goblinBootProfileError) {
  (() => {
    const nativeMap = document.querySelector('#battlefield-map');
    const nativeShell = document.querySelector('.app-shell');
    const view = { actorId: null, target: null, infoCell: null, focusCell: null,
      intentRevision: null, busy: false, message: '', zoom: 1, areaMode: null, gridVisible: false,
      targetsVisible:true,damageVisible:true,
      previewWeaponKey: null, phaseSkip: null, menuOpen: false, pendingAction: null };
    const shell = document.createElement('div');
    shell.className = 'v2-shell';
    // Line icons for the game shell; every icon button carries its text as aria-label and title.
    const ICONS = {
      pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
      settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
      movement: '<path d="M12 2v20M2 12h20"/><path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
      fire: '<circle cx="12" cy="12" r="9"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>',
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
      <header class="v2-head">${iconButton('v2-pause', 'pause')}<div class="v2-head-mission"><span class="v2-label" id="v2-profile"></span><h1 id="v2-mission"></h1></div><div class="v2-head-turn"><p id="v2-turn"></p><strong id="v2-phase" role="status" aria-live="polite"></strong></div><div class="v2-head-goal"><p id="v2-objective"></p></div>${iconButton('v2-settings', 'settings')}${iconButton('v2-home', 'home')}</header>
      <div class="v2-layout"><aside class="v2-own"><section class="v2-card v2-units-card"><div class="v2-card-head"><span class="v2-label" id="v2-units-label"></span><span class="v2-units-ready" id="v2-units-ready"></span></div><div class="v2-units" id="v2-units"></div></section></aside><main class="v2-card v2-map-card"><span class="v2-sr" id="v2-map-label"></span><div class="v2-map-frame"><div class="v2-map" id="v2-map" tabindex="0"></div><div class="v2-map-overlay v2-map-overlay-top"><div class="v2-area-controls" role="group" id="v2-area-controls">${iconButton('v2-mode-movement', 'movement', ' data-area="movement"')}${iconButton('v2-mode-fire', 'fire', ' data-area="fire"')}${iconButton('v2-mode-los', 'los', ' data-area="los"')}<button type="button" id="v2-display-toggle" aria-expanded="false" aria-controls="v2-display-controls" hidden></button><div id="v2-display-controls" class="v2-display-controls" role="group">${iconButton('v2-area-grid', 'grid')}${iconButton('v2-area-targets', 'targets')}${iconButton('v2-area-damage', 'damage')}</div></div><div class="v2-weapon-controls" id="v2-weapon-controls" hidden></div><p id="v2-area-legend" class="v2-area-legend" role="status"></p></div><div class="v2-map-overlay v2-map-overlay-bottom"><strong class="v2-map-caption" id="v2-map-caption"></strong><div class="v2-map-tools" role="group" id="v2-map-tools">${iconButton('v2-zoom-in', 'zoomIn')}${iconButton('v2-zoom-out', 'zoomOut')}${iconButton('v2-zoom-center', 'center')}${iconButton('v2-zoom-fit', 'fit')}</div></div></div></main><aside class="v2-target"><section class="v2-card v2-intel-card"><div class="v2-card-head"><span class="v2-label" id="v2-intel-label"></span><div class="v2-intel-switches" role="group" id="v2-intel-switches"><button type="button" id="v2-intel-unit-toggle" data-section="unit">${svgIcon('los')}<span></span></button><button type="button" id="v2-intel-field-toggle" data-section="field">${svgIcon('los')}<span></span></button></div></div><div id="v2-intel"></div></section></aside></div>
      <footer class="v2-controls"><div class="v2-context"><div class="v2-action-chip" id="v2-action-chip" role="status" hidden></div><span id="v2-selection"></span><strong id="v2-terminal" hidden></strong><p id="v2-message" class="v2-status" role="status"></p></div>${iconButton('v2-log-open', 'log')}<button type="button" id="v2-undo"></button><button type="button" id="v2-phase-action"></button><button type="button" id="v2-next-unit"></button></footer><section class="v2-card v2-command-card" id="v2-command-card" role="group" aria-labelledby="v2-command-target" hidden><p class="v2-command-hint"><strong id="v2-command-target"></strong> <span id="v2-command-intel"></span></p><div class="v2-command-body" id="v2-command-body"><div class="v2-weapon-controls" id="v2-command-weapons" hidden></div></div><div class="v2-command-bar"><div class="v2-actions" id="v2-actions"></div><div class="v2-command-footer" id="v2-command-footer"></div></div></section><section class="v2-card v2-target-card" id="v2-target-card" role="group" aria-labelledby="v2-target-title" hidden></section>`;
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
      nativeMap.querySelectorAll('.target-ring,.unit-selection-ring,.focus-marker').forEach(node => node.remove());
      M1UnitMarkers.render(nativeMap, state.markers, {actor, target:view.target, focus:view.focusCell, t,
        targetsVisible:view.targetsVisible,damageVisible:view.damageVisible});
      const members=state.markers.objective?.members || [];
      const done=members.filter(member => member.state==='satisfied').length;
      let status=at('#v2-objective-members');
      if(!status){status=document.createElement('p');status.id='v2-objective-members';at('#v2-objective').after(status);}
      status.textContent=members.length?t('v2.ui.objectiveMembers',{done,total:members.length}):'';
      if(state.fullStatus){if(state.fullStatus.pendingEnemy)status.textContent+=' · '+t('v2.full.objective.pendingWaves');if(state.fullStatus.turnLimit!==null)status.textContent+=' · '+t('v2.full.limit.status',{current:state.fullStatus.enemyTurns,limit:state.fullStatus.turnLimit});}
      status.title=members.map(member => `${state.units.find(unit=>unit.id===member.unitId)?.name || member.unitId}: ${t(member.state==='satisfied'?'v2.ui.destroyed':'v2.ui.objectivePending')}`).join('\n');
    }

    function revision() {
      if (core()) return `core:${IronDustBrowserV2.epoch}:${IronDustBrowserV2.session.profile.digest}`;
      if(globalThis.GoblinCatalogFullRuntime?.active())return GoblinCatalogFullRuntime.commandRevision();
      return JSON.stringify([currentScenario, legacySession?.sessionId, legacySession?.ruleProfileId, turn, phase, turnPhase, gameOver,
        [...terrain], [...terrainTypes], units.map(({ moveFrom, justHit, ...unit }) => unit)]);
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
      if (!['movement', 'fire', 'gev'].includes(phaseName) || core()) return;
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
      if(globalThis.GoblinCatalogFullRuntime?.active()&&view.componentOwner&&!GoblinCatalogFullRuntime.known(view.componentOwner)){view.componentOwner=null;view.componentId=null;view.target=null;view.intentRevision=null;view.message='';}
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
            missilesRemaining: missilesRemaining ?? null };if(globalThis.GoblinSpecialistsRuntime?.active()){Object.assign(projected,GoblinSpecialistsRuntime.projectUnit(source,source.id===view.actorId?view.previewWeaponKey:null));if(source.catalogSystems){delete projected.hp;delete projected.maxHp;delete projected.infantry;delete projected.defense}}return projected;}),
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
      if (!scenarioCatalog[currentScenario] || !ScenarioRuleProfiles.entries[currentScenario] ||
          legacySession?.scenarioId !== currentScenario ||
          (legacySession.ruleProfileId !== ScenarioRuleProfiles.entries[currentScenario].ruleProfileId &&
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
        if (target?.id !== command.carrierId || !canEmbark(actor, target))
          return { ok: false, reason: t('ui.error.INVALID_TARGET') };
        return { ok: true };
      }
      if (command.type === 'Unload') {
        const cargo = units.find(unit => unit.id === command.cargoId);
        if (!actor.transportCapacity || !canUnloadTo(actor, cargo, command.x, command.y))
          return { ok: false, reason: t('ui.error.INVALID_TARGET') };
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
      const attack = legal.weapon?.attack ?? actor.damage;
      const defense = command.type==='CatalogFire'?legal.defense:effectiveDefense(target);
      const ratioCategory = Number.isFinite(attack) && Number.isFinite(defense)
        ? combatRatio(attack, defense) : command.type==='CatalogFire'&&command.target.componentId==='treads'?'1-1':null;
      return Object.freeze({profileId: legacySession.ruleProfileId,
        stateRevision: revision(), actorId: actor.id, targetId: target.id,
        weaponKey: command.type==='CatalogFire'?command.weaponId:actor.artilleryFire ? legal.weapon.key : actor.ogreSystems||actor.siegeFireBudget ? command.weaponKey??actor.siegeWeapon : null,
        from: {x: actor.x, y: actor.y}, to: {x: target.x, y: target.y},
        legal: true, ratioCategory, ...(command.type==='CatalogFire'&&command.target.componentId==='treads'?{attack,meaning:'tread-roll-5-6'}:{meaning:'crt-attack-effective-defense'})});
    }
    function dispatch(command, expectedRevision) {
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
        if (command.type === 'Unload') {
          const cargo = units.find(unit => unit.id === command.cargoId);
          unloadAt(actor, cargo, command.x, command.y);
          return revision() !== beforeExecution ? { ok: true } : { ok: false, reason: t('ui.error.INVALID_COMMAND') };
        }
        if(command.type==='FireArtillery'&&!GoblinArtilleryWeapons.selectWeapon(actor,GoblinArtilleryWeapons.choice(command.mode,command.spotterId)))return {ok:false,reason:t('ui.error.NO_ATTACKABLE_TARGET')};
        if(command.type==='Fire'&&globalThis.GoblinSiegeWeapons?.active(actor)&&!GoblinSiegeWeapons.selectWeapon(actor,command.weaponKey??actor.siegeWeapon))return {ok:false,reason:t('ui.error.NO_ATTACKABLE_TARGET')};
        if (command.type === 'Fire' && actor.ogreSystems && !SiegebreakerWeapons.selectWeapon(actor, command.weaponKey))
          return { ok: false, reason: t('ui.error.NO_ATTACKABLE_TARGET') };
        const firingWeapon = command.type === 'Fire' && actor.ogreSystems?.weapons[command.weaponKey];
        const readyBefore = firingWeapon ? GoblinSystems.weaponReady(firingWeapon) : null;
        const beforeHex = revision();
        // handleHex is the final, command-history-wrapped Legacy path and checks again.
        handleHex(command.x, command.y);
        if(command.type==='FireArtillery'||command.type==='Fire'&&globalThis.GoblinSiegeWeapons?.active(actor))view.previewWeaponKey=null;
        if (firingWeapon && GoblinSystems.weaponReady(firingWeapon) < readyBefore)
          view.previewWeaponKey = null;
        return revision() !== beforeHex ? { ok: true } : { ok: false, reason: t('ui.error.INVALID_COMMAND') };
      } finally { view.busy = false; render(); }
    }
    function undo() {
      if (core()) return {ok:false,reason:t('v2.undo')};
      if (view.busy || !phaseCommands.length || phase !== 'player' || gameOver) return { ok: false, reason: t('ui.error.ACTION_SPENT') };
      clearContext(); view.previewWeaponKey = null;
      undoPhaseCommand();
      render();
      return { ok: true };
    }
    function resetView() {
      startZoomPending = null;
      view.actorId = null; view.infoCell = null; view.focusCell = null; clearContext();
      view.zoom = 1; view.areaMode = null; view.previewWeaponKey = null;
      fireZoomPhase = null;
      view.phaseSkip = null; clearTimeout(view.phaseSkipTimer); applyMapSize();
      at('#v2-map').scrollLeft = 0; at('#v2-map').scrollTop = 0;
      render();
    }
    globalThis.GoblinUIV2 = Object.freeze({ project, query, previewFire, dispatch, undo, resetView, startView, focusUnit, notifyPhaseSkip,
      get gridVisible() { return view.gridVisible; }, setGridVisible(value) { setViewFlag('gridVisible',value); },
      get targetsVisible() { return view.targetsVisible; }, setTargetsVisible(value) { setViewFlag('targetsVisible',value); },
      get damageVisible() { return view.damageVisible; }, setDamageVisible(value) { setViewFlag('damageVisible',value); },
      refresh: () => { areaCache.key = null; render(); } });
    function setViewFlag(key,value){
      view[key]=!!value;render();
      globalThis.dispatchEvent(new Event('goblin-view-settings-change'));
    }

    function clearContext() { globalThis.GoblinTrainingRuntime?.cancel();view.pendingAction = null;view.target = null; view.intentRevision = null; view.message = '';view.componentId=null;view.componentOwner=null;view.specialFireMode='direct';view.specialSpotterId=null; }
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
    function nextReadyUnit() {
      const ids = readyUnitIds(), order = project().units.filter(unit => unit.team === 'player').map(unit => unit.id);
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
    // Weapon and system rows of a Goblin-class unit (Legacy systems or catalog components).
    function renderSystems(host, state, unit) {
      const entry = state.systems.find(item => item.id === unit.id);
      if (unit.catalogSystems) { GoblinSpecialistsUI.renderSystemFacts(host, unit); return; }
      const weapons = entry?.summary.weapons || Object.fromEntries(Object.entries(unit.weapons || {}).map(([key, weapon]) => [key, weapon.ready]));
      for (const [key, count] of Object.entries(weapons)) {
        const raw = unit.ogreSystems?.weapons[key];
        const line = el('div', 'v2-system-row');
        line.append(el('span', '', t(`v2.ui.weapon.${key}`)), el('strong', '', raw
          ? `${Math.max(0, Math.min(raw.remaining, raw.count - raw.destroyed))}/${raw.count} · ${t('v2.ui.weaponDamage', {count: raw.destroyed})}` : String(count)));
        host.append(line);
      }
    }
    // Left column: own units with art, strength and whether they can still act this phase.
    function renderRoster(state, details) {
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
    // Field intel sections (unit and field), each switchable; the choice is a local display preference.
    const intelSectionsKey = 'goblin.v2.intelSections';
    const intelSections = (() => {
      try { const stored = JSON.parse(localStorage.getItem(intelSectionsKey)); if (stored && typeof stored === 'object') return {unit: stored.unit !== false, field: stored.field !== false}; } catch {}
      return {unit: true, field: true};
    })();
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
      for (const [label, value, share, tone] of cells) {
        const cell = el('div', `v2-intel-stat${tone ? ` v2-tone-${tone}` : ''}`);
        cell.append(el('span', '', label), el('strong', '', String(value)));
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
      for (const button of at('#v2-intel-switches').querySelectorAll('[data-section]')) {
        const section = button.dataset.section, label = t(`v2.intel.${section}`);
        button.lastElementChild.textContent = label;
        button.setAttribute('aria-pressed', String(intelSections[section]));
        button.title = t(intelSections[section] ? 'v2.intel.hide' : 'v2.intel.show', {section: label});
        button.setAttribute('aria-label', button.title);
      }
      const intel = at('#v2-intel'); intel.replaceChildren();
      const focus = view.target || view.infoCell;
      const occupant = focus && state.units.find(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === focus.x && unit.y === focus.y);
      const unit = occupant || (unitAlive(actor) ? actor : null);
      const cell = focus || (unit && !unit.embarkedOn ? {x: unit.x, y: unit.y} : null);
      if (!unit && !cell) { intel.append(el('p', 'v2-intel-empty', t('v2.intel.empty'))); return; }
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
        // Goblin-class units take attack and range from the selected weapon.
        const weapon = (unit.weapons || unit.ogreSystems?.weapons)?.[unit.selectedWeapon ?? unit.ogreSystems?.selectedWeapon];
        // A Goblin moves according to its remaining treads.
        const treadMove = treads && !unit.catalogSystems ? globalThis.GoblinSystems?.movementForTreads(treads[0]) : null;
        const value = key => Number.isFinite(unit[key]) ? unit[key] : Number.isFinite(weapon?.[key]) ? weapon[key] : key === 'move' && Number.isFinite(treadMove) ? treadMove : null;
        section.append(statGrid(['attack', 'defense', 'range', 'move'].map(key =>
          [t(`v2.intel.${key}`), value(key) ?? '–', value(key) == null ? null : Math.min(1, value(key) / max(key))])));
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
    for (const button of at('#v2-intel-switches').querySelectorAll('[data-section]'))
      button.onclick = () => {
        intelSections[button.dataset.section] = !intelSections[button.dataset.section];
        try { localStorage.setItem(intelSectionsKey, JSON.stringify(intelSections)); } catch {}
        render();
      };
    function positionCommandMenu(state) {
      const card = at('#v2-command-card');
      if (card.hidden || !view.actorId) return;
      const placed = (state.units || []).filter(unit => unitAlive(unit) && !unit.embarkedOn);
      const actor = placed.find(unit => unit.id === view.actorId);
      placeNearHex(card, actor || view.target, placed.filter(unit => unit.id !== actor?.id), []);
    }
    // Floats a card above a hex (below or beside it as fallback) inside the map. Hexes in keepClear stay
    // visible, other units preferably too; without room the card sits centred at the top of the map.
    function placeNearHex(card, anchorCell, others, keepClear) {
      if (!anchorCell) return;
      card.style.left = '-9999px'; card.style.top = '0';
      const frame = at('#v2-map').getBoundingClientRect(), box = card.getBoundingClientRect();
      const screen = cell => { const point = nativeMap.createSVGPoint(); Object.assign(point, hexCenter(cell.x, cell.y)); return point.matrixTransform(nativeMap.getScreenCTM()); };
      const anchor = screen(anchorCell), row = screen({x: anchorCell.x, y: anchorCell.y + 1});
      const clear = keepClear.map(screen), units = others.map(screen);
      const inset = 8, gap = Math.max(26, Math.abs(row.y - anchor.y) * .62), w = box.width, h = box.height;
      const centered = Math.min(Math.max(anchor.x - w / 2, frame.left + inset), frame.right - inset - w);
      const candidates = [
        {x:centered,y:anchor.y-gap-h,pointer:'down'}, {x:centered,y:anchor.y+gap,pointer:'up'},
        {x:anchor.x+gap,y:anchor.y-h/2,pointer:''}, {x:anchor.x-gap-w,y:anchor.y-h/2,pointer:''}
      ];
      const fits = blockers => candidates.find(({x,y}) => x>=frame.left+inset && y>=frame.top+inset &&
        x+w<=frame.right-inset && y+h<=frame.bottom-inset &&
        !blockers.some(point => point.x>=x-20 && point.x<=x+w+20 && point.y>=y-20 && point.y<=y+h+20));
      const placement = anchor.x >= frame.left && anchor.x <= frame.right && anchor.y >= frame.top && anchor.y <= frame.bottom
        ? fits([...clear, ...units]) || fits(clear) : null;
      const left = placement ? placement.x : Math.max(inset, frame.left + (frame.width - w) / 2);
      const top = placement ? placement.y : Math.max(inset, Math.min(frame.top + inset, innerHeight - h - inset));
      card.dataset.placement = placement ? 'hex' : 'panel';
      card.dataset.pointer = placement?.pointer || '';
      card.style.left = `${left}px`; card.style.top = `${top}px`;
      card.style.setProperty?.('--v2-pointer-x', `${Math.round(anchor.x - left)}px`);
    }
    const COMMAND_ICONS = {Move:'movement', Fire:'fire', PlayerFire:'fire', CatalogFire:'fire', CatalogHexFire:'fire', Ram:'ram', CatalogRam:'ram',
      Embark:'embark', CatalogLoad:'embark', Unload:'unload', CatalogDeploy:'unload', Engineer:'tool'};
    const SLOT_LABELS = {movement:'v2.ui.move', fire:'v2.ui.fire', ram:'v2.ui.ram'};
    // An action is a command without its target: the same action applies to every hex it is legal on.
    const TARGET_FIELDS = new Set(['x', 'y', 'to', 'targetId', 'carrierId', 'target', 'bayId', 'playerId', 'unitId', 'actorId']);
    const commandIcon = command => COMMAND_ICONS[command.type] ?? (command.type.includes('Fire') ? 'fire' : 'action');
    const actionKey = command => JSON.stringify([command.type, ...Object.keys(command).filter(key => !TARGET_FIELDS.has(key)).sort().map(key => [key, command[key]])]);
    // Specialist component and fire-mode choices are made after the target, before the order runs.
    const needsOptions = command => !!globalThis.GoblinSpecialistsRuntime?.active() && (command.type === 'CatalogFire' || command.type === 'Engineer' && command.job === 'repair-component');
    const actionCache = { key: null, value: null };
    function availableActions(state, actor) {
      const ready = state.phase === 'player' && !state.gameOver && readyUnitIds().includes(actor.id);
      const key = JSON.stringify([revision(), actor.id, state.turnPhase, ready, view.previewWeaponKey, view.specialFireMode, view.specialSpotterId]);
      if (actionCache.key === key) return actionCache.value;
      const slots = (state.turnPhase === 'fire' ? ['fire', 'ram'] : ['movement', 'fire', 'ram']).map(icon => ({icon, label: t(SLOT_LABELS[icon]), ok: false}));
      const cells = core() ? state.cells.map(({x, y}) => ({x, y})) : Array.from({length: H}, (_, y) => Array.from({length: W}, (_, x) => ({x, y}))).flat();
      if (ready) for (const cell of cells) for (const entry of targetCommands(state, actor, cell)) {
        const icon = commandIcon(entry.command), key = actionKey(entry.command);
        const slot = slots.find(item => item.key === key) || slots.find(item => item.icon === icon && !item.key) || slots[slots.push({icon}) - 1];
        if (!slot.key) Object.assign(slot, {key, label: entry.label, ok: false});
        if (!slot.ok && (needsOptions(entry.command) || query(entry.command).ok)) slot.ok = true;
      }
      actionCache.key = key; actionCache.value = slots;
      return slots;
    }
    function renderCommandMenu(state, actor) {
      const card = at('#v2-command-card'), actions = at('#v2-actions'), footer = at('#v2-command-footer');
      actions.replaceChildren(); footer.replaceChildren();
      const open = !!(view.actorId && view.menuOpen && !view.pendingAction && unitAlive(actor) && !GameDialogs.isOpen() && !document.body.classList.contains('v2-screen-open'));
      card.hidden = !open; document.body.classList.toggle('v2-menu-open', open);
      if (!open) return;
      card.setAttribute('aria-label', t('v2.command.menu', {name: actor.name}));
      const hint = at('#v2-command-target'), detail = at('#v2-command-intel');
      renderWeaponControls(state, actor, at('#v2-command-weapons'));
      at('#v2-command-body').hidden = at('#v2-command-weapons').hidden;
      const playing = state.phase === 'player' && !state.gameOver, slots = availableActions(state, actor), usable = slots.some(slot => slot.ok);
      const showHint = () => { hint.textContent = usable ? t('v2.command.chooseAction') : t('v2.ui.noAction');
        detail.textContent = usable ? '' : playing ? t('v2.command.acted') : t('v2.enemy'); };
      for (const slot of slots) {
        const button = el('button', `v2-icon-button v2-command-${slot.icon}`);
        button.type = 'button'; button.innerHTML = svgIcon(slot.icon);
        button.disabled = !slot.ok || view.busy;
        button.title = `${slot.label} · ${slot.ok ? t('v2.command.pickTarget') : playing && !readyUnitIds().includes(actor.id) ? t('v2.command.acted') : t('v2.ui.noAction')}`;
        button.setAttribute('aria-label', button.title);
        if (slot.ok) {
          button.dataset.action = slot.key;
          button.onmouseenter = button.onfocus = () => { hint.textContent = slot.label; detail.textContent = t('v2.command.pickTarget'); };
          button.onclick = () => chooseAction(slot.key);
        }
        actions.append(button);
      }
      showHint();
      actions.onmouseleave = showHint;
      const info = el('button', 'v2-icon-button v2-command-info'); info.type = 'button'; info.id = 'v2-command-info';
      info.innerHTML = svgIcon('info'); info.title = t('v2.intel.library', {name: actor.name}); info.setAttribute('aria-label', info.title);
      info.onclick = () => globalThis.GoblinV2Flow?.openLibrary('unit', actor.id);
      // Closing the menu drops the selection.
      const cancel = el('button', 'v2-icon-button v2-command-close'); cancel.type = 'button'; cancel.id = 'v2-command-cancel';
      cancel.innerHTML = svgIcon('close'); cancel.title = t('ui.dialog.cancel'); cancel.setAttribute('aria-label', cancel.title);
      cancel.onclick = () => { view.actorId = null; view.previewWeaponKey = null; view.menuOpen = false; clearContext(); render(); at('#v2-map').focus({preventScroll:true}); };
      footer.append(info, cancel);
      positionCommandMenu(state);
    }
    // The active action stays visible in the command bar until it runs or is cancelled.
    function renderActionChip(state, actor) {
      const chip = at('#v2-action-chip'), pending = view.pendingAction;
      if (pending && (!unitAlive(actor) || pending.phase !== `${state.phase}:${state.turnPhase}` || state.gameOver)) { view.pendingAction = null; view.target = null; }
      chip.replaceChildren();
      chip.hidden = !view.pendingAction || GameDialogs.isOpen() || document.body.classList.contains('v2-screen-open');
      renderTargetCard(state, actor);
      if (chip.hidden) return;
      const text = el('span', 'v2-action-text');
      text.append(el('strong', '', pending.label), el('span', 'v2-action-detail', `${actor.name} · ${view.target ? hexLabel(view.target) : t('v2.command.pickTarget')}`));
      chip.append(Object.assign(el('span', 'v2-action-icon'), {innerHTML: svgIcon(pending.icon)}), text);
      const cancel = el('button', 'v2-icon-button v2-action-cancel'); cancel.type = 'button'; cancel.id = 'v2-action-cancel';
      cancel.innerHTML = svgIcon('close'); cancel.title = t('v2.action.cancel'); cancel.setAttribute('aria-label', cancel.title);
      cancel.onclick = () => { clearContext(); view.menuOpen = true; render(); };
      chip.append(cancel);
    }
    // Chance to affect the target from the combat results table; tread hits need a 5 or 6.
    function hitChance(preview) {
      if (!preview) return null;
      if (preview.meaning === 'tread-roll-5-6') return {ratio: '5–6', hit: 2 / 6, destroy: null};
      const band = preview.ratioCategory === '5-1' ? Array(6).fill('X') : COMBAT_RULES.crt[preview.ratioCategory];
      return band ? {ratio: preview.ratioCategory.replace('-', ':'), hit: band.filter(result => result !== 'NE').length / 6,
        destroy: band.filter(result => result === 'X').length / 6} : null;
    }
    // Card over the chosen target: what happens (path, odds), extra choices, and the confirmation.
    function renderTargetCard(state, actor) {
      const card = at('#v2-target-card'), pending = view.pendingAction;
      card.replaceChildren();
      const entry = pending && view.target && !GameDialogs.isOpen() && !document.body.classList.contains('v2-screen-open') &&
        targetCommands(state, actor, view.target).find(item => actionKey(item.command) === pending.key);
      card.hidden = !entry;
      if (!entry) return;
      const availability = query(entry.command);
      const occupant = state.units.find(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
      const head = el('div', 'v2-target-head');
      const title = el('strong', '', entry.label); title.id = 'v2-target-title';
      head.append(Object.assign(el('span', 'v2-action-icon'), {innerHTML: svgIcon(pending.icon)}), title);
      card.append(head, el('p', 'v2-target-where', [occupant ? occupant.name : '', hexLabel(view.target)].filter(Boolean).join(' · ')));
      const facts = el('div', 'v2-target-facts');
      if (availability.ok && entry.command.type === 'Move' && availability.path) facts.append(el('span', '', t('v2.ui.pathSteps', {count: availability.path.length})));
      const chance = availability.ok && pending.icon === 'fire' ? hitChance(previewFire(entry.command)) : null;
      if (chance) {
        facts.append(el('span', 'v2-target-ratio', chance.ratio), el('strong', 'v2-target-chance', t('v2.target.hit', {percent: Math.round(chance.hit * 100)})));
        if (chance.destroy !== null) facts.append(el('span', '', t('v2.target.destroy', {percent: Math.round(chance.destroy * 100)})));
      }
      if (!availability.ok) facts.append(el('span', 'v2-target-blocked', availability.reason));
      if (facts.childElementCount) card.append(facts);
      const options = el('div', 'v2-target-options'); options.id = 'v2-specialist-target-controls';
      if (globalThis.GoblinSpecialistsRuntime?.active()) GoblinSpecialistsUI.renderTargets(options, state, actor, occupant, view, render);
      if (options.childElementCount) card.append(options);
      const actions = el('div', 'v2-target-actions');
      const execute = el('button', 'v2-action-execute', t('v2.action.execute')); execute.type = 'button'; execute.id = 'v2-action-execute';
      execute.disabled = !availability.ok || view.busy;
      execute.onclick = () => runCommand(state, entry);
      const back = el('button', 'v2-icon-button v2-action-cancel'); back.type = 'button'; back.id = 'v2-target-cancel';
      back.innerHTML = svgIcon('close'); back.title = t('v2.target.other'); back.setAttribute('aria-label', back.title);
      back.onclick = () => { view.target = null; render(); };
      actions.append(execute, back);
      card.append(actions);
      const placed = state.units.filter(unit => unitAlive(unit) && !unit.embarkedOn);
      placeNearHex(card, view.target, placed.filter(unit => unit.id !== actor.id && unit !== occupant), [actor]);
    }
    // Runs an order; a missile strike asks first. After it the unit stays selected with the menu closed.
    async function runCommand(state, entry) {
      const {command, keepTarget, confirmSplash} = entry, expectedRevision = view.intentRevision;
      if (confirmSplash) {
        const strike = globalThis.StrategicMissile.STRIKE;
        const affected = state.units.filter(unit => unitAlive(unit) && !unit.embarkedOn && (command.type!=='CatalogHexFire'||unit.team==='player') &&
          dist(unit, view.target) <= strike.radius).map(unit => `${unit.name} (${t(unit.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')})`);
        const accepted = await GameDialogs.confirm({id:'v2-splash-confirm',title:t('v2.ui.missile'),
          message:`${t('v2.ui.sector')} ${hexLabel(view.target)} · ${t('v2.ui.missileSplash')} · ${t('v2.ui.missileImpact',{direct:strike.directAttack,adjacent:strike.splashAttack})}${affected.length ? ` · ${affected.join(', ')}` : ''}`,
          acceptLabel:t('ui.hud.intent.confirm'),cancelLabel:t('ui.dialog.cancel')});
        if (!accepted) { render(); return; }
      }
      const pending = view.pendingAction, result = dispatch(command, expectedRevision);
      if (result.ok) {
        clearContext(); view.menuOpen = false;
        // Catalog fire stays armed for the next component or weapon of the same unit.
        if (keepTarget) view.pendingAction = pending;
      } else if (view.intentRevision !== revision()) view.intentRevision = revision();
      view.message = result.ok ? '' : result.reason;
      render();
      if (result.ok) at('#v2-map').focus({preventScroll:true});
    }
    // Picks an action from the menu: the menu closes, its range shows and the next map click is the target.
    function chooseAction(key) {
      const state = project(), actor = state.units.find(unit => unit.id === view.actorId);
      const slot = actor && availableActions(state, actor).find(item => item.key === key && item.ok);
      if (!slot) return;
      clearContext();
      view.pendingAction = {key, icon: slot.icon, label: slot.label, phase: `${state.phase}:${state.turnPhase}`};
      view.menuOpen = false; view.areaMode = slot.icon === 'fire' ? 'fire' : 'movement';
      render();
      at('#v2-map').focus({preventScroll:true});
    }
    function chooseActor(id, openMenu = true) {
      startZoomPending = null;
      const unit = (core() ? project().units : globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units).find(item => item.id === id && item.team === 'player' && unitAlive(item));
      view.actorId = unit?.id || null;
      view.areaMode = null; view.previewWeaponKey = null;
      if (unit) { view.focusCell = { x: unit.x, y: unit.y }; view.infoCell = { x: unit.x, y: unit.y }; }
      clearContext(); view.menuOpen = !!unit && openMenu; render();
      if(unit)globalThis.GoblinTrainingRuntime?.select(unit.id);
      if (view.menuOpen) at('#v2-actions button:not(:disabled)')?.focus({preventScroll:true});
    }
    function focusUnit(id) {
      const unit = (core() ? project().units : globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units).find(item => item.id === id && unitAlive(item));
      if (!unit) return;
      if (unit.team === 'player') chooseActor(id);
      else {
        view.actorId = null; view.previewWeaponKey = null; view.focusCell = { x: unit.x, y: unit.y };
        view.infoCell = { ...view.focusCell }; clearContext(); render();
      }
      at('#v2-map').focus({ preventScroll: true });
      const hex = unit && nativeMap.querySelector(`.hex[data-x="${unit.x}"][data-y="${unit.y}"]`);
      centerOnHex(hex);
    }
    function chooseHex(x, y) {
      startZoomPending = null;
      const state = project(), cell = {x, y};
      const unit = state.units.find(item => unitAlive(item) && !item.embarkedOn && item.x === x && item.y === y);
      const actor = state.units.find(item => item.id === view.actorId && unitAlive(item));
      if (view.pendingAction && actor) {
        const matches = targetCommands(state, actor, cell).filter(entry => actionKey(entry.command) === view.pendingAction.key);
        const entry = matches.find(item => needsOptions(item.command) || query(item.command).ok);
        if (entry) { aimAction(actor, cell); return; }
        if (unit?.team === 'player') { chooseActor(unit.id); return; }
        const reason = matches.length ? query(matches[0].command).reason : t('v2.action.noTarget');
        clearContext(); view.menuOpen = false; view.infoCell = cell; view.focusCell = cell;
        view.message = t('v2.action.cancelled', {reason}); render();
        return;
      }
      if (unit?.team === 'player') { chooseActor(unit.id); return; }
      clearContext(); view.menuOpen = false; view.infoCell = cell; view.focusCell = cell; render();
    }
    // A target for the active action opens its card; the order runs only after the confirmation there.
    function aimAction(actor, cell) {
      const {x, y} = cell;
      if(view.target?.x!==x||view.target?.y!==y){view.componentOwner=null;view.componentId=null;}
      view.target = { x, y }; view.infoCell = { x, y }; view.focusCell = { x, y };
      view.intentRevision = revision(); view.message = '';
      if(actor){const command={type:turnPhase==='fire'?'Fire':'Move',actorId:actor.id,x,y};globalThis.GoblinTrainingRuntime?.inspect(command,query(command),turnPhase==='fire'?previewFire(command):null);}
      render(); at('#v2-action-execute')?.focus({preventScroll:true});
    }
    const areaCache = { key: null, value: null };
    let areaPhase = null;
    let fireZoomPhase = null;
    let startZoomMission = null, startZoomPending = null;
    function syncAreaPhase(state) {
      const key = `${state.phase}:${state.turnPhase}`;
      if (areaPhase !== key) { view.areaMode = null; view.previewWeaponKey = null; areaPhase = key; }
    }
    function previewWeaponKey(actor) {
      if(globalThis.GoblinSpecialistsRuntime?.active())return view.previewWeaponKey??actor?.selectedSlot??actor?.selectedWeapon??null;
      return core() ? actor?.selectedWeapon : view.previewWeaponKey ||
        units.find(unit => unit.id === actor?.id)?.artilleryChoice || units.find(unit => unit.id === actor?.id)?.siegeWeapon || units.find(unit => unit.id === actor?.id)?.ogreSystems?.selectedWeapon;
    }
    function renderWeaponControls(state, actor, container) {
      if(globalThis.GoblinSpecialistsRuntime?.active())return GoblinSpecialistsUI.renderWeapons(container,state,actor,view,render);
      container.replaceChildren();
      const runtime = core() ? actor : units.find(unit => unit.id === actor?.id);
      const artillery=!!globalThis.GoblinArtilleryWeapons?.active(runtime);
      const siege=!!globalThis.GoblinSiegeWeapons?.active(runtime);
      const weapons = core() ? actor?.weapons : artillery?GoblinArtilleryWeapons.weapons(actor):siege?GoblinSiegeWeapons.weapons(actor):runtime?.ogreSystems?.weapons;
      const visible = !!weapons && state.phase === 'player' && state.turnPhase === 'fire' &&
        !state.gameOver && !GameDialogs.isOpen() && !document.body.classList.contains('v2-screen-open');
      container.hidden = !visible;
      if (!visible) return;
      container.setAttribute('role', 'group');
      container.setAttribute('aria-label', t('v2.area.weaponChoice'));
      const selectedKey = previewWeaponKey(actor);
      for (const [key, weapon] of Object.entries(weapons)) {
        const ready = core()||siege||artillery ? weapon.ready : GoblinSystems.weaponReady(weapon);
        const canChoose = !actor.disabled && ready > 0 && !view.busy && (!(siege||artillery)||!globalThis.GoblinMovement?.busy()) &&
          (!core() || query({ type: 'SelectWeapon', playerId: 'player', unitId: actor.id,
            weaponKey: key }).ok);
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.weapon = key;
        button.setAttribute('aria-pressed', String(selectedKey === key));
        // Name and count in two lines; the hidden separator keeps the one-line text for assistive tech.
        for (const [tag, className, text] of [['span', 'v2-weapon-name', siege||artillery?weapon.label:t(`v2.ui.weapon.${key}`)], ['span', 'v2-sr', ' · '],
          ['small', 'v2-weapon-count', t('v2.area.weaponAvailable', {count:ready})]]) button.appendChild(Object.assign(document.createElement(tag), {className, textContent: text}));
        button.title = artillery&&weapon.unavailableReason?GoblinArtilleryWeapons.message(weapon.unavailableReason):ready <= 0 ? (siege?GoblinSiegeWeapons.message('WEAPON_SPENT',key):t('v2.area.weaponEmpty')) :
          actor.disabled ? t('v2.ui.disabled') : t('v2.area.weaponChoice');
        button.disabled = !canChoose;
        button.onclick = event => {
          event.stopPropagation();
          if (key === previewWeaponKey(actor)) return;
          if (core()) {
            const result = dispatch({ type: 'SelectWeapon', playerId: 'player', unitId: actor.id,
              weaponKey: key }, revision());
            if (!result.ok) { view.message = result.reason; render(); return; }
            view.intentRevision = revision();
          } else view.previewWeaponKey = key;
          render();
        };
        container.append(button);
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
        if (state.turnPhase === 'movement' && runtime.moved || state.turnPhase === 'gev' && runtime.secondMoved) {
          data.status = 'unavailable'; data.reason = t('ui.error.ACTION_SPENT'); return data;
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
        data.status = data.legal.length ? 'move' : 'blocked';
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
      const weaponKey = previewWeaponKey(actor);
      if(globalThis.GoblinCatalogFullRuntime?.active()&&actor.catalogId==='U13'){for(let y=0;y<H;y++)for(let x=0;x<W;x++){const result=areaQuery({type:'CatalogHexFire',actorId:actor.id,x,y});(result.ok?data.legal:data.blocked).push({x,y});}data.status=data.legal.length?'fire':'blocked';return data;}
      for (const target of state.units.filter(unit => unit.team === 'enemy' && unitAlive(unit) && !unit.embarkedOn)) {
        const command = globalThis.GoblinSpecialistsRuntime?.active()?GoblinSpecialistsUI.fireCommand(actor,target,view,true):globalThis.GoblinArtilleryWeapons?.active(runtime)?GoblinArtilleryWeapons.command(runtime,target,weaponKey):core() ? { type: 'PlayerFire', playerId: 'player', unitId: actor.id,
          targetId: target.id, ...(weaponKey ? { weaponKey } : {}) } :
          { type: 'Fire', actorId: actor.id, x: target.x, y: target.y,
            ...(weaponKey ? { weaponKey } : {}) };
        const result = areaQuery(command);
        if (result.ok) data.legal.push({ x: target.x, y: target.y });
        else if (mode === 'fire') data.blocked.push({ x: target.x, y: target.y, reason: result.reason });
      }
      data.status = mode === 'los' ? 'coreSight' :
        data.legal.length ? 'fire' : 'blocked';
      data.reason = mode === 'fire' && !data.legal.length ?
        (data.blocked.find(item => item.reason)?.reason || t('v2.area.noLegalTarget')) : '';
      return data;
    }
    function selectedFirePreview(state, actor, runtime, mode, weaponKey, legal) {
      if (mode !== 'fire' || !actor || !view.target) return null;
      const target = state.units.find(unit => unit.team === 'enemy' && unitAlive(unit) &&
        !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
      if (!target || !legal.some(cell => cell.x === target.x && cell.y === target.y)) return null;
      const selectedWeapon = (actor.weapons || runtime?.ogreSystems || actor.catalogSystems || actor.catalogFire || actor.siegeFireBudget || actor.artilleryFire) ? weaponKey ?? null : null;
      const command = globalThis.GoblinSpecialistsRuntime?.active()?GoblinSpecialistsUI.fireCommand(actor,target,view):globalThis.GoblinArtilleryWeapons?.active(runtime)?GoblinArtilleryWeapons.command(runtime,target,selectedWeapon):core() ? {type: 'PlayerFire', playerId: 'player', unitId: actor.id,
        targetId: target.id, ...(selectedWeapon ? {weaponKey: selectedWeapon} : {})} :
        {type: 'Fire', actorId: actor.id, x: target.x, y: target.y,
          ...(selectedWeapon ? {weaponKey: selectedWeapon} : {})};
      const preview = previewFire(command);
      return preview?.legal && (preview.meaning === 'crt-attack-effective-defense'||state.profile==='CATALOG_SPECIALISTS_v1'&&preview.meaning==='tread-roll-5-6') &&
        preview.profileId === state.profile && preview.stateRevision === state.revision &&
        preview.actorId === actor.id && preview.targetId === target.id &&
        preview.weaponKey === selectedWeapon && preview.from?.x === actor.x &&
        preview.from?.y === actor.y && preview.to?.x === target.x &&
        preview.to?.y === target.y ? preview : null;
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
      renderWeaponControls(state, actor, at('#v2-weapon-controls'));
      const mode = activeAreaMode(state);
      for (const button of at('#v2-area-controls').querySelectorAll('[data-area]')) {
        const key = button.dataset.area;
        button.title = t(`v2.area.${key}`); button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-pressed', String(mode === key));
      }
      const gridButton = at('#v2-area-grid');
      gridButton.title = t('v2.area.grid'); gridButton.setAttribute('aria-label', gridButton.title);
      gridButton.setAttribute('aria-pressed', String(view.gridVisible));
      for(const [key,label] of [['targets','missionTargets'],['damage','damage']]){
        const button=at(`#v2-area-${key}`);
        button.title=t(`v2.display.${key}`);
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
        grid.replaceChildren();
        const cells = core() ? state.cells : Array.from({ length: W * H }, (_, index) => ({ x: index % W, y: Math.floor(index / W) }));
        for (const cell of cells) { const shape = document.createElementNS(NS, 'polygon');
          shape.setAttribute('points', hexPoints(cell.x, cell.y)); shape.classList.add('v2-grid-line'); grid.append(shape); }
      } else grid?.remove();
      let overlay = nativeMap.querySelector('#v2-area-overlay');
      if (!overlay) { overlay = document.createElementNS(NS, 'g'); overlay.id = 'v2-area-overlay';
        overlay.setAttribute('pointer-events', 'none'); nativeMap.insertBefore(overlay, nativeMap.querySelector('.unit-svg,#v2-team-markers')); }
      overlay.replaceChildren();
      const legend = at('#v2-area-legend');
      if (!mode || document.body.classList.contains('v2-screen-open')) { legend.textContent = ''; return; }
      const runtime = core() ? actor : units.find(unit => unit.id === actor?.id);
      const weaponKey = previewWeaponKey(actor);
      const weapon = core() ? actor?.weapons?.[weaponKey] : globalThis.GoblinSpecialistsRuntime?.active()?GoblinSpecialistsRuntime.selectedSpec(actor,weaponKey): globalThis.GoblinArtilleryWeapons?.active(runtime)?GoblinArtilleryWeapons.weapons(actor)?.[weaponKey]:globalThis.GoblinSiegeWeapons?.active(runtime)?GoblinSiegeWeapons.weapons(actor)?.[weaponKey]:runtime?.ogreSystems?.weapons?.[weaponKey];
      const key = JSON.stringify([core(), state.revision, state.phase, state.turnPhase,
        actor?.id, mode, weaponKey, GoblinLanguage.current, !!globalThis.GoblinMovement?.busy(),...(globalThis.GoblinSpecialistsRuntime?.active()?[view.componentOwner,view.componentId,view.specialFireMode,view.specialSpotterId]:[])]);
      if (areaCache.key !== key) { areaCache.key = key; areaCache.value = areaData(state, actor, mode); }
      const data = areaCache.value;
      const hexWidth = Math.sqrt(3) * S;
      const referenceScale = hexWidth / 112;
      const mapWidth = nativeMap.getBoundingClientRect().width || nativeMap.clientWidth ||
        Number.parseFloat(nativeMap.style.width) || nativeMap.viewBox.baseVal.width;
      const pixelScale = mapWidth / nativeMap.viewBox.baseVal.width;
      const showCostChips = hexWidth * pixelScale >= 50 && !matchMedia('(max-width: 599px)').matches;
      function mark(cell, kind) {
        const shape = document.createElementNS(NS, 'polygon');
        shape.setAttribute('points', hexPoints(cell.x, cell.y)); shape.classList.add(`v2-area-${kind}`);
        shape.dataset.x = String(cell.x); shape.dataset.y = String(cell.y);
        overlay.append(shape);
        if (kind === 'movement' && showCostChips && Number.isFinite(cell.cost)) {
          const center = hexCenter(cell.x, cell.y);
          const width = Math.max(28 * referenceScale, 24 / pixelScale);
          const height = Math.max(24 * referenceScale, 20 / pixelScale);
          const middleY = center.y + S - height / 2 - 4 * referenceScale;
          const chip = document.createElementNS(NS, 'rect');
          chip.classList.add('v2-area-cost-chip');
          chip.setAttribute('x', center.x - width / 2); chip.setAttribute('y', middleY - height / 2);
          chip.setAttribute('width', width); chip.setAttribute('height', height);
          chip.setAttribute('rx', 4 * referenceScale);
          chip.dataset.x = String(cell.x); chip.dataset.y = String(cell.y);
          const label = document.createElementNS(NS, 'text');
          label.classList.add('v2-area-cost'); label.setAttribute('x', center.x);
          label.setAttribute('y', middleY);
          label.setAttribute('font-size', Math.max(13 * referenceScale, 11 / pixelScale));
          label.dataset.x = String(cell.x); label.dataset.y = String(cell.y);
          label.textContent = String(cell.cost);
          overlay.append(chip, label);
        }
      }
      const areaKind = mode === 'movement' ? 'movement' : mode === 'fire' ? 'fire' : 'sight';
      for (const cell of data.legal) mark(cell, areaKind);
      if (data.legal.length) overlay.append(areaEdge(data.legal, areaKind));
      if (mode !== 'los') for (const cell of data.blocked) mark(cell, 'blocked');
      if(globalThis.GoblinCatalogFullRuntime?.active()&&actor?.catalogId==='U13'&&mode==='fire'&&view.target){const strike=GoblinCatalogFullRuntime.hexQuery({type:'CatalogHexFire',actorId:actor.id,...view.target});if(strike.ok)for(const [i,cell] of strike.footprint.entries()){const shape=document.createElementNS(NS,'polygon');shape.setAttribute('points',hexPoints(cell.x,cell.y));shape.classList.add('v2-full-blast',i===0?'v2-full-blast-center':'v2-full-blast-adjacent');shape.setAttribute('aria-hidden','true');overlay.append(shape);}}
      const firePreview = selectedFirePreview(state, actor, runtime, mode, weaponKey, data.legal);
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
          if (!at('#v2-command-card').hidden)
            at('#v2-command-intel').textContent += ` · ${firePreview.meaning==='tread-roll-5-6'?t('v2.ui.treads'):'CRT'} ${ratioLabel}`;
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
      let message = t(mode === 'movement' && data.status === 'move' && !showCostChips
        ? 'v2.area.status.moveCompact' : `v2.area.status.${data.status}`, { count: data.legal.length });
      if (weapon && mode === 'fire') message += ` · ${!core()&&globalThis.GoblinSpecialistsRuntime?.active()?GoblinSpecialistsUI.weaponLabel(actor,weapon):weapon.label}`;
      if (data.reason) message += ` · ${data.reason}`;
      if (mode === 'movement') {
        const focused = view.target || view.infoCell || view.focusCell;
        const cell = focused && data.legal.find(item => item.x === focused.x && item.y === focused.y);
        if (cell && Number.isFinite(cell.cost)) {
          const costText = `${hexLabel(focused)} · ${GoblinLanguage.translate('MOVE COST')} ${cell.cost}`;
          message += ` · ${t('v2.ui.sector')} ${costText}`;
          if (!showCostChips) {
            at('#v2-map-caption').textContent = costText;
            if (view.target && !at('#v2-command-card').hidden)
              at('#v2-command-intel').textContent += ` · ${GoblinLanguage.translate('MOVE COST')} ${cell.cost}`;
          }
        }
      }
      if (view.target && mode === 'movement' && data.status === 'move' &&
          !data.legal.some(cell => cell.x === view.target.x && cell.y === view.target.y)) {
        const rejected = areaQuery(core() ? { type: 'Move', playerId: 'player', unitId: actor.id, to: view.target } :
          { type: 'Move', actorId: actor.id, ...view.target });
        if (!rejected.ok) message += ` · ${t('v2.area.status.blocked')}: ${rejected.reason}`;
      }
      legend.textContent = message;
    }
    // Orders of the selected unit against one hex, per runtime; the action menu offers them as actions.
    function coreCommands(state, actor, cell) {
      const commands=[];
      if (cell && actor) {
        const target=state.units.find(unit => unitAlive(unit) && unit.x===cell.x && unit.y===cell.y);
        if (state.turnPhase==='fire' && target?.team==='enemy') {
          if (actor.weapons) {
            const key = previewWeaponKey(actor), weapon = actor.weapons[key];
            commands.push({command:{type:'PlayerFire',playerId:'player',unitId:actor.id,targetId:target.id,weaponKey:key},
              label:`${t(`v2.ui.weapon.${key}`)} · A${weapon.attack} R${weapon.range} · ${weapon.ready} ${t('v2.ui.ready')} · ${t('v2.ui.fire')}`});
          }
          else commands.push({command:{type:'PlayerFire',playerId:'player',unitId:actor.id,targetId:target.id},label:t('v2.ui.fire')});
        } else if (state.turnPhase!=='fire') {
          if (target?.team==='enemy') commands.push({command:{type:'Ram',playerId:'player',unitId:actor.id,targetId:target.id},label:t('v2.ui.ram')});
          else if (!target) commands.push({command:{type:'Move',playerId:'player',unitId:actor.id,to:{...cell}},label:t('v2.ui.move')});
        }
      }
      return commands;
    }
    function legacyCommands(state, actor, cell) {
      let commands = [];
      if (cell && view.actorId) {
        const runtimeActor = units.find(unit => unit.id === view.actorId);
        const target = (globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units).find(unit => unitAlive(unit) && !unit.embarkedOn && unit.x === cell.x && unit.y === cell.y);
        commands = state.turnPhase === 'fire'
          ? globalThis.GoblinArtilleryWeapons?.active(runtimeActor)
            ? (()=>{const key=previewWeaponKey(actor),weapon=GoblinArtilleryWeapons.weapons(actor)?.[key];return [{command:GoblinArtilleryWeapons.command(runtimeActor,cell,key),label:weapon?`${weapon.label} · A6 R${weapon.range} · ${weapon.ready}/1`:t('v2.ui.fire')}];})()
            : globalThis.GoblinSiegeWeapons?.active(runtimeActor)
            ? (()=>{const key=previewWeaponKey(actor),weapon=GoblinSiegeWeapons.weapons(actor)?.[key];return [{command:{type:'Fire',actorId:view.actorId,...cell,weaponKey:key},label:weapon?`${weapon.label} · A${weapon.attack} R${weapon.range} · ${weapon.ready}/1`:t('v2.ui.fire')}];})()
            : runtimeActor?.ogreSystems
            ? (() => { const key = previewWeaponKey(actor), weapon = runtimeActor.ogreSystems.weapons[key];
              return [{command:{type:'Fire',actorId:view.actorId,...cell,weaponKey:key},
                label:`${t(`v2.ui.weapon.${key}`)} · A${weapon.attack} R${weapon.range} · ${GoblinSystems.weaponReady(weapon)} ${t('v2.ui.ready')}`}]; })()
            : [{ command: { type: 'Fire', actorId: view.actorId, ...cell },
              label: runtimeActor?.strategicMissile ? `${t('v2.ui.missile')} · ${t('v2.ui.missileSplash')}` : t('v2.ui.fire'),
              confirmSplash:!!runtimeActor?.strategicMissile }]
          : target?.team === 'enemy'
            ? [{ command: { type: 'Ram', actorId: view.actorId, ...cell }, label: t('v2.ui.ram') }]
            : target?.team === 'player' && target.transportCapacity
              ? [{ command: { type: 'Embark', actorId: view.actorId, carrierId: target.id, ...cell }, label: t('v2.ui.embark') }]
              : [
                { command: { type: 'Move', actorId: view.actorId, ...cell }, label: t('v2.ui.move') },
                ...(runtimeActor?.transportCapacity ? carrierCargo(runtimeActor).map(cargo => ({
                  command: { type: 'Unload', actorId: view.actorId, cargoId: cargo.id, ...cell },
                  label: `${globalThis.GoblinCatalogRuntime?.drone(cargo)?t('v2.ui.catalog.deployDrone'):t('v2.ui.unload')} · ${globalThis.GoblinCatalogRuntime?.record(cargo)?GoblinCatalogRuntime.name(cargo):cargo.name}`
                })) : [])
              ];
      }
      if(globalThis.GoblinSpecialistsRuntime?.active()&&cell&&actor)commands=GoblinSpecialistsUI.commands(state,actor,cell,view);
      return commands;
    }
    const targetCommands = (state, actor, cell) => actor && cell ? (core() ? coreCommands : legacyCommands)(state, actor, cell) : [];
    function renderCore(state) {
      const actor = state.units.find(unit => unit.id === view.actorId && unitAlive(unit));
      if (!actor) {view.actorId = null; clearContext();}
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-map-label').textContent = GoblinLanguage.translate('TACTICAL MAP');
      at('#v2-map-caption').textContent = `${Math.max(...state.cells.map(cell => cell.x)) + 1} × ${Math.max(...state.cells.map(cell => cell.y)) + 1} · ${t('v2.ui.mapPan')}`;
      at('#v2-map').setAttribute('aria-label', `${t('ui.hud.map')}: ${t('v2.ui.selectHex')}`);
      at('#v2-profile').textContent = state.profile==='TRAINING_FIELD_TEST_v1'?t('training.label'):globalThis.GoblinCatalogFullRuntime?.active()?t('v2.full.profile'):state.profile==='CATALOG_SPECIALISTS_v1'?t('v2.specialists.profile'):state.profile==='CATALOG_BASE_TRANSPORT_v1'?t('v2.catalog.profile'):state.profile;
      at('#v2-phase').textContent = state.gameOver ? t(state.objective.outcome ? 'v2.win' : 'v2.lose') :
        state.phase === 'enemy' ? t('v2.enemy') : t(`v2.phase.${state.turnPhase}`);
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
      at('#v2-intel-label').textContent = t('v2.ui.fieldIntel');
      at('#v2-selection').textContent = actor?.name || t('ui.hud.noSelection');
      at('#v2-message').textContent = view.message;
      renderRoster(state, unit => [strengthText(unit), unit.secondMoved ? t('v2.ui.secondMoved') :
        unit.fired ? t('v2.ui.fired') : unit.moved ? t('v2.ui.moved') : '']);
      renderFieldInfo(state, actor, cell => state.cells.find(item => item.x === cell.x && item.y === cell.y)?.type);
      renderActionChip(state, actor);
      renderCommandMenu(state, actor);
      renderM1Markers(state, actor);
      renderAreaPreview(state, actor);
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    function render() {
      const state = project();
      syncAreaPhase(state);
      const fireZoom = fireZoomEntry(state);
      if (fireZoom) renderWeaponControls(state,
        state.units.find(unit => unit.id === view.actorId && unitAlive(unit)), at('#v2-weapon-controls'));
      const centerFireActor = fireZoom ? zoomOnFireEntry(fireZoom.target) : false;
      if (fireZoom) fireZoomPhase = fireZoom.key;
      const zoomOut = at('#v2-zoom-out'), zoomIn = at('#v2-zoom-in');
      const fit = at('#v2-zoom-fit'), center = at('#v2-zoom-center');
      for (const [button, key] of [[zoomOut, 'ui.hud.zoomOut'], [zoomIn, 'ui.hud.zoomIn'], [fit, 'v2.ui.mapFit'],
        [center, 'v2.ui.centerSelection'], [at('#v2-pause'), 'ui.nav.pause'], [at('#v2-settings'), 'ui.nav.settings'],
        [at('#v2-home'), 'v2.ui.mainMenu'], [at('#v2-log-open'), 'ui.details.log']]) { button.title = t(key); button.setAttribute('aria-label', button.title); }
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
      at('#v2-intel-label').textContent = t('v2.ui.fieldIntel');
      at('#v2-profile').textContent = state.profile==='TRAINING_FIELD_TEST_v1'?t('training.label'):globalThis.GoblinCatalogFullRuntime?.active()?t('v2.full.profile'):state.profile==='CATALOG_SPECIALISTS_v1'?t('v2.specialists.profile'):state.profile==='CATALOG_BASE_TRANSPORT_v1'?t('v2.catalog.profile'):state.profile;
      at('#v2-phase').textContent = state.gameOver ? learningResult??t(state.objective.outcome ? 'v2.win' : 'v2.lose') :
        view.phaseSkip?.turn === state.turn ? t(view.phaseSkip.key) : t(`phase.${state.turnPhase}.label`);
      at('#v2-turn').textContent = `${t('ui.hud.turn', { turn: state.turn })} · ${state.objective.goalMode === 'learning'?t('training.learningGoal'):state.objective.goalMode === 'core'
        ? t('hud.objective.progress.core', { currentHp: state.objective.coreHp, maxHp: state.objective.coreMax })
        : t('hud.objective.progress.enemies', { remainingEnemies: state.objective.enemyAlive, totalEnemies: globalThis.GoblinCatalogFullRuntime?.active()&&state.objective.goalMode==='core-and-escort'?state.objective.total:state.objective.enemyTotal })}`;
      at('#v2-map-caption').textContent = `${W} × ${H} · ${t('v2.ui.mapPan')}`;
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
      phaseButton.disabled = !next || state.phase !== 'player' || state.gameOver || GameDialogs.isOpen() || view.busy;
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      const undoButton = at('#v2-undo');
      undoButton.hidden = false;
      undoButton.disabled = !state.undo.available || view.busy;
      backLabel(undoButton, state.undo.count);
      renderTurnControls(state);
      at('#v2-selection').textContent = actor ? actor.name : t('ui.hud.noSelection');
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
      renderActionChip(state, actor);
      renderCommandMenu(state, actor);
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
      if (state.phase !== 'player' || state.turnPhase !== 'fire' || state.gameOver ||
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
    function scheduleMapSize(){
      if(mapResizeFrame!==null)return;
      mapResizeFrame=requestAnimationFrame(()=>{mapResizeFrame=null;applyMapSize();});
    }
    new ResizeObserver(scheduleMapSize).observe(mapPanel);
    // Unused since the event log moved behind its button; the line ends the map sizing source read by resize-observer-geometry.
    let compactDetails = null;
    function syncLayout() {
      if (view.target && view.pendingAction) render();
      else if (view.actorId) positionCommandMenu({units:core()?IronDustBrowserV2.view.units:(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units)});
    }
    syncLayout();
    window.addEventListener('resize', syncLayout);
    mapPanel.addEventListener('scroll', () => {
      if (view.target && view.pendingAction) renderTargetCard(project(), project().units.find(unit => unit.id === view.actorId));
      else if (view.actorId) positionCommandMenu({units:core()?IronDustBrowserV2.view.units:(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units)});
    }, {passive:true});
    document.addEventListener('click', event => {
      // Buttons replaced by the render of their own click are no longer connected; they never count as outside.
      if ((view.target || view.pendingAction) && view.actorId && event.target.isConnected && !event.target.closest?.('dialog') &&
          !at('#v2-command-card').contains(event.target) && !at('#v2-target-card').contains(event.target) && !at('#v2-action-chip').contains(event.target) && !event.target.closest?.('.v2-map-frame') &&
          !at('#v2-area-controls').contains(event.target) &&
          !mapPanel.contains(event.target) && !at('#v2-units').contains(event.target) &&
          !at('#v2-phase-action').contains(event.target)) {clearContext();render();}
    });
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
    window.addEventListener('blur', () => { for (const pointer of pointers.values()) clearTimeout(pointer.timer); pointers.clear(); pinch = null; });
    mapPanel.addEventListener('wheel', event => {
      startZoomPending = null;
      event.preventDefault();
      setZoom(view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), event.clientX, event.clientY);
      if (view.target && view.actorId) positionCommandMenu({units:core()?IronDustBrowserV2.view.units:(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units)});
    }, { passive: false });
    mapPanel.addEventListener('contextmenu', event => {
      event.preventDefault();
      const cell = cellAt(event.clientX, event.clientY);
      if (cell && !(view.target && view.actorId)) { view.infoCell = cell; view.message = t('ui.hud.intel'); render(); }
    });
    nativeMap.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      // The action menu is not modal: another hex simply becomes the new target.
      if (performance.now() < suppressTapUntil) return;
      const cell = cellAt(event.clientX, event.clientY);
      if (cell) chooseHex(cell.x, cell.y);
    }, true);
    document.addEventListener('keydown', event => {
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
        if (view.pendingAction || view.target) { clearContext(); view.menuOpen = !!view.actorId; }
        else if (view.menuOpen) view.menuOpen = false; else view.actorId = null;
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
      const own = node => node.nodeType === 1 && /^(goblin-movement-layer|v2-(m1-markers|team-markers|actor-marker|target-marker|focus-marker|grid-overlay|area-overlay))$/.test(node.id);
      if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => !own(node)))) render();
    }).observe(nativeMap, { childList: true });
    render();
    globalThis.GoblinLanguage?.ready.then(render);
  })();
}
