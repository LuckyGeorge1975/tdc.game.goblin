// Opt-in presentation over the current Legacy session. The default entry never runs this code.
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
      <div class="v2-layout"><main class="v2-card v2-map-card"><div class="v2-row"><div><span class="v2-label">Taktische Karte</span><strong id="v2-map-caption"></strong></div><button type="button" id="v2-undo" aria-label="Letzten Befehl dieser Phase rückgängig machen">Zurück</button></div><div class="v2-map" id="v2-map" tabindex="0" aria-label="Karte: Einheit und danach Zielfeld wählen"></div><div class="v2-context"><span id="v2-selection"></span><strong id="v2-terminal" hidden></strong><p id="v2-message" class="v2-status" role="status"></p></div><div class="v2-controls"><button type="button" id="v2-phase-action"></button><button type="button" id="v2-pause">Pause</button></div></main>
      <aside class="v2-side"><section class="v2-card"><span class="v2-label">Eigene Einheiten</span><div class="v2-units" id="v2-units"></div></section><section class="v2-card"><span class="v2-label">Feld und Systeme</span><div id="v2-intel"></div><span class="v2-label">Ereignisse</span><div id="v2-log"></div></section><section class="v2-card v2-command-card" id="v2-command-card" aria-labelledby="v2-command-target"><span class="v2-label" id="v2-command-target">Befehle für Zielhex</span><div class="v2-actions" id="v2-actions"></div><div class="v2-command-footer" id="v2-command-footer"></div></section></aside></div>`;
    document.body.insertBefore(shell, nativeShell);
    shell.querySelector('#v2-map').appendChild(nativeMap);
    document.body.classList.add('ui-v2-active');
    const at = selector => shell.querySelector(selector);

    function revision() {
      return JSON.stringify([currentScenario, legacySession?.ruleProfileId, turn, phase, turnPhase, gameOver,
        [...terrain], [...terrainTypes], units.map(({ moveFrom, justHit, ...unit }) => unit)]);
    }
    function project() {
      const config = legacySession.config;
      const objective = objectiveSnapshot(victoryProfile(legacySession.effectiveRules), units);
      return {
        revision: revision(), scenario: currentScenario, profile: legacySession.ruleProfileId,
        mission: { title: config.title, objective: document.querySelector('#mission-sub').textContent },
        turn, phase, turnPhase, gameOver, objective: structuredClone(objective),
        ready: phase === 'player' && !gameOver ? phaseReadyUnits().length : 0,
        undo: { available: phaseCommands.length > 0 && phase === 'player' && !gameOver, count: phaseCommands.length },
        units: units.map(({ id, name, team, x, y, hp, maxHp, disabled, embarkedOn, core }) =>
          ({ id, name, team, x, y, hp, maxHp, disabled: !!disabled, embarkedOn: embarkedOn || null, core: !!core })),
        systems: units.filter(unit => unit.team === 'player' && unit.ogreSystems)
          .map(unit => ({ id: unit.id, summary: GoblinSystems.summary(unit.ogreSystems) })),
        log: [...logEl.querySelectorAll('.log-line')].slice(0, 4).map(line => line.textContent.trim())
      };
    }
    function query(command) {
      if (currentScenario !== 'iron-dust' || legacySession?.ruleProfileId !== 'FIELD_TEST_LEGACY_v2' || globalThis.IronDustBrowserV2?.active)
        return { ok: false, reason: 'Dieser V2-Grundschnitt ist nur für Legacy IRON DUST v2 verfügbar.' };
      if (GameDialogs.isOpen()) return { ok: false, reason: 'Zuerst den offenen Dialog schließen.' };
      if (phase !== 'player' || gameOver) return { ok: false, reason: 'Spielerphase ist nicht aktiv.' };
      if (!['Move', 'Ram', 'Fire'].includes(command?.type)) return { ok: false, reason: 'Unbekannter Befehl.' };
      const actor = units.find(unit => unit.id === command.actorId);
      if (!actor || actor.team !== 'player' || actor.hp <= 0 || actor.disabled)
        return { ok: false, reason: 'Keine einsatzfähige eigene Einheit.' };
      if (!Number.isInteger(command.x) || !Number.isInteger(command.y) || command.x < 0 || command.x >= W || command.y < 0 || command.y >= H)
        return { ok: false, reason: 'Zielfeld liegt außerhalb der Karte.' };
      const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === command.x && unit.y === command.y);
      if (command.type === 'Move') {
        if (turnPhase !== 'movement' && turnPhase !== 'gev') return { ok: false, reason: 'Bewegungsphase ist nicht aktiv.' };
        if (actor.embarkedOn) return { ok: false, reason: 'Eingeschiffte Einheit kann nicht bewegen.' };
        const second = turnPhase === 'gev';
        if (!canMoveUnit(actor, second)) return { ok: false, reason: 'Einheit hat keine Bewegung mehr.' };
        if (target) return { ok: false, reason: 'Zielfeld ist belegt.' };
        const path = findMovementPath(actor, { x: command.x, y: command.y }, second ? 2 : actor.move, actor);
        return path?.length ? { ok: true, path: path.map(cell => ({ ...cell })) }
          : { ok: false, reason: 'Kein zulässiger Weg zum Zielfeld.' };
      }
      if (!target || target.team !== 'enemy') return { ok: false, reason: 'Kein gültiges gegnerisches Ziel.' };
      if (command.type === 'Ram') {
        if (turnPhase !== 'movement' || actor.id !== 'ogre' || actor.embarkedOn || actor.moved || target.core)
          return { ok: false, reason: 'Rammen nur mit ungezogener GOBLIN-Einheit gegen Nicht-Core-Ziel in Movement.' };
        const path = findMovementPath(actor, { x: command.x, y: command.y }, actor.move, actor);
        return path?.length ? { ok: true, path: path.map(cell => ({ ...cell })) }
          : { ok: false, reason: 'Kein zulässiger Rammweg.' };
      }
      if (turnPhase !== 'fire' || !phaseCanAct(actor, 'fire')) return { ok: false, reason: 'Einheit hat in der Feuerphase keine verfügbare Aktion.' };
      if (actor.ogreSystems) {
        const weapon = actor.ogreSystems.weapons[command.weaponKey];
        if (!weapon || !SiegebreakerWeapons.targetAllowed(actor, target, command.weaponKey))
          return { ok: false, reason: 'Waffe für dieses Ziel nicht verfügbar.' };
        return { ok: true, weapon: { key: command.weaponKey, label: weapon.label, attack: weapon.attack, range: weapon.range } };
      }
      if (dist(actor, target) > actor.range || !lineOfSight(actor, target))
        return { ok: false, reason: 'Ziel außerhalb der Reichweite oder Sichtlinie.' };
      return weaponTargetAllowed(actor, target) ? { ok: true }
        : { ok: false, reason: 'Ziel für diese Waffe nicht verfügbar.' };
    }
    function dispatch(command, expectedRevision) {
      if (view.busy) return { ok: false, reason: 'Befehl läuft bereits.' };
      if (typeof expectedRevision !== 'string' || expectedRevision !== revision()) return { ok: false, reason: 'Spielstand hat sich geändert. Ziel erneut wählen.' };
      const check = query(command);
      if (!check.ok) return check;
      view.busy = true;
      try {
        const actor = units.find(unit => unit.id === command.actorId);
        selected = actor;
        if (command.type === 'Fire' && actor.ogreSystems && !SiegebreakerWeapons.selectWeapon(actor, command.weaponKey))
          return { ok: false, reason: 'Waffe nicht mehr verfügbar.' };
        const beforeExecution = revision();
        // handleHex is the final, command-history-wrapped Legacy path and checks again.
        handleHex(command.x, command.y);
        return revision() !== beforeExecution ? { ok: true } : { ok: false, reason: 'Runtime hat den Befehl abgelehnt.' };
      } finally { view.busy = false; render(); }
    }
    function undo() {
      if (view.busy || !phaseCommands.length || phase !== 'player' || gameOver) return { ok: false, reason: 'Kein Befehl in dieser Phase rückgängig zu machen.' };
      clearContext();
      undoPhaseCommand();
      render();
      return { ok: true };
    }
    globalThis.GoblinUIV2 = Object.freeze({ project, query, dispatch, undo });

    function clearContext() { view.target = null; view.intentRevision = null; view.message = ''; }
    function chooseActor(id) {
      const unit = units.find(item => item.id === id && item.team === 'player' && item.hp > 0);
      view.actorId = unit?.id || null;
      if (unit) { view.focusCell = { x: unit.x, y: unit.y }; view.infoCell = { x: unit.x, y: unit.y }; }
      clearContext(); render();
    }
    function chooseHex(x, y) {
      const unit = units.find(item => item.hp > 0 && !item.embarkedOn && item.x === x && item.y === y);
      if (unit?.team === 'player') { chooseActor(unit.id); return; }
      view.target = { x, y }; view.infoCell = { x, y }; view.focusCell = { x, y };
      view.intentRevision = revision(); view.message = ''; render();
      if (view.actorId) {
        if (matchMedia('(max-width: 599px), (max-height: 500px)').matches)
          at('#v2-map').scrollIntoView({ block: 'start' });
        at('#v2-actions button:not(:disabled)')?.focus();
      }
    }
    function render() {
      const state = project();
      const actor = state.units.find(unit => unit.id === view.actorId);
      if (!actor || actor.hp <= 0) { view.actorId = null; clearContext(); }
      if (state.phase !== 'player' || state.gameOver) clearContext();
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-profile').textContent = state.profile;
      at('#v2-phase').textContent = state.turnPhase.toUpperCase();
      at('#v2-turn').textContent = `Zug ${state.turn} · Zielstatus ${state.objective.remaining}/${state.objective.total}`;
      at('#v2-map-caption').textContent = `${W} × ${H} Hexfelder · Karte verschieben`;
      const terminal = at('#v2-terminal');
      terminal.hidden = !state.gameOver;
      terminal.classList.toggle('v2-failed', state.gameOver && state.objective.outcome === false);
      terminal.textContent = state.gameOver ? (state.objective.outcome ? 'MISSION COMPLETE' : 'MISSION FAILED') : '';
      const next = { movement: 'Feuerphase', fire: 'Skimmer-Manöver', gev: 'Gegnerzug' }[state.turnPhase];
      const phaseButton = at('#v2-phase-action');
      phaseButton.textContent = next ? `Weiter: ${next} · ${state.ready} offen` : 'Gegnerzug / Missionsende';
      phaseButton.disabled = !next || state.phase !== 'player' || state.gameOver || GameDialogs.isOpen() || view.busy;
      at('#v2-pause').disabled = GameDialogs.isOpen() || view.busy;
      const undoButton = at('#v2-undo');
      undoButton.disabled = !state.undo.available || view.busy;
      undoButton.textContent = state.undo.count ? `Zurück (${state.undo.count})` : 'Zurück';
      at('#v2-selection').textContent = actor ? `Einheit: ${actor.name}` : 'Eigene Einheit wählen';
      at('#v2-message').textContent = view.message;
      const roster = at('#v2-units'); roster.replaceChildren();
      state.units.filter(unit => unit.team === 'player').forEach(unit => {
        const button = document.createElement('button');
        button.textContent = `Eigen · ${unit.name} · ${unit.hp}/${unit.maxHp} HP${unit.disabled ? ' · deaktiviert' : ''}`;
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
        line.textContent = `Feld ${String.fromCharCode(65 + x)}-${String(y + 1).padStart(2, '0')} · ${terrainTypeAt(x, y)}${target ? ` · ${target.name} (${target.team === 'player' ? 'Eigen' : 'Gegner'})` : ''}`;
        intel.appendChild(line);
      }
      state.systems.forEach(({ id, summary }) => {
        const line = document.createElement('p'); line.className = 'v2-system';
        line.textContent = `${id}: Ketten ${summary.treads}; ${Object.entries(summary.weapons).map(([name, count]) => `${name} ${count}`).join(' · ')}`;
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
        ? `Ziel ${String.fromCharCode(65 + view.target.x)}-${String(view.target.y + 1).padStart(2, '0')} · ${terrainTypeAt(view.target.x, view.target.y)}`
        : 'Befehle für Zielhex';
      if (view.target && view.actorId) {
        const runtimeActor = units.find(unit => unit.id === view.actorId);
        const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === view.target.x && unit.y === view.target.y);
        const commands = state.turnPhase === 'fire'
          ? runtimeActor?.ogreSystems
            ? SiegebreakerWeapons.weaponEntries(runtimeActor).map(({ key, weapon }) => ({
              command: { type: 'Fire', actorId: view.actorId, ...view.target, weaponKey: key },
              label: `${weapon.label} · A${weapon.attack} R${weapon.range} · ${GoblinSystems.weaponReady(weapon)} bereit` }))
            : [{ command: { type: 'Fire', actorId: view.actorId, ...view.target }, label: 'Feuern' }]
          : target?.team === 'enemy'
            ? [{ command: { type: 'Ram', actorId: view.actorId, ...view.target }, label: 'Rammen' }]
            : [{ command: { type: 'Move', actorId: view.actorId, ...view.target }, label: 'Bewegen' }];
        commands.forEach(({ command, label }) => {
          const availability = query(command);
          const button = document.createElement('button');
          button.textContent = availability.ok
            ? `${label} bestätigen${availability.path ? ` · ${availability.path.length} Felder` : ''}`
            : `${label} gesperrt · ${availability.reason}`;
          button.disabled = !availability.ok || view.busy;
          button.onclick = () => {
            const result = dispatch(command, view.intentRevision);
            if (result.ok) clearContext();
            view.message = result.ok ? 'Befehl ausgeführt.' : result.reason;
            render();
            if (result.ok) at('.v2-map-card').scrollIntoView({ block: 'start' });
          };
          actions.appendChild(button);
        });
        const cancel = document.createElement('button'); cancel.textContent = 'Abbrechen';
        cancel.onclick = () => { clearContext(); render(); at('#v2-map').focus(); }; footer.appendChild(cancel);
      } else {
        const hint = document.createElement('p'); hint.textContent = view.actorId ? 'Zielfeld auf der Karte wählen.' : 'Einheit und danach Zielfeld wählen.';
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
        frame.setAttribute('aria-label', `${unit.team === 'player' ? 'Eigen' : 'Gegner'}: ${unit.name}${unit.core ? ', Missionsziel' : ''}${unit.hp <= 0 ? ', zerstört' : unit.disabled ? ', deaktiviert' : ''}`);
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
    }
    at('#v2-undo').onclick = () => { const result = undo(); if (!result.ok) { view.message = result.reason; render(); } };
    at('#v2-phase-action').onclick = () => {
      if (phase !== 'player' || gameOver || GameDialogs.isOpen()) return;
      clearContext();
      document.querySelector('#end-turn').click();
      render();
      GameDialogs.whenIdle().then(render);
    };
    at('#v2-pause').onclick = async () => {
      if (GameDialogs.isOpen()) return;
      clearContext(); render();
      const restart = await GameDialogs.confirm({
        id: 'v2-pause', title: 'PAUSE', message: 'Mission angehalten. Fortsetzen oder Neustart wählen.',
        acceptLabel: 'NEUSTART', cancelLabel: 'FORTSETZEN'
      });
      if (restart && await GameDialogs.confirm({
        id: 'v2-restart', title: 'MISSION NEU STARTEN?',
        message: 'Der aktuelle Spielstand und die Befehle dieser Mission gehen verloren.',
        acceptLabel: 'NEU STARTEN', cancelLabel: 'FORTSETZEN'
      })) {
        loadScenario(currentScenario);
        view.actorId = null;
      }
      render();
    };
    const mapPanel = at('#v2-map');
    const pointers = new Map();
    let pinch = null, suppressTapUntil = 0;
    function cellAt(clientX, clientY) {
      const point = nativeMap.createSVGPoint(); point.x = clientX; point.y = clientY;
      const local = point.matrixTransform(nativeMap.getScreenCTM().inverse());
      const cell = nearestHex(local.x, local.y);
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
        if (cell) { view.infoCell = cell; view.message = 'Feldinformation'; render(); }
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
      if (cell && !(view.target && view.actorId)) { view.infoCell = cell; view.message = 'Feldinformation'; render(); }
    });
    nativeMap.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (performance.now() < suppressTapUntil || view.target && view.actorId) return;
      const cell = cellAt(event.clientX, event.clientY);
      if (cell) chooseHex(cell.x, cell.y);
    }, true);
    document.addEventListener('keydown', event => {
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
    new MutationObserver(changes => {
      const own = node => node.nodeType === 1 && /^v2-(team-markers|actor-marker|target-marker|focus-marker)$/.test(node.id);
      if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => !own(node)))) render();
    }).observe(nativeMap, { childList: true });
    render();
  })();
}
