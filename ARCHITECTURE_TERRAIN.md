# Architekturvertrag: zusammenhängendes Terrain

Stand: 2026-09-30. Grundlage: Content-Studie `tdc.game.ogre-unit-art/assets/terrain-map-study` und Beads-Feature `goblin-qws`. Dieser Vertrag ergänzt den Hex-Renderer-Vertrag. Er ändert keine Spielregel und keinen veröffentlichten Build.

## Grenze zwischen Regeln und Bild

`GameState.map.terrain` enthält weiterhin die regelrelevanten Hex-Terrain-IDs. Nur diese Daten bestimmen Bewegungskosten, Deckung und Sicht. Eine neue `VisualMap` enthält ausschließlich darstellbare Weltgeometrie. Wald, Wasser, Höhen und Straßen dürfen visuell Hexgrenzen überschreiten. Ein Stilset ändert Farben und Materialdetails, niemals Terrain-IDs, Geometrie, Befehle oder RNG. `VisualMap` und Stilwahl gehören nicht zum deterministischen `GameState`; sie werden mit einer Szenario-/Karten-ID geladen und im ViewState gewählt.

Der bestehende Rendererpfad ohne `VisualMap` bleibt als Fallback erhalten, bis Szenarien einzeln migriert und getestet sind. Die Content-Studie in ihrem Neben-Checkout ist Referenz, keine Laufzeitabhängigkeit des Hauptprojekts. Zur Integration werden geprüfte, lokale Daten/Assets in den Hauptcheckout übernommen; keine absoluten Pfade auf einen anderen Checkout.

## Datenvertrag v1

Eine `VisualMap` ist serialisierbar und versioniert:

```js
{
  schemaVersion: 1,
  mapId: 'terrain-study-02',
  bounds: { x: 0, y: 0, width: 1440, height: 960 },
  hexLayout: {
    orientation: 'pointy-top', offset: 'odd-row', radius: 62,
    origin: { x: 0, y: 0 }
  },
  detailSeed: 91,
  features: [
    { id: 'river-main', kind: 'river', layer: 'water', zOrder: 10,
      bounds: { x: 0, y: 200, width: 930, height: 760 },
      geometry: { type: 'path', d: '...' } }
  ]
}
```

`id` ist innerhalb der Karte stabil und eindeutig. `kind` bezeichnet das Motiv (`forest`, `elevation`, `lake`, `river`, `road`, `bridge`, `object` usw.); `layer` bestimmt die fachliche Ebene, `zOrder` die Reihenfolge darin. Version 1 erlaubt `geometry: { type: 'polygon', points: [{x,y}, ...] }` als geschlossenen Ring ohne Löcher oder `geometry: { type: 'path', d, fillRule?: 'nonzero'|'evenodd' }` für zusammengesetzte Formen und Löcher. Polygonpunkte sind Koordinatenobjekte, keine `[x,y]`-Tupel. `bounds` müssen die vollständige bemalte Geometrie einschließlich Strichbreite/Materialausdehnung umschließen, damit Abschnittsauswahl keine Teile abschneidet. Features dürfen über die Karten-Bounds hinausragen, müssen sie aber schneiden; globale Geometrie wird erst beim Darstellen geclippt. Generatoren leiten zusätzliche Texturdetails aus `detailSeed`, Feature-ID und globalen Koordinaten ab; Chunk-Position und Renderreihenfolge dürfen das Ergebnis nicht ändern.

Die Hex-Zentren folgen dem vorhandenen odd-row-Raster: `cx = origin.x + sqrt(3) * radius * (x + (y mod 2)/2)`, `cy = origin.y + 1.5 * radius * y`. Renderer, Grid, Areas, Fokus, Units und Picking verwenden **denselben** `hexLayout`. Der bisherige Radius 30 mit Ursprung (45,45) ist der Fallback für Karten ohne `VisualMap`; die Content-Studie verwendet Radius 62. Diese Transformation ist eine Darstellungsgrenze und ändert keine Core-Koordinaten `{x,y}`.

Ein `StyleSet` ist ein separates lokales Manifest: `{ schemaVersion: 1, setId, name, mapId, tokens: { layers: {...}, kinds: {...} } }`. Der Anzeigename heißt verbindlich `name`. Layer- und Kind-Tokens dürfen `fill`, `stroke`, `strokeWidth`, `opacity` sowie optionale deterministische `detail`-Parameter enthalten. Kind-Tokens überschreiben Layer-Tokens; fehlende Werte verwenden definierte neutrale Defaults. Zulässige Feature-Layer sind exakt `ground`, `ground-grain`, `elevation`, `forest`, `water`, `routes`, `objects` in dieser Reihenfolge. Das `hex-grid` wird vom Renderer erzeugt und ist kein Feature-Layer. Das Manifest referenziert die `VisualMap` über `mapId`, enthält aber keine Features, Hex-Terrain-IDs oder Regelwerte. Für die erste Integration genügen `verdant` und `dryland` mit derselben `VisualMap`.

