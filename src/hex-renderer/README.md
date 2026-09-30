# Hex-Renderer v1

`createHexRenderer({ svg, onPick })` liefert `{ render }`. `svg` ist ein
SVG-Element; `render({ state, view, areas, events })` bekommt ausschließlich
öffentliche Core-/View-Daten. `onPick` erhält `{ type: 'hex', cell: {x,y} }`
oder `{ type: 'unit', unitId, cell: {x,y} }`. Der Renderer ruft `dispatch`
niemals selbst und enthält keine Bewegungs-, Sicht- oder Kampfregel.

`view` kann `focusedCell`, `selectedUnitId`, `areaMode` (`movement`, `fire`,
`sight`/`los`) und `gridVisible` enthalten. `areas` ist die direkte Ausgabe
von `queryAreas`. `events` wird nur als sichtbarer Effekt des aktuellen
Renderdurchgangs verwendet; sein Ende verändert den GameState nicht.

Die feste SVG-Ebenenfolge lautet: Gelände → Grid → Areas → Wracks → Einheiten →
Fokusmarker → Effekte. Grid, Areas, Fokus und Effekte sind für Pointer-Events
durchlässig. Eine Einheit fängt ihren Klick selbst ab, sonst meldet die
Gelände-Hexfläche den Klick. Wracks bleiben unter aktiven Einheiten sichtbar.
Styles sind zunächst bewusst einfache lokale Vektoren; austauschbare Unit-Art
kann später über einen visuellen Adapter eingeführt werden, ohne Core-Daten zu
ändern.

## Weltgeometrie v1 (CE-05)

`render({ state, view, areas, events, visualMap, styleSet, viewport? })` akzeptiert
eine versionierte `VisualMap` und ein optionales `StyleSet`. Ohne `visualMap`
bleibt die v1-Ebenenfolge mit Hex-Terrainfüllung und Radius 30/Ursprung (45,45)
bestehen. `styleSet` und `viewport` benötigen eine `visualMap`. Eine `VisualMap`
ändert weder Core-Zustand noch RNG oder Terrainregeln.

`visual-map.mjs` exportiert `validateVisualMap`, `validateStyleSet`,
`validateViewport` und `visibleFeatures`. `VisualMap` benötigt
`schemaVersion: 1`, `mapId`, positive globale `bounds`, `hexLayout` mit
`pointy-top`/`odd-row`, positivem `radius` und `origin`, ganzzahligen
`detailSeed` sowie `features`. Jedes Feature besitzt eine eindeutige ID,
`kind`, `layer`, `zOrder`, globale `bounds` und entweder
`geometry: { type: 'polygon', points: [{x,y}, ...] }` oder
`geometry: { type: 'path', d, fillRule? }`. Polygone sind einfache geschlossene
Ringe; Löcher benötigen einen Path mit `fillRule: 'evenodd'`. Zulässige
Feature-Layer sind `ground`, `ground-grain`, `elevation`, `forest`, `water`,
`routes`, `objects`. Feature-Bounds dürfen über die Karte hinausragen, müssen
sie aber schneiden und die gesamte bemalte Geometrie einschließlich Strich
umschließen. Bei Paths kann der Validator diese letzte Eigenschaft nicht aus
`d` berechnen; der Content-Export muss sie gewährleisten.

`StyleSet` hat `{ schemaVersion: 1, setId, name, mapId, tokens: { layers, kinds } }`.
Ein Kind-Token überschreibt den Layer-Token. Unterstützte Paint-Felder sind
`fill`, `stroke`, `strokeWidth` und `opacity`; fehlende Werte fallen auf
neutrale Farben zurück. Das optionale `detail` wird als Material-Metadatum
validiert, erzeugt in CE-05 aber keine prozeduralen Texturpunkte. So bleiben
Formen und Materialkoordinaten global und unabhängig vom Viewport.

Für offline erzeugte transparente SVG-Details darf ein StyleSet zusätzlich
`detailAssets: { 'ground-grain'?: { path, bounds }, forest?: { path, bounds } }`
enthalten. `path` ist relativ zur **Hauptprojektwurzel** und beginnt mit
`assets/`; erlaubt sind lokale `.svg`-Pfade mit `/`, ohne Schema, führenden
Slash, `..`, Query oder Fragment. Der Renderer löst sie relativ zu seiner
Modul-URL auf. `bounds` stehen in globalen Weltkoordinaten. Die Bilder werden
in `groundTexture` beziehungsweise `forest` als nicht klickbare SVG-`image`
eingefügt und mit demselben globalen ClipPath beschnitten. Eine Änderung des
Viewports erzeugt keine neue Detailgeometrie.

Die VisualMap-Ebenenfolge lautet `ground → groundTexture → elevation → forest →
water → routes → objects → picking → grid → areas → wrecks → units → focus →
effects`. `ground-grain` wird in `groundTexture` gezeichnet. Ein nicht sichtbares
SVG-`defs`-Element enthält den ClipPath vor den Zeichenebenen. Terrain und
dekorative Ebenen haben keine Pointer-Events; die transparenten Hexflächen in
`picking` melden Hexklicks, Einheiten darüber behalten Vorrang. Ohne
`view.gridVisible` zeichnet der VisualMap-Pfad keine Hexkanten.

Ein optionaler `viewport` ist ein Rechteck in **globalen** Weltkoordinaten.
Features werden anhand ihrer globalen Bounds ausgewählt und am Schnitt von
Viewport und Karten-Bounds geclippt. Pfade und Polygonpunkte werden dabei nicht
verschoben oder neu generiert. Benachbarte Viewports verwenden somit dieselben
Feature-IDs und dieselbe Geometrie. Grid, Areas, Units, Fokus und Effekte
verwenden denselben `hexLayout`-Transform. `visualLayerOrder` enthält die
Zeichenebenenfolge; `layerOrder` bleibt die v1-Fallbackfolge.
