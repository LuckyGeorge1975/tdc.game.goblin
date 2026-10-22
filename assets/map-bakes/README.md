# Pinned mission terrain bakes (`goblin-nbg.11`, `goblin-nbg.12.3`, `goblin-nbg.12.6`, `goblin-nbg.12.9`)

Only `showcase-terrain-course`, `showcase-specialists`, `atlas-proving-grounds`, `showcase-siege` and `los-supercover-showcase` can request bakes. `map-bake.js` fetches one manifest and 192 px WebP after its mission is selected. It checks the exact scenario/version/profile, 12×8 odd-row geometry, all canonical terrain cells, derived forest/road/river/urban visual values, complete source level, visual adapter version, pinned Content and generator/master hashes, export settings, manifest fingerprint, WebP SHA-256 and decoded dimensions. Atlas, Siege and Supercover also require the effective `field-test-atlas-v1` unit data profile from the active session. Siege uses the loader's `FIELD_TEST_LEGACY_v1` default; Supercover explicitly requires `FIELD_TEST_SUPERCOVER_v1` and `strict-supercover`. A failed check leaves the normal SVG field renderer in use. Mission switches abort pending requests and revoke the temporary verified image URL. The SVG hexes, grid, area previews, markers, units and effects stay live above the image. Game rules continue to read canonical terrain data.

The committed 541,444-byte WebP is SHA-256 `065b930e386665629efd0c96e7d41d9f9a0ebe91b596885101269e5c3d03abc1`, 2400×1386 px. It is the real-course `run-01-192.webp` independently rendered twice with identical hashes in `goblin-nbg.10.2`; the PNG source export is SHA-256 `c9c45e9828c87f140d39065b77ad53ae257e8f37f43d88adba7cd2ac8b65b60d`, 6,697,444 bytes. The generator's WebP export used quality 0.85. The 256 px candidate is not shipped. The pinned Content commit is `c01ecb80bcdd813772d1433d9ae63b39e54ef050`, generator HTML hash `47a2bbc446a89937d97ba39728896492ed1b2c0457ca16673f386b694f941385`, terrain master archive hash `7cb8cb6d28ba7c10ba862e06f25fec58ce29be6456c84a3fb52d3cb4ab0b353a`. A later Content path relocation was checked; the source content and current pin remained byte-identical by Coordination decision.

To reproduce the installed export from the retained independent render artifacts:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tdc.game.ogre-release-integration\probes\map-bake\export-runtime.py .tools\diagnose-nbg-10-2\result.json .tools\diagnose-nbg-10-2
```

The exporter verifies the pinned source report, runtime level, render report, image bytes and hash before writing the WebP and manifest. The original PNG and render files remain in the local diagnostic cache. The generator and private Content repository are absent from the game load path, build and Pages deployment.

## Specialists

The independent `goblin-nbg.12.2` render produced the committed 538,068-byte WebP, SHA-256 `4fb50c38bc308a3f5c08ba8b9d166376934a2a960844accc87a687b4126cc747`, at 2400×1386 px. Its unchanged PNG original is 6,656,954 bytes, SHA-256 `4569b09f28e04c767effe061c21ccd7cbf357c08acc057d30a4a7c8270c80a4d`, retained in the diagnostic cache. Both 192 px runs gave identical hashes. The source contract fingerprint is `8f2fb7de4ecb0e322adaf233b8b6c40ac41065fc1f60c7d9a6199ce359c74ca0`; the exact contract and render report SHA-256 values are pinned in `probes/map-bake/export-specialists.py`. The 96-cell contract records bridge `(6,3)` with road E/W and river only SW; city `(8,2)` adds no route from `(7,3)`. The export script verifies those pins, source level, report, PNG and WebP before installing only the Specialists files:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B tdc.game.ogre-release-integration\probes\map-bake\export-specialists.py .tools\diagnose-nbg-12-2\render-report.json .tools\diagnose-nbg-12-2\harness\contract.json .tools\diagnose-nbg-12-2\renders\run-2\showcase-specialists-192.webp .tools\diagnose-nbg-12-2\renders\run-2\showcase-specialists-192.png
```

That command refuses to overwrite an existing Specialists export. For a reproducibility check, direct the script's `OUTPUT` to a fresh project-local diagnostic folder and compare its two files byte for byte, as recorded in `.tools/diagnose-nbg-12-3/receipt.json`. The existing Terrain Course exporter and its installed image/manifest remain byte-identical.

## Atlas

