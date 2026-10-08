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

export function buildIronDustV2View(projection, ruleProfileId) {
  const state = projection.state;
  const terrain = new Map(state.map.terrain.map(cell => [`${cell.x},${cell.y}`, cell.type]));
  const cells = [];
  for (let y = 0; y < state.map.height; y++) for (let x = 0; x < state.map.width; x++) {
    cells.push({x, y, type:terrain.get(`${x},${y}`) ?? state.map.defaultTerrain});
  }
  const units = state.units.map(unit => ({
    id:unit.id, name:unit.name, type:unit.type, team:unit.team, icon:unit.icon,
    x:unit.x, y:unit.y, hp:unit.hp, maxHp:unit.maxHp, defense:unit.defense,
    move:unit.move ?? null, range:unit.range ?? null,
    disabled:unit.disabled, moved:unit.moved, fired:unit.fired,
    secondMoved:unit.secondMoved, embarkedOn:unit.embarkedOn,
    terrain:terrain.get(`${unit.x},${unit.y}`) ?? state.map.defaultTerrain,
    treads:unit.ogreSystems?.treads ?? null,
    selectedWeapon:unit.ogreSystems?.selectedWeapon ?? null
  }));
  const core = units.find(unit => unit.id === 'core');
  return {
    profileVersion:projection.profileVersion, ruleProfileId,
    mode:projection.mode, phase:state.phase, turn:state.turn,
    victory:{status:state.victory.status, winner:state.victory.winner},
    cells, units,
    objective:{coreHp:core.hp, coreMaxHp:core.maxHp,
      progress:Math.round(100 * (core.maxHp - core.hp) / core.maxHp)},
    events:projection.events.map(event => ({type:event.type,
      actorId:event.actorId ?? event.attackerId ?? event.unitId ?? null,
      targetId:event.targetId ?? null}))
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
  setText('#selection-readout', unit ? `${unit.name} · ${cellLabel(unit.x, unit.y)} · ANSICHT` :
    'EINHEIT ODER FELD ANSEHEN · AKTIONEN GESPERRT');
  setText('#unit-intel-kicker', unit?.team === 'enemy' ? 'HOSTILE INTEL' : 'UNIT INTEL');
  setText('#unit-intel-title', unit?.name ?? 'NO UNIT SELECTED');
  setText('#unit-intel-copy', unit ?
    `${unit.type} · ${unit.team.toUpperCase()} · SECTOR ${cellLabel(unit.x, unit.y)}` :
    'V2-Profilansicht; Befehle sind in diesem Teststand gesperrt.');
  renderFacts(unit ? [
    ['HP', `${unit.hp}/${unit.maxHp}`], ['DEFENSE', unit.defense],
    ['MOVE / RANGE', `${unit.move ?? '—'} / ${unit.range ?? '—'}`],
    ['STATUS', unit.hp <= 0 ? 'DESTROYED' : unit.disabled ? 'DISABLED' : unit.terrain.toUpperCase()],
    ...(unit.treads === null ? [] : [['TREADS', unit.treads], ['WEAPON', unit.selectedWeapon]])
  ] : [['PROFILE', view.ruleProfileId]]);
  setText('#intel-kicker', 'FIELD INTEL');
  setText('#intel-title', cell ? cellLabel(cell.x, cell.y) : 'SECTOR BRIEF');
  setText('#intel-copy', cell ? cell.type.toUpperCase() : 'Feld auf der Karte wählen.');
  const fieldFacts = document.querySelector('#intel-facts');
  fieldFacts.replaceChildren(element('div', null, cell ? `TERRAIN · ${cell.type}` : 'TERRAIN · —'));
}

function renderRoster(view, rerender) {
  const roster = document.querySelector('#unit-roster');
  roster.replaceChildren(...view.units.filter(unit => unit.team === 'player').map(unit => {
    const card = element('div', `unit-card ${unit.id === 'ogre' ? 'ogre' : ''}${unit.hp <= 0 ? ' destroyed' : ''}`);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${unit.name} ansehen`);
    const token = element('div', 'unit-token', unit.hp <= 0 ? '×' : unit.icon);
    const name = element('div');
    name.append(element('span', 'unit-name', unit.name),
      element('span', 'unit-type', unit.hp <= 0 ? 'DESTROYED' : unit.disabled ? 'DISABLED' :
        unit.moved ? 'MOVED' : unit.type));
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

function renderMap(view, rerender) {
  const map = document.querySelector('#battlefield-map');
  map.setAttribute('viewBox', '0 0 790 480');
  map.replaceChildren();
  for (const cell of view.cells) {
    const polygon = svgElement('polygon');
    polygon.setAttribute('points', points(cell.x, cell.y));
    polygon.setAttribute('fill', cell.type === 'open-ground' ? '#0e2022' : '#243d3a');
    polygon.setAttribute('stroke', '#2d464b');
    polygon.classList.add('hex');
    if (selectedCell?.x === cell.x && selectedCell?.y === cell.y)
      polygon.setAttribute('stroke', '#d1f35a');
    polygon.addEventListener('click', () => {
      selectedCell = {x:cell.x, y:cell.y};
      selectedUnitId = view.units.find(unit => unit.hp > 0 && unit.x === cell.x && unit.y === cell.y)?.id ?? null;
      rerender();
    });
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

export function resetIronDustV2View() {selectedUnitId = null; selectedCell = null;}

export function renderIronDustV2View(view) {
  const rerender = () => renderIronDustV2View(view);
  renderMap(view, rerender);
  renderRoster(view, rerender);
  renderIntel(view);
  setText('#mission-kicker', 'IRON DUST v2 / INTERNAL TEST');
  const titleKey = 'mission.iron-dust-v2.title';
  const title = globalThis.GoblinLanguage?.t(titleKey);
  setText('#mission-title', view.victory.status === 'ended' ?
    view.victory.winner === 'player' ? 'MISSION COMPLETE' : 'MISSION FAILED' :
    title && title !== titleKey ? title : 'IRON DUST v2 · PROFILANSICHT');
  setText('#mission-sub', `${view.ruleProfileId} · ANSICHT · BEFEHLE GESPERRT`);
  setText('#objective-text', `CORE HP ${view.objective.coreHp}/${view.objective.coreMaxHp}`);
  document.querySelector('#objective-progress').style.width = `${view.objective.progress}%`;
  const phase = view.victory.status === 'ended' ?
    view.victory.winner === 'player' ? 'MISSION COMPLETE' : 'MISSION FAILED' :
    `${view.phase.toUpperCase()} PHASE`;
  setText('#phase-title', phase);
  setText('#turn-number', String(view.turn).padStart(2, '0'));
  for (const [id, label, phaseName] of [
    ['movement-ready', 'MOVE', 'movement'], ['fire-ready', 'FIRE', 'fire'],
    ['gev-ready', 'SKIMMER', 'gev']]) {
    const node = document.querySelector(`#${id}`);
    node.textContent = label;
    node.classList.toggle('active', view.phase === phaseName);
  }
  setText('#log-status', view.victory.status === 'ended' ?
    view.victory.winner === 'player' ? 'SUCCESS' : 'CRITICAL' : 'VIEW ONLY');
  const log = document.querySelector('#combat-log');
  log.replaceChildren(...(view.events.length ? view.events.map(event =>
    element('div', 'log-line', `${event.type} · ${event.actorId ?? '—'} → ${event.targetId ?? '—'}`)) :
    [element('div', 'log-line', 'V2-Profil geladen · noch keine Ereignisse')]));
}
