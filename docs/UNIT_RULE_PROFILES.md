# Versionierte Einheitenprofile

## Aktueller Profilüberblick – 29.10.2026

Der aktuelle lokale Implementierungsstand trennt öffentliche **FULL_CATALOG_v1**-Zulassung und interne **CATALOG_FULL_CANDIDATE_v1**-Belege. Der Kandidat wurde auf `868a156` unabhängig 26/26 geprüft; der neue FULL-Einstieg benötigt den gezielten Admissionnachtrag auf seinem festen Commit. Dies ist kein neuer öffentlicher Releasebeleg.

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

Normales V2 lädt die FULL-Paare ohne Kandidatenflag, intern bleibt die explizite Candidatezulassung verfügbar. Classic und der separate IronDust-Corepfad erhalten keine stillen FULL-Regeln. Trainingsprofile T01–T03 sind noch nicht implementiert und erhalten ihren eigenen späteren .5-Nachtrag.

## Historische und profilgebundene Referenzabschnitte

Die folgenden ursprünglichen Abschnitte bleiben als Stand-/Profilbelege erhalten. Ihre global klingenden Implementierungs- und Lückenaussagen gelten nur im dort benannten älteren Scope. Der aktuelle Gesamtüberblick steht oben.

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


## Artillerie-Erprobung, ausdrückliche Ziel-HP (29.10.2026, goblin-9bj.11.10)

Der Nutzer hat das Regelpaket A–G aus
`Transformation/operations/catalog-rules-approved-2026-10-29.md` angenommen;
Originalvorschlags-SHA256 `44b9e4f473cc3fd83eb41183d1e2e70fd29078875e2f7132995bab6ba70b5d57`.
Damit sind U08 HP2 und U09 HP3 ausdrücklich erhalten. Das wird nicht aus der
historischen technischen Probe abgeleitet. Neues festes Szenario `artillery-pilot`
v1 bindet `CATALOG_ARTILLERY_PILOT_v1` / `artillery-pilot-data-v1`,
Feuerbudget `artillery-spotter-v1` und `strict-supercover`. FULL bleibt inaktiv.

U08 B02: HP2/D1/A6/R8/M0 fixed. U09 B07: HP3/D2/A6/R6/M1 tracked.
Recon F04: HP2/D2/A2/R2/M3. Gegner: Guard I02 (HP3/D3/A1/R2/M1),
Assault H07 (HP3/D3/A4/R2/M3), Rocket Artillery E04 (HP3/D2/A3/R4/M2,
beschlossener U03-Zielsatz, kein U08-Spotterrecht) und Kern K04 (HP5/D5/M0).
Eigene 12×8-Karte mit bestehenden Wald-, Höhen- und Straßenbausteinen; alle Starts
sind passierbar. Ziel bleibt Kernzerstörung plus mindestens eine eigene Einheit;
ein allein überlebender Recon zählt, Spieler-Totalausfall hat Vorrang.

Jede Artillerieeinheit feuert einmal pro Runde. setupValue2 ist Forcebudget,
kein Aufstellungszähler. Direct verlangt eigene LOS und spotterId=null.
Indirect verlangt einen explizit benannten anderen lebenden, aktiven, unverladenen
eigenen Beobachter mit direkter LOS auf ein lebendes besetztes Gegnerhex.
Keine Waffenreichweiten-/Ungeschossenheitsanforderung für den Beobachter erfinden.
Kein Blindfeuer, Splash oder zusätzliche Mindestreichweite. Auch bei eigener LOS
bleibt ein indirekter Schuss ohne gültigen Beobachter ungültig.

Der bestehende Resolver ist inhaltlich unverändert als `artillery-spotter-rules.js`
mit ESM-Fassade `artillery-spotter-probe.mjs` angebunden. Der Browser-Command
`FireArtillery` hat exakt type/actorId/x/y/mode/spotterId. Generischer Fire-Bypass
auf die beiden Pilot-Artillerieeinheiten wird abgewiesen; historische und Core-
Commands bleiben getrennt. Query, Dispatch, Modus-/Beobachterauswahl, Quote,
Zielfläche, beide Guides, Phasenbereitschaft, Undo und nächster Rundenreset lesen
denselben Zustand und Resolver. Indirect überwindet den eigenen Sichtblocker als
Feueraktion, verändert jedoch nicht die physische eigene LOS-Anzeige.