Für die erste integrierte Karte gehören auch die sichtbaren Waldkronen und das Bodenkorn der Studie zur Abnahme. Sie werden offline aus demselben globalen Seed und denselben Punktpositionen als transparente SVG-Detail-Ebenen erzeugt. `StyleSet.detailAssets` darf genau `ground-grain` und `forest` als Schlüssel enthalten; jeder Eintrag ist `{ path, bounds }`. `path` ist ein lokaler Pfad **relativ zur Hauptprojektwurzel**, zum Beispiel `assets/terrain-map-study/details/verdant-forest.svg`, ohne Schema, führenden Slash, `..`, Backslash, Query oder Fragment. Der Renderer löst ihn relativ zu seiner Modul-URL auf; die App übergibt keinen zusätzlichen Base-URL-Parameter. Beide Sets verwenden dieselben Detailpositionen und Radien, nur ihre Farben/Materialien wechseln. `bounds` und SVG-`viewBox` liegen in den globalen Weltkoordinaten der `VisualMap`; benachbarte Viewports zeigen Ausschnitte desselben Assets und erzeugen Details nicht neu. Der Wald-Detail-Asset ist bereits auf die kanonischen Waldformen begrenzt. Externe oder absolute Asset-URLs sind ungültig.

## Renderer und Abschnitte

Der Renderer erhält `render({ state, view, areas, events, visualMap, styleSet, viewport? })`. `visualMap` und `styleSet` können beim Laden validiert und anschließend wiederverwendet werden. Ohne `visualMap` zeichnet der bestehende Hex-Terrain-Fallback. Mit `visualMap` lautet die Reihenfolge: Grundfläche → Bodentextur → Höhe → Wald → Wasser → Wege/Brücken → Objekte → unsichtbare Hex-Picking-Flächen → optionales Hexraster → Areas → Wracks → Einheiten → Fokus → Effekte. Terrainformen und dekorative Ebenen fangen keine Pointer-Events ab; Einheiten behalten Vorrang vor Hex-Picking. Bei ausgeschaltetem Raster zeichnet der neue Terrainpfad keine Hexkanten.

Ein Pointer-Pick wird über die inverse SVG-Bildschirmtransformation in globale Weltkoordinaten zurückgerechnet und gegen die Hexpolygone im gemeinsamen `hexLayout` geprüft. Liegt der Punkt exakt auf einer gemeinsamen Hexkante oder -ecke, gewinnt deterministisch die Zelle mit der kleinsten Zeile (`y`), danach der kleinsten Spalte (`x`); unmittelbar beidseits gilt die jeweils getroffene Zelle. Die geometrische Kreuzprodukt-Toleranz ist `radius² × 10⁻⁹`. Die Regel gilt unabhängig von DOM-Zeichenfolge, Stil, Viewport, Pan und Zoom. Einheitsmarker melden weiterhin genau einen Unit-Pick vor der darunterliegenden Hexfläche; dekorative Overlays melden keinen Pick. Tastaturaktivierung eines fokussierten Hexes wählt dieses Hex direkt.

Für einen sichtbaren Abschnitt werden Features über ihre **globalen** Bounds ausgewählt und an der Viewport-Grenze geclippt. Benachbarte Abschnitte rendern dieselben Feature-IDs, Pfade, Seeds und global verankerten Materialkoordinaten; sie erzeugen keine eigene lokale Variante der Form. Die erste Integration darf die ganze endliche Karte als ein SVG zeichnen. Ein Test mit zwei benachbarten Viewports muss bereits zeigen, dass Auswahl und Clippen an der gemeinsamen Grenze keine Lücke oder Sprungstelle erzeugen. Ein unendlicher Karten- oder Streaming-Dienst ist nicht Teil dieses Schnitts.

## Umsetzung und Abnahme

- **Content** liefert aus der Studie eine kanonische, lokale `VisualMap` mit stabilen Feature-IDs, Bounds, zwei StyleSet-Manifests und je Set die zwei global ausgerichteten Detail-SVGs. Das bisherige `manifest.json` ist eine visuelle Studie und noch kein Laufzeitmanifest.
- **Core / Engine** erweitert nur `src/hex-renderer/**` und die zugehörigen Tests um Layout-Transform, Terrain-Sublayer, Picking und optionales Viewport-Clipping. Keine Regelberechnung im Renderer.
- **Developer** lädt/validiert die lokalen Assets im Vergleichspfad und bietet einen ViewState-Stilwechsel. Der Wechsel darf `GameState`, RNG, Auswahl, Aktionsbudget und Replay-Trace nicht ändern. Bestehende `core-v1`, `phase-v2` und Legacy-Einstiege bleiben erreichbar.
- **Tester** prüft eine Karte mit Straße und Fluss über jeweils mindestens drei Hexe samt Brücke sowie mehrzellige Wald-, See- und Höhenflächen. Die Waldkronen und das Bodenkorn der Studie müssen in beiden Sets sichtbar bleiben. Mit ausgeschaltetem Raster dürfen an Hex- und Abschnittsgrenzen keine sichtbaren Nähte bleiben. Beim Wechsel `verdant ↔ dryland` bleiben Feature-Geometrie und Detailpositionen, Hex-Picking und alle Regelwerte gleich. Renderer- und Browser-Regressionen decken die bisherigen modularen Pfade ab; Legacy wird getrennt als Smoke geprüft.

Dieses Terrain-Feature startet nach der Abnahme des zweiten modularen Spielschnitts. Die Legacy-Overlay-Korrektur `goblin-x4z` ist getrennt und darf die Terrain-Daten nicht verändern.
