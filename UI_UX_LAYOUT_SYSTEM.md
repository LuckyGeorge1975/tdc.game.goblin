# G.O.B.L.I.N. – responsives UI/UX-Layoutsystem

**Stand:** 30.09.2026 · **Status:** Entwurf zur Projektkoordination, keine Implementierung

## 1. Leitlinien

1. **Karte zuerst.** Während einer Partie bleiben Karte, Missionsziel, Phase, Zug und nächste Hauptaktion sichtbar. Dekorative Telemetrie und Anleitung konkurrieren nicht mit diesen Informationen.
2. **Ein Zustand, eine Hauptaktion.** Die Schaltfläche für den nächsten Phasenschritt ist eindeutig beschriftet, z. B. „Feuerphase beginnen“ statt „END TURN“. Undo/BACK bleibt in der laufenden Phase erreichbar, sofern ein Befehl rückgängig gemacht werden kann.
3. **Gleiche Spielinformation auf allen Geräten.** Kleine Displays ändern Anordnung und Detailtiefe, nicht Regeln, gültige Ziele oder Aktionsmöglichkeiten. Verborgene Panels erhalten einen sichtbaren Einstieg.
4. **Touch ist vollwertig.** Keine Funktion setzt Hover, Tastaturkürzel oder präzises Treffen eines dünnen Hexrands voraus. Karte und Bedienelemente dürfen sich nicht gegenseitig überdecken.
5. **Ruhige Standards.** Details zu Terrain, Einheit, Log und Hilfe erscheinen auf Auswahl oder Nachfrage. Kritische Information wie Ziel, aktuelle Phase, Aktionsfähigkeit und Gefahrenwarnung erscheint ohne zusätzliche Navigation.

## 2. Navigationsmodell und Screens

| Screen | Primärinhalt | Hauptaktion | Sekundär |
| --- | --- | --- | --- |
| Start | Spieltitel, kurzer Missionskontext, „Fortsetzen“ bei vorhandenem Spielstand | Fortsetzen / Mission wählen | Einstellungen, Hilfe, rechtliche Hinweise |
| Levelwahl | Szenariokarten mit Ziel, Umfang und Status; klare Kennzeichnung verfügbar/nicht verfügbar | Mission starten | Zurück, Details |
| Missionsbriefing | Ziel, Sieges-/Niederlagebedingung, besondere Mechanik in wenigen Sätzen | Einsatz beginnen | Zurück zur Levelwahl |
| Spiel | Karte und kompakter Status; kontextabhängige Einheitenaktion | Gültige Kartenaktion bzw. nächste Phase | Einheit/Feld, Undo, Overlay, Log, Pause |
| Pause | Spiel fortsetzen | Fortsetzen | Neustart, Levelwahl, Einstellungen, Hilfe; destruktive Schritte bestätigen |
| Einstellungen | Sprache, Darstellung/Icon-Set/Terrain-Set, Raster, Bestätigungen, Audio falls vorhanden | Änderungen übernehmen bzw. direkt wirksame Änderung | Zurück; Reset nur mit eigener Bestätigung |
| Missionsende | Ergebnis und Zielstatus | Erneut spielen / Levelwahl | Log und Missionsdetails |
| Hilfe / Unit Guide | kurze, nach Themen gegliederte Bedienhilfe; Live-Werte klar von Katalogwerten getrennt | Zurück zum Spiel | Auf Karte fokussieren ohne Befehl auszulösen |

Navigation bleibt flach: Start → Levelwahl → Briefing → Spiel. Pause, Einstellungen und Hilfe öffnen mit eindeutigem Rückweg. Ein Szenario- oder Stilwechsel während einer laufenden Partie, der die Mission neu startet, braucht die bereits vorhandene Neustartbestätigung. **Für den aktuellen Stand entfällt „Fortsetzen“**, solange kein verlässlich speicherbarer Spielstand nachgewiesen ist.

## 3. Gemeinsame Spielbausteine und Priorität

**Immer sichtbar:** Karte; Missionsziel mit Fortschritt; aktuelle Phase und Zugnummer; verbleibende Aktionen der aktiven Phase; ausgewählte Einheit und ihr Status; erreichbare nächste Aktion oder Grund, weshalb keine möglich ist; Phasenwechsel. Eine erkennbare Pause-/Menüschaltfläche bleibt erreichbar.

