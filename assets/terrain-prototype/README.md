# ASHLAND / Terrain Study 01

Eine **einzige** neue Hex-Terrain-Richtung zur visuellen Freigabe. Die bisherigen fünf Terrain-Sets bleiben unverändert; dieses Paket ist noch nicht ins Spiel integriert.

## Vorschauen

- [Karte mit Einheiten](map.html) · [PNG](map-preview.png)
- [Karte ohne Einheiten](map-terrain-only.html) · [PNG](map-terrain-only-preview.png)
- [Set-Übersicht](set.html) · [PNG](set-preview.png)
- [Kartendaten](map.json) und [Asset-Manifest](manifest.json)

## Designprinzip

Die Grundfläche ist eine **einzige, kontinuierlich kartierte Textur** (`ashland-ground.png`). Terrain-Details sind transparente Hex-Overlays; sie zeichnen keine Hexkante und schneiden nicht an den Feldrändern ab. Größere, weich verlaufende Farbzonen werden aus benachbarten Terrain-Feldern unter den Details zusammengesetzt. Das schafft eine zusammenhängende Landschaft statt einer Sammlung sichtbarer Einzelplättchen. Die Karte zeigt das Hexraster absichtlich nicht; das Spiel kann es als separate, dezente UI-Ebene einblenden.

Straße und Fluss sind **getrennte Netzwerke** auf transparenten Overlays. Für jedes gibt es alle 64 möglichen sechsseitigen Anschlussmasken. Anschlussstellen liegen exakt in den Mittelpunkten der sechs Kanten; die Port-Koordinaten benachbarter Hexe werden beim Generieren geprüft. Zwei-Kanten-Verbindungen sind als glatte Kurve konstruiert. Eine Brücke wird als eigene Ebene über der Kreuzung gezeichnet. Für eine neue Karte wird eine Maske aus den sechs tatsächlichen Nachbarn gebildet – die Icons für `road` oder `river` werden nie blind auf einzelne Zellen verteilt.

Einheitensymbole sitzen auf dunklen, deckenden Token mit kräftiger grüner beziehungsweise korallfarbener Kontur. Das visuelle Gewicht der Landschaft ist geringer als das der Tokens. Die Karte zeigt nur acht Einheiten, um den Kontrast auf Wald, Straße, Fels und Sumpf prüfen zu können.

## Inhalt und Anschlussvertrag

- 9 Grundgelände × 3 Detailvarianten = 27 transparente SVGs
- 64 Straßen- und 64 Flussmasken = 128 transparente SVGs
- 1 Brückendeck-Overlay
- 1 originelle, KI-generierte Luftbild-Grundtextur

Die SVGs nutzen `viewBox="0 0 256 256"` und ein spitzes Hex mit Radius 128. Die Hex-Mittelpunkte stehen horizontal `√3 × Radius` und vertikal `1,5 × Radius` auseinander; ungerade Reihen sind um die halbe horizontale Distanz versetzt. Kantenreihenfolge und Bitpositionen: `NE, E, SE, SW, W, NW`. Beispiel: Maske `18` verbindet E und W. Ebenenreihenfolge: kontinuierliche Grundtextur → Farbzone → Grundgelände-Details → Fluss → Straße → Brücke → Einheiten.

Die Grundtextur wird in der Demo **einmal über die gesamte Karte** gelegt, nicht als ungeprüft wiederholte Bitmap pro Hex. Für größere Karten sollte der Developer eine kontinuierliche Weltkoordinaten-Textur oder eine nachweislich periodische Textur verwenden. Das nahtlose Verhalten der Netzwerke beruht dagegen auf den exakt definierten Kantenports und funktioniert unabhängig von der Kartengröße.

Generator: `node assets/terrain-prototype/generate.mjs`. Er schreibt Assets, Beispielkarte und Manifest und prüft Netzwerk-Nachbarschaft sowie geometrisch übereinstimmende Kantenports. Er wird nicht vom Spiel geladen. Gelände- und Bewegungsregeln werden hier nicht verändert.

## Referenzen und Herkunft

Die folgenden Projekte dienten ausschließlich zur Recherche des Schicht- und Anschlussprinzips; ihre Grafiken wurden **nicht** übernommen:

- [Hexfall](https://godboyhappy.itch.io/hexfall-hex-strategy-map-tileset): getrennte Grund-, Küsten-, Straßen- und Fluss-Ebenen; sechsseitige Masken.
- [Mythic Hex Tiles](https://stevencolling.itch.io/mythic-hex-tiles): Verbindungsvarianten für Wege und Flüsse bis zu Abzweigungen.
- [Hex Map / WFC](https://felixturner.github.io/hex-map-wfc/article/): exakt passende Kantenmerkmale bei Hex-Karten.

Die Luftbild-Grundtextur wurde für dieses Projekt mit dem eingebauten ImageGen-Werkzeug erzeugt. Prompt: „Seamless repeatable aerial ground texture of a dry ashland plain for a top-down hex strategy map; subdued sage gray, weathered olive and muted taupe; fine soil grain and sparse scrub; uniform, low-contrast, no focal objects, roads, rivers, buildings, trees, hex outlines, text, logos or watermarks.“ Die präzise Anschlussgeometrie und alle Terrain-Overlays sind eigens entwickelte SVGs.
