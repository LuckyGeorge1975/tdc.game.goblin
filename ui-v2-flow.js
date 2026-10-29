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
    let libraryIndex = 0, libraryTab = 'values', libraryArtSide = 'own';
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
      globalThis.GoblinMovement?.clear();
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
    function missionData(id) {
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
        ], units: config.units};
    }
    function missionPreview(data) {
      if (!data) return paragraph(t('screen.briefing.dataUnavailable'), 'v2-status');
      const figure = document.createElement('figure'); figure.className = 'v2-mission-map';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 460 254');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', t('v2.ui.previewMap'));
      const terrain = new Map(data.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
      const shown = new Set();
      for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
        const cx = 23 + x * 36 + (y % 2 ? 18 : 0), cy = 20 + y * 30;
        const type = terrain.get(`${x},${y}`) || data.defaultTerrain;
        shown.add(type);
        const polygon = document.createElementNS(svg.namespaceURI, 'polygon');
        polygon.setAttribute('points', Array.from({length: 6}, (_, i) => {
          const angle = Math.PI / 3 * i + Math.PI / 6;
          return `${cx + 20 * Math.cos(angle)},${cy + 20 * Math.sin(angle)}`;
        }).join(' '));
        polygon.setAttribute('class', type !== data.defaultTerrain ? 'v2-preview-terrain' : 'v2-preview-open');
        polygon.setAttribute('data-terrain-id', type);
        const title = document.createElementNS(svg.namespaceURI, 'title');
        title.textContent = TerrainDisplay.label(type);
        polygon.append(title);
        svg.append(polygon);
        const icon = TerrainDisplay.svgIcon(type, cx - 18, cy - 21);
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
      const caption = document.createElement('figcaption');
      caption.className = 'v2-preview-legend';
      TerrainDisplay.fillLegend(caption, shown, missionId === 'iron-dust-v2', true);
      figure.append(svg, caption);
      return figure;
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
    function show(next, focus = true) {
      const previous = screen;
      const active = document.activeElement;
      if (previous === 'levels') focusMemory.set(previous, `v2-level-${missionId}`);
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
        globalThis.GoblinMovement?.clear();
      }
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
      GoblinUIV2.startView();
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
      if (!missionData(missionId)) {
        startError = t('screen.briefing.dataUnavailable'); renderScreen(false); return;
      }
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
      GoblinUIV2.startView();
    }
    function libraryAssetId(entry) { return UnitVisuals.artKey(entry); }
    function libraryName(entry) {
      return t(`library.unit.${libraryAssetId(entry)}.name`);
    }
    function libraryValue(value) {
      if (value === 'BY SYSTEM') return t('screen.library.value.bySystem');
      if (value === '1 / squad') return `1 / ${t('screen.library.value.perSquad')}`;
      return value;
    }
    function openLibraryEntry(index) {
      libraryIndex = index;
      libraryTab = 'values';
      if (matchMedia('(max-width: 900px)').matches) show('catalog-detail');
      else renderScreen(false);
    }
    function returnToLibrary() {
      show('catalog', false);
      const row = document.getElementById(`v2-library-${libraryAssetId(unitGuideEntries[libraryIndex])}`);
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
      const match = state.units.find(unit => state.scenario === 'iron-dust-v2'
        ? unit.id === entry.coreUnitId : ['skimmer-pilot','siege-pilot'].includes(state.scenario) ? unit.visualKey === libraryAssetId(entry) : unit.name === entry.name);
      if (!match) return {reason:'screen.library.mapUnavailable.notPresent'};
      if (match.hp <= 0) return {unit:match,reason:'screen.library.mapUnavailable.destroyed'};
      return {unit:match};
    }
    function libraryDetail(entry, index, state, mobile) {
      const target = libraryTarget(entry, state);
      const live = target.unit;
      const detail = document.createElement('section'); detail.className = 'v2-library-detail';
      const title = mobile ? heading(libraryName(entry)) : document.createElement('h3');
      if (!mobile) title.textContent = libraryName(entry);
      const header = document.createElement('div'); header.className = 'v2-library-detail-head';
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
        const image = document.createElement('img'); image.src = art; image.alt = '';
        const caption = document.createElement('figcaption');
        caption.textContent = `${libraryName(entry)} · ${t(`v2.ui.preview.${libraryArtSide}`)}`;
        picture.append(image); figure.append(picture, caption); header.append(figure);
      }
      const identity = document.createElement('div'); identity.className = 'v2-library-identity';
      identity.append(title, paragraph(t('screen.library.category'), 'v2-library-category'),
        paragraph(GoblinLanguage.translate(entry.role)),
        paragraph(GoblinLanguage.translate(entry.team), 'v2-library-team'));
      header.append(identity);
      const values = document.createElement('dl'); values.className = 'v2-library-values';
      const siegeSpec=live?.siegeFireBudget?GoblinSiegeWeapons.weapons(live)?.[live.siegeWeapon]:null;
      const system = !!live && (!!live.weapons || !!state.systems.find(item => item.id === live.id));
      for (const [key, value] of [['attack',system ? t('v2.ui.byWeapon') : siegeSpec?.attack ?? live?.attack ?? entry.attack],
        ['defense',system ? t('screen.library.value.bySystem') : live?.defense ?? entry.defense],
        ['move',live ? `${live.move}${live.secondaryMove?` + ${live.secondaryMove}`:''}` : entry.move],
        ['range',system ? t('v2.ui.byWeapon') : siegeSpec?.range ?? live?.range ?? entry.range]]) {
        const field = document.createElement('div');
        const label = document.createElement('dt'); label.textContent = t(`v2.ui.${key}`);
        const number = document.createElement('dd'); number.textContent = libraryValue(value);
        field.append(label, number); values.append(field);
      }
      const tabs = document.createElement('div'); tabs.className = 'v2-library-tabs';
      for (const [tab, key] of [['values','screen.library.tab.valuesNote'],
        ['range','screen.library.tab.range']]) {
        const item = button(t(key), () => { libraryTab = tab; renderScreen(false); });
        item.id = `v2-library-tab-${tab}`;
        item.setAttribute('aria-pressed', String(libraryTab === tab));
        tabs.append(item);
      }
      const body = document.createElement('div'); body.className = 'v2-library-detail-body';
      if (libraryTab === 'values') {
        const hpValue = system ? t('screen.library.value.bySystem') : live
          ? `${Math.max(0, live.hp)}/${live.maxHp}` : entry.hp === 'SYSTEMS'
            ? t('screen.library.value.bySystem') : entry.hp;
        body.append(paragraph(`${t('v2.ui.armorHp')}: ${hpValue}`, 'v2-library-hp'));
        if(live?.siegeFireBudget)body.append(paragraph(GoblinSiegeWeapons.summary(live)));
        body.append(paragraph(GoblinLanguage.translate(entry.copy)));
        if (entry.move.includes('+')) body.append(paragraph(t('screen.library.value.skimmerManeuver')));
      } else {
        const pilotLive=live&&['skimmer-pilot','siege-pilot'].includes(state.scenario);
        const profile = pilotLive ? {...UnitGuideRange.profile(entry,live),bonus:live.secondaryMove??0} : UnitGuideRange.profile(entry, null);
        for (const [mode, key] of [['move','v2.ui.move'], ['attack','v2.ui.attack']]) {
          const figure = document.createElement('figure'); figure.className = 'v2-library-range';
          const caption = document.createElement('figcaption'); caption.textContent = t(key);
          figure.innerHTML = UnitGuideRange.mapSvg(profile, mode);
          figure.prepend(caption); body.append(figure);
        }
        body.append(paragraph(pilotLive ? t(`mission.${state.scenario}.budget`) : t('v2.ui.catalogNote')));
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
      detail.append(header, values, artSwitch, tabs, body, mapRow);
      return detail;
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
        options: currentPanel.querySelector('.v2-options-main')?.scrollTop || 0,
        list: currentPanel.querySelector('.v2-level-list, .v2-library-list')?.scrollTop || 0,
        libraryLayout: currentPanel.querySelector('.v2-library-layout')?.scrollTop || 0
      });
      const panel = document.createElement('div'); panel.className = 'v2-screen-panel';
      panel.dataset.screen = screen;
      if (['menu', 'levels', 'options', 'briefing', 'catalog', 'catalog-detail'].includes(screen))
        panel.classList.add('v2-foundation');
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
          const available = !!missionData(id);
          const choose = button('', () => {
            missionId = id; startError = ''; renderScreen(false);
          }, 'v2-level-choice');
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
        layout.append(list, detail);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), () => show('menu')); back.id = 'v2-levels-back';
        const select = button(t('ui.levels.select'), () => show('briefing'), 'primary');
        select.id = 'v2-levels-select';
        select.disabled = !data;
        select.setAttribute('aria-label', `${t('ui.levels.select')}: ${t(`mission.${missionId}.title`)}`);
        footer.append(actions(back, select));
        panel.append(layout, footer);
      } else if (screen === 'briefing') {
        const data = missionData(missionId);
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        const legacyNumber = missionId !== 'iron-dust-v2' &&
          scenarioCatalog[missionId]?.kicker?.match(/^(MISSION \d+|SHOWCASE \d+)/)?.[1];
        if (legacyNumber) header.append(paragraph(legacyNumber, 'v2-briefing-number'));
        header.append(heading(t(`mission.${missionId}.title`)),
          paragraph(t(`mission.${missionId}.briefing.short`), 'v2-briefing-intro'));
        if(missionId==='siege-pilot')header.append(paragraph(t('mission.siege-pilot.budget')));
        if(missionId==='skimmer-pilot')header.append(paragraph(t('mission.skimmer-pilot.budget')));
        const conditions = document.createElement('section'); conditions.className = 'v2-briefing-conditions';
        conditions.append(document.createElement('div'), document.createElement('div'));
        conditions.children[0].className = 'v2-briefing-victory';
        conditions.children[1].className = 'v2-briefing-defeat';
        for (const [index, outcome] of ['victory', 'defeat'].entries()) {
          const label = document.createElement('h3'); label.textContent = t(`screen.briefing.${outcome}`);
          conditions.children[index].append(label,
            paragraph(t(`mission.${missionId}.briefing.${outcome}`)));
        }
        const preview = document.createElement('section'); preview.className = 'v2-briefing-preview';
        const previewLabel = document.createElement('h3');
        previewLabel.textContent = t('screen.briefing.startForces');
        preview.append(previewLabel, missionPreview(data), missionStats(data));
        const main = document.createElement('div'); main.className = 'v2-screen-main v2-briefing-main';
        main.append(conditions, preview);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('screen.briefing.backToLevels'), returnToSelectedLevel); back.id = 'v2-briefing-back';
        const start = button(t('screen.briefing.startMission'), startMission, 'primary'); start.id = 'v2-briefing-start';
        start.disabled = !data;
        footer.append(...(startError ? [paragraph(startError, 'v2-status')] : []), actions(back, start));
        panel.append(header, main, footer);
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
        const header = document.createElement('header'); header.className = 'v2-screen-header';
        header.append(heading(GoblinLanguage.translate('UNIT GUIDE')),
          paragraph(t('v2.ui.catalogNote')));
        const layout = document.createElement('div'); layout.className = 'v2-library-layout v2-screen-main';
        const list = document.createElement('div'); list.className = 'v2-library-list';
        unitGuideEntries.forEach((entry, index) => {
          const item = button(libraryName(entry), () => openLibraryEntry(index), 'v2-library-choice');
          item.id = `v2-library-${libraryAssetId(entry)}`;
          item.setAttribute('aria-current', index === libraryIndex ? 'true' : 'false');
          if (UnitVisuals.resolve(entry).asset ||
              (UnitVisuals.artKey(entry) && ['player', 'enemy'].includes(entry.team)))
            item.prepend(UnitVisuals.iconElement(entry, 'v2-library-map-icon'));
          list.append(item);
        });
        layout.append(list);
        if (!matchMedia('(max-width: 900px)').matches)
          layout.append(libraryDetail(unitGuideEntries[libraryIndex], libraryIndex, state, false));
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), goBack); back.id = 'v2-library-exit';
        footer.append(actions(back));
        panel.append(header, layout, footer);
      } else if (screen === 'catalog-detail') {
        const detail = libraryDetail(unitGuideEntries[libraryIndex], libraryIndex, state, true);
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer v2-library-footer';
        const back = button(t('screen.library.back'), returnToLibrary); back.id = 'v2-library-back';
        const count = paragraph(t('screen.library.count', {current:libraryIndex + 1,
          total:unitGuideEntries.length}), 'v2-library-count');
        const next = button(t('screen.library.next'), () => {
          libraryIndex = (libraryIndex + 1) % unitGuideEntries.length;
          libraryTab = 'values';
          renderScreen(false);
        });
        next.id = 'v2-library-next';
        const mapAction = detail.querySelector('.v2-library-map-action');
        footer.append(actions(back, count, next), mapAction);
        panel.append(detail, footer);
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
        content.append(language, animation, grid, ...displayOptions, paragraph(t('ui.settings.note')));
        const footer = document.createElement('footer'); footer.className = 'v2-screen-footer';
        const back = button(t('ui.nav.back'), goBack); back.id = 'v2-options-back';
        footer.append(actions(back));
        panel.append(header, content, footer);
      }
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
    globalThis.addEventListener('goblin-view-settings-change',()=>{
      for(const key of ['grid','targets','damage']){
        const input=surface.querySelector(`#v2-${key}`);
        if(input)input.checked=GoblinUIV2[`${key}Visible`];
      }
    });
    new MutationObserver(() => { if (screen === 'levels') renderScreen(false); })
      .observe(document.querySelector('#scenario-select'), { childList: true });
    globalThis.addEventListener('goblin-v2-render', () => {
      if (screen === 'play' && !globalThis.GoblinMovement?.busy() && GoblinUIV2.project().gameOver) show('end');
    });
    globalThis.addEventListener('goblin-movement-finished', () => {
      if (screen === 'play' && GoblinUIV2.project().gameOver) show('end');
    });
    globalThis.addEventListener('goblin-language-change', () => renderScreen(false));
    globalThis.addEventListener('goblin-core-v2-ready', () => {
      if (screen === 'levels' || screen === 'briefing') renderScreen(false);
    });
    GoblinLanguage.ready.then(() => renderScreen(false));
    globalThis.addEventListener('keydown', event => {
      if (screen !== 'play' && event.key === 'Escape' && !GameDialogs.isOpen() && document.querySelector('#unit-guide-modal').classList.contains('hidden')) {
        if (screen === 'options' || screen === 'catalog' || screen === 'legal') goBack();
        else if (screen === 'briefing') returnToSelectedLevel();
        else if (screen === 'catalog-detail') returnToLibrary();
        else if (screen === 'levels') show('menu');
        else if (screen === 'pause') { show('play'); releasePause(); }
        else if (screen === 'log') show('end');
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    show('menu');
  })();
}
