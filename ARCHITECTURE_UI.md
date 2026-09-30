# Architekturvertrag: responsives Spiel-UI

Stand: 30.09.2026. Grundlage: `UI_UX_LAYOUT_SYSTEM.md`, `ARCHITECTURE_SLICE_2.md`, `ARCHITECTURE_TERRAIN.md` und Beads `goblin-2gj`. Dieser Vertrag beschreibt die nächste lokale UI-Etappe. Er ändert keine Spielregel und erteilt keine Release-Freigabe.

## Umfang und Reihenfolge

Die erste Integration nutzt den modularen Pfad (`src/app`, `src/core`, `src/hex-renderer`) und dessen vorhandene Core-v1-/phase-v2-Fixtures. Der Legacy-Pfad bleibt ein getrennter Vergleich und erhält in dieser Etappe nur gemeinsam nutzbare Darstellung, falls das ohne Regelumbau möglich ist. Legacy-spezifische Aktionen wie Transport, Spezialwaffen, AUTO und vollständige Szenariowechsel dürfen im modularen Pfad erst erscheinen, wenn der Core sie unterstützt. Ein UI darf keine nicht vorhandene Spielaktion vortäuschen.

Die Umsetzung erfolgt in überprüfbaren Schritten: (1) Zustands- und Lokalisierungsvertrag, (2) Screen-Routing und responsive Spielbausteine, (3) Kartenbedienung und Dialoge, (4) unabhängige Geräte-, Sprach- und Regressionprüfung. Ein Startbildschirm zeigt aktuell **kein** „Fortsetzen“, weil persistierte Spielstände nicht zum unterstützten Core-Vertrag gehören. Die spätere Speicherfunktion ist eine eigene Entscheidung und Aufgabe.

Die vorhandenen `reference.html`-/`compare.html`-Einstiege und das `phase-v2`-Browser-Harness bleiben als Regressionsorakel erreichbar. Der neue Screen-Fluss kann in einer eigenen Produktshell beginnen; er darf die feste Fixture nicht stillschweigend durch neue Bestätigungs-Taps verändern. Änderungen am Adapter werden entweder über einen klaren neuen Eingabemodus gesteuert oder mit angepasstem, weiterhin deterministischem Harness belegt.

## Zustandsgrenzen

`GameState` enthält nur Regeln und deterministische Spieldaten. `dispatch` ist die einzige Quelle für Änderungen daran; `queryAreas` und zusätzliche Core-Queries liefern zulässige Ziele und bei Bedarf Gründe für gesperrte Aktionen. Die UI leitet keine Bewegungskosten, Feuerreichweiten, Sichtlinien, Friendly-Fire-Folgen oder Phasenregeln selbst her. `src/app/presentation.mjs` darf Core-Daten nur in anzeigbare Zustände und Lokalisierungsparameter projizieren.

CE-06 stellt dafür `queryActions(state, unitId?)` mit `units` und `endPhase` sowie `queryCommand(state, command)` für eine konkrete Absicht bereit; der genaue Vertrag und die stabilen Sperrcodes stehen in `src/core/CONTRACT.md`. `queryCommand` und `dispatch` teilen dieselbe Preflight-Validierung. `endPhase.pendingUnitIds` ist eine sortierte Information für den Dialog, kein Verbot; `endPhase.next` beschreibt den echten Folgeübergang. Die App erweitert bei Bedarf ihren Core-Wrapper um diese Exporte und übersetzt erst an der Anzeigegrenze die Codes in Texte.

Der UI-`ViewState` enthält Screen/Route, geöffnetes Sheet oder Dialog, Auswahl/Fokus, Karten-Pan/Zoom, Overlay-Modus, Terrain-Set, Raster und eine noch nicht bestätigte Kartenabsicht. Diese Felder sind nicht Bestandteil des deterministischen `GameState` oder Replay-Traces. Bei Stil-, Raster-, Pan-, Zoom- und Sprachwechsel bleiben Core-State, RNG, Eventzahl, Auswahl und fokussiertes Hex erhalten; ein nicht mehr sinnvoller offener Bestätigungsdialog wird ausdrücklich geschlossen und begründet. Ein Core-Command wird erst durch eine eindeutige Bestätigung ausgelöst und danach genau einmal verarbeitet.

Der aktuelle `adapter.clickCell` löst auf einem legalen Bewegungsziel beziehungsweise Gegnerziel unmittelbar `Move` oder `Fire` aus. Für die neue Touch-Bedienung wird Eingabe in **Zielwahl** und **Befehlsbestätigung** getrennt. Ein erster Tap/Klick auf ein Hex fokussiert oder zeigt eine gültige Absicht; ein markiertes Ziel wird erst über eine bewusst erkennbare Aktion ausgeführt. Die genaue Bestätigung für dicht belegte Hexe und die Mindestkartengröße werden durch Geräteproben festgelegt. Pan-Gesten lösen weder einen Pick noch einen Core-Command aus. Modal geöffnete Dialoge sperren alle Kartenbefehle und Tastaturkürzel; Fokus kehrt nach Schließen zum Auslöser zurück.

