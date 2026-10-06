# Developer → Tester Handoff

Dieses Dokument definiert die verbindliche Übergabe jedes GitHub-Pages-Builds.

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
- Nach dieser redaktionellen Korrektur folgt eine unabhängige Delta-Nachprüfung. Tag, Push und Pages-Deploy erfolgen erst nach allen Gates durch Koordination; den öffentlichen Einstieg anschließend prüfen und in `goblin-rfe` dokumentieren.

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
