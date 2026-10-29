# Versionierte Einheitenprofile

`assets/unit-art/rules/unit-profiles.v1.json` trennt den spielbaren Snapshot `field-test-atlas-v1` vom **inaktiven** Sollprofil `full-catalog-v1-draft`. ATLAS und K/U1–U3 lesen ausschließlich `legacy`. `targetActive: false` ist eine Schutzmarke; der Lader lehnt ein unerwartet aktives Profil ab. Der Snapshot bewahrt HP, Verteidigung, Reichweite, Bewegung, Angriff, Icon und Typ in genau dieser Reihenfolge. Er schreibt keinen laufenden Spielzustand um. Die Profile sind keine Behauptung, dass Zielregeln bereits spielbar sind.

Die Tabelle nennt Legacy als `HP/D/R/M/A` und das Ziel als `A/R/D/M`; `S` verweist auf ein Systemmodell ohne generischen HP-Wert. Ein zweiter Bewegungswert bezeichnet das Skimmer-Manöver. `squads` bezeichnet variable Infanterie-Stärkepunkte. Quelle und weitere Merkmale stehen je Einheit im JSON. Die Werte folgen dem Nutzerbeschluss in `goblin-9bj.9`; `UNIT_CATALOG` und `OGRE_SYSTEMS` in `rules.mjs` sind für die dort definierten Werte der Vergleichsmaßstab.

| ID | Einheit | Legacy | Ziel | Besonderheit |
| --- | --- | --- | --- | --- |
| U01 | Goblin Siegebreaker | 5/5/2/3/3 | S mkIII, 45 Ketten | Systemmodell bereits separat im Legacy-Spiel |
| U02 | Skimmer Scout | 3/3/3/3/1 | 1/3/3/3+2 | Guide/Legacy und `UNIT_RULES.gev` |
| U03 | Rocket Artillery | 3/3/4/1/2 | 3/4/2/2 | Zielbewegung und Angriff abweichend |
| U04 | Infantry Squad | 2/2/1/2/1 | squads/1/squads/2 | bis drei Stärkepunkte |
| U05 | Assault Tank | 3/3/2/3/4 | 4/2/3/3 | Grundwerte gleich |
| U06 | Recon Tank | 2/2/2/3/2 | 2/2/2/3 | halfUnit |
| U07 | Siege Tank | 5/5/3/3/6 | 6/3/5/3 | splitFire, AP 2 |
| U08 | Long-Range Battery | 2/2/6/0/3 | 6/8/1/0 | fixed, setupValue 2 |
| U09 | Mobile Siege Gun | 3/3/4/1/3 | 6/6/2/1 | setupValue 2 |
| U10 | Combat Skimmer | 2/2/2/3/2 | 2/2/2/4+3 | GEV |
| U11 | Light Skimmer | 1/1/2/3/1 | 1/2/1/4+3 | halfUnit |
| U12 | Skimmer Carrier | 2/2/2/3/1 | 1/2/2/3+2 | drei Infanterie-Stärkepunkte |
| U13 | Strategic Missile Carrier | 2/2/8/1/6 | 6/8/2/1 | Nachbarwert 3, ein Schuss |
| U14 | Artillery Drone | 2/2/4/2/2 | 2/8/1/0 | fixed, transportable |
| U15 | Amphibious Infantry | 2/2/1/2/1 | squads/1/squads/2 | Wasserregel, bis drei Stärkepunkte |
| U16 | Field Engineers | 2/2/1/2/2 | 2/1/2/2 | Engineering |
| U17 | Local Defense | 2/2/2/0/2 | 1/1/1/2 | Ziel ist bewegliche Infanterie |
| U18 | Forge Engineer | 2/2/1/2/2 | S vulcan, 45 Ketten | Engineering/Drohnen, kein Ziel-HP |
| U19 | Command Hub | 5/5/0/0/0 | 0/0/2/0 | fixed, Kommandoeinheit |
| U20 | Goblin Dreadnaught | 6/6/3/2/4 | S mkV, 60 Ketten | kein Ziel-HP |
| U21 | Phantom Platform | 3/3/3/2/2 | S ninja | Tarnung, keine numerischen Zielwerte |
| U22 | Infantry Platoon | 2/2/1/2/1 | 1/1/2/2 | Guide/Legacy-Definition |
| U23 | Command Core | 5/5/0/0/0 | 0/0/5/0 | Guide/Legacy-Zielregel |
| U24 | Relay Node | 4/4/0/0/0 | 0/0/4/0 | Guide/Legacy-Zielrolle |
| U25 | Guard Tank | 3/3/2/1/1 | 1/2/3/1 | Guide/Legacy, Gegner-KI separat |
| U26 | Raider Skimmer | 2/2/2/2/1 | 1/2/2/2 | Guide/Legacy, Gegner-KI separat |

