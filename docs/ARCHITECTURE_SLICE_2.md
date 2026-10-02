# Architekturvertrag: modularer Schnitt 2

Stand: 2026-09-30. Ergänzung zu `ARCHITECTURE_HANDOFF.md` und `src/core/CONTRACT.md`; die bestehende Referenzpartie `core-v1` bleibt ein Regressionstest. Aufgaben und Abhängigkeiten stehen im lokalen Beads-Epic `goblin-4gi`.

## Ziel und Grenze

Dieser Schnitt macht Phasen, Skimmer-Zweitbewegung und die zeitgebundene Erholung deaktivierter Einheiten im modularen Pfad reproduzierbar. Der Core bestimmt den Spielzustand; `src/app` leitet Bedienung und Anzeige daraus ab; `src/hex-renderer` bleibt eine reine Darstellung. Der Legacy-Pfad dient dem lokalen Vergleich. Transport, KI, Undo, AUTO, Spezialwaffen, vollständige Szenariomigration, Veröffentlichung und Netzwerk gehören nicht zu diesem Schnitt.

## Core-Vertrag

- Die Phasenfolge pro Team ist `movement → fire → gev`. Nach `gev` wird `activeTeam` gewechselt; nach der gegnerischen `gev`-Phase beginnt die nächste Zugnummer. Beide Teams werden im modularen Test durch explizite Befehle gesteuert. Ein automatischer Gegnerzug ist keine Core-Funktion.
- Nur `EndPhase` wechselt die Phase. Der Core meldet genau ein `PhaseChanged`-Ereignis mit alter und neuer Phase, aktivem Team und Zugnummer. UI-Bestätigung und automatisches Weiterlaufen sind eigene, spätere Adapterfunktionen.
- `Move` in `movement` verbraucht `moved`. In `gev` ist ein zweiter `Move` ausschließlich für `movementMode: 'gev'` erlaubt, mit Bewegungskostenbudget **2** und dem eigenen Flag `secondMoved`. Ein Skimmer darf die Zusatzbewegung auch dann ausführen, wenn er die erste Bewegung ausgelassen hat. Nicht-Skimmer, verbrauchte Aktionen, deaktivierte und zerstörte Einheiten werden ohne Zustands- oder RNG-Änderung abgewiesen.
- `queryAreas(...).movementReachable` muss dieselbe Pfad- und Geländekostenprüfung wie `Move` verwenden. Während `gev` enthält sie nur legale Ziele für den aktiven, noch nicht zweitbewegten Skimmer. `fireRange` und `lineOfSight` bleiben getrennte geometrische Informationen; `attackableTargets` ist nur in der zulässigen Feuerphase gefüllt.
- Beim D-Ergebnis gegen ein Fahrzeug setzt der Core `disabled` und ein serialisierbares Fälligkeitsfeld für die Erholung. Die bestehende Legacy-Regel setzt bei einem Treffer auf ein gegnerisches Fahrzeug im Spielerzug die Fälligkeit auf `turn + 1`, bei einem Treffer auf ein eigenes Fahrzeug im Gegnerzug auf `turn + 2`. Erholung erfolgt **erst zu Beginn der Aktivierung dieses Teams**, sobald die Fälligkeit erreicht ist. Das getroffene Team bleibt somit für seinen unmittelbar folgenden Einsatz deaktiviert. Ein weiterer D-Treffer auf ein noch deaktiviertes Fahrzeug zerstört es; Infanterie verliert bei D stattdessen einen HP.
- Die Erholung und das Zurücksetzen von `moved`, `fired` und `secondMoved` sind Teil desselben deterministischen Teamwechsel-Übergangs. Ein eigenes fachliches Ereignis für eine erholte Einheit darf ergänzt werden; sein Name und Inhalt müssen vor der UI-Integration dokumentiert sein. Regelzustand und Ereignisse dürfen nicht von Timern oder Animationen abhängen.
- Der neue Testfall verwendet eine eigene `scenarioVersion` und `rulesVersion` (z. B. `phase-v2` und `core-v2`). Die `core-v1`-Fixture, ihr Seed und ihr Soll-Trace werden nicht umgedeutet. Falls der neue Zustandsvertrag zusätzliche Felder benötigt, muss `createGame` sie für beide Versionen deterministisch initialisieren. Keine implizite Save-Migration behaupten; persistierte Spielstände sind noch kein unterstützter Produktpfad.
- `dispatch` bleibt die einzige Quelle für Regelzustandsänderungen. Eine Ablehnung liefert den strukturierten Fehler und verändert weder Eingabezustand noch RNG. Selektion, Fokus, Overlay-Modus und Animation bleiben `ViewState`.

## Gemeinsame Fixture und Abnahme

Core / Engine legt in `src/core` eine zweite, browserunabhängige Fixture mit einem Spieler-Skimmer, mindestens einem normalen Fahrzeug, einer gegnerischen Einheit und einem nicht sofort zerstörten Ziel an. Seed, Befehlsfolge und Soll-Trace werden exportiert. Der Trace muss mindestens Folgendes zeigen:

1. Erste Skimmer-Bewegung und verbotene zweite Bewegung in `movement`.
2. Wechsel nach `fire`, dann nach `gev`; die Skimmer-Zweitbewegung innerhalb von Budget 2, ein abgelehnter Versuch außerhalb des Budgets und eine abgelehnte zweite `gev`-Aktion.
3. Teamwechsel, Aktionsrücksetzung nur für das neu aktive Team und korrekte Zugnummer.
4. Einen deterministischen D-Treffer, Handlungsverbot für das betroffene Fahrzeug und Erholung genau beim festgelegten späteren Teamstart. Ein gesonderter Test prüft D auf bereits deaktiviertem Fahrzeug und D auf Infanterie.
5. Zwei identische vollständige Replays einschließlich Ereignissen und RNG; Ablehnungen lassen Zustand und RNG unverändert. Der bisherige `core-v1`-Replay bleibt grün.

Der Developer bindet **dieselbe** Fixture im lokalen Vergleichspfad ein. Phasentitel, Button, Bereitschaftszähler, Skimmer-Overlay und Status `DISABLED`/wieder einsatzbereit stammen aus Core-Zustand, `queryAreas` und Ereignissen. Ereignisse werden einmal verarbeitet; ein ViewState-Render spielt sie nicht erneut ab. Der bestehende Legacy-Umschalter und die erste Referenzpartie bleiben benutzbar.

Der Tester erstellt zuerst die unabhängige Matrix und prüft die Integration erst nach Core und UI. Browserprüfung erfolgt lokal, mit zweimaligem Durchlauf der Fixture sowie getrennten Legacy-Smokes für IRON DUST und ATLAS. Die Smokes sind keine vollständige Regelparität. Abweichungen bei Legacy-Hexdistanz oder KI werden separat entschieden und sperren diesen Schnitt nur, wenn sie dessen vereinbarte Befehle oder Anzeige verfälschen.

## Zuständigkeiten und Gate

Core / Engine besitzt `src/core/**` und seine Tests; Developer besitzt `src/app/**` und UI-Tests. Änderungen an gemeinsamem Vertrag, Fixture-Feldern und Ereignisnamen gehen vor Integration an den Architekten. Tester schreibt die Matrix und den unabhängigen Bericht. `INT-02` prüft automatisierte Tests, Browserbericht, offenen Abweichungsstand und den unveränderten Legacy-Vergleich. Dieses Gate ist keine Release- oder Push-Freigabe.