Der vollständige feste Level-/Roster-/Configvergleich erfolgt vor jeder Session.
SHA256 über rekursiv schlüsselsortiertes kompaktes UTF8-LevelJSON:
`661aa73f005e1684ba47080176981718d1b3b6f85f07996efd4091a314f99c2d`.
Alle alten Missionen und beide früheren Piloten behalten ihre Profile. Alte
Schema1/Core-v3-, Iron-Dust-, U07- und Artillerie-Probereplays weisen diese neue
Produktkennung zurück. Keine öffentliche Speicher-/Replayimportfunktion.

Neue reproduzierbare Produktbelege: `tests/artillery-pilot.test.mjs` sowie
`tests/artillery-product-trace.test.mjs`. Die eingefrorene JSON-Datei
`tests/fixtures/artillery-product-traces.v1.json` führt vollständigen Profil-/
Startzustand, normalisierte Quellhashes, Testseed/Xorshift32-Zustand, echte
Browser-Commands, alle Zustände, Facing-/Wrack-Sidecar und Ereignisänderungen.
37 Siegschritte (Seed5440, vier tatsächliche Würfe einschließlich gecachtem
Undo-Reissue) und 18 Niederlagenschritte (Seed7) laufen über den echten
Legacy-Lader/Query/Dispatch/Phasentaster/Gegnercallback/Observer/Undo-Stack.
Manipulierte Seeds, Profile, Startzustände, Modus/Beobachter, Reihenfolgen und
Ergebnisse werden abgewiesen. Kein Verweis nur auf die alte Coreprobe.
Der Simulatorseed ist ein interner Prüfmechanismus; native Spiele behalten ihren
normalen Zufall. Kontrolldaten sind kein nativer Desktop-QA-PASS.

Fireevents erfassen tatsächlich gewählten Modus/Beobachter/A6/Reichweite vor
Autoselect. Vorhandene Longgun-Anker/Effekte werden wiederverwendet; ein Schuss,
ein Resultat, keine erfundenen Treffer oder neuen Grafikquellen. Contentpin bleibt
`2fdce6ac1be30e8b2a360250b37724586469e71c`. Die native unabhängige Desktopprüfung
folgt auf dem festen Kandidaten; danach stellt Koordination den lokalen Snapshot bereit.


**Legacy-CRT-Grenze:** Die letzte wirksame Browser-combatOutcome-Definition zieht
auch bei automatischem 5:1-X einen Zufallswert, bevor applyCombatRoll das Ergebnis
festlegt. Erstschuss: ein frischer RNG-Wert und ein Rollslot; BACK/Wiederholung:
derselbe Slot, kein zusätzlicher frischer RNG-Wert. Bei D1 plus Deckung1 gilt
stattdessen 3:1. Der explizite isolierte Grenztest weist den tatsächlichen geladenen
Wrapperpfad nach, nicht die früher überschriebene combatOutcome-Definition.
Es wird keine neue Nullwurfregel eingeführt und keine Grenztest-D-Injektion als
normale gespielte Mission ausgegeben.

## Systeme, Engineering und gemeinsames Sonderfeuer

Die beiden weiteren festen Missionen `catalog-siege` und `catalog-specialists`
verwenden `CATALOG_SPECIALISTS_v1` / `catalog-specialists-mechanics-v1` mit derselben
kryptografisch geprüften genehmigten Datenquelle. Ihr gemeinsamer Scope enthält
24 Klassen, darunter die tatsächlichen Systeme von U01/U18/U20, U16-Engineering
und die instanzgebundenen U07/U08/U09-Feuerbudgets. U13, U21 und FULL bleiben
inaktiv. Initiale Roster, Ketten/Komponenten, Fracht/Buchten, Material und Gelände
sind im unveränderlichen Partiekopf gebunden. Plattformen erhalten keine Gesamt-HP.

Details, Quellen, ausführbare Partiereferenzen und die Grenze zur noch offenen
unabhängigen Bedienungsabnahme stehen in
[CATALOG_SPECIALISTS_HANDOFF.md](../reports/CATALOG_SPECIALISTS_HANDOFF.md).
