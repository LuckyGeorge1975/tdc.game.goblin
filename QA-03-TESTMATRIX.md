# QA-03 – Unabhängige Testmatrix für modularen Schnitt 2

Stand: 2026-09-30 · Grundlage: `ARCHITECTURE_SLICE_2.md`, `RULE_MATRIX.md`, `QA-01-TESTMATRIX.md` und `src/core/CONTRACT.md`. **Testplanung, keine Integrationsabnahme.** QA-04 beginnt erst nach CE-04 und DEV-06.

## Testdaten und Protokoll

Die verbindliche Fixture liegt inzwischen in `src/core/phase-fixture.mjs`: `phaseScenario`, `PHASE_SEED = 5`, `phaseCommands` und `expectedPhaseTrace`. Sie hat `scenarioVersion: phase-v2`, `rulesVersion: core-v2`, eine leere Terrain-Liste auf 8×6 Hexfeldern und vier Einheiten: `p-gev` auf (1,1), `p-tank` auf (1,4), `e-tank` auf (4,4) und `e-core` auf (7,5). Der lokale Vergleichspfad muss exakt diese Exporte verwenden. Der bestehende `core-v1`-Seed `0x0b11a1` und dessen Soll-Trace sind separate Regression. **Die Fixture und der Core werden hier nur gelesen, nicht abgenommen.**

Für alle Tabellen gilt: `P` = Spieler, `E` = Gegner, `S` = `p-gev` (`movementMode: 'gev'`), `V` = `p-tank`, `T` = `e-tank`, `I` = Infanterie in einem separaten D-Fall. Die festen Koordinaten aus `phaseCommands` sind `M1=(2,1)`, `M2=(3,1)`, `G2=(5,1)` als zu teures Ziel von M1, `G1=(4,1)` als legaler GEV-Zug und `G3=(5,1)` als weiterer Zug nach G1. Der legale D-Schuss ist `Fire(P,p-tank,e-tank)` in P/fire/turn 1; Seed 5 und erwarteter Trace dokumentieren `ShotResolved`, der D-Ausgang und genaue Rollwert sind für QA-04 am Core-Ergebnis zu bestätigen. Für Ablehnungen sind Ergebnis `{ error: { code, details } }`, unveränderter **vollständiger serialisierbarer Eingabe-State inklusive `rng`**, unveränderte Fixture und keine Events zu protokollieren. Fehlercodes werden gegen den dokumentierten `core-v2`-Vertrag abgeglichen.

Ein `EndPhase`-Schritt erwartet genau ein `PhaseChanged` mit `from`, `to`, `activeTeam` und `turn`; alle anderen Events werden je Befehl in Reihenfolge gezählt. Auswahl, Fokus und Overlay-Umschaltung sind ViewState und dürfen weder `dispatch` auslösen noch GameState/RNG ändern. Zwei vollständige Replays werden bytegleich nach Serialisierung von Anfangs-State, Befehlen, Ergebnissen, Events, Fehlerdetails und End-State verglichen.

## Core-Orakel: Hauptfolge

