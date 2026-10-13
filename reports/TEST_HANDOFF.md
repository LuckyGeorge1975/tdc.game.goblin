# Developer → Tester Handoff

Dieses Dokument definiert die verbindliche Übergabe jedes GitHub-Pages-Builds.

## Build 0.1.23 · lokaler PNG-Kandidat, zur diagnostischen Veröffentlichung freigegeben

| Feld | Wert |
|---|---|
| Version | `0.1.23` |
| Build | `23` |
| Veröffentlichte Basis | `v0.1.22` auf `dc7d068b1b14043962a7e296620020e2567760a3` |
| Lokaler Runtime-Kandidat | `09b1b703d02eec11010c9ada56159a92e698fcc6` (`goblin-gp7`); der lokale Paket-Commit ist im Issue dokumentiert |
| Geprüftes lokales Paket | `6f7e30b6470574b4c9d59f23ccd89fea1ab7d7e9`; nachfolgendes Freigabe-Dokudelta im Issue |
| Kanonische Unit-Art-Quelle | Content-06-PNGs ab `2fd8ae9`; 130/130 SHA-256-identisch zur Runtime |
| Datum des Kandidatenpakets | 2026-10-13 |
| Nutzerfreigabe | 13.10.2026 im Koordinations-Chat ausdrücklich für die diagnostische Veröffentlichung von 0.1.23 erteilt (`goblin-gp7`) |
| Pages-Einstieg nach Deploy zu prüfen | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.23> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0123---2026-10-13) |

Sets 01–05 verwenden 130 transparente 256 × 256-RGBA-PNGs für Karte, Liste und Auswahl; Set 06 bleibt bei SVG. Die bisherigen SVGs bleiben im Repository, Guide und Terrain unverändert. Die zusätzliche rohe Assetmenge beträgt 1.416.801 Bytes (1,35 MiB). Der Skript-Cacheparameter für `unit-visuals.js` wurde angehoben und der lokale Server liefert `image/png`. Die Rasterdateien umgehen die interne SVG-Darstellung als technische Hypothese zum auf Android weiter sichtbaren Verlust heller Innenflächen. Auf `09b1b70` bestanden 375/375 Node-Tests, 130/130 Quellen-Hashes und Staging-Preflight. Auf Metadaten-Commit `5e596eb` bestanden der Release-Verifier gegen `v0.1.22` und erneut 375/375 Node-Tests; der direkte Folgecommit `6f7e30b` korrigierte nur eine Handoff-Zeile und bestand den gezielten Diff-Check sowie den Release-Verifier. Die unabhängige Regression bestätigte 375/375 Tests und den Verifier auf `5e596eb`. Die unabhängige Desktop-Bedien-QA auf `09b1b70` bestätigte Legacy und IRON DUST v2 für Sets 02/04/05 mit geladenen, gefüllten PNGs in Karte, Liste und Auswahl; Set 06 und Guide blieben unverändert. Der finale lokale Browser-Smoke auf `6f7e30b` zeigte FIELD TEST 0.1.23, sieben Set-04-Karten-PNGs mit HTTP 200 `image/png` und gefüllte Innenformen. Belege: `.tools/qa-gp7-09b-legacy-02.png`, `-legacy-04.png`, `-legacy-05.png`, `-v2-02.png`, `-v2-04.png`, `-v2-05.png` sowie `.tools/qa-gp7-final-6f7-legacy-04.png` (`goblin-gp7`). Die Motive wirken wegen transparenter Ränder schmaler als die enger zugeschnittenen SVGs; eine vollständige Console-Fehlerfreiheit wurde im engen finalen Smoke nicht behauptet. Content und Legal fanden für das geprüfte Delta keine neue Quelle oder Rechtehürde innerhalb der begrenzten nichtkommerziellen Vorschau. Die Nutzerfreigabe für die diagnostische Veröffentlichung liegt vor. Der echte Android-A/B-Nachtest ist weiterhin offen; Push, Tag, Deploy und der öffentliche Pages-Einstieg müssen nach diesem Dokumentationscommit erst ausgeführt und geprüft werden. Bis dahin bleibt `v0.1.22` öffentlich verfügbar und `v0.1.21` älterer Rückfallpunkt ([Notices](../docs/CONTENT-NOTICES.md)).

