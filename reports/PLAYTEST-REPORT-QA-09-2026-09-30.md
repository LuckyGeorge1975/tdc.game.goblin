# QA-09 – Unabhängige Nachprüfung der drei QA-08-Fixes

Stand: 30.09.2026 · Beads `goblin-2gj.8` · lokaler Fix-Commit `7fef083` auf `codex/ui-checkpoint-2026-09-30` · Vergleichsbaseline `5c3d871`. **Interner UI-Stand, keine Release-Freigabe.**

## Ergebnis

Die drei ursprünglichen QA-08-Reproduktionen bestehen auf dem Fix-Commit. Der unabhängige Retest umfasst **42/42 bestandene Browserfälle**; die unveränderten QA-08-Orakel allein bestanden **41/41** gegenüber **38/41** auf der Baseline. Die zusätzliche QA-09-Probe prüfte echte CDP-Tastaturereignisse für Enter und Space, sichere Vorwahl und genau einen bestätigten Core-Command. Die Node-Suite bestand **107/107**, der Locale-Validator bestätigte **170 gleiche Schlüssel und Platzhalter** in DE/EN/ES/FR. Keine neue Produktabweichung im geprüften Umfang gefunden.

Der Retest verwendet `qa-evidence/qa09-independent-retest.mjs` und `qa09-independent-audit.json`. Die QA-08-Dateien und der Bericht `PLAYTEST-REPORT-QA-08-2026-09-30.md` blieben unverändert. Im Hauptcheckout lagen während der Prüfung weiterhin parallele uncommitted Natural-/Field-Atlas-Terrain-Änderungen; sie sind kein Bestandteil von `7fef083` und wurden von QA nicht bearbeitet.

## Soll/Ist der drei Befunde

| Issue | Baseline `5c3d871` | QA-09 auf `7fef083` |
| --- | --- | --- |
| `goblin-tne` – 2× lange FR-Labels, 844×390 | Hauptaktion endete bei y=392,55 CSS px außerhalb des 390-px-Viewports. | **Bestanden.** Hauptaktion y=383,61; Pause und Zielknopf ebenfalls innerhalb der Breite/Höhe. Kein horizontaler Overflow oder abgeschnittenes essentielles Label. Bei 320×568 endet die Aktion bei y=435,20. Screenshot `qa-evidence/qa09-long-text-mobile-landscape.png`; zusätzlicher 320×568-Beleg vorhanden. |
| `goblin-xej` – SVG-Hex/Unit mit Tastatur und Screenreader | Einzelziele ohne `role`, `aria-label`, `tabindex`. | **Bestanden.** Hex und Unit tragen `role=button`, `tabindex=0` und semantische Namen; die Namen wurden für DE/EN/ES/FR geprüft. Fokus ist sichtbar und bleibt beim Renderer-Neuaufbau erhalten. CDP-Enter wählt `p-1`, CDP-Space merkt Move auf Hex (2,4) vor: jeweils 0 Commands und gleicher GameState. Explizite Bestätigung erzeugt genau 1 Move. VisualMap-Ziele behalten Namen/Picking. |
| `goblin-ege` – Zwei-Finger-Pinch | Pinch 50→150 CSS px änderte Zoom nicht (1→1), sondern verschob die Karte um x=−100. | **Bestanden.** Dieselbe CDP-Geste ändert Zoom 1→2,5 bei Pan `{x:0,y:0}`; GameState und Commandzahl bleiben unverändert. Ein anschließender Tap bei weiter gezoomter Karte traf die sichtbare leere Hexzelle (6,4), ohne Core-Command. Ein-Finger-Pan, Button-Zoom und spätere Touch-Zielwahl bestanden ebenfalls. |

## Geräte-, Sprach- und Sicherheitsregression

Die Shell erreichte Start, Levelwahl, Briefing und Spiel in **7 Viewportprofilen × 4 Sprachen**: PC 1440×900/1280×720, Tablet quer 1024×768/hoch 768×1024, Mobile quer 844×390/hoch 390×844 und Mobile-min 320×568. Mit den gelieferten Texten blieben Zielzugang, Phase, Pause und Hauptaktion sichtbar; kein horizontaler Seiten-Overflow oder abgeschnittenes essentielles Label. Die Mobile- und Tablet-Proben verwendeten Chrome-Touch-Emulation. Screenshots liegen als `qa-evidence/qa09-pc.png`, `qa09-tablet-portrait.png`, `qa09-mobile-portrait.png`, `qa09-mobile-landscape.png` und `qa09-mobile-min.png` vor.

Weitere eigene Browserproben: 40 unbestätigte Unit-/Nachbarhex-Taps je Mobile hoch, Mobile quer und Tablet hoch erzeugten 0 Commands; ein bestätigter Move erzeugte 1 Command. Terrain Hex/Verdant/Dryland, Grid, Zoom und Pan hielten GameState/Areas und sichere Vorwahl stabil. Phasendialog blockierte Kartenpick; Abbruch erhielt Phase und Fokus, Sprachwechsel im Dialog erhielt State. Die Phasenpräferenz unterdrückte den separaten Neustartdialog nicht. Der getrennte Phase-v2-Fixture-Start zeigte den spanischen Kernfortschritt `3/3` bei 0 Start-Commands.

Die Core-/Phase-Vergleichspfade luden als eigene HTML-Karten mit Einheiten und Phasensteuerung; sie verwenden im Normalpfad keine SVG-Polygone. Der Legacy-Vergleichspfad lud IRON DUST in FR mit 96 Hexen, sieben sichtbaren Units und Movement-Phase. `node --test tests/*.test.mjs` bestand 107/107 einschließlich Core-/Replay-/Legacy-Regression. Der von Developer angelegte gezielte Browser-Regressionslauf `tests/qa08-fix-browser-regression.mjs` bestand ergänzend und meldete dieselben drei Fix-Ergebnisse; er war nicht das alleinige QA-Orakel.

## Grenze und Übergabe

Echte Tablet-/Smartphone-Fingerproben sowie Hardware-Screenreader wurden nicht ausgeführt; sie bleiben als `goblin-wtg` offen. Die Browser-Suite ersetzt keine Messung von Fingerfehlwahl, Safe Areas und realer Pinch-Gestik. QA-09 bewertet den lokalen Fix-Commit und die geprüften Regressionen, nicht eine Veröffentlichung oder vollständige Migration aller Legacy-Szenarien. Kein Push oder Release durch QA.
