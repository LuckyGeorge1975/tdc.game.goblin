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

## Profilgebundener Startvertrag (Slice 3a)

Neue Core-Partien haben zunächst genau eine erlaubte Vertragskombination:
`rulesVersion: core-v3-profile-v1`, `scenarioId: core-profile-probe`,
`scenarioVersion: profile-probe-v1`, `ruleProfileId: FIELD_TEST_LEGACY_v1`.
Der zugehörige `effectiveRules`-Snapshot enthält `schemaVersion: 1`,
`objective: enemy-core` und `movement.gevSecondMove: 2`. Diese Probe verwendet
die vorhandene Core-Mechanik und ist kein neues Browser-Level oder ein
Vollkatalogstart. `createGame` validiert den vollständigen Kopf und alle
Snapshot-Felder vor dem Anlegen eines Zustands, klont den Snapshot und friert
ihn rekursiv ein. Jeder `dispatch`-Vorcheck validiert erneut; ausgegebene
Folgezustände tragen wieder einen eingefrorenen Snapshot. Unbekannte oder
fehlende Regel-/Produktprofile melden `UNSUPPORTED_RULE_PROFILE`, eine
unzulässige Szenariopaarung `SCENARIO_PROFILE_MISMATCH`, veränderte
Regelparameter `RULE_SNAPSHOT_MISMATCH`. Beim Start werden diese Codes als
Exception-Eigenschaft `code` geliefert, bei Befehlen als `{error:{code,details}}`.

Die sechs ausdrücklich historischen Fixture-Paare von `core-v1/reference-v1`
und `core-v2/phase-v2` samt vier benannten Ablegern bleiben ohne neue
Pflichtfelder und unveränderter Mechanik erhalten. Die Probe bindet noch keinen
Save-/Replay-Import, kein Legacy-`game.js`, keinen Live-Guide und keinen
Skimmer-Zielentwurf. Weitere Produkt-/Szenariopaare benötigen einen eigenen
Vertrags- und Testabschnitt; `FULL_CATALOG_v1` bleibt inaktiv.

## Supercover-Probe (goblin-9bj.28, Stufe B)

Die zusätzliche, ausschließlich im Core-Test erzeugte Kombination
`core-v4-supercover-v1` / `core-supercover-probe` /
`supercover-probe-v1` / `CORE_SUPERCOVER_PROBE_v1` verlangt im effektiven
Snapshot `losMode: strict-supercover`. Nur diese Regelversion prüft Sichtlinien
mit `supercoverIntermediateHexes` aus `supercover-line.mjs`: alle berührten
Zwischenhexe zählen, auch beide Seiten einer exakten Grenzkante; Start und
Ziel sind ausgenommen. `queryAreas` und `Fire` verwenden dieselbe
`hasLineOfSight`-Auswahl. Die unveränderte Reichweite bleibt eine separate
Prüfung. Der Profilvertrag weist fehlende oder abweichende Kopf-/Snapshotdaten
vor Spielstart beziehungsweise Befehlsausführung zurück.

`core-v1`, `core-v2` und `core-v3-profile-v1` behalten ihre bisherige
Rundungs-LOS-Semantik und ihre vorhandenen Fixture-/Replay-Daten. Die Probe
ist weder Default noch Browser-Level; eine Übernahme in neue produktive
Szenarien sowie Replay-Import/Export erfordern einen gesonderten versionierten
Vertrag und QA.

## Profilgebundener Replay-Umschlag (Slice 3b.1)

`src/core/replay-contract.mjs` unterstützt ausschließlich die exakte
`core-v3-profile-v1`-/`core-profile-probe`-/`profile-probe-v1`-/
`FIELD_TEST_LEGACY_v1`-Kombination. Der JSON-Umschlag enthält eine eigene
`replaySchemaVersion: 1`, den vollständigen Profilkopf mit `effectiveRules`,
einen tief kopierten Anfangsszenario-Snapshot (`map`, `units`), einen
32-Bit-Seed und geordnete Befehle. Ein FNV-1a-64-Fingerabdruck des kanonisch
serialisierten Szenarios erkennt versehentliche Snapshot-Drift; er ist keine
Echtheitssignatur. Kein Replay lädt Regeln aus dem aktuellen Katalog nach.

