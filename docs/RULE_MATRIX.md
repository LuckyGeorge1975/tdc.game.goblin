# G.O.B.L.I.N Regelmatrix

## Aktueller Profilüberblick – 30.10.2026

Der aktuelle lokale Implementierungsstand trennt öffentliche **FULL_CATALOG_v1**-Zulassung und interne **CATALOG_FULL_CANDIDATE_v1**-Belege. Der Kandidat wurde auf `868a156` unabhängig 26/26 geprüft; der FULL-Einstieg wurde auf `e71e1969` anschließend unabhängig abgenommen und als lokaler Snapshot bereitgestellt. Dies ist kein neuer öffentlicher Releasebeleg.

Für beide Profile gelten dieselben fünf exakt gebundenen Szenarien, jeweils scenarioVersion 1 / objectiveVersion 1, core-and-escort, catalog-approved-data-v1, catalog-full-mechanics-v1 und strict-supercover:

| Szenario-ID | Öffentliche Zulassung | Interne historische Zulassung |
| --- | --- | --- |
| catalog-full-atlas | FULL_CATALOG_v1 | CATALOG_FULL_CANDIDATE_v1 |
| catalog-full-terrain-course | FULL_CATALOG_v1 | CATALOG_FULL_CANDIDATE_v1 |
| catalog-full-advance | FULL_CATALOG_v1 | CATALOG_FULL_CANDIDATE_v1 |
| catalog-full-siege | FULL_CATALOG_v1 | CATALOG_FULL_CANDIDATE_v1 |
| catalog-full-specialists | FULL_CATALOG_v1 | CATALOG_FULL_CANDIDATE_v1 |

Kanonischer Datendigest 71acac02581cf0709875bf4656418d493d21a40c5bc74ac4ffeff9b115b2e51a; Levelpaket ff1e209a956dff2cf2ac9c45932e670fec643b0c5451574daf85bb863c5d9c79. Einzelne Mechanik-/Level-/Roster-/Terraindigests und Admissionbelege: [Admissionnachtrag](../reports/CATALOG_FULL_ADMISSION.json). Die [26er-Fähigkeitsmatrix](../reports/CATALOG_FULL_MATRIX.json) bleibt ausdrücklich Candidatebeleg; keine zweite Wertetabelle für 26 Klassen. Die kanonische [genehmigte Registry](../assets/unit-art/rules/unit-profiles.catalog-approved.v1.json) bleibt unverändert, einschließlich targetActive:false; Produktzulassung erfolgt über die exakten Profile.

Im FULL-Profil sind die angenommenen A–G-Familien angebunden: kanonische Klassen-/Bewegungs-/SP-/Frachtwerte, getrennte System-/Waffenslots, Pionieraktionen, Split-/AP-/Spotterfeuer, Tarn-/Sensor-/Kollisionsprojektion, freie Hexrakete und feste Verstärkungen/Limit der jeweiligen Mission. Aussagen unten wie „Split fehlt“, pauschaler Skimmer-Zusatzschritt 2 oder fehlendes Engineering/Hexfeuer/Wellen beziehen sich ausschließlich auf den jeweils historischen Legacy-/Pilotstand, **nicht** auf den aktuellen Vollkatalog. Keine dieser früheren Missionen wird rückwirkend auf neue Regeln umgestellt.

Normales V2 lädt die FULL-Paare ohne Kandidatenflag, intern bleibt die explizite Candidatezulassung verfügbar. Classic und der separate IronDust-Corepfad erhalten keine stillen FULL-Regeln. Die drei festen Lernprofile T01–T03 verwenden separat `TRAINING_FIELD_TEST_v1` mit den ursprünglichen Feldtestwerten und dem Lernziel `learning`. Sie erhalten keine FULL-Regeln. Gebündelter Implementierungs- und Prüfstand: [Training-Handoff](../reports/TRAINING_HANDOFF.md); unabhängige Produktabnahme steht aus.

## Historische und profilgebundene Referenzabschnitte

