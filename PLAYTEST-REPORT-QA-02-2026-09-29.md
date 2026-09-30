# QA-02 – Lokaler Integrationstest

- **Datum:** 2026-09-29
- **Testumgebung:** Playwright, lokaler Vergleichsserver `http://127.0.0.1:4174/src/app/compare.html`
- **Pfad:** Neuer Core-Pfad und bisheriges Spiel über den Vergleichs-Umschalter
- **Release-Status:** interner Zwischenstand, ausdrücklich als „KEIN RELEASE“ markiert
- **Fixture / Seed:** `src/core/reference-fixture.mjs`, Seed `0x0b11a1`
- **Scope:** QA-01-Testmatrix; keine Prüfung oder Veröffentlichung von GitHub Pages

## Ergebnis

Die Core-Referenzpartie war über den UI-Pfad in zwei kontrollierten Durchläufen reproduzierbar bis zum Sieg spielbar. Bewegung, Phasenwechsel, beide vorgegebenen Kampfergebnisse und der Siegstatus stimmten mit den erwarteten Replay-Werten überein. Die Legacy-Szenarien IRON DUST und ATLAS / PROVING GROUNDS ließen sich laden; bei ATLAS wurde zusätzlich eine Bewegung ausgeführt.

Im kontrollierten Durchlauf wurde jeder fachliche Event einmal angezeigt. Die sichtbare UI ließ einen weiteren Bewegungsversuch mit einer bereits bewegten Einheit ohne Zustandsänderung abprallen. Der konkrete `ACTION_SPENT`-Fehlercode ist über die Spieloberfläche nicht sichtbar und wurde daher nicht direkt geprüft.

## Prüfergebnisse

| Bereich | Ablauf und Beobachtung | Status |
|---|---|---|
| Pfadwechsel / Startzustand | Neuer Core-Pfad und Legacy-Pfad lassen sich über den Umschalter getrennt starten. Core-Pfad zeigt die vier Einheiten p-1, p-2, e-1 und e-core, Runde 1 und Movement Phase. | Bestanden |
| Selektion / ViewState | p-1 über die Einheitenliste gewählt. Markierung, Field/Unit Intel und Fokus auf der Karte änderten sich; Phase, Zug, Bereitschaftszähler und Eventliste blieben unverändert. | Bestanden |
| Bewegung | p-1 vom Startfeld auf UI-Feld 3,5 bewegt (Core-Koordinate `{x:2,y:4}`). Intel und Karte zeigten p-1 dort; `UnitMoved` meldete Start `{x:1,y:3}` und Ziel `{x:2,y:4}`. p-1 wechselte zu „Aktion verbraucht“, Bereitschaft von 2/2 auf 1/2. | Bestanden |
| Illegale zweite Bewegung (UI) | Nach Verbrauch der Bewegung p-1 erneut gewählt und ein weiteres Feld angeklickt. Position, Aktionstatus, Bereitschaft 1/2 und Eventfolge blieben unverändert. Die UI bietet keinen sichtbaren direkten Test für die strukturierte Ablehnung `ACTION_SPENT`; nur die wirkungslose Abweisung über die Bedienoberfläche ist bestätigt. | Teilweise geprüft |
| Phasenwechsel | `Zur Fire Phase` führte von Movement zu Fire; `PhaseChanged` erschien einmal, die Fire-Bereitschaft stand auf 2/2. | Bestanden |
| Fire / D-Ergebnis | Im Fire-Modus p-1 auf e-1 bei UI-Feld 5,4 feuern lassen. Ergebnis: Roll 2, Verhältnis 2-1, D; e-1 `disabled=true`, HP unverändert 2/2; p-1s Feueraktion verbraucht. | Bestanden |
| Fire / Sieg | p-2 auf e-core bei UI-Feld 5,6 feuern lassen. Ergebnis: Roll 1, Verhältnis 5-1, X; e-core 0/1 und zerstört; `GameEnded` meldete `winner=player`, die UI zeigte „Sieg: player“ und deaktivierte den Phasenbutton. | Bestanden |
| Seed / Replay | Referenzfolge mit Seed `0x0b11a1` zweimal von einem frischen Core-Pfad gespielt. Beide Male: Move p-1→(2,4), Phase movement→fire, p-1→e-1 Roll 2 / 2-1 / D / disabled bei HP 2, p-2→e-core Roll 1 / 5-1 / X / `GameEnded(player)`. In der stabilisierten Eventliste stand jeder Event einmal. | Bestanden |
| Picking / Fokus / Movement Overlay | Einheitenauswahl über Liste und Karte funktionierte; Field Intel folgte dem angeklickten Feld. Ausgewähltes p-1 war visuell fokussiert; erreichbare Bewegungsfelder wurden grün hervorgehoben. | Bestanden |
| Fire- und LOS-Overlay | Fire zeigte einen roten Reichweitenbereich mit markiertem Ziel; LOS verwendete eine andere, blaue Sichtflächenanzeige. Das blockierende Bergfeld selbst blieb sichtbar markiert, Felder dahinter waren nicht markiert. | Bestanden |
| Legacy: IRON DUST | Szenario geladen (Mission 07, vier Einheiten, Objective Command Core). Phasenwechsel zu Fire forderte erwartungsgemäß Bestätigung, da vier Einheiten noch offen waren. Kein vollständiger Missionsdurchlauf. | Smoke bestanden |
| Legacy: ATLAS / PROVING GROUNDS | Szenario geladen (Mission 10, HOSTILES 8/8, 18 eigene Einheiten). Assault Tank zeigte 3/3 HP, Bewegung 3 und Reichweite 2. Ein erreichbares Feld führte zu einer Bewegung nach E-04; MOVE sank von 16/18 auf 15/18. Kein vollständiger Missionsdurchlauf. | Smoke bestanden |

## Abweichung im lokalen Testharness

Beim Laden der Vergleichsseite meldete die Browserkonsole reproduzierbar `GET /favicon.ico 404 (Not Found)`. Die Vergleichsseite und das Spiel blieben bedienbar; dies blockierte die Spielszenarien nicht. Vermutlicher Zuständigkeitsbereich: Developer / lokale Compare-Seite. Kein öffentlicher Build wurde aufgerufen.

## Einschränkungen

- `ACTION_SPENT` konnte als sichtbares UI-Verhalten (keine Zustandsänderung) geprüft werden, nicht als direkter Core-Rückgabewert `{error:{code,details}}`.
- IRON DUST und ATLAS wurden als Legacy-Smokes geprüft, nicht bis Sieg oder Niederlage durchgespielt.
- Der eine Konsolen-404 betrifft das lokale Compare/Testharness und wurde nicht als Releasefehler bewertet.
- Beads konnten aus diesem Task wegen des weiterhin scheiternden Shell-Starts nicht aktualisiert werden. Der reproduzierbare 404-Befund wurde der Architekturkoordination mit Zuständigkeitsvorschlag Developer gemeldet.