`validateProfileReplay` prüft den gesamten Umschlag vor `createGame`,
`dispatch` oder RNG-Verbrauch. Fehlende/abweichende Profil- und Snapshotdaten,
ungültige Seeds/Befehle sowie Core-v4/FULL_CATALOG werden mit
`REPLAY_PROFILE_MISMATCH` abgewiesen; unbekannte Replay-Schemaversionen mit
`UNSUPPORTED_REPLAY_VERSION`. `recordProfileReplay` erstellt eine eingefrorene
Kopie, `playProfileReplay` liefert `{initialState,steps,finalState}` mit
deterministischen Ereignissen und regelkonformen Ablehnungen. Das Modul
verändert weder `replayReference`/`replayPhase` noch deren historischen
Core-v1/v2-Vertrag. Es gibt keinen Browser-Import, kein Savegame und keine
produktive Levelzuordnung; weitere Profilpaare brauchen eigene Zulassung.

## Technische IRON-DUST-GEV-Probe (goblin-9bj.19.5)

`core-v5-iron-dust-gev-probe-v1` / `core-iron-dust-gev-probe` /
`iron-dust-gev-probe-v1` / `CORE_IRON_DUST_GEV_PROBE_v1` ist nur eine
Bewegungsprobe. `makeIronDustGevProbeScenario()` übernimmt die unveränderte
IRON-DUST-v1-Karte und ausschließlich den Quell-Skimmer `id: gev` sowie einen
inerten feindlichen Kern aus dem validierten, inaktiven Datensnapshot. Nur bei
diesem exakten Szenario und Profil leitet `createGame` im geklonten Zustand
`movementMode: gev` ab. Die Quell-Unit bleibt unverändert. Die Probe erlaubt
Bewegung nur für `gev` und Phasenwechsel; `Fire` und Bewegungen anderer Units
melden `UNSUPPORTED_COMMAND`. Das Gelände enthält acht `rubble-field`-Zellen
mit Kosten 2 und sonst `open-ground` mit Kosten 1. Der Skimmer erhält 3 Felder
in der Bewegungs- und 2 in der GEV-Phase. Kopf und Quellsnapshot werden vor
Spielstart geprüft; `dispatch` prüft den Kopf erneut vor jeder Aktion.

Diese Probe ist kein `FIELD_TEST_LEGACY_v1`-Core-Level, kein Replay-Profil und
kein Browser-Start. Sie aktiviert weder Siegebreaker-/LOS-/Zielregeln noch
FULL_CATALOG. Historische v1/v2-Fixtures und v3/v4-Probes bleiben getrennt.

## Technische IRON-DUST-Pixel-LOS-Probe (goblin-9bj.19.6)

`iron-dust-legacy-pixel-los-v1` ist ein eigener, nicht ausführbarer
Sichtlinien-Selektor für die exakt validierte IRON-DUST-v1-Karte. Er kopiert die
12×8-Karte mit acht `rubble-field`-Zellen aus dem inaktiven Datensnapshot,
prüft Version, Profilquelle, Modus und Karte und verwendet die heutige
`FIELD_TEST_LEGACY_v1`-Abtastung aus `game.js`: Hexmitten mit Radius 34,
8-fache Schrittzahl, nächstes Hex per Pixelabstand und
`TerrainRules.blocksLos` nur für Zwischenhexe. Start- und Zielhex blockieren
nicht. Ungültige Koordinaten werden vor der Abtastung abgewiesen. Die
bidirektionalen Testvektoren vergleichen die neue reine Funktion direkt mit
den ausgeführten Legacy-Funktionen, einschließlich einer Grenzlinie, die das
separate strenge Supercover anders beurteilt.

Die Probe hat keinen `rulesVersion`-/`effectiveRules`-Kopf und ist nicht in
`createGame`, `queryAreas`, `Fire` oder Replay eingehängt. Die GEV-Bewegungsprobe
weist `Fire` weiterhin ohne State-/RNG-Änderung ab. Ein gemeinsamer Fire- und
Query-Preflight wartet auf den Siegebreaker-, Ziel- und Profilvertrag. Die
Supercover-Probe v4 und die offene Produktentscheidung zu Grenzkanten werden
nicht umgedeutet.

## Technische IRON-DUST-Waffenprobe (goblin-9bj.19.8)

`iron-dust-siegebreaker-weapons-v1` inventarisiert ausschließlich die vier
Siegebreaker-Waffen aus dem validierten, inaktiven IRON-DUST-v1-Datensnapshot.
Die reine Probe prüft Attacke, Reichweite, Infanterieziel, Auswahl und
Bereitschaft, zählt Feuerbudget pro Waffe, verbraucht Raketen dauerhaft und
setzt die Phasenbudgets zurück. Sie verwendet die getrennt geprüfte
Legacy-Pixel-Sichtlinienprobe für hypothetische Zielabfragen.
`SpendWeaponBudget` verbraucht **nur Inventar**, löst keinen Kampf, Treffer,
Systemschaden oder RNG-Wurf aus. Eingabezustände werden vor jedem Schritt
validiert; abgelehnte Befehle verändern weder Zustand noch Seed. Tests
vergleichen Inventar- und Zielregeln direkt mit den benannten Funktionen aus
`ogre-systems.js` und `siegebreaker-weapons.js`.