**Kontextabhängig:** Bei Einheitenwahl Name, HP/Zustand, Bewegung/Feuerstatus, ggf. Waffe und Cargo. Bei Feldwahl Gelände, Bewegungskosten für die gewählte Einheit, Deckung und Sicht. In der Fire Phase ggf. gültige Ziele und Friendly-Fire-Risiko; bei Transporter Lade-/Entladeaktion. Nur tatsächlich implementierte Sonderaktionen anbieten.

**Aufrufbar:** vollständige Einheitenliste, Combat Log, ausführliche Field/Unit Intel, Unit Guide, Overlay-Auswahl, Icon-/Terrain-Set, Raster und Einstellungen. Statusmeldungen melden ungültige Aktionen im Kontext der Karte mit einer kurzen Begründung; sie ersetzen keine dauerhafte Zustandsanzeige.

Die Spieloberfläche besteht aus fünf wiederverwendbaren Bereichen: **Missionsleiste**, **Kartenfläche**, **Auswahlkarte**, **Aktionsleiste** und **Detailbereich**. Ihre Inhalte bleiben logisch identisch, auch wenn die Anordnung wechselt. Der Detailbereich enthält Tabs/Abschnitte für Einheiten, Feld, Log und Hilfe; die Auswahlkarte zeigt nur die für den nächsten Befehl nötigen Werte.

## 4. Responsive Anordnung

Die Grenzen sind Entwurfswerte in CSS-Pixeln und anhand realer Geräte zu prüfen. Verfügbare Breite und Höhe sind maßgeblich; Gerätetyp oder User-Agent entscheiden nicht über Funktionen.

| Bereich | PC (ab ca. 1180 px) | Tablet (ca. 700–1179 px) | Mobile (unter ca. 700 px) |
| --- | --- | --- | --- |
| Grundraster | Einheiten/Details links, große Karte mittig, Kontext/Log rechts | Karte oben bzw. zentral; Details als umschaltbare Seitenleiste oder untere Fläche | Karte unter kompakter Missionsleiste; Auswahlkarte und Aktionsleiste am unteren Rand |
| Karte | Maximale nutzbare Höhe, ohne durch Seitenleisten verschmälert zu werden | Vorrang vor dauerhaft offenen Panels; Seitenleiste schließt vor dem Kartentap | Mindestens die für eine Entscheidung nötigen Hexfelder sichtbar; schwenken/zoomen ohne Aktionsauslösung |
| Einheitenliste | Direkt sichtbar; lange Listen scrollen im eigenen Bereich | Per gut sichtbarem „Einheiten“-Einstieg; bei Platz offen | Unteres Panel/Sheet, Auswahl fokussiert Karte und schließt Panel |
| Field/Unit Intel | Schmale kontextuelle Karte, Details ausklappbar | Seitliches oder unteres Panel | Kompakte Auswahlkarte; ausführliche Werte per Sheet |
| Log | In rechter Spalte, jüngstes Ereignis hervorgehoben | Aufrufbar, letztes Ergebnis kurz im Kontext | Aufrufbar; keine dauerhafte Logspalte |
| Aktionsleiste | Neben/unter Karte | Am Kartenrand fest erreichbar | Oberhalb der System-Safe-Area fest erreichbar; maximal eine primäre Aktion plus wenige Kontextaktionen, weitere im Sheet |

**Skizze der Spielansicht:**

```text
PC:      [Mission/Ziel/Phase] [Einheiten | Karte | Intel/Log] [Auswahl + Aktionen]
Tablet:  [Mission/Ziel/Phase] [Karte | optionales Detailpanel] [Auswahl + Aktionen]
Mobile:  [Mission/Ziel/Phase] [Karte] [Auswahlkarte] [Aktionen]
                                  ↳ Einheiten / Intel / Log als Sheet
```

Auf schmalen Screens bleibt die Karte während der Eingabe nutzbar. Ein offenes Sheet ist entweder kurz (mit sichtbarer Karte) oder modal und klar schließbar. Hoch- und Querformat werden geprüft; im Querformat darf die Aktionsleiste nicht so viel Höhe beanspruchen, dass die Karte unbrauchbar wird. Browser-Zoom, Safe Areas und virtuelle Tastatur dürfen keine Hauptaktion verdecken.

## 5. Karteninteraktion und Overlays

