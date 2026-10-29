// Default presentation over the selected Legacy or Core session; explicit non-V2 UI values keep the prior test path.
const goblinUiChoice = new URLSearchParams(location.search).get('ui');
if ((goblinUiChoice === null || goblinUiChoice === 'v2') && !globalThis.goblinBootProfileError) {
  (() => {
    const nativeMap = document.querySelector('#battlefield-map');
    const nativeShell = document.querySelector('.app-shell');
    const view = { actorId: null, target: null, infoCell: null, focusCell: null,
      intentRevision: null, busy: false, message: '', zoom: 1, areaMode: null, gridVisible: false,
      targetsVisible:true,damageVisible:true,
      previewWeaponKey: null, phaseSkip: null };
    const shell = document.createElement('div');
    shell.className = 'v2-shell';
    shell.innerHTML = `
      <header class="v2-head"><div><span class="v2-label">G.O.B.L.I.N. / Mission</span><h1 id="v2-mission"></h1><p id="v2-objective"></p></div><div><span class="v2-label" id="v2-profile"></span><strong id="v2-phase" role="status" aria-live="polite"></strong><p id="v2-turn"></p></div></header>
      <div class="v2-layout"><aside class="v2-own"><section class="v2-card"><span class="v2-label" id="v2-units-label"></span><div class="v2-units" id="v2-units"></div></section><section class="v2-card v2-systems-card"><details id="v2-system-details" open><summary class="v2-label" id="v2-systems-label"></summary><div id="v2-systems"></div></details></section></aside><main class="v2-card v2-map-card"><div class="v2-row"><div><span class="v2-label" id="v2-map-label"></span><strong id="v2-map-caption"></strong></div><button type="button" id="v2-undo"></button><div class="v2-area-controls" role="group" id="v2-area-controls"><button type="button" data-area="movement"></button><button type="button" data-area="fire"></button><button type="button" data-area="los"></button><button type="button" id="v2-display-toggle" aria-expanded="false" aria-controls="v2-display-controls" hidden></button><div id="v2-display-controls" class="v2-display-controls" role="group"><button type="button" id="v2-area-grid"></button><button type="button" id="v2-area-targets"></button><button type="button" id="v2-area-damage"></button></div></div></div><div class="v2-map-tools" role="group" id="v2-map-tools"><button type="button" id="v2-zoom-out">−</button><button type="button" id="v2-zoom-in">+</button><button type="button" id="v2-zoom-fit"></button><button type="button" id="v2-zoom-center"></button><div class="v2-weapon-controls" id="v2-weapon-controls" hidden></div></div><div class="v2-map" id="v2-map" tabindex="0"></div><div class="v2-context"><span id="v2-selection"></span><strong id="v2-terminal" hidden></strong><p id="v2-area-legend" class="v2-area-legend" role="status"></p><p id="v2-message" class="v2-status" role="status"></p></div><div class="v2-controls"><button type="button" id="v2-phase-action"></button><button type="button" id="v2-pause"></button></div></main><aside class="v2-target"><section class="v2-card"><details id="v2-intel-details" open><summary class="v2-label" id="v2-intel-label"></summary><div id="v2-intel"></div></details></section><section class="v2-card v2-log-card"><details id="v2-log-details" open><summary class="v2-label" id="v2-log-label"></summary><div id="v2-log"></div></details></section></aside></div><section class="v2-card v2-command-card" id="v2-command-card" aria-labelledby="v2-command-target" hidden><div class="v2-command-body" id="v2-command-body"><div class="v2-command-head"><span class="v2-label" id="v2-command-target"></span><p id="v2-command-intel"></p><div class="v2-weapon-controls" id="v2-command-weapons" hidden></div></div><div class="v2-actions" id="v2-actions"></div></div><div class="v2-command-footer" id="v2-command-footer"></div></section>`;
    const terrainCard = document.createElement('section');
    terrainCard.className = 'v2-card';
    terrainCard.innerHTML = '<details id="v2-terrain-details" open><summary class="v2-label" id="v2-terrain-label"></summary><div id="v2-terrain-list"></div></details>';
    shell.querySelector('.v2-log-card').before(terrainCard);
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
      status.title=members.map(member => `${state.units.find(unit=>unit.id===member.unitId)?.name || member.unitId}: ${t(member.state==='satisfied'?'v2.ui.destroyed':'v2.ui.objectivePending')}`).join('\n');
    }

    function revision() {
      if (core()) return `core:${IronDustBrowserV2.epoch}:${IronDustBrowserV2.session.profile.digest}`;
      return JSON.stringify([currentScenario, legacySession?.sessionId, legacySession?.ruleProfileId, turn, phase, turnPhase, gameOver,
        [...terrain], [...terrainTypes], units.map(({ moveFrom, justHit, ...unit }) => unit)]);
    }
    function legacyLogEntries() {
      return [...logEl.querySelectorAll('.log-line')].slice(0, 4).map(line => ({
        time:line.querySelector('.log-time')?.textContent.trim() || '',
        source:line.querySelector('strong')?.textContent.trim() || '',
        message:line.dataset.phaseSkipKey ? t(line.dataset.phaseSkipKey) :
          [...line.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent).join('').trim()
      }));
    }
    function renderLog(entries) {
      const log = at('#v2-log'); log.replaceChildren();
      for (const entry of entries) {
        const line = document.createElement('p'); line.className = 'v2-log-entry';
        if (entry.time) {
          const time = document.createElement('time'); time.className = 'v2-log-time';
          time.textContent = entry.time; line.append(time);
        }
        const message = document.createElement('span'); message.className = 'v2-log-message';
        message.textContent = [entry.source, entry.message].filter(Boolean).join(' ');
        line.append(message); log.append(line);
      }
    }
    function notifyPhaseSkip(phaseName) {
      if (!['movement', 'fire', 'gev'].includes(phaseName) || core()) return;
      const key = `v2.phaseSkip.${phaseName}`;
      addLog(t(key));
      logEl.firstElementChild.dataset.phaseSkipKey = key;
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
      const roster=displayed?.units??units;
      const shownPhase=displayed?.activeTeam??phase,shownTurnPhase=displayed?.phase??turnPhase,shownGameOver=displayed?.gameOver??gameOver;
      const objective = objectiveSnapshot(victoryProfile(legacySession.effectiveRules), roster);
      if(!displayed)idleLegacyLogEntries=legacyLogEntries();
      const logEntries = idleLegacyLogEntries;
      const snapshotRevision = revision();
      return {
        revision: snapshotRevision, scenario: currentScenario, profile: legacySession.ruleProfileId,
        markers:M1UnitMarkers.legacy(legacySession, roster, snapshotRevision, objective.outcome),
        mission: { title: t(`mission.${currentScenario}.title`), objective: t(`mission.${currentScenario}.objective.short`) },
        turn:displayed?.turn??turn, phase:shownPhase, turnPhase:shownTurnPhase, gameOver:shownGameOver, objective: structuredClone(objective),
        ready: phase === 'player' && !gameOver ? phaseReadyUnits().length : 0,
        undo: { available: phaseCommands.length > 0 && phase === 'player' && !gameOver, count: phaseCommands.length },
        units: roster.map(({ id, name, type, team, x, y, hp, maxHp, visualKey, catalogId, catalogAssetId, halfUnit, forceBudgetWeight, droneReadyTurn, artilleryFire, artilleryChoice, siegeFireBudget, siegeWeapon, attack, defense, move, range, damage, disabled, embarkedOn, core, infantry, engineering, ogreSystems, transportCapacity, strategicMissile, missilesRemaining }) =>
          ({ id, name:catalogId?GoblinCatalogRuntime.name({id}):name, type, team, x, y, hp, maxHp, visualKey, catalogId, catalogAssetId, halfUnit, forceBudgetWeight, droneReadyTurn, artilleryChoice, artilleryFire:artilleryFire?structuredClone(artilleryFire):null, siegeWeapon, siegeFireBudget:siegeFireBudget?structuredClone(siegeFireBudget):null, disabled: !!disabled, embarkedOn: embarkedOn || null,
            attack: attack ?? damage ?? null, defense: defense ?? null, move: move ?? null, secondaryMove: movementBudget({id,team,move,gev:isGevUnit(roster.find(item=>item.id===id))},true), range: range ?? null,
            core: !!core, infantry: !!infantry, engineering:!!engineering,
            ogreSystems:ogreSystems ? structuredClone(ogreSystems) : null,
            transportCapacity: transportCapacity || 0, strategicMissile: !!strategicMissile,
            missilesRemaining: missilesRemaining ?? null })),
        systems: roster.filter(unit => unit.team === 'player' && unit.ogreSystems)
          .map(unit => ({ id: unit.id, summary: GoblinSystems.summary(unit.ogreSystems) })),
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
          legacySession.ruleProfileId !== ScenarioRuleProfiles.entries[currentScenario].ruleProfileId ||
          globalThis.IronDustBrowserV2?.active)
        return { ok: false, reason: t('ui.error.UNSUPPORTED_COMMAND') };
      if (GameDialogs.isOpen()) return { ok: false, reason: t('ui.error.INVALID_COMMAND') };
      if (phase !== 'player' || gameOver) return { ok: false, reason: t(gameOver ? 'ui.error.GAME_ENDED' : 'ui.error.NOT_ACTIVE_TEAM') };
      if(globalThis.GoblinCatalogRuntime?.active())return GoblinCatalogRuntime.query(command);
      if (!['Move', 'Ram', 'Fire', 'FireArtillery', 'Embark', 'Unload'].includes(command?.type)) return { ok: false, reason: t('ui.error.UNKNOWN_COMMAND') };
      const actor = units.find(unit => unit.id === command.actorId);
      if (!actor) return { ok: false, reason: t('ui.error.UNIT_NOT_FOUND') };
      if (actor.team !== 'player') return { ok: false, reason: t('ui.error.UNIT_NOT_OWNED') };
      if (actor.hp <= 0) return { ok: false, reason: t('ui.error.UNIT_DESTROYED') };
      if (actor.disabled) return { ok: false, reason: t('ui.error.UNIT_DISABLED') };
      if (!Number.isInteger(command.x) || !Number.isInteger(command.y) || command.x < 0 || command.x >= W || command.y < 0 || command.y >= H)
        return { ok: false, reason: t('ui.error.OUT_OF_BOUNDS') };
      const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === command.x && unit.y === command.y);
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
      if (!['Fire','FireArtillery'].includes(command?.type)) return null;
      const legal = query(command);
      if (!legal.ok) return null;
      const actor = units.find(unit => unit.id === command.actorId);
      const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn &&
        unit.x === command.x && unit.y === command.y);
      if (!actor || !target) return null;
      const attack = legal.weapon?.attack ?? actor.damage;
      const defense = effectiveDefense(target);
      const ratioCategory = Number.isFinite(attack) && Number.isFinite(defense)
        ? combatRatio(attack, defense) : null;
      return Object.freeze({profileId: legacySession.ruleProfileId,
        stateRevision: revision(), actorId: actor.id, targetId: target.id,
        weaponKey: actor.artilleryFire ? legal.weapon.key : actor.ogreSystems||actor.siegeFireBudget ? command.weaponKey??actor.siegeWeapon : null,
        from: {x: actor.x, y: actor.y}, to: {x: target.x, y: target.y},
        legal: true, ratioCategory, meaning: 'crt-attack-effective-defense'});
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
      if (!check.ok) return check;
      view.busy = true;
      try {
        const actor = units.find(unit => unit.id === command.actorId);
        selected = actor;
        const beforeExecution = revision();
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

    function clearContext() { view.target = null; view.intentRevision = null; view.message = ''; }
    const hexLabel = cell => `${String.fromCharCode(65 + cell.x)}-${String(cell.y + 1).padStart(2, '0')}`;
    function coreOpenCount(source) {
      if (source.mode !== 'player') return 0;
      const enemies = source.units.filter(unit => unit.team === 'enemy' && unit.hp > 0);
      return source.units.filter(unit => unit.team === 'player' && unit.hp > 0 && !unit.disabled)
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
        }).length;
    }
    function renderSystems(state, actor) {
      const host = at('#v2-systems'); host.replaceChildren();
      const entry = state.systems.find(item => item.id === actor?.id) || state.systems[0];
      if (!entry) return;
      const unit = state.units.find(item => item.id === entry.id);
      const name = document.createElement('strong'); name.textContent = unit?.name || entry.id; host.append(name);
      const facts = [];
      if (entry.summary.treads != null) facts.push([t('v2.ui.treads'), unit?.ogreSystems
        ? `${unit.ogreSystems.treads}/${unit.ogreSystems.maxTreads}` : entry.summary.treads]);
      for (const [key, count] of Object.entries(entry.summary.weapons || {})) {
        const raw=unit?.ogreSystems?.weapons[key];
        facts.push([t(`v2.ui.weapon.${key}`), raw
          ? `${Math.max(0,Math.min(raw.remaining,raw.count-raw.destroyed))}/${raw.count} · ${t('v2.ui.weaponDamage',{count:raw.destroyed})}` : count]);
      }
      for (const [label, value] of facts) {
        const line = document.createElement('div'); line.className = 'v2-system-row';
        const term = document.createElement('span'); term.textContent = label;
        const number = document.createElement('strong'); number.textContent = String(value);
        line.append(term, number); host.append(line);
      }
    }
    function positionCommandMenu(state) {
      const card = at('#v2-command-card'), map = at('#v2-map');
      if (card.hidden || !view.target) return;
      card.classList.remove('v2-command-panel'); card.classList.add('v2-command-anchored');
      card.style.left = '-9999px'; card.style.top = '0';
      const frame = map.getBoundingClientRect(), box = card.getBoundingClientRect();
      const point = nativeMap.createSVGPoint();
      Object.assign(point, hexCenter(view.target.x, view.target.y));
      const target = point.matrixTransform(nativeMap.getScreenCTM());
      const occupied = state.units.filter(unit => unit.hp > 0 && !unit.embarkedOn)
        .map(unit => {const node=nativeMap.createSVGPoint();Object.assign(node,hexCenter(unit.x,unit.y));
          return node.matrixTransform(nativeMap.getScreenCTM());});
      const inset = 8, gap = 44, w = box.width, h = box.height;
      const candidates = [
        {x:target.x+gap,y:target.y-h/2}, {x:target.x-gap-w,y:target.y-h/2},
        {x:target.x-w/2,y:target.y-gap-h}, {x:target.x-w/2,y:target.y+gap}
      ];
      const placement = innerWidth >= 1024 && innerHeight >= 600 && frame.width >= 560 &&
        target.x >= frame.left && target.x <= frame.right && target.y >= frame.top && target.y <= frame.bottom
        ? candidates.find(({x,y}) => x>=frame.left+inset && y>=frame.top+inset &&
          x+w<=frame.right-inset && y+h<=frame.bottom-inset &&
          !occupied.some(point => point.x>=x-24 && point.x<=x+w+24 && point.y>=y-24 && point.y<=y+h+24))
        : null;
      if (placement) {card.dataset.placement='hex';card.style.left=`${placement.x}px`;card.style.top=`${placement.y}px`;}
      else {card.dataset.placement='panel';card.classList.remove('v2-command-anchored');
        card.classList.add('v2-command-panel');card.style.removeProperty('left');
        if (innerWidth >= 1024 && innerHeight >= 600)
          card.style.top = `${Math.min(frame.top + 8, innerHeight - h - 8)}px`;
        else card.style.removeProperty('top');}
    }
    function renderCommandMenu(state, actor, commands, terrain) {
      const card = at('#v2-command-card'), actions = at('#v2-actions'), footer = at('#v2-command-footer');
      actions.replaceChildren(); footer.replaceChildren();
      const open = !!(view.target && actor && !GameDialogs.isOpen() && !document.body.classList.contains('v2-screen-open'));
      card.hidden = !open; document.body.classList.toggle('v2-menu-open', open);
      if (!open) return;
      card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
      at('#v2-command-target').textContent = `${t('v2.ui.commandTarget')} · ${hexLabel(view.target)}`;
      const occupant = state.units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
      at('#v2-command-intel').textContent = `${actor.name} → ${hexLabel(view.target)} · ${terrain}${occupant ? ` · ${occupant.name} (${t(occupant.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')})` : ''}`;
      renderWeaponControls(state, actor, at('#v2-command-weapons'));
      for (const {command,label,keepTarget,confirmSplash} of commands) {
        const availability = query(command), button = document.createElement('button');
        button.textContent = availability.ok
          ? `${label} · ${t('ui.hud.intent.confirm')}${command.type === 'Move' && availability.path ? ` · ${t('v2.ui.pathSteps', {count:availability.path.length})}` : ''}`
          : `${label} · ${t('ui.hud.blocked', {reason:availability.reason})}`;
        button.disabled = !availability.ok || view.busy;
        button.onclick = async () => {
          const expectedRevision = view.intentRevision;
          if (confirmSplash) {
            const strike = globalThis.StrategicMissile.STRIKE;
            const affected = state.units.filter(unit => unit.hp > 0 && !unit.embarkedOn &&
              dist(unit, view.target) <= strike.radius).map(unit => `${unit.name} (${t(unit.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')})`);
            const accepted = await GameDialogs.confirm({id:'v2-splash-confirm',title:t('v2.ui.missile'),
              message:`${t('v2.ui.sector')} ${hexLabel(view.target)} · ${t('v2.ui.missileSplash')} · ${t('v2.ui.missileImpact',{direct:strike.directAttack,adjacent:strike.splashAttack})}${affected.length ? ` · ${affected.join(', ')}` : ''}`,
              acceptLabel:t('ui.hud.intent.confirm'),cancelLabel:t('ui.dialog.cancel')});
            if (!accepted) {
              render();
              (at('#v2-actions button:not(:disabled)') || at('#v2-command-footer button'))?.focus();
              return;
            }
          }
          const result = dispatch(command, expectedRevision);
          if (result.ok && !keepTarget) clearContext();
          else if (result.ok || view.intentRevision !== revision()) view.intentRevision = revision();
          view.message = result.ok ? '' : result.reason;
          render();
          if (result.ok && keepTarget) at('#v2-actions button:not(:disabled)')?.focus();
          else if (result.ok) {at('#v2-map').focus({preventScroll:true});showMapCard();}
          else (at('#v2-actions button:not(:disabled)') || at('#v2-command-footer button'))?.focus();
        };
        actions.append(button);
      }
      if (!commands.length) {const hint=document.createElement('p');hint.textContent=t('v2.ui.noAction');actions.append(hint);}
      if (state.turnPhase === 'fire') {
        const fit = document.createElement('button'); fit.id = 'v2-command-fit';
        fit.textContent = t('v2.ui.mapFit');
        fit.onclick = () => { fitMap(); at('#v2-command-fit')?.focus({preventScroll:true}); };
        footer.append(fit);
      }
      const cancel = document.createElement('button');cancel.textContent=t('ui.dialog.cancel');
      cancel.onclick=()=>{clearContext();render();at('#v2-map').focus({preventScroll:true});};
      const pause = document.createElement('button');pause.textContent=t('ui.nav.pause');
      pause.onclick=()=>{clearContext();render();at('#v2-pause').click();};
      footer.append(cancel,pause);
      positionCommandMenu(state);
    }
    function chooseActor(id) {
      startZoomPending = null;
      const unit = (core() ? project().units : units).find(item => item.id === id && item.team === 'player' && item.hp > 0);
      view.actorId = unit?.id || null;
      view.areaMode = null; view.previewWeaponKey = null;
      if (unit) { view.focusCell = { x: unit.x, y: unit.y }; view.infoCell = { x: unit.x, y: unit.y }; }
      clearContext(); render();
    }
    function focusUnit(id) {
      const unit = (core() ? project().units : units).find(item => item.id === id && item.hp > 0);
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
      const roster = core() ? project().units : units;
      const unit = roster.find(item => item.hp > 0 && !item.embarkedOn && item.x === x && item.y === y);
      const actor = roster.find(item => item.id === view.actorId);
      if (unit?.team === 'player' && !(actor && unit.id !== actor.id && unit.transportCapacity && canEmbark(actor, unit))) {
        chooseActor(unit.id); return;
      }
      view.target = { x, y }; view.infoCell = { x, y }; view.focusCell = { x, y };
      view.intentRevision = revision(); view.message = ''; render();
      if (view.actorId) {
        if (matchMedia('(max-width: 599px), (max-height: 500px)').matches)
          showMapCard();
        (at('#v2-actions button:not(:disabled)') || at('#v2-command-footer button'))?.focus();
      }
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
      return core() ? actor?.selectedWeapon : view.previewWeaponKey ||
        units.find(unit => unit.id === actor?.id)?.artilleryChoice || units.find(unit => unit.id === actor?.id)?.siegeWeapon || units.find(unit => unit.id === actor?.id)?.ogreSystems?.selectedWeapon;
    }
    function renderWeaponControls(state, actor, container) {
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
        button.textContent = `${siege||artillery?weapon.label:t(`v2.ui.weapon.${key}`)} · ${t('v2.area.weaponAvailable', {count:ready})}`;
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
      if (actor.disabled || actor.hp <= 0) { data.status = 'unavailable'; data.reason = t('v2.ui.disabled'); return data; }
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
          if (x === actor.x && y === actor.y || state.units.some(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === x && unit.y === y)) continue;
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
      for (const target of state.units.filter(unit => unit.team === 'enemy' && unit.hp > 0 && !unit.embarkedOn)) {
        const command = globalThis.GoblinArtilleryWeapons?.active(runtime)?GoblinArtilleryWeapons.command(runtime,target,weaponKey):core() ? { type: 'PlayerFire', playerId: 'player', unitId: actor.id,
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
      const target = state.units.find(unit => unit.team === 'enemy' && unit.hp > 0 &&
        !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
      if (!target || !legal.some(cell => cell.x === target.x && cell.y === target.y)) return null;
      const selectedWeapon = (actor.weapons || runtime?.ogreSystems || actor.siegeFireBudget || actor.artilleryFire) ? weaponKey ?? null : null;
      const command = globalThis.GoblinArtilleryWeapons?.active(runtime)?GoblinArtilleryWeapons.command(runtime,target,selectedWeapon):core() ? {type: 'PlayerFire', playerId: 'player', unitId: actor.id,
        targetId: target.id, ...(selectedWeapon ? {weaponKey: selectedWeapon} : {})} :
        {type: 'Fire', actorId: actor.id, x: target.x, y: target.y,
          ...(selectedWeapon ? {weaponKey: selectedWeapon} : {})};
      const preview = previewFire(command);
      return preview?.legal && preview.meaning === 'crt-attack-effective-defense' &&
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
    function renderAreaPreview(state, actor) {
      renderWeaponControls(state, actor, at('#v2-weapon-controls'));
      const mode = activeAreaMode(state);
      for (const button of at('#v2-area-controls').querySelectorAll('[data-area]')) {
        const key = button.dataset.area;
        button.textContent = t(`v2.area.${key}`);
        button.setAttribute('aria-pressed', String(mode === key));
      }
      const gridButton = at('#v2-area-grid');
      gridButton.textContent = t('v2.area.grid');
      gridButton.setAttribute('aria-pressed', String(view.gridVisible));
      for(const [key,label] of [['targets','missionTargets'],['damage','damage']]){
        const button=at(`#v2-area-${key}`);
        button.textContent=t(`v2.display.${key}`);
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
      const weapon = core() ? actor?.weapons?.[weaponKey] : globalThis.GoblinArtilleryWeapons?.active(runtime)?GoblinArtilleryWeapons.weapons(actor)?.[weaponKey]:globalThis.GoblinSiegeWeapons?.active(runtime)?GoblinSiegeWeapons.weapons(actor)?.[weaponKey]:runtime?.ogreSystems?.weapons?.[weaponKey];
      const key = JSON.stringify([core(), state.revision, state.phase, state.turnPhase,
        actor?.id, mode, weaponKey, GoblinLanguage.current, !!globalThis.GoblinMovement?.busy()]);
      if (areaCache.key !== key) { areaCache.key = key; areaCache.value = areaData(state, actor, mode); }
      const data = areaCache.value;
      const hexWidth = Math.sqrt(3) * S;
      const referenceScale = hexWidth / 112;
      const mapWidth = nativeMap.getBoundingClientRect().width || nativeMap.clientWidth ||
        Number.parseFloat(nativeMap.style.width) || nativeMap.viewBox.baseVal.width;
      const pixelScale = mapWidth / nativeMap.viewBox.baseVal.width;
      const showCostChips = hexWidth * pixelScale >= 50 && !matchMedia('(max-width: 599px)').matches;
      function mark(cell, kind) {
        const outerPoints = hexPoints(cell.x, cell.y);
        const center = kind === 'fire' ? hexCenter(cell.x, cell.y) : null;
        const points = center ? outerPoints.split(' ').map(pair => {
          const [x, y] = pair.split(',').map(Number);
          return `${center.x + (x - center.x) * 92 / 112},${center.y + (y - center.y) * 92 / 112}`;
        }).join(' ') : outerPoints;
        if (kind === 'fire') {
          const underlay = document.createElementNS(NS, 'polygon');
          underlay.setAttribute('points', points); underlay.classList.add('v2-area-fire-underlay');
          underlay.setAttribute('stroke-width', Math.max(5.5 * referenceScale, 3.5 / pixelScale));
          underlay.dataset.x = String(cell.x); underlay.dataset.y = String(cell.y);
          overlay.append(underlay);
        }
        const shape = document.createElementNS(NS, 'polygon');
        shape.setAttribute('points', points); shape.classList.add(`v2-area-${kind}`);
        if (kind === 'movement') shape.setAttribute('stroke-width', 2 * referenceScale);
        if (kind === 'fire') shape.setAttribute('stroke-width', Math.max(2.5 * referenceScale, 1.5 / pixelScale));
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
      for (const cell of data.legal) mark(cell, mode === 'movement' ? 'movement' : mode === 'fire' ? 'fire' : 'sight');
      if (mode !== 'los') for (const cell of data.blocked) mark(cell, 'blocked');
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
        const ratioLabel = typeof category === 'string' && /^(?:1-2|[1-5]-1)$/.test(category)
          ? category.replace('-', ':') : null;
        if (ratioLabel) {
          if (!at('#v2-command-card').hidden)
            at('#v2-command-intel').textContent += ` · CRT ${ratioLabel}`;
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
      if (weapon && mode === 'fire') message += ` · ${weapon.label}`;
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
    function renderCore(state) {
      const actor = state.units.find(unit => unit.id === view.actorId && unit.hp > 0);
      if (!actor) {view.actorId = null; clearContext();}
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-map-label').textContent = GoblinLanguage.translate('TACTICAL MAP');
      at('#v2-map-caption').textContent = `${Math.max(...state.cells.map(cell => cell.x)) + 1} × ${Math.max(...state.cells.map(cell => cell.y)) + 1} · ${t('v2.ui.mapPan')}`;
      at('#v2-map').setAttribute('aria-label', `${t('ui.hud.map')}: ${t('v2.ui.selectHex')}`);
      at('#v2-profile').textContent = state.profile==='CATALOG_BASE_TRANSPORT_v1'?t('v2.catalog.profile'):state.profile;
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
      phaseButton.disabled = state.phase !== 'player' || !IronDustBrowserV2.query({type:'EndPhase',playerId:'player'}).available ||
        GameDialogs.isOpen() || view.busy;
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      at('#v2-pause').textContent = t('ui.nav.pause');
      at('#v2-undo').hidden = true;
      at('#v2-units-label').textContent = t('ui.hud.units');
      at('#v2-intel-label').textContent = t('v2.ui.fieldIntel');
      at('#v2-systems-label').textContent = t('v2.ui.status');
      at('#v2-log-label').textContent = t('ui.details.log');
      at('#v2-terrain-label').textContent = t('v2.ui.terrain');
      TerrainDisplay.fillLegend(at('#v2-terrain-list'), state.cells.map(cell => cell.type), true);
      at('#v2-selection').textContent = actor?.name || t('ui.hud.noSelection');
      at('#v2-message').textContent = view.message;
      const roster = at('#v2-units'); roster.replaceChildren();
      state.units.filter(unit => unit.team === 'player').forEach(unit => {
        const button = document.createElement('button');
        const strength = strengthText(unit);
        button.textContent = `${unit.name} · ${strength}${unit.hp <= 0 ? ` · ${t('v2.ui.destroyed')}` :
          unit.disabled ? ` · ${t('v2.ui.disabled')}` : unit.secondMoved ? ` · ${t('v2.ui.secondMoved')}` :
          unit.fired ? ` · ${t('v2.ui.fired')}` : unit.moved ? ` · ${t('v2.ui.moved')}` : ''}`;
        addRosterArt(button, unit);
        button.setAttribute('aria-pressed',String(unit.id === view.actorId));
        button.disabled = unit.hp <= 0; button.onclick = () => chooseActor(unit.id); roster.append(button);
      });
      const intel = at('#v2-intel'); intel.replaceChildren();
      const cell = view.target || view.infoCell;
      if (cell) {
        const terrain = state.cells.find(item => item.x === cell.x && item.y === cell.y);
        const occupant = state.units.find(unit => unit.hp > 0 && unit.x === cell.x && unit.y === cell.y);
        const line = document.createElement('p');
        line.className = 'v2-terrain-info';
        line.textContent = `${t('v2.ui.sector')} ${hexLabel(cell)} · ${TerrainDisplay.label(terrain?.type)}${occupant ? ` · ${occupant.name} (${t(occupant.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')}) · ${strengthText(occupant)}` : ''}`;
        for(const wreck of globalThis.UnitVisuals?.wrecksAt?.(cell.x,cell.y)??[])
          line.textContent += ` · ${globalThis.UnitVisuals.wreckLabel(wreck)}`;
        const image = TerrainDisplay.icon(terrain?.type);
        if (image) line.prepend(image);
        intel.append(line);
      }
      renderSystems(state, actor);
      renderLog(state.log.slice(-4).map(message => ({message})));
      const commands=[];
      if (view.target && actor) {
        const target=state.units.find(unit => unit.hp>0 && unit.x===view.target.x && unit.y===view.target.y);
        if (state.turnPhase==='fire' && target?.team==='enemy') {
          if (actor.weapons) {
            const key = previewWeaponKey(actor), weapon = actor.weapons[key];
            commands.push({command:{type:'PlayerFire',playerId:'player',unitId:actor.id,targetId:target.id,weaponKey:key},
              label:`${t(`v2.ui.weapon.${key}`)} · A${weapon.attack} R${weapon.range} · ${weapon.ready} ${t('v2.ui.ready')} · ${t('v2.ui.fire')}`});
          }
          else commands.push({command:{type:'PlayerFire',playerId:'player',unitId:actor.id,targetId:target.id},label:t('v2.ui.fire')});
        } else if (state.turnPhase!=='fire') {
          if (target?.team==='enemy') commands.push({command:{type:'Ram',playerId:'player',unitId:actor.id,targetId:target.id},label:t('v2.ui.ram')});
          else if (!target) commands.push({command:{type:'Move',playerId:'player',unitId:actor.id,to:{...view.target}},label:t('v2.ui.move')});
        }
      }
      renderCommandMenu(state, actor, commands,
        view.target ? TerrainDisplay.label(state.cells.find(cell => cell.x === view.target.x && cell.y === view.target.y)?.type) : '');
      renderM1Markers(state, actor);
      renderAreaPreview(state, actor);
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    function render() {
      const state = project();
      syncAreaPhase(state);
      const fireZoom = fireZoomEntry(state);
      if (fireZoom) renderWeaponControls(state,
        state.units.find(unit => unit.id === view.actorId && unit.hp > 0), at('#v2-weapon-controls'));
      const centerFireActor = fireZoom ? zoomOnFireEntry(fireZoom.target) : false;
      if (fireZoom) fireZoomPhase = fireZoom.key;
      const zoomOut = at('#v2-zoom-out'), zoomIn = at('#v2-zoom-in');
      const fit = at('#v2-zoom-fit'), center = at('#v2-zoom-center');
      zoomOut.setAttribute('aria-label', t('ui.hud.zoomOut'));
      zoomIn.setAttribute('aria-label', t('ui.hud.zoomIn'));
      fit.textContent = t('v2.ui.mapFit');
      fit.setAttribute('aria-label', fit.textContent);
      center.textContent = t('v2.ui.centerSelection');
      center.setAttribute('aria-label', center.textContent);
      at('#v2-map-tools').setAttribute('aria-label', t('ui.hud.map'));
      zoomOut.disabled = view.zoom <= 1;
      zoomIn.disabled = view.zoom >= 4;
      center.disabled = !view.actorId;
      if (core()) { renderCore(state); if (centerFireActor) centerSelectedActor(state); return; }
      const actor = state.units.find(unit => unit.id === view.actorId);
      if (!actor || actor.hp <= 0) { view.actorId = null; clearContext(); }
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-map-label').textContent = GoblinLanguage.translate('TACTICAL MAP');
      at('#v2-units-label').textContent = t('ui.hud.units');
      at('#v2-intel-label').textContent = t('v2.ui.fieldIntel');
      at('#v2-systems-label').textContent = t('v2.ui.status');
      at('#v2-log-label').textContent = t('ui.details.log');
      at('#v2-terrain-label').textContent = t('v2.ui.terrain');
      TerrainDisplay.fillLegend(at('#v2-terrain-list'),
        Array.from({length: H}, (_, y) => Array.from({length: W}, (_, x) => terrainTypeAt(x, y))).flat());
      at('#v2-profile').textContent = state.profile==='CATALOG_BASE_TRANSPORT_v1'?t('v2.catalog.profile'):state.profile;
      at('#v2-phase').textContent = state.gameOver ? t(state.objective.outcome ? 'v2.win' : 'v2.lose') :
        view.phaseSkip?.turn === state.turn ? t(view.phaseSkip.key) : t(`phase.${state.turnPhase}.label`);
      at('#v2-turn').textContent = `${t('ui.hud.turn', { turn: state.turn })} · ${state.objective.goalMode === 'core'
        ? t('hud.objective.progress.core', { currentHp: state.objective.coreHp, maxHp: state.objective.coreMax })
        : t('hud.objective.progress.enemies', { remainingEnemies: state.objective.enemyAlive, totalEnemies: state.objective.enemyTotal })}`;
      at('#v2-map-caption').textContent = `${W} × ${H} · ${t('v2.ui.mapPan')}`;
      at('#v2-map').setAttribute('aria-label', `${t('ui.hud.map')}: ${t('v2.ui.selectHex')}`);
      const terminal = at('#v2-terminal');
      terminal.hidden = !state.gameOver;
      terminal.classList.toggle('v2-failed', state.gameOver && state.objective.outcome === false);
      terminal.textContent = state.gameOver ? t(state.objective.outcome ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title') : '';
      const next = { movement: 'dialog.phaseAdvance.confirm.toFire', fire: 'dialog.phaseAdvance.confirm.toGev', gev: 'dialog.phaseAdvance.confirm.toEnemy' }[state.turnPhase];
      const phaseButton = at('#v2-phase-action');
      phaseButton.textContent = next ? `${t(next)} · ${t('dialog.phaseAdvance.pending', { pendingCount: state.ready })}`
        : t(state.gameOver ? (state.objective.outcome ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title') : 'phase.enemy.label');
      phaseButton.setAttribute('aria-label', phaseButton.textContent);
      phaseButton.disabled = !next || state.phase !== 'player' || state.gameOver || GameDialogs.isOpen() || view.busy;
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      at('#v2-pause').textContent = t('ui.nav.pause');
      const undoButton = at('#v2-undo');
      undoButton.hidden = false;
      undoButton.disabled = !state.undo.available || view.busy;
      undoButton.textContent = state.undo.count ? `${GoblinLanguage.translate('BACK')} (${state.undo.count})` : GoblinLanguage.translate('BACK');
      undoButton.setAttribute('aria-label', GoblinLanguage.translate('BACK'));
      at('#v2-selection').textContent = actor ? actor.name : t('ui.hud.noSelection');
      at('#v2-message').textContent = view.message;
      const roster = at('#v2-units'); roster.replaceChildren();
      state.units.filter(unit => unit.team === 'player').forEach(unit => {
        const button = document.createElement('button');
        const system = state.systems.find(item => item.id === unit.id);
        const carrier = unit.embarkedOn && state.units.find(item => item.id === unit.embarkedOn);
        const cargo = unit.transportCapacity ? units.find(item => item.id === unit.id) : null;
        button.textContent = `${unit.name} · ${system ? `${t('v2.ui.treads')} ${system.summary.treads}` :
          `${unit.hp}/${unit.maxHp} ${unit.infantry ? 'SP' : 'HP'}`}${unit.hp <= 0 ? ` · ${t('v2.ui.destroyed')}` : unit.disabled ? ` · ${t('v2.ui.disabled')}` : ''}${carrier ? ` · ${t('v2.ui.embarked')} ${carrier.name}` : ''}${cargo ? ` · ${t('v2.ui.cargo')} ${unit.catalogId?GoblinCatalogRuntime.loadWeight(unit,state.units):carrierLoad(cargo)}/${unit.transportCapacity}` : ''}${unit.strategicMissile ? ` · ${t('v2.ui.missile')} ${unit.missilesRemaining}` : ''}`;
        addRosterArt(button, unit);
        button.setAttribute('aria-pressed', String(unit.id === view.actorId));
        button.disabled = unit.hp <= 0;
        button.onclick = () => chooseActor(unit.id);
        roster.appendChild(button);
      });
      const intel = at('#v2-intel'); intel.replaceChildren();
      if (view.target || view.infoCell) {
        const { x, y } = view.target || view.infoCell;
        const target = state.units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === x && unit.y === y);
        const line = document.createElement('p');
        const terrainId = terrainTypeAt(x, y);
        line.className = 'v2-terrain-info';
        line.textContent = `${t('v2.ui.sector')} ${String.fromCharCode(65 + x)}-${String(y + 1).padStart(2, '0')} · ${TerrainDisplay.label(terrainId)}${target ? ` · ${target.name} (${t(target.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')}) · ${strengthText(target)}` : ''}`;
        for(const wreck of globalThis.UnitVisuals?.wrecksAt?.(x,y)??[])
          line.textContent += ` · ${globalThis.UnitVisuals.wreckLabel(wreck)}`;
        const image = TerrainDisplay.icon(terrainId);
        if (image) line.prepend(image);
        intel.appendChild(line);
        if(target?.catalogId){const facts=document.createElement('p');facts.textContent=GoblinCatalogRuntime.summary(target,state.units);intel.appendChild(facts);}
      }
      if(actor?.catalogId){const facts=document.createElement('p');facts.textContent=GoblinCatalogRuntime.summary(actor,state.units);intel.appendChild(facts);}
      renderSystems(state, actor);
      renderLog(state.logEntries);
      let commands = [];
      if (view.target && view.actorId) {
        const runtimeActor = units.find(unit => unit.id === view.actorId);
        const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
        commands = state.turnPhase === 'fire'
          ? globalThis.GoblinArtilleryWeapons?.active(runtimeActor)
            ? (()=>{const key=previewWeaponKey(actor),weapon=GoblinArtilleryWeapons.weapons(actor)?.[key];return [{command:GoblinArtilleryWeapons.command(runtimeActor,view.target,key),label:weapon?`${weapon.label} · A6 R${weapon.range} · ${weapon.ready}/1`:t('v2.ui.fire')}];})()
            : globalThis.GoblinSiegeWeapons?.active(runtimeActor)
            ? (()=>{const key=previewWeaponKey(actor),weapon=GoblinSiegeWeapons.weapons(actor)?.[key];return [{command:{type:'Fire',actorId:view.actorId,...view.target,weaponKey:key},label:weapon?`${weapon.label} · A${weapon.attack} R${weapon.range} · ${weapon.ready}/1`:t('v2.ui.fire')}];})()
            : runtimeActor?.ogreSystems
            ? (() => { const key = previewWeaponKey(actor), weapon = runtimeActor.ogreSystems.weapons[key];
              return [{command:{type:'Fire',actorId:view.actorId,...view.target,weaponKey:key},
                label:`${t(`v2.ui.weapon.${key}`)} · A${weapon.attack} R${weapon.range} · ${GoblinSystems.weaponReady(weapon)} ${t('v2.ui.ready')}`}]; })()
            : [{ command: { type: 'Fire', actorId: view.actorId, ...view.target },
              label: runtimeActor?.strategicMissile ? `${t('v2.ui.missile')} · ${t('v2.ui.missileSplash')}` : t('v2.ui.fire'),
              confirmSplash:!!runtimeActor?.strategicMissile }]
          : target?.team === 'enemy'
            ? [{ command: { type: 'Ram', actorId: view.actorId, ...view.target }, label: t('v2.ui.ram') }]
            : target?.team === 'player' && target.transportCapacity
              ? [{ command: { type: 'Embark', actorId: view.actorId, carrierId: target.id, ...view.target }, label: t('v2.ui.embark') }]
              : [
                { command: { type: 'Move', actorId: view.actorId, ...view.target }, label: t('v2.ui.move') },
                ...(runtimeActor?.transportCapacity ? carrierCargo(runtimeActor).map(cargo => ({
                  command: { type: 'Unload', actorId: view.actorId, cargoId: cargo.id, ...view.target },
                  label: `${globalThis.GoblinCatalogRuntime?.drone(cargo)?t('v2.ui.catalog.deployDrone'):t('v2.ui.unload')} · ${globalThis.GoblinCatalogRuntime?.record(cargo)?GoblinCatalogRuntime.name(cargo):cargo.name}`
                })) : [])
              ];
      }
      renderCommandMenu(state, actor, commands,
        view.target ? TerrainDisplay.label(terrainTypeAt(view.target.x, view.target.y)) : '');
      renderM1Markers(state, actor?.hp > 0 ? actor : null);
      renderAreaPreview(state, actor?.hp > 0 ? actor : null);
      if (centerFireActor) centerSelectedActor(state);
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    for (const button of at('#v2-area-controls').querySelectorAll('[data-area]'))
      button.onclick = () => { view.areaMode = activeAreaMode(project()) === button.dataset.area ? 'none' : button.dataset.area; render(); };
    at('#v2-area-grid').onclick = () => GoblinUIV2.setGridVisible(!view.gridVisible);
    at('#v2-area-targets').onclick=()=>GoblinUIV2.setTargetsVisible(!view.targetsVisible);
    at('#v2-area-damage').onclick=()=>GoblinUIV2.setDamageVisible(!view.damageVisible);
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
      const actor = state.units.find(unit => unit.id === view.actorId && unit.hp > 0);
      if (actor) centerOnHex(nativeMap.querySelector(`.hex[data-x="${actor.x}"][data-y="${actor.y}"]`));
    }
    function startView() {
      const state = project(), binding = state.markers?.binding;
      if (!binding) return;
      const key = JSON.stringify([binding.scenarioId, binding.profileId, binding.sessionId, binding.epoch]);
      if (startZoomMission === key) return;
      startZoomMission = key;
      if (!matchMedia('(max-width: 599px), (max-height: 500px)').matches) return;
      const actor = state.units.find(unit => unit.team === 'player' && unit.hp > 0 && !unit.embarkedOn);
      if (!actor) return;
      chooseActor(actor.id);
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
      if (!mapPanel.clientWidth || !mapPanel.clientHeight) return;
      const box = nativeMap.viewBox.baseVal;
      const width = box.width || 790, height = box.height || 480;
      const fit = Math.min(mapPanel.clientWidth / width, mapPanel.clientHeight / height);
      const scaledWidth = width * fit * view.zoom, scaledHeight = height * fit * view.zoom;
      nativeMap.style.width = `${scaledWidth}px`;
      nativeMap.style.height = `${scaledHeight}px`;
      nativeMap.style.marginTop = `${Math.max(0, (mapPanel.clientHeight - scaledHeight) / 2)}px`;
    }
    new ResizeObserver(() => applyMapSize()).observe(mapPanel);
    let compactDetails = null;
    function syncLayout() {
      const compact = matchMedia('(max-width: 599px), (max-height: 500px)').matches;
      if (compact !== compactDetails) {
        at('#v2-system-details').open = !compact;
        at('#v2-intel-details').open = !compact;
        at('#v2-log-details').open = !compact;
        compactDetails = compact;
      }
      if (view.target && view.actorId) positionCommandMenu({units:core()?IronDustBrowserV2.view.units:units});
    }
    syncLayout();
    window.addEventListener('resize', syncLayout);
    mapPanel.addEventListener('scroll', () => {
      if (view.target && view.actorId) positionCommandMenu({units:core()?IronDustBrowserV2.view.units:units});
    }, {passive:true});
    at('#v2-command-card').addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = [...at('#v2-command-card').querySelectorAll('button:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {last.focus();event.preventDefault();}
      else if (!event.shiftKey && document.activeElement === last) {first.focus();event.preventDefault();}
    });
    document.addEventListener('click', event => {
      if (view.target && view.actorId && !event.target.closest?.('dialog') &&
          !at('#v2-command-card').contains(event.target) &&
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
      if (view.target && view.actorId) {
        clearContext(); render(); suppressTapUntil = performance.now() + 500;
      }
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
      if (view.target && view.actorId) positionCommandMenu({units:core()?IronDustBrowserV2.view.units:units});
    }, { passive: false });
    mapPanel.addEventListener('contextmenu', event => {
      event.preventDefault();
      const cell = cellAt(event.clientX, event.clientY);
      if (cell && !(view.target && view.actorId)) { view.infoCell = cell; view.message = t('ui.hud.intel'); render(); }
    });
    nativeMap.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (performance.now() < suppressTapUntil || view.target && view.actorId) return;
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
      const own = node => node.nodeType === 1 && /^(goblin-movement-layer|v2-(m1-markers|team-markers|actor-marker|target-marker|focus-marker|grid-overlay|area-overlay))$/.test(node.id);
      if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => !own(node)))) render();
    }).observe(nativeMap, { childList: true });
    render();
    globalThis.GoblinLanguage?.ready.then(render);
  })();
}
