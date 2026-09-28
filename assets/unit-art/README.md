# G.O.B.L.I.N. · austauschbare Grafiksets

Fünf eigenständige, vollständige Stilrichtungen für den aktuellen Unit Guide und die Szenarioeinheiten. Alle Motive sind eigens gezeichnete SVG-Vektorgrafiken ohne Fremdmaterial. Die Spielmechanik und das bestehende UI werden durch dieses Content-Paket nicht verändert.

## Anschauen

- [Stilvergleich](comparison.html): fünf Logos und repräsentative Einheiten nebeneinander.
- [Vollständige Galerie](gallery.html): alle 26 Motive in jedem Stil, jeweils Draufsicht und Schrägansicht.
- [Manifest](manifest.json): stabile Asset-Schlüssel und Pfadmuster für die spätere Integration.
- [Terrain-Galerie](terrain-gallery.html): zwölf Hexfeldmotive in allen fünf Stilen.
- [ATLAS-Levelvorschau](level-preview.html): alle Terrain- und Einheitentypen auf einer Karte.

## Umfang

Pro Stil gibt es 26 transparente, skizzenhafte SVG-Icons in orthografischer Draufsicht (`256 × 256`), 26 transparente SVG-Illustrationen in schräger Dreiviertelansicht (`512 × 384`) und ein transparentes G.O.B.L.I.N.-Logo (`1024 × 256`). Das sind **53 Dateien je Stil, 265 SVG-Dateien insgesamt**. Die 26 Motive enthalten auch Infanterie, stationäre Einheiten und Szenarioziele, damit alle sichtbaren Einträge konsistent bebildert werden können.

Zusätzlich enthält jeder Stil 12 Terrain-Icons für Hexfelder (`256 × 256`): offenes Gelände, Trümmerfeld, Berg, Höhenrücken, Wald, Sumpf, Wasser, Fluss, Straße, Brücke, Stadtgebiet und Krater. Damit umfasst das Paket **325 SVG-Dateien**. Ein statisches Showcase-Level namens **ATLAS / PROVING GROUNDS** verwendet alle 12 Terrainmotive und alle 26 Einheitentypen auf einem 12 × 8-Hexraster.

Wichtig: ATLAS ist seit Build 0.1.11 als spielbares Content-Showcase auswählbar. Ab Build 0.1.12 gelten für alle zwölf Geländemotive eigene Bewegungs-, Deckungs- und Sichtregeln laut [Regelmatrix](../../RULE_MATRIX.md). Die Spezialwerte vieler Einheiten und das Missionsziel bleiben vorläufig; [Level-JSON](levels/atlas-proving-grounds.json) und Vorschau sind die Content-Quelle.

| Stil-ID | Gestaltung |
| --- | --- |
| `01-modular-stealth-geometry` | Dunkle, modulare Tarngeometrie mit Limette/Cyan |
| `02-industrial-exoframe` | Sichtbarer Exorahmen, Schienen und Orange |
| `03-monolithic-facet` | Monolithische Facetten und Korallakzente |
| `04-autonomous-drone-corps` | Helle, technische Drohnenoptik mit Sensorblau |
| `05-aerospace-ground-force` | Geradlinige Luftfahrtformen, Elfenbein und Signalrot |

## Austauschvertrag für den Developer

Die Dateinamen sind in allen fünf Stilordnern identisch. Beim Stilwechsel muss nur `{style}` ersetzt werden:

```text
sets/{style}/icons/{unit}.svg
sets/{style}/library/{unit}.svg
sets/{style}/terrain/{terrain}.svg
sets/{style}/logo.svg
```

Beispiel: `sets/03-monolithic-facet/icons/assault-tank.svg` und `sets/03-monolithic-facet/library/assault-tank.svg`. Das vollständige Vokabular steht im Manifest. Die SVGs besitzen transparente Hintergründe, `viewBox`, semantische Titel und keine externen Abhängigkeiten.

## Content-Workflow

Zuerst `node assets/unit-art/build-art.mjs`, danach `node assets/unit-art/build-terrain.mjs` ausführen. Diese Reihenfolge generiert alle Sets, das vollständige Manifest und die Vorschauen reproduzierbar. Die Generatoren dienen nur der Asset-Produktion; das Spiel lädt sie nicht. Die früheren PNGs unter `studies/` sind Konzeptstudien und nicht Teil der vollständigen Sets.
