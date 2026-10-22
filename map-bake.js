// Optional terrain images for five pinned missions. Every failure keeps the live field renderer.
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
    },
    'atlas-proving-grounds': {
      manifest: 'assets/map-bakes/atlas-proving-grounds-192.json',
      image: 'assets/map-bakes/atlas-proving-grounds-192.webp',
      keySha256: 'ec1cb67ce9e42f8e0f391b1574e0b58200f13b5ba72322aaed50e396de136e14',
      imageSha256: 'ceec086c39fef8c85cda01f445e61c577ee2576579c861e1bad02a5a148b9114',
      imageBytes: 543180,
      visualVersion: 'generator-levelToCfg-v1',
      source: ['c01ecb80bcdd813772d1433d9ae63b39e54ef050',
        '1f4e6a6303e9e835f41556e57595cf6d2646bb30d028fb412e090b7ff223673d',
        'eb2388bbf56c848ce6898378f399fd842a8449b2992ac7d517cd1a388758fb18',
        '0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2',
        '47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385',
        '7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a',
        '5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad',
        'a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce',
        '03810e397afcfcda6e10bdb3933bdc3b2a871ac45e7fbd2eaac92f1fe3ddb66b',
        '612b1b8c29c68f973758d24739f78dd30efaef9028bcfb9efa97febf15e98bcb',
        '127b06239a4fc81d249b39b00ca285e8d0b2b6dd73fe8ee2d897e22ac5a4e64d']
    },
    'showcase-siege': {
      manifest: 'assets/map-bakes/showcase-siege-192.json',
      image: 'assets/map-bakes/showcase-siege-192.webp',
      keySha256: '3a2ccfe314aeb8f3885682924dad295cdcf83fba83f75c54d45714b85c6fb38b',
      imageSha256: 'b44d8b607cdcb4c4eae71a6a3c8c1aed197b716f7908e272c221dae3f95abdb4',
      imageBytes: 548576,
      visualVersion: 'generator-levelToCfg-v1',
      source: ['c01ecb80bcdd813772d1433d9ae63b39e54ef050',
        'eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140',
        '4eaa4dbc62ea06057a92bd276f6e3734cdbfd431ec8c64fda3db51e085045204',
        '0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2',
        '47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385',
        '7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a',
        '5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad',
        'a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce',
        '159f286acbd46f17d19ef817c47427fb2c04811e925fff4199c4136804c56727',
        '05f763f2b6e73eb34d6ef82cbf16de7c7ac0b8f8eca2928831446ab4157e11ce',
        'eb4d7338a014b2ec7374b67062dccd12e164c95fbcd30e4cda823c3e0aec09e3']
    },
    'los-supercover-showcase': {
      manifest: 'assets/map-bakes/los-supercover-showcase-192.json',
      image: 'assets/map-bakes/los-supercover-showcase-192.webp',
      keySha256: 'd41b2eb4135a4d83dc82fa7ebd9fdfb3389ed319e0b04feadd3a3e0015715ec1',
      imageSha256: 'b886a662f9c878cd603dde3090866b679d6eb74510b84777322edceedd1c06a6',
      imageBytes: 540976,
      visualVersion: 'generator-levelToCfg-v1',
      source: ['c01ecb80bcdd813772d1433d9ae63b39e54ef050',
        'eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140',
        'd3d235e0f69c3bdd9ab182f2d7937ababdd016cfe1d161946d44100d96ef883f',
        '0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2',
        '47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385',
        '7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a',
        '5cf6d5e5cc58b868cc5d8a7a290639b2a33bce5cd66c4ceb566e81956bbec3ad',
        'a02c649eed8f49c1a9b4c52f1c5567be9b35cf906400b47577c7333fd244b7ce',
        '159f286acbd46f17d19ef817c47427fb2c04811e925fff4199c4136804c56727',
        '3286ef8baa56417c58be12a5899470b1c4221a926c24e7d4d82c7831e6929bb6',
        'cdcafbb94ca7e4c08e7694e68a74379ec79cc433d94591a173283942aa67d69e']
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
    if (id === 'atlas-proving-grounds' &&
        (session.scenarioId !== id || session.ruleProfileId !== 'FIELD_TEST_LEGACY_v1' ||
         config.ruleProfileId !== 'FIELD_TEST_LEGACY_v1' ||
         config.ruleProfile !== 'field-test-atlas-v1' ||
         session.effectiveRules?.unitDataProfile !== 'field-test-atlas-v1')) return null;
    if (id === 'showcase-siege' || id === 'los-supercover-showcase') {
      const supercover = id === 'los-supercover-showcase';
      const profile = supercover ? 'FIELD_TEST_SUPERCOVER_v1' : 'FIELD_TEST_LEGACY_v1';
      const losMode = supercover ? 'strict-supercover' : undefined;
      if (session.scenarioId !== id || session.scenarioVersion !== 1 ||
          session.ruleProfileId !== profile || config.ruleProfileId !== profile ||
          config.ruleProfile !== 'field-test-atlas-v1' ||
          session.effectiveRules?.unitDataProfile !== 'field-test-atlas-v1' ||
          config.losMode !== losMode || session.effectiveRules?.losMode !== losMode) return null;
    }
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
      ...(['atlas-proving-grounds','showcase-siege','los-supercover-showcase'].includes(id)
        ? {unitDataProfile: session.effectiveRules.unitDataProfile} : {}),
      ...(id === 'los-supercover-showcase' ? {losMode: session.effectiveRules.losMode} : {}),
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
