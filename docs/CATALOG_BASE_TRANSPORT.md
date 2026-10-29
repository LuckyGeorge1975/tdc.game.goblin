# Catalogue base: transport, infantry and GEV

Internal product profile `CATALOG_BASE_TRANSPORT_v1`, data `catalog-approved-data-v1`.
This is the approved A/B slice. `FULL_CATALOG_v1` remains inactive. There is no public save/import or intermediate release.

## Play

Select **Transport Line** or **River Maneuvers** in the normal mission menu and start through the briefing. Destroy the enemy Command Core and retain at least one friendly unit. Losing all friendly units takes priority over simultaneous core destruction.

Transport Line starts with one Artillery Drone aboard a Skimmer Carrier and a separate empty carrier next to infantry. Select the drone carrier, then an empty adjacent land hex, then **Deploy drone**. This spends the carrier's main movement; its GEV maneuver remains. The same drone can fire from the next friendly turn. Load infantry by selecting its counter and the adjacent carrier; capacity is its current SP, up to three. Infantry loading/unloading preserves the carrier's main movement state. Infantry can fire aboard. The friendly roster permits selecting each passenger separately.

River Maneuvers exposes all four GEV classes and amphibious infantry. The actual terrain path costs count: U02/U12 have 3 + 2, U10/U11 have 4 + 3. U26 can hover over water but has M2 and no second maneuver. U04/U15 have explicitly assigned SP1–3 with A=D=current SP; fixed infantry U17/U22 retain A/D after a D result. U06/U11's half-unit weight is deployment metadata only.

Both missions retain normal enemy turns, CRT, cover, strict supercover LOS, phase transitions, restart, Undo and presentation. A drone has HP2/A2/R8/D1/M0 and costs all three cargo slots. No mixed infantry/drone cargo, indirect fire, aboard drone fire or aboard spotting. Load/deploy requires the carrier's available main movement and spends drone movement/fire. No same-turn reload after deployment. Only land/bridge deployment, including all difficult land types. D disables conventional vehicles; a second D or X destroys them. Carrier and passengers receive one shared roll with separate ratios; mechanical cargo dies with its carrier, while surviving infantry retains the existing emergency exit.

## Scope and provenance

Supported classes: U02/U03/U04/U05/U06/U10/U11/U12/U14/U15/U17/U19/U22/U23/U24/U25/U26. Their records come directly from `assets/unit-art/rules/unit-profiles.catalog-approved.v1.json`. Canonical sorted JSON SHA256 is `71acac02581cf0709875bf4656418d493d21a40c5bc74ac4ffeff9b115b2e51a`. Raw adoption receipt SHA256 is `644e20c424d94a3ec7f5d942292f7a3ac10384b1604bfeb456c8b1917334096d`; normal Git line-ending normalization may change raw checkout bytes, never the canonical digest.

U01/U07/U08/U09/U13/U16/U18/U20/U21 are excluded from this profile until their complete special mechanics are connected. Existing Skimmer, Siege and Artillery pilot missions retain their own exact profiles. Existing legacy unit data is unchanged. No name-based stat or cargo fallback. System/component HP, engineering, stealth, missile hex fire and Forge bays are separate later packages.

Before a new session, the loader verifies the canonical data digest and exact fixed mission configuration. The session freezes its ID-bound class/rule map, cargo definitions, supported scope, full initial map/roster and data/mechanics/level/terrain/roster digests. Queries and dispatch share the same rules; rejects and previews consume no RNG. Undo stores all cargo/SP/readiness/budget flags and reuses the cached combat roll.

## Evidence and limits

Run `node --test tests/catalog-transport.test.mjs tests/catalog-transport-boundaries.test.mjs tests/catalog-transport-ui.test.mjs tests/catalog-product-trace.test.mjs tests/artillery-product-trace.test.mjs` from the checkout. The product traces use real UI query/dispatch, phase button handlers and scheduled enemy callbacks in the test harness, not an independent combat implementation. Four fixed seed-7 routes finish: Transport victory T4/defeat T22, Maneuver victory T3/defeat T10. Seeded route results are automated evidence, not native browser results; real dice can require adapting the targets and route.

`tests/fixtures/catalog-base-product-traces.v1.json.gz` contains the complete original JSON oracle compressed with Node's built-in gzip. It is internal test data, never loaded by the game. The replay compares the entire decoded state/history/RNG/M1/presentation/event envelope and rejects changed source, profile, map, roster, commands or effects. Source fingerprints use normalized LF.

The previous `artillery-product-traces.v1.json` is preserved unchanged. `artillery-source-compatibility.catalog-base.v1.json` explicitly records old/new source fingerprints and the two original trace digests. Its replay executes all original commands with the newly loaded guarded adapters and compares every original gameplay, RNG and presentation value; only the declared source provenance is normalized. Missing or stale compatibility proof fails.

Independent desktop QA on the fixed candidate remains required. No native, hardware, full-26 or public-release PASS follows from these automated checks. Keep the prior accepted local preview until coordination approves an atomic switch.