## Build 0.1.22 · veröffentlicht, Android-Defekt weiter offen

| Feld | Wert |
|---|---|
| Version | `0.1.22` |
| Build | `22` |
| Veröffentlichte Basis | `v0.1.21` auf `00070606d6f5a4155cccff56a4b6daadb68997b5` |
| Runtime-Fix | `c0fd78bfd2f84b7061669beeb8578ecb49803e62` auf `codex/icon-set-v2-repair` (`goblin-gp7`) |
| Lokal geprüfter Release-Kandidat | `5ad348103434ab4342e2ecff34534922fb32f294` |
| Veröffentlichter Commit und Tag | `dc7d068b1b14043962a7e296620020e2567760a3` · `v0.1.22` (`goblin-gp7`) |
| Kanonische Unit-Art-Quelle | `da9095b6592d592bc38229f283bc486d9b363e33`; 26 SVGs nach Zeilenende-Normalisierung bytegleich zur Runtime |
| Datum des Kandidatenpakets | 2026-10-13 |
| Öffentlich geprüfter Pages-Einstieg | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.22> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0122---2026-10-13) |

Die 26 Set-04-Karten- und Listenicons enthalten die vorhandenen SVG-Farb-, Kontur- und Schriftwerte zusätzlich als Präsentationsattribute. Geometrie, Filter, Palette, Guide-Bilder, andere Sets, Regeln und Layout sind gegenüber 0.1.21 unverändert. Der Fallback richtete sich gegen fast schwarze Icon-Innenflächen im Android-Screenshot des Nutzers. Der Android-Nachtest nach Veröffentlichung zeigte den Defekt weiterhin.

Auf dem Runtime-Fix `c0fd78b` bestanden die strukturelle SVG-Prüfung, 33/33 fokussierte Node-Tests sowie eine begrenzte unabhängige Bedienprüfung in Desktop-Chrome und emulierter Mobilansicht mit Legacy-Bewegungsreichweite und 2,5-fachem Zoom (`goblin-gp7`). Dort waren die Innenflächen der vier betroffenen Einheiten sichtbar; das alte Android-Verhalten wurde in der Emulation nicht reproduziert. Auf dem lokalen Release-Kandidaten `5ad3481` bestanden die vollständige Node-Suite (375/375), der Release-Verifier gegen `v0.1.21`, die unabhängige fokussierte Regression (33/33) und die lokale Browser-/Bedien-QA für Build-22-Einstieg, Set-04-Karte/Leiste/Auswahl in v2 und die Legacy-Mobil-Emulation. Belege: `.tools/qa-gp7-5ad-v2-desktop-04.png`, `.tools/qa-gp7-5ad-legacy-mobile-04.png` und der auf unveränderten Assets beruhende Zoombeleg `.tools/qa-gp7-c0fd-legacy-mobile-pinch04-units.png`. Content bestätigte die Parität zur kanonischen Quelle; die begrenzte Legal-Deltaprüfung fand keine neue Provenienz- oder Rechtehürde für die bisherige nichtkommerzielle Vorschau. Build 0.1.22 wurde nach gesonderter Nutzerfreigabe auf `dc7d068` veröffentlicht und öffentlich geprüft (`goblin-gp7`). Der anschließende Test auf dem betroffenen Android-Gerät zeigte weiterhin fehlende helle Innenflächen; `v0.1.21` bleibt älterer Rückfallpunkt.

## Build 0.1.21 · veröffentlicht

