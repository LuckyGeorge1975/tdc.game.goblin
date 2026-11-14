// Presentation of an already redacted historical projection. The caller owns
// session binding, round boundaries and permission to supply a perspective.
export function renderRoundAnalysis(panel, round, {t, previewMap, back, selected = 0, onSelect = () => {}}) {
  const doc = panel.ownerDocument;
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
      decision.target && t(decision.target.labelKey), decision.resultKey && t(decision.resultKey)].filter(Boolean);
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
        addMapFocus(svg, decision);
        figure.append(element('figcaption', '', t('v2.round.mapLegend')));
      }
      detail.append(figure);
    } else detail.append(element('p', '', t('v2.round.noMap')));
    const reason = element('div', 'v2-round-explanation');
    reason.append(element('p', '', t(decision.explanationKey ?? 'v2.round.noReason')));
    if (decision.options?.length) {
      const alternatives = element('details');
      alternatives.append(element('summary', '', t('v2.round.alternatives')));
      const options = element('ul');
      for (const option of decision.options) {
        const label = [t(option.descriptionKey), option.target && t(option.target.labelKey),
          option.selected && t('v2.round.selected'), Number.isFinite(option.score) && new Intl.NumberFormat(undefined,{maximumFractionDigits:4}).format(option.score)];
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

function addMapFocus(svg, decision) {
  const append = (tag, className, attrs) => {
    const node = svg.ownerDocument.createElementNS(svg.namespaceURI, tag);
    node.setAttribute('class', className);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
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
  if (decision.actor?.cell) {
    const [cx,cy] = point(decision.actor.cell);
    for (const r of [11,15]) append('circle', 'v2-round-actor', {cx,cy,r});
  }
  if (decision.target?.cell) {
    const [x,y] = point(decision.target.cell);
    append('path', 'v2-round-target', {d:`M${x-15} ${y}h30 M${x} ${y-15}v30`});
  }
}
