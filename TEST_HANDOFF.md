# Developer → Tester Handoff

Dieses Dokument definiert die verbindliche Übergabe jedes GitHub-Pages-Builds.

## Aktueller Teststand

| Feld | Wert |
|---|---|
| Version | `0.1.7` |
| Build | `7` |
| Release-Tag | `v0.1.7` |
| Datum | 2026-09-26 |
| Test-URL | <https://luckygeorge1975.github.io/tdc.game.goblin/?build=0.1.7> |
| Änderungen | [CHANGELOG.md](CHANGELOG.md#017---2026-09-26) |

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
