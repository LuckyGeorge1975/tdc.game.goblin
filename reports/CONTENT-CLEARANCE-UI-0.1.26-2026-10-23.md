# Datierter Herkunfts- und Clearance-Zusatz — Build 0.1.26

**Berichtsversion:** 1
Stand: 23.10.2026. Bezugsruntime: `74e594d4627598898b9fb81e02881c427dda6497`. Verfasst als Developer-Paketnachtrag auf den konkreten Legal-Vorbefund `goblin-nbg.9.3`; abschließender unabhängiger Legal-Review auf dem Paketcommit ist ausstehend. Keine Rechtsberatung und keine Veröffentlichungsgenehmigung.

## Historische Abgrenzung

[Content Clearance vom 26.09.2026](CONTENT-CLEARANCE.md), Berichtsversion 1, bleibt unverändert. Seine Aussagen über den damaligen SVG-/CSS-Bestand sind keine Beschreibung der heutigen Rasterassets. [Content & Asset Notices](../docs/CONTENT-NOTICES.md), nun Dokumentversion 19, erhalten alle alten Abschnitte und ergänzen einen datierten Nachtrag. Die frühere begrenzte nichtkommerzielle Preview-Einschätzung wird nicht erweitert.

## Datei-/Quellzuordnung

| Gruppe | Umfang | Feste Quelle und Beleg | Stand |
|---|---:|---|---|
| Eigene/gegnerische Kartenicons | 52 | Content `c01ecb80bcdd813772d1433d9ae63b39e54ef050`; [Mapreceipt](../assets/unit-art/map-icons-source.json), [Importbeleg](../assets/unit-art/MAP-ICON-IMPORT.md) | 52 Runtimehashes erneut passend |
| Zielnadeln | 2 | Derselbe Contentpin; [Pinreceipt](../assets/unit-art/objective-pins-source.json), [M1-Beleg](../assets/unit-art/M1-IMPORT.md) | 2 Runtimehashes erneut passend |
| Terrainicons | 12 | [Manifest](../assets/terrain-icons/manifest.json) mit beibehaltenem `contentPin`, `verifiedMain:2fdce6ac1be30e8b2a360250b37724586469e71c` und Source-/RESULTS-Hashes | 12 Runtimehashes erneut passend; Präfixpfade beziehen sich auf verifiedMain |
| Gegnerbibliothek | 26 Motive / 52 Derivate | Unit-Art `41b1700af94257cb14e3fe39a667a27ac11b53ef`; [unverändertes Exportmanifest](../assets/unit-art/sets/02-technical-illustration/library-enemy/export-manifest.json) und dort referenzierte PROVENANCE.md/PROVENANCE-U3.md | 52 Runtimehashes erneut passend; historische Exportpfade explizit zugeordnet |
| Fünf Missions-Bakes | 5 WebP + Manifeste | [Bestehende gepinnte Render-/Exportbelege](../assets/map-bakes/README.md); jeweils Content-/Generator-/Master-/Bildhashes und Quellberichte | Vorhandene .15.1-Hashprüfung übernommen; kein neuer Export |
| README-Abbildung | 1 WebP | [Aktueller Handoff mit Quelle, SHA-256 und Szenario](TEST_HANDOFF.md#build-0126--lokales-releasepaket-keine-veröffentlichung) | Verlustfreies echtes Screenshotderivat, kein neues Designmotiv |

Die [maschinenlesbare Matrix](CONTENT-PROVENANCE-0.1.26.json) hält alle 118 einzelnen Source-/Runtimezuordnungen der ersten vier Gruppen samt Quellcommit, historischen Exportpfaden, Provenienzpfaden und SHA-256 fest. Alle 118 Runtimehashes wurden beim Erzeugen gegen vorhandene Dateien geprüft. Die Matrix benennt außerdem die SHA-256 der vier unveränderten Receipts. Sie ersetzt diese nicht und importiert keine privaten Originale. Basename plus Hash bestimmt jede der 52 Gegnerderivate-Zuordnungen eindeutig. Ein Pfadname oder KI-Herkunft allein ist kein Rechtebeleg.

## Herkunft und Grenzen

Die Nutzerbestätigung der projektinternen, mit Claude-Unterstützung erstellten Designkonzepte wird als bestehende Herkunftsangabe angewandt. Die Umsetzung ist Projektcode; Generator-/Exportbelege beschreiben technische Ableitungen, keine neue Lizenz. Für die Gegner-Library hielt Legal im Vorreview fest: ChatGPT image_gen, autorisierte Projekt-Bestandsreferenzen und Stiltafel; die beiden Provenienzdateien wurden dort auf der festen Unit-Art-SHA gelesen. Eine unabhängige Prüfung sämtlicher Eingaberechte wurde nicht behauptet. Bestehende eigene Library-/SVG-/Konzeptquellen und deren historischen Grenzen bleiben durch die bisherigen Notices erfasst.

Der normale Build/CI/Pages-Pfad benötigt nur das Spielrepo und seine Ableitungen; er fragt kein privates Contentrepo ab. Master-/Designsammlung, `codex/unit-art` und die offene Vollständigkeits-/Backup-/Neucheckoutarbeit `goblin-j0k` sind kein Teil einer Veröffentlichungsfreigabe dieses Pakets.

## Noch erforderliche Entscheidung

Der konkrete Dokumentationsmangel des Legal-Vorreviews wird mit diesem Zusatz zur Prüfung adressiert. Ob die Formulierungen und Quellenzuordnung für den engen Preview-Scope genügen, bestätigt erst der unabhängige Endreview `goblin-nbg.9.3` auf fester Paket-SHA. Neue Fremdlizenzen, eine pauschale gesetzliche Garantie, kommerzielle Rechte oder eine Gesamtproduktfreigabe werden nicht behauptet. Paketreview, Einstiegssmoke, Nutzerfreigabe, Deploy, unveränderliches Tag und öffentliche Nachprüfung bleiben getrennte Gates.
