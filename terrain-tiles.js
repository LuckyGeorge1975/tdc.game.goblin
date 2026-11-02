// Runtime hex tiles from the pinned Content terrain set (goblin-owdw).
// Sources and hashes: assets/terrain-tiles/manifest.json. Sides: 0..5 = E, SE, SW, W, NW, NE.
const TerrainTiles = (() => {
  const base = 'assets/terrain-tiles/';
  const ratio = 296 / 256, overlap = 1.03;
  const grounds = Object.freeze({
    'open-ground': 'open-ground', road: 'open-ground', river: 'open-ground', bridge: 'open-ground',
    'rubble-field': 'rubble-field', mountain: 'mountain', ridge: 'ridge', water: 'water',
    marsh: 'marsh', crater: 'crater'
  });
  const forestEdges = Object.freeze([0, 1, 3, 5, 9, 7, 11, 21, 15, 23, 27, 31, 63]);
  const overlays = Object.freeze({
    road: Object.freeze([['road-straight', [3, 0]], ['road-curve-120', [3, 1]], ['road-curve-60', [3, 2]], ['road-y', [3, 0, 5]]]),
    river: Object.freeze([['river-straight', [3, 0]], ['river-curve-120', [3, 1]], ['river-y', [3, 0, 5]]])
  });
  const even = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
  const odd = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];
  const urbanVariants = [3, 1, 2, 3, 4, 0, 5];
  const roadTypes = new Set(['road', 'bridge']);
  const riverTypes = new Set(['river', 'bridge']);
  const riverLinks = new Set(['river', 'bridge', 'water']);

  const bits = sides => sides.reduce((mask, side) => mask | 1 << side, 0);
  const sidesOf = mask => [0, 1, 2, 3, 4, 5].filter(side => mask & 1 << side);
  // Mirror first (E<->W across the vertical axis), then rotate clockwise by 60 degrees per step.
  const place = (side, rotate, mirror) => ((mirror ? 9 - side : side) + rotate) % 6;
  function orient(sides, mask) {
    for (const mirror of [false, true]) for (let rotate = 0; rotate < 6; rotate++)
      if (bits(sides.map(side => place(side, rotate, mirror))) === mask) return {rotate, mirror};
    return null;
  }
  const layer = (file, rotate = 0, mirror = false, clip = null) => ({file, rotate, mirror, clip});

  function neighbors(typeAt, x, y) {
    return (y % 2 ? odd : even).map(([dx, dy]) => typeAt(x + dx, y + dy) ?? null);
  }
  function forestLayer(mask) {
    if (mask === 0) return layer('forest');
    for (const [index, edge] of forestEdges.entries()) {
      const fit = orient(sidesOf(edge), mask);
      if (fit) return layer(`forest-edge-w${String(index).padStart(2, '0')}`, fit.rotate, fit.mirror);
    }
    return layer('forest');
  }
  // One half of the straight piece per connected side covers caps and junctions without a drawn tile.
  function spokes(kind, sides) {
    return sides.map(side => layer(`${kind}-straight`, side, false, 'half'));
  }
  function routeLayers(kind, sides) {
    if (!sides.length) return [layer(`${kind}-straight`)];
    const mask = bits(sides);
    for (const [file, edges] of overlays[kind]) {
      if (edges.length !== sides.length) continue;
      const fit = orient(edges, mask);
      if (fit) return [layer(file, fit.rotate, fit.mirror)];
    }
    return spokes(kind, sides);
  }
  function bridgeLayers(roadSides) {
    const mask = bits(roadSides);
    if (roadSides.length === 2 && [9, 18, 36].includes(mask)) return [layer('bridge', Math.min(...roadSides), false, 'deck')];
    return routeLayers('road', roadSides);
  }

  // Ordered layers for one cell, or null when the type has no tile (caller keeps its fallback).
  function layers(typeAt, x, y) {
    const type = typeAt(x, y);
    const adjacent = neighbors(typeAt, x, y);
    let ground;
    if (type === 'forest') ground = forestLayer(adjacent.reduce((mask, other, side) => mask | (other !== 'forest' ? 1 << side : 0), 0));
    else if (type === 'urban') ground = layer(`urban-s${urbanVariants[(x * 5 + y * 3) % 7]}`);
    else if (Object.hasOwn(grounds, type)) ground = layer(grounds[type]);
    else return null;
    const result = [ground];
    if (riverTypes.has(type)) result.push(...routeLayers('river', sidesOf(adjacent.reduce((mask, other, side) => mask | (riverLinks.has(other) ? 1 << side : 0), 0))));
    if (roadTypes.has(type)) {
      const roadSides = sidesOf(adjacent.reduce((mask, other, side) => mask | (roadTypes.has(other) ? 1 << side : 0), 0));
      result.push(...(type === 'bridge' ? bridgeLayers(roadSides) : routeLayers('road', roadSides)));
    }
    return result;
  }

  const clipIds = {half: 'terrain-tile-clip-half', deck: 'terrain-tile-clip-deck'};
  function ensureClips() {
    const document = globalThis.document;
    if (!document?.getElementById || document.getElementById(clipIds.half)) return;
    const ns = 'http://www.w3.org/2000/svg';
    const host = document.createElementNS(ns, 'svg');
    host.setAttribute('width', 0); host.setAttribute('height', 0);
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'absolute';
    for (const [key, [y, height, x, width]] of Object.entries({half: [0, 1, .44, .56], deck: [.42, .16, 0, 1]})) {
      const clip = document.createElementNS(ns, 'clipPath');
      clip.setAttribute('id', clipIds[key]);
      clip.setAttribute('clipPathUnits', 'objectBoundingBox');
      const rect = document.createElementNS(ns, 'rect');
      for (const [name, value] of Object.entries({x, y, width, height})) rect.setAttribute(name, value);
      clip.appendChild(rect); host.appendChild(clip);
    }
    document.body?.appendChild(host);
  }
  // Draw layers centered on (cx, cy) for a hex of the given flat-to-flat width.
  function draw(parent, cx, cy, width, cellLayers, className = 'terrain-tile') {
    const ns = 'http://www.w3.org/2000/svg', document = globalThis.document;
    const w = width * overlap, h = w * ratio;
    if (cellLayers.some(item => item.clip)) ensureClips();
    for (const item of cellLayers) {
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('transform', `translate(${cx} ${cy}) rotate(${item.rotate * 60})${item.mirror ? ' scale(-1 1)' : ''}`);
      group.setAttribute('class', className);
      group.setAttribute('pointer-events', 'none');
      const image = document.createElementNS(ns, 'image');
      image.setAttribute('href', `${base}${item.file}.webp`);
      image.setAttribute('x', -w / 2); image.setAttribute('y', -h / 2);
      image.setAttribute('width', w); image.setAttribute('height', h);
      image.setAttribute('preserveAspectRatio', 'none');
      if (item.clip) image.setAttribute('clip-path', `url(#${clipIds[item.clip]})`);
      group.appendChild(image);
      parent.appendChild(group);
    }
  }
  // Draw every cell of a width x height board; returns the keys of cells that received tiles.
  function drawBoard(parent, typeAt, width, height, center, hexWidth, className) {
    const all = [], drawn = new Set();
    const bounded = (x, y) => x >= 0 && y >= 0 && x < width && y < height ? typeAt(x, y) : null;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const cell = layers(bounded, x, y);
      if (cell) { all.push([center(x, y), cell]); drawn.add(`${x},${y}`); }
    }
    // Grounds first so overlays and forest edges are never covered by a later neighbour.
    for (const [c, cell] of all) draw(parent, c.x, c.y, hexWidth, cell.slice(0, 1), className);
    for (const [c, cell] of all) if (cell.length > 1) draw(parent, c.x, c.y, hexWidth, cell.slice(1), className);
    return drawn;
  }

  return Object.freeze({layers, draw, drawBoard, orient, place});
})();
globalThis.TerrainTiles = TerrainTiles;