Die Probe ist nicht ausführbar und hat keinen `rulesVersion`-/
`effectiveRules`-Kopf. Sie ist kein `Fire`-Befehl, kein Core-/Replay-Profil und
kein Levelstart. Systemabwehr, Laufwerke, tatsächliche Treffer und Siegziel
bleiben getrennte Gates. Die globale Siege-Tank-/Artillerie-Regel und
`FULL_CATALOG_v1` werden nicht berührt.

## Technische IRON-DUST-Systemtrefferprobe (goblin-9bj.19.9)

`iron-dust-siegebreaker-systems-v1` führt für den festen, inaktiven
IRON-DUST-Datensnapshot genau die Legacy-Systemauflösung nach einem bereits
angenommenen Angriff aus: Systemzielwahl, Würfel/CRT, `D` ohne Systemverlust,
`X` auf Waffen oder Laufwerke, die Laufwerksschwellen 31/16/1/0 sowie die
Synchronisation von Bewegung und HP bei Hilflosigkeit. Der feste Seed nutzt
die deterministische Core-Zufallsfolge; Tests speisen denselben Wurf in
`ogre-runtime.js` und vergleichen die Ergebnisse direkt. Abgelehnte Befehle
verbrauchen keinen Zufallswert und verändern den Zustand nicht.

Die Probe prüft keine Entfernung, Sichtlinie, Feuerphase oder Angriffserlaubnis.
Sie ist kein Core-`Fire`, kein Replay-Profil und kein Levelstart; Rammen und
Produktentscheidungen zu Siege-Tank/Artillerie bleiben gesondert.

## Technische IRON-DUST-Rammprobe (goblin-9bj.19.10)

`iron-dust-siegebreaker-ram-v1` bildet nur den bestehenden Rammzweig des
Legacy-Klickpfads ab. Ein ausgewählter, noch nicht bewegter Siegebreaker darf
in der Spieler-Bewegungsphase einen lebenden Nicht-Kerngegner auf einem mit
seinem Bewegungsbudget erreichbaren Hex rammen. Danach steht er auf dem Zielhex,
ist bewegt und hat gehandelt; das Ziel hat HP 0. Der Rammstoß verbraucht keinen
Zufallswert. Tests vergleichen Weg und Einheitenfolgen mit den tatsächlichen
`game.js`-Funktionen. Feste Diagnoseaufstellungen bringen Guard, Raider oder
Core neben den Siegebreaker; der versionierte IRON-DUST-Quellsnapshot bleibt
unverändert.

Die Probe ist inaktiv und trifft keine Sieg-/Niederlagenentscheidung. Sie
aktiviert weder Core-`Move`/`Fire` noch Level, Replay oder Oberfläche.
UI-Auswahl und Hinweise des Klickpfads sind nicht Teil ihres Zustandsvertrags.

## Technische IRON-DUST-Zielprobe (goblin-9bj.19.11)

`iron-dust-core-objective-v1` wertet ausschließlich den validierten
IRON-DUST-Datensnapshot mit `objectiveVersion: 1` und `objective: core` aus.
Die reine Beobachtungsprobe übernimmt HP-Fakten atomar und vergleicht danach
mit `victoryProfile`, `objectiveSnapshot` und `checkVictory` des Legacy-Pfads.
Ein toter Feindkern führt nur bei mindestens einer lebenden Spielereinheit zum
Sieg; sind alle Spielereinheiten tot, ist das Ergebnis auch bei gleichzeitigem
Kerntod eine Niederlage. Andere lebende Gegner hindern den Kernsieg nicht.
Eine hilflose Siegebreaker-Einheit zählt nach Legacy-Systemsynchronisation mit
HP 0 nicht mehr als lebend. Ein bloßes Phasenereignis ändert das Zielergebnis
nicht. Beobachtungen verbrauchen keinen Zufallswert; abgelehnte Beobachtungen
ändern den Zustand nicht.

Die Probe führt weder Kampf-, Ramm- noch Phasenbefehle aus. Sie ist kein
`FIELD_TEST_LEGACY_v1`-Spielpfad, kein Core-/Replay-Profil und kein Levelstart.

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