| ID | Reproduzierbare Befehlsfolge ab frischer Fixture | Erwarteter State und Ereignisse |
| --- | --- | --- |
| C2-INIT | `createGame(phaseScenario, PHASE_SEED)` | `phase-v2`/`core-v2`, `P/movement/turn=1`; `moved`, `fired`, `secondMoved` und D-Fälligkeit aller Einheiten deterministisch initialisiert; RNG aus Seed. |
| C2-M01 | `Move(P,S,M1)` | Nur `S` steht auf `M1`, `moved=true`, `secondMoved=false`; genau ein `UnitMoved` mit Phase `movement`; RNG unverändert. |
| C2-M02 | Direkt danach `Move(P,S,M2)` | Ablehnung `ACTION_SPENT`; keinerlei Änderung an State, RNG oder Events. `queryAreas(S).movementReachable=[]`. |
| C2-P01 | `EndPhase(P)` | `P/fire/turn=1`, genau ein `PhaseChanged(movement→fire)`. `Move(P,S,...)` wird mit `WRONG_PHASE` abgewiesen, ohne Zustand/RNG zu ändern. |
| C2-F01 | `Fire(P,p-tank,e-tank)` | `ShotResolved` mit Roll 2, Quote `1-1`, Ergebnis D, HP 3→3; RNG `5→1022226848`, `e-tank.disabled=true` und `disabledUntil=2`. |
| C2-P02 | `EndPhase(P)` | `P/gev/turn=1`, genau ein `PhaseChanged(fire→gev)`; weder Schuss noch bloße Auswahl ändert die Phase. |
| C2-G01 | `queryAreas(S)`, dann `Move(P,S,G2)` | `G1` enthalten, `G2` nicht enthalten; `G2` mit `UNREACHABLE` abgewiesen, State/RNG/Events unverändert. Die Bewegungskosten werden für tatsächlichen Pfad und Area identisch bestimmt. |
| C2-G02 | `Move(P,V,legales Nachbarfeld)` in `gev` | Ablehnung `GEV_ONLY`, selbst wenn `V` noch nicht in `movement` bewegt wurde; State/RNG/Events unverändert. |
| C2-G03 | `Move(P,S,G1)` | `S` steht auf `G1`, `secondMoved=true`, `moved=true` aus C2-M01 bleibt bestehen; genau ein `UnitMoved` mit Phase `gev`, Kosten ≤2, RNG unverändert. |
| C2-G04 | `Move(P,S,G3)` | `ACTION_SPENT`; keine Zustands-/RNG-/Eventänderung; `queryAreas(S).movementReachable=[]`. |
| C2-T01 | `EndPhase(P)` | `E/movement/turn=1`, ein `PhaseChanged(gev→movement)`; nur E-Aktionsflags zurückgesetzt. P-Flags und Positionen bleiben. |
| C2-T02 | `EndPhase(E)` zweimal, dann `EndPhase(E)` | E durchläuft `fire`, `gev`, dann `P/movement/turn=2`; je genau ein `PhaseChanged`, Zugnummer steigt ausschließlich beim letzten Schritt. Erst beim Aktivieren von P werden P-Aktionsflags zurückgesetzt. |

**Abzweig S0:** Von frischem Start `EndPhase(P)` zweimal ohne ersten Skimmerzug, dann `Move(P,p-gev,(3,1))` (Kosten 2 vom Start (1,1)). Der Move gelingt und setzt nur `secondMoved=true`; `moved=false` bleibt. Ein ausgelassener erster Move sperrt GEV nicht. Dieser Zweig verwendet einen eigenen frischen State und verändert den Haupt-Trace nicht.

**Negativvektoren N0:** In passenden frischen States `Move` durch falsches Team (`NOT_ACTIVE_TEAM`), durch deaktiviertes Fahrzeug (`UNIT_DISABLED`), durch zerstörte Einheit (`UNIT_DESTROYED`), außerhalb der Karte (`OUT_OF_BOUNDS`) und auf belegtes/unpassierbares Ziel (`UNREACHABLE`) prüfen. Für jede Ablehnung vollständigen State/RNG-Deep-Compare vor/nach `dispatch` und null Events. Eine zerstörte Einheit kann eine gesonderte Fixture-Abzweigung erfordern. Codes gelten, sofern der dokumentierte v2-Vertrag sie beibehält.

## D-Treffer und Erholung

Die D-Fälle verwenden **separate frische Fixture-Abzweige** mit dokumentierten Seeds und Schussfolgen; ein früher Sieg darf die nötigen Teamwechsel nicht abbrechen. `Fire` bleibt ausschließlich in `fire` legal. Der Trefferstatus enthält das serialisierbare Feld `disabledUntil`; bei Erholung wird es auf 0 gesetzt. Der Core nennt das Ereignis `UnitRecovered` mit `unitId`, `activeTeam`, `turn` vor `PhaseChanged` im selben Übergang. Diese Angaben stammen aus dem aktuellen Core-Stand und sind vor UI-Integration mit dem Architektenvertrag abzugleichen.

