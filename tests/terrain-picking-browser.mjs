// Run in the local browser with:
// browser-act --session <own-session> eval "import('/tests/terrain-picking-browser.mjs').then(m => m.runTerrainPickingBrowserCheck())"
import { phaseScenario, PHASE_SEED } from '../src/core/phase-fixture.mjs';
import { center, vertices } from '../src/hex-renderer/geometry.mjs';
import { createHexRenderer } from '../src/hex-renderer/renderer.mjs';

const root = '/assets/terrain-map-study/portable/';
const load = async path => {
  const response = await fetch(root + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const equal = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
};

export async function runTerrainPickingBrowserCheck() {
  const map = await load('visual-map.json');
  const styles = await Promise.all(['verdant', 'dryland', 'natural', 'field-atlas'].map(id => load(`styles/${id}.json`)));
  const state = { rulesVersion: phaseScenario.rulesVersion, scenarioVersion: phaseScenario.scenarioVersion,
    map: structuredClone(phaseScenario.map), units: structuredClone(phaseScenario.units),
    activeTeam: 'player', phase: 'movement', turn: 1, victory: { status: 'ongoing', winner: null },
    rng: { seed: PHASE_SEED, state: PHASE_SEED } };
  const before = JSON.stringify(state);
  const picks = [], svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:fixed;left:100px;top:40px;width:720px;height:480px;z-index:2147483647;background:#fff;';
  svg.setAttribute('preserveAspectRatio', 'none');
  document.body.appendChild(svg);
  const renderer = createHexRenderer({ svg, onPick: pick => picks.push(pick) });
  const left = { x: 2, y: 2 }, right = { x: 3, y: 2 };
  const corners = vertices(left, map.hexLayout);
  const edge = { x: (corners[0].x + corners[5].x) / 2, y: (corners[0].y + corners[5].y) / 2 };
  const unit = state.units.find(value => value.id === 'p-gev');
  if (!unit) throw new Error('phase fixture has no p-gev');
  const pickAt = (world, expected, label) => {
    const screen = new DOMPoint(world.x, world.y).matrixTransform(svg.getScreenCTM());
    const target = document.elementFromPoint(screen.x, screen.y);
    if (!target || !svg.contains(target)) throw new Error(`${label}: no SVG hit at ${screen.x},${screen.y}`);
    picks.length = 0;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: screen.x, clientY: screen.y }));
    if (JSON.stringify(picks) !== JSON.stringify([expected])) {
      const actualWorld = new DOMPoint(screen.x, screen.y).matrixTransform(svg.getScreenCTM().inverse());
      throw new Error(`${label}: ${JSON.stringify({ picks, expected, screen: { x: screen.x, y: screen.y }, actualWorld: { x: actualWorld.x, y: actualWorld.y }, target: target.outerHTML.slice(0, 200) })}`);
    }
    return target.getAttribute('data-layer') ?? target.getAttribute('data-unit-id') ?? target.tagName;
  };
  const hits = [];
  try {
    for (const style of styles) for (const mode of ['full', 'pan-zoom']) {
      renderer.render({ state, visualMap: map, styleSet: style,
        view: { gridVisible: mode === 'pan-zoom', focusedCell: left, selectedUnitId: unit.id, areaMode: 'movement' },
        areas: { movementReachable: [left, right], attackableTargets: [unit.id] },
        events: [{ type: 'UnitMoved', to: left }] });
      const width = mode === 'full' ? 1440 : 800, height = mode === 'full' ? 960 : 550;
      svg.setAttribute('viewBox', `${edge.x - 220 / (720 / width)} ${edge.y - 160 / (480 / height)} ${width} ${height}`);
      const prefix = `${style.setId}/${mode}`;
      hits.push({ case: prefix + '/left', hit: pickAt({ x: edge.x - 4, y: edge.y }, { type: 'hex', cell: left }, prefix + '/left') });
      hits.push({ case: prefix + '/edge', hit: pickAt(edge, { type: 'hex', cell: left }, prefix + '/edge') });
      hits.push({ case: prefix + '/right', hit: pickAt({ x: edge.x + 4, y: edge.y }, { type: 'hex', cell: right }, prefix + '/right') });
      hits.push({ case: prefix + '/unit', hit: pickAt(center(unit, map.hexLayout),
        { type: 'unit', unitId: unit.id, cell: { x: unit.x, y: unit.y } }, prefix + '/unit') });
      hits.push({ case: prefix + '/free-overlay', hit: pickAt(center(left, map.hexLayout),
        { type: 'hex', cell: left }, prefix + '/free-overlay') });
      equal(JSON.stringify(state), before, prefix + '/state');
    }
    return { ok: true, styles: styles.map(style => style.setId), modes: ['full', 'pan-zoom'], hitCount: hits.length, hits };
  } finally {
    svg.remove();
  }
}
