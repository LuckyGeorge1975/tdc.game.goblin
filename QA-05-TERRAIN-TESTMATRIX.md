# QA-05 – Unabhängige Terrain-Testmatrix

Stand: 2026-09-30 · Status: **Testplanung, keine Abnahme der laufenden Integration** · Beads `goblin-qws.5`. Grundlage: `ARCHITECTURE_TERRAIN.md`, `goblin-qws` und die Content-Studie `tdc.game.ogre-unit-art/assets/terrain-map-study` (nur Lesereferenz). QA-06 beginnt erst nach CONTENT-01, CE-05 und DEV-07.

## Verbindliche Daten und Orakel

Die für QA-06 verbindliche Karte ist die von CONTENT-01 lokal exportierte `VisualMap` im Hauptcheckout, **nicht** das `manifest.json` der Studie. Der Export muss `schemaVersion: 1`, stabile eindeutige Feature-IDs, globale Feature-Bounds, Weltpfade/-polygone, `layer`, `zOrder`, `detailSeed`, `hexLayout` und `mapId` liefern. `verdant` und `dryland` sind separate StyleSets mit demselben `VisualMap`-Objekt und ohne Regel- oder Feature-Geometrie. Im Testprotokoll werden Dateipfade, Versionsfelder, Feature-IDs und ein Hash/kanonischer Vergleich der Geometriefelder fixiert.

Die Studie zeigt eine 1440×960-Welt mit Pointy-Top-/Odd-Row-Hexen, Radius 62, Fluss, See, Straße, Brücke bei ungefähr **(896,576)** sowie zusammenhängenden Wald- und Höhenflächen. Das inzwischen im Unit-Art-Checkout gelieferte `portable/`-Paket nennt `terrain-study-02`, `road-west-east`, `road-north-connector`, `river-main`, `bridge-main`, `lake-central`, `forest-*` und `elevation-*` als kanonische IDs. Die Detail-Assets sind global ausgerichtete transparente SVGs pro Set. Für QA-06 gilt die geprüfte Kopie im Hauptcheckout; das Neben-Checkout bleibt Lesereferenz. Regel-Orakel bleiben `GameState.map.terrain`, `dispatch` und `queryAreas`; `VisualMap`/StyleSet sind nicht Teil des GameState.

Für beide Stile und Grid-Zustände werden dieselben festen Core-Zustände und Seeds verwendet: `core-v1/reference-v1` mit `REFERENCE_SEED=0x0b11a1` und `core-v2/phase-v2` mit `PHASE_SEED=5`. Vor/nach Stilwechsel, Grid-Schalten, Viewport-Wechsel, Fokus und Picking werden vollständiger serialisierbarer GameState samt RNG, Aktionsflags und Replay-Trace verglichen. Nur ein ausdrücklich ausgelöster Core-Befehl darf sie ändern.

## Daten- und Geometrieprüfung

| ID | Eingabe / Nachweis | Sollwert |
| --- | --- | --- |
| T-D01 | Kanonische `VisualMap` und beide StyleSets laden/serialisieren | Schema 1; `mapId`, `detailSeed`, `bounds`, `hexLayout` und jedes Feature (`id`, `kind`, `layer`, `zOrder`, `bounds`, Pfad/Polygon) vorhanden und rein serialisierbar. IDs eindeutig und über beide Stile stabil. Keine absoluten Checkout-Pfade im Laufzeitpaket. |
| T-D02 | Für jedes Feature Geometrie gegen globale `bounds` prüfen, Strich-/Materialausdehnung einbeziehen | Vollständige sichtbare Ausdehnung liegt innerhalb der Bounds; Feature-Auswahl am Viewport-Rand schneidet keinen Strich, Schatten oder Materialrand ab. Fehlende Style-Tokens fallen auf definierte neutrale Werte zurück. |
| T-D03 | `VisualMap` unter `verdant` und `dryland` kanonisch vergleichen | `mapId`, `bounds`, `hexLayout`, `detailSeed`, Feature-ID/-Kind/-Ebene/-Reihenfolge/-Bounds und sämtliche Pfad-/Polygonkoordinaten sind exakt gleich. Nur Palette/Materialtokens und daraus abgeleitete Farbe/Textur wechseln. |
| T-D04 | Odd-Row-Transform mit Radius 62 und Origin (0,0) als Vertragsvektor | Zentren: (0,0)→(0,0); (1,0)→(107.387,0); (0,1)→(53.694,93); (1,1)→(161.081,93), jeweils auf 0,001 Weltpixel gerundet. Ein anderes exportiertes Origin verschiebt alle vier Zentren um denselben Wert. Grid, Areas, Fokus, Units und Hitflächen verwenden dieselben Zentren. Core-Koordinaten bleiben unverändert. |
| T-D05 | Renderer ohne `VisualMap` starten | Bestehender Hex-Fallback mit Radius 30, Origin (45,45), regelrelevanten Terrainfarben und Picking bleibt verfügbar; kein Ladefehler oder leerer Bildschirm. |

