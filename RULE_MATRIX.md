# G.O.B.L.I.N Regelmatrix

Stand: 2026-09-25 · Version: 0.1 · Zweck: verbindliche Referenz für Spiel, KI und Szenarien.

## 1. Einheitentypen

| Einheit | Team | HP | Bewegung | Reichweite | Rolle | Status |
|---|---:|---:|---:|---:|---|---|
| GOBLIN SIEGEBREAKER | Spieler | 5 | 1 | 2 | Schwerer Angriff, Rammen | implementiert |
| SKIMMER SCOUT | Spieler | 3 | 3 | 3 | Schnelles Schwebefahrzeug, Zusatzmanöver | implementiert |
| ROCKET ARTILLERY | Spieler | 3 | 1 | 4 | Artillerie | spielbar, Verteidigung separat |
| INFANTRY PLATOON | Spieler | 2 | 2 | 1 | Mobile Infanterie | implementiert |
| GUARD TANK | Gegner | 3 | 1 | 2 | Gegnerische Panzerung | implementiert |
| RAIDER SKIMMER | Gegner | 2 | 2 | 2 | Gegnerisches Schwebefahrzeug | implementiert |
| COMMAND CORE / RELAY NODE | Gegner | 5 / 4 | 0 | 0 | Missionsziel | implementiert |

## 1.1 G.O.B.L.I.N.-Einheitenkatalog

Die Werte unten bilden den eigenständigen G.O.B.L.I.N.-Katalog. Die Herkunftsspalte bezeichnet interne Content-Linien und keine Drittprodukte. `Katalog` bedeutet: im Datenmodell und Unit Guide vorhanden; `spielbar` bedeutet zusätzlich in Bewegung, Feuer, Schaden und KI integriert.

| Einheit | Angriff / Reichweite | Verteidigung | Bewegung | Quelle | Status |
|---|---:|---:|---:|---|---|
| Assault Tank | 4 / 2 | 3 | 3 | CORE | Katalog |
| Rocket Artillery | 3 / 4 | 2 | 2 | CORE | spielbar, Prototypwerte abweichend |
| Recon Tank | 2 / 2 | 2 | 3 | CORE | Katalog |
| Siege Tank | 6* / 3 | 5 | 3 | CORE | Katalog |
| Long-Range Battery | 6 / 8 | 1 | 0 | CORE | Katalog |
| Mobile Siege Gun | 6 / 6 | 2 | 1 | EXPEDITIONARY | Katalog |
| Combat Skimmer | 2 / 2 | 2 | 4 + 3 | CORE | Katalog; Zusatzmanöver vorhanden |
| Light Skimmer | 1 / 2 | 1 | 4 + 3 | EXPEDITIONARY | Katalog |
| Skimmer Carrier | 1 / 2 | 2 | 3 + 2 | EXPEDITIONARY | Katalog |
| Strategic Missile Carrier | Sonderangriff | 2 | 1 | EXPEDITIONARY | Katalog |
| Artillery Drone | 2 / 8 | 1 | 0 | FRONTIER | Katalog |
| Infantry / Amphibious Infantry | je Trupp | je Trupp | 2 | CORE / EXPEDITIONARY | Prototyp-Infanterie spielbar |
| Field Engineers | 2 / 1 | 2 | 2 | SUPPORT | Katalog |
| Local Defense | 1 / 1 | 1 | 2 | FRONTIER | Katalog |
| Command Hub | — | 2 | 0 | CORE | Missionsziel spielbar |

`*` Der Siege Tank kann den Angriff auf zwei gleich starke Angriffe aufteilen. Der GOBLIN SIEGEBREAKER wird nicht als einzelner HP-Wert behandelt: Hauptbatterie, Sekundärbatterien, Raketen, Nahbereichsschutz und Ketten besitzen getrennte Zustände. Gegnerangriffe zerstören einzelne Systeme; `D` wirkt nicht auf Plattformwaffen, erfolgreiche Kettenangriffe entfernen Kettenpunkte in Höhe der Angriffsstärke.
## 2. Gelände

| Gelände | Bewegungskosten | Deckung | Sichtlinie | Status |
|---|---:|---|---|---|
| Offenes Gelände | 1 | nein | frei | implementiert |
| Berg-/Trümmerfeld | 2 | ja | blockiert | implementiert |
| Belegtes Feld | — | — | — | für Bewegung blockiert; Ziel-/Rammregeln separat |

Das Szenario `UNIT TRIAL` stellt den neuen Katalog mit Assault Tank, Recon Tank, Skimmer Carrier und Field Engineers erstmals im Spielfluss bereit. Field Engineers können im Movement in den benachbarten Skimmer Carrier einsteigen und über die Transport-Schaltfläche an einem freien Nachbarfeld aussteigen. Die Kapazität des Skimmer Carrier wird in Infanterie-Stärkepunkten gezählt.

## 3. Phasen und Aktionen

