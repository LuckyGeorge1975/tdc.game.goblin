# G.O.B.L.I.N Regelmatrix

Stand: 2026-09-25 · Version: 0.1 · Zweck: verbindliche Referenz für Spiel, KI und Szenarien.

## 1. Einheitentypen

| Einheit | Team | HP | Bewegung | Reichweite | Rolle | Status |
|---|---:|---:|---:|---:|---|---|
| GOBLIN MK III | Spieler | 5 | 1 | 2 | Schwerer Angriff, Rammen | implementiert |
| GEV SCOUT | Spieler | 3 | 3 | 3 | Schnelles Hovercraft, Zweitbewegung | implementiert |
| MISSILE TANK | Spieler | 3 | 1 | 4 | Artillerie | spielbar, Verteidigung separat |
| INFANTRY PLATOON | Spieler | 2 | 2 | 1 | Mobile Infanterie | implementiert |
| GUARD TANK | Gegner | 3 | 1 | 2 | Gegnerische Panzerung | implementiert |
| RAIDER GEV | Gegner | 2 | 2 | 2 | Gegnerisches Hovercraft | implementiert |
| COMMAND CORE / RELAY NODE | Gegner | 5 / 4 | 0 | 0 | Missionsziel | implementiert |

## 1.1 Kanonischer Einheitenkatalog

Die Werte unten sind aus der frei verfügbaren SJG-Regelreferenz für die gemeinsame Ogre/G.E.V.-Basis und die genannten Erweiterungen zusammengetragen. `Katalog` bedeutet: im Datenmodell und Unit Guide vorhanden; `spielbar` bedeutet zusätzlich in Bewegung, Feuer, Schaden und KI integriert.

| Einheit | Angriff / Reichweite | Verteidigung | Bewegung | Quelle | Status |
|---|---:|---:|---:|---|---|
| Heavy Tank | 4 / 2 | 3 | 3 | Ogre/G.E.V. | Katalog |
| Missile Tank | 3 / 4 | 2 | 2 | Ogre/G.E.V. | spielbar, Prototypwerte abweichend |
| Light Tank | 2 / 2 | 2 | 3 | Ogre/G.E.V. | Katalog |
| Superheavy Tank | 6* / 3 | 5 | 3 | Ogre/G.E.V. | Katalog |
| Howitzer | 6 / 8 | 1 | 0 | Ogre/G.E.V. | Katalog |
| Mobile Howitzer | 6 / 6 | 2 | 1 | Shockwave | Katalog |
| GEV | 2 / 2 | 2 | 4 + 3 | Ogre/G.E.V. | Katalog; Zweitbewegung vorhanden |
| Light GEV | 1 / 2 | 1 | 4 + 3 | Shockwave | Katalog |
| GEV-PC | 1 / 2 | 2 | 3 + 2 | Shockwave | Katalog |
| Missile Crawler | Cruise Missile | 2 | 1 | Shockwave | Katalog |
| Light Artillery Drone | 2 / 8 | 1 | 0 | Battlefields | Katalog |
| Infantry / Marines | je Trupp | je Trupp | 2 | Basis / Shockwave | Prototyp-Infanterie spielbar |
| Combat Engineers | 2 / 1 | 2 | 2 | Reinforcement Pack | Katalog |
| Militia | 1 / 1 | 1 | 2 | Battlefields | Katalog |
| Command Post | — | 2 | 0 | Basis | Missionsziel spielbar |

`*` Der Superheavy kann den Angriff auf zwei gleich starke Angriffe aufteilen. Oger werden nicht als ein einzelner HP-Wert behandelt: Mk. III und Mk. V besitzen Waffen- und Kettenkomponenten. Dafür liegt jetzt ein separates `OGRE_SYSTEMS`-Datenmodell vor; die Komponentenlogik folgt als nächster Implementierungsschritt.
## 2. Gelände

| Gelände | Bewegungskosten | Deckung | Sichtlinie | Status |
|---|---:|---|---|---|
| Offenes Gelände | 1 | nein | frei | implementiert |
| Berg-/Trümmerfeld | 2 | ja | blockiert | implementiert |
| Belegtes Feld | — | — | — | für Bewegung blockiert; Ziel-/Rammregeln separat |