## Mehrzellige Weltformen und Ebenen

Für jede Zeile wird die **endgültige Feature-ID** aus CONTENT-01, ihre globale Geometrie/Bounds, die geschnittenen Hex-IDs und ein Browserbild mit Grid an/aus notiert. „Mehrzellig“ bedeutet, dass die sichtbare Featurefläche mindestens zwei tatsächlich benachbarte Hexinnenflächen schneidet; Straße und Fluss müssen jeweils mindestens **drei** zusammenhängende Nachbarhexe durchlaufen. Die Brücke verbindet Ufer über dem Fluss und berührt mindestens zwei Hexflächen oder überschreitet deren gemeinsame Grenze. Es genügt nicht, nur dieselbe Farbe in getrennten Hexkacheln zu wiederholen.

| ID | Objekt / Sample aus Studie | Sichtbares Soll |
| --- | --- | --- |
| T-F01 | Hauptstraße; in der Studie vom linken Rand über Brücke bis zum rechten Rand | Ein durchgehender, verbunden gezeichneter Weg über ≥3 Nachbarhexe; an jeder Hexgrenze unveränderte Mittellinie und Breite, auch mit Grid aus. |
| T-F02 | Fluss; Studie links zum See und südlich ab See | Zusammenhängendes Wasserband über ≥3 Nachbarhexe; Ufer, Innenwasser und Material verlaufen ohne Kachelschnitt. Wenn der kanonische Export mehrere Fluss-Features nutzt, sind ihre dokumentierten Anschlüsse lückenlos. |
| T-F03 | Brücke nahe (896,576) in der Studie | Brückenfläche liegt oberhalb des Wassers, verbindet die Straße auf beiden Ufern und schneidet eine Hexgrenze; keine Unterbrechung an der Kreuzung. Picking unter der Brücke liefert weiterhin das regelrelevante Hex bzw. eine Einheit. |
| T-F04 | See im oberen Kartenmittelteil | Eine zusammenhängende Wasserfläche über ≥2 Nachbarhexe; Uferkurve und Füllung enden nicht an Hexlinien. |
| T-F05 | Waldflächen oben und unten | Jede geprüfte Fläche erstreckt sich über ≥2 Nachbarhexe; Kronen/Textur sind global verankert und werden an Hexgrenzen nicht neu gestartet. |
| T-F06 | Höhenrücken links/rechts vom See | Kontur und Flächen verlaufen über ≥2 Nachbarhexe; keine Treppen-/Kachelkante an Rastergrenzen. |
| T-F07 | Ebenen- und Pointer-Reihenfolge | Grundfläche → Bodentextur → Höhe → Wald → Wasser → Wege/Brücken → Objekte → unsichtbares Hex-Picking → optionales Grid → Areas → Wracks → Einheiten → Fokus → Effekte. Terrain- und Dekorlayer haben `pointer-events: none`; Grid aus zeichnet im VisualMap-Pfad keine Hexkanten. |

### Globale Detail-Assets (Vertragsergänzung vom 2026-09-30)

Das portable Paket enthält für jedes Set ein transparentes SVG für `ground-grain` und eines für `forest`. In der gelieferten Content-Referenz liegen **3400** Ground-Grain-Kreise und **8200** Forest-Kreise je Set. Ein read-only Vergleich der SVG-`circle`-Attribute ergab positionsgleiche `(cx,cy,r)`-Sequenzen zwischen `verdant` und `dryland`; die erste/letzte Ground-Grain-Position ist `(304,509,r=0.6)` / `(524,78,r=1.3)`, die erste/letzte Forest-Position `(361.2,455.7,r=5.4)` / `(462.1,85.2,r=2.4)`. Diese Werte sind Datenorakel für QA-06, keine Aussage über die noch unfertige Integration.

