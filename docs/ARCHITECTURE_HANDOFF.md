# Architektur-Übergabe: erster modularer Spielschnitt

Stand: 2026-09-29 · Vertrag v1

Diese Datei ist die gemeinsame Schnittstelle zwischen **Core / Engine** und
**Developer**. Sie ersetzt weder `RULE_MATRIX.md` noch `../reports/TEST_HANDOFF.md`.
Architektur- und Vertragsänderungen werden hier begründet dokumentiert, bevor
beide Arbeitsstränge sie übernehmen. Für diesen Schnitt wird kein Build
veröffentlicht, bevor die Integrationskriterien erfüllt sind.

## Ziel und Nicht-Ziele

Ziel ist eine kleine, vollständig spielbare und reproduzierbare Partie über
einen vom Browser unabhängigen Regelkern. Der bestehende Spielpfad bleibt
währenddessen als Vergleich erhalten. Nicht Teil dieses Schnitts sind die
vollständige Migration aller Einheiten, neue Regeln, Story, Netzwerk und Ranking.

## Gemeinsamer Vertrag v1 (ARCH-01)

- `GameState` enthält ausschließlich serialisierbare, regelrelevante Daten:
  Regel-/Szenarioversion, Karte, Einheiten, aktuelles Team, Phase, Zugnummer,
  Siegstatus und Zustand der deterministischen Zufallsquelle. Keine DOM-Knoten,
  Timer, Animationen oder Klasseninstanzen.
- `Command` ist zunächst eine der Aktionen `Move`, `Fire`, `Load`, `Unload`
  oder `EndPhase`, jeweils mit Spieler-/Einheiten-ID und erforderlichen
  Zielkoordinaten bzw. Ziel-ID. Einheitenwahl, Hover und Kamerasteuerung sind
  **keine** Spielbefehle.
- `dispatch(state, command)` validiert den Befehl und gibt entweder
  `{ state: nextState, events }` oder eine strukturierte Ablehnung
  `{ error: { code, details } }` zurück. Ein abgelehnter Befehl verändert
  weder Zustand noch Zufallsquelle. Nur der Kern verändert den Spielzustand.
- `queryAreas(state, unitId)` gibt **getrennt** `movementReachable`,
  `fireRange`, `lineOfSight` und `attackableTargets` zurück. `fireRange` ist
  geometrische Reichweite, `lineOfSight` die sichtbaren Felder;
  `attackableTargets` berücksichtigt beides sowie die aktuelle Phase.
  `movementReachable` enthält nur tatsächlich legal erreichbare Zielfelder.
- Hex-Koordinaten werden an der Grenze als `{ x, y }` mit dem vorhandenen
  Kartenraster übergeben. Eine interne Axialdarstellung ist erlaubt, darf aber
  nicht in UI oder Inhaltsdaten durchsickern.
- `GameEvent` beschreibt fachliche Ergebnisse wie `UnitMoved`, `ShotResolved`,
  `PhaseChanged` und `GameEnded`. Der Renderer darf Ereignisse animieren, aber
  der nächste legale Zustand hängt niemals vom Ende einer Animation ab.
- `ViewState` ist separat: selektiertes Feld/Einheit, Hover, Kameraposition,
  Area-Modus und laufende Effekte. Er darf verworfen werden, ohne die Partie
  zu verändern.

Änderungswünsche an diesem Vertrag: Vorschlag mit betroffenem Feld, Grund,
Migrationswirkung und Beispiel an den Architekten; nicht einseitig in beiden
Arbeitssträngen inkompatibel fortsetzen.

## Parallele Arbeitspakete

### Core / Engine — Eigentümer: Task „Core / Engine“

**CE-01 · Deterministischer Kern (P1).** In neuen, isolierten Modulen
`src/core/**` eine minimale Partie mit zwei Einheitentypen, Bewegung, Feuer,
Phasen und Siegbedingung gemäß Vertrag implementieren. Vorhandene Regeltests
als Referenz nutzen, aber keine neue Sonderregel erfinden. Die gleiche
Initialkonfiguration samt Seed und Befehlsfolge muss denselben Endzustand und
dieselben Ereignisse ergeben. Tests laufen ohne Browser.

