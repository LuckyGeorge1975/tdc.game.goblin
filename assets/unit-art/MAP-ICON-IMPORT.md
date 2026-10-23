# Kartenicons K-8

Die aktive Karte nutzt 26 Paare schattenloser Draufsicht-Icons. `unit.team` wählt `own` für `player` und `enemy` für `enemy`; unbekannte Teams behalten die Vektordarstellung. Die großen Librarybilder und die alten Icon-Dateien bleiben getrennt und erhalten. Es gibt keinen Stilwähler.

## Quelle und Export

- Fest verwendeter Content-Commit: `c01ecb80bcdd813772d1433d9ae63b39e54ef050`, Pfad `design-exports/einheitengrafiken/icons-ohne-schatten/`.
- Am 23.10.2026 wurde `main` als `2fdce6ac1be30e8b2a360250b37724586469e71c` geprüft. Alle 52 Quell-Blob-IDs sind nach dem neuen Präfix `beratung-ui-ux/` bytegleich. Der Pin wurde nicht gewechselt.
- Der externe `bereitstellen.py` wurde gelesen: Er kopiert das gesamte Paket, enthält keinen Browserstart, skaliert oder komprimiert aber nicht und schreibt keine Datei-Hashmatrix. Der enge Projekt-Export `scripts/export-map-icons.py` liest nur das per `tools/content-source.ps1 -Action Export` aus dem festen Commit erzeugte ZIP. Er prüft Archivhash, 26 IDs und 52 Paare, PNG/RGBA/Alpha und schreibt 192 × 192 lossless WebP sowie [map-icons-source.json](map-icons-source.json) mit Quell- und Zielhash je Datei. Generatoren mit eigenem Edge-Profil wurden nicht ausgeführt.
- Das ZIP im lokalen Quellen-Cache hatte SHA-256 `03a0db66d235d5e1e7fe94c7f2a9e5c95da4aa092fbe7944f00911460be48e4c`. Der Exportaufruf lautet, nach dem Quellen-Export, `python scripts/export-map-icons.py --archive <ZIP-Pfad> --archive-sha256 <ZIP-SHA256> --source-sha c01ecb80bcdd813772d1433d9ae63b39e54ef050`. Er benötigt Pillow. ZIP und private Originale werden nicht ins Spiel eingebunden.

## Budget und Prüfgrenze

52 Quell-PNGs: **1.889.554 Byte**. 52 WebP-Ableitungen: **691.364 Byte**. Die sieben unterschiedlichen Icons der anfänglichen Iron-Dust-Mission umfassen zusammen **91.498 Byte**; weitere Szenarien laden ihre benötigten Motive erst beim Anzeigen. Der reine RGBA-Puffer beträgt rechnerisch 147.456 Byte je 192er-Bild, rund 1,03 MB für sieben beziehungsweise 7,67 MB für alle 52. Browser-Cache, tatsächliche Netzwerkrequests und Gerätespeicher müssen unabhängig gemessen werden.

Alle 52 Ableitungen dekodierten mit Alpha. Ein Pixelvergleich nach demselben Lanczos-Resize auf dunklem Grün ergab keinen Unterschied zur lossless-WebP-Fassung; der größte Mittelpunktversatz der Alpha-Grenzen betrug 1 Pixel. Ein farbiges und ein Graustufen-Kontaktblatt liegen als lokale Diagnose unter `.tools/diagnose-nbg-18/`. Diese Sichtung ersetzt keine unabhängige Core-/Legacy-/Mobile-Abnahme am Produkt. Insbesondere die Trennung kleiner Einheiten und gegnerischer Konturen in Graustufen bleibt zu prüfen.