Die folgenden ursprünglichen Abschnitte bleiben als Stand-/Profilbelege erhalten. Ihre global klingenden Implementierungs- und Lückenaussagen gelten nur im dort benannten älteren Scope. Der aktuelle Gesamtüberblick steht oben.

Stand: 2026-09-28 · Spielbuild: 0.1.12 · Zweck: Referenz für das **tatsächlich implementierte** Verhalten. Katalogwerte und geplante Sonderaktionen sind ausdrücklich davon getrennt.

## 1. Szenarien

| Szenario | Spielziel | Status |
| --- | --- | --- |
| IRON DUST | Command Core ausschalten | Spielbar |
| RELAY RUN | Relaisziel und Eskorte ausschalten | Spielbar |
| UNIT TRIAL | Command Hub und Eskorte ausschalten | Spielbar; Transport und Lenkflugkörper testbar |
| ATLAS / PROVING GROUNDS | Alle Gegner einschließlich Command Core ausschalten | Spielbares Showcase; Spezialistenwerte und Siegbedingung vorläufig |

## 2. Basiseinheiten

| Einheit | Team | HP | Bewegung | Reichweite | Rolle | Status |
|---|---:|---:|---:|---:|---|---|
| GOBLIN SIEGEBREAKER | Spieler | Systeme / 45 Ketten | 3 → 0 | waffenabhängig | Getrennte Waffen, Kettenschaden, Rammen | implementiert |
| SKIMMER SCOUT | Spieler | 3 | 3 | 3 | Schnelles Schwebefahrzeug, Zusatzmanöver | implementiert |
| ROCKET ARTILLERY | Spieler | 3 | 1 | 4 | Artillerie | im Basisszenario spielbar; Katalogwerte können abweichen |
| INFANTRY PLATOON | Spieler | 2 | 2 | 1 | Mobile Infanterie | implementiert |
| GUARD TANK | Gegner | 3 | 1 | 2 | Gegnerische Panzerung | implementiert |
| RAIDER SKIMMER | Gegner | 2 | 2 | 2 | Gegnerisches Schwebefahrzeug | implementiert |
| COMMAND CORE / RELAY NODE | Gegner | 5 / 4 | 0 | 0 | Missionsziel | implementiert |

## 3. G.O.B.L.I.N.-Einheitenkatalog

Die Werte unten bilden den eigenständigen G.O.B.L.I.N.-**Entwurfskatalog**. Die Herkunftsspalte bezeichnet interne Content-Linien und keine Drittprodukte. Im ATLAS-Szenario sind alle 26 Einheitenmotive als generische Einheiten spielbar; die hier genannten Spezialwerte und -aktionen sind nicht automatisch umgesetzt. Der Unit Guide zeigt bei einer Einheit im aktuellen Szenario ihre **Live-Werte**, andernfalls die Katalogwerte.

| Einheit | Angriff / Reichweite | Verteidigung | Bewegung | Quelle | Status |
|---|---:|---:|---:|---|---|
| Assault Tank | 4 / 2 | 3 | 3 | CORE | Grundaktionen in UNIT TRIAL / ATLAS |
| Rocket Artillery | 3 / 4 | 2 | 2 | CORE | spielbar, Prototypwerte abweichend |
| Recon Tank | 2 / 2 | 2 | 3 | CORE | Grundaktionen in UNIT TRIAL / ATLAS |
| Siege Tank | 6* / 3 | 5 | 3 | CORE | Grundaktionen; geteiltes Feuer fehlt |
| Long-Range Battery | 6 / 8 | 1 | 0 | CORE | ATLAS-Prototyp; Fernfeuer spielbar |
| Mobile Siege Gun | 6 / 6 | 2 | 1 | EXPEDITIONARY | ATLAS-Prototyp; Grundaktionen spielbar |
| Combat Skimmer | 2 / 2 | 2 | 4 + 3 | CORE | ATLAS-Prototyp; Zusatzbudget derzeit 2 |
| Light Skimmer | 1 / 2 | 1 | 4 + 3 | EXPEDITIONARY | ATLAS-Prototyp; Zusatzbudget derzeit 2 |
| Skimmer Carrier | 1 / 2 | 2 | 3 + 2 | EXPEDITIONARY | Transport spielbar |
| Strategic Missile Carrier | 6 direkt / 3 Nachbarhexen, R 8 | 2 | 1 | EXPEDITIONARY | spielbar in UNIT TRIAL |
| Artillery Drone | 2 / 8 | 1 | 0 | FRONTIER | ATLAS-Prototyp; Transportverlegung fehlt |
| Infantry / Amphibious Infantry | je Trupp | je Trupp | 2 | CORE / EXPEDITIONARY | Infanterie spielbar; amphibische Wasserpassage umgesetzt |
| Field Engineers | 2 / 1 | 2 | 2 | SUPPORT | Grundaktionen; Engineering fehlt |
| Local Defense | 1 / 1 | 1 | 2 | FRONTIER | ATLAS-Prototyp; stationär statt Katalogbewegung 2 |
| Command Hub | — | 2 | 0 | CORE | Missionsziel spielbar |

