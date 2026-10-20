// V2 navigation over the validated Legacy scenario sessions.
if (globalThis.GoblinUIV2 && !globalThis.goblinBootProfileError) {
  (() => {
    const shell = document.querySelector('.v2-shell');
    const surface = document.createElement('section');
    surface.id = 'v2-screen';
    surface.className = 'v2-screen';
    shell.appendChild(surface);
    const t = (key, params) => GoblinLanguage.t(key, params);
    let missionId = 'iron-dust', started = false;
    let screen = 'menu', returnScreen = 'menu', pauseActive = false, savedAuto = false, playScrollY = 0;
    const waiting = [];
    globalThis.GoblinV2PauseGate = Object.freeze({
      whenResumed: () => pauseActive ? new Promise(resolve => waiting.push(resolve)) : Promise.resolve()
    });

    function releasePause() {
      if (!pauseActive) return;
      pauseActive = false;
      document.querySelector('#auto-end-turn').checked = savedAuto;
      waiting.splice(0).forEach(resolve => resolve());
      if (screen === 'play') maybeAutoAdvancePhase();
    }
    function enterPause() {
      if (GameDialogs.isOpen() || pauseActive) return;
      savedAuto = document.querySelector('#auto-end-turn').checked;
      document.querySelector('#auto-end-turn').checked = false;
      pauseActive = true;
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
      const node = document.createElement('h2'); node.textContent = copy; return node;
    }
    function actions(...nodes) {
      const row = document.createElement('div'); row.className = 'v2-screen-actions';
      row.append(...nodes); return row;
    }
    function show(next, focus = true) {
      const previous = screen;
      if (previous === 'play' && next !== 'play') playScrollY = globalThis.scrollY;
      screen = next;
      const overlay = next !== 'play';
      document.body.classList.toggle('v2-screen-open', overlay);
      surface.hidden = !overlay;
      renderScreen(focus);
      if (overlay) globalThis.scrollTo(0, 0);
      else {
        const map = document.querySelector('#v2-map');
        map.focus({ preventScroll: true });
        requestAnimationFrame(() => {
          if (screen !== 'play') return;
          if (previous === 'briefing') map.scrollIntoView({ block: 'start' });
          else globalThis.scrollTo(0, playScrollY);
        });
      }
    }
    function openSection(next) { returnScreen = screen; show(next); }
    function goBack() { show(returnScreen === 'play' && GoblinUIV2.project().gameOver ? 'end' : returnScreen); }
    async function confirmRestart() {
      if (GameDialogs.isOpen()) return;
      const accepted = await GameDialogs.confirm({
        id: 'v2-flow-restart', title: t('dialog.restart.title'),
        message: t('dialog.restart.body'), acceptLabel: t('dialog.restart.confirm'), cancelLabel: t('dialog.restart.cancel')
      });
      if (!accepted) { renderScreen(false); return; }
      loadScenario(currentScenario);
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
        loadScenario(currentScenario);
        GoblinUIV2.resetView();
        started = false;
        releasePause();
      }
      show('levels');
    }
    async function startMission() {
      if (GameDialogs.isOpen()) return;
      if (!scenarioCatalog[missionId]) return;
      loadScenario(missionId);
      document.querySelector('#scenario-select').value = missionId;
      started = true;
      GoblinUIV2.resetView();
      show('play');
      releasePause();
    }
    function openGuide(index = 0) {
      guideIndex = index;
      openUnitGuide();
    }
    function findUnit(id) {
      const unit = units.find(item => item.id === id && item.hp > 0);
      if (!unit || !started) return;
      releasePause();
      show('play');
      GoblinUIV2.focusUnit(unit.id);
    }
    globalThis.GoblinV2Flow = Object.freeze({ findUnit, hasStarted: () => started });
    function renderScreen(focus = true) {
      if (screen === 'play') return;
      const lastFocus = focus ? null : document.activeElement?.id;
      const lastIndex = focus ? -1 : [...surface.querySelectorAll('button, select, input')].indexOf(document.activeElement);
      const panel = document.createElement('div'); panel.className = 'v2-screen-panel';
      surface.replaceChildren(panel);
      const state = GoblinUIV2.project();
      if (screen === 'menu') {
        panel.append(heading(t('ui.start.title')), paragraph(t(`mission.${currentScenario}.briefing.short`)),
          actions(button(t('ui.start.choose'), () => show('levels'), 'primary')),
          actions(button(t('ui.details.units'), () => openSection('catalog')),
            button(t('ui.nav.settings'), () => openSection('options'))));
        panel.append(paragraph(document.querySelector('#build-version').textContent, 'v2-screen-meta'));
      } else if (screen === 'levels') {
        panel.append(heading(t('ui.levels.title')));
        const list = document.createElement('div'); list.className = 'v2-level-list';
        for (const id of Object.keys(ScenarioRuleProfiles.entries)) {
          const card = document.createElement('div'); card.className = 'v2-level';
          card.append(heading(t(`mission.${id}.title`)), paragraph(t(`mission.${id}.objective.short`)));
          const choose = button(scenarioCatalog[id] ? t('ui.levels.select') : t('v2.ui.missionDataUnavailable'), () => { missionId = id; show('briefing'); });
          choose.disabled = !scenarioCatalog[id];
          card.append(choose); list.append(card);
        }
        panel.append(list, actions(button(t('ui.nav.back'), () => show('menu'))));
      } else if (screen === 'briefing') {
        panel.append(heading(t(`mission.${missionId}.title`)),
          paragraph(t(`mission.${missionId}.briefing.full`)),
          paragraph(t(`mission.${missionId}.objective.full`), 'v2-screen-objective'),
          actions(button(t('ui.nav.back'), () => show('levels')),
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
          paragraph(t(won ? `mission.${state.scenario}.end.victory` : 'screen.missionEnd.defeat.allUnits')),
          paragraph(t('ui.hud.turn', { turn: state.turn })),
          actions(button(t('screen.missionEnd.action.retry'), confirmRestart, 'primary'),
            button(t('screen.missionEnd.action.chooseMission'), goToLevels),
            button(t('screen.missionEnd.action.log'), () => show('log'))));
      } else if (screen === 'log') {
        panel.append(heading(t('screen.missionEnd.action.log')));
        const entries = document.createElement('div'); entries.className = 'v2-screen-log';
        [...document.querySelectorAll('#combat-log .log-line')].forEach(line => entries.append(paragraph(line.textContent.trim())));
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
          const live = started ? units.find(unit => unit.name === entry.name && unit.hp > 0) : null;
          if (live) {
            const row = document.createElement('div'); row.className = 'v2-catalog-entry';
            row.append(item, button(t('v2.ui.find'), () => findUnit(live.id)));
            list.append(row);
          } else list.append(item);
        });
        panel.append(list, actions(button(t('ui.nav.back'), goBack)));
      } else if (screen === 'options') {
        panel.append(heading(t('ui.nav.settings')));
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
        const style = document.createElement('label'); style.textContent = t('ui.settings.style');
        const styleSelect = document.createElement('select'); styleSelect.id = 'v2-style';
        for (const entry of UnitVisuals.styles) {
          const option = document.createElement('option'); option.value = entry.id;
          option.textContent = t(`v2.ui.iconStyle.${entry.id}`); styleSelect.append(option);
        }
        styleSelect.value = UnitVisuals.currentStyle();
        styleSelect.onchange = () => {
          const legacy = document.querySelector('#art-style-select');
          legacy.value = styleSelect.value;
          legacy.dispatchEvent(new Event('change', { bubbles: true }));
          styleSelect.value = UnitVisuals.currentStyle();
        };
        style.append(styleSelect);
        const grid = document.createElement('label'); grid.className = 'v2-setting-check';
        const gridInput = document.createElement('input'); gridInput.type = 'checkbox'; gridInput.id = 'v2-grid';
        gridInput.checked = document.querySelector('#grid-toggle').getAttribute('aria-pressed') === 'true';
        gridInput.onchange = () => document.querySelector('#grid-toggle').click();
        grid.append(gridInput, document.createTextNode(t('ui.settings.grid')));
        panel.append(language, style, grid, paragraph(t('ui.settings.note')),
          actions(button(t('ui.nav.back'), goBack)));
      }
      if (focus) panel.querySelector('button:not(:disabled),select')?.focus({ preventScroll: true });
      else {
        const controls = [...panel.querySelectorAll('button, select, input')];
        (lastFocus && panel.querySelector(`#${lastFocus}`) || controls[lastIndex])?.focus({ preventScroll: true });
      }
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
        if (screen === 'options' || screen === 'catalog') goBack();
        else if (screen === 'briefing') show('levels');
        else if (screen === 'levels') show('menu');
        else if (screen === 'pause') { show('play'); releasePause(); }
        else if (screen === 'log') show('end');
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    show('menu');
  })();
}