## Screens, Anzeige und Accessibility

Die Route umfasst Start, Levelwahl, Briefing, Spiel, Pause, Einstellungen, Hilfe und Missionsende gemäß `UI_UX_LAYOUT_SYSTEM.md`. Für noch nicht unterstützte Missionen oder Aktionen gibt es keinen aktiven Einstieg. Der Spielscreen zeigt Karte, Ziel/Fortschritt, Phase/Zug, Auswahlstatus, verfügbaren nächsten Schritt oder Sperrgrund und Pause dauerhaft. Einheitenliste, Feld-/Einheiten-Intel und Log liegen auf PC in Panels und auf schmalen Ansichten in erreichbaren Sheets. Ein offenes Sheet darf die Karte nicht unbemerkt zum Befehlsziel machen. Die Aktionsleiste bleibt über Safe Areas und bei Browser-Zoom erreichbar. Es gelten sichtbare Fokuszustände, semantische Namen und das Entwurfsminimum von 44 × 44 CSS px für Touch-Ziele; die Hexgrafik kann kleiner sein, wenn die Eingabefläche verlässlich ist.

Ein Dialog hat Titel, konkrete Konsequenz, sichere Standardaktion, Abbruch und klar bezeichnete Bestätigung. Phasenende nennt ausstehende Aktionen; Neustart oder Szenariowechsel benennt den Verlust der laufenden Partie. „Nicht erneut fragen“ gilt ausschließlich für den Phasenwechsel. Gefährliche Spezialbefehle brauchen Ziel- und Wirkbereichsanzeige, sobald ihr Core-Vertrag existiert. Normale Intel ist nicht modal.

## Terrain und Lokalisierung

Der Renderer bleibt darstellend und erhält dieselben Weltkoordinaten-/Picking-Daten aus `ARCHITECTURE_TERRAIN.md`. Terrain-Set, Raster, Overlay und Viewport verändern weder Feature-Geometrie noch Hex-/Unit-Picks oder Regeln. Karten-Pan/Zoom müssen die Umrechnung von Zeigerposition zu Weltpunkt konsistent halten; Auswahl und Fokus bleiben nachvollziehbar. Der Fallback ohne `VisualMap` bleibt testbar.

Neue Screen-, Dialog- und Aktionslabels verwenden stabile semantische Schlüssel mit Parametern für Phase, Anzahl, Einheit und Ziel. Regel-, Szenario-, Terrain-, Unit- und Error-Codes bleiben stabile Daten und werden erst an der Anzeigegrenze lokalisiert. Der laufende `localization.js`-Katalog für Bestandsoberflächen kann als Brücke bestehen, auch wenn er derzeit exakte Quelltexte als Schlüssel benutzt. Die neue UI darf keine übersetzten Texte parsen oder für Regeln vergleichen. Deutsch, Englisch, Spanisch und Französisch müssen zur Laufzeit umschaltbar sein; der Wechsel erhält Auswahl und Kontext. Layouts brechen lange Texte um und schneiden Hauptaktionen, Ziele oder Dialogoptionen nicht ab. Content liefert die kurzen Missions- und Dialogformulierungen; Localization verantwortet Übersetzungen und Darstellung.

## Zuständigkeiten und Gates

- **Core / Engine:** Prüft, ob bestehender State, `queryAreas` und strukturierte `dispatch`-Fehler für Aktionsbereitschaft und konkrete Sperrgründe genügen. Fehlende regelbezogene Abfragen werden als reine, deterministische Query vereinbart und getestet; keine DOM- oder Sprachlogik im Core.
- **Developer:** Baut Screen-Routing, responsive Bausteine, ViewState-Absichten, Dialogsperre und Fokusführung im modularen Pfad. Integriert Terrain und i18n über ihre Verträge. Legacy bleibt separat erreichbar; übergreifende Änderungen brauchen eigene Regression.
- **UX / UI, Content und Localization:** Liefern Layout-/Textgrenzen, kurze Missions- und Dialogtexte sowie DE/EN/ES/FR-Schlüssel. Offene Gerätewerte werden aus Messungen abgeleitet.
- **Tester:** Plant zuerst eine Matrix für PC, Tablet hoch/quer und Mobile hoch/quer, Maus/Tastatur/Touch, alle vier Sprachen, lange Labels, Dialog-Fokus, dichte Hexziele und beide Terrain-Sets. Prüft danach unabhängig und führt Core-v1-/phase-v2-Replay sowie getrennte Legacy-Smokes aus.
- **Architekt:** Nimmt die lokale UI-Etappe erst nach unabhängiger QA und Abgleich mit den sieben Kriterien aus `UI_UX_LAYOUT_SYSTEM.md` ab. Produktive Terrain-Kartenmigration bleibt zusätzlich durch `goblin-zcz` abgesichert.

Offene Messwerte sind Mindestkartengröße und die Schwelle zur zweistufigen Zielbestätigung. Ohne Geräteproben sind keine festen Pixelwerte dafür verbindlich.