| Phase | Erlaubte Aktion | Zähler | Automatischer Wechsel |
|---|---|---|---|
| Movement | Jede eigene, nicht gehandelte Einheit einmal bewegen | MOVE | optional |
| Fire | Jede eigene Einheit mit sichtbarem Ziel einmal feuern | FIRE | optional |
| Skimmer Maneuver | Skimmer einmal bis zu 2 zusätzliche Bewegungskosten | SKIMMER | optional |
| Hostile | Gegner feuern, sonst bewegen, danach erneut feuern | — | automatisch |

Eine Einheit darf in einem Zug grundsätzlich bewegen und feuern, sofern die jeweilige Phase und ihr Status dies erlauben. Deaktivierte Einheiten sind nicht handlungsfähig. Skimmer-Klassen teilen das Zusatzmanöver; stationäre Einheiten mit Bewegung 0 bleiben in ihrer Position. Phasenwechsel mit noch möglichen Aktionen werden bestätigt, sofern die Bestätigung nicht deaktiviert wurde.

## 4. Feuer- und Schadensmodell

| Verhältnis Angriff : Verteidigung | Würfelergebnis | Wirkung |
|---|---|---|
| 1:2 | NE / D / X | kein Effekt / Deaktivierung / Zerstörung |
| 1:1 | NE / D / X | kein Effekt / Deaktivierung / Zerstörung |
| 2:1 | NE / D / X | kein Effekt / Deaktivierung / Zerstörung |
| 3:1 | D / X | Deaktivierung / Zerstörung |
| 4:1 | D / X | Deaktivierung / Zerstörung |
| 5:1 | X | Zerstörung |

`D` deaktiviert Fahrzeuge bis zum Beginn des festgelegten Folgeturns. Bei Infanterie reduziert `D` die HP um 1. Eine weitere Deaktivierung zerstört ein bereits deaktiviertes Fahrzeug. `X` zerstört das Ziel unmittelbar.

## 5. Sonderregeln

- Der GOBLIN darf im Movement ein gegnerisches Fahrzeug rammen, wenn ein gültiger Bewegungspfad besteht. Der Core darf nicht gerammt werden.
- Skimmer erhalten nach Movement und Fire eine eigene Manöverphase mit maximal 2 Bewegungskosten.
- Gelände kostet Bewegung und blockiert Sichtlinie. Die Bewegungsvorschau und die tatsächliche Pfadprüfung verwenden dieselbe Pfadlogik.
- Ein Ziel ist nur beschießbar, wenn es in Reichweite liegt und die Sichtlinie frei ist.
- Zerstörte Einheiten bleiben als Wracks auf der Karte sichtbar.
- Der Skimmer Carrier kann bis zu drei Infanterie-Stärkepunkte aufnehmen. Einsteigen verbraucht die volle Bewegung der Infanterie; der Träger darf im selben Zug normal fahren. Ausgestiegene Infanterie darf in diesem Zug weder selbständig weiterziehen noch wieder einsteigen.
- Infanterie darf in dem Zug feuern, in dem sie ein- oder aussteigt, und kann vom Skimmer Carrier aus feuern. Sie wird über dessen Cargo-Leiste ausgewählt.
- Bei einem Angriff auf Träger und Passagiere gilt ein gemeinsamer Würfelwurf. Die Kampfquote und Wirkung werden für Träger und Infanterie getrennt berechnet; überlebende Passagiere eines zerstörten Trägers verbleiben im Trägerfeld.

## 6. Anzeigevertrag

- Movement Range: tatsächlich erreichbare Felder inklusive Gelände- und Belegungskosten.
- Fire Range: alle Felder innerhalb der Waffenreichweite.
- Line Of Sight: sichtbare Felder innerhalb der Waffenreichweite; nur äußerer Rand, keine Zellränder.
- Feldmarker: zuletzt angeklicktes Feld, immer oberster Kartenlayer.
- Gegnerische Einheiten dürfen zur Informations- und Overlay-Anzeige ausgewählt werden, lösen aber nur bei gültigem Feuerbefehl einen Angriff aus.

## 7. Bewusste Lücken für die nächste Ausbaustufe

1. GOBLIN-Plattformkomponenten sind als getrennte Schadensobjekte spielbar; aktive Waffenauswahl und das Abfeuern aller noch intakten Waffen in einer Feuerphase fehlen noch.
2. Trefferwürfel und CRT-Ergebnisse sind noch zufallsbasiert und nicht als reproduzierbarer Testmodus verfügbar.
3. Deckung, indirektes Feuer und die unterschiedlichen Bewegungsmodi sind noch nicht vollständig als Verteidigungs- und Sichtregeln integriert.
4. Weitere Transporttypen, strategische Lenkflugkörper, Nahbereichsgefechte, Engineering und Verstärkungen fehlen noch oder sind nur als Prototyp-Sonderfälle umgesetzt.
5. KI-Zielprioritäten und Szenario-Verstärkungen sind noch vereinfacht.