- **Wählen:** Tap/Klick auf Einheit oder Feld zeigt Auswahlkarte und passende Overlay-Information. Ein erster Tap auf ein Hex löst keine irreversible Aktion aus. Eigene Einheit, Gegner und leeres Feld sind unterscheidbar.
- **Befehl:** Gültige Bewegungs- oder Feuerziele werden sichtbar markiert; Tap auf markiertes Ziel führt den Befehl aus. Bei engem Hexraster wird ein Ziel zunächst deutlich hervorgehoben und eine leicht erreichbare Bestätigung angeboten. Die konkrete Schwelle wird im Gerätetest entschieden.
- **Karte bewegen:** Drag/Pan und Zoom sind von Tap getrennt; nach einem Pan wird kein Kartenbefehl ausgelöst. Ein „Zur Auswahl“-Knopf fokussiert die gewählte Einheit. Die Auswahl bleibt beim Öffnen/Schließen von Intel erhalten.
- **Overlay-Wahl:** Bewegung, Feuerreichweite und Sichtlinie sind über kurze beschriftete Segmente erreichbar. Das zur Phase passende Overlay ist voreingestellt. Farben werden durch Konturen/Muster und Legende ergänzt. Der Feldmarker liegt über den Overlays, wie in der Regelmatrix festgelegt.
- **Gelände-Vorschau:** Terrain-Setwechsel und Raster sind Darstellungsoptionen im Spielmenü oder kompakten Kartenmenü; sie ändern keine Befehlslogik. Hex-/Unit-Picking bleibt bei jedem Set und Zoomzustand konsistent. Ein Setwechsel darf die Auswahl und Kartenposition nicht überraschend verlieren.
- **Spezialfälle:** Waffensysteme und Cargo erhalten eine kontextuelle Auswahl in der Auswahlkarte. Raketenwirkung einschließlich benachbarter eigener Einheiten wird vor dem Schuss sichtbar erläutert; Ziel und Wirkbereich müssen auf Touch unterscheidbar sein.

## 6. Dialogsystem

Ein einheitlicher Dialograhmen hat Titel, knappen Sachverhalt, klare Handlungsoptionen und sichtbaren Abbruch. Fokus beginnt auf einer sicheren Aktion; Tab/Enter/Escape und Touch funktionieren. Während eines modalen Dialogs sind Kartenbefehle, Kürzel und AUTO gesperrt; beim Schließen kehrt der Fokus zum auslösenden Element zurück. Ein Dialog passt vollständig in den sichtbaren Bereich oder scrollt nur seinen Inhalt, nicht die Aktionsleiste.

| Dialogtyp | Auslöser und Inhalt | Aktionen |
| --- | --- | --- |
| Phasenwechsel | Noch mögliche Aktionen + Anzahl benennen | „Weiter zur [Phase]“, „Zurück“; „Nicht erneut fragen“ nur hier |
| Neustart/Level-/Setwechsel | Konsequenz „laufende Mission beginnt neu“ konkret benennen | „Neu starten/wechseln“, „Abbrechen“ |
| Gefährlicher Spezialbefehl | Ziel und mögliche eigene Treffer zeigen, wenn die Kartenanzeige allein nicht eindeutig ist | „Angriff ausführen“, „Abbrechen“ |
| Missionsende | Sieg/Niederlage, Zielstatus | „Erneut spielen“, „Levelwahl“, „Log ansehen“ |

Gewöhnliche Einheiten- und Feldinformationen sind nicht modal. Für kurzlebige Phasen- oder Kampfergebnisse reicht eine Statusmeldung, solange das Ergebnis im Log auffindbar bleibt. Dialogtexte erklären die tatsächliche Auswirkung, nicht nur „Bist du sicher?“.

## 7. Maße, Lesbarkeit und Lokalisierung

- Interaktive Touch-Flächen als Mindestentwurfswert **44 × 44 CSS px**, mit Abstand zwischen gegensätzlichen Aktionen. Die sichtbare Hexgrafik darf kleiner sein, sofern ihre Eingabefläche und die Zielauswahl verlässlich funktionieren. Für die Mindestgröße des sichtbaren Kartenbereichs und die Schwelle zur zweistufigen Hex-Bestätigung gelten erst nach PC-, Tablet- und Mobile-Geräteproben verbindliche Werte.
- Fließtext und Status müssen auf Mobile ohne Pinch-Zoom lesbar sein; keine Information nur durch Farbe, Blinken oder Hover. Fokuszustände sind sichtbar, Screenreader-Namen beschreiben Funktion und Zustand.
- DE/EN/ES/FR benötigen variable Textlängen. Labels dürfen umbrochen werden; feste Pixelbreiten und abgeschnittene Hauptaktionen sind unzulässig. Für Phasen und Dialoge kurze, eindeutige Lokalisierungsschlüssel vorsehen. Sprachwechsel erhält, sofern technisch möglich, aktuelle Auswahl und Kontext.
- Spieltexte, Tutorial, Szenarioziele und Sonderregeln kommen vom Content/Localization-Team. Der Entwurf definiert Slots und maximale Leselast, keine erfundenen Level oder Regelwerte. Für Tablet und Mobile sind kurze Varianten langer Missionsbeschreibungen hilfreich, aber Ziel und Siegbedingung müssen vollständig erreichbar bleiben.