| Feld | Wert |
|---|---|
| Version | `0.1.21` |
| Build | `21` |
| Veröffentlichte Basis | `v0.1.20` auf `febdfe2c5b9950a6828a69c75783ce2b4f2f14e2` |
| Geprüfter Asset- und Runtime-Stand | `8133906778acdd1a1df1ee1ed69cd6a01114aa67` auf `codex/icon-set-v2-repair` (v2-Anbindung `eefda4f`, Assetquelle `2fd8ae9`) |
| Veröffentlichter Commit und Tag | `00070606d6f5a4155cccff56a4b6daadb68997b5` · `v0.1.21` (`goblin-dfs`) |
| Datum des 0.1.21-Kandidaten | 2026-10-12; Asset-Nachtrag und QA 2026-10-13 |
| Öffentlich geprüfter Pages-Einstieg | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.21> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0121---2026-10-12) |

Der Fix bindet die sechs Grafiksets in IRON DUST v2 an Einheitenliste und Auswahl an; der Setwechsel verändert den Spielzustand nicht. Zusätzlich wurden 130 bestehende Icon-SVGs der Sets 01–05 (je 26) aus dem projektinternen Unit-Art-Commit `2fd8ae9` übernommen: engerer transparenter Ausschnitt und helle Kontur aus der jeweiligen Setpalette verbessern die Lesbarkeit in Legacy und v2. Quell-PNG-Vorschauen wurden nicht in den Runtime-Stand übernommen; Guide-Bilder und Set 06 bleiben unverändert. Regeln, Layout und sonstige Runtime-Logik sind gegenüber dem vorigen Kandidaten unverändert.

Auf der festen Asset-/Runtime-SHA `8133906` bestanden die unabhängige Regression mit 38/38 fokussierten Tests und Release-Verifier sowie die Browser-/Bedien-QA im begrenzten Assetumfang: alle sechs Sets in Legacy und v2, 130 SVGs mit HTTP 200 und ohne Parserfehler, Setwechsel in Karte und Liste sowie v2-Auswahl, Desktop und emulierter Mobilansicht. Es gab keinen Test auf realer Hardware. Die Legal-Einschätzung ist für eine nichtkommerzielle Vorschau bedingt positiv und erweitert keine Rechtefreigabe ([Notices](../docs/CONTENT-NOTICES.md)). Build 0.1.21 wurde anschließend unter `v0.1.21` auf `00070606d6f5a4155cccff56a4b6daadb68997b5` veröffentlicht und öffentlich geprüft (`goblin-dfs`). `v0.1.20` bleibt der vorherige Rückfallpunkt; der spätere Android-Sichtbefund gehört zu `goblin-gp7`.

## Build 0.1.20 · veröffentlicht

| Feld | Wert |
|---|---|
| Version | `0.1.20` |
| Build | `20` |
| Basis | Öffentlich geprüftes `v0.1.19` auf `81692a727fe4b9121865ae552c5183763a7a1302` |
| Eingebrachter v2-Ausgangsstand | `9ca56b71ebf52c1fd63ecccf76470835a4f24565`; Integration `goblin-nuu.2` |
| Unabhängig geprüfter Produktstand | `5d54a4d5ae6ee8375c446303c1c2f895d9c7f68e` auf `codex/release-integration-020` |
| Regression | Vollständige Suite und Release-Verifier auf `e4930e7`, gezielter Text-Delta-Retest samt voller Suite auf `5d54a4d` (`goblin-nuu.3`, `.7`) |
| Lokale Browser-/Bedien-QA | Sieg, Niederlage, Desktop/Mobil und vier Sprachen auf `e4930e7`; Quick-Start-Delta in vier Sprachen auf `5d54a4d` (`goblin-nuu.4`, `.7`) |
| Content / Legal | Geprüftes Delta auf `5d54a4d`; begrenzte Empfehlung für nichtkommerzielle öffentliche Vorschau (`goblin-nuu.5`, [Notices](../docs/CONTENT-NOTICES.md)) |
| Datum des Kandidatenstands | 2026-10-12 |
| Veröffentlichter Pages-Einstieg | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.20> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0120---2026-10-09) |

