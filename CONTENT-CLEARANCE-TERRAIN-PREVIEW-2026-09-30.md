# Content Clearance – Terrain-Preview-Nachtrag

**Berichtsversion:** 1
**Stand:** 2026-09-30
**Bezugsstand:** interner GitHub-Pages-Previewkandidat mit vier Terrain-Stilen; kein Release
**Status:** Herkunft und lokale Pfade dokumentiert; formale Legal-Freigabe ausstehend.

Dieser Nachtrag ergänzt den historischen [Content-Clearance-Bericht zu Build 0.1.7](CONTENT-CLEARANCE.md), ohne dessen damaligen Befund zu ändern. Insbesondere galt die dortige Aussage zu fehlenden Rasterbildern für den älteren Spielauftritt. Der aktuelle Terrain-Previewkandidat enthält zwei lokal erzeugte PNG-Detailgrafiken. Die neuen Unit-Art-Konzepttafeln unter `tdc.game.ogre-unit-art/assets/unit-art/proposals/` gehören nicht zu diesem Previewkandidaten.

## Terrain-Inventar und Herkunft

| Stil | Boden-Detail | Wald-Detail | Herkunft |
| --- | --- | --- | --- |
| Verdant Atlas (`verdant`) | transparentes SVG | transparentes SVG | lokale Pfade, Farben und deterministische Punkte aus `assets/terrain-map-study/generate.mjs` im Unit-Art-Checkout |
| Dryland Survey (`dryland`) | transparentes SVG | transparentes SVG | derselbe lokale Generator und dieselbe VisualMap |
| Natural Terrain (`natural`) | transparentes RGBA-PNG | transparentes SVG | lokale Palette und deterministische Rastertextur aus `generate.mjs` und `natural-ground.mjs` |
| Field Atlas (`field-atlas`) | transparentes RGBA-PNG | transparentes SVG | lokale Palette, deterministische Rastertextur und zusätzliche Waldpunkte aus denselben Generatoren |

Alle vier Stile verwenden die 29 Features der einen `assets/terrain-map-study/portable/visual-map.json`. Die Generatoren importieren dafür nur projektlokalen Code und Node-Bordmittel. Die acht Detailgrafiken und vier StyleSet-JSONs sind im Hauptcheckout unter `assets/terrain-map-study/portable/` vorhanden. Für das Terrainpaket werden keine fremden Grafikdateien oder Netzwerk-Assets referenziert.

Field Atlas orientiert sich an der vom Nutzer beigefügten Hexkarte: helles Grasland, sandige Höhen, dunkler Wald, gelbe Felder und helle Wege. Die Referenzdatei liegt nicht im Terrainpaket. Formen und Texturen wurden mit projektlokalen Pfaden, Paletten und deterministischen Algorithmen erstellt; Referenzpixel wurden nicht als Asset übernommen. Diese technische Herkunftsdokumentation bewertet weder die Rechte an der Referenz noch die rechtliche Zulässigkeit einer ähnlichen Bildsprache.

## Geprüfte Laufzeitpfade

`src/app/terrain-assets.mjs` lädt Manifest, VisualMap und StyleSets relativ zu `assets/terrain-map-study/portable/`. `src/hex-renderer/renderer.mjs` löst die `detailAssets.path`-Werte relativ zum Renderer-Modul in die Hauptprojektwurzel auf. `src/hex-renderer/visual-map.mjs` erlaubt hierfür nur lokale `assets/`-Pfade zu SVG- oder PNG-Dateien ohne URL-Schema oder Pfadwechsel nach oben.

Am 30.09.2026 wurden die acht im Manifest referenzierten Detailpfade gegen Dateien im Hauptcheckout geprüft: Verdant, Dryland, Natural und Field Atlas besitzen jeweils `ground-grain` und `forest`; alle acht Dateien waren vorhanden. Der Paketvalidator bestätigte 29 Features und vier StyleSets. Diese statische Prüfung belegt nicht, dass im gesamten Preview zur Laufzeit keine weiteren externen Ressourcen geladen werden.

## Vor einem öffentlichen Preview offen

1. **Referenzbild:** Legal benötigt die vom Nutzer bereitgestellte Karte für eine eigenständige Prüfung von Herkunft, Nutzungsbefugnis und visueller Nähe. Sie ist nicht im Repository archiviert; die technische Feststellung, dass keine Pixel übernommen wurden, ersetzt diese Prüfung nicht.
2. **Namen und Spielkonzept:** Die im historischen Clearance-Bericht offenen Fragen zu `G.O.B.L.I.N.`, Einzelnamen, Regeln und Szenariostruktur bleiben offen. Dieser Nachtrag prüft sie nicht erneut.
3. **Gesamter Laufzeitbestand:** Development muss den konkreten GitHub-Pages-Previewstand einschließlich Netzwerkabrufen, übriger Einheiten- und UI-Assets, Schriften und Abhängigkeiten prüfen. Die obige Pfadprüfung deckt nur das Terrainpaket ab.
4. **Freigabe:** Weder dieser Nachtrag noch die [öffentlichen Herkunftshinweise](CONTENT-NOTICES.md) sind eine formale Legal-Freigabe. Eine solche Entscheidung ist weiterhin ausstehend.