`*` Der Entwurfskatalog sieht für den Siege Tank geteiltes Feuer vor; **im Spiel ist derzeit nur ein Angriff implementiert**. Der GOBLIN SIEGEBREAKER wird nicht als einzelner HP-Wert behandelt: Hauptbatterie, Sekundärbatterien, Raketen, Nahbereichsschutz und Ketten besitzen getrennte Zustände. Gegnerangriffe zerstören einzelne Systeme; `D` wirkt nicht auf Plattformwaffen, erfolgreiche Kettenangriffe entfernen Kettenpunkte in Höhe der Angriffsstärke.

Der Siegebreaker feuert jedes intakte Waffensystem separat. Haupt- und Sekundärbatterien sowie Nahbereichsschutz erhalten zu Beginn einer neuen Runde ihr Feuerbudget zurück. Abgeschossene Raketen bleiben verbraucht. Auswahl, Reichweitenoverlay und Zielprüfung verwenden stets das aktuell gewählte System.

## 4. Gelände

Kosten gelten für das **Betreten** eines Feldes. `—` bedeutet unpassierbar. Stationäre Einheiten können nicht ziehen. Deckung erhöht die effektive Verteidigung um **+1**. Nur Zwischenfelder blockieren eine Sichtlinie; eine Einheit im Start- oder Zielfeld darf sehen bzw. gesehen werden.

Das separat auswählbare `los-supercover-showcase` bindet `FIELD_TEST_SUPERCOVER_v1` mit Szenarioversion 1. Hier zählt jedes von der Zentrumslinie berührte Zwischenhex: Läuft sie genau auf einer Hexgrenze, sperrt bereits eines der beiden blockierenden Nachbarhexe. Vorschau, Spielerfeuer und Gegnerfeuer nutzen denselben Sichtlinienpfad. Die acht historischen `FIELD_TEST_LEGACY_v1`-Missionen und ihre Sichtlinienentscheidung bleiben unverändert; andere Katalogregeln werden durch dieses Showcase nicht aktiviert.

| Gelände | Ketten / Infanterie | Skimmer | Amphibische Infanterie | Deckung | Sichtblocker |
|---|---:|---:|---:|---:|---|
| Offenes Gelände | 1 | 1 | 1 | 0 | nein |
| Trümmerfeld | 2 | 2 | 2 | +1 | ja |
| Berg | 2 | 2 | 2 | +1 | ja |
| Höhenrücken | 2 | 2 | 2 | +1 | ja |
| Wald | 2 | 2 | 2 | +1 | ja |
| Sumpf | 2 | 1 | 2 | 0 | nein |
| Wasser | — | 1 | 1 | 0 | nein |
| Fluss | — | 1 | 1 | 0 | nein |
| Straße | 1 | 1 | 1 | 0 | nein |
| Brücke | 1 | 1 | 1 | 0 | nein |
| Stadtgebiet | 2 | 2 | 2 | +1 | ja |
| Krater | 2 | 1 | 2 | +1 | nein |