Die Integration erhält die öffentliche Supercover-Mission und die acht Legacy-Missionen samt veröffentlichten Daten, Content-Notices und Rückfallstand. IRON DUST v2 ist im normalen Level-Menü ohne Testflag auswählbar; die lokale QA prüfte beide Terminalpfade, Desktop/Mobil, Legacy, Supercover und die vier v2-Sprachansichten. Seed 8 führt über normale UI-Aktionen zum Sieg; `?iron-dust-v2-seed=2` ermöglicht den reproduzierbaren Niederlagepfad ausschließlich auf `localhost` oder `127.0.0.1`. Neue v2-Anzeigen und der Live-Status im Unit Guide verwenden die vier Sprachkataloge; historische Katalogeinträge des Unit Guide wurden nicht übersetzt. Der neue Quick Start nennt den Kommandopanzer in vier Sprachen (`goblin-nuu.7`). Die Content-/Legal-Empfehlung galt nur für das geprüfte Delta und die begrenzte nichtkommerzielle Vorschau, nicht für umfassende Rechte. Build 0.1.20 wurde unter `v0.1.20` auf Commit `febdfe2c5b9950a6828a69c75783ce2b4f2f14e2` veröffentlicht (`goblin-nuu`); der nach Veröffentlichung gemeldete Icon-Sichtbefund wird in `goblin-dfs` bearbeitet. `v0.1.19` bleibt der ältere geprüfte Rückfallpunkt.

## Build 0.1.19 · lokaler Kandidat

| Feld | Wert |
|---|---|
| Version | `0.1.19` |
| Build | `19` |
| Basis | Veröffentlichter Commit `3eeaaa542f6e1adaaf4114d1c026bca07ef0e635` (`v0.1.18`) |
| Geprüfter Produktstand | `c1c18ce13a239a8257facbd1434e04bb10b82172`; unabhängige Regression 144/144 Node-Tests und Validatoren bestanden (`goblin-9bj.28.1`) |
| Datum | 2026-10-08 |
| Pages-Einstieg nach Freigabe | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.19> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0119---2026-10-08) |

Sichtbare Änderung: ein zusätzliches `FIELD_TEST_SUPERCOVER_v1`-Showcase mit eigener Szenarioversion und festem Terrain/Roster. Die Sichtlinie berücksichtigt dort jedes berührte Zwischenhex, auch an Grenzkanten. Vorschau, Spieler- und Gegnerfeuer verwenden denselben strengen Pfad. Die acht historischen `FIELD_TEST_LEGACY_v1`-Missionen und ihre Replays bleiben unverändert. Spielskripte und Stile liegen nun unter `src/legacy/`; der Root-Einstieg bleibt erhalten. Keine neuen Grafiken, Icons oder UX-Layouts. Vollkatalog-Regeln und Gegner-KI sind nicht Teil dieses Builds.

Die unabhängige Regression auf dem Produktstand ist bestanden (`goblin-9bj.28.1`). Browser-/Bedien- und Release-QA auf dem finalen Metadatenstand sowie Content-/Legal-Deltaprüfung und Pages-Deploy bleiben gesonderte Gates in `goblin-4qk`. Bis zu einer geprüften Veröffentlichung bleibt `v0.1.18` öffentlich verfügbar und Rückfallpunkt. Tag, Push und Deploy erfolgen erst nach diesen Gates durch Koordination; den öffentlichen Einstieg anschließend prüfen.

## Build 0.1.18 · Veröffentlichung vorbereitet

| Feld | Wert |
|---|---|
| Version | `0.1.18` |
| Build | `18` |
| Basis | Veröffentlichter Commit `5c7ed3eb537eabd22e673f588fc8cbe0f17a38e9` (`v0.1.17`) |
| Geprüfter Produktstand | Commit `4d3168681de76da3f2db783e0ed96524ef71a391`; Regression `goblin-rfe.2`, Bedien-/Release-QA `goblin-rfe.3`, Content-/Legal-Delta `goblin-rfe.4` |
| Datum | 2026-10-06 |
| Pages-Einstieg nach Freigabe | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.18> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0118---2026-10-06) |

