// Opt-in presentation over the current Legacy session. The default entry never runs this code.
if (new URLSearchParams(location.search).get('ui') === 'v2' && !globalThis.goblinBootProfileError) {
  (() => {
    const nativeMap = document.querySelector('#battlefield-map');
    const nativeShell = document.querySelector('.app-shell');
    const view = { actorId: null, target: null, intentRevision: null, busy: false, message: '' };
    const shell = document.createElement('div');
    shell.className = 'v2-shell';
    shell.innerHTML = `
      <header class="v2-head"><div><span class="v2-label">G.O.B.L.I.N. / Mission</span><h1 id="v2-mission"></h1><p id="v2-objective"></p></div><div><span class="v2-label" id="v2-profile"></span><strong id="v2-phase"></strong><p id="v2-turn"></p></div></header>
      <div class="v2-layout"><main class="v2-card v2-map-card"><div class="v2-row"><div><span class="v2-label">Taktische Karte</span><strong id="v2-map-caption"></strong></div></div><div class="v2-map" id="v2-map" tabindex="0" aria-label="Karte: Einheit und danach Zielfeld wählen"></div><div class="v2-context"><span id="v2-selection"></span><p id="v2-message" class="v2-status" role="status"></p></div></main>
      <aside class="v2-side"><section class="v2-card"><span class="v2-label">Eigene Einheiten</span><div class="v2-units" id="v2-units"></div></section><section class="v2-card"><span class="v2-label">Feld und Systeme</span><div id="v2-intel"></div></section><section class="v2-card"><span class="v2-label">Befehle für Zielhex</span><div class="v2-actions" id="v2-actions"></div></section></aside></div>`;
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
        units: units.map(({ id, name, team, x, y, hp, maxHp, disabled, embarkedOn, core }) =>
          ({ id, name, team, x, y, hp, maxHp, disabled: !!disabled, embarkedOn: embarkedOn || null, core: !!core })),
        systems: units.filter(unit => unit.team === 'player' && unit.ogreSystems)
          .map(unit => ({ id: unit.id, summary: GoblinSystems.summary(unit.ogreSystems) }))
      };
    }
    function query(command) {
      if (currentScenario !== 'iron-dust' || legacySession?.ruleProfileId !== 'FIELD_TEST_LEGACY_v2' || globalThis.IronDustBrowserV2?.active)
        return { ok: false, reason: 'Dieser V2-Grundschnitt ist nur für Legacy IRON DUST v2 verfügbar.' };
      if (GameDialogs.isOpen()) return { ok: false, reason: 'Zuerst den offenen Dialog schließen.' };
      if (phase !== 'player' || gameOver) return { ok: false, reason: 'Spielerphase ist nicht aktiv.' };
      if (command?.type !== 'Move') return { ok: false, reason: 'Dieser Befehl folgt mit dem Kartenschnitt.' };
      const actor = units.find(unit => unit.id === command.actorId);
      if (!actor || actor.team !== 'player' || actor.hp <= 0 || actor.disabled || actor.embarkedOn)
        return { ok: false, reason: 'Keine einsatzfähige eigene Einheit.' };
      if (!Number.isInteger(command.x) || !Number.isInteger(command.y) || command.x < 0 || command.x >= W || command.y < 0 || command.y >= H)
        return { ok: false, reason: 'Zielfeld liegt außerhalb der Karte.' };
      if (turnPhase !== 'movement' && turnPhase !== 'gev') return { ok: false, reason: 'Bewegungsphase ist nicht aktiv.' };
      const second = turnPhase === 'gev';
      if (!canMoveUnit(actor, second)) return { ok: false, reason: 'Einheit hat keine Bewegung mehr.' };
      const target = units.find(unit => unit.hp > 0 && !unit.embarkedOn && unit.x === command.x && unit.y === command.y);
      if (target) return { ok: false, reason: target.team === 'enemy' ? 'Rammen folgt mit dem Kartenschnitt.' : 'Zielfeld ist belegt.' };
      const path = findMovementPath(actor, { x: command.x, y: command.y }, second ? 2 : actor.move, actor);
      if (!path?.length) return { ok: false, reason: 'Kein zulässiger Weg zum Zielfeld.' };
      return { ok: true, path: path.map(cell => ({ ...cell })) };
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
        // handleHex is the final, command-history-wrapped Legacy path and checks again.
        handleHex(command.x, command.y);
        const moved = actor.x === command.x && actor.y === command.y;
        return moved ? { ok: true } : { ok: false, reason: 'Runtime hat den Befehl abgelehnt.' };
      } finally { view.busy = false; render(); }
    }
    globalThis.GoblinUIV2 = Object.freeze({ project, query, dispatch });

    function clearContext() { view.target = null; view.intentRevision = null; view.message = ''; }
    function chooseActor(id) {
      const unit = units.find(item => item.id === id && item.team === 'player' && item.hp > 0);
      view.actorId = unit?.id || null; clearContext(); render();
    }
    function chooseHex(x, y) {
      const unit = units.find(item => item.hp > 0 && !item.embarkedOn && item.x === x && item.y === y);
      if (unit?.team === 'player') { chooseActor(unit.id); return; }
      view.target = { x, y }; view.intentRevision = revision(); view.message = ''; render();
    }
    function render() {
      const state = project();
      const actor = state.units.find(unit => unit.id === view.actorId);
      if (!actor || actor.hp <= 0) { view.actorId = null; clearContext(); }
      at('#v2-mission').textContent = state.mission.title;
      at('#v2-objective').textContent = state.mission.objective;
      at('#v2-profile').textContent = state.profile;
      at('#v2-phase').textContent = state.turnPhase.toUpperCase();
      at('#v2-turn').textContent = `Zug ${state.turn} · Zielstatus ${state.objective.remaining}/${state.objective.total}`;
      at('#v2-map-caption').textContent = `${W} × ${H} Hexfelder`;
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
      if (view.target) {
        const { x, y } = view.target;
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
      const actions = at('#v2-actions'); actions.replaceChildren();
      if (view.target && view.actorId) {
        const command = { type: 'Move', actorId: view.actorId, ...view.target };
        const availability = query(command);
        const move = document.createElement('button');
        move.textContent = availability.ok ? `Bewegen bestätigen · ${availability.path.length} Felder` : `Bewegen gesperrt · ${availability.reason}`;
        move.disabled = !availability.ok || view.busy;
        move.onclick = () => {
          const result = dispatch(command, view.intentRevision);
          if (result.ok) clearContext();
          view.message = result.ok ? 'Bewegung ausgeführt.' : result.reason;
          render();
        };
        actions.appendChild(move);
        const fire = document.createElement('button'); fire.disabled = true;
        fire.textContent = 'Feuer und Sonderaktionen folgen im Kartenschnitt'; actions.appendChild(fire);
        const cancel = document.createElement('button'); cancel.textContent = 'Abbrechen';
        cancel.onclick = () => { clearContext(); render(); }; actions.appendChild(cancel);
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
      marker('v2-actor-marker', actor);
      marker('v2-target-marker', view.target);
    }
    nativeMap.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      const point = nativeMap.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const local = point.matrixTransform(nativeMap.getScreenCTM().inverse());
      const cell = nearestHex(local.x, local.y);
      if (!cell || Math.hypot(hexCenter(cell.x, cell.y).x - local.x, hexCenter(cell.x, cell.y).y - local.y) > S) return;
      chooseHex(cell.x, cell.y);
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (view.target) clearContext(); else view.actorId = null;
        render(); event.preventDefault();
      }
      if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'l') event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    globalThis.addEventListener('goblin-language-change', () => render());
    new MutationObserver(() => render()).observe(nativeMap, { childList: true });
    render();
  })();
}
