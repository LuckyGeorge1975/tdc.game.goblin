# Terrain bake feasibility probe (`goblin-nbg.10.1`)

This directory is an isolated experiment. The game never imports these files. The existing field renderer remains the product renderer and fallback. No terrain rules, scenario data, save data, undo, replay, or random gameplay state are changed.

## Fixed inputs

- Runtime base: `ea7e75f399e5873c18f62c6828a4ed622f579b37`; real level `assets/unit-art/levels/showcase-levels.json`, `showcase-terrain-course`, `FIELD_TEST_LEGACY_v1`.
- Content repository `main`: `c01ecb80bcdd813772d1433d9ae63b39e54ef050`, checked on 22 October 2026 at 10:12:30.9769577 UTC. Read the repository root README, export index, main design index, and complete map handoff at this commit.
- The input ZIPs are made with `tools/content-source.ps1 -Action Export` for `design-exports/uebergabe-karte/icons-terrain` (SHA-256 `7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a`) and `design-exports/uebergabe-karte/karte-generator.html` (SHA-256 `0236c88dc8656dfdd8a799164621576fb151e90f866941d699ad6622613e11f2`). They stay in the project-local source cache. The external Content checkout is read only.

At the handoff freshness check (22 October 2026, 10:21:12.3535767 UTC), `main` was `2fdce6ac1be30e8b2a360250b37724586469e71c`. The design files had moved under `beratung-ui-ux/`: the map handoff, export index, generator HTML, manifest, and all 35 PNG masters were byte-identical to the pinned inputs. The main design index changed only its repository/path guidance; its map criteria did not change. This partial probe deliberately retains the original pin and records this comparison, without silently mixing source versions.

## Data result

`probe.py` validates all 96 real cells and records their canonical type, six odd-row neighbors, forest opening mask, road/river connection sides, and deterministic urban variant. The separate `render-only-test-card` has visual road and river metadata over other terrain and six explicit urban variants; it is **not** a playable level or a new rule model. A fingerprint includes the data, profile, visual version, source commit, source bytes, generator HTML hash, adapter hash, and tile width. The exact report is in `RESULTS.json`; complete cell manifests are regenerated in the isolated output directory.

The real course has four road cells, four river cells, one bridge at `(6,3)`, one forest cell with directly supplied mask `63`, and one urban cell. The bridge connects road sides `E/W` (indices `0/3`) and river sides `SW/NW` (`2/4`). The test card needs forest masks `50`, `55`, and `60`, absent as direct masters. No master was rotated or mirrored.

The 35 existing PNG masters occupy 3,458,216 bytes in the source archive. A 12×8 canvas is expected to be 2400×1386 at 192 px per hex or 3200×1848 at 256 px per hex; one decoded RGBA surface requires 13,305,600 or 23,654,400 bytes. These are **input bytes and theoretical surface sizes**, not baked PNG/WebP sizes, browser peak memory, load time, or visual acceptance. The data report was generated twice byte-identically (SHA-256 `6e7c3ac61f15856aaa4361e072f66b1846aa72e687220837ab9c4c038899a6a9`). The isolated gate rejects missing and wrong fingerprints and accepts only the exact expected fingerprint; no game-renderer fallback was exercised.

## Prepared generator harness for a later tester assignment

`level4.mjs` invokes `cdp.mjs`, which starts a new Edge instance and profile. Neither script was run. `prepare.py` instead copies only the pinned `karte-generator.html`, the one validated level, and `harness.html` into `.tools/diagnose-nbg-10-1/harness`. The generator HTML was checked for automatic render calls, network requests, WebSockets, and external script references. `serve.mjs` can serve just those three files on `127.0.0.1:4183`; it does not launch a browser. The page waits for a click before calling the delivered `renderLevel` at 192 or 256 px. It exposes `window.mapBakeProbe.render(width)` and reports render time, output dimensions, PNG/WebP bytes and hashes, one WebP decode time, and theoretical decoded surface bytes. The generated files remain in memory until a tester explicitly downloads them. Browser cache, cold/warm network load, mobile hardware, and peak memory need separate controlled measurement.

After a separate tester assignment, prepare and inspect the cache:

```powershell
$python = 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python tdc.game.ogre-release-integration\probes\map-bake\prepare.py .tools\content-source\c01ecb80bcdd813772d1433d9ae63b39e54ef050-546603a4abe547e1b4182b8eb21efab7.zip tdc.game.ogre-release-integration\assets\unit-art\levels\showcase-levels.json .tools\diagnose-nbg-10-1\harness
& $python tdc.game.ogre-release-integration\probes\map-bake\probe.py tdc.game.ogre-release-integration\assets\unit-art\levels\showcase-levels.json .tools\content-source\c01ecb80bcdd813772d1433d9ae63b39e54ef050-57bb51c4dfd348008d8210448fe4b65d.zip .tools\diagnose-nbg-10-1\harness\generator.html .tools\diagnose-nbg-10-1\data
node tdc.game.ogre-release-integration\probes\map-bake\serve.mjs .tools\diagnose-nbg-10-1\harness 4183
```

Only a specifically assigned tester should open that local page in the **existing** `goblin-local` browser. No new browser or profile is needed. The harness has not yet rendered an image or been browser-tested. Before any QA handoff, refresh Content `main` once and compare the relevant upstream paths with the pinned commit; a changed path needs Coordination's scope decision.

The supplied terrain PNGs are interior/reference tiles. A discarded local Pillow composite visibly had hex seams and uncarved road/river lines, so it is not a bake result or a quality measure. The actual generator and the render-only card's missing masks remain for the next controlled render step. No D1 or `goblin-nbg.10.1` PASS is claimed.
