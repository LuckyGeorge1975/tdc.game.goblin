// V2 navigation over the validated Legacy scenarios and separate Core mission.
if (globalThis.GoblinUIV2 && !globalThis.goblinBootProfileError) {
  (() => {
    const shell = document.querySelector('.v2-shell');
    const surface = document.createElement('section');
    surface.id = 'v2-screen';
    surface.className = 'v2-screen';
    shell.appendChild(surface);
    const t = (key, params) => GoblinLanguage.t(key, params);
    let missionId = 'iron-dust', started = false, startError = '';
    let screen = 'menu', returnScreen = 'menu', pauseActive = false, savedAuto = false, playScrollY = 0;
    const focusMemory = new Map(), scrollMemory = new Map();
    const waiting = [];
    globalThis.GoblinV2PauseGate = Object.freeze({
      whenResumed: () => pauseActive ? new Promise(resolve => waiting.push(resolve)) : Promise.resolve()
    });

    function releasePause() {
      if (!pauseActive) return;
      pauseActive = false;
      globalThis.IronDustBrowserV2?.resume();
      document.querySelector('#auto-end-turn').checked = savedAuto;
      waiting.splice(0).forEach(resolve => resolve());
      if (screen === 'play') {
        GoblinUIV2.refresh();
        maybeAutoAdvancePhase();
      }
    }
    function enterPause() {
      if (GameDialogs.isOpen() || pauseActive) return;
      savedAuto = document.querySelector('#auto-end-turn').checked;
      document.querySelector('#auto-end-turn').checked = false;
      pauseActive = true;
      if (globalThis.IronDustBrowserV2?.mode === 'ready') IronDustBrowserV2.pause();
      show('pause');
    }
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
    function missionPreview(id) {
      const config = scenarioCatalog[id === 'iron-dust-v2' ? 'iron-dust' : id];
      const figure = document.createElement('figure'); figure.className = 'v2-mission-map';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 450 254');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', t('v2.ui.previewMap'));
      const terrain = new Set(config?.terrain || []);
      const typed = new Map((config?.terrainTypes || []).map(cell => [`${cell.x},${cell.y}`, cell.type]));
      for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
        const cx = 23 + x * 36 + (y % 2 ? 18 : 0), cy = 20 + y * 30;
        const polygon = document.createElementNS(svg.namespaceURI, 'polygon');
        polygon.setAttribute('points', Array.from({length: 6}, (_, i) => {
          const angle = Math.PI / 3 * i + Math.PI / 6;
          return `${cx + 20 * Math.cos(angle)},${cy + 20 * Math.sin(angle)}`;
        }).join(' '));
        polygon.setAttribute('class', typed.has(`${x},${y}`) || terrain.has(`${x},${y}`) ? 'v2-preview-terrain' : 'v2-preview-open');
        svg.append(polygon);
      }
      for (const unit of config?.units || []) {
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
          image.setAttribute('href', artwork);
          image.setAttribute('x', cx - 12); image.setAttribute('y', cy - 12);
          image.setAttribute('width', 24); image.setAttribute('height', 24);
          image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          image.setAttribute('pointer-events', 'none');
          svg.append(image);
        }
      }
      figure.append(svg);
      return figure;
    }
    function missionStats(id) {
      const config = scenarioCatalog[id === 'iron-dust-v2' ? 'iron-dust' : id];
      const stats = document.createElement('div'); stats.className = 'v2-mission-stats';
      for (const [key, count] of [['own', config?.units.filter(unit => unit.team === 'player').length], ['enemy', config?.units.filter(unit => unit.team === 'enemy').length]]) {
        const item = document.createElement('div');
        const label = document.createElement('span'); label.textContent = t(`v2.ui.preview.${key}`);
        const value = document.createElement('strong'); value.textContent = String(count);
        item.append(label, value); stats.append(item);
      }
      return stats;
    }
    function show(next, focus = true) {
      const previous = screen;
      const active = document.activeElement;
      if (previous === 'levels') focusMemory.set(previous, `v2-level-${missionId}`);
      else if (surface.contains(active) && active.id) focusMemory.set(previous, active.id);
      const currentPanel = surface.querySelector('.v2-screen-panel');
      if (currentPanel) scrollMemory.set(previous, {
        panel: currentPanel.scrollTop,
        list: currentPanel.querySelector('.v2-level-list')?.scrollTop || 0
      });
      if (previous === 'play' && next !== 'play') playScrollY = globalThis.scrollY;
      screen = next;
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
    function openSection(next) { returnScreen = screen; show(next); }
    function goBack() { show(returnScreen === 'play' && GoblinUIV2.project().gameOver ? 'end' : returnScreen); }
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
    async function confirmRestart() {
      if (GameDialogs.isOpen()) return;
      const accepted = await GameDialogs.confirm({
        id: 'v2-flow-restart', title: t('dialog.restart.title'),
        message: t('dialog.restart.body'), acceptLabel: t('dialog.restart.confirm'), cancelLabel: t('dialog.restart.cancel')
      });
      if (!accepted) { renderScreen(false); return; }
      if (globalThis.IronDustBrowserV2?.mode === 'ready') IronDustBrowserV2.restart();
      else loadScenario(currentScenario);
      GoblinUIV2.resetView();
      show('play');
      releasePause();
    }
    async function goToLevels() {
      if (GameDialogs.isOpen()) return;
      if (screen === 'pause' || screen === 'end' || screen === 'play') {
        const accepted = await GameDialogs.confirm({
          id: 'v2-flow-leave', title: t('dialog.changeMission.title'),
          message: t('ui.dialog.leaveMission.body'),
          acceptLabel: t('dialog.changeMission.confirm'), cancelLabel: t('dialog.changeMission.cancel')
        });
        if (!accepted) { renderScreen(false); return; }
        if (globalThis.IronDustBrowserV2?.mode === 'ready') {
          IronDustBrowserV2.stop();
          loadScenario('iron-dust');
        } else loadScenario(currentScenario);
        GoblinUIV2.resetView();
        started = false;
        releasePause();
      }
      show('levels');
    }
    async function startMission() {
      if (GameDialogs.isOpen()) return;
      if (missionId === 'iron-dust-v2') {
        if (!globalThis.IronDustBrowserV2?.available || !IronDustBrowserV2.start()) {
          startError = t('v2.reject.start'); renderScreen(false); return;
        }
      } else {
        if (!scenarioCatalog[missionId]) return;
        globalThis.IronDustBrowserV2?.stop();
        loadScenario(missionId);
      }
      document.querySelector('#scenario-select').value = missionId;
      started = true;
      startError = '';
      GoblinUIV2.resetView();
      show('play');
      releasePause();
    }
    function openGuide(index = 0) {
      guideIndex = index;
      openUnitGuide();
    }
    function findUnit(id) {
      const unit = GoblinUIV2.project().units.find(item => item.id === id && item.hp > 0);
      if (!unit || !started) return;
      show('play');
      releasePause();
      GoblinUIV2.focusUnit(unit.id);
    }
    globalThis.GoblinV2Flow = Object.freeze({ findUnit, hasStarted: () => started });
    function renderScreen(focus = true) {
      if (screen === 'play') return;
      const lastFocus = focus ? null : document.activeElement?.id;
      const lastIndex = focus ? -1 : [...surface.querySelectorAll('button, select, input')].indexOf(document.activeElement);
      const currentPanel = surface.querySelector('.v2-screen-panel');
      if (!focus && currentPanel?.dataset.screen === screen) scrollMemory.set(screen, {
        panel: currentPanel.scrollTop,
        list: currentPanel.querySelector('.v2-level-list')?.scrollTop || 0
      });
      const panel = document.createElement('div'); panel.className = 'v2-screen-panel';
      panel.dataset.screen = screen;
      if (['menu', 'levels', 'options'].includes(screen)) panel.classList.add('v2-foundation');
      surface.replaceChildren(panel);
      surface.setAttribute('aria-labelledby', 'v2-screen-heading');
      const state = GoblinUIV2.project();
      if (screen === 'menu') {
        const intro = document.createElement('div'); intro.className = 'v2-menu-intro';
        intro.classList.add('v2-screen-header');
        intro.append(paragraph(t('ui.start.eyebrow'), 'v2-menu-eyebrow'), heading(t('ui.start.title')),
          paragraph(t('ui.start.subtitle')));
        const menu = document.createElement('nav'); menu.className = 'v2-menu-links v2-screen-main';
        menu.setAttribute('aria-label', t('ui.start.title'));
        const choose = button(t('ui.start.choose'), () => show('levels'), 'primary'); choose.id = 'v2-menu-choose';
        const units = button(t('ui.details.units'), () => openSection('catalog')); units.id = 'v2-menu-units';
        const settings = button(t('ui.nav.settings'), () => openSection('options')); settings.id = 'v2-menu-settings';
        const legal = button(t('v2.ui.legalNotices'), () => openSection('legal')); legal.id = 'v2-menu-legal';
        menu.append(choose, units, settings, legal);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        footer.append(paragraph(document.querySelector('#build-version').textContent, 'v2-screen-meta'));
        panel.append(intro, menu, footer);
      } else if (screen === 'levels') {
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        header.append(heading(t('ui.levels.title')));
        panel.append(header);
        const layout = document.createElement('div'); layout.className = 'v2-level-layout v2-screen-main';
        const list = document.createElement('div'); list.className = 'v2-level-list';
        const ids = [...Object.keys(ScenarioRuleProfiles.entries), 'iron-dust-v2'];
        if (!ids.includes(missionId)) missionId = ids[0];
        for (const id of ids) {
          const available = id === 'iron-dust-v2' ? !!globalThis.IronDustBrowserV2?.available : !!scenarioCatalog[id];
          const choose = button('', () => {
            missionId = id; startError = ''; renderScreen(false);
          }, 'v2-level-choice');
          const title = document.createElement('strong'); title.textContent = t(`mission.${id}.title`);
          const summary = document.createElement('span');
          summary.textContent = t(id === 'iron-dust-v2' ? 'v2.objective' : `mission.${id}.objective.short`);
          choose.append(title, summary);
          choose.id = `v2-level-${id}`;
          choose.setAttribute('aria-pressed', String(id === missionId));
          if (!available) choose.title = t('v2.ui.missionDataUnavailable');
          choose.disabled = !available;
          list.append(choose);
        }
        const detail = document.createElement('section'); detail.className = 'v2-level-detail';
        detail.setAttribute('aria-label', t(`mission.${missionId}.title`));
        const detailTitle = document.createElement('h3'); detailTitle.textContent = t(`mission.${missionId}.title`);
        detail.append(detailTitle, missionPreview(missionId),
          paragraph(t(missionId === 'iron-dust-v2' ? 'v2.objective' : `mission.${missionId}.objective.short`)),
          missionStats(missionId));
        layout.append(list, detail);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), () => show('menu')); back.id = 'v2-levels-back';
        const select = button(t('ui.levels.select'), () => show('briefing'), 'primary');
        select.id = 'v2-levels-select';
        select.setAttribute('aria-label', `${t('ui.levels.select')}: ${t(`mission.${missionId}.title`)}`);
        footer.append(actions(back, select));
        panel.append(layout, footer);
      } else if (screen === 'briefing') {
        const core = missionId === 'iron-dust-v2';
        panel.append(heading(t(`mission.${missionId}.title`)),
          paragraph(t(core ? 'v2.quick.intro' : `mission.${missionId}.briefing.full`)),
          paragraph(t(core ? 'v2.objective' : `mission.${missionId}.objective.full`), 'v2-screen-objective'),
          ...(startError ? [paragraph(startError, 'v2-status')] : []),
          actions(button(t('ui.nav.back'), returnToSelectedLevel),
            button(t('ui.briefing.start'), startMission, 'primary')));
      } else if (screen === 'pause') {
        panel.append(heading(t('ui.nav.pause')),
          paragraph(state.mission.objective),
          actions(button(t('ui.nav.resume'), () => { show('play'); releasePause(); }, 'primary'),
            button(t('ui.nav.restart'), confirmRestart)),
          actions(button(t('ui.nav.missions'), goToLevels),
            button(t('ui.details.units'), () => openSection('catalog')),
            button(t('ui.nav.settings'), () => openSection('options'))));
      } else if (screen === 'end') {
        const won = state.objective.outcome === true;
        panel.append(heading(t(won ? 'screen.missionEnd.victory.title' : 'screen.missionEnd.defeat.title')),
          paragraph(t(won && state.scenario === 'iron-dust-v2' ? 'v2.win' : won ? `mission.${state.scenario}.end.victory` : 'screen.missionEnd.defeat.allUnits')),
          paragraph(t('ui.hud.turn', { turn: state.turn })),
          actions(button(t('screen.missionEnd.action.retry'), confirmRestart, 'primary'),
            button(t('screen.missionEnd.action.chooseMission'), goToLevels),
            button(t('screen.missionEnd.action.log'), () => show('log'))));
      } else if (screen === 'log') {
        panel.append(heading(t('screen.missionEnd.action.log')));
        const entries = document.createElement('div'); entries.className = 'v2-screen-log';
        (state.scenario === 'iron-dust-v2' ? state.log : [...document.querySelectorAll('#combat-log .log-line')].map(line => line.textContent.trim()))
          .forEach(line => entries.append(paragraph(line)));
        panel.append(entries, actions(button(t('ui.nav.back'), () => show('end'))));
      } else if (screen === 'catalog') {
        panel.append(heading(GoblinLanguage.translate('UNIT GUIDE')), paragraph(t('v2.ui.catalogNote')));
        const list = document.createElement('div'); list.className = 'v2-catalog-list';
        unitGuideEntries.forEach((entry, index) => {
          const item = button(GoblinLanguage.translate(entry.name), () => openGuide(index));
          const asset = UnitVisuals.resolve(entry).asset;
          if (asset) {
            const img = document.createElement('img'); img.src = asset; img.alt = '';
            item.prepend(img);
          }
          const live = started ? state.units.find(unit =>
            (state.scenario === 'iron-dust-v2' ? unit.id === entry.coreUnitId : unit.name === entry.name) && unit.hp > 0) : null;
          if (live) {
            const row = document.createElement('div'); row.className = 'v2-catalog-entry';
            row.append(item, button(t('v2.ui.find'), () => findUnit(live.id)));
            list.append(row);
          } else list.append(item);
        });
        panel.append(list, actions(button(t('ui.nav.back'), goBack)));
      } else if (screen === 'legal') {
        panel.append(heading(t('v2.ui.legalNotices')),
          paragraph(t('v2.ui.legalEnglish'), 'v2-screen-meta'));
        const notice = document.createElement('pre'); notice.className = 'v2-legal-text';
        notice.lang = 'en'; notice.textContent = t('v2.ui.legalLoading');
        panel.append(notice, actions(button(t('ui.nav.back'), goBack)));
        fetch(new URL('docs/CONTENT-NOTICES.md', document.baseURI))
          .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); })
          .then(copy => { if (notice.isConnected) notice.textContent = copy; })
          .catch(() => { if (notice.isConnected) notice.textContent = t('v2.ui.legalUnavailable'); });
      } else if (screen === 'options') {
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        header.append(heading(t('ui.nav.settings')));
        const content = document.createElement('div'); content.className = 'v2-screen-main';
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
        const grid = document.createElement('label'); grid.className = 'v2-setting-check';
        const gridInput = document.createElement('input'); gridInput.type = 'checkbox'; gridInput.id = 'v2-grid';
        gridInput.checked = GoblinUIV2.gridVisible;
        gridInput.onchange = () => GoblinUIV2.setGridVisible(gridInput.checked);
        grid.append(gridInput, document.createTextNode(t('ui.settings.grid')));
        content.append(language, grid, paragraph(t('ui.settings.note')));
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), goBack); back.id = 'v2-options-back';
        footer.append(actions(back));
        panel.append(header, content, footer);
      }
      const savedScroll = scrollMemory.get(screen);
      if (savedScroll) {
        panel.scrollTop = savedScroll.panel;
        const list = panel.querySelector('.v2-level-list');
        if (list) list.scrollTop = savedScroll.list;
      }
      const controls = [...panel.querySelectorAll('button:not(:disabled), select, input')];
      const targetId = focus ? focusMemory.get(screen) : lastFocus;
      const target = targetId && document.getElementById(targetId);
      const fallback = focus ? controls[0] : controls[lastIndex];
      (target && panel.contains(target) ? target : fallback || panel.querySelector('#v2-screen-heading'))
        ?.focus({ preventScroll: true });
    }
    document.querySelector('#v2-pause').onclick = enterPause;
    new MutationObserver(() => { if (screen === 'levels') renderScreen(false); })
      .observe(document.querySelector('#scenario-select'), { childList: true });
    globalThis.addEventListener('goblin-v2-render', () => {
      if (screen === 'play' && GoblinUIV2.project().gameOver) show('end');
    });
    globalThis.addEventListener('goblin-language-change', () => renderScreen(false));
    GoblinLanguage.ready.then(() => renderScreen(false));
    globalThis.addEventListener('keydown', event => {
      if (screen !== 'play' && event.key === 'Escape' && !GameDialogs.isOpen() && document.querySelector('#unit-guide-modal').classList.contains('hidden')) {
        if (screen === 'options' || screen === 'catalog' || screen === 'legal') goBack();
        else if (screen === 'briefing') returnToSelectedLevel();
        else if (screen === 'levels') show('menu');
        else if (screen === 'pause') { show('play'); releasePause(); }
        else if (screen === 'log') show('end');
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    show('menu');
  })();
}
