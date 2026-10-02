# Core-Vertrag v1 — Integrationsnotizen

Import: `src/core/game-core.mjs` exportiert `createGame(scenario, seed)`,
`dispatch(state, command)`, `queryAreas(state, unitId)` sowie die gemeinsame
`referenceScenario`, `REFERENCE_SEED` und `referenceCommands`. Der Developer kann
dieselbe Fixture für den Mock importieren. Auswahl ist ausschließlich ViewState.

`GameState`: `rulesVersion`, `scenarioVersion`, `map: { width, height, terrain }`,
`units`, `activeTeam`, `phase`, `turn`, `victory`, `rng`. Keine Instanzen/DOM/Timer.
Alle Koordinaten sind `{ x, y }` im vorhandenen odd-row-Hexraster. Die Arrays
`movementReachable`, `fireRange` und `lineOfSight` enthalten Koordinatenobjekte;
`attackableTargets` enthält Einheiten-IDs. `movementReachable` ist nur während
der passenden aktiven Bewegungsphase gefüllt. Die anderen zwei geometrischen
Abfragen bleiben auch nach verbrauchter Aktion verfügbar. Sichtblockierendes
Gelände ist selbst sichtbar, verdeckt aber Zellen dahinter.

`dispatch` liefert `{ state, events }` oder `{ error: { code, details } }`.
Ablehnungen verändern den übergebenen Zustand und den Seed nicht. `Move` nutzt
`to`, `Fire` nutzt `targetId`, alle Befehle `playerId`, aktionsbezogene Befehle
zusätzlich `unitId`. `EndPhase` läuft movement → fire → gev → anderes Team;
nach dessen gev-Phase beginnt die nächste Zugnummer. Im ersten Schnitt steuert
der Aufrufer auch das feindliche Team mit Befehlen; KI gehört nicht zum Core.

## Vertragsklärung vor Integration

- `Load`/`Unload` sind als Befehlstyp erkannt, aber mangels Transporttyp im
  vereinbarten Zwei-Typen-Schnitt mit `UNSUPPORTED_COMMAND` abgelehnt. Eine
  spätere Erweiterung braucht Frachtdaten und Phasenregeln im Vertrag.
- Legacy-`dist`, `rules.mjs` und Core verwenden dieselbe odd-row-Hexdistanz.
  Legacy-LOS tastet weiter eine Pixelgerade ab; ihre historische Abtastzahl
  bleibt bis zur Entscheidung über Grenzlinien zwischen zwei Hexfeldern erhalten.
- Falls die UI auch für gegnerische oder bereits bewegte Einheiten eine
  hypothetische Bewegungsfläche anzeigen soll, braucht sie einen getrennten
  Preview-Modus. `movementReachable` bleibt gemäß ARCH-01 bei legalen Zielen.
- Renderer-Picking ist in ARCH-01 nur als Hex/Einheiten-ID beschrieben. Vor CE-03
  sind Priorität bei überlagernden Markern und die ViewState-Eingabe zu klären.
- Der zeitgleich entstandene `src/app/mock-core.mjs` benutzt derzeit
  Spalten-Parität für Nachbarn statt der Zeilen-Parität aus `game.js`, nur zwei
  Phasen, `winner` statt `victory` und eine skalare `rng` statt `{seed,state}`.
  Der Adapter benötigt vor Core-Austausch einen Abgleich; die gemeinsame
  Fixture-Datei selbst ist bereits importiert.

## Zweiter Schnitt: Phasen und Erholung

