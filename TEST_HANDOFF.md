# Developer → Tester Handoff

Dieses Dokument definiert die verbindliche Übergabe jedes GitHub-Pages-Builds.

## Aktueller Teststand

| Feld | Wert |
|---|---|
| Version | `0.1.14` |
| Build | `14` |
| Release-Tag | `v0.1.14` (geplant; noch nicht erstellt) |
| Datum | 2026-10-01 |
| Test-URL | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.14> (erst nach einem freigegebenen Deployment) |
| Änderungen | [CHANGELOG.md](CHANGELOG.md#0114---2026-10-01) |

### Testfokus für 0.1.14

- Alle sechs `ICON SET`-Stile mit je 26 kleinen Karten-/Listenicons und 26 großen Unit-Guide-Ansichten prüfen. Der Wechsel muss beide Ansichten gemeinsam ändern; Technische Illustration ist nach leerem Browser-Stilspeicher anfänglich gewählt.
- Militärisches Set: kleine Kartensymbole und vollständig sichtbare rechteckige 1024 × 768-Ansichten im Guide. Auf Desktop sowie bei 390 × 844 und 320 × 568 px dürfen weder Symbol noch Kopfzeile beschnitten werden; die letzte Aktion bleibt durch Scrollen erreichbar.
- Szenariowechsel, Guide-Navigation, Rückwechsel zu grafischen Stilen, Terrain-/Logo-Fallback und gespeicherte Stilwahl auf fehlende Assets oder unbeabsichtigte Spielbefehle prüfen. Bei `UNIT TRIAL` beendet der Kern allein die Mission nicht; die unveränderte `checkVictory()`-Siegpriorität ist eine offene Produktentscheidung (`goblin-93j`).
- Die modulare Oberfläche unter `/tdc.game.goblin/src/app/shell.html` weiterhin mit vier Sprachen und Terrain-Stilen, Hexkanten-Picking und sicherer Bewegungs-Vorschau prüfen. Nach einem freigegebenen Deploy den Pages-Einstieg am tatsächlich veröffentlichten Commit testen.

Ausgangsbasis vor der Versionssetzung: 312/312 quellgleiche SVGs, 119/119 Node-Tests, 24/24 unabhängige Browserprüfblöcke und 346 fehlerfreie Projektpräfix-Requests auf dem sechs-Stil-Integrationscommit `3b8917a` (`goblin-28c`). Diese Prüfung ist kein Nachweis für den neuen Release-Metadatencommit. Release-Gate, vollständige Node-Suite und ein lokaler Pages-Prefix-Smoke werden am Build-0.1.14-Kandidaten erneut ausgeführt; die unabhängige finale QA auf genau diesem Commit folgt durch Koordination. Es gab keinen Push, Deploy oder Tag für 0.1.14.

### Veröffentlichungsgrenzen

- Auf echten Tablets und Smartphones Touch-Bedienung und Lesbarkeit prüfen; alle bisherigen mobilen Browserfälle waren emuliert.
- [Content & Asset Notices](CONTENT-NOTICES.md) nennt die KI-Konzepttafeln, die Nutzerreferenz und den inoffiziellen Status der militärischen Symbole ohne APP-6-/MIL-STD-2525-Konformitätsbehauptung. Die begrenzte Prüfung (`goblin-x44`) sah kein konkretes Hindernis für genau diese sechs Assetsets in einer nichtkommerziellen Vorschau, ist aber keine Produkt-, Regel-, Marken-, kommerzielle oder verbindliche Rechtsfreigabe. Eine professionelle Markenprüfung für `G.O.B.L.I.N.` in Deutschland und der EU steht vor kommerzieller Nutzung aus.
- Die gesonderte Nutzerentscheidung über Veröffentlichung bleibt erforderlich. Bis dahin bleibt die öffentliche Version `main`/`v0.1.12` der Rückfallpunkt; der geprüfte, aber unveröffentlichte Build-13-Vorläufer liegt auf Commit `8b0db47` im Branch.

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
