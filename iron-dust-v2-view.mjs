const SVG_NS = 'http://www.w3.org/2000/svg';
const HEX_SIZE = 34;
const HEX_DX = Math.sqrt(3) * HEX_SIZE;
const HEX_DY = 1.5 * HEX_SIZE;
let selectedUnitId = null;
let selectedCell = null;

const cellLabel = (x, y) => `${String.fromCharCode(65 + x)}-${String(y + 1).padStart(2, '0')}`;
const center = (x, y) => ({x:58 + x * HEX_DX + (y % 2 ? HEX_DX / 2 : 0), y:48 + y * HEX_DY});
const points = (x, y) => {
  const c = center(x, y);
  return Array.from({length:6}, (_, i) => {
    const angle = Math.PI / 3 * i + Math.PI / 6;
    return `${c.x + HEX_SIZE * Math.cos(angle)},${c.y + HEX_SIZE * Math.sin(angle)}`;
  }).join(' ');
};
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgElement = tag => document.createElementNS(SVG_NS, tag);
const setText = (selector, value) => { document.querySelector(selector).textContent = value; };
const unitArt = unit => {
  const asset = unit?.hp > 0 ? globalThis.UnitVisuals?.resolve?.(unit)?.asset : null;
  if (!asset) return null;
  const image = element('img', 'unit-art-image');
  image.src = asset;
  image.alt = '';
  return image;
};
const t = key => globalThis.GoblinLanguage?.t(key) ?? key;
const label = (key, fallback) => { const value = t(key); return value === key ? fallback : value; };
const visibleEvents = new Set(['UnitMoved', 'EnemyMoved', 'EnemyHeld',
  'EnemySkipped', 'UnitRecovered', 'PhaseChanged', 'EnemyPassRecorded',
  'PlayerFireResolved', 'EnemySystemFireResolved', 'EnemyUnitFireResolved',
  'RamResolved', 'WeaponSelected', 'IronDustGameEnded']);
const unitLabel = id => {
  const key = `v2.unit.${id}`;
  const label = t(key);
  return label === key ? t('v2.unit.unknown') : label;
};
export function formatIronDustV2Event(event) {
  const key = visibleEvents.has(event?.type) ? `v2.event.${event.type}` :
    'v2.event.unknown';
  return globalThis.GoblinLanguage?.t(key, {actor:unitLabel(event?.actorId),
    target:unitLabel(event?.targetId)}) ?? key;
}
export function formatIronDustV2Error(code) {
  const category = code === 'GAME_ENDED' ? 'ended' :
    code === 'ENEMY_TURN_RUNNING' || code === 'ENEMY_TURN_AUTOMATED' ? 'enemy' :
    code === 'WRONG_PHASE' || code === 'RAM_WRONG_PHASE' ||
      code === 'NOT_ACTIVE_TEAM' ? 'phase' :
    code === 'ACTION_SPENT' || code === 'RAM_ACTION_SPENT' ? 'spent' :
    code?.includes('OUT_OF_RANGE') ? 'range' :
    code?.includes('SIGHT_BLOCKED') ? 'sight' :
    ['UNREACHABLE', 'OUT_OF_BOUNDS', 'RAM_PATH_BLOCKED'].includes(code) ? 'path' :
    code?.startsWith('WEAPON_') ? 'weapon' :
    code?.includes('TARGET_') || code === 'RAM_CORE_FORBIDDEN' ? 'target' :
    code?.includes('UNAVAILABLE') ? 'unavailable' : 'generic';
  return t(`v2.reject.${category}`);
}

