# Atlas 192 px render handoff (`goblin-nbg.12.4`)

This candidate prepares exactly the unchanged `atlas-proving-grounds` level for an independent image run. No image is imported into the game. The game continues to use its existing renderer until a separately reviewed integration. The existing `serve.mjs` allowlist serves only `harness.html`, `generator.html`, `level.json` and `contract.json` for this prepared probe.

Source pin: Content commit `c01ecb80bcdd813772d1433d9ae63b39e54ef050`, retained by Coordination after the path-only relocation. A Content `main` freshness check on 22 October 2026 at 13:34:24 UTC found `2fdce6ac1be30e8b2a360250b37724586469e71c`. Generator ZIP SHA-256 `0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2`; generator HTML `47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385`; 35-master archive `7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a`; Atlas level source `1f4e6a6303e9e835f41556e57595cf6d2646bb30d028fb412e090b7ff223673d`. The effective profile comes from the unchanged loader default `FIELD_TEST_LEGACY_v1` and the scenario manifest's `field-test-atlas-v1` unit data profile. The preparation also pins the loader, manifest and unit profile file hashes in its source contract.

`prepare-atlas.py` checks those bytes, the effective runtime profile, all 26 explicit terrain entries and 96 canonical cells. Its contract includes the unchanged level, each cell's neighbors, forest mask, road/river edges and generator urban variant, with no overlays or variant overrides. Direction indices are `E, SE, SW, W, NW, NE` on an odd-row-right pointy hex grid. Bridge `(6,3)` has road `[3]` west and river `[2,4]` south/north; its eastern neighbor `(7,3)` is ridge. The separate east road `(7,5)` ↔ `(8,5)` has `[0]`/`[3]` and no bridge connection. The north river `(6,1)` has `[2,4,5]`, meeting the two water cells `(6–7,0)`; the south river `(6,5)` has `[4]` and ends inside the board. No ford, overlay or new terrain value is encoded.

The prepared contract fingerprint is `612b1b8c29c68f973758d24739f78dd30efaef9028bcfb9efa97febf15e98bcb`; `contract.json` SHA-256 is `127b06239a4fc81d249b39b00ca285e8d0b2b6dd73fe8ee2d897e22ac5a4e64d`. Two isolated preparations produced byte-identical files. The output path must be a fresh directory under the project-root `.tools`.

Prepare a fresh project-local diagnostic directory using the pinned ZIPs:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B tdc.game.ogre-release-integration\probes\map-bake\prepare-atlas.py .tools\content-source\c01ecb80bcdd813772d1433d9ae63b39e54ef050-546603a4abe547e1b4182b8eb21efab7.zip .tools\content-source\c01ecb80bcdd813772d1433d9ae63b39e54ef050-57bb51c4dfd348008d8210448fe4b65d.zip tdc.game.ogre-release-integration\assets\unit-art\levels\atlas-proving-grounds.json .tools\diagnose-nbg-12-4-tester\harness
node tdc.game.ogre-release-integration\probes\map-bake\serve.mjs .tools\diagnose-nbg-12-4-tester\harness 4189
```

The server binds `127.0.0.1` and launches no browser. The assigned Tester may use the approved `goblin-local` BrowserAct session at `http://127.0.0.1:4189/harness.html` and click **192 px rendern** or call `window.mapBakeProbe.render()`. Rendering starts only after that action. The harness reports PNG/WebP hashes and sizes, render/decode time, and verifies 2400×1386 dimensions and WebP decoding. The Tester should retain both exported files and the report, review the visible bridge, water, open river end and detached road, and compare PNG with WebP. Theoretical one-surface RGBA is 13,305,600 bytes; product peak memory and mobile behavior remain unmeasured.

For later integration, bind the actual PNG and WebP hashes and bytes to this contract fingerprint, 192 px/2400×1386/quality 0.85 parameters and independent visual evidence. Image import, manifest addition and runtime mapping require a separate step after QA.
