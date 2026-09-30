# CONTENT-01 · Portable VisualMap v1

Dieses Verzeichnis ist das kopierbare Content-Paket zur Terrain-Studie. Es folgt `ARCHITECTURE_TERRAIN.md` im Hauptcheckout und enthält **keine** Spielregeln, Core- oder App-Dateien. Die angeschlossene Studie mit SVG- und PNG-Vorschauen liegt eine Ebene höher.

## Dateien und Pfade

- `manifest.json` nennt `visual-map.json` und die beiden Stilpfade `styles/verdant.json`, `styles/dryland.json` **relativ zu diesem Verzeichnis**.
- `visual-map.json` enthält `schemaVersion: 1`, `mapId`, globale Karten-Bounds, das pointy-top/odd-row-Hexlayout, `detailSeed` und die kanonischen Features. Jedes Feature hat eine stabile `id`, `kind`, `layer`, `zOrder`, globale `bounds` und eine `geometry` als SVG-Path oder Polygon mit `{x,y}`-Punkten.
- Jedes StyleSet hat `schemaVersion`, `setId`, `name`, `mapId` und `tokens.layers`/`tokens.kinds`. Die Stilsets enthalten keine Feature-Geometrie oder regelrelevanten Hexdaten. `kind`-Tokens überschreiben entsprechende `layer`-Werte; fehlende Paint-Werte erhalten neutrale Renderer-Defaults.
- `detailAssets` jedes Sets nennt die transparenten SVGs für `ground-grain` und `forest` mit globalen Bounds. Die SVGs liegen in `details/`; ihre `path`-Werte sind **relativ zur Wurzel des Hauptprojekts**. Vorgesehenes Integrationsziel für das gesamte Paket ist `tdc.game.ogre/assets/terrain-map-study/portable/`. Dort stimmen Pfade wie `assets/terrain-map-study/portable/details/verdant-forest.svg` ohne Umschreiben. Der Hauptprojekt-Renderer muss keine Datei aus dem Unit-Art-Checkout laden.

Die VisualMap-Feature-Layer sind `ground`, `ground-grain`, `elevation`, `forest`, `water`, `routes`, `objects`. Das Hexraster und die unsichtbaren Picking-Flächen entstehen im Renderer aus `hexLayout` und stehen nicht als Features in der VisualMap. Die Karte hat Ursprung `(0,0)`, Radius `62`, Bounds `1440 × 960`. Ufer, Fluss und Wege überschreiten teilweise den Kartenrand; ihre Feature-Bounds umfassen die bemalte Ausdehnung. Beim Zeichnen wird nur am Karten- oder Viewport-Rand geclippt.

## Herkunft und visuelle Grenze

Die Pfade und Paletten stammen aus dem projektlokalen, eigens gezeichneten `terrain-map-study/generate.mjs`. Das vom Nutzer beigefügte Kartenbild war eine visuelle Referenz; seine Grafik wurde nicht übernommen. Beide Stilsets verweisen auf dieselbe `visual-map.json`. Der Generator kann das Paket mit `node assets/terrain-map-study/generate.mjs` neu schreiben.

Die SVG-Vorschauen verwenden für Waldbewuchs und Bodenkorn tausende deterministische Punkte. Dieselben globalen Positionen, Radien und Wald-Clips liegen nun in den transparenten `detailAssets` beider Sets; nur die Farben wechseln. Das `detail`-Feld in den Tokens bleibt optionale Metainformation und erfordert keinen Laufzeit-Zufallsgenerator. Der Renderer zeichnet die Offline-Assets als global ausgerichtete SVG-Bilder in `ground-grain` bzw. `forest` und clippt sie am Viewport.

## Prüfung

1. Im Unit-Art-Checkout `node assets/terrain-map-study/generate.mjs` ausführen und danach `node assets/terrain-map-study/portable/validate.mjs`. Der Validator prüft eindeutige IDs, vollständige Feature-Felder, Layer, Geometrietypen, Polygon-Bounds, die erforderlichen Motive, Set-Pfade und Stil-Token-Abdeckung. Er prüft zudem lokale SVG-Detailpfade, globale Bounds, Wald-Clips und identische Punktpositionen/Radien in beiden Sets.
2. `visual-map.json` prüfen: `road-west-east` und `road-north-connector` bilden das Straßennetz über mehrere Hexe; `river-main` verläuft vom linken Rand über den See nach Süden; `bridge-main` liegt am Straßenübergang über dem Fluss. `forest-*`, `lake-central` und `elevation-*` belegen jeweils mehrere Hexe.
3. Die Vorschauen `../verdant-preview.png` und `../dryland-preview.png` nebeneinander öffnen. Straße, Fluss, Brücke, Wald, See, Höhe und Gebäude müssen in beiden Bildern dieselbe Lage/Form haben. Nur Farbe und Material wechseln.
4. Bei Integration zwei angrenzende Viewports gegen dieselbe `visual-map.json` rendern und an der gemeinsamen Grenze vergleichen. Features anhand globaler Bounds wählen und ihre globale Geometrie nur clippen. Mit abgeschaltetem Grid dürfen an Hex- und Viewport-Grenzen keine Nähte erscheinen; Hex-Picking und Regelwerte müssen beim Setwechsel gleich bleiben.
