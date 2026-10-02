# QA-06 – Unabhängiger Testbericht: integrierte Terrain-Vorschau

Stand: 2026-09-30 · Beads `goblin-qws.6` · lokaler Vergleichspfad `http://127.0.0.1:4173/src/app/compare.html?path=terrain` · BrowserAct 1.4.2, bestehender lokaler Chrome. Grundlage: `../docs/QA-05-TERRAIN-TESTMATRIX.md`. **Interner Teststand, kein Release.** Die Freigabe zum Test erfolgte nach der Nutzerbegutachtung des Zwischenstands und dem abgeschlossenen REVIEW-01.

## Ergebnis

Die integrierte Terrain-Vorschau besteht die geprüften Daten-, Stil-, Grid-, Picking-, Viewport- und Zustandsprüfungen. Die beiden Detail-Layer sind tatsächlich sichtbar. Bei x=900 verlaufen Straße, Fluss, Brücke und Details in zwei angrenzenden Viewports ohne messbaren Versatz. Ein weiterer Schnitt bei x=160 durch ein Unit-Hex zeigt lediglich einzelne Antialiasing-Pixel an der Clipkante. `core-v1` und `phase-v2` sowie die getrennten Legacy-Smokes blieben bedienbar. **Im ausgeführten Umfang kein neuer Produktfehler gefunden.** Die unten genannten offenen Matrixdetails schränken diese Bewertung ein.

## Testobjekt und Datenorakel

Die geprüfte `assets/terrain-map-study/portable/visual-map.json` hat SHA-256 `1C2FA850EA984357C17CEA2BC0E49FECA9BE8886C9CC1EDE484C29BB5198E027`, `schemaVersion: 1`, `mapId: terrain-study-02`, `detailSeed: 91`, Bounds 1440×960, Pointy-Top/Odd-Row und Radius 62. Sie enthält 29 stabile Features in sieben Layern; die sichtbaren Feature-IDs umfassen `road-west-east`, `river-main`, `bridge-main`, `lake-central`, vier `forest-*`-Flächen und zwei Höhenflächen mit Konturen. Die Styles liegen in `assets/terrain-map-study/portable/styles/verdant.json` und `dryland.json` (SHA-256 `8E50EE83C3DC985B0039ABF97DD2562AF1263DE24713C15C3D22ECDA129E219C` beziehungsweise `A42EF97B260E4CAC0C36A02BB726C2CE4C574BEED626FA130F9DA49EE83918C8`). Beide benutzen dieselbe VisualMap statt eigener Geometrie.

`node assets/terrain-map-study/portable/validate.mjs` meldete **29 stabile Features, 15 Kinds, 7 Layer, 2 austauschbare Sets**. Die vier integrierten SVG-Details wurden aus dem Hauptcheckout geladen. `ground-grain` enthält je Set 3400, `forest` 8200 Kreise; ihre `(cx,cy,r)`-Sequenzen sind zwischen `verdant` und `dryland` exakt gleich. Die Style-Pfade sind relativ zur Projektwurzel. Der Browser zeigte je zwei globale `<image>`-Layer mit Bounds `(0,0,1440,960)` und `pointer-events:none`; alle 96 unsichtbaren Hex-Pickflächen und vier Core-Einheiten blieben vorhanden.

## Soll-/Ist-Checkpoints

| Matrix | Soll | Beobachtung |
| --- | --- | --- |
| T-F01–F07 | Zusammenhängende Weltformen, korrekte Ebenen, keine Hexkachelung | In Vollansicht und Grid aus/an waren Hauptstraße, Fluss, Brücke bei `(896,576)`, See, Wald und Höhenkonturen als durchgehende Weltformen sichtbar. 29 Feature-Knoten lagen unter Picking/Grid/Units; dekorative Layer fingen keine Klicks ab. Die Straße, der Fluss und die Brücke erschienen in beiden x=900-Viewports mit identischen IDs und Geometrien. |
| T-X01–X04 | Beide globalen Detail-Layer sichtbar, lagegleich zwischen Styles und Splits | Browserbilder mit/ohne Detailbilder verglichen: ohne Korn änderten sich 3804, ohne Wald-Details 168112 Pixel um mehr als fünf RGB-Stufen. Asset-Geometrie 3400/8200 exakt lagegleich. Beide Viewports referenzierten dieselben 1440×960-Weltbilder; lokale Asset-Ladevorgänge hatten keinen Fehler. |
| T-V01–V02 | A `(0..900)` und B `(900..1440)` ergeben die Vollansicht | Für `verdant` und `dryland` enthielt der x=900-Split dieselben Straßen-/Fluss-/Brücken-Features beiderseits. Pixelvergleich der 1440×960-Aufnahmen: **0 Pixel** mit einer RGB-Kanaldifferenz >2, auch im zehn Pixel breiten Nahtstreifen. Visuell keine Lücke oder Doppelkontur. |
| T-V04 | Unit-Hex-Schnitt ohne Positionssprung | Zusätzlicher Split bei x=160: beide Viewports enthalten die vier Units mit denselben Weltkoordinaten; gegenüber der Vollansicht liegen nur 6 Pixel mit Kanaldifferenz >2 im zehn Pixel breiten Nahtstreifen, davon 2 >5, maximale Abweichung 8. Kein flächiger Spalt; Einheit bleibt am selben Weltpunkt. |
| T-U01–U03 | Grid und Picking liegen über Terrain, ohne Regeländerung | Grid aus: 0, an: 96 Grid-Polygone; 96 Pickflächen unverändert. Reale Browser-Picks unter Brücke `(896,576)` → Core-Zelle `(8,6)`, Wald `(1000,200)` → `(9,2)`, See `(730,300)` → `(6,3)` mit Core-Terrain `water`. Klick auf Spieler-Einheit `p-1` wählte genau diese Einheit samt Intel. Kein zusätzliches Event. |
| T-S01–S02 | Style/Grid ändern nur ViewState | `verdant→dryland` änderte Detailpfade und Palette, nicht die 29 Feature-Geometrien, 96 Pickpolygone, vier Unit-Polygone, Auswahl, Intel, Bereitschaft oder Eventzahl. Für `core-v1` und `phase-v2` blieben vollständiger serialisierbarer State, `queryAreas`, RNG (`725409` bzw. `5`) und Command-Zahl `0` bei Style-/Grid-Wechsel gleich. |
| T-D05, T-FB01 | Klassischer Hex-Fallback bleibt verfügbar | `compare.html?path=core` zeigte 96 Hexe ohne VisualMap. Auswahl von `p-1`, legaler Karten-Move und ein `UnitMoved`-Event funktionierten; `compare.html?path=phase` zeigte den getrennten Phasenpfad. |
| T-S03 / Regression | Festes Core-Orakel unverändert | `core-v1`-Referenz-Replay endete mit `winner: player`. Im aktuellen Browserlauf `phase-v2` stimmten **16/16 Commands und Ergebnisse**, 16/16 Folgezustände einschließlich abgelehnter Befehle und der Endzustand mit `expectedPhaseReplay` überein; UI am Ende `Enemy · movement phase`, Zug 2, 13 Eventzeilen. |

