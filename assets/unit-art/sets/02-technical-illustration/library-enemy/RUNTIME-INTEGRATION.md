# Gegnerbilder in der V2-Bibliothek

Diese 26 PNG- und 26 WebP-Dateien stammen unverändert aus
`tdc.game.ogre-unit-art/assets/unit-art/exports/content-08/02-technical-illustration/library-enemy/`
am Unit-Art-Commit `8f0b88145ba1eb706081358504beb39bb117bfe2`.
Die SHA-256-Werte und Exportparameter stehen in `export-manifest.json`.
Der unabhängige Export-Prüfbericht liegt unter
`Transformation/operations/enemy-library-export-qa.md` in der Projektwurzel.

Die Runtime lädt im Bibliotheksdetail nur das gewählte Bild: WebP 1024,
bei fehlender WebP-Unterstützung PNG 768. Der Schalter Eigene/Gegner
betrifft ausschließlich die Illustration. Spielwerte und „Auf Karte finden“
werden weiterhin aus dem aktuellen Spielzustand ermittelt.

Quellmaster, Generator und Demodateien gehören nicht zu diesem Runtime-Satz.
Die Provenienz der Quellmaster liegt im Unit-Art-Checkout bei den dortigen
`PROVENANCE.md`- und `PROVENANCE-U3.md`-Dateien.
