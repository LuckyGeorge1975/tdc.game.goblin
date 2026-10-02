# Pages-Projektpfad – unabhängige lokale QA

Stand: 30.09.2026 · Beads `goblin-ib3.3` · Hauptcheckout `codex/ui-checkpoint-2026-09-30`, HEAD `42efa87` · lokaler statischer Preview unter `http://127.0.0.1:4174/tdc.game.goblin/src/app/shell.html`. **Kein öffentlicher Deploy und keine Release-Freigabe.**

## Ergebnis

Die modulare Shell lädt und spielt unter dem simulierten GitHub-Pages-Projektpfad. Der eigene BrowserAct/CDP-Audit `qa-evidence/pages-prefix-independent-audit.mjs` bestand **18/18** Fällen. Er beobachtete **51 lokale Requests**; alle lagen unter `/tdc.game.goblin/`. Es gab **0 HTTP-Fehler ab 400, 0 Ladefehler und 0 JavaScript-Ausnahmen**. Das vollständige Protokoll liegt in `qa-evidence/pages-prefix-independent-audit.json`. Das Developer-Skript `tests/pages-prefix-browser-smoke.mjs` diente nur als Referenz für den lokalen Serveraufbau und wurde nicht als QA-Orakel übernommen.

| Probe | Soll | Ist |
| --- | --- | --- |
| Start/Briefing/Spiel | Statischer Einstieg und alle drei Screens im Projektpfad | **8/8 Kombinationen bestanden:** DE/EN/ES/FR auf Desktop 1440×900 und emuliertem Mobile 390×844. Mission/Phase, Pause und Hauptaktion sichtbar, kein horizontaler Überlauf. Beide modularen Fixtures bleiben intern. |
| Vier Terrain-Stile | Verdant, Dryland, Natural und Field Atlas mit gleicher Karte und lokal geladenen Details | **8/8 Stilproben bestanden:** jeder Stil auf Desktop und emuliertem Mobile. Je 29 stabile Features, 96 Pickflächen, zwei globale Detailbilder. Alle 16 Detailasset-Abfragen lieferten HTTP 200 mit Bild-MIME und Inhalt. Style-Wechsel hielten GameState, `queryAreas` und Commandzahl unverändert. |
| Sichere Kartenaktion | Erster Tap nur Vorwahl; Bestätigung genau ein Befehl | **Bestanden** auf emuliertem Mobile mit Field Atlas: `p-1` und Zielhex (2,4) vorgemerkt bei 0 Commands und gleichem GameState; Bestätigung erzeugte genau einen `Move` und veränderte den State. |
| Prefix/Fehler | Keine Anfrage außerhalb `/tdc.game.goblin/`, keine 404 oder JS-Fehler | **Bestanden:** 51 beobachtete Requests, 0 außerhalb des Prefix, 0 HTTP-/Lade-/JS-Fehler. Normaler FR-Einstieg ohne `?qa=1` lud ebenfalls Start → Briefing → Spiel und Natural mit 29 Features, 96 Picks und zwei Details; dabei existierte kein globaler QA-Probe. |

Screenshots: `qa-evidence/pages-prefix-verdant.png`, `pages-prefix-dryland.png`, `pages-prefix-natural.png`, `pages-prefix-field-atlas.png` und `pages-prefix-mobile-command.png`. Natural und Field Atlas wurden visuell auf sichtbare, unterschiedliche Detailtexturen geprüft.

Zusätzliche lokale Regression auf HEAD `42efa87`: `node --test tests/*.test.mjs` **114/114**; Locale-Validator **170 gleiche Schlüssel und Platzhalter** in vier Sprachen; VisualMap-Validator **29 Features, 15 Kinds, 7 Layer und vier Sets**. Beim Test war der Hauptcheckout bis auf lokale `.codex/`- und `.playwright-mcp/`-Verzeichnisse ohne offene Codeänderungen.

## Grenzen

Der Preview wurde von `tests/pages-prefix-server.mjs` lokal aus dem Checkout serviert. Er beweist das Verhalten unter demselben URL-Prefix, nicht die Erreichbarkeit oder Konfiguration einer veröffentlichten GitHub-Pages-Instanz. Echte Tablet-/Smartphone-Fingerproben und Hardware-Screenreader bleiben `goblin-wtg`. Es wurden keine Release-Metadaten geändert, Dateien gepusht oder veröffentlicht.
