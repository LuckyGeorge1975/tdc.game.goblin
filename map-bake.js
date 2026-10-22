// Optional terrain image for one pinned mission. Every failure keeps the live field renderer.
const MapBake = (() => {
  const ID = 'showcase-terrain-course';
  const MANIFEST = 'assets/map-bakes/showcase-terrain-course-192.json';
  const KEY_SHA = '30ca0414f29ebd28f5530c15c46c72aa23140cae0be2219aa64752279bbd6d8e';
  const IMAGE_SHA = '065b930e386665629efd0c96e7d41d9f9a0ebe91b596885101269e5c3d03abc1';
  const SOURCE = ['c01ecb80bcdd813772d1433d9ae63b39e54ef050',
    'eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140',
    '102e647b93ca7c7d081e1d60e31965a06c2e4714cb2593e9c9bcaa7588bb6ed1',
    '47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385',
    '7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a'];
  let generation = 0;
  let currentKey = null;
  let phase = 'idle';
  let imageUrl = null;
  let controller = null;
  let reason = null;
  let metrics = null;

  const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  const clear = () => {
    generation++;
    controller?.abort(); controller = null;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null; currentKey = null; phase = 'idle'; reason = null; metrics = null;
  };
  function snapshot(id, config, session, level, width, height, size, x0, y0, terrainTypeAt) {
    if (id !== ID || !config || !session || !level) return null;
    const cells = Array.from({length: height}, (_, y) =>
      Array.from({length: width}, (_, x) => terrainTypeAt(x, y)));
    const even = [[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]];
    const odd = [[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]];
    const visualCells = cells.map((row, y) => row.map((type, x) => {
      const neighbors = (y % 2 ? odd : even).map(([dx, dy]) => cells[y + dy]?.[x + dx] ?? null);
      const mask = type === 'forest' ? neighbors.reduce((value, adjacent, direction) =>
        value + (adjacent !== 'forest' ? 1 << direction : 0), 0) : null;
      const road = ['road', 'bridge'].includes(type);
      const river = ['river', 'bridge'].includes(type);
      const roadEdges = neighbors.flatMap((adjacent, direction) =>
        road && ['road', 'bridge'].includes(adjacent) ? [direction] : []);
      const riverEdges = neighbors.flatMap((adjacent, direction) =>
        river && ['river', 'bridge', 'water'].includes(adjacent) ? [direction] : []);
      const urban = type === 'urban' ? [3,1,2,3,4,0,5][(x * 5 + y * 3) % 7] : null;
      return [mask, roadEdges, riverEdges, urban];
    }));
    return {
      scenarioId: id, scenarioVersion: session.scenarioVersion,
      profileId: session.ruleProfileId,
      geometry: [width, height, size, x0, y0, 'odd-row-right', 'pointy-hex'],
      defaultTerrain: level.defaultTerrain, cells, visualCells, level,
      visual: {version: 'map-probe-v1', urbanVariant: 'generator-levelToCfg-v1',
        overlays: 'canonical-road-river-bridge-only', metadata: []},
      source: SOURCE, export: [192, 2400, 1386, 'image/webp', 0.85]
    };
  }
  function select(data, onReady) {
    if (!data) { if (currentKey !== null) clear(); return null; }
    const key = JSON.stringify(data);
    if (key !== currentKey) {
      clear(); currentKey = key; phase = 'loading';
      const token = generation;
      controller = new AbortController();
      const started = performance.now();
      (async () => {
        if (!crypto?.subtle) throw Error('SHA-256 unavailable');
        const manifestResponse = await fetch(MANIFEST, {signal: controller.signal});
        if (!manifestResponse.ok) throw Error(`manifest HTTP ${manifestResponse.status}`);
        const manifest = await manifestResponse.json();
        if (manifest.schemaVersion !== 1 || manifest.key !== key ||
            manifest.keySha256 !== KEY_SHA ||
            manifest.keySha256 !== await sha256(new TextEncoder().encode(key)) ||
            manifest.image !== 'assets/map-bakes/showcase-terrain-course-192.webp' ||
            manifest.imageSha256 !== IMAGE_SHA ||
            manifest.width !== 2400 || manifest.height !== 1386 || manifest.imageBytes !== 541444)
          throw Error('bake fingerprint mismatch');
        const response = await fetch(manifest.image, {signal: controller.signal});
        if (!response.ok) throw Error(`image HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== manifest.imageBytes ||
            await sha256(bytes) !== manifest.imageSha256)
          throw Error('bake image hash mismatch');
        const blob = new Blob([bytes], {type: 'image/webp'});
        const bitmap = await createImageBitmap(blob);
        const dimensionsMatch = bitmap.width === manifest.width && bitmap.height === manifest.height;
        bitmap.close();
        if (!dimensionsMatch) throw Error('bake image dimensions mismatch');
        if (token !== generation || currentKey !== key) return;
        imageUrl = URL.createObjectURL(blob);
        phase = 'ready'; controller = null;
        metrics = {loadAndVerifyMs: Math.round(performance.now() - started),
          encodedBytes: bytes.byteLength, decodedSurfaceBytes: manifest.width * manifest.height * 4};
        onReady();
      })().catch(error => {
        if (token !== generation) return;
        phase = 'fallback'; controller = null; reason = error.message;
        console.warn('Terrain bake fallback:', error);
      });
    }
    return phase === 'ready' ? imageUrl : null;
  }
  return Object.freeze({snapshot, select, status: () => ({phase, reason, metrics})});
})();
