# QA-08 – Unabhängige Prüfung der responsiven Produktshell

Stand: 30.09.2026 · Beads `goblin-2gj.6` · geprüfter UI-Checkpoint `f263dff` auf `codex/ui-checkpoint-2026-09-30` · **interner Spielpfad, keine Release-Freigabe**.

## Ergebnis

Die Produktshell ist auf den sieben emulierten Desktop-, Tablet- und Mobile-Profilen in DE/EN/ES/FR grundsätzlich bedienbar. Der unabhängige Browserlauf umfasst 41 Prüffälle: **38 bestanden, 3 fehlgeschlagen**. Drei Abweichungen sind als `goblin-tne`, `goblin-xej` und `goblin-ege` erfasst und an UX / UI sowie die Projektkoordination gemeldet. Die Node-Regression bestand **107/107**; der Locale-Validator bestätigt **165 gleiche Schlüssel und Platzhalter** in vier Sprachen. Eine Produktabnahme ist wegen der Befunde und der noch fehlenden realen Fingerproben offen.

Die Shell wurde unter `http://127.0.0.1:4173/src/app/shell.html?qa=1` mit dem vorhandenen lokalen BrowserAct-Chrome `goblin-local` unabhängig vom Developer-/Localization-Audit geprüft. Der nur bei `?qa=1` verfügbare Read-only-Probe lieferte GameState, ViewState, Areas, Aktionen und Command-Trace. Der Browserlauf ist als `qa-evidence/qa08-independent-audit.mjs` wiederholbar; sein vollständiges Soll/Ist liegt in `qa-evidence/qa08-independent-audit.json`. Während der QA lagen parallele uncommitted Natural-/Field-Atlas-Terrain-Dateien im Checkout; sie wurden weder verändert noch als Bestandteil des UI-Checkpoints bewertet.

## Geräte und Sprachen

| Profil | CSS-Viewport | Eingabe | DE/EN/ES/FR |
| --- | --- | --- | --- |
| PC | 1440×900 | Maus/Tastatur-Emulation | 4/4 bestanden |
| PC-small | 1280×720 | Maus/Tastatur-Emulation | 4/4 bestanden |
| Tablet quer | 1024×768 | Touch-Emulation | 4/4 bestanden |
| Tablet hoch | 768×1024 | Touch-Emulation | 4/4 bestanden |
| Mobile quer | 844×390 | Touch-Emulation | 4/4 mit gelieferten Texten bestanden |
| Mobile hoch | 390×844 | Touch-Emulation | 4/4 bestanden |
| Mobile-min | 320×568 | Touch-Emulation | 4/4 bestanden |

Alle 28 Kombinationen erreichten Start, Missionswahl, Briefing und Spiel. Mission/Zielzugang, Phase, Pause und Hauptaktion waren mit den gelieferten Texten sichtbar; keine Kombination erzeugte horizontalen Seiten-Overflow oder abgeschnittene essentielle Labels. Die gemessene Kartenhöhe bei 320×568 beträgt 197,44 CSS px, im 844×390-Querformat 268,41 CSS px. Die sieben Profilgrößen sind Prüfgrößen, keine bewiesenen Produkt-Breakpoints.

Screenshots: `qa-evidence/qa08-pc.png`, `qa08-tablet-portrait.png`, `qa08-mobile-portrait.png`, `qa08-mobile-landscape.png`, `qa08-mobile-min.png`. Der 2×-Langtextfall ist in `qa08-long-text-mobile-landscape.png` dokumentiert.

## Sieben UX-Kriterien: Soll/Ist