Dies sind G.O.B.L.I.N.-Playtestregeln für die neuen Motive, keine Aussage über ein fremdes Originalregelwerk. Belegte Felder sind für normale Bewegung blockiert; Rammen und Verladen folgen Sonderregeln. Alte Szenarien ohne differenzierte Terrain-Daten behalten ihre Berg-/Trümmerfelder.

Das Szenario `UNIT TRIAL` stellt den neuen Katalog mit Assault Tank, Recon Tank, Skimmer Carrier und Field Engineers erstmals im Spielfluss bereit. Field Engineers können im Movement in den benachbarten Skimmer Carrier einsteigen und über die Transport-Schaltfläche an einem freien Nachbarfeld aussteigen. Die Kapazität des Skimmer Carrier wird in Infanterie-Stärkepunkten gezählt.

## 5. Phasen und Aktionen

| Phase | Erlaubte Aktion | Zähler | Automatischer Wechsel |
|---|---|---|---|
| Movement | Jede eigene, nicht gehandelte Einheit einmal bewegen | MOVE | optional |
| Fire | Eigene Einheit mit sichtbarem Ziel feuert; Siegebreaker-Waffensysteme separat | FIRE | optional |
| Skimmer Maneuver | Skimmer einmal bis zu 2 zusätzliche Bewegungskosten | SKIMMER | optional |
| Hostile | Gegner feuern, sonst bewegen, danach erneut feuern | — | automatisch |

Eine Einheit darf in einem Zug grundsätzlich bewegen und feuern, sofern die jeweilige Phase und ihr Status dies erlauben. Deaktivierte Einheiten sind nicht handlungsfähig. Skimmer-Klassen teilen derzeit ein festes Zusatzbudget von **2**; die Katalogangabe `+3` für einzelne Typen ist noch nicht umgesetzt. Stationäre Einheiten mit Bewegung 0 bleiben in ihrer Position. Phasenwechsel mit noch möglichen Aktionen werden bestätigt, sofern die Bestätigung nicht deaktiviert wurde. `BACK` nimmt nur Befehle der laufenden Phase zurück.

## 6. Feuer- und Schadensmodell

Die Quote verwendet Angriff / **effektive Verteidigung einschließlich Deckung**. Der aktuelle CRT hat sechs gleich wahrscheinliche Seiten:

| Quote | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 1:2 | NE | NE | NE | NE | D | X |
| 1:1 | NE | NE | D | D | D | X |
| 2:1 | NE | D | D | X | X | X |
| 3:1 | D | D | X | X | X | X |
| 4:1 | D | X | X | X | X | X |
| 5:1 | X | X | X | X | X | X |

`D` deaktiviert Fahrzeuge bis zum Beginn des festgelegten Folgeturns. Bei Infanterie reduziert `D` die HP um 1. Eine weitere Deaktivierung zerstört ein bereits deaktiviertes Fahrzeug. `X` zerstört das Ziel unmittelbar. Beim Siegebreaker erhöht Deckung die Verteidigung des gewählten Waffensystems; der Kettenangriff besitzt weiterhin seine eigene feste Quote.

## 7. Sonderregeln

