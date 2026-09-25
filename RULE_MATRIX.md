# G.O.B.L.I.N Regelmatrix

Stand: 2026-09-25 · Version: 0.1 · Zweck: verbindliche Referenz für Spiel, KI und Szenarien.

## 1. Einheitentypen

| Einheit | Team | HP | Bewegung | Reichweite | Rolle | Status |
|---|---:|---:|---:|---:|---|---|
| GOBLIN MK III | Spieler | 5 | 1 | 2 | Schwerer Angriff, Rammen | implementiert |
| GEV SCOUT | Spieler | 3 | 3 | 3 | Schnelles Hovercraft, Zweitbewegung | implementiert |
| MISSILE TANK | Spieler | 3 | 1 | 4 | Artillerie | implementiert |
| INFANTRY PLATOON | Spieler | 2 | 2 | 1 | Mobile Infanterie | implementiert |
| GUARD TANK | Gegner | 3 | 1 | 2 | Gegnerische Panzerung | implementiert |
| RAIDER GEV | Gegner | 2 | 2 | 2 | Gegnerisches Hovercraft | implementiert |
| COMMAND CORE / RELAY NODE | Gegner | 5 / 4 | 0 | 0 | Missionsziel | implementiert |

## 2. Gelände

| Gelände | Bewegungskosten | Deckung | Sichtlinie | Status |
|---|---:|---|---|---|
| Offenes Gelände | 1 | nein | frei | implementiert |
| Berg-/Trümmerfeld | 2 | ja | blockiert | implementiert |
| Belegtes Feld | — | — | — | für Bewegung blockiert; Ziel-/Rammregeln separat |

## 3. Phasen und Aktionen

| Phase | Erlaubte Aktion | Zähler | Automatischer Wechsel |
|---|---|---|---|
| Movement | Jede eigene, nicht gehandelte Einheit einmal bewegen | MOVE | optional |
| Fire | Jede eigene Einheit mit sichtbarem Ziel einmal feuern | FIRE | optional |
| GEV Movement | GEV einmal bis zu 2 zusätzliche Bewegungskosten | GEV | optional |
| Hostile | Gegner feuern, sonst bewegen, danach erneut feuern | — | automatisch |

Eine Einheit darf in einem Zug grundsätzlich bewegen und feuern, sofern die jeweilige Phase und ihr Status dies erlauben. Deaktivierte Einheiten sind nicht handlungsfähig. Phasenwechsel mit noch möglichen Aktionen werden bestätigt, sofern die Bestätigung nicht deaktiviert wurde.

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

## 6. Anzeigevertrag

- Movement Range: tatsächlich erreichbare Felder inklusive Gelände- und Belegungskosten.
- Fire Range: alle Felder innerhalb der Waffenreichweite.
- Line Of Sight: sichtbare Felder innerhalb der Waffenreichweite; nur äußerer Rand, keine Zellränder.
- Feldmarker: zuletzt angeklicktes Feld, immer oberster Kartenlayer.
- Gegnerische Einheiten dürfen zur Informations- und Overlay-Anzeige ausgewählt werden, lösen aber nur bei gültigem Feuerbefehl einen Angriff aus.

## 7. Bewusste Lücken für die nächste Ausbaustufe

1. Trefferwürfel und CRT-Ergebnisse sind noch zufallsbasiert und nicht als reproduzierbarer Testmodus verfügbar.
2. Deckung beeinflusst aktuell die Sichtlinie, aber noch keinen separaten Verteidigungsmodifikator.
3. Bewegungs- und Feuerwerte sind Prototypwerte und müssen gegen die gewünschte Goblin-Regelbasis validiert werden.
4. KI-Zielprioritäten und Szenario-Verstärkungen sind noch vereinfacht.
5. Overrun/Ramming, Transport, Reparatur und weitere Sonderfälle sind noch nicht vollständig modelliert.