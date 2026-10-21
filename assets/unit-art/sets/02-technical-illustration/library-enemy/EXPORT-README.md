# Gegnerbilder Set 02: Kandidaten für die Unit Library

Stand: 21.10.2026 · Beads `goblin-nbg.4.3` · Quellstand `41b1700af94257cb14e3fe39a667a27ac11b53ef`

Dieser Ordner enthält für jede der 26 `assets/unit-art/manifest.json`-Kennungen genau ein `@768.png` (768×512, RGBA) und ein `@1024.webp` (1024×683, RGBA). Die Abmessungen entsprechen den vorhandenen eigenen Runtime-Library-Varianten in `tdc.game.ogre-release-integration/assets/unit-art/sets/02-technical-illustration/library/`; jene Dateien wurden nicht verändert. Die Gegnerbilder sind **Exportkandidaten**, noch keine Runtime-Integration oder Freigabe. Die Quellmaster liegen unverändert in `assets/unit-art/proposals/content-08/sets/02-technical-illustration/library-enemy/`.

## Wiederholen und prüfen

Vom Unit-Art-Checkout aus `python scripts/export-enemy-library.py` ausführen. Das Skript verlangt Pillow 12.3.0 mit libwebp 1.6.0 und liest die 26 IDs aus dem Unit-Art-Manifest. Der im Codex-Arbeitsbereich gebündelte Python-Interpreter erfüllt diese Versionen. `python scripts/export-enemy-library.py --check` prüft vorhandene Dateien, Prüfsummen/Größen und das deterministisch neu errechnete Manifest ohne Schreibzugriff. Alle SHA-256-Werte, Bytes, Dimensionen, Alpha-Bounds, Quellen und Encoderparameter stehen in `export-manifest.json`.

Der Export skaliert **die ganze transparente Leinwand** direkt vom 1536×1024-RGBA-Master mit Lanczos. Es gibt weder Bounding-Box-Crop noch Hintergrund, Overlay, Farbkorrektur oder Retusche. PNG nutzt Optimierung und Kompressionsstufe 9; WebP nutzt Qualität 88, Methode 6, verlustbehaftetes RGB und unverändertes Alpha (`exact=true`). PNG ist nach dem Dekodieren pixelgleich mit dem entsprechenden Master-Resize; bei allen 26 WebP-Dateien ist Alpha pixelgleich mit dem jeweiligen Resize. Mittlere RGB-Abweichung des WebP gegenüber diesem Resize über alle Pixel: durchschnittlich 0,88 von 255 pro Farbkanal, Maximum je Motiv 1,12 (`command-core`). Die Transparenz wurde auf dunklem Grund und Gras geprüft.

## Größe und Sichtkontrolle

| Gruppe | Komprimiert für alle 26 | Voll dekodiert als RGBA für alle 26 |
| --- | ---: | ---: |
| PNG | 7.688.680 Byte (7,33 MiB) | 40.894.464 Byte (39,00 MiB) |
| WebP | 2.360.372 Byte (2,25 MiB) | 72.736.768 Byte (69,37 MiB) |
| Beide Formate zusammen | 10.049.052 Byte (9,58 MiB) | 113.631.232 Byte (108,37 MiB) |

Die 26 Master umfassen 44.029.682 Byte und gehören nicht in den Runtime-Download. Für den Guide nur das aktuell benötigte Bild laden, WebP bevorzugen und PNG als Fallback verwenden; die Anzeige aller 26 voll dekodierten Bilder auf einmal wäre unnötig teuer. Ein WebP-Bild braucht allein für seine 1024×683-RGBA-Pixel rund 2,67 MiB; weitere Browser-Kopien sind darin nicht enthalten.

Sichtvergleich gegen Master und vorhandene eigene Runtime-Bilder auf dunklem und grasgrünem Grund: `design-exports/einheitengrafiken/pilot/ergebnisse/content-u4/review-special-dark.png` und `review-special-grass.png` in der gemeinsamen Projektwurzel. `phantom-platform`, `raider-skimmer` und `relay-node` bleiben kleiner, aber mit vollständig erhaltener Silhouette lesbar; `light-skimmer` behält am sichtbaren Motiv im 768-PNG mindestens 34 px Rand. Der `strategic-missile-carrier` behält beide geschlossenen Behälter, Ketten und Kabine. Die Fünfergruppe des `infantry-platoon` bleibt unterscheidbar. Alle 52 Derivate haben mindestens 33 px sichtbaren Rand im 768-PNG und 44 px im 1024-WebP (Messung mit Alpha ≥128; sehr schwaches Quell-Alpha wird im Bild erhalten). Unabhängiger Bildvergleich des Exportstands und Prüfung bei tatsächlicher Guide-Größe stehen noch aus.

**Herkunft:** Die vier Pilotmaster verweisen im Manifest auf `PROVENANCE.md`, die übrigen 22 auf `PROVENANCE-U3.md`; beide liegen bei den Mastern. Export und Manifest erzeugen keine neue Rechtefreigabe. Runtime-Einbau, Browserprüfung, Push und Release bleiben getrennte Aufträge.
