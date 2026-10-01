# Developer → Tester Handoff

Dieses Dokument definiert die verbindliche Übergabe jedes GitHub-Pages-Builds.

## Aktueller Teststand

| Feld | Wert |
|---|---|
| Version | `0.1.13` |
| Build | `13` |
| Release-Tag | `v0.1.13` (geplant; noch nicht erstellt) |
| Datum | 2026-10-01 |
| Test-URL | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.13> (erst nach einem freigegebenen Deployment) |
| Änderungen | [CHANGELOG.md](CHANGELOG.md#0113---2026-10-01) |

### Testfokus für 0.1.13

- Pages-Projektpfad `/tdc.game.goblin/src/app/shell.html` mit allen vier Sprachen und Terrain-Stilen prüfen. Auswahl und Stilwechsel dürfen keinen Core-Befehl auslösen.
- Karten-Picking an Hexkanten und sichere Move-Vorschau prüfen; erst ausdrückliche Bestätigung darf den Befehl ausführen.
- Auf echten Tablets und Smartphones Touch-Bedienung und Lesbarkeit prüfen. Die bisherigen mobilen Browserfälle waren emuliert.
- Herkunftshinweise und formale Legal-Freigabe vor öffentlicher Bereitstellung abschließen.

Lokaler Kandidatenstand: unabhängige UI-Nachprüfung 42/42 Browserfälle, unabhängige Pages-Pfad-Prüfung 18/18 Fälle und 115/115 Node-Tests; die sichtbaren Phasenbegriffe sind in vier Sprachen neutral formuliert. Die Belege stehen in der [Berichtsübersicht](REPORTS.md). Es gab bisher weder ein Deployment dieses Builds noch echte Geräteproben oder eine formale Legal-Freigabe.

### Vorbereitung einer späteren Unit-Art-Übergabe (nicht Teil des Build-13-Teststands)

- In allen sechs `ICON SET`-Stilen je 26 kleine Karten-/Listenicons und 26 große Unit-Guide-Ansichten prüfen; der Wechsel muss beide Ansichten zusammen ändern und die zuletzt gewählte Stilrichtung wie vorgesehen speichern.
- Für das militärische Set kleine Symbole auf der Karte und große, vollständig sichtbare Rechtecksymbole im Guide prüfen. Die Guide-Ansicht darf weder beschnitten noch mit einem anderen Stil gemischt werden.
- Nach Szenariowechsel, Guide-Navigation und Wechsel zurück auf einen grafischen Stil auf fehlende Assets und ungewollte Spielbefehle prüfen. Den dokumentierten Terrain-/Logo-Fallback der sechs Sets beachten.
- Lokale Integrationsprüfung als Ausgangspunkt: 312/312 SVGs vorhanden, 119/119 Node-Tests, 24/24 unabhängige Browserfälle und 346 Projektpräfix-Requests ohne Fehler (`goblin-28c`). Diese Werte sind **kein** Build-13- oder öffentlicher Release-Nachweis.
- Vor einem späteren Release Versions-/Builddaten, Changelog, Tester-URL und Freigaben für genau den zu veröffentlichenden Commit aktualisieren. [Content & Asset Notices](CONTENT-NOTICES.md) nennt KI-Konzepttafeln, die Nutzerreferenz und den inoffiziellen Status der militärischen Symbole.

### Vorheriger Testfokus für 0.1.12

- ATLAS: Wasser/Fluss mit Kettenfahrzeug und normaler Infanterie nicht betretbar, mit Skimmer und amphibischer Infanterie erreichbar; Brücke für alle passierbar. Movement Area muss diese Unterschiede zeigen.
- Wald/Stadt/Berg blockieren die Sichtlinie hinter dem Feld; Krater gibt Deckung ohne Sichtblock. Field Intel zeigt Geländekosten und Deckung passend zur gewählten Einheit.
- Feuer auf eine gedeckte Einheit: Unit Intel zeigt `+1 DEF`, das Combat Log die daraus resultierende Kampfquote. Rücknahme per `BACK` prüfen.
- Unit Guide: 26 unterschiedliche Einträge, Live-Werte im aktuellen Szenario, Aktionen und geplanter Status; „AUF KARTE“ fokussiert eine vorhandene Einheit ohne Bewegungs-/Feuerbefehl. Größe des Overlays bleibt beim Blättern gleich.

Automatisierte Übergabeprüfung: 59/59 Tests bestanden. Ein lokaler visueller Browser-Smoke-Test war auf dem Developer-Host wegen einer ausgefallenen Browser-Laufzeit nicht möglich; die obigen UI-Punkte sind deshalb besonders wichtig.

## Übergabe durch den Developer

Vor jedem Push auf `main`, der über GitHub Pages veröffentlicht wird:

1. Buildnummer in `release.js` um genau eins erhöhen.
2. Neuen Abschnitt in `CHANGELOG.md` anlegen und alle Änderungen dieses Builds aufführen.
3. Version, Build, Datum, Tag und Test-URL in diesem Dokument aktualisieren.
4. Alle automatisierten Tests ausführen.
5. Commit mit Release-Tag `v<Version>` pushen.
6. Nach erfolgreichem Pages-Deployment die Test-URL an den Tester übergeben.

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
