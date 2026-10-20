// Opt-in presentation over the selected Legacy or Core session.
if (new URLSearchParams(location.search).get('ui') === 'v2' && !globalThis.goblinBootProfileError) {
  (() => {
    const nativeMap = document.querySelector('#battlefield-map');
    const nativeShell = document.querySelector('.app-shell');
    const view = { actorId: null, target: null, infoCell: null, focusCell: null,
      intentRevision: null, busy: false, message: '', zoom: 1 };
    const shell = document.createElement('div');
    shell.className = 'v2-shell';
    shell.innerHTML = `
      <header class="v2-head"><div><span class="v2-label">G.O.B.L.I.N. / Mission</span><h1 id="v2-mission"></h1><p id="v2-objective"></p></div><div><span class="v2-label" id="v2-profile"></span><strong id="v2-phase"></strong><p id="v2-turn"></p></div></header>
      <div class="v2-layout"><main class="v2-card v2-map-card"><div class="v2-row"><div><span class="v2-label" id="v2-map-label"></span><strong id="v2-map-caption"></strong></div><button type="button" id="v2-undo"></button></div><div class="v2-map" id="v2-map" tabindex="0"></div><div class="v2-context"><span id="v2-selection"></span><strong id="v2-terminal" hidden></strong><p id="v2-message" class="v2-status" role="status"></p></div><div class="v2-controls"><button type="button" id="v2-phase-action"></button><button type="button" id="v2-pause"></button></div></main>
      <aside class="v2-side"><section class="v2-card"><span class="v2-label" id="v2-units-label"></span><div class="v2-units" id="v2-units"></div></section><section class="v2-card"><span class="v2-label" id="v2-intel-label"></span><div id="v2-intel"></div><span class="v2-label" id="v2-log-label"></span><div id="v2-log"></div></section><section class="v2-card v2-command-card" id="v2-command-card" aria-labelledby="v2-command-target"><span class="v2-label" id="v2-command-target"></span><div class="v2-actions" id="v2-actions"></div><div class="v2-command-footer" id="v2-command-footer"></div></section></aside></div>`;
    document.body.insertBefore(shell, nativeShell);
    shell.querySelector('#v2-map').appendChild(nativeMap);
    document.body.classList.add('ui-v2-active');
    const at = selector => shell.querySelector(selector);
    const t = (key, params) => globalThis.GoblinLanguage?.t(key, params) || key;
    const core = () => globalThis.IronDustBrowserV2?.mode === 'ready';

    function revision() {
      if (core()) return `core:${IronDustBrowserV2.epoch}:${IronDustBrowserV2.session.profile.digest}`;
      return JSON.stringify([currentScenario, legacySession?.sessionId, legacySession?.ruleProfileId, turn, phase, turnPhase, gameOver,
        [...terrain], [...terrainTypes], units.map(({ moveFrom, justHit, ...unit }) => unit)]);
    }
    function project() {
      if (core()) {
        const source = IronDustBrowserV2.view;
        return {
          revision: revision(), scenario: 'iron-dust-v2', profile: source.ruleProfileId,
          mission: {title:t('mission.iron-dust-v2.title'), objective:t('v2.objective')},
          turn:source.turn, phase:source.mode === 'player' ? 'player' : source.mode,
          turnPhase:source.phase, gameOver:source.mode === 'ended',
          objective:{goalMode:'core', coreHp:source.objective.coreHp,
            coreMax:source.objective.coreMaxHp, outcome:source.victory.winner === 'player' ? true :
              source.mode === 'ended' ? false : null},
          ready:source.units.filter(unit => unit.team === 'player' && unit.hp > 0 && !unit.disabled && !unit.moved).length,
          undo:{available:false,count:0}, units:source.units, cells:source.cells,
          systems:source.units.filter(unit => unit.weapons).map(unit => ({id:unit.id,
            summary:{treads:unit.treads,weapons:Object.fromEntries(Object.entries(unit.weapons)
              .map(([key, weapon]) => [key, weapon.ready]))}})),
          log:source.events.map(event => IronDustBrowserV2.formatEvent(event))
        };
      }
      const objective = objectiveSnapshot(victoryProfile(legacySession.effectiveRules), units);
      return {
        revision: revision(), scenario: currentScenario, profile: legacySession.ruleProfileId,
        mission: { title: t(`mission.${currentScenario}.title`), objective: t(`mission.${currentScenario}.objective.short`) },
        turn, phase, turnPhase, gameOver, objective: structuredClone(objective),
        ready: phase === 'player' && !gameOver ? phaseReadyUnits().length : 0,
        undo: { available: phaseCommands.length > 0 && phase === 'player' && !gameOver, count: phaseCommands.length },
        units: units.map(({ id, name, type, team, x, y, hp, maxHp, disabled, embarkedOn, core, infantry, transportCapacity, strategicMissile, missilesRemaining }) =>
          ({ id, name, type, team, x, y, hp, maxHp, disabled: !!disabled, embarkedOn: embarkedOn || null,
            core: !!core, infantry: !!infantry, transportCapacity: transportCapacity || 0, strategicMissile: !!strategicMissile,
            missilesRemaining: missilesRemaining ?? null })),
        systems: units.filter(unit => unit.team === 'player' && unit.ogreSystems)
          .map(unit => ({ id: unit.id, summary: GoblinSystems.summary(unit.ogreSystems) })),
        log: [...logEl.querySelectorAll('.log-line')].slice(0, 4).map(line => line.textContent.trim())
      };
    }
    function query(command) {
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
      if (!['Move', 'Ram', 'Fire', 'Embark', 'Unload'].includes(command?.type)) return { ok: false, reason: t('ui.error.UNKNOWN_COMMAND') };
      const actor = units.find(unit => unit.id === command.actorId);
      if (!actor) return { ok: false, reason: t('ui.error.UNIT_NOT_FOUND') };
      if (actor.team !== 'player') return { ok: false, reason: t('ui.error.UNIT_NOT_OWNED') };
      if (actor.hp <= 0) return { ok: false, reason: t('ui.error.UNIT_DESTROYED') };
      if (actor.disabled) return { ok: false, reason: t('ui.error.UNIT_DISABLED') };
      if (!Number.isInteger(command.x) || !Number.isInteger(command.y) || command.x < 0 || command.x >= W || command.y < 0 || command.y >= H)
        return { ok: false, reason: t('ui.error.OUT_OF_BOUNDS') };
      const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === command.x && unit.y === command.y);
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
        const path = findMovementPath(actor, { x: command.x, y: command.y }, second ? 2 : actor.move, actor);
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
    function dispatch(command, expectedRevision) {
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
      view.actorId = null; view.infoCell = null; view.focusCell = null; clearContext();
      view.zoom = 1; nativeMap.style.removeProperty('width'); nativeMap.style.removeProperty('height');
      at('#v2-map').scrollLeft = 0; at('#v2-map').scrollTop = 0;
      render();
    }
    globalThis.GoblinUIV2 = Object.freeze({ project, query, dispatch, undo, resetView, focusUnit,
      refresh: () => render() });

    function clearContext() { view.target = null; view.intentRevision = null; view.message = ''; }
    function chooseActor(id) {
      const unit = (core() ? project().units : units).find(item => item.id === id && item.team === 'player' && item.hp > 0);
      view.actorId = unit?.id || null;
      if (unit) { view.focusCell = { x: unit.x, y: unit.y }; view.infoCell = { x: unit.x, y: unit.y }; }
      clearContext(); render();
    }
    function focusUnit(id) {
      const unit = (core() ? project().units : units).find(item => item.id === id && item.hp > 0);
      if (!unit) return;
      if (unit.team === 'player') chooseActor(id);
      else {
        view.actorId = null; view.focusCell = { x: unit.x, y: unit.y };
        view.infoCell = { ...view.focusCell }; clearContext(); render();
      }
      at('#v2-map').focus({ preventScroll: true });
      const hex = unit && nativeMap.querySelector(`.hex[data-x="${unit.x}"][data-y="${unit.y}"]`);
      hex?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function chooseHex(x, y) {
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
          at('#v2-map').scrollIntoView({ block: 'start' });
        at('#v2-actions button:not(:disabled)')?.focus();
      }
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
      at('#v2-profile').textContent = state.profile;
      at('#v2-phase').textContent = state.gameOver ? t(state.objective.outcome ? 'v2.win' : 'v2.lose') :
        state.phase === 'enemy' ? t('v2.enemy') : t(`v2.phase.${state.turnPhase}`);
      at('#v2-turn').textContent = `${t('ui.hud.turn',{turn:state.turn})} · ${t('v2.ui.coreHp')} ${state.objective.coreHp}/${state.objective.coreMax}`;
      const terminal = at('#v2-terminal'); terminal.hidden = !state.gameOver;
      terminal.classList.toggle('v2-failed', state.gameOver && !state.objective.outcome);
      terminal.textContent = state.gameOver ? t(state.objective.outcome ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title') : '';
      const phaseButton = at('#v2-phase-action');
      phaseButton.textContent = state.phase === 'enemy' ? t('v2.enemy') : state.gameOver ? t('v2.ended') :
        state.turnPhase === 'gev' ? t('v2.endTurn') : t('v2.next');
      phaseButton.setAttribute('aria-label',phaseButton.textContent);
      phaseButton.disabled = state.phase !== 'player' || !IronDustBrowserV2.query({type:'EndPhase',playerId:'player'}).available ||
        GameDialogs.isOpen() || view.busy;
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      at('#v2-pause').textContent = t('ui.nav.pause');
      at('#v2-undo').hidden = true;
      at('#v2-units-label').textContent = t('ui.hud.units');
      at('#v2-intel-label').textContent = t('v2.ui.fieldSystems');
      at('#v2-log-label').textContent = t('ui.details.log');
      at('#v2-selection').textContent = actor?.name || t('ui.hud.noSelection');
      at('#v2-message').textContent = view.message;
      const roster = at('#v2-units'); roster.replaceChildren();
      state.units.filter(unit => unit.team === 'player').forEach(unit => {
        const button = document.createElement('button');
        const capabilities = `${t('v2.ui.move')} ${unit.move ?? t('v2.ui.bySystem')} · ${t('v2.ui.range')} ${unit.range ?? t('v2.ui.byWeapon')}`;
        const weapons = unit.weapons ? ` · ${Object.entries(unit.weapons).map(([key, weapon]) =>
          `${t(`v2.ui.weapon.${key}`)} ${weapon.ready}`).join(' · ')}` : '';
        button.textContent = `${t('ui.team.player')} · ${unit.name} · ${unit.hp}/${unit.maxHp} HP · ${capabilities}${unit.treads === null ? '' : ` · ${t('v2.ui.treads')} ${unit.treads}`}${weapons}${unit.selectedWeapon ? ` · ${t('v2.ui.selectedWeapon')}: ${t(`v2.ui.weapon.${unit.selectedWeapon}`)}` : ''}${unit.moved ? ` · ${t('v2.ui.moved')}` : ''}${unit.fired ? ` · ${t('v2.ui.fired')}` : ''}${unit.secondMoved ? ` · ${t('v2.ui.secondMoved')}` : ''}${unit.disabled ? ` · ${t('v2.ui.disabled')}` : ''}`;
        button.setAttribute('aria-pressed',String(unit.id === view.actorId));
        button.disabled = unit.hp <= 0; button.onclick = () => chooseActor(unit.id); roster.append(button);
      });
      const intel = at('#v2-intel'); intel.replaceChildren();
      const cell = view.target || view.infoCell;
      if (cell) {
        const terrain = state.cells.find(item => item.x === cell.x && item.y === cell.y);
        const occupant = state.units.find(unit => unit.hp > 0 && unit.x === cell.x && unit.y === cell.y);
        const line = document.createElement('p');
        line.textContent = `${t('v2.ui.sector')} ${String.fromCharCode(65 + cell.x)}-${String(cell.y+1).padStart(2,'0')} · ${t(`v2.ui.terrain.${terrain?.type}`)}${occupant ? ` · ${occupant.name} (${t(occupant.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')}) · ${occupant.hp}/${occupant.maxHp} HP` : ''}`;
        intel.append(line);
      }
      state.systems.forEach(({id,summary}) => {const line=document.createElement('p');line.className='v2-system';
        line.textContent=`${id}: ${t('v2.ui.treads')} ${summary.treads}; ${Object.entries(summary.weapons).map(([key,count]) => `${t(`v2.ui.weapon.${key}`)} ${count}`).join(' · ')}`;intel.append(line);});
      const log = at('#v2-log'); log.replaceChildren();
      state.log.slice(-4).forEach(entry => {const line=document.createElement('p');line.textContent=entry;log.append(line);});
      const actions = at('#v2-actions'); actions.replaceChildren();
      const footer = at('#v2-command-footer'); footer.replaceChildren();
      const menuOpen = !!(view.target && view.actorId);
      document.body.classList.toggle('v2-menu-open',menuOpen);
      at('#v2-command-card').setAttribute('role',menuOpen ? 'dialog':'region');
      at('#v2-command-target').textContent = menuOpen ? `${t('v2.ui.commandTarget')} · ${String.fromCharCode(65+view.target.x)}-${String(view.target.y+1).padStart(2,'0')}` : t('v2.ui.commandTarget');
      if (menuOpen) {
        const target=state.units.find(unit => unit.hp>0 && unit.x===view.target.x && unit.y===view.target.y);
        const commands=[];
        if (state.turnPhase==='fire' && target?.team==='enemy') {
          if (actor.weapons) Object.entries(actor.weapons).forEach(([key,weapon]) => {
            const selected=key===actor.selectedWeapon;
            commands.push({command:selected ? {type:'PlayerFire',playerId:'player',unitId:actor.id,targetId:target.id,weaponKey:key} :
              {type:'SelectWeapon',playerId:'player',unitId:actor.id,weaponKey:key},
              label:`${t(`v2.ui.weapon.${key}`)} · A${weapon.attack} R${weapon.range} · ${weapon.ready} ${t('v2.ui.ready')} · ${t(selected?'v2.ui.fire':'v2.ui.weapon')}`,
              keepTarget:!selected});
          });
          else commands.push({command:{type:'PlayerFire',playerId:'player',unitId:actor.id,targetId:target.id},label:t('v2.ui.fire')});
        } else if (state.turnPhase!=='fire') {
          if (target?.team==='enemy') commands.push({command:{type:'Ram',playerId:'player',unitId:actor.id,targetId:target.id},label:t('v2.ui.ram')});
          else if (!target) commands.push({command:{type:'Move',playerId:'player',unitId:actor.id,to:{...view.target}},label:t('v2.ui.move')});
        }
        commands.forEach(({command,label,keepTarget}) => {
          const availability=query(command),button=document.createElement('button');
          button.textContent=availability.ok ? `${label} · ${t('ui.hud.intent.confirm')}` : `${label} · ${t('ui.hud.blocked',{reason:availability.reason})}`;
          button.disabled=!availability.ok || view.busy;
          button.onclick=()=>{const result=dispatch(command,view.intentRevision);
            if(result.ok){if(keepTarget)view.intentRevision=revision();else clearContext();}
            view.message=result.ok?'':result.reason;render();if(result.ok)at('.v2-map-card').scrollIntoView({block:'start'});};
          actions.append(button);
        });
        const cancel=document.createElement('button');cancel.textContent=t('ui.dialog.cancel');cancel.onclick=()=>{clearContext();render();at('#v2-map').focus();};
        const pause=document.createElement('button');pause.textContent=t('ui.nav.pause');pause.onclick=()=>at('#v2-pause').click();
        footer.append(cancel,pause);
      } else {const hint=document.createElement('p');hint.textContent=view.actorId?t('v2.ui.selectHex'):t('ui.hud.noIntent');actions.append(hint);}
      let teams=nativeMap.querySelector('#v2-team-markers');
      if(!teams){teams=document.createElementNS(NS,'g');teams.id='v2-team-markers';teams.setAttribute('pointer-events','none');nativeMap.append(teams);}
      teams.replaceChildren();
      state.units.filter(unit=>!unit.embarkedOn).forEach(unit=>{
        const center=hexCenter(unit.x,unit.y),frame=document.createElementNS(NS,'polygon');
        frame.classList.add(unit.team==='player'?'v2-team-own':'v2-team-enemy');
        if(unit.disabled||unit.hp<=0)frame.classList.add('v2-team-inactive');
        frame.setAttribute('points',hexPoints(unit.x,unit.y));frame.setAttribute('aria-label',`${t(unit.team==='player'?'ui.team.player':'ui.team.enemy')}: ${unit.name}${unit.id==='core'?`, ${t('ui.hud.objective')}`:''}`);teams.append(frame);
        if(unit.id==='core'){const badge=document.createElementNS(NS,'text');badge.classList.add('v2-goal-badge');badge.setAttribute('x',center.x+24);badge.setAttribute('y',center.y-21);badge.textContent='◎';teams.append(badge);}
      });
      for(const [id,cell] of [['v2-actor-marker',actor],['v2-target-marker',view.target],['v2-focus-marker',view.focusCell]]){
        let shape=nativeMap.querySelector(`#${id}`);if(!cell){shape?.remove();continue;}
        if(!shape){shape=document.createElementNS(NS,'polygon');shape.id=id;shape.setAttribute('pointer-events','none');nativeMap.append(shape);}
        shape.setAttribute('points',hexPoints(cell.x,cell.y));
      }
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    function render() {
      const state = project();
      if (core()) { renderCore(state); return; }
      const actor = state.units.find(unit => unit.id === view.actorId);
      if (!actor || actor.hp <= 0) { view.actorId = null; clearContext(); }
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-map-label').textContent = GoblinLanguage.translate('TACTICAL MAP');
      at('#v2-units-label').textContent = t('ui.hud.units');
      at('#v2-intel-label').textContent = t('v2.ui.fieldSystems');
      at('#v2-log-label').textContent = t('ui.details.log');
      at('#v2-profile').textContent = state.profile;
      at('#v2-phase').textContent = state.gameOver ? t(state.objective.outcome ? 'v2.win' : 'v2.lose') : t(`phase.${state.turnPhase}.label`);
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
        button.textContent = system
          ? `${t('ui.team.player')} · ${unit.name} · ${t('v2.ui.treads')} ${system.summary.treads} · ${Object.entries(system.summary.weapons).map(([key, count]) => `${t(`v2.ui.weapon.${key}`)} ${count}`).join(' · ')}${unit.hp <= 0 ? ` · ${t('v2.ui.destroyed')}` : unit.disabled ? ` · ${t('v2.ui.disabled')}` : ''}`
          : `${t('ui.team.player')} · ${t(unit.infantry ? 'v2.ui.infantrySummary' : 'ui.hud.unitSummary',
            { unitId: unit.name, unitType: GoblinLanguage.translate(unit.type || ''), hp: unit.hp, maxHp: unit.maxHp })}${unit.disabled ? ` · ${t('v2.ui.disabled')}` : ''}${carrier ? ` · ${t('v2.ui.embarked')} ${carrier.name}` : ''}${cargo ? ` · ${t('v2.ui.cargo')} ${carrierLoad(cargo)}/${unit.transportCapacity}` : ''}${unit.strategicMissile ? ` · ${t('v2.ui.missile')} ${unit.missilesRemaining}` : ''}`;
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
        line.textContent = `${t('v2.ui.sector')} ${String.fromCharCode(65 + x)}-${String(y + 1).padStart(2, '0')} · ${GoblinLanguage.translate(terrainTypeAt(x, y))}${target ? ` · ${target.name} (${t(target.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')})` : ''}`;
        intel.appendChild(line);
      }
      state.systems.forEach(({ id, summary }) => {
        const line = document.createElement('p'); line.className = 'v2-system';
        line.textContent = `${id}: ${t('v2.ui.treads')} ${summary.treads}; ${Object.entries(summary.weapons).map(([name, count]) => `${t(`v2.ui.weapon.${name}`)} ${count}`).join(' · ')}`;
        intel.appendChild(line);
      });
      const log = at('#v2-log'); log.replaceChildren();
      state.log.forEach(entry => { const line = document.createElement('p'); line.textContent = entry; log.appendChild(line); });
      const actions = at('#v2-actions'); actions.replaceChildren();
      const footer = at('#v2-command-footer'); footer.replaceChildren();
      const menuOpen = !!(view.target && view.actorId);
      document.body.classList.toggle('v2-menu-open', menuOpen);
      at('#v2-command-card').setAttribute('role', menuOpen ? 'dialog' : 'region');
      at('#v2-command-target').textContent = menuOpen
        ? `${t('v2.ui.commandTarget')} · ${String.fromCharCode(65 + view.target.x)}-${String(view.target.y + 1).padStart(2, '0')} · ${GoblinLanguage.translate(terrainTypeAt(view.target.x, view.target.y))}`
        : t('v2.ui.commandTarget');
      if (view.target && view.actorId) {
        const runtimeActor = units.find(unit => unit.id === view.actorId);
        const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
        const commands = state.turnPhase === 'fire'
          ? runtimeActor?.ogreSystems
            ? SiegebreakerWeapons.weaponEntries(runtimeActor).map(({ key, weapon }) => ({
              command: { type: 'Fire', actorId: view.actorId, ...view.target, weaponKey: key },
              label: `${t(`v2.ui.weapon.${key}`)} · A${weapon.attack} R${weapon.range} · ${GoblinSystems.weaponReady(weapon)} ${t('v2.ui.ready')}` }))
            : [{ command: { type: 'Fire', actorId: view.actorId, ...view.target },
              label: runtimeActor?.strategicMissile ? `${t('v2.ui.missile')} · ${t('v2.ui.missileSplash')}` : t('v2.ui.fire') }]
          : target?.team === 'enemy'
            ? [{ command: { type: 'Ram', actorId: view.actorId, ...view.target }, label: t('v2.ui.ram') }]
            : target?.team === 'player' && target.transportCapacity
              ? [{ command: { type: 'Embark', actorId: view.actorId, carrierId: target.id, ...view.target }, label: t('v2.ui.embark') }]
              : [
                { command: { type: 'Move', actorId: view.actorId, ...view.target }, label: t('v2.ui.move') },
                ...(runtimeActor?.transportCapacity ? carrierCargo(runtimeActor).map(cargo => ({
                  command: { type: 'Unload', actorId: view.actorId, cargoId: cargo.id, ...view.target },
                  label: `${t('v2.ui.unload')} · ${cargo.name}`
                })) : [])
              ];
        commands.forEach(({ command, label }) => {
          const availability = query(command);
          const button = document.createElement('button');
          button.textContent = availability.ok
            ? `${label} · ${t('ui.hud.intent.confirm')}${availability.path ? ` · ${availability.path.length}` : ''}`
            : `${label} · ${t('ui.hud.blocked', { reason: availability.reason })}`;
          button.disabled = !availability.ok || view.busy;
          button.onclick = () => {
            const result = dispatch(command, view.intentRevision);
            if (result.ok) clearContext();
            view.message = result.ok ? '' : result.reason;
            render();
            if (result.ok) at('.v2-map-card').scrollIntoView({ block: 'start' });
          };
          actions.appendChild(button);
        });
        const cancel = document.createElement('button'); cancel.textContent = t('ui.dialog.cancel');
        cancel.onclick = () => { clearContext(); render(); at('#v2-map').focus(); };
        const pause = document.createElement('button'); pause.textContent = t('ui.nav.pause');
        pause.onclick = () => at('#v2-pause').click();
        footer.append(cancel, pause);
      } else {
        const hint = document.createElement('p'); hint.textContent = view.actorId ? t('v2.ui.selectHex') : t('ui.hud.noIntent');
        actions.appendChild(hint);
      }
      function marker(id, cell) {
        let shape = nativeMap.querySelector(`#${id}`);
        if (!cell) { shape?.remove(); return; }
        if (!shape) {
          shape = document.createElementNS(NS, 'polygon'); shape.id = id;
          shape.setAttribute('pointer-events', 'none'); nativeMap.appendChild(shape);
        }
        shape.setAttribute('points', hexPoints(cell.x, cell.y));
      }
      let teams = nativeMap.querySelector('#v2-team-markers');
      if (!teams) {
        teams = document.createElementNS(NS, 'g'); teams.id = 'v2-team-markers';
        teams.setAttribute('pointer-events', 'none'); nativeMap.appendChild(teams);
      }
      teams.replaceChildren();
      state.units.filter(unit => !unit.embarkedOn).forEach(unit => {
        const c = hexCenter(unit.x, unit.y);
        const frame = document.createElementNS(NS, 'polygon');
        frame.classList.add(unit.team === 'player' ? 'v2-team-own' : 'v2-team-enemy');
        if (unit.disabled || unit.hp <= 0) frame.classList.add('v2-team-inactive');
        frame.setAttribute('points', unit.team === 'player' ? hexPoints(unit.x, unit.y)
          : `${c.x},${c.y - S} ${c.x + S - 4},${c.y} ${c.x},${c.y + S} ${c.x - S + 4},${c.y}`);
        frame.setAttribute('role', 'img');
        frame.setAttribute('aria-label', `${t(unit.team === 'player' ? 'ui.team.player' : 'ui.team.enemy')}: ${unit.name}${unit.core ? `, ${t('ui.hud.objective')}` : ''}${unit.hp <= 0 ? `, ${t('v2.ui.destroyed')}` : unit.disabled ? `, ${t('v2.ui.disabled')}` : ''}`);
        teams.appendChild(frame);
        function badge(kind, x, y, mark) {
          const badge = document.createElementNS(NS, 'text');
          badge.setAttribute('x', c.x + x); badge.setAttribute('y', c.y + y);
          badge.classList.add(kind); badge.textContent = mark;
          teams.appendChild(badge);
        }
        if (unit.core) {
          const octagon = document.createElementNS(NS, 'polygon');
          octagon.classList.add('v2-goal-octagon');
          octagon.setAttribute('points', Array.from({ length: 8 }, (_, i) => {
            const angle = Math.PI / 8 + i * Math.PI / 4;
            return `${c.x + 24 + 12 * Math.cos(angle)},${c.y - 26 + 12 * Math.sin(angle)}`;
          }).join(' '));
          teams.appendChild(octagon);
          badge('v2-goal-badge', 24, -21, '◎');
        }
        if (unit.disabled && unit.hp > 0) badge('v2-disabled-badge', -24, -21, '!');
        if (unit.hp <= 0) badge('v2-destroyed-badge', 24, 29, '×');
      });
      marker('v2-actor-marker', actor);
      marker('v2-target-marker', view.target);
      marker('v2-focus-marker', view.focusCell);
      globalThis.dispatchEvent(new Event('goblin-v2-render'));
    }
    at('#v2-undo').onclick = () => { const result = undo(); if (!result.ok) { view.message = result.reason; render(); } };
    at('#v2-phase-action').onclick = () => {
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
      const next = Math.max(1, Math.min(2.5, value));
      if (next === view.zoom) return;
      const rect = mapPanel.getBoundingClientRect(), ratio = next / view.zoom;
      const x = mapPanel.scrollLeft + clientX - rect.left, y = mapPanel.scrollTop + clientY - rect.top;
      view.zoom = next;
      if (next === 1) { nativeMap.style.removeProperty('width'); nativeMap.style.removeProperty('height'); }
      else {
        nativeMap.style.width = `${Math.max(640, mapPanel.clientWidth) * next}px`;
        nativeMap.style.height = `${Math.max(390, mapPanel.clientHeight) * next}px`;
      }
      mapPanel.scrollLeft = x * ratio - (clientX - rect.left);
      mapPanel.scrollTop = y * ratio - (clientY - rect.top);
    }
    function pointerDistance() {
      const [first, second] = [...pointers.values()];
      return Math.hypot(first.x - second.x, first.y - second.y);
    }
    mapPanel.addEventListener('pointerdown', event => {
      if (view.target && view.actorId || event.pointerType === 'mouse' && event.button !== 0) return;
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
      event.preventDefault();
      setZoom(view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), event.clientX, event.clientY);
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
      if (document.body.classList.contains('v2-screen-open')) {
        if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'l') {
          event.preventDefault(); event.stopImmediatePropagation();
        }
        return;
      }
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
    globalThis.addEventListener('goblin-core-v2-render', () => {if(core()) render();});
    new MutationObserver(changes => {
      const own = node => node.nodeType === 1 && /^v2-(team-markers|actor-marker|target-marker|focus-marker)$/.test(node.id);
      if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => !own(node)))) render();
    }).observe(nativeMap, { childList: true });
    render();
    globalThis.GoblinLanguage?.ready.then(render);
  })();
}
