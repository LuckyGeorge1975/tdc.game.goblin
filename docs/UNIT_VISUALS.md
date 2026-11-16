# Einheitengrafiken

**Dokumentversion:** 7

Die Spieloberfläche verwendet fest `02-technical-illustration`. Der Renderer in `unit-visuals.js` ordnet stabile Einheiten-IDs und Szenarioaliasse den Motiven zu. Die Zuordnung kommt aus der Laufzeit.

Karte, Einheitenliste, Auswahl und Missionsvorschau verwenden die Seitenableitungen unter `assets/unit-art/sets/02-technical-illustration/map-icons/`. Die große Ansicht im Unit Guide lädt `library/{unit}@1024.webp` (1024 × 683 Pixel) mit transparentem `@768.png`-Fallback (768 × 512 Pixel). Das [Manifest](../assets/unit-art/manifest.json) enthält die 26 stabilen Einheitenschlüssel.

Team-, Ziel- und Auswahlmarker bleiben getrennte UI-Ebenen; die Motivdateien werden nicht für die Teamkennung verändert. Spielregeln und Szenariodaten ändern sich durch die feste Bildzuordnung nicht.

Für die Kartentexturen lädt die Präsentation das Terrainpaket unter `assets/terrain-tiles/`. `UnitVisuals.terrainAssetFor(type)` bietet die Motive unter `sets/01-modular-stealth-geometry/terrain/` weiterhin als Fallback an. Die Terrainmechanik wird über `terrain-rules.js` und im modularen Pfad über `rules.mjs` geladen.

Herkunft, Formate und Generatoren der vorhandenen Sets sind im [Unit-Art-Handoff](../assets/unit-art/README.md) dokumentiert.