Die Zielwerte brauchen vor Aktivierung eigene Regeln für Skimmer-Budget, halfUnit, Infanterie-Stärkepunkte, Artillerie, Systeme und Tarnung sowie Level-Balance, Siegroute, Replay-Version, Guide-Live-Anzeige und Browser-QA. Diese Arbeit gehört zu den Folgeabschnitten von `goblin-9bj.10` und den Spezialthemen `.11`–`.19`. Für neue Partien ist ein eigener Rule-/Scenario-Versionswechsel erforderlich; der Legacy-Snapshot bleibt erhalten.

`skimmer-budget.mjs` liest als isolierter Helfer die Bewegungsbudgets der vier Spieler-Skimmer aus einer ausdrücklich benannten Datenprofil-Version. Das Legacy-Datenprofil liefert 3+2; der inaktive Zielentwurf liefert U10/U11 4+3 und U02/U12 3+2. Der Helfer ist **keine aktive Spielmechanik**: Weder Missionsstart noch Legacy-Spiel, modularer Core, Guide oder Replay rufen ihn auf. Die Produktprofile `FIELD_TEST_LEGACY_v1` und `FULL_CATALOG_v1` sind keine Datenprofil-Kennungen; ihre Bindung und eine neue ausführbare Regelversion bleiben Teil von `goblin-9bj.19` und der vollständigen Zielprofil-Abnahme.

## Szenario- und Produktprofilvertrag

`scenario-profile-manifest.js` ist das synchrone, versionierte Manifest (`schemaVersion: 1`) für **neue** Legacy-Partien. Die Produktkennungen `FIELD_TEST_LEGACY_v1` und `FIELD_TEST_LEGACY_v2` sind von der 26er-Datenkennung `field-test-atlas-v1` getrennt. Letztere gilt für sechs nachgeladene Level; die drei eingebauten Level bewahren ihre eigenen bisherigen Einheiten- und Geländewerte. Alle neun Default-Paarungen haben `objectiveVersion: 1`; nur `iron-dust` startet mit `scenarioVersion: 2`.

| Szenario-ID | Produktprofil | Zielregel | 26er-Datenprofil |
| --- | --- | --- | --- |
| `iron-dust` | `FIELD_TEST_LEGACY_v2` | `core` | eigener Built-in-Snapshot |
| `relay-run` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | eigener Built-in-Snapshot |
| `unit-trial` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | eigener Built-in-Snapshot |
| `los-supercover-showcase` | `FIELD_TEST_SUPERCOVER_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `atlas-proving-grounds` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-terrain-course` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-advance` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-siege` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-specialists` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |

Der synchrone Built-in-Start, jeder spätere `loadScenario`-Aufruf und die Registrierung der sechs Asset-Level prüfen diese Paarung vor dem Start beziehungsweise vor der Registrierung. Fehlende oder unbekannte Produktkennungen ergeben `UNSUPPORTED_RULE_PROFILE`; falsche Szenario-Versionen, Zielregeln oder Datenprofile `SCENARIO_PROFILE_MISMATCH`. Die Fehlermeldung wird angezeigt oder im Spielprotokoll ausgegeben. `full-catalog-v1-draft` bleibt inaktiv.

Vor jedem Legacy-Partiestart erstellt `ScenarioRuleProfiles.beginSession` eine tief kopierte, unveränderliche Session mit Szenario-ID/-Version, Produktprofil und den effektiven Ziel-, Gelände- und Einheitenwerten. Der Erststart, Neustart und Levelwechsel erhalten jeweils eine neue Session. Laufende Sieg- und Zielanzeigen lesen den gebundenen Snapshot; Änderungen am äußeren Szenariokatalog schreiben die Partie nicht um. Sprache und Icon-Set ändern nur die Ansicht und starten die Mission nicht neu. Der Snapshot ist ein interner Laufzeitvertrag, kein gespeicherter Spielstand und kein Replay. Persistenz und deterministische Replay-Prüfung bleiben spätere Slices von `goblin-9bj.19`.

Neue `iron-dust`-Sessions binden `targetPolicyVersion: skip-depleted-treads-v1`: automatische Systemangriffe überspringen Ketten bei Wert 0 und können danach noch vorhandenes Antipersonnel anvisieren. Die exakte historische Paarung `iron-dust` / `scenarioVersion: 1` / `FIELD_TEST_LEGACY_v1` bleibt als explizite Eingabe gültig und behält ihre bisherige Zielwahl. Die übrigen acht Legacy-Szenarien, der separate IRON-DUST-Core-v2-Pfad und Replay-Schema 1 werden durch diesen Browser-Vertrag nicht umversioniert. Für unversionierte externe Legacy-Aufzeichnungen besteht kein Importvertrag.


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