| ID | Ablauf | Core-Orakel |
| --- | --- | --- |
| C2-D01 | `P/movement→fire`; legaler `Fire(P,Angreifer,T)` mit dokumentiertem D-Wurf | Genau ein `ShotResolved(D)`; Fahrzeug-HP unverändert, `disabled=true`, Fälligkeit `turn+1`. `Move`/`Fire` durch T bei seiner unmittelbar folgenden E-Aktivierung abgewiesen; keine RNG-Änderung bei Ablehnung. |
| C2-D02 | Nach C2-D01 Phasen mit `EndPhase` bis `E/movement/turn=1`, danach bis `P/movement/turn=2`, dann `E/movement/turn=2` | T bleibt während E-Turn 1 deaktiviert. Erholung erfolgt **erst** beim Eintritt in E-Turn 2, zusammen mit dem Reset der E-Aktionsflags; `disabled=false`, Fälligkeit gemäß Vertrag geleert/fortgeschrieben, nur ein dokumentiertes Recovery-Event falls vorgesehen. Wiederholtes Rendern erzeugt kein weiteres Event. |
| C2-D03 | Frischer Zweig: E trifft P-Fahrzeug in `E/fire/turn=n` mit D; bis zum nächsten P-Teamstart und danach bis `P/movement/turn=n+2` schalten | Fälligkeit `n+2`; beim unmittelbar nächsten P-Einsatz noch `disabled=true` und Handlungsverbot. Erst beim P-Teamstart `n+2` Erholung und Flag-Reset im selben Übergang. |
| C2-D04 | Frischer Zweig: zweiter dokumentierter D-Treffer auf dasselbe noch deaktivierte Fahrzeug | HP wird 0; keine spätere Wiederbelebung bei Fälligkeit. `ShotResolved` und ggf. `GameEnded` je genau einmal. |
| C2-D05 | Frischer Zweig: D auf Infanterie `I` | HP sinkt genau um 1; keine Fahrzeug-Deaktivierung und keine D-Fälligkeit. |

## Areas, Replay und Regression

| ID | Prüfung | Orakel |
| --- | --- | --- |
| C2-A01 | `queryAreas(S)` vor Move, nach Movement-Move, in `fire`, in `gev`, nach GEV-Move, bei falschem Team und bei `disabled` | `movementReachable` nur für die aktive, passende und unverbrauchte Aktion; in GEV ausschließlich S-Ziele mit realen Pfadkosten ≤2. Jedes angebotene Ziel wird von `Move` akzeptiert; jedes getestete nicht angebotene Ziel wird abgelehnt, sofern nicht ein anderer Validierungsfehler früher greift. |
| C2-A02 | `queryAreas(S/V)` in denselben States mit Ziel hinter LOS-Blocker und Ziel in Reichweite | `fireRange` und `lineOfSight` bleiben getrennte geometrische Mengen; blockierendes Feld selbst sichtbar, dahinter liegendes nicht. `attackableTargets` nur während erlaubter Feuerphase und für sichtbare, lebende Gegner in Reichweite; verbrauchtes Feuer und `disabled` ergeben `[]`. |
| C2-R01 | Hauptfolge und D-Zweige je zweimal ab gleichem Seed ausführen | Identische vollständige States, RNG, Events, Ablehnungsdetails und Reihenfolge; keine Timer-/Animationsabhängigkeit. |
| C1-R01 | Unverändertes `replayReference()` mit `core-v1`/`reference-v1` und Seed `0x0b11a1` | Bisheriger Soll-Trace aus QA-01 bleibt grün, einschließlich Movement-Ablehnung, D-Treffer und Spielende. Keine Umdeutung der alten Fixture. |

## Sichtbare UI-Checkpoints auf `localhost`

Für jeden Checkpoint werden Screenshot oder DOM-Werte, sichtbarer Vorher-/Nachher-Zustand und zugehöriger Core-State-/Event-Auszug festgehalten. Die lokale Vergleichsseite startet unter `http://127.0.0.1:4173/src/app/compare.html?path=phase` dieselbe `phase-v2`-Fixture mit Seed 5. Der Test-Harness im `#game-frame`-Iframe bietet `contentWindow.__goblinHarness`: `fixtureCommands()` für die Core-Folge, `dispatch(command)` auch für explizite Enemy-Befehle, `snapshot()` für Core-/ViewState und `trace()` für Befehle samt Ergebnis, Events und anschließendem State. Der Harness ist eine Testhilfe; QA-04 prüft zusätzlich die sichtbaren UI-Aktionen unabhängig.