`game-core.mjs` exportiert zusätzlich `phaseScenario`, `PHASE_SEED`,
`phaseCommands`, `expectedPhaseTrace`, `expectedPhaseReplay` und `replayPhase()` aus der unabhängigen
`phase-v2`/`core-v2`-Fixture. `replayPhase()` hat die gleiche Form wie
`replayReference()`: `{ initialState, steps, finalState }`. Jeder Schritt enthält
`{ command, result }`, auch bei abgelehnten Befehlen. `expectedPhaseTrace` enthält
je Befehl `[Ereignistypen oder Fehlercode, Phase, aktives Team, Zugnummer]`.
`expectedPhaseReplay` ist das feste vollständige Orakel in
`phase-expected.mjs`: Anfangszustand, Befehle, alle Ergebnisse mit Ereignisinhalt,
Fehlerdetails und RNG sowie Endzustand. Die separaten Szenarien und Befehlsfolgen
in `phase-branches.mjs` decken gegnerisches D, zweites D, Infanterie-D und einen
Terrain-/Sichtlinienfall ab; ihre Namen und Seeds werden über `game-core.mjs`
exportiert.

`createGame` initialisiert für beide Versionen je Einheit `disabledUntil: 0`.
Ein D gegen ein noch einsatzfähiges Fahrzeug setzt `disabled` und
`disabledUntil` auf `turn + 1` bei einem Spielerangriff bzw. `turn + 2` bei einem
Gegnerangriff. Das getroffene Team bleibt bei seiner unmittelbar folgenden
Aktivierung deaktiviert. Beim späteren fälligen Teamstart wird die Einheit
wieder einsatzbereit. Dieser `EndPhase`-Übergang gibt zuerst je erholter Einheit
`{ type: 'UnitRecovered', unitId, activeTeam, turn }` und danach genau ein
`{ type: 'PhaseChanged', from, to, activeTeam, turn }` zurück. `ShotResolved`
behält seine bisherigen Felder; die Fälligkeit ist im serialisierbaren
Einheitenzustand nachzulesen. Persistierte Spielstände sind derzeit kein
unterstützter Produktpfad.

## Reine Aktionsabfragen für die UI (CE-06)

`queryCommand(state, command)` verwendet dieselbe nicht mutierende
Vorprüfung wie `dispatch`. Das Ergebnis ist `{ available: true }` oder
`{ available: false, error: { code, details } }`. Bei einem konkreten `Move`
oder `Fire` entspricht `error` exakt der Ablehnung von `dispatch`; die Query
führt weder den Befehl noch einen Würfelwurf aus. Auch `EndPhase` kann damit
geprüft werden.

`queryActions(state, unitId?)` liefert `{ units, endPhase }`. Ohne `unitId`
enthält `units` alle IDs, sonst nur die angefragte ID. Jede Einheit hat
`move: { available, reason, targets }` und
`fire: { available, reason, targetIds }`. Ziele stammen aus `queryAreas` und
sind bei gesperrter Aktion leer. `reason` ist ein stabiler Core-Code oder
`null`, niemals lokalisierter Text. Zustands-/Phasensperren verwenden die
bestehenden Dispatch-Codes (`GAME_ENDED`, `NOT_ACTIVE_TEAM`,
`UNIT_NOT_FOUND`, `UNIT_DESTROYED`, `UNIT_DISABLED`, `UNIT_EMBARKED`,
`WRONG_PHASE`, `GEV_ONLY`, `ACTION_SPENT`); nur bei sonst legaler, aber
zielloser Aktion meldet die Übersicht `NO_REACHABLE_HEX` beziehungsweise
`NO_ATTACKABLE_TARGET`. Für einen konkreten Zielversuch liefert
`queryCommand` weiterhin den genauen Dispatch-Fehler und dessen Details.

`endPhase` ist `{ available, reason, pendingUnitIds, next }`.
`pendingUnitIds` enthält die lexikografisch sortierten IDs der aktiven
Einheiten mit tatsächlich legalem Ziel in der aktuellen Phase. Diese Liste
informiert einen Bestätigungsdialog; `EndPhase` bleibt auch mit offenen
Aktionen legal. `next` enthält `{ phase, activeTeam, turn }` gemäß dem
tatsächlichen Übergang oder `null` nach Spielende. Beide Queries ändern
weder `GameState` noch RNG oder Ereignisse. Der Core liefert keine
UI-Sprache, Dialoge oder ViewState-Felder.