- Der GOBLIN darf im Movement ein gegnerisches Fahrzeug rammen, wenn ein gültiger Bewegungspfad besteht. Der Core darf nicht gerammt werden.
- Skimmer erhalten nach Movement und Fire eine eigene Manöverphase mit maximal 2 Bewegungskosten.
- Gelände wirkt gemäß Tabelle auf Bewegung, Deckung und Sicht. Die Bewegungsvorschau, tatsächliche Pfadprüfung und Gegnerbewegung verwenden dieselben Bewegungskosten.
- Ein Ziel ist nur beschießbar, wenn es in Reichweite liegt und die Sichtlinie frei ist.
- Zerstörte Einheiten bleiben als Wracks auf der Karte sichtbar.
- Der Skimmer Carrier kann bis zu drei Infanterie-Stärkepunkte aufnehmen. Einsteigen verbraucht die volle Bewegung der Infanterie; der Träger darf im selben Zug normal fahren. Ausgestiegene Infanterie darf in diesem Zug weder selbständig weiterziehen noch wieder einsteigen.
- Infanterie darf in dem Zug feuern, in dem sie ein- oder aussteigt, und kann vom Skimmer Carrier aus feuern. Sie wird über dessen Cargo-Leiste ausgewählt.
- Bei einem Angriff auf Träger und Passagiere gilt ein gemeinsamer Würfelwurf. Die Kampfquote und Wirkung werden für Träger und Infanterie getrennt berechnet; überlebende Passagiere eines zerstörten Trägers verbleiben im Trägerfeld.
- Der Strategic Missile Carrier besitzt eine Rakete für das gesamte Szenario. In der Feuerphase kann ein sichtbares feindliches Ziel innerhalb von acht Hexfeldern gewählt werden. Das Ziel wird mit Angriff 6, alle Einheiten auf Nachbarhexen mit Angriff 3 getroffen; Friendly Fire ist möglich. Der Treffer auf Träger und ihre Passagiere folgt der bestehenden Passagierregel. Der Start ist innerhalb der Phase per `BACK` rückgängig zu machen.

## 8. Anzeigevertrag

- Movement Range: tatsächlich erreichbare Felder inklusive Gelände- und Belegungskosten.
- Fire Range: alle Felder innerhalb der Waffenreichweite.
- Line Of Sight: sichtbare Felder innerhalb der Waffenreichweite; nur äußerer Rand, keine Zellränder.
- Feldmarker: zuletzt angeklicktes Feld, immer oberster Kartenlayer.
- Gegnerische Einheiten dürfen zur Informations- und Overlay-Anzeige ausgewählt werden, lösen aber nur bei gültigem Feuerbefehl einen Angriff aus.
- Field Intel zeigt Geländetyp, Bewegungskosten für die ausgewählte Einheit, Deckung und Sicht. Unit Intel weist einen vorhandenen Deckungsbonus aus.

## 9. Bewusste Lücken für die nächste Ausbaustufe

1. Geteiltes Feuer des Siege Tank, Engineering-/Reparatur-/Räumaktionen, Tarnung der Phantom Platform, vollwertige Systeme für gegnerische GOBLIN-Plattformen und zusätzliche Transporttypen sind noch nicht umgesetzt.
2. Die meisten ATLAS-Spezialisten nutzen vorläufige Werte und das generische Bewegungs-/Feuermodell; der Unit Guide nennt geplante Aktionen ausdrücklich. Auch die ATLAS-Siegbedingung „alle Gegner ausschalten“ ist vorläufig und nicht der `objectiveDraft` des Content-Pakets.
3. Indirektes Feuer, freies Raketen-Hexziel und detaillierte Verstärkungen fehlen noch. Der Trefferwürfel ist zufallsbasiert; `BACK` hält bei wiederholtem Schuss innerhalb der Phase denselben Wurf stabil.
4. KI-Zielprioritäten, besondere gegnerische Skimmerzüge und Szenario-Verstärkungen sind vereinfacht.


## Feste Skimmer-Erprobung (29.10.2026, goblin-9bj.10.2)

Die separat auswählbare Mission `skimmer-pilot` v1 bindet ausschließlich
`CATALOG_SKIMMER_PILOT_v1` / `skimmer-pilot-data-v1`. Sie aktiviert kein FULL_CATALOG
und verändert weder das Legacy-Register noch laufende historische Partien.
Der eigene Combat Skimmer (U10) hat A2/R2/D2, HP2 und Bewegungskostenbudget4+3;
Guard U25 A1/R2/D3/M1/HP3 und der stationäre Command Core U23 D5/HP5 bleiben
bei ihren beschlossenen Werten. Start: B04 / I03 / K04. Gelände stammt aus der
12×8 Terrain-Course-Karte, als eigenständiger versionierter Leveldatensatz.
Sieg: Kern zerstört und eigener Skimmer lebt; der Guard ist kein Pflichtziel.