export function buildIronDustV2View(projection, ruleProfileId,
  events = projection.events) {
  const state = projection.state;
  const terrain = new Map(state.map.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
  const cells = [];
  for (let y = 0; y < state.map.height; y++) for (let x = 0; x < state.map.width; x++) {
    cells.push({x, y, type:terrain.get(`${x},${y}`) ?? state.map.defaultTerrain});
  }
  const units = state.units.map(unit => ({
    id:unit.id, name:unit.name, type:unit.type, team:unit.team, icon:unit.icon,
    x:unit.x, y:unit.y, hp:unit.hp, maxHp:unit.maxHp, defense:unit.defense,
    move:unit.move ?? null, range:unit.range ?? null, attack:unit.damage ?? null,
    disabled:unit.disabled, moved:unit.moved, fired:unit.fired,
    secondMoved:unit.secondMoved, embarkedOn:unit.embarkedOn,
    terrain:terrain.get(`${unit.x},${unit.y}`) ?? state.map.defaultTerrain,
    treads:unit.ogreSystems?.treads ?? null,
    selectedWeapon:unit.ogreSystems?.selectedWeapon ?? null,
    weapons:unit.ogreSystems ? Object.fromEntries(Object.entries(unit.ogreSystems.weapons)
      .map(([key, weapon]) => [key, {label:weapon.label, attack:weapon.attack,
        range:weapon.range, ready:globalThis.GoblinSystems?.weaponReady(weapon) ??
          Math.max(0, weapon.remaining - weapon.firedThisPhase)}])) : null
  }));
  const core = units.find(unit => unit.id === 'core');
  return {
    profileVersion:projection.profileVersion, ruleProfileId,
    mode:projection.mode, phase:state.phase, turn:state.turn,
    cursor:projection.cursor,
    victory:{status:state.victory.status, winner:state.victory.winner},
    cells, units,
    objective:{coreHp:core.hp, coreMaxHp:core.maxHp,
      progress:Math.round(100 * (core.maxHp - core.hp) / core.maxHp)},
    events:events.map(event => ({type:event.type,
      actorId:event.actorId ?? event.attackerId ?? event.unitId ?? null,
      targetId:event.targetId ?? null, cursorPass:event.cursorPass ?? null,
      cursorIndex:event.cursorIndex ?? null}))
  };
}

function renderFacts(facts) {
  const container = document.querySelector('#unit-intel-facts');
  container.replaceChildren(...facts.map(([name, value]) => {
    const row = element('div');
    row.append(element('span', null, name), element('b', null, String(value)));
    return row;
  }));
}

function renderIntel(view) {
  const unit = view.units.find(item => item.id === selectedUnitId);
  const cell = selectedCell && view.cells.find(item =>
    item.x === selectedCell.x && item.y === selectedCell.y);
  const selection = document.querySelector('#selection-readout');
  const icon = element('span', 'selection-icon');
  const artwork = unitArt(unit);
  if (artwork) icon.append(artwork);
  else icon.textContent = unit?.hp > 0 ? unit.icon : unit ? '×' : '+';
  const details = element('div');
  details.append(element('b', null, unit ? unitLabel(unit.id) : t('v2.ui.selectUnitOrHex')),
    element('small', null, unit ? `${cellLabel(unit.x, unit.y)} · ${t(unit.team === 'player' ? 'v2.ui.ready' : 'v2.ui.view')}` : ''));
  selection.replaceChildren(icon, details);
  setText('#unit-intel-kicker', t(unit?.team === 'enemy' ? 'v2.ui.hostileIntel' : 'v2.ui.unitIntel'));
  setText('#unit-intel-title', unit ? unitLabel(unit.id) : t('v2.ui.noUnit'));
  setText('#unit-intel-copy', unit ?
    `${label(`v2.ui.type.${unit.id}`, unit.type)} · ${t(`v2.ui.team.${unit.team}`)} · ${t('v2.ui.sector')} ${cellLabel(unit.x, unit.y)}` :
    t('v2.ui.selectFriendly'));
  renderFacts(unit ? [
    ['HP', `${unit.hp}/${unit.maxHp}`], [t('v2.ui.defense'), unit.defense],
    [t('v2.ui.moveRange'), `${unit.move ?? '—'} / ${unit.range ?? '—'}`],
    [t('v2.ui.status'), unit.hp <= 0 ? t('v2.ui.destroyed') : unit.disabled ? t('v2.ui.disabled') : label(`v2.ui.terrain.${unit.terrain}`, unit.terrain)],
    ...(unit.treads === null ? [] : [[t('v2.ui.treads'), unit.treads], [t('v2.ui.weapon'), label(`v2.ui.weapon.${unit.selectedWeapon}`, unit.selectedWeapon)]])
  ] : [[t('v2.ui.profile'), view.ruleProfileId]]);
  setText('#intel-kicker', t('v2.ui.fieldIntel'));
  setText('#intel-title', cell ? cellLabel(cell.x, cell.y) : t('v2.ui.sectorBrief'));
  setText('#intel-copy', cell ? label(`v2.ui.terrain.${cell.type}`, cell.type) : t('v2.ui.selectHex'));
  const fieldFacts = document.querySelector('#intel-facts');
  fieldFacts.replaceChildren(element('div', null, cell ? `${t('v2.ui.terrain')} · ${label(`v2.ui.terrain.${cell.type}`, cell.type)}` : `${t('v2.ui.terrain')} · —`));
}

function renderRoster(view, rerender) {
  const roster = document.querySelector('#unit-roster');
  roster.replaceChildren(...view.units.filter(unit => unit.team === 'player').map(unit => {
    const card = element('div', `unit-card ${unit.id === 'ogre' ? 'ogre' : ''}${unit.hp <= 0 ? ' destroyed' : ''}`);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', globalThis.GoblinLanguage?.t('v2.ui.selectAria', {unit:unitLabel(unit.id)}) ?? `${unitLabel(unit.id)} auswählen`);
    const token = element('div', 'unit-token');
    const artwork = unitArt(unit);
    if (artwork) token.append(artwork);
    else token.textContent = unit.hp <= 0 ? '×' : unit.icon;
    const name = element('div');
    name.append(element('span', 'unit-name', unitLabel(unit.id)),
      element('span', 'unit-type', unit.hp <= 0 ? t('v2.ui.destroyed') : unit.disabled ? t('v2.ui.disabled') :
        unit.moved ? t('v2.ui.moved') : label(`v2.ui.type.${unit.id}`, unit.type)));
    const health = element('div', 'hp-bar');
    for (let i = 0; i < unit.maxHp; i++) health.append(element('i', i >= unit.hp ? 'off' : ''));
    card.append(token, name, health);
    card.addEventListener('click', () => {selectedUnitId = unit.id; selectedCell = {x:unit.x, y:unit.y}; rerender();});
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); card.click();}
    });
    return card;
  }));
  setText('#force-count', String(view.units.filter(unit => unit.team === 'player' && unit.hp > 0).length).padStart(2, '0'));
}

