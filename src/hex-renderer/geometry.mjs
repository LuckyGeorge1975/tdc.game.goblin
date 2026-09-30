export const HEX_RADIUS = 30;
export const HEX_DX = Math.sqrt(3) * HEX_RADIUS;
export const HEX_DY = 1.5 * HEX_RADIUS;
export const DEFAULT_HEX_LAYOUT = Object.freeze({
  orientation: 'pointy-top', offset: 'odd-row', radius: HEX_RADIUS,
  origin: Object.freeze({ x: 45, y: 45 }),
});

export function center({ x, y }, layout = DEFAULT_HEX_LAYOUT) {
  const dx = Math.sqrt(3) * layout.radius;
  return { x: layout.origin.x + dx * (x + (y & 1) / 2), y: layout.origin.y + 1.5 * layout.radius * y };
}
export function vertices(cell, layout = DEFAULT_HEX_LAYOUT) {
  const c = center(cell, layout);
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i + Math.PI / 6;
    return { x: c.x + layout.radius * Math.cos(a), y: c.y + layout.radius * Math.sin(a) };
  });
}
export const points = (cell, layout = DEFAULT_HEX_LAYOUT) => vertices(cell, layout).map(p => `${p.x},${p.y}`).join(' ');
export const cellKey = ({ x, y }) => `${x},${y}`;

// Same edge ordering as the established SVG map, used only for outlines.
function edgeNeighbors({ x, y }) {
  return y & 1
    ? [{ x: x + 1, y: y + 1 }, { x, y: y + 1 }, { x: x - 1, y }, { x, y: y - 1 }, { x: x + 1, y: y - 1 }, { x: x + 1, y }]
    : [{ x, y: y + 1 }, { x: x - 1, y: y + 1 }, { x: x - 1, y }, { x: x - 1, y: y - 1 }, { x, y: y - 1 }, { x: x + 1, y }];
}
export function outerBoundary(cells, layout = DEFAULT_HEX_LAYOUT) {
  const set = new Set(cells.map(cellKey));
  const segments = [];
  for (const cell of cells) {
    const corners = vertices(cell, layout);
    edgeNeighbors(cell).forEach((neighbor, i) => {
      if (!set.has(cellKey(neighbor))) segments.push(`M${corners[i].x},${corners[i].y}L${corners[(i + 1) % 6].x},${corners[(i + 1) % 6].y}`);
    });
  }
  return segments.join('');
}
export function viewBox(map) {
  return `0 0 ${Math.ceil(90 + (map.width - 1) * HEX_DX + HEX_DX / 2)} ${Math.ceil(90 + (map.height - 1) * HEX_DY)}`;
}
