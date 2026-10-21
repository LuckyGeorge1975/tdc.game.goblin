# Einheitengrafiken

**Dokumentversion:** 7

Die Spieloberfläche verwendet ausschließlich `02-technical-illustration`. Der Renderer in `unit-visuals.js` und `src/legacy/scripts/unit-visuals.js` ordnet stabile Einheiten-IDs und Szenarioaliasse den vorhandenen Motiven zu. Ein anderes Set lässt sich weder über die Oberfläche noch über `UnitVisuals.setStyle` aktivieren. Eine früher lokal gespeicherte Auswahl wird beim Start auf Set 02 normalisiert.

Karte, Einheitenliste, Auswahl, Bibliotheksliste und Missionsvorschau verwenden die transparenten `assets/unit-art/sets/02-technical-illustration/icons/{unit}.png` mit 256 × 256 Pixeln. Die große Ansicht im Unit Guide lädt `library/{unit}@1024.webp` (1024 × 683 Pixel) mit transparentem `@768.png`-Fallback (768 × 512 Pixel). Der Browser lädt nur das unterstützte Format. Das [Manifest](../assets/unit-art/manifest.json) enthält die 26 stabilen Einheitenschlüssel.

Team-, Ziel- und Auswahlmarker bleiben getrennte UI-Ebenen; die Motivdateien werden nicht für die Teamkennung verändert. Spielregeln und Szenariodaten ändern sich durch die feste Bildzuordnung nicht.

Die zwölf derzeitigen Terrainansichten stammen weiterhin aus `sets/01-modular-stealth-geometry/terrain/`. `UnitVisuals.terrainAssetFor(type)` liefert diesen Fallback bis zur gesonderten Integration des neuen Kartenpakets. Die Terrainregeln stehen unabhängig davon in `src/legacy/scripts/terrain-rules.js`.

Frühere Setdateien, Galerien, Quellen- und Testbelege bleiben im Repository. Ihre Herkunft und Formate sind in [assets/unit-art/README.md](../assets/unit-art/README.md) dokumentiert; die nachgelagerte Bereinigung wird getrennt entschieden.