| ID | Bedienung | Sichtbarer Sollzustand |
| --- | --- | --- |
| U2-01 | Fixture starten, S wählen, Overlay zwischen Movement/Fire/LOS wechseln, Fokus ändern | Karte/Unit Intel zeigen S und Startposition; Overlay-Mengen entsprechen jeweils `queryAreas`; bloße ViewState-Wechsel ändern keinen Core-State, RNG oder Combat Log. |
| U2-02 | S nach M1 bewegen und nochmals Bewegung versuchen | Marker/Intel auf M1; MOVE-Bereitschaft sinkt nach dem ersten Befehl. Zweiter Befehl bleibt abgewiesen, Position und Log bleiben stabil; kein doppeltes `UnitMoved`. |
| U2-03 | Zweimal Phase weiterschalten | Titel/Button/Bereitschaftszähler zeigen nacheinander `fire`, `gev` und aktives Team/Zugnummer aus Core. Ein UI-Klick bewirkt höchstens einen `EndPhase`/`PhaseChanged`; Render/Fokus spielen das Ereignis nicht erneut. |
| U2-04 | In GEV S wählen, G2 prüfen, G1 ausführen, G3 versuchen; V wählen | GEV-Overlay bietet G1 und nicht G2; G1 bewegt S genau einmal, SKIMMER-Bereitschaft sinkt, weiterer GEV-Zug und V-Zug ändern Karte/Log nicht. Auch S ohne erste Bewegung ist im separaten S0-Zweig bereit. |
| U2-05 | P-GEV und alle E-Phasen explizit beenden | Titel, Button, Team, Runde und Bereitschaftszähler stimmen an jeder Grenze mit Core überein; Flags des inaktiven Teams bleiben bis zu dessen Aktivierung erhalten. |
| U2-06 | D-Zweige nach dokumentiertem Wurf durchspielen | Ziel zeigt `DISABLED`, HP/Fälligkeit im Core wie oben; Handlungsversuch ohne State-/RNG-Wechsel. Beim richtigen Teamstart wieder einsatzbereit und Bereitschaft korrekt; Combat Log/Recovery-Hinweis nur einmal je Core-Event, auch nach Auswahl-/Overlay-Render. |
| U2-07 | Dieselbe UI-Folge nach Neustart ein zweites Mal | Gleiche sichtbaren Checkpoints und Core-Replay-Auszüge; kein abweichender Würfelwurf oder zusätzlicher Eventeintrag. |

## Legacy-Smokes und Abnahmegrenze

`IRON DUST` und `ATLAS / PROVING GROUNDS` lokal über den **Legacy-Umschalter** mit ihren eigenen Szenario-Referenzen starten. Je Szenario prüfen: Karten- und Unit-Guide-Laden, Selektion und Intel, einen legalen Movement-Zug, Übergang `movement→fire→gev→Hostile`, einen Schuss/Combat-Log-Eintrag und erneute Bedienbarkeit nach Gegnerzug. Bei IRON DUST das Command-Core-Ziel, bei ATLAS die vorläufige „alle Gegner“-Bedingung nur soweit im kurzen Smoke erreichbar beobachten. Ergebnis und Build/URL separat protokollieren. Diese Smokes belegen Verfügbarkeit und grundlegende Bedienbarkeit, **keine vollständige Regel-, KI-, Hexdistanz-, Spezialisten- oder Szenarioparität**.

QA-03 schließt mit dieser Matrix. QA-04 bleibt bis zum Abschluss von CE-04 und DEV-06 offen; erst dann Core-Tests, zwei Browserdurchläufe, Eventzählung und Legacy-Smokes tatsächlich ausführen. Offene Abweichungen bei Legacy-Hexdistanz oder KI gesondert melden und nur dann als Blocker werten, wenn sie vereinbarte Befehle oder Anzeige des zweiten Schnitts verfälschen.

## QA-04-Vorbereitung und Gate

Die am 2026-09-30 ergänzten Core-Exporte schließen die bisherigen Orakel-Lücken: `expectedPhaseReplay` in `src/core/phase-expected.mjs` enthält sämtliche Soll-States, RNG-Werte, Fehler und Event-Nutzlasten; `src/core/phase-branches.mjs` enthält `enemyD`, `secondD`, `infantryD` und `terrainLos` mit Seeds und Befehlen. `replayPhase()` liefert `{initialState,steps,finalState}`. QA-04 vergleicht den Harness-Trace zweimal mit `expectedPhaseReplay` und prüft die Zweige jeweils gegen deren Regeln und sichtbare Checkpoints. Der oben dokumentierte Harness schließt den offenen Bedien- und Trace-Zugriff.

**Gate:** CE-04 und DEV-06 sind laut Beads geschlossen. Der unabhängige Integrationsdurchlauf, Browserprüfung und Legacy-Smokes beginnen erst nach ausdrücklicher Testfreigabe durch den Architekten. Bis dahin bleiben alle QA-04-Ergebnisse unbewertet.
