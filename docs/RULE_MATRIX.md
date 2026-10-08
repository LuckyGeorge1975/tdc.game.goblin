# G.O.B.L.I.N Regelmatrix

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