Das Szenario `UNIT TRIAL` stellt den neuen Katalog mit Heavy Tank, Light Tank, GEV-PC und Combat Engineers erstmals im Spielfluss bereit. Combat Engineers können im Movement in den benachbarten GEV-PC einsteigen und über die Transport-Schaltfläche an einem freien Nachbarfeld aussteigen. Die Kapazität des GEV-PC wird in Infanterie-Stärkepunkten gezählt.

## 3. Phasen und Aktionen

| Phase | Erlaubte Aktion | Zähler | Automatischer Wechsel |
|---|---|---|---|
| Movement | Jede eigene, nicht gehandelte Einheit einmal bewegen | MOVE | optional |
| Fire | Jede eigene Einheit mit sichtbarem Ziel einmal feuern | FIRE | optional |
| GEV Movement | GEV einmal bis zu 2 zusätzliche Bewegungskosten | GEV | optional |
| Hostile | Gegner feuern, sonst bewegen, danach erneut feuern | — | automatisch |

Eine Einheit darf in einem Zug grundsätzlich bewegen und feuern, sofern die jeweilige Phase und ihr Status dies erlauben. Deaktivierte Einheiten sind nicht handlungsfähig. GEV-Klassen teilen die Zweitbewegung; stationäre Einheiten mit Bewegung 0 bleiben in ihrer Position. Phasenwechsel mit noch möglichen Aktionen werden bestätigt, sofern die Bestätigung nicht deaktiviert wurde.

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
- Der GEV erhält nach Movement und Fire eine eigene Zweitbewegungsphase mit maximal 2 Bewegungskosten.
- Gelände kostet Bewegung und blockiert Sichtlinie. Die Bewegungsvorschau und die tatsächliche Pfadprüfung verwenden dieselbe Pfadlogik.
- Ein Ziel ist nur beschießbar, wenn es in Reichweite liegt und die Sichtlinie frei ist.
- Zerstörte Einheiten bleiben als Wracks auf der Karte sichtbar.
- Der GEV-PC kann bis zu drei Infanterie-Stärkepunkte aufnehmen. Einsteigen verbraucht die volle Bewegung der Infanterie; der Träger darf im selben Zug normal fahren. Ausgestiegene Infanterie darf in diesem Zug weder selbständig weiterziehen noch wieder einsteigen.
- Infanterie darf in dem Zug feuern, in dem sie ein- oder aussteigt, und kann vom GEV-PC aus feuern. Sie wird über dessen Cargo-Leiste ausgewählt.
- Bei einem Angriff auf Träger und Passagiere gilt ein gemeinsamer Würfelwurf. Die Kampfquote und Wirkung werden für Träger und Infanterie getrennt berechnet; überlebende Passagiere eines zerstörten Trägers verbleiben im Trägerfeld.

## 6. Anzeigevertrag

- Movement Range: tatsächlich erreichbare Felder inklusive Gelände- und Belegungskosten.
- Fire Range: alle Felder innerhalb der Waffenreichweite.
- Line Of Sight: sichtbare Felder innerhalb der Waffenreichweite; nur äußerer Rand, keine Zellränder.
- Feldmarker: zuletzt angeklicktes Feld, immer oberster Kartenlayer.
- Gegnerische Einheiten dürfen zur Informations- und Overlay-Anzeige ausgewählt werden, lösen aber nur bei gültigem Feuerbefehl einen Angriff aus.

## 7. Bewusste Lücken für die nächste Ausbaustufe

1. Oger-Komponenten (Waffen, Raketen, Antipersonenwaffen, Ketten) sind katalogisiert, aber noch nicht als getrennte Schadensobjekte spielbar.
2. Trefferwürfel und CRT-Ergebnisse sind noch zufallsbasiert und nicht als reproduzierbarer Testmodus verfügbar.
3. Deckung, indirektes Feuer und die unterschiedlichen Bewegungsmodi sind noch nicht vollständig als Verteidigungs- und Sichtregeln integriert.
4. Weitere Transporttypen, Cruise Missiles, Overrun, Engineering und Verstärkungen fehlen noch oder sind nur als Prototyp-Sonderfälle umgesetzt.
5. KI-Zielprioritäten und Szenario-Verstärkungen sind noch vereinfacht.