Sichtbare Änderung: `ICON SET` zeichnet beim Wechsel die bereits vorhandenen Motive für Karte, Truppenliste, Auswahl und Unit Guide neu. Die laufende Mission wird dabei nicht zurückgesetzt; die Stilwahl bleibt im Browser gespeichert. Keine neuen Bilder, Regeln, Level oder Layouts. `v0.1.17` bleibt bis zur Veröffentlichung von 0.1.18 öffentlich verfügbar, `v0.1.16` ist der ältere Rückfallpunkt.

### Prüfbelege und verbleibende Release-Schritte für 0.1.18

- Auf Produktcommit `4d316868` bestanden 137/137 Node-Tests und die unabhängige Regression (`goblin-rfe.2`). Spielzustand, Runde/Phase, HP, Befehls-/Undo-Stand und Auswahl blieben beim Wechsel aller sechs Sets erhalten.
- Die unabhängige Browser-/Release-QA prüfte Desktop, emuliertes Mobilgerät und Querformat, Karte/Liste/Auswahl/Guide, Persistenz, offenen Dialog und den lokalen Pages-Pfad (`goblin-rfe.3`). Das Release-Gate `node scripts/verify-release.mjs --previous=v0.1.17` bestand dort.
- Das unveränderte Asset-Delta und die Grenzen der nichtkommerziellen Vorschau wurden von Content und Legal geprüft (`goblin-rfe.4`). Diese Prüfung erweitert keine Bildrechte und gibt nicht das vollständige Spiel frei.
- Die unabhängige Delta-Nachprüfung zu Commit `0cba9f8` ist in `goblin-rfe` belegt. Tag, Push und Pages-Deploy erfolgen erst nach allen Gates durch Koordination; den öffentlichen Einstieg anschließend prüfen und in `goblin-rfe` dokumentieren.

## Build 0.1.17