| ID | Eingabe / Nachweis | Sollwert |
| --- | --- | --- |
| T-X01 | Beide Sets laden und bei Grid aus die Weltansicht mit/ohne Detail-Assets vergleichen | Bodenkorn ist über der Grundfläche **sichtbar**, Waldkronen/-punkte sind innerhalb der Waldflächen **sichtbar**; die Layer bleiben transparent außerhalb ihrer Motive. Ein bloßes Token-`detail` ohne gerendertes SVG genügt nicht. |
| T-X02 | `verdant↔dryland` umschalten; beide geladenen SVGs und Browserbilder vergleichen | Jeweils 3400/8200 Details, dieselben globalen `(cx,cy,r)`-Positionen und Wald-Clips; nur Farben/Materialtöne wechseln. Stichproben an den genannten ersten/letzten Punkten und an gut sichtbaren Waldstellen behalten ihre Lage. |
| T-X03 | A/B-Viewport-Split und umgekehrte Renderreihenfolge mit Detail-Layern wiederholen | Die SVG-Detailbilder werden mit denselben 1440×960-Weltbounds verankert und nur am Viewport geclippt. Korn und Kronen springen an x=900 nicht, werden nicht doppelt erzeugt und bleiben nach Stilwechsel positionsgleich. |
| T-X04 | `detailAssets.path` beider Sets im integrierten Hauptcheckout laden; Netzwerk- und DOM/SVG-Befund prüfen | Alle vier Pfade sind sicher zur Hauptprojektwurzel relativ, liefern lokal ein transparentes SVG ohne Fehler und beziehen nichts aus dem Unit-Art-Checkout oder einem alten absoluten Workspace-Pfad. |

## Zwei angrenzende Viewports und visuelle Naht

Für die 1440×960-Kartenstudie ist der vorgeschlagene deterministische Testsplit **A: x=0..900, y=0..960** und **B: x=900..1440, y=0..960**. Die gemeinsame Kante x=900 läuft durch den Brücken-/Straße-/Flussbereich der Studie. Falls CONTENT-01 die kanonische Geometrie verschiebt, wird der Split an eine dokumentierte Stelle gelegt, an der Straße **und** Wasser die Kante schneiden; beide Viewports bleiben disjunkt und decken zusammen die gesamte Kartenbreite ab. Eine vollständige Kartenansicht mit denselben Style-/Grid-Einstellungen ist das Referenzbild.

| ID | Aktion | Sollwert / Messung |
| --- | --- | --- |
| T-V01 | A und B separat rendern; am Split alle schneidenden Features anhand ihrer globalen Bounds listen | Die gleichen Feature-IDs mit identischem Pfad/Polygon, `detailSeed`, Stil und globalen Materialkoordinaten erscheinen beiderseits der Kante. Nur die Clipregion unterscheidet sich. Ein Feature darf nicht wegen einer zu engen Bounds-Angabe auf einer Seite fehlen. |
| T-V02 | A und B pixelgenau ohne Zwischenraum zusammensetzen, Grid **aus**, gegen vollständige Karte vergleichen | Straße, Wasser/Ufer, Brücke, Textur und Höhen-/Waldformen treffen an x=900 ohne sichtbare Lücke, Doppelrand oder Versatz aufeinander. Im schmalen Streifen beiderseits der Kante sind Formkanten und Texturmuster durchgehend. Anti-Aliasing-Unterschiede an exakt einer Clip-Pixelspalte werden gesondert beurteilt; ein flächiger Spalt oder Positionssprung ist Fehler. |
| T-V03 | B vor A und A vor B rendern; beide Stile wiederholen | Feature-Geometrie und global verankerte Textur sind unabhängig von Renderreihenfolge und Chunk-Ursprung. Der Split erzeugt keine neue Zufallsvariante. |
| T-V04 | Split über eine Hexkante und über ein Unit-Hex legen; Picking und Fokus beiderseits prüfen | Ein Weltpunkt wählt in beiden Viewports dieselbe `{x,y}`-Zelle; Units und Fokus behalten denselben Weltmittelpunkt und werden am Clip nicht versetzt. |

## Grid, Picking, Stile und Regel-Invarianz