`assets/unit-art/levels/skimmer-pilot.v1.json` ist durch vollständigen kanonischen
Datenvergleich im festen Pilotvertrag geschützt; sein SHA256 über kanonisches JSON (rekursiv sortierte Schlüssel, UTF-8) lautet
`3ac5caae85ec629444247c732eabc9267fcc53a56191faf0954acda10e4877dc`.
Werteherkunft: `rules.mjs` UNIT_CATALOG.gev und die ausdrücklich übernommenen
Guide-/Legacy-HP-/Gegnerwerte; Contentpin
`2fdce6ac1be30e8b2a360250b37724586469e71c`, keine neue Grafikübernahme.
Der gemeinsame bestehende Skimmerhelper (`skimmer-budget.js`, ESM-Fassade
`skimmer-budget.mjs`) friert `skimmer-pilot-budget-v1` im Sessionstart ein.
Query, Dispatch, Kostenflächen, Zusatzphase und beide Guideansichten lesen dieselbe
Budgetquelle. Jeder andere alte Spielstart behält den Zweierbonus; U26 erhält
keinen Spieler-Zusatzbonus. Terrainkosten sind keine Hexanzahl.

Neustart und Levelwechsel erzeugen eine neue immutable Session. BACK innerhalb
der Phase stellt Position/Budget/Facing wieder her und verwendet denselben
gecachten Spielerwurf erneut. Es gibt keinen neuen Save- oder öffentlichen
Replayimport. Schema1/Core-v3, Iron-Dust-Core, U07- und Artillerie-Probereplays
lehnen die Pilotkennung ab. Der allgemeine Core und seine Orakel bleiben unverändert.

Reproduzierbare Resolverbelege: `tests/skimmer-pilot.test.mjs`, einschließlich
normaler Sieg-/Verlustpartien mit kontrolliertem CRT-Wurf6 (keine HP-/Positionsinjektion),
4nicht5/3nicht4, Terrain, Phase, spent/disabled/dead/hostile, RNG/Undo/Restart,
Loader-/Digestgrenzen sowie Guide/M1/Animationspfad. Diese Tests ersetzen nicht
die unabhängige native Bedienungsabnahme oder einen Release.


## Feste Siege-Tank-Erprobung (29.10.2026, goblin-9bj.11.9)

`siege-pilot` v1 ist ein eigener normal spielbarer Legacy-Einsatz unter
`CATALOG_SIEGE_PILOT_v1` / `siege-pilot-data-v1`, kein generisches Teilprofil.
U07 startet B04 mit HP5/D5/R3/M3/A6. Gegner: Guard F04 (HP3/D3/A1/R2/M1),
Recon G04 (HP2/D2/A2/R2/M3), Infanterie D05 (HP2/D2/A1/R1/M2, bestehender
Legacy-SP-Verlustpfad) und stationärer Kern K04 (HP5/D5). Alle Startfelder sind
passierbar. Die bestehende 12×8-Terrain-Course-Karte liegt als eigener Leveldatensatz
vor. Sieg verlangt Kernzerstörung und Spielerüberleben, nicht sämtliche Begleitziele.

Der bisherige `siege-tank-fire-budget.mjs`-Resolver wird jetzt über eine gemeinsame
Classic-JS-Implementierung und ESM-Fassade tatsächlich genutzt. Regelversion bleibt
`siege-tank-fire-budget-v1`: main-1/main-2 je A3/R3 auf verschiedene Ziele;
main-both A6/R3 verbraucht beide Slots mit einem Wurf. Auch NE bindet das Hauptziel.
Zusätzlich ap-1/ap-2 je A1/R1 nur Infanterie. Kein neues Ogre-Systemmodell.
Verfügbare Slots, gewählte Waffe, Query/Dispatch, Quote, Kartenfläche, beide Guides,
Autophase, Rundenzurücksetzung und BACK hängen an demselben Zustand/Spec.
Jede akzeptierte Feueraktion verwendet genau einen bestehenden CRT-Wurf; abgelehnte
Aktionen und Waffenwahl verbrauchen keinen. BACK stellt Slots/Hauptzielhistorie und
Rollcursor wieder her. Neue Runde setzt Slots genau einmal zurück.