The independent `goblin-nbg.12.5` render produced the 543,180-byte WebP, SHA-256 `ceec086c39fef8c85cda01f445e61c577ee2576579c861e1bad02a5a148b9114`, at 2400×1386 px. The PNG original is 6,723,844 bytes, SHA-256 `a4ff77758d36842c8ede2e6c1aec174b54c534e61b7b7aa274ad390fef54575b`, retained in the diagnostic cache. Two runs gave identical hashes. The source contract fingerprint is `612b1b8c29c68f973758d24739f78dd30efaef9028bcfb9efa97febf15e98bcb`; the exact contract and render report hashes are pinned in `probes/map-bake/export-atlas.py`. The 96-cell contract records bridge `(6,3)` with road only W and ridge E, the separate east road `(7–8,5)`, north river to water and an open south end. The exporter verifies source, effective profile, contract, report, PNG and WebP before installing only the Atlas WebP and manifest:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B tdc.game.ogre-release-integration\probes\map-bake\export-atlas.py .tools\diagnose-nbg-12-5\render-report.json .tools\diagnose-nbg-12-5\harness\contract.json .tools\diagnose-nbg-12-5\renders\run-2\atlas-proving-grounds-192.webp .tools\diagnose-nbg-12-5\renders\run-2\atlas-proving-grounds-192.png
```

The exporter refuses to overwrite an installed Atlas export. Course and Specialists images and manifests remain byte-identical. The generator and private Content repository are absent from the game load path, build and Pages deployment.

## Siege and Supercover

The independent `goblin-nbg.12.8` run produced two separate 2400×1386 WebPs from the pinned `goblin-nbg.12.7` contracts. Siege: 548,576 bytes, SHA-256 `b44d8b607cdcb4c4eae71a6a3c8c1aed197b716f7908e272c221dae3f95abdb4`; PNG original 6,639,160 bytes, SHA-256 `5c3d72414e366636a64366aa03e54ef9605cf2b02a048d36de5072db4c413b35`. Supercover: 540,976 bytes, SHA-256 `b886a662f9c878cd603dde3090866b679d6eb74510b84777322edceedd1c06a6`; PNG original 6,678,113 bytes, SHA-256 `749ec6be33aeeffb5dee54617f2d9e4e66749f410b175cf66f334670dd5db6cf`. Each mission repeated with identical PNG and WebP hashes; Supercover also has a documented third identical run. The original PNGs remain in the project-local diagnostic cache. Both maps have only their existing inner road caps, without a bridge, river or edge route.

The shared `probes/map-bake/export-roads.py` accepts only those two IDs and pins the verified receipt, each render report, contract, level, effective rule and unit data profile, PNG and WebP before writing its mission's image and manifest. It refuses to overwrite an existing export. Run from the project root with the approved run-2 artifacts:

```powershell
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B tdc.game.ogre-release-integration\probes\map-bake\export-roads.py showcase-siege .tools\diagnose-nbg-12-8\verified-render-receipt.json .tools\diagnose-nbg-12-8\siege\run-2\render-report.json .tools\diagnose-nbg-12-8\siege\contract.json .tools\diagnose-nbg-12-8\siege\run-2\showcase-siege-192.webp .tools\diagnose-nbg-12-8\siege\run-2\showcase-siege-192.png
& 'C:\Users\dwinkler\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B tdc.game.ogre-release-integration\probes\map-bake\export-roads.py los-supercover-showcase .tools\diagnose-nbg-12-8\verified-render-receipt.json .tools\diagnose-nbg-12-8\supercover\run-2\render-report.json .tools\diagnose-nbg-12-8\supercover\contract.json .tools\diagnose-nbg-12-8\supercover\run-2\los-supercover-showcase-192.webp .tools\diagnose-nbg-12-8\supercover\run-2\los-supercover-showcase-192.png
```

The three previously installed image/manifest pairs remain byte-identical. The generator and private Content repository are absent from the game load path, build and Pages deployment.

For independent product QA on the candidate commit, measure actual cold/warm transfer and decode, cache behavior, peak memory where instrumentation permits, and zoom legibility on desktop and a mobile viewport. The 13,305,600-byte decoded RGBA value is theoretical for one surface, not a measured peak. Check exact map alignment, hex selection, movement/fire/LOS previews, live unit/marker/effect layers, restart, BACK/undo, replay and switching among the five baked missions and to a non-baked mission. Confirm Supercover retains its separate live LOS profile. Test missing, corrupt and stale manifest/image in an isolated served candidate copy and verify the field renderer and canonical costs/cover/LOS remain correct. The generator render times are not product load times or a mobile PASS.
