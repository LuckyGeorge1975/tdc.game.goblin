# G.O.B.L.I.N. · austauschbare Grafiksets

## Sechs im Spiel wählbare Sets

Die Combobox schaltet Karten- und Listenicons sowie die zugehörige Ansicht im Unit Guide gemeinsam um. Anfänglich ist `02-technical-illustration` gewählt; eine spätere Wahl bleibt lokal im Browser gespeichert. Alle sechs Sets enthalten für jede der 26 Einheiten ein transparentes `icons/{unit}.svg` mit 256 × 256. Die fünf grafischen Sets zeigen im Guide die Content-08-Einzelansichten als `library/{unit}@1024.webp` mit 1024 × 683 Pixeln und transparentem `@768.png`-Fallback mit 768 × 512 Pixeln. Das `<picture>`-Element lässt den Browser nur das unterstützte Format laden. Die 1536 × 1024-RGBA-Master liegen im getrennten Unit-Art-Quellcheckout, nicht im Pages-Checkout. Das militärische Set nutzt eine separate `library/{unit}.svg` mit 1024 × 768; Icon und Guide zeigen dasselbe Symbolmotiv. Der Guide zeigt das Bild vollständig mit `object-fit: contain` und ohne sechseckigen Beschnitt. Mini-Map, General-Texte und die kleinen Karten-/Listenicons bleiben eigenständig.

| Set | Stil | Quelle im Unit-Art-Checkout |
| --- | --- | --- |
| `01-tabletop-miniatures` | Tabletop-Miniaturen | Icon: `content-06/sets/01-tabletop-miniatures/`; Guide: `content-08/sets/01-tabletop-miniatures/library/` |
| `02-technical-illustration` | Technische Illustration | Icon: `content-06/sets/02-technical-illustration/`; Guide: `content-08/sets/02-technical-illustration/library/` |
| `03-industrial-realism` | Industrieller Realismus | Icon: `content-06/sets/03-industrial-realism/`; Guide: `content-08/sets/03-industrial-realism/library/` |
| `04-pixel-strategy` | Pixel-Strategie | Icon: `content-06/sets/04-pixel-strategy/`; Guide: `content-08/sets/04-pixel-strategy/library/` |
| `05-cel-shaded-comic` | Cel-Shading / Comic | Icon: `content-06/sets/05-cel-shaded-comic/`; Guide: `content-08/sets/05-cel-shaded-comic/library/` |
| `06-military-symbols` | Militärische Kartensymbole | `content-07/icons/` und `content-07/library/` |

Die 130 Guide-Master-PNGs stammen aus `tdc.game.ogre-unit-art` Commit `10131dc16ede760f2338b6605e10675f0cd81d29`, weiterhin vorhanden auf Quellstand `36463eb3777ade16f63a4392ea80889564a346a7`, dort unter `assets/unit-art/proposals/content-08/sets/`. Der reproduzierbare Export in [export-guide-art.py](../../scripts/export-guide-art.py) erstellt aus ihnen 1024 × 683 WebP Q85 und optimierte 768 × 512-PNG-Fallbacks. `content-08/README.md` dokumentiert Prompts und Bildprüfung; `UNIT-ART-HANDOFF.md` beschreibt die Stilzuordnung. Die 312 Icon- und früheren Guide-SVGs stammen aus Quellcommit `4bc3c7ce8c7dc25cddff20024f4c4bfb9361779f`; die späteren Korrekturen aus `966b93a80cc384f58a3ae0347936a1762987281c`. Die früheren grafischen Guide-SVGs bleiben im Checkout als historische Assets, werden vom Spiel aber nicht geladen. Herkunft und Grenzen stehen in `PROVENANCE.md` des Quellcheckouts.

Alle sechs Laufzeit-Sets verwenden die zwölf vorhandenen Terrainmotive und das Logo von `01-modular-stealth-geometry` als dokumentierten Fallback. Die Geländeregeln bleiben in `terrain-rules.js`, unabhängig von den Motiven. Stabile Einheiten- und Pfadschlüssel stehen im [Manifest](manifest.json).

## Ältere Galerie-Sets und Generatoren

Die fünf früheren Sets `01-modular-stealth-geometry` bis `05-aerospace-ground-force` bleiben für [Stilvergleich](comparison.html), [Einheitengalerie](gallery.html), [Terrain-Galerie](terrain-gallery.html) und [ATLAS-Levelvorschau](level-preview.html) erhalten. Sie sind im Manifest unter `legacyStyles` aufgeführt und erscheinen nicht in der Spiel-Combobox. Die zuvor integrierten Einzelkopien unter `sets/06-technical-illustration/` bleiben als lokale historische Assets erhalten, werden aber vom Spiel nicht mehr gewählt. Der frühere, bytegleiche Alias `library/military-symbols/` wurde entfernt; die aktiven Military-Guide-Dateien liegen weiterhin unter `sets/06-military-symbols/library/`.

`build-art.mjs` regeneriert ausschließlich die fünf älteren Galerie-Sets und bewahrt im Manifest die sechs Laufzeit-Sets. Danach ergänzt `build-terrain.mjs` die zwölf Terrainmotive für die älteren Paletten. Laufzeit-SVGs und Content-08-PNGs werden im Unit-Art-Quellcheckout gepflegt und hier nicht von `build-art.mjs` überschrieben.