Der exakte Level-/Roster-/Versionsvergleich erfolgt vor jeder neuen Session.
SHA256 über rekursiv schlüsselsortiertes kompaktes UTF8-LevelJSON:
`d3892981633e5b1d8fcc35eb40e087738231e5a48b64fcebb14ebf3a7c00204c`.
Die Session friert Herkunft, Feuerbudgetversion, Anfangsbudget, Gelände und Werte ein.
Laufende Partien, alte Missionen und die Skimmer-Erprobung werden nicht umgeschaltet;
`targetActive:false` bleibt bestehen. Kein neuer Save- oder öffentlicher Replayimport;
Schema1/Core-v3-, Iron-Dust-, U07- und Artillerie-Replayheader lehnen die Pilotkennung ab.

Die Darstellung erfasst die tatsächlich gewählte Waffe vor Autoselect: einzelne
Mains nutzen jeweils einen der vorhandenen Twinanker, Bündelfeuer beide Mündungen
mit nur einem Regelergebnis. AP nutzt den expliziten leichten zentralen Spec6-Fallback,
keine erfundenen AP-Anker. Bilder/Design/Contentpin bleiben
`2fdce6ac1be30e8b2a360250b37724586469e71c`.

Resolverbelege und normale Gewinn-/Verlustbefehlsfolgen stehen in
`tests/siege-pilot.test.mjs`; kontrollierte Würfe sind keine native gespielte QA.
Die unabhängige Desktopprüfung folgt erst auf einem festen Kandidatencommit.


## Fester Artillerieeinsatz (goblin-9bj.11.10)

`artillery-pilot` v1 verbindet U08 HP2/D1/A6/R8/M0 und U09 HP3/D2/A6/R6/M1
mit dem angenommenen A–G-HP-Vertrag. Ein Schuss je Actor/Runde, keine Setupwartezeit.
Direct eigene LOS; Indirect konkreter lebender aktiver unverladener eigener
Beobachter mit direkter LOS. Neuer Pfad strict-supercover; keine Spotter-
Waffenreichweite, kein Blindfeuer/Splash, keine Änderung alter Missionen/Piloten.
Ziel: Kern zerstört und mindestens eine eigene Einheit lebt, Recon zählt.
Profil-/Command-/Digest-/Undo-/RNG-/Guide-/Darstellungsgrenzen und ausführbare
gefrorene Produkttraces stehen in [UNIT_RULE_PROFILES.md](UNIT_RULE_PROFILES.md).
Die interne Produkttrace ist keine öffentliche Save-/Replayimportfunktion.

### Katalog-Erprobung: Systeme und Engineering

Die Missionen `catalog-siege` und `catalog-specialists` verwenden `CATALOG_SPECIALISTS_v1` mit 24 genehmigten Klassen. U13 und U21 sowie das vollständige Katalogprofil bleiben inaktiv. Systemplattformen haben echte Ketten- und Komponentenbestände statt Gesamt-HP. Ein Kettentreffer wirkt nur bei 5 oder 6; D/NE zerstören keine Komponenten. Wiederverwendbare Waffen besitzen je einen Schuss pro eigener Feuerphase, Raketen bleiben nach Gebrauch verbraucht.

Die Feldstellung (`field-position`) ist ein virtuelles Engineeringgelände: Bewegungskosten 1, Deckung +1, keine Sichtblockade. Sie entsteht für 1 Material auf freiem, unbesetztem offenem Gelände oder Straße. Engineering ersetzt Bewegung und Feuer; reparierte Waffen, Werkzeuge und Buchten stehen erst ab dem nächsten eigenen Zug bereit. Forge-Buchten führen jeweils genau eine vorhandene Drohne und erzeugen keine neuen Einheiten.
