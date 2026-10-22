// Optional terrain images for two pinned missions. Every failure keeps the live field renderer.
const MapBake = (() => {
  const BAKES = Object.freeze({
    'showcase-terrain-course': {
      manifest: 'assets/map-bakes/showcase-terrain-course-192.json',
      image: 'assets/map-bakes/showcase-terrain-course-192.webp',
      keySha256: '30ca0414f29ebd28f5530c15c46c72aa23140cae0be2219aa64752279bbd6d8e',
      imageSha256: '065b930e386665629efd0c96e7d41d9f9a0ebe91b596885101269e5c3d03abc1',
      imageBytes: 541444,
      visualVersion: 'map-probe-v1',
      source: ['c01ecb80bcdd813772d1433d9ae63b39e54ef050',
        'eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140',
        '102e647b93ca7c7d081e1d60e31965a06c2e4714cb2593e9c9bcaa7588bb6ed1',
        '47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385',
        '7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a']
    },
    'showcase-specialists': {
      manifest: 'assets/map-bakes/showcase-specialists-192.json',
      image: 'assets/map-bakes/showcase-specialists-192.webp',
      keySha256: '1b67cf4081eced7e79ddffd5d97a870c2f0c8a884043edde2e42cb2efda7b1c9',
      imageSha256: '4fb50c38bc308a3f5c08ba8b9d166376934a2a960844accc87a687b4126cc747',
      imageBytes: 538068,
      visualVersion: 'generator-levelToCfg-v1',
      source: ['c01ecb80bcdd813772d1433d9ae63b39e54ef050',
        'eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140',
        'b06f113b9021593a95e7c6657c91113a5d88d6f1d7ad88c72e8c937fa9aa07e4',
        '47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385',
        '7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a',
        '8f2fb7de4ecb0e322adaf233b8b6c40ac41065fc1f60c7d9a6199ce359c74ca0',
        'a17da5326c2ecdf613f44ea2ac84ef2a42b0c9175d07cee7a174c083a3864853']
    }
  });
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
    const bake = BAKES[id];
    if (!bake || !config || !session || !level) return null;
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
      visual: {version: bake.visualVersion, urbanVariant: 'generator-levelToCfg-v1',
        overlays: 'canonical-road-river-bridge-only', metadata: []},
      source: bake.source, export: [192, 2400, 1386, 'image/webp', 0.85]
    };
  }
  function select(data, onReady) {
    if (!data) { if (currentKey !== null) clear(); return null; }
    const bake = BAKES[data.scenarioId];
    if (!bake) { if (currentKey !== null) clear(); return null; }
    const key = JSON.stringify(data);
    if (key !== currentKey) {
      clear(); currentKey = key; phase = 'loading';
      const token = generation;
      const requestController = new AbortController();
      controller = requestController;
      const started = performance.now();
      (async () => {
        if (!crypto?.subtle) throw Error('SHA-256 unavailable');
        const manifestResponse = await fetch(bake.manifest, {signal: requestController.signal});
        if (!manifestResponse.ok) throw Error(`manifest HTTP ${manifestResponse.status}`);
        const manifest = await manifestResponse.json();
        if (manifest.schemaVersion !== 1 || manifest.key !== key ||
            manifest.keySha256 !== bake.keySha256 ||
            manifest.keySha256 !== await sha256(new TextEncoder().encode(key)) ||
            manifest.image !== bake.image ||
            manifest.imageSha256 !== bake.imageSha256 ||
            manifest.width !== 2400 || manifest.height !== 1386 || manifest.imageBytes !== bake.imageBytes)
          throw Error('bake fingerprint mismatch');
        if (token !== generation || currentKey !== key) return;
        const response = await fetch(manifest.image, {signal: requestController.signal});
        if (!response.ok) throw Error(`image HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== manifest.imageBytes ||
            await sha256(bytes) !== manifest.imageSha256)
          throw Error('bake image hash mismatch');
        if (token !== generation || currentKey !== key) return;
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