Die Sieben-Dateien-Testsuite `node --test tests/hex-renderer.test.mjs tests/hex-renderer-visual.test.mjs tests/app-terrain.test.mjs tests/core-game.test.mjs tests/core-phase.test.mjs tests/app-adapter.test.mjs tests/app-path-switch.test.mjs` bestand **31/31 Tests**. Die Browserbefunde wurden unabhängig davon erhoben.

### Getrennte Legacy-Smokes

Im aktuellen Vergleichspfad `?path=legacy` lud **FIELD TEST 0.1.12** IRON DUST mit 12×8 Karte und vier eigenen Einheiten. Der Unit Guide öffnete sich; SKIMMER SCOUT bewegte sich legal nach B-04, Bereitschaft `MOVE 4/4→3/4`, Combat Log dokumentierte die Bewegung. Die Phasen ließen sich über Bestätigungsdialoge bis zum Gegnerzug fortsetzen; danach war Runde 2 wieder in Movement bedienbar. Der Szenariowechsel zu ATLAS / PROVING GROUNDS wurde bestätigt; die 12×8 Karte und 18 eigene Einheiten luden. COMBAT SKIMMER bewegte sich legal nach E-04, `MOVE 16/18→15/18`, mit passendem Log. Die Folge Movement → Fire → Skimmer → Hostile → Movement/Runde 2 lief durch. **Neue Schuss-Smokes wurden in QA-06 nicht ausgeführt**; dafür liegt nur der unabhängige QA-04-Befund vor. `goblin-x4z` bleibt das bekannte, getrennte Overlay-Thema.

## Belege

- `qa-evidence/qa06-verdant-full.png`, `qa06-dryland-full.png`, `qa06-dryland-grid-on.png`: reale Terrain-UI mit Style- und Grid-Wechsel.
- `qa-evidence/qa06-verdant-full-world.png`, `qa06-verdant-split-x900.png`, `qa06-dryland-full-world.png`, `qa06-dryland-split-x900.png`, `qa06-verdant-split-x160.png`: identisch skalierte Voll-/Split-Renderings.
- `qa-evidence/qa06-dryland-without-details.png`, `qa06-dryland-without-grain.png`, `qa06-dryland-without-forest.png`: isolierte Sichtbarkeitsprobe der Detail-Layer in einem temporären Browser-Test-DOM; keine Quelldatei wurde dafür geändert.

## Grenzen und Übergabe

Die Matrixfälle T-D02 (vollständige, geometrisch exakte Stroke-/Shadow-Bounds aller 29 Features), T-D04 (alle vier numerischen Odd-Row-Vertragsvektoren), T-V03 (explizit umgekehrte Renderreihenfolge), T-U02 (beide Seiten jeder gewählten Hexgrenze und exakter Tie-Break), T-U03 (Pick-Callback-Anzahl in allen Overlay-Kombinationen) sowie T-S03 (zweimaliger vollständiger Replay *pro Stil* und Viewport) wurden nicht jeweils als separate Browserfälle durchgespielt. Die fokussierten Validator-/Renderer-Tests, DOM-Geometrieprüfungen und die genannten realen Picks liefern hierfür Teilabdeckung. Insbesondere ist eine exakt auf der Hexkante geltende Tie-Break-Regel noch nicht dokumentiert. Die Legacy-Smokes prüfen Bedienbarkeit, nicht die vollständigen Szenarioziele oder einen neuen Schussverlauf.

**QA-Bewertung:** Für die integrierte Terrain-Zwischenversion ist im geprüften Umfang kein Defekt oder Regelzustandsdrift erkennbar. Die Architekturkoordination kann die verbleibenden Matrixdetails gegen den Umfang von INT-03 bewerten. Keine Release-, Push- oder Git-Aktion wurde ausgeführt.
