# Content Clearance – Terrain-Preview-Nachtrag

**Berichtsversion:** 2
**Stand:** 2026-10-01
**Bezugsstand:** lokaler GitHub-Pages-Previewkandidat Build 0.1.13 mit vier Terrain-Stilen; kein Release
**Status:** Herkunft, Nutzerangaben und Legal-Risikoeinschätzung für eine nichtkommerzielle Vorschau dokumentiert; keine verbindliche Rechtsfreigabe.

Dieser Nachtrag ergänzt den historischen [Content-Clearance-Bericht zu Build 0.1.7](CONTENT-CLEARANCE.md), ohne dessen damaligen Befund zu ändern. Insbesondere galt die dortige Aussage zu fehlenden Rasterbildern für den älteren Spielauftritt. Der aktuelle Terrain-Previewkandidat enthält zwei lokal erzeugte PNG-Detailgrafiken. Die neuen Unit-Art-Konzepttafeln unter `tdc.game.ogre-unit-art/assets/unit-art/proposals/` gehören nicht zu diesem Previewkandidaten.

## Terrain-Inventar und Herkunft

| Stil | Boden-Detail | Wald-Detail | Herkunft |
| --- | --- | --- | --- |
| Verdant Atlas (`verdant`) | transparentes SVG | transparentes SVG | lokale Pfade, Farben und deterministische Punkte aus `assets/terrain-map-study/generate.mjs` im Unit-Art-Checkout |
| Dryland Survey (`dryland`) | transparentes SVG | transparentes SVG | derselbe lokale Generator und dieselbe VisualMap |
| Natural Terrain (`natural`) | transparentes RGBA-PNG | transparentes SVG | lokale Palette und deterministische Rastertextur aus `generate.mjs` und `natural-ground.mjs` |
| Field Atlas (`field-atlas`) | transparentes RGBA-PNG | transparentes SVG | lokale Palette, deterministische Rastertextur und zusätzliche Waldpunkte aus denselben Generatoren |

Alle vier Stile verwenden die 29 Features der einen `assets/terrain-map-study/portable/visual-map.json`. Die Generatoren importieren dafür nur projektlokalen Code und Node-Bordmittel. Die acht Detailgrafiken und vier StyleSet-JSONs sind im Hauptcheckout unter `assets/terrain-map-study/portable/` vorhanden. Für das Terrainpaket werden keine fremden Grafikdateien oder Netzwerk-Assets referenziert.

Field Atlas orientiert sich an allgemeinen Motiven der vom Nutzer beigefügten Hexkarte: helles Grasland, sandige Höhen, dunkler Wald, gelbe Felder und helle Wege. Die Referenzdatei liegt nicht im Terrainpaket. Formen und Texturen wurden mit projektlokalen Pfaden, Paletten und deterministischen Algorithmen erstellt; Referenzpixel wurden nicht als Asset übernommen. Am 01.10.2026 erklärte der Nutzer nach einem direkten Vergleich, die generierte Grafik weise keine konkrete Ähnlichkeit mit der Referenz auf. Er bestätigte außerdem, dass seine Eingaben für die generierten Grafiken autorisiert waren und keine fremden Referenzbilder ohne Nutzungsrecht enthielten. Legal zog daraufhin den allein aus der fehlenden eigenen Vergleichsmöglichkeit abgeleiteten Field-Atlas-Blocker zurück und schätzte das Urheberrechtsrisiko für eine nichtkommerzielle Vorschau unter diesen Voraussetzungen als niedrig ein. Legal konnte den Bildvergleich nicht selbst nachvollziehen; dies ist eine Risikoeinschätzung, keine verbindliche anwaltliche Freigabe.

## Geprüfte Laufzeitpfade

`src/app/terrain-assets.mjs` lädt Manifest, VisualMap und StyleSets relativ zu `assets/terrain-map-study/portable/`. `src/hex-renderer/renderer.mjs` löst die `detailAssets.path`-Werte relativ zum Renderer-Modul in die Hauptprojektwurzel auf. `src/hex-renderer/visual-map.mjs` erlaubt hierfür nur lokale `assets/`-Pfade zu SVG- oder PNG-Dateien ohne URL-Schema oder Pfadwechsel nach oben.

Am 30.09.2026 wurden die acht im Manifest referenzierten Detailpfade gegen Dateien im Hauptcheckout geprüft: Verdant, Dryland, Natural und Field Atlas besitzen jeweils `ground-grain` und `forest`; alle acht Dateien waren vorhanden. Der Paketvalidator bestätigte 29 Features und vier StyleSets. Diese statische Prüfung belegt nicht, dass im gesamten Preview zur Laufzeit keine weiteren externen Ressourcen geladen werden.

## Grenzen und weitere Prüfungen

1. **Referenzbild:** Die Originalreferenz ist nicht im Repository archiviert. Der Nutzer hat den direkten Vergleich vorgenommen; Legal konnte seine Aussage nicht unabhängig anhand der beiden Bilder prüfen. Die Bewertung setzt voraus, dass keine konkreten Formen, Anordnungen oder sonstigen geschützten Gestaltungselemente übernommen wurden.
2. **Namen und Spielkonzept:** Für eine nichtkommerzielle technische Vorschau bewertet Legal die eigenständig formulierten funktionalen Regeln und die bereinigten sichtbaren Bezeichnungen als geringes Risiko. Eine aktuelle professionelle Markenprüfung für `G.O.B.L.I.N.` in Deutschland und der EU bleibt vor einer kommerziellen Veröffentlichung offen.
3. **Gesamter Laufzeitbestand:** Die unabhängige lokale Pages-Pfad-Prüfung in [PLAYTEST-REPORT-PAGES-PREVIEW-2026-09-30.md](PLAYTEST-REPORT-PAGES-PREVIEW-2026-09-30.md) erfasste 51 Anfragen unter dem Projektpfad ohne HTTP- oder JavaScript-Fehler. Sie ersetzt keinen Test des erst nach Freigabe veröffentlichten Builds und keine echte Geräteprobe.
4. **Freigabe:** Dieser Nachtrag und die [öffentlichen Herkunftshinweise](CONTENT-NOTICES.md) dokumentieren eine bedingte Legal-Risikoeinschätzung und die Nutzerangaben, aber keine verbindliche anwaltliche Freigabe oder Produktfreigabe.