| Feld | Wert |
|---|---|
| Version | `0.1.17` |
| Build | `17` |
| Basis | Veröffentlichter Commit `ff3bcc448f2580035aad2b6cea0681434d98617a` (`v0.1.16`) |
| Deploy-Commit und Tag | Nach Veröffentlichung `v0.1.17` am tatsächlich bereitgestellten Commit; Nachweis in `goblin-hr7` |
| Datum | 2026-10-03 |
| Pages-Einstieg zur Prüfung | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.17> |
| Änderungen | [CHANGELOG.md](../CHANGELOG.md#0117---2026-10-03) |

Build 0.1.17 ersetzt die 130 großen Runtime-PNGs der fünf grafischen Guide-Stile durch 1024 × 683 WebP mit optimiertem 768 × 512-PNG-Fallback. `v0.1.16` bleibt Rückfallpunkt. Prüffokus: 130/130 Quellen- und Assetpfade, transparente Kanten und Pixel-Stil auf hell/dunkel, Browserauswahl ohne Doppel-Download, Fallback bei nicht unterstütztem WebP, Desktop/Mobil-Layout sowie Military und Karten-/Listenicons unverändert. Release-Gate, unabhängige Regression und Browser-QA, Content-/Legal-Grenzen, Pages-Einstiegsprüfung und eindeutiges Tag am Deploy-Commit sind in `goblin-hr7` nachzuweisen. Die Nutzerfreigabe für diesen Release-Auftrag liegt dort vor.

### Testfokus für 0.1.16

- In allen fünf grafischen `ICON SET`-Stilen für alle 26 Guide-Einträge die jeweilige Content-08-PNG-Ansicht prüfen: richtige Einheit, Stil, vollständige Silhouette, transparenter Hintergrund und kein Beschnitt. Testbasis: 130/130 kopierte PNGs sind SHA-256-identisch zum Content-Quellcommit `10131dc16ede760f2338b6605e10675f0cd81d29`.
- Karte, Truppenliste, Auswahl und Transport zeigen weiterhin die kleinen SVG-Icons des gewählten Stils. Military nutzt getrennte SVG-Dateien für Icon und Guide mit demselben Symbolmotiv. Stilwechsel, gespeicherte Wahl und Szenario-Neustart/Bestätigung prüfen.
- Guide auf Desktop und emulierten Mobilgrößen 390 × 844, 320 × 568 sowie Querformat bedienen: großes Bild vollständig sichtbar, Mini-Map, General-Text, Navigation, „Werte & Randnotiz“ und „Auf Karte“ nutzbar. Vier lokale Screenshot-Belege liegen unter `qa-evidence/bvh-guide-*.png`; sie ersetzen keine unabhängige QA.
- Content Notice v8 gegen die eingebundenen 130 PNGs prüfen: KI-Ursprung, interne Content-05-Tafeln als Stilvorlagen, Neuinterpretation statt Crops, menschliche Prüfung, mögliche Nicht-Einzigartigkeit und begrenzte nichtkommerzielle Asset-Einschätzung. Produkt-/Marken-/Regel- und kommerzielle Freigabe bleiben gesondert.
- Die 0.1.15-Spiel- und Release-Regression nach Bedarf wiederholen. Auf dem Content-08-Integrationscommit bestanden 137/137 Node-Tests und die lokale Browserprobe aller sechs Stile ohne Lade- oder Laufzeitfehler (`goblin-bvh`). Die unabhängige Prüfung muss den finalen Kandidatencommit nennen.

Build `v0.1.16` wurde auf `ff3bcc448f2580035aad2b6cea0681434d98617a` veröffentlicht; `v0.1.15` war sein Rückfallpunkt. Build 0.1.17 enthält die kleinere Bild-Payload. Der Stand seines Deployments steht in `goblin-hr7`.

### Vorheriger Testfokus für 0.1.15

- Auf dem exakten Kandidatencommit die vier neuen Showcases K/U1/U2/U3 auswählen, starten und Ziele, Einheiten, Terrain sowie Sieg-/Niederlage-Enden prüfen. Bei simultaner vollständiger Ausschaltung gilt Niederlage; IRON DUST behält sein Kern-Siegziel bei überlebendem Spieler.
- Kleine Karten-/Listenicons und getrennte dreiviertelperspektivische große Guide-Ansichten in allen sechs Stilen prüfen. Der Stilwechsel darf keine Regeln oder Missionsdaten verändern.
- Mobile 390 × 844, 320 × 568 und Querformat: Karte direkt sichtbar, Truppe und Intel/Log erreichbar, Hauptaktion nutzbar, „Auf Karte“ zeigt und fokussiert die gewählte Einheit. Desktop-Layout und DE/FR besonders prüfen.
- Artillery Drone in U3: Live-MOVE 2 und passende Aktionen in DE/EN/ES/FR; ohne Live-Einheit ist die stationäre Katalogregel MOVE 0 als geplantes Ziel gekennzeichnet.
- Odd-row-Reichweite: Auf geraden und ungeraden Zeilen echte Nachbarn für Feuer sowie Ein-/Aussteigen prüfen und scheinbare Diagonalnachbarn ablehnen. In `UNIT TRIAL` den einmaligen Raketenwerfer mit einem Ziel genau in Reichweite 8 und einem Ziel in Distanz 9 prüfen; Splash und Friendly Fire dürfen nur tatsächliche Nachbarfelder des Ziels betreffen.
- Die historische Sichtlinien-Pixelabtastung ist von dieser Reichweitenkorrektur getrennt und bleibt bis zur Entscheidung `goblin-9bj.27` bestehen. Die zuvor auf `1cf3861` bestandenen Browserprüfungen ersetzen keine vollständige unabhängige QA auf dem neuen Kandidatencommit.
- Historische Legacy-Field-Test-Werte von den noch nicht vollständig implementierten Katalogwerten und Sonderregeln trennen. Echte Geräte-Fingerproben (`goblin-wtg`) sind weiterhin offen.

Der veröffentlichte Build 0.1.15 ist `v0.1.15` auf Commit `f40ddfb9a8ba86b3409960f6ab3a1332340678c8`; `v0.1.14` auf `750941134f610ba7a75bbb11d8011e5714139e21` und `v0.1.12` bleiben ältere Rückfallpunkte. Die vollständige unabhängige Regel- und Browser-QA auf dem Spielstand `279a16d` steht in `goblin-0lk`; der folgende Commit `f40ddfb` änderte nur Workflow und Dokumentation. Der erste Actions-Lauf scheiterte am Vergleich mit einem unveröffentlichten Build-15-Commit. Der korrigierte [Pages-Lauf 37005851568](https://github.com/LuckyGeorge1975/tdc.game.goblin/actions/runs/37005851568) bestand; Tag und öffentlicher Einstieg wurden geprüft (`goblin-8ay`). Die vom Nutzer bemängelte Differenz zwischen generierten Guide-SVGs und den hochwertigen Content-Konzeptansichten wurde lokal in `goblin-bvh` behoben. Build 0.1.15 gilt deshalb grafisch nicht als abgenommen.

### Vorheriger Testfokus für 0.1.14

- Alle sechs `ICON SET`-Stile mit je 26 kleinen Karten-/Listenicons und 26 großen Unit-Guide-Ansichten prüfen. Der Wechsel muss beide Ansichten gemeinsam ändern; Technische Illustration ist nach leerem Browser-Stilspeicher anfänglich gewählt.
- Militärisches Set: kleine Kartensymbole und vollständig sichtbare rechteckige 1024 × 768-Ansichten im Guide. Auf Desktop sowie bei 390 × 844 und 320 × 568 px dürfen weder Symbol noch Kopfzeile beschnitten werden; die letzte Aktion bleibt durch Scrollen erreichbar.
- Szenariowechsel, Guide-Navigation, Rückwechsel zu grafischen Stilen, Terrain-/Logo-Fallback und gespeicherte Stilwahl auf fehlende Assets oder unbeabsichtigte Spielbefehle prüfen. Bei `UNIT TRIAL` beendet der Kern allein die Mission nicht. Die damalige `checkVictory()`-Priorität wurde erst für den Kandidaten 0.1.15 geändert (`goblin-93j`).
- Die modulare Oberfläche unter `/tdc.game.goblin/src/app/shell.html` weiterhin mit vier Sprachen und Terrain-Stilen, Hexkanten-Picking und sicherer Bewegungs-Vorschau prüfen. Nach einem freigegebenen Deploy den Pages-Einstieg am tatsächlich veröffentlichten Commit testen.

Ausgangsbasis vor der damaligen Versionssetzung: 312/312 SVGs, 119/119 Node-Tests, 24/24 unabhängige Browserprüfblöcke und 346 fehlerfreie Projektpräfix-Requests auf Integrationscommit `3b8917a` (`goblin-28c`). Build 0.1.14 wurde danach am 01.10.2026 mit gesonderter Nutzerfreigabe auf Commit `750941134f610ba7a75bbb11d8011e5714139e21` veröffentlicht und als `v0.1.14` getaggt.

### Veröffentlichungsgrenzen

- Auf echten Tablets und Smartphones Touch-Bedienung und Lesbarkeit prüfen; alle bisherigen mobilen Browserfälle waren emuliert.
- [Content & Asset Notices](../docs/CONTENT-NOTICES.md) nennt die KI-Konzepttafeln, die Nutzerreferenz und den inoffiziellen Status der militärischen Symbole ohne APP-6-/MIL-STD-2525-Konformitätsbehauptung. Die begrenzte Prüfung (`goblin-x44`) sah kein konkretes Hindernis für genau diese sechs Assetsets in einer nichtkommerziellen Vorschau, ist aber keine Produkt-, Regel-, Marken-, kommerzielle oder verbindliche Rechtsfreigabe. Eine professionelle Markenprüfung für `G.O.B.L.I.N.` in Deutschland und der EU steht vor kommerzieller Nutzung aus.
- Die gesonderte Nutzerfreigabe für Build 0.1.15 wurde am 02.10.2026 erteilt. `v0.1.14` und `v0.1.12` bleiben Rückfallpunkte; veröffentlichter Commit, `v0.1.15`-Tag und geprüfte URL werden in `goblin-8ay` dokumentiert. Der unveröffentlichte Build-13-Vorläufer liegt auf Commit `8b0db47` im Branch.

### Vorheriger Testfokus für 0.1.13

- Pages-Projektpfad `/tdc.game.goblin/src/app/shell.html` in vier Sprachen und vier Terrain-Stilen, Hexkanten-Picking und sichere Bewegungs-Vorschau.
- Unabhängige UI-Nachprüfung 42/42 Browserfälle, unabhängige Pages-Pfad-Prüfung 18/18 Fälle und 115/115 Node-Tests. Echte Geräteprobe und formale Freigabe lagen für diesen unveröffentlichten Vorläufer nicht vor. Die historischen Belege stehen in der [Berichtsübersicht](REPORTS.md).

### Vorheriger Testfokus für 0.1.12

- ATLAS: Wasser/Fluss mit Kettenfahrzeug und normaler Infanterie nicht betretbar, mit Skimmer und amphibischer Infanterie erreichbar; Brücke für alle passierbar. Movement Area muss diese Unterschiede zeigen.
- Wald/Stadt/Berg blockieren die Sichtlinie hinter dem Feld; Krater gibt Deckung ohne Sichtblock. Field Intel zeigt Geländekosten und Deckung passend zur gewählten Einheit.
- Feuer auf eine gedeckte Einheit: Unit Intel zeigt `+1 DEF`, das Combat Log die daraus resultierende Kampfquote. Rücknahme per `BACK` prüfen.
- Unit Guide: 26 unterschiedliche Einträge, Live-Werte im aktuellen Szenario, Aktionen und geplanter Status; „AUF KARTE“ fokussiert eine vorhandene Einheit ohne Bewegungs-/Feuerbefehl. Größe des Overlays bleibt beim Blättern gleich.

Automatisierte Übergabeprüfung: 59/59 Tests bestanden. Ein lokaler visueller Browser-Smoke-Test war auf dem Developer-Host wegen einer ausgefallenen Browser-Laufzeit nicht möglich; die obigen UI-Punkte sind deshalb besonders wichtig.

## Übergabe durch den Developer

Vor einem freigegebenen Push auf `main`, der über GitHub Pages veröffentlicht wird:

1. Buildnummer in `release.js` um genau eins erhöhen.
2. Neuen Abschnitt in `CHANGELOG.md` anlegen und alle Änderungen dieses Builds aufführen.
3. Version, Build, Datum, Tag und Test-URL in diesem Dokument aktualisieren.
4. Lokalen Kandidaten committen, Release-Gate und automatisierte Tests ausführen und unabhängige QA auf genau diesem Commit abschließen.
5. Nach konkreter Nutzerfreigabe den freigegebenen Commit auf `main` veröffentlichen und genau diesen Commit mit dem eindeutigen Tag `v<Version>` versehen.
6. Nach erfolgreichem Pages-Deployment den Einstieg prüfen und die Test-URL an den Tester übergeben; die vorige funktionsfähige Version als Rückfallpunkt behalten.

Der Pages-Workflow prüft Version, Changelog und Tests. Ohne erhöhte Buildnummer wird nicht veröffentlicht.

## Rückmeldung durch den Tester

Jeder Testbericht enthält mindestens:

- getestete Version und Buildnummer aus der Kopfzeile;
- Browser, Betriebssystem und Fenstergröße;
- Szenario und aktuelle Phase;
- konkrete Schritte zur Reproduktion;
- erwartetes und tatsächliches Ergebnis;
- Screenshot oder Video, sofern das Verhalten visuell relevant ist;
- Einstufung: `BLOCKER`, `MAJOR`, `MINOR` oder `NOTE`.

Fehler werden über die GitHub-Vorlage **Test Report** erfasst. Damit bleibt jede Rückmeldung eindeutig einem veröffentlichten Build zugeordnet.