**CE-02 · Hex-Abfragen (P1, parallel zu CE-01).** Bewegung, Feuerreichweite,
Sichtlinie und mögliche Ziele getrennt berechnen. Tests mindestens für
Blockade, unpassierbares Gelände, Deckung, belegtes Feld und Kartenrand.
Die Rückgabe ist direkt für die drei bestehenden Area-Modi verwendbar.

**CE-03 · Darstellungsgrenze (P2, nach Vertragsprüfung).** Neue Module
`src/hex-renderer/**` zeichnen Zustand und Ereignisse und melden Picking als
Hex/Einheiten-ID. Ebenenreihenfolge explizit dokumentieren: Gelände, Grid,
Areas, Wracks, Einheiten, Fokusmarker, Effekte. Der Renderer validiert keine
Spielzüge und greift nicht auf interne Core-Variablen zu.

**CE-Abnahme:** Node-Tests für Replay/Seed und Abfragen; Mock-Partie kann
ohne `src/legacy/scripts/game.js`, DOM und globale Funktionsüberschreibung durchlaufen werden.

### Developer — Eigentümer: Task „Developer“

**DEV-01 · UI-Adapter mit Mock-Core (P1, parallel zu CE-01/02).** In
`src/app/**` Kartenklicks, Phasenbutton und Einheitenliste auf `Command`
abbilden. Bis der echte Core bereitsteht, die unten festgelegte Referenzpartie
als Mock nutzen. Auswahl und Field/Unit Intel bleiben `ViewState`. Weder UI
noch Mock verändern Einheitenwerte direkt.

**DEV-02 · Eine Quelle für Anzeigezustände (P2).** Bewegung, Feuer und LOS nur
aus `queryAreas` anzeigen; Phasenzähler und Handlungsfähigkeit aus `GameState`
ableiten. Anzeigezustände „zerstört“, „deaktiviert“, „in dieser Phase ohne
Aktion“ und „Aktion verbraucht“ unterscheidbar halten.

**DEV-03 · Integrationsschalter (P2).** Einen internen Umschalter für den
neuen Partieweg vorsehen. Bestehenden Pfad nicht entfernen; lokal müssen
beide Wege vergleichbar bleiben. Erst nach gemeinsamer Integrationsprüfung
dürfen `index.html`, `src/legacy/scripts/game.js` oder andere Legacy-Dateien für den neuen Pfad
umgestellt werden.

**DEV-Abnahme:** Die Mock-Partie ist in der UI bedienbar; Selektion löst
keinen Spielbefehl aus; ein abgelehnter Befehl verändert weder Karte noch
Zähler; Area-Anzeige und Phasenbutton stimmen mit Mock-/Core-Daten überein.

## Referenzpartie und Integration

Vor Implementierung vereinbaren beide Entwickler eine kleine Fixture mit
festem Seed, 12×8-Karte, zwei freundlichen und zwei feindlichen Einheiten,
einem blockierenden Geländefeld und einem erreichbaren Ziel. Die Fixture muss
mindestens diese Sequenz abdecken: Einheit wählen (nur ViewState), legal
bewegen, illegalen Zug ablehnen, Phase wechseln, feuern, Ergebnis wiederholen,
Spielende. Core / Engine liefert Soll-Zustände und Ereignisse; Developer nutzt
dieselbe Fixture für den Mock. Änderungen an der Fixture werden gemeinsam
abgestimmt.

Die Arbeitsbereiche sind absichtlich getrennt: Core / Engine besitzt
`src/core/**`, `src/hex-renderer/**` und zugehörige Tests; Developer besitzt
`src/app/**` und UI-Tests. Gemeinsame Legacy-Dateien, Release-Dateien,
`README.md` und diese Übergabe werden nicht gleichzeitig bearbeitet. Vor
einem Integrations-Merge: Tests beider Bereiche, Vergleich der Referenzpartie,
Browser-Smoke-Test auf localhost, Review offener Vertragsabweichungen. Erst
danach Buildnummer, Changelog und Testerübergabe gemäß bisherigem Prozess.

## Aufgabenverwaltung

Diese Datei beschreibt den Architekturvertrag und die fachlichen Grenzen.
Aufgabenstatus, Zuständigkeiten und Abhängigkeiten werden ausschließlich in
Beads unter dem Epic `Projects-1w3` gepflegt (`bd ready`, `bd show
Projects-1w3`). Änderungen am Vertrag und an den Abnahmekriterien müssen in
den betroffenen Beads-Issues nachvollziehbar sein.
