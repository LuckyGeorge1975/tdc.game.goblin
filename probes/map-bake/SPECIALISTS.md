# Specialists 192 px render handoff (`goblin-nbg.12.1`)

This candidate prepares only the unchanged, playable `showcase-specialists` level for an independent image run. It does not import a new image into the game. The normal game continues to use the existing SVG field renderer for Specialists. The delivered `level4.mjs` and `cdp.mjs` are not used; they start a separate browser/profile.

Source pin: Content `c01ecb80bcdd813772d1433d9ae63b39e54ef050`; generator ZIP SHA-256 `0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2`; generator HTML `47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385`; 35-master archive `7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a`; level bundle `eea48c2a044beb2c07ee852b6cfcfe6297ab91d810f85d033bebc72331e8c140`. The Content `main` freshness check on 22 October 2026 at 12:32:14 UTC still found `2fdce6ac1be30e8b2a360250b37724586469e71c`; Coordination kept the source pin after the known path-only relocation.

`prepare-specialists.py` validates those bytes and exactly seven Specialists terrain entries, all 96 canonical cells, the fixed `FIELD_TEST_LEGACY_v1` profile and the generated visual-cell data. Its contract contains the full level, each cell's neighbors, forest mask, road/river edges and generator urban variant, plus explicit absence of overlay and urban overrides. Direction indices are `E, SE, SW, W, NW, NE`. Bridge `(6,3)` has road `[0,3]` and river `[2]` only; the river continues to `(6,4–5)` and ends inside the board. Road `(7,3)` ends westward with `[3]`; city `(8,2)` is an adjacent NE terrain cell, not an added road connection. No north river, ford, extra route or new playable overlay is encoded. The WebP/PNG image hashes remain unknown until the independent render.

The prepared contract fingerprint is `8f2fb7de4ecb0e322adaf233b8b6c40ac41065fc1f60c7d9a6199ce359c74ca0`; `contract.json` SHA-256 is `a17da5326c2ecdf613f44ea2ac84ef2a42b0c9175d07cee7a174c083a3864853`. Two isolated preparations produced byte-identical files. The output path is restricted to the project-root `.tools` directory and must be new for each run.

Prepare a **fresh** project-local diagnostic directory using the existing pinned source ZIPs:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tdc.game.ogre-release-integration\probes\map-bake\prepare-specialists.py .tools\content-source\c01ecb80bcdd813772d1433d9ae63b39e54ef050-546603a4abe547e1b4182b8eb21efab7.zip .tools\content-source\c01ecb80bcdd813772d1433d9ae63b39e54ef050-57bb51c4dfd348008d8210448fe4b65d.zip tdc.game.ogre-release-integration\assets\unit-art\levels\showcase-levels.json .tools\diagnose-nbg-12-1-tester\harness
node tdc.game.ogre-release-integration\probes\map-bake\serve.mjs .tools\diagnose-nbg-12-1-tester\harness 4189
```

The read-only server binds `127.0.0.1`. It launches no browser. The assigned Tester may use the already approved `goblin-local` BrowserAct session and open `http://127.0.0.1:4189/harness.html`, then call `window.mapBakeProbe.render()` or click **192 px rendern**. The harness renders only after that action, downloads PNG and WebP from in-memory canvas blobs, and reports render/decode time, 2400×1386 dimensions, sizes and SHA-256 hashes. The Tester should retain both exported files and its report under a diagnostic folder, verify the visible bridge, river end and city adjacency, and compare the generated PNG with the WebP. Theoretical one-surface RGBA is 13,305,600 bytes; this is not product peak memory or mobile evidence.

For a later, separately authorized runtime export, the render report must bind the contract fingerprint, 192 px/2400×1386/quality 0.85 parameters, unchanged source hashes, actual PNG original hash, actual WebP hash and bytes, and an independent visible image review. Only then may a mission-specific manifest and image be added. No general loader change or other mission follows from this preparation.
