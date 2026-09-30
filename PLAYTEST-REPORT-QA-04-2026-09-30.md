# QA-04 – Unabhängiger Testbericht: modularer Schnitt 2

Stand: 2026-09-30 · Aufgabe `goblin-4gi.5` · Testumgebung: lokaler Server `http://127.0.0.1:4173`, BrowserAct 1.4.2 mit bestehendem `goblin-local`-Chrome. **Interner Vergleichspfad, kein Release.** Grundlage: `ARCHITECTURE_SLICE_2.md` und `QA-03-TESTMATRIX.md`.

## Ergebnis

Der vereinbarte `phase-v2`-Hauptpfad ist im Browser **zweimal vollständig gegen `expectedPhaseReplay` bestanden**. Alle 16 Befehle pro Durchlauf stimmten in Befehlsdaten, vollständigem Ergebnis, Fehlerdetails, Events, anschließendem State und RNG mit dem festen Core-Orakel überein. Die lokale UI zeigte die geprüften Phasen-, Team-, Runden-, Bereitschafts-, Skimmer- und D-Zustände passend zum Core. Die vier gesonderten Core-Zweige bestanden bei einer unabhängigen Ausführung. Der `core-v1`-Replay endete weiterhin mit Spielersieg.

IRON DUST und ATLAS bestanden die unten beschriebenen **Legacy-Smokes**. Dabei trat eine kleine Legacy-Overlay-Abweichung beim Szenariowechsel auf (`goblin-x4z`); sie verfälscht keine vereinbarten Befehle oder Anzeigen des modularen Schnitts. Eine vollständige Legacy-Regelparität wurde nicht geprüft.

## Ausführung und Soll-/Ist-Checkpoints

### Automatisierte Basis

`node --test tests/core-phase.test.mjs tests/core-game.test.mjs tests/app-adapter.test.mjs tests/app-presentation.test.mjs tests/app-path-switch.test.mjs`: **24 Tests bestanden, 0 fehlgeschlagen**. Die folgenden Browser- und Zweigprüfungen wurden zusätzlich unabhängig durchgeführt; die Aussage beruht daher nicht allein auf den vorhandenen Unit-Tests.

### Browser-Hauptreplay, zweimal

URL `http://127.0.0.1:4173/src/app/compare.html?path=phase`; Iframe `reference.html?scenario=phase-v2&harness=1`. Anfangszustand zeigte `phase-v2`, Seed/RNG 5, `Player · movement phase`, `Zug 1`, `Bereit 2/2`. Der Harness lieferte exakt 16 Fixture-Befehle. Für **jeden** Schritt wurden `command`, vollständiges `result` und anschließender State gegen `expectedPhaseReplay` verglichen. Durchlauf 1: 16/16; nach Reload Durchlauf 2: 16/16; beide mit identischem End-State. Es gab keine abweichenden Schritte.

| Schritt / Matrix | Soll | Ist im Browser |
| --- | --- | --- |
| 1–2 / M01–M02 | Skimmer (1,1)→(2,1), `moved=true`; zweiter Move `ACTION_SPENT`, RNG 5 unverändert | Exakt; sichtbare Bereitschaft `1/2`, ein `UnitMoved`, keine zusätzliche Log-Zeile bei Ablehnung |
| 3–4 / P01–F01 | `P/fire/1`; D-Schuss `p-tank→e-tank`, Roll 2, Quote 1-1, HP 3, `disabledUntil=2`, RNG 1022226848 | Exakt; `Player · fire phase`, Ziel `DISABLED`, Bereitschaft nach Schuss `0/2` |
| 5–8 / P02–G04 | `P/gev/1`; (5,1) `UNREACHABLE`, (4,1) gültige Zweitbewegung, weiterer Move `ACTION_SPENT` | Exakt; GEV-Bereitschaft `1/2→0/2`, Position (4,1), nur ein GEV-`UnitMoved`; RNG blieb 1022226848 |
| 9–13 / T01–T02 | Wechsel zu E/movement/1, `e-tank` bei Versuch `UNIT_DISABLED`; E/fire, E/gev, P/movement/2 | Exakt; je ein `PhaseChanged`; Team/Runde/Anzeige synchron; E-Tank während E-Turn 1 weiter `DISABLED` |
| 14–16 / D02 | P/fire/2, P/gev/2, E/movement/2 mit `UnitRecovered` vor `PhaseChanged` | Exakt; `disabled=false`, `disabledUntil=0`, `Bereit 1/2`; genau ein sichtbarer Recovery-Eintrag |

Pro Durchlauf: **2 `UnitMoved`, 9 `PhaseChanged`, 1 `ShotResolved`, 1 `UnitRecovered` = 13 sichtbare Eventeinträge**. Nach dem Endzustand wurden Auswahl und Area-Modus mehrfach geändert: State und Trace blieben identisch (16 Befehle); Eventliste blieb bei 13 und Recovery-Eintrag bei 1. Ablehnungen hatten keine Events und veränderten weder den Eingabe-State noch RNG.

### Sichtbare Bedienung und getrennte Areas