| ID | Aktion | Sollwert |
| --- | --- | --- |
| T-U01 | Dieselbe Karte mit Grid aus/an aufnehmen; sonst ViewState unverändert | Aus: keine sichtbaren Hexkanten des neuen Terrainpfads. An: Hexkanten liegen über Gelände und unter Areas/Units; Straßen/Fluss/See-Formen und Core-State bleiben gleich. |
| T-U02 | Hexmitte und je einen Punkt unmittelbar auf beiden Seiten einer Hexgrenze wählen, mit/ohne Grid; auch unter Straße, Wasser, Wald und Brücke | `onPick({type:'hex',cell:{x,y}})` liefert anhand des gemeinsamen odd-row-Layouts die erwartete Zelle. Dekor fängt keinen Klick ab. Grenzpunkte werden anhand dokumentierter Tie-Break-Regel geprüft; keine Viewport-abhängigen Treffer. |
| T-U03 | Einheit auf Hexzentrum und daneben auf freiem Hex wählen; auch bei Überlagerung von Terrain/Area/Fokus | Auf Einheit: genau ein `unit`-Pick mit ID und Zelle; auf freiem Hex: genau ein `hex`-Pick. Einheit hat Vorrang; Grid/Area/Fokus und Terrain werfen keinen zusätzlichen Pick. Auswahl allein ist ViewState. |
| T-S01 | `verdant→dryland→verdant` bei gleicher Auswahl, gleichem Fokus, Grid und Viewport | Sichtbare Palette/Materialtokens wechseln; Feature-Geometrie, Hex- und Unit-Pick-Ergebnisse, Auswahl/Fokus, Aktionsbereitschaft und Eventliste bleiben gleich. |
| T-S02 | Vor/nach jedem Stilwechsel und Raster-/Viewport-Wechsel vollständigen State, RNG und Replay protokollieren | Bytegleicher serialisierbarer GameState einschließlich `map.terrain`, `units`, `activeTeam`, `phase`, `turn`, `victory`, `rng`; keine neuen Core-Commands oder Events. `queryAreas` und Bewegungs-/Deckungs-/LOS-Werte stimmen je Hex exakt überein. |
| T-S03 | Mit jedem Stil denselben `core-v1`- und `phase-v2`-Befehls-Trace zweimal abspielen | Vollständiger Replay-Trace samt Ablehnungen, Fehlerdetails, Events und RNG entspricht den festen Orakeln (`replayReference`, `expectedPhaseReplay`); Stilwahl und Viewport beeinflussen den Verlauf nicht. |
| T-FB01 | `visualMap` absichtlich weglassen (oder dokumentierten Fallback-Schalter nutzen), je für Core-v1/v2 | Bestehende Hexdarstellung, Grid-/Area-Modi, Fokus und Unit-/Hex-Picking funktionieren; vollständiger GameState/RNG/Replay und regelrelevante Terrain-IDs sind identisch zum Lauf mit VisualMap. |

## Getrennte Regression und Gate

- **Modularer Pfad:** bestehende Renderer-Tests, `core-v1`-Referenzpartie und `phase-v2`-Replay/Browsercheck getrennt von den neuen Terrainfällen ausführen. Der Terrainpfad darf keine Core-Regeldatei und keine Fixture umdeuten.
- **Legacy-Smokes:** IRON DUST und ATLAS über den bisherigen Umschalter jeweils mit Kartenladen, Selektion, legaler Bewegung, Phasenfolge, einem Schuss/Combat-Log und Bedienbarkeit nach Gegnerzug prüfen. Sie belegen Verfügbarkeit, nicht Terrain-Parität oder vollständige Szenarioregeln. `goblin-x4z` bleibt ein getrenntes Legacy-Overlay-Thema.
- **QA-06-Gate:** Testausführung erst nach abgeschlossenen CONTENT-01 (`goblin-qws.2`), CE-05 (`goblin-qws.3`), DEV-07 (`goblin-qws.4`) und REVIEW-01 (`goblin-qws.8`). Der Nutzer begutachtet zuerst die nächste integrierte, lokal testbare Version; QA-06 startet danach nur auf ausdrückliche Freigabe des Architekten auf Basis des Nutzerfeedbacks. QA-05 bewertet keinen unfertigen Stand.

## Offene Testzugangsfragen für Architekturkoordination

1. Welche endgültigen **integrierten** Dateipfade und Szenario-/Kartenbindungen übernimmt DEV-07 aus dem nun gelieferten `portable/`-Paket? Die dortigen IDs und Bounds sind bekannt; für T-F01–F06 werden noch verbindliche Hex-Beispielzellen im tatsächlichen Vergleichspfad benötigt.
2. Über welchen lokalen Vergleichspfad und welche dokumentierten UI-/Test-Hooks sind StyleSet, Grid, Fallback, Viewport A/B, Picks, Feature-Liste und vollständiger State/Trace beobachtbar? Für die Nahtprüfung ist ein reproduzierbarer Screenshot- oder SVG-Export mit identischem Maßstab nötig.
3. Welche Tie-Break-Regel gilt für einen Klick exakt auf einer Hexgrenze, und wie werden nicht teilbare Clip-Pixel am Viewport-Split verglichen? Die Nachbarpunkte links/rechts sind unabhängig davon testbar.
4. Welche regelrelevante Core-Szenario-`map.terrain` wird unter der kanonischen VisualMap gezeigt? Nur damit lassen sich konkrete Bewegungs-, Deckungs- und LOS-Sollwerte pro ausgewähltem Hex statt bloßer Gleichheit vor/nach Stilwechsel protokollieren.