| Kriterium aus `UI_UX_LAYOUT_SYSTEM.md` / QA-07 | Soll | Ist und Beleg |
| --- | --- | --- |
| 1. Screen-Fluss | Start → Levelwahl → Briefing → Spiel; Pause/Einstellungen/Hilfe mit Rückweg, ohne Regelbefehl | **Bestanden.** N01 durchlief den Fluss auf Mobile hoch; Pause, Einstellungen und Hilfe kehrten zur Partie zurück. GameState blieb gleich, 0 Commands. Nur die zwei modularen Fixtures sind startbar. |
| 2. Responsives HUD | Ziel, Phase, Auswahl, Hauptaktion und Pause auf PC/Tablet/Mobile erreichbar | **Teilweise bestanden.** 28/28 Kombinationen mit gelieferten Texten bestanden. Bei testweise verdoppeltem FR-HUD-/Aktionslabel im 844×390-Querformat endet die Hauptaktion bei y=392,55 statt innerhalb von 390 CSS px (`goblin-tne`). Auf 320×568 bestand derselbe Langtextansatz. |
| 3. Touch-Aktionen | Erster Tap nur Auswahl/Vorschau, bestätigter Befehl genau einmal | **Bestanden im emulierten Umfang.** Mobile hoch: Unit-Tap und erster Ziel-Tap erzeugten 0 Commands und unveränderten GameState; bestätigter Move erzeugte genau 1 Command. Je 40 unbestätigte Taps auf Mobile hoch, Mobile quer und Tablet hoch erzeugten 0 Commands und keine Regeländerung. Strukturierte Core-Aktionsgründe und Phase-v2-Replay werden zusätzlich in der Node-Suite geprüft. |
| 4. Dialoge | Hintergrund gesperrt, Abbruch ohne Regeländerung, Fokus zurück; Phasenpräferenz beschränkt | **Bestanden in den geprüften Fällen.** Phasendialog blockierte Kartenpick, Abbruch erhielt `movement` und fokussierte `end-phase`. Sprache wechselte im offenen Dialog zu FR ohne Command oder Statewechsel. „Nicht erneut fragen“ beim Phasenwechsel unterdrückte den späteren Neustartdialog nicht; dessen Abbruch erhielt den Spielzustand. |
| 5. Karte/Terrain | Set, Grid, Pan und Zoom erhalten Regelzustand/Picking; Gesten lösen keine Commands aus | **Teilweise bestanden.** Hex/Verdant/Dryland, Grid, Button-Zoom und Ein-Finger-Pan hielten GameState/Areas unverändert und erzeugten 0 Commands; ein Ziel ließ sich danach bestätigen. Zwei-Finger-Pinch von 50 auf 150 CSS px änderte `mapZoom` nicht (1→1), sondern verschob `mapPan.x` auf −100 (`goblin-ege`). |
| 6. Sprache/Zugänglichkeit | DE/EN/ES/FR vollständig, lange Texte lesbar, interaktive Ziele benannt und fokussierbar | **Teilweise bestanden.** 28 Geräte-/Sprachkombinationen und der 165-Schlüssel-Validator bestanden. Die Karte als Ganzes hat ein lokalisiertes `aria-label`, aber einzelne interaktive Hex-Polygone und Unit-Gruppen besitzen weder `role`, `aria-label` noch `tabindex`; Kartenziele sind so per Tab/Screenreader nicht einzeln erreichbar (`goblin-xej`). Der 2×-Langtextfehler ist zusätzlich unter Kriterium 2 erfasst. |
| 7. Dichte Hexziele | Klare Vorwahl, keine unbeabsichtigten Commands, echte Fingerprobe zur Mindestgröße | **Teilnachweis.** 120 emulierte Unit-/Nachbarhex-Taps auf drei Touch-Profilen ergaben 0 Commands ohne Bestätigung. Die sichere Vorwahl und explizite Bestätigung sind vorhanden. Fehlerquote, Zielgröße und Mindestkartengröße auf echten Geräten sind mangels angeschlossener Tablet-/Mobile-Hardware nicht nachgewiesen. |

## Regression und getrennte Pfade

- `node --test tests/*.test.mjs`: **107 bestanden, 0 fehlgeschlagen**. Enthalten sind Core-/Phase-Replays, ViewState-/RNG-Invarianz, Dialog-/Regel- und Legacy-Tests. Die QA-08-Browserprobe selbst führte keinen vollständigen 16-Schritt-UI-Replay zweimal pro Terrain-Stil aus.
- `node assets/ui-copy/validate-locales.mjs`: **165 passende Schlüssel und Platzhalter** in DE/EN/ES/FR.
- Phase-v2 wurde in der Produktshell separat gestartet: spanischer Missions-/Phasentext, Kern `3/3`, 0 Commands beim Start. Core-, Phase- und Terrain-Vergleichseinstiege wurden separat im Browser geladen; die Terrain-Vorschau zeigte 96 Pick-Polygone und vier Units.
- Der Legacy-Vergleichspfad lud IRON DUST in FR mit 96 Hexen, sieben SVG-Units, Movement-Phase und Bestätigungsdialog. Abbruch erhielt die Phase; bestätigtes Weitergehen erreichte die nächste Phase. ATLAS / PROVING GROUNDS ließ sich laden und zeigte 96 Hexe, 18 eigene Einheiten und Movement. Dies ist ein Smoke, kein vollständiger Szenariosieg- oder Schussverlauf. Die Unit-Trial-Metadatenabweichung bleibt `goblin-eu2`.

## Befunde und Grenzen

| Issue | Reproduktion | Auswirkung |
| --- | --- | --- |
| `goblin-tne` | FR, 844×390, testweise 2× HUD-/Aktionslabels; Hauptaktion y=392,55 | Unterer Rand liegt 2,55 CSS px außerhalb des Viewports. |
| `goblin-xej` | Shell/Referenzpartie, SVG-Hex/Unit inspizieren oder mit Tab ansteuern | Interaktive Kartenobjekte haben keinen individuellen Tastaturfokus/Screenreader-Namen. |
| `goblin-ege` | Mobile hoch, Zwei-Finger-Pinch auseinanderziehen | Karte verschiebt sich um 100 CSS px statt zu zoomen; 0 Commands. |

BrowserAct-Touch-/Viewport-Emulation ersetzt keine echten Fingerproben, Sensor-/Safe-Area- oder Screenreader-Prüfungen auf Hardware. Für die Freigabe der Mindestkartengröße und der dichten Zielwahl aus H01 werden mindestens ein reales Tablet und ein reales Smartphone jeweils hoch/quer benötigt. Für C01–C04 fehlen in dieser QA kontrollierte Legacy-Siegcheckpoints; die bekannten Regeln und `goblin-eu2` bleiben getrennt vom modularen UI-Befund. Der neue UI-Pfad und die Terrain-Nebenarbeit wurden weder gepusht noch veröffentlicht.
