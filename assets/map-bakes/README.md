# Terrain-course integration pilot (`goblin-nbg.11`)

Only `showcase-terrain-course` can request this bake. `map-bake.js` fetches the manifest and 192 px WebP after that mission is selected. It checks the exact scenario/version/profile, 12×8 odd-row geometry, all canonical terrain cells, derived forest/road/river/urban visual values, complete source level, visual adapter version, pinned Content and generator/master hashes, export settings, manifest fingerprint, WebP SHA-256 and decoded dimensions. A failed check leaves the normal SVG field renderer in use. Mission switches revoke the temporary verified image URL. The SVG hexes, grid, area previews, markers, units and effects stay live above the image. Game rules continue to read canonical terrain data.

The committed 541,444-byte WebP is SHA-256 `065b930e386665629efd0c96e7d41d9f9a0ebe91b596885101269e5c3d03abc1`, 2400×1386 px. It is the real-course `run-01-192.webp` independently rendered twice with identical hashes in `goblin-nbg.10.2`; the PNG source export is SHA-256 `c9c45e9828c87f140d39065b77ad53ae257e8f37f43d88adba7cd2ac8b65b60d`, 6,697,444 bytes. The generator's WebP export used quality 0.85. The 256 px candidate is not shipped. The pinned Content commit is `c01ecb80bcdd813772d1433d9ae63b39e54ef050`, generator HTML hash `47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385`, terrain master archive hash `7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a`. A later Content path relocation was checked; the source content and current pin remained byte-identical by Coordination decision.

To reproduce the installed export from the retained independent render artifacts:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tdc.game.ogre-release-integration\probes\map-bake\export-runtime.py .tools\diagnose-nbg-10-2\result.json .tools\diagnose-nbg-10-2
```

The exporter verifies the pinned source report, runtime level, render report, image bytes and hash before writing the WebP and manifest. The original PNG and render files remain in the local diagnostic cache. The generator and private Content repository are absent from the game load path, build and Pages deployment.

For independent product QA on the candidate commit, measure actual cold/warm transfer and decode, cache behavior, peak memory where instrumentation permits, and zoom legibility on desktop and a mobile viewport. The 13,305,600-byte decoded RGBA value is theoretical for one surface, not a measured peak. Check exact map alignment, hex selection, movement/fire/LOS previews, live unit/marker/effect layers, restart, BACK/undo, replay and mission switching. Test missing, corrupt and stale manifest/image in an isolated served candidate copy and verify the field renderer and canonical costs/cover/LOS remain correct. Do not infer product load or mobile PASS from the isolated generator's 9.7 s render time.