## 8. Prüfbare Abnahmekriterien für die spätere Umsetzung

1. Start → Levelwahl → Briefing → Spiel sowie Spiel → Pause/Einstellungen/Hilfe → Spiel funktionieren per Maus, Tastatur und Touch mit erkennbarem Rückweg.
2. Auf PC, Tablet hoch/quer und Mobile hoch/quer sind Ziel, Phase, Zug, Auswahl, Aktionsfähigkeit und Phasenwechsel ohne Scrollen im Spielbereich erkennbar; Karte und Hauptaktion bleiben bedienbar.
3. Jede bestehende Spielaktion (Bewegen, Feuern, Waffe wählen, Transport, Undo, Overlays, Phasenwechsel, Neustart) ist ohne Tastatur und ohne Hover erreichbar. Ungültige Aktionen erklären ihren Grund.
4. Dialoge sperren Hintergrundaktionen, lassen sich sicher abbrechen und geben Fokus zurück. „Nicht erneut fragen“ wirkt nur beim Phasenende.
5. Terrain-Set, Raster, Zoom und Pan verändern weder Regeln noch Hex-/Unit-Picking. Auswahl und markiertes Feld bleiben nach Darstellungswechsel nachvollziehbar.
6. DE/EN/ES/FR zeigen vollständige Hauptaktionen, Dialogoptionen und Missionsziele ohne Überlappung oder abgeschnittenen Text; längste Texte werden auf kleinstem Zielviewport geprüft.
7. Ein Touch-Test mit realistischen Fingertreffern bestätigt Zielwahl auf dicht belegten Hexen. Kritische Spezialangriffe zeigen vor Ausführung Ziel und potenziellen Wirkbereich.

## 9. Übergabe und Entscheidungen der Projektkoordination

- **Developer:** Screen-Routing und responsive Bausteine aus diesem Entwurf in umsetzbare Schritte zerlegen; Legacy- und modularen Spielpfad als getrennte Integrationsorte bewerten.
- **Core/Engine:** prüfen, welche Zustandsdaten/Aktionsgründe die Auswahlkarte und die Warnungen bereits liefern; UI erhält Regeln nur aus GameState/Queries, nicht aus eigenen Annahmen.
- **Content und Localization:** kurze Missions-/Dialogtexte und Schlüssel für DE/EN/ES/FR abstimmen; besonders Spezialangriff, Phasenwechsel und Neustart. Keine zusätzlichen Textmengen in die dauerhafte HUD-Leiste legen.
- **Tester:** spätere Abnahme mit PC, Tablet und Mobile in beiden Orientierungen, Touch-Zielwahl, Dialog-Fokus, langen Übersetzungen und Terrain-Sets planen. Die unabhängige aktuelle QA-Etappe bleibt davon unberührt.
- **Getroffene Produktentscheidung:** „Fortsetzen“ erscheint erst mit verlässlich speicherbarem Spielstand; aktuell entfällt es. Die Touch-Zielgröße beträgt als Mindestentwurfswert 44 × 44 CSS px.
- **Offene Messwerte:** Mindestkartengröße und Schwelle für zweistufige Hex-Bestätigung werden durch PC-, Tablet- und Mobile-Geräteproben festgelegt. Vorher keine festen Pixelwerte als Abnahmegrenze setzen.

**Quellen im Projekt:** `README.md`, `RULE_MATRIX.md`, `TEST_HANDOFF.md`, `ARCHITECTURE_HANDOFF.md`, `index.html`, `src/app/reference.html` (Stand 30.09.2026). Der Entwurf beschreibt Zielverhalten; er behauptet keine bereits vorhandene Umsetzung der neuen Screens.
