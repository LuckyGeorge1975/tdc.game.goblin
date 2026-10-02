# Developer → Tester Handoff

Dieses Dokument definiert die verbindliche Übergabe jedes GitHub-Pages-Builds.

## Aktueller Teststand

| Feld | Wert |
|---|---|
| Version | `0.1.15` |
| Build | `15` |
| Release-Tag | `v0.1.15` (reservierter Name; nicht erstellt) |
| Datum | 2026-10-02 |
| Test-URL | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.15> (erst nach gesondert freigegebenem Deployment; derzeit zeigt Pages 0.1.14) |
| Änderungen | [CHANGELOG.md](CHANGELOG.md#0115---2026-10-02) |

### Testfokus für 0.1.15

- Auf dem exakten Kandidatencommit die vier neuen Showcases K/U1/U2/U3 auswählen, starten und Ziele, Einheiten, Terrain sowie Sieg-/Niederlage-Enden prüfen. Bei simultaner vollständiger Ausschaltung gilt Niederlage; IRON DUST behält sein Kern-Siegziel bei überlebendem Spieler.
- Kleine Karten-/Listenicons und getrennte dreiviertelperspektivische große Guide-Ansichten in allen sechs Stilen prüfen. Der Stilwechsel darf keine Regeln oder Missionsdaten verändern.
- Mobile 390 × 844, 320 × 568 und Querformat: Karte direkt sichtbar, Truppe und Intel/Log erreichbar, Hauptaktion nutzbar, „Auf Karte“ zeigt und fokussiert die gewählte Einheit. Desktop-Layout und DE/FR besonders prüfen.
- Artillery Drone in U3: Live-MOVE 2 und passende Aktionen in DE/EN/ES/FR; ohne Live-Einheit ist die stationäre Katalogregel MOVE 0 als geplantes Ziel gekennzeichnet.
- Odd-row-Reichweite: Auf geraden und ungeraden Zeilen echte Nachbarn für Feuer sowie Ein-/Aussteigen prüfen und scheinbare Diagonalnachbarn ablehnen. In `UNIT TRIAL` den einmaligen Raketenwerfer mit einem Ziel genau in Reichweite 8 und einem Ziel in Distanz 9 prüfen; Splash und Friendly Fire dürfen nur tatsächliche Nachbarfelder des Ziels betreffen.
- Die historische Sichtlinien-Pixelabtastung ist von dieser Reichweitenkorrektur getrennt und bleibt bis zur Entscheidung `goblin-9bj.27` bestehen. Die zuvor auf `1cf3861` bestandenen Browserprüfungen ersetzen keine vollständige unabhängige QA auf dem neuen Kandidatencommit.
- Historische Legacy-Field-Test-Werte von den noch nicht vollständig implementierten Katalogwerten und Sonderregeln trennen. Echte Geräte-Fingerproben (`goblin-wtg`) sind weiterhin offen.

Der veröffentlichte Ausgangspunkt ist `v0.1.14` auf Commit `750941134f610ba7a75bbb11d8011e5714139e21`; `v0.1.12` bleibt ein früherer Rückfallpunkt. Die genaue Kandidaten-Commit-ID und Gate-/Browserbelege stehen nach dem Commit in `goblin-isr`. Finale unabhängige QA ist auf genau dieser ID erforderlich. Für 0.1.15 gab es bisher keinen Push, Tag oder Deploy.

### Vorheriger Testfokus für 0.1.14

- Alle sechs `ICON SET`-Stile mit je 26 kleinen Karten-/Listenicons und 26 großen Unit-Guide-Ansichten prüfen. Der Wechsel muss beide Ansichten gemeinsam ändern; Technische Illustration ist nach leerem Browser-Stilspeicher anfänglich gewählt.
- Militärisches Set: kleine Kartensymbole und vollständig sichtbare rechteckige 1024 × 768-Ansichten im Guide. Auf Desktop sowie bei 390 × 844 und 320 × 568 px dürfen weder Symbol noch Kopfzeile beschnitten werden; die letzte Aktion bleibt durch Scrollen erreichbar.
- Szenariowechsel, Guide-Navigation, Rückwechsel zu grafischen Stilen, Terrain-/Logo-Fallback und gespeicherte Stilwahl auf fehlende Assets oder unbeabsichtigte Spielbefehle prüfen. Bei `UNIT TRIAL` beendet der Kern allein die Mission nicht. Die damalige `checkVictory()`-Priorität wurde erst für den Kandidaten 0.1.15 geändert (`goblin-93j`).
- Die modulare Oberfläche unter `/tdc.game.goblin/src/app/shell.html` weiterhin mit vier Sprachen und Terrain-Stilen, Hexkanten-Picking und sicherer Bewegungs-Vorschau prüfen. Nach einem freigegebenen Deploy den Pages-Einstieg am tatsächlich veröffentlichten Commit testen.

Ausgangsbasis vor der damaligen Versionssetzung: 312/312 SVGs, 119/119 Node-Tests, 24/24 unabhängige Browserprüfblöcke und 346 fehlerfreie Projektpräfix-Requests auf Integrationscommit `3b8917a` (`goblin-28c`). Build 0.1.14 wurde danach am 01.10.2026 mit gesonderter Nutzerfreigabe auf Commit `750941134f610ba7a75bbb11d8011e5714139e21` veröffentlicht und als `v0.1.14` getaggt.

### Veröffentlichungsgrenzen

- Auf echten Tablets und Smartphones Touch-Bedienung und Lesbarkeit prüfen; alle bisherigen mobilen Browserfälle waren emuliert.
- [Content & Asset Notices](CONTENT-NOTICES.md) nennt die KI-Konzepttafeln, die Nutzerreferenz und den inoffiziellen Status der militärischen Symbole ohne APP-6-/MIL-STD-2525-Konformitätsbehauptung. Die begrenzte Prüfung (`goblin-x44`) sah kein konkretes Hindernis für genau diese sechs Assetsets in einer nichtkommerziellen Vorschau, ist aber keine Produkt-, Regel-, Marken-, kommerzielle oder verbindliche Rechtsfreigabe. Eine professionelle Markenprüfung für `G.O.B.L.I.N.` in Deutschland und der EU steht vor kommerzieller Nutzung aus.
- Die gesonderte Nutzerentscheidung über die Veröffentlichung von 0.1.15 bleibt erforderlich. Bis dahin bleibt die öffentliche Version `main`/`v0.1.14` verfügbar; `v0.1.12` ist ein früherer Rückfallpunkt. Der unveröffentlichte Build-13-Vorläufer liegt auf Commit `8b0db47` im Branch.

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
