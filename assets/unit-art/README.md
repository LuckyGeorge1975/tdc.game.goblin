# G.O.B.L.I.N. · austauschbare Grafiksets

## Sechs im Spiel wählbare Sets

Die Combobox schaltet Karten- und Listenicons sowie die zugehörige Ansicht im Unit Guide gemeinsam um. Anfänglich ist `02-technical-illustration` gewählt; eine spätere Wahl bleibt lokal im Browser gespeichert. Jedes Set enthält für alle 26 Einheiten ein transparentes `icons/{unit}.svg` mit 256 × 256 und ein getrenntes `library/{unit}.svg` mit 1024 × 768. Die fünf grafischen Sets zeigen im Guide eigenständige räumliche Dreiviertelzeichnungen mit sichtbaren Seitenflächen; die Karte und alle Listen zeigen weiter die kleinen Draufsicht-Icons. Das militärische Set zeigt in beiden Ansichten dasselbe Symbolmotiv, speichert die kleine und große Fassung aber getrennt. Der Guide zeigt die Ansicht vollständig mit `object-fit: contain` und ohne sechseckigen Beschnitt. Die lokalen Guide-Korrekturen stammen aus dem Unit-Art-Quellcommit `966b93a80cc384f58a3ae0347936a1762987281c` und sind noch kein neuer veröffentlichter Build.

| Set | Stil | Quelle im Unit-Art-Checkout |
| --- | --- | --- |
| `01-tabletop-miniatures` | Tabletop-Miniaturen | `content-06/sets/01-tabletop-miniatures/` |
| `02-technical-illustration` | Technische Illustration | `content-06/sets/02-technical-illustration/` |
| `03-industrial-realism` | Industrieller Realismus | `content-06/sets/03-industrial-realism/` |
| `04-pixel-strategy` | Pixel-Strategie | `content-06/sets/04-pixel-strategy/` |
| `05-cel-shaded-comic` | Cel-Shading / Comic | `content-06/sets/05-cel-shaded-comic/` |
| `06-military-symbols` | Militärische Kartensymbole | `content-07/icons/` und `content-07/library/` |

Alle 312 SVGs stammen aus `tdc.game.ogre-unit-art` Commit `4bc3c7ce8c7dc25cddff20024f4c4bfb9361779f`, dort unter `assets/unit-art/proposals/`. `UNIT-ART-HANDOFF.md` und `PROVENANCE.md` im Quellcheckout beschreiben die Paarung sowie Eingabe- und Herkunftsgrenzen. Das Spiel lädt nur die SVGs, keine Proposal-PNGs.

Alle sechs Laufzeit-Sets verwenden die zwölf vorhandenen Terrainmotive und das Logo von `01-modular-stealth-geometry` als dokumentierten Fallback. Die Geländeregeln bleiben in `terrain-rules.js`, unabhängig von den Motiven. Stabile Einheiten- und Pfadschlüssel stehen im [Manifest](manifest.json).

## Ältere Galerie-Sets und Generatoren

Die fünf früheren Sets `01-modular-stealth-geometry` bis `05-aerospace-ground-force` bleiben für [Stilvergleich](comparison.html), [Einheitengalerie](gallery.html), [Terrain-Galerie](terrain-gallery.html) und [ATLAS-Levelvorschau](level-preview.html) erhalten. Sie sind im Manifest unter `legacyStyles` aufgeführt und erscheinen nicht in der Spiel-Combobox. Die zuvor integrierten Einzelkopien unter `sets/06-technical-illustration/` und `library/military-symbols/` bleiben als lokale historische Assets erhalten, werden aber vom Spiel nicht mehr gewählt.

`build-art.mjs` regeneriert ausschließlich die fünf älteren Galerie-Sets und bewahrt im Manifest die sechs Laufzeit-Sets. Danach ergänzt `build-terrain.mjs` die zwölf Terrainmotive für die älteren Paletten. Die 312 Laufzeit-SVGs werden aus den Generatoren im Unit-Art-Quellcheckout gepflegt und hier nicht von `build-art.mjs` überschrieben.
