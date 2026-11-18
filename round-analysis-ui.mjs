const actionIcons = Object.freeze({move:'movement',fire:'fire',ram:'ram'});
const resultLabel = code => ({NE:'v2.feedback.noEffect',D:'v2.feedback.hit',X:'v2.feedback.heavyHit'})[code] ?? code;

// Presentation of an already redacted historical projection. The caller owns
// session binding, round boundaries and permission to supply a perspective.
export function renderRoundAnalysis(panel, round, {t, locale, previewMap, back, icon, selected = 0, onSelect = () => {}}) {
  const doc = panel.ownerDocument;
  const formatScore = new Intl.NumberFormat(locale,{maximumFractionDigits:4});
  function element(tag, className = '', text = '') {
    const node = doc.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function button(text, action) {
    const node = element('button', '', text);
    node.type = 'button';
    node.onclick = action;
    return node;
  }
  panel.classList.add('v2-round-analysis');
  const heading = element('h2', '', t(round.completion === 'complete' ? 'v2.round.title' : 'v2.round.partial', {round:round.roundNumber}));
  const perspective = element('p', 'v2-screen-meta', t(round.perspective === 'player' ? 'v2.round.player' : 'v2.round.full'));
  const layout = element('div', 'v2-round-layout');
  const list = element('ol', 'v2-round-decisions');
  const detail = element('section', 'v2-round-detail');
  const footer = element('footer', 'v2-screen-footer');
  footer.append(button(t('ui.nav.back'), back));
  panel.append(heading, perspective, layout, footer);
  layout.append(list, detail);
  if (!round.rows.length) {
    list.hidden = true;
    detail.append(element('p', '', t('v2.round.noDecisions')));
    return;
  }
  const rows = round.rows.map((decision, index) => {
    const item = element('li');
    const text = [decision.actor && t(decision.actor.labelKey), t(decision.descriptionKey),
      decision.target && t(decision.target.labelKey), decision.targetCell && hexLabel(decision.targetCell),
      decision.resultKey && t(resultLabel(decision.resultKey))].filter(Boolean);
    const choice = button(`${index + 1}. ${text.join(' · ')}`, () => show(index));
    item.append(choice);
    list.append(item);
    return choice;
  });
  function show(index, notify = true) {
    for (const [i, row] of rows.entries()) row.setAttribute('aria-pressed', String(i === index));
    const decision = round.rows[index];
    detail.replaceChildren();
    if (decision.snapshot) {
      const {width,height,terrain = [],defaultTerrain = 'open-ground'} = decision.snapshot;
      const figure = previewMap({width,height,terrain,defaultTerrain,units:[]});
      const svg = figure.querySelector('svg');
      if (svg) {
        const iconName = actionIcons[decision.kind];
        addMapFocus(svg, decision, iconName && icon?.(iconName), t(decision.descriptionKey));
        const origins = decision.snapshot.visiblePathSegments
          .filter(segment => segment.cells.length >= 2)
          .map(segment => hexLabel(segment.cells[0]));
        if (origins.length)
          figure.append(element('p', 'v2-round-path-label', t('v2.round.pathStarts', {cells:origins.join(', ')})));
        figure.append(element('figcaption', '', t('v2.round.mapLegend')));
      }
      detail.append(figure);
    } else detail.append(element('p', '', t('v2.round.noMap')));
    const reason = element('div', 'v2-round-explanation');
    reason.append(element('p', '', t(decision.explanationKey ?? 'v2.round.noReason')));
    if (decision.hits?.length) {
      const hits = element('ul');
      for (const hit of decision.hits)
        hits.append(element('li','', [t(hit.target.labelKey),t(resultLabel(hit.resultKey))].join(' · ')));
      reason.append(hits);
    }
    if (decision.options?.length) {
      const alternatives = element('details');
      alternatives.append(element('summary', '', t('v2.round.alternatives')));
      const options = element('ul');
      for (const option of decision.options) {
        const {basis, model} = option.scores ?? {};
        const actor=option.actor && [t(option.actor.labelKey),option.actor.cell&&hexLabel(option.actor.cell)]
          .filter(Boolean).join(' ');
        const mode=option.mode==='indirect' && option.spotter
          ? t('v2.ui.artillery.indirectVia',{spotter:t(option.spotter.labelKey)})
          : option.mode && t(`v2.ui.artillery.${option.mode}`);
        const label = [t(option.descriptionKey),actor,
          option.weaponRef===null?t('v2.round.standardWeapon'):option.weaponRef,mode,
          option.target && t(option.target.labelKey),
          option.targetCell && hexLabel(option.targetCell), option.component,
          option.selected && t('v2.round.selected'),option.baseline && t('v2.round.baselineTarget'),
          Number.isFinite(basis) && `${t('v2.round.basisScore')} ${formatScore.format(basis)}`,
          Number.isFinite(model) && `${t('v2.round.modelScore')} ${formatScore.format(model)}`,
          !Number.isFinite(basis) && !Number.isFinite(model) && Number.isFinite(option.score) && formatScore.format(option.score)];
        options.append(element('li', '', label.filter(Boolean).join(' · ')));
      }
      alternatives.append(options);
      reason.append(alternatives);
    }
    detail.append(reason);
    if (notify) onSelect(index);
  }
  show(rows[selected] ? selected : 0, false);
}

function addMapFocus(svg, decision, actionIcon, actionLabel) {
  const append = (tag, className, attrs, parent = svg) => {
    const node = svg.ownerDocument.createElementNS(svg.namespaceURI, tag);
    node.setAttribute('class', className);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.append(node);
    return node;
  };
  // Matches the existing V2 historical/briefing board geometry.
  const point = ({x,y}) => [23 + x * 36 + (y % 2 ? 18 : 0), 20 + y * 30];
  for (const {cells} of decision.snapshot.visiblePathSegments) {
    if (cells.length < 2) continue;
    const points = cells.map(point);
    append('polyline', 'v2-round-path', {points:points.map(position => position.join(',')).join(' ')});
    const [[x0,y0],[x,y]] = points.slice(-2);
    const angle = Math.atan2(y - y0, x - x0) * 180 / Math.PI;
    append('path', 'v2-round-direction', {d:'M-6,-4 L0,0 L-6,4',transform:`translate(${x} ${y}) rotate(${angle})`});
  }
  for (const unit of decision.snapshot.units) {
    if (!unit.cell) continue;
    const [cx,cy] = point(unit.cell);
    append('circle', 'v2-round-unit', {cx,cy,r:5});
  }
  for (const {cells} of decision.snapshot.visiblePathSegments) {
    if (cells.length < 2) continue;
    const [x,y] = point(cells[0]);
    append('rect', 'v2-round-path-start', {x:x-4,y:y-4,width:8,height:8});
  }
  if (decision.actor?.cell) {
    const [cx,cy] = point(decision.actor.cell);
    for (const r of [11,15]) append('circle', 'v2-round-actor', {cx,cy,r});
    if (actionIcon) {
      const dx = decision.actor.cell.x === decision.snapshot.width - 1 ? -25 : 25;
      const dy = decision.actor.cell.y === 0 ? 20 : -20;
      const badge = append('g','v2-round-action-marker',{transform:`translate(${cx+dx} ${cy+dy})`});
      append('title','',{},badge).textContent = actionLabel;
      append('rect','v2-round-action-background',{x:-10,y:-10,width:20,height:20,rx:4},badge);
      const art = append('g','',{transform:'translate(-7 -7)'},badge);
      art.innerHTML = actionIcon;
      const icon = art.querySelector('svg');
      icon?.setAttribute('width','14');
      icon?.setAttribute('height','14');
    }
  }
  const targetCell = decision.targetCell ?? decision.target?.cell;
  if (targetCell) {
    const [x,y] = point(targetCell);
    append('path', 'v2-round-target', {d:`M${x-15} ${y}h30 M${x} ${y-15}v30`});
  }
}

const hexLabel = ({x,y}) => `${String.fromCharCode(65+x)}-${String(y+1).padStart(2,'0')}`;
