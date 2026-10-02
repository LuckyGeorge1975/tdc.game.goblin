# QA-01 – Referenzpartie und Regressionstest vorbereiten

Status: **Testplan-Entwurf; noch nicht gegen den modularen Spielpfad ausgeführt.**

Ziel ist eine reproduzierbare, beobachtbare Abnahme des ersten modularen Spielschnitts: ein minimaler Core mit zwei Einheitentypen und gemeinsamer Referenzpartie. Die kanonische Fixture liegt in `src/core/reference-fixture.mjs`; Vertrag: `src/core/CONTRACT.md`; Seed: `0x0b11a1`. Die Befehlsfolge umfasst Selektion (nur ViewState), legale Bewegung, Ablehnung eines zweiten Bewegungsbefehls, Phasenwechsel, Feuer, Wiederholung und Spielende. Tests der integrierten Oberfläche erfolgen ausschließlich gegen `localhost`. Die veröffentlichte GitHub-Pages-Version wird nicht für Zwischenstände neu geladen oder bewertet.

## Testvoraussetzungen

- Neuer Spielpfad und bisheriger Spielpfad sind lokal separat startbar.
- Der neue Core und der UI-Mock starten mit derselben Referenzpartie / Fixture.
- Der Legacy-Spielpfad wird separat mit seinen eigenen Szenario-Referenzen geprüft; er startet nicht mit der Zwei-Typen-Fixture.
- Core / Engine und Vertrag definieren Fixture, Seed, konkrete Eingabefolge und Sollzustände/-ereignisse; Developer verwendet exakt dieselbe Fixture im Mock.
- Testorakel: sichtbare Karte, Unit Intel, Phasen-/Aktionszähler und Combat Log. Falls zusätzlich ein maschinenlesbares Replay-Protokoll Teil der Abnahme ist, muss dessen Zugriffsweg vor QA-02 feststehen.
- Pro Fall werden Pfad (neu/Legacy), Fixture-/Seed-ID, Aktion, sichtbare Vorher-/Nachher-Werte und Ergebnis festgehalten.

## Testmatrix