function renderMap(view, rerender, onAction) {
  const map = document.querySelector('#battlefield-map');
  map.setAttribute('viewBox', '0 0 790 480');
  map.replaceChildren();
  const activateCell = cell => {
    const occupant = view.units.find(unit => unit.hp > 0 && unit.x === cell.x && unit.y === cell.y);
    const actor = view.units.find(unit => unit.id === selectedUnitId && unit.team === 'player' && unit.hp > 0);
    if (onAction && actor && view.mode === 'player' &&
        (view.phase === 'movement' || view.phase === 'gev' || view.phase === 'fire') &&
        (!occupant || occupant.team === 'enemy')) {
      const command = occupant ? view.phase === 'fire' ?
        {type:'PlayerFire', playerId:'player', unitId:actor.id,
          targetId:occupant.id, ...(actor.id === 'ogre' ? {weaponKey:actor.selectedWeapon} : {})} :
        {type:'Ram', playerId:'player', unitId:actor.id, targetId:occupant.id} :
        {type:'Move', playerId:'player', unitId:actor.id, to:{x:cell.x, y:cell.y}};
      onAction(command);
      return;
    }
    selectedCell = {x:cell.x, y:cell.y};
    selectedUnitId = occupant?.id ?? null;
    rerender();
  };
  for (const cell of view.cells) {
    const polygon = svgElement('polygon');
    polygon.dataset.x = String(cell.x);
    polygon.dataset.y = String(cell.y);
    polygon.setAttribute('points', points(cell.x, cell.y));
    polygon.setAttribute('fill', cell.type === 'open-ground' ? '#0e2022' : '#243d3a');
    polygon.setAttribute('stroke', '#2d464b');
    polygon.classList.add('hex');
    if (selectedCell?.x === cell.x && selectedCell?.y === cell.y)
      polygon.setAttribute('stroke', '#d1f35a');
    polygon.addEventListener('click', () => activateCell(cell));
    map.appendChild(polygon);
    const asset = globalThis.UnitVisuals.terrainAssetFor(cell.type);
    if (asset && cell.type !== 'open-ground') {
      const c = center(cell.x, cell.y), image = svgElement('image');
      image.setAttribute('href', asset);
      image.setAttribute('x', c.x - 36); image.setAttribute('y', c.y - 36);
      image.setAttribute('width', 72); image.setAttribute('height', 72);
      image.setAttribute('pointer-events', 'none');
      map.appendChild(image);
    }
  }
  for (const unit of view.units) {
    const c = center(unit.x, unit.y), group = svgElement('g');
    group.classList.add('unit-svg');
    group.dataset.unitId = unit.id;
    group.addEventListener('click', event => {
      event?.stopPropagation?.();
      activateCell(unit);
    });
    if (unit.hp <= 0) {
      const wreck = svgElement('text');
      wreck.setAttribute('x', c.x); wreck.setAttribute('y', c.y + 5);
      wreck.setAttribute('text-anchor', 'middle'); wreck.classList.add('wreck-mark');
      wreck.textContent = '×'; group.appendChild(wreck);
    } else {
      const color = unit.team === 'enemy' ? '#ee574d' : unit.id === 'ogre' ? '#d1f35a' : '#62cadd';
      globalThis.UnitVisuals.draw(group, unit, c,
        {ns:SVG_NS, color, selected:unit.id === selectedUnitId});
      const hp = svgElement('rect');
      hp.setAttribute('x', c.x - 15); hp.setAttribute('y', c.y + 22);
      hp.setAttribute('width', 30 * unit.hp / unit.maxHp);
      hp.setAttribute('height', 3); hp.setAttribute('fill', color);
      group.appendChild(hp);
      if (unit.disabled) group.classList.add('disabled-unit');
    }
    map.appendChild(group);
  }
}

