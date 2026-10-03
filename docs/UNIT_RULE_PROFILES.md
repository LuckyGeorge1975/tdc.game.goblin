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

`scenario-profile-manifest.js` ist das synchrone, versionierte Manifest (`schemaVersion: 1`) für **neue** Legacy-Partien. Die Produktkennung `FIELD_TEST_LEGACY_v1` ist von der 26er-Datenkennung `field-test-atlas-v1` getrennt. Letztere gilt nur für die fünf nachgeladenen Level; die drei eingebauten Level bewahren ihre eigenen bisherigen Werte. Jede Paarung hat `scenarioVersion: 1` und `objectiveVersion: 1`.

| Szenario-ID | Produktprofil | Zielregel | 26er-Datenprofil |
| --- | --- | --- | --- |
| `iron-dust` | `FIELD_TEST_LEGACY_v1` | `core` | eigener Built-in-Snapshot |
| `relay-run` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | eigener Built-in-Snapshot |
| `unit-trial` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | eigener Built-in-Snapshot |
| `atlas-proving-grounds` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-terrain-course` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-advance` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-siege` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |
| `showcase-specialists` | `FIELD_TEST_LEGACY_v1` | `core-and-escort` | `field-test-atlas-v1` |

Der synchrone Built-in-Start, jeder spätere `loadScenario`-Aufruf und die Registrierung der fünf Asset-Level prüfen diese Paarung vor dem Start beziehungsweise vor der Registrierung. Fehlende oder unbekannte Produktkennungen ergeben `UNSUPPORTED_RULE_PROFILE`; falsche Szenario-Versionen, Zielregeln oder Datenprofile `SCENARIO_PROFILE_MISMATCH`. Die Fehlermeldung wird angezeigt oder im Spielprotokoll ausgegeben. `full-catalog-v1-draft` bleibt inaktiv.

Vor jedem Legacy-Partiestart erstellt `ScenarioRuleProfiles.beginSession` eine tief kopierte, unveränderliche Session mit Szenario-ID/-Version, Produktprofil und den effektiven Ziel-, Gelände- und Einheitenwerten. Der Erststart, Neustart und Levelwechsel erhalten jeweils eine neue Session. Laufende Sieg- und Zielanzeigen lesen den gebundenen Snapshot; Änderungen am äußeren Szenariokatalog schreiben die Partie nicht um. Sprache und Icon-Set ändern nur die Ansicht und starten die Mission nicht neu. Der Snapshot ist ein interner Laufzeitvertrag, kein gespeicherter Spielstand und kein Replay. Persistenz und deterministische Replay-Prüfung bleiben spätere Slices von `goblin-9bj.19`.