| ID | Bereich | Ausgangszustand | Eingabe / Ablauf | Soll-Ergebnis | Nachweis |
|---|---|---|---|---|---|
| QA-SEL-01 | Selektion ist ViewState | Referenzstart; `p-1` auf der Karte sichtbar | `p-1` wählen, Auswahl aufheben und erneut wählen | Auswahl/Intel ändern sich; keine Spielaktion bzw. kein `Command`; `GameState` und RNG bleiben unverändert | State-/RNG-Vergleich, Eventfolge |
| QA-MOV-01 | Bewegung: gültiger Zug | Referenzstart mit Seed `0x0b11a1`; `p-1` in Movement Phase | `Move(p-1, (2,4))` ausführen | `p-1` steht auf `(2,4)`; `UnitMoved` wird ausgegeben; Bewegungszähler/State ändern sich gemäß Vertrag | Zustand und Eventfolge |
| QA-MOV-02 | Illegale zweite Bewegung | Direkt nach QA-MOV-01; `p-1` hat seine Bewegung verbraucht | `dispatch(state, Move(p-1, zweites Ziel))` ausführen | Rückgabe ist `{ error: { code: ACTION_SPENT, details } }`; kein neuer State. Vorhandener State und RNG bleiben unverändert; kein Bewegungs-Event | Fehlercode/-details, State-/RNG-Vergleich, Events |
| QA-LOS-01 | Sichtbarkeit blockierenden Geländes | Fixture mit blockierendem Gelände und Feldern dahinter | `queryAreas`/LOS für eine Einheit abfragen | Das blockierende Geländefeld selbst ist sichtbar; Zellen dahinter sind nicht sichtbar | zurückgegebene LOS-Felder |
| QA-LOS-02 | Fire Range getrennt von LOS/Zielen | Gleiche Fixture | `queryAreas(state, unitId)` abfragen | `movementReachable`, `fireRange` und `lineOfSight` enthalten Koordinaten; `attackableTargets` enthält IDs. Die Mengen sind getrennt; ein Ziel hinter Blockade ist nicht angreifbar, auch wenn es geometrisch in `fireRange` liegt | getrennte Mengen und Zielprüfung |
| QA-PH-01 | Phasenwechsel | Nach legaler Bewegung in der Referenzpartie | `EndPhase` aus Movement senden | Phase wechselt genau einmal von `movement` zu `fire`; `PhaseChanged` entspricht dem neuen Zustand | State und Eventfolge |
| QA-FIRE-01 | Feuer: sichtbares Ziel und reproduzierbarer D-Treffer | Fire Phase; Referenzzustand nach Movement→Fire; p-1 und e-1 gemäß Fixture | `Fire(p-1, e-1)` ausführen | Wurf 2 gegen Verteidigung 2-1 ergibt `D`; e-1 erhält `disabled=true`, HP bleibt 2; `ShotResolved` stimmt mit neuem State überein | Seed, Befehl, Event und Zustand |
| QA-FIRE-02 | Zweiter Schuss und Sieg | Referenzzustand mit p-2 und e-core gemäß Fixture | `Fire(p-2, e-core)` ausführen | Wurf 1 gegen Verteidigung 5-1 ergibt `X`; `e-core` wird ausgeschaltet; `GameEnded` setzt `victory.status` und `victory.winner=player` | Eventfolge, Siegstatus |
| QA-REP-01 | Deterministisches Replay | Fixture und Seed `0x0b11a1` | `replayReference()` zweimal abspielen und vergleichen | Identische vollständige serialisierbare States einschließlich `rng`, Events und Ablehnungsdetails; Sollfolge: Move p-1→(2,4), zweiter Move `ACTION_SPENT`, Phase movement→fire, p-1→e-1 Roll 2 / 2-1 / D / `disabled=true` / HP 2, p-2→e-core Roll 1 / 5-1 / X / `GameEnded` mit Sieger player | Vollständige Replay-Protokolle / State-Vergleich |
| QA-UI-01 | Integrierte Darstellung des Core-Zustands | Neuer UI-Pfad mit derselben Fixture/Seed | Referenzfolge über sichtbare UI-Aktionen durchspielen | Karte, Auswahl, Aktionsstatus und Phasenanzeige spiegeln jeweils denselben Core-State wider; Auswahl allein löst keine Partieaktion aus | UI-Checkpoints gegen Core-Replay vergleichen |
| QA-LEG-01 | Legacy-Pfad getrennt erhalten | Bisheriger Spielpfad unverändert verfügbar | IRON DUST und ATLAS/PROVING GROUNDS lokal mit ihren eigenen Szenario-Referenzen durchspielen; UNIT TRIAL optional als Zusatzsmoke | Legacy-Pfad bleibt verfügbar und seine bestehenden Szenario-/Sonderregeln verhalten sich wie vor dem neuen Schnitt | Eigene Legacy-Fixtures und Vergleich |

## Offene Fragen für den Architekturvertrag / Beads

Keine offenen Fragen für die vereinbarte Core-v1-Abnahme. Der D-Treffer wird mit `disabled=true` bei unverändertem HP 2 geprüft; eine Deaktivierungsdauer gehört nicht zu diesem Minimalzustand. Die vollständige Replay-Gleichheit umfasst serialisierbaren State einschließlich `rng`, Events und Ablehnungsdetails.

## Separater Regression-/Später-Test (nicht Teil der Core-v1-Abnahme)

- GEV-Aktionen und GEV-spezifische Einheitenregeln.
- Transport/Laden/Entladen und Passagieraktionen.
- AUTO-Fortschaltung und AUTO-spezifische Bestätigungsabläufe.
- Legacy-Spielpfad: Szenarien, Sonderregeln und UI-Dialoge. Dieser Pfad bleibt als eigener Vergleich erhalten; sein Verhalten ist keine Abnahmebedingung für den ersten Core-v1-Schnitt.
- Weitere Einheiten, Sonderwaffen und noch nicht in der Zwei-Typen-Fixture enthaltene Regeln.

Die kanonische Fixture, der Vertrag, Seed, Replay-Sollwerte und Legacy-Szenario-Referenzen wurden durch die Architekturkoordination geliefert und sind hier eingetragen. Die Legacy-Regression verwendet eigene Szenario-Referenzen statt der Zwei-Typen-Fixture. Der Shell-Start ist weiterhin gestört; Beads-Status und Notes pflegt deshalb die Architekturkoordination.