function renderWeapons(view, onAction) {
  const panel = document.querySelector('#weapon-controls');
  const actor = view.units.find(unit => unit.id === selectedUnitId && unit.team === 'player');
  panel.replaceChildren();
  const available = onAction && view.mode === 'player' &&
    actor?.id === 'ogre' && view.phase === 'fire';
  panel.classList.toggle('hidden', !available);
  if (!available) return;
  for (const [key, weapon] of Object.entries(actor.weapons)) {
    const button = element('button', `weapon-control${key === actor.selectedWeapon ? ' active' : ''}`);
    button.type = 'button';
    button.disabled = weapon.ready <= 0;
    button.textContent = `${label(`v2.ui.weapon.${key}`, weapon.label)} · ${t('v2.ui.attack')} ${weapon.attack} · ${t('v2.ui.range')} ${weapon.range} · ${t('v2.ui.ready')} ${weapon.ready}`;
    button.addEventListener('click', () => onAction({type:'SelectWeapon', playerId:'player',
      unitId:'ogre', weaponKey:key}));
    panel.appendChild(button);
  }
}

export function resetIronDustV2View() {selectedUnitId = null; selectedCell = null;}

export function renderIronDustV2View(view, {onAction = null, actionError = null} = {}) {
  const rerender = () => renderIronDustV2View(view, {onAction, actionError});
  renderMap(view, rerender, onAction);
  renderRoster(view, rerender);
  renderIntel(view);
  renderWeapons(view, onAction);
  setText('#mission-kicker', 'IRON DUST v2');
  const titleKey = 'mission.iron-dust-v2.title';
  const title = globalThis.GoblinLanguage?.t(titleKey);
  setText('#mission-title', view.victory.status === 'ended' ?
    view.victory.winner === 'player' ? t('v2.win') : t('v2.lose') :
    title && title !== titleKey ? title : 'IRON DUST v2');
  setText('#mission-sub', view.mode === 'enemy' ? t('v2.enemy') :
    view.mode === 'ended' ? t('v2.ended') : t('v2.objective'));
  setText('#objective-text', `${t('v2.ui.coreHp')} ${view.objective.coreHp}/${view.objective.coreMaxHp} · ${t('v2.objective')}`);
  document.querySelector('#objective-progress').style.width = `${view.objective.progress}%`;
  const phase = view.victory.status === 'ended' ?
    view.victory.winner === 'player' ? t('v2.win') : t('v2.lose') :
    t(`v2.phase.${view.phase}`);
  setText('#phase-title', phase);
  setText('#turn-number', String(view.turn).padStart(2, '0'));
  for (const [id, label, phaseName] of [
    ['movement-ready', 'v2.ui.move', 'movement'], ['fire-ready', 'v2.ui.fire', 'fire'],
    ['gev-ready', 'v2.ui.skimmer', 'gev']]) {
    const node = document.querySelector(`#${id}`);
    node.textContent = t(label);
    node.classList.toggle('active', view.phase === phaseName);
  }
  setText('#log-status', view.victory.status === 'ended' ?
    view.victory.winner === 'player' ? t('v2.ui.success') : t('v2.ui.critical') :
    actionError ? t('v2.error') : 'IRON DUST v2');
  const toast = document.querySelector('#map-toast');
  toast.textContent = actionError ? formatIronDustV2Error(actionError) :
    view.mode === 'enemy' ? t('v2.enemy') :
      view.victory.status === 'ended' ? t('v2.ended') :
        `${t(`v2.phase.${view.phase}`)} · ${t('v2.select')}`;
  const log = document.querySelector('#combat-log');
  log.replaceChildren(...(view.events.length ? view.events.map(event =>
    element('div', 'log-line', formatIronDustV2Event(event))) :
    [element('div', 'log-line', t('v2.objective'))]));
}