Ein weiterer Browserstart wurde über sichtbare Roster-, Karten-, Area- und Phasen-Elemente bedient. Auswahl des Skimmers und Wechsel `Movement→Fire→LOS→Movement` änderten Core-State/RNG nicht; die drei Area-Mengen blieben unterscheidbar (21 Movement-Ziele, 14 Fire-Range-Felder, 47 LOS-Felder an diesem Checkpoint). Ein Kartenklick bewegte den Skimmer nach (2,1); ein Versuch auf ein nicht angebotenes Ziel änderte weder Zustand noch Combat Log. In Fire wurde `p-tank` gewählt und `e-tank` angeklickt: `DISABLED`, Fälligkeit 2. In GEV enthielt das Movement-Overlay (4,1), aber nicht (5,1); der Kartenklick nach (4,1) setzte `secondMoved=true` und die Bereitschaft auf `0/2`. Die tatsächlich ausgelöste UI-Trace-Folge bestand aus Move, EndPhase, Fire, EndPhase, Move, jeweils mit nur einem zugehörigen Event.

Die UI fängt einen Klick auf ein nicht angebotenes Bewegungsziel als Fokus-/Auswahländerung ab, statt einen abgelehnten Core-Befehl zu senden. Die strukturierten Ablehnungen wurden daher zusätzlich über `__goblinHarness.dispatch` geprüft. Dieser Unterschied ist im UI-Verhalten sichtbar, aber kein Regelzustandsfehler.

### Separate Core-Zweige

Eine eigene Node-Ausführung verwendete die exportierten Szenarien, Seeds und Befehle aus `phase-branches.mjs`; bei jeder Ablehnung wurde der gesamte Eingabe-State mit einer Kopie verglichen.

| Zweig | Soll | Ist |
| --- | --- | --- |
| `enemyD`, Seed 5 | E-Schuss D auf `p-tank` in Turn 1; Erholung erst P/movement/Turn 3, `UnitRecovered` vor `PhaseChanged` | Roll 2 / 1-1 / D; genau diese Erholung und Event-Reihenfolge |
| `secondD`, Seed 10 | Zwei D-Treffer auf noch deaktiviertes Fahrzeug zerstören es | Ergebnisse D, D; `e-tank.hp=0` |
| `infantryD`, Seed 5 | Infanterie verliert 1 HP, keine Fahrzeug-Deaktivierung/Fälligkeit | HP 2, `disabled=false`, `disabledUntil=0` |
| `terrainLos`, Seed 5 | Ziel geometrisch in Fire Range, durch Berg nicht sichtbar oder angreifbar | `fireRange=true`, `lineOfSight=false`, `TARGET_NOT_ATTACKABLE` |
| Ausgelassene Erstbewegung | GEV-Move ohne Movement-Move erlaubt | `moved=false`, `secondMoved=true` nach Move (1,1)→(3,1) |
| `core-v1` | Unveränderter Referenz-Replay | Endzustand mit Sieger `player` |

### Getrennte Legacy-Smokes

Beide Smokes liefen über den Legacy-Umschalter auf demselben lokalen Server, Buildanzeige **FIELD TEST 0.1.12**. Diese Durchläufe prüfen Verfügbarkeit und grundlegende Bedienbarkeit. Sie sind keine vollständige Prüfung der Szenarioziele, Katalogwerte, KI, Spezialwaffen oder Hexdistanz-Parität.

| Szenario | Beobachtete Checkpoints | Ergebnis |
| --- | --- | --- |
| IRON DUST | 12×8-Karte, vier eigene Einheiten und Command-Core-Ziel geladen; Unit Guide geöffnet; Skimmer Scout gewählt und legal bewegt, MOVE 4/4→3/4; `movement→fire→gev→Hostile→movement`, nach Gegnerzug Turn 2 bedienbar; Skimmer Scout feuerte auf Raider Skimmer, `X bei 1-1` im Combat Log | Smoke bestanden; Missionssieg nicht angespielt |
| ATLAS / PROVING GROUNDS | Szenariowechsel bestätigt; 12×8-Karte, 18 eigene Einheiten, 8 Gegner, Guide und Unit Intel geladen; Combat Skimmer legal nach (6,6) bewegt, in Fire auf Phantom Platform gefeuert, `D bei 1-1` im Combat Log; `movement→fire→gev→Hostile→movement`, Turn 2 bedienbar | Smoke bestanden; vorläufige „alle Gegner“-Siegbedingung nicht bis zum Ende gespielt |

**Legacy-Abweichung `goblin-x4z` (P3):** Nach Wechsel von IRON DUST in der Fire Phase zu ATLAS startet ATLAS korrekt in `MOVEMENT PHASE`, behält aber `FIRE RANGE` als aktiven Overlay-Modus. Nach Auswahl einer Einheit erscheinen Fire- statt Movement-Markierungen, bis `MOVEMENT RANGE` gewählt wird. Der manuelle Moduswechsel stellt die Bewegungsvorschau wieder her. Die Abweichung betrifft den Legacy-Pfad und sperrt diesen modularen Schnitt nicht.

## Grenzen und Übergabe

- Die `phase-v2`-UI startet nur die Hauptfixture. Die zusätzlichen D- und Terrain-/LOS-Zweige wurden als Core-Fälle geprüft; sie haben in der Vergleichsseite keinen eigenen sichtbaren Szenariostart.
- Der lokale Browser-Harness ist ein Testzugang. Die eigentlichen UI-Aktionen wurden zusätzlich über sichtbare Elemente geprüft.
- Kein Release, Push, Git-Eingriff oder Test der veröffentlichten Seite.

**QA-Bewertung:** Die vereinbarten Kriterien für den zweiten modularen Schnitt sind im geprüften lokalen Stand erfüllt. Dieser Bericht geht vor dem Schließen von QA-04 an die Architekturkoordination; `INT-02` entscheidet danach separat über die Architekturabnahme.
