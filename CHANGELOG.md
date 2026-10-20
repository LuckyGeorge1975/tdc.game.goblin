# Changelog

Diese Versionslinie bleibt vorerst bei `0.1`; mit jedem Build wird ausschließlich die letzte Stelle erhöht. Der Veröffentlichungsstand und der tatsächlich auf Pages bereitgestellte Commit werden im jeweiligen Release-Issue nachgewiesen. Build 0.1.13 blieb ein unveröffentlichter Vorläufer.

## [0.1.25] - 2026-10-20

- **Lokaler Build-25-Kandidat, nicht veröffentlicht.** Der UI-V2-Runtimestand `56c135457c0384f08c3579af83b7ee3e724cbeba` ergänzt zur bestehenden Spielbasis eine gesonderte Karten-, Befehls-, Menü- und Missionsoberfläche. Der Einstieg bleibt `?ui=v2`; die öffentliche Standardansicht bleibt Build 0.1.24. Die zehn wählbaren Missionen verwenden die vorhandenen neun Legacy-Profile und den getrennten IRON-DUST-v2-Core-Pfad. Auswahl, Vorschau und Briefing starten keine Mission.
- Team-, Ziel-, Status- und Fokusmarker sind auch über Formen und Zeichen unterscheidbar. Das Kontextmenü bestätigt Befehle am Hex mit begrenztem Panel-Fallback; mobile System- und Phaseninformationen sind gegliedert. Das Hauptmenü hat eine linke Menüspalte mit Hexkulisse, die Levelwahl zeigt eine datengestützte Missionsvorschau. Die Rechtshinweise lesen das unveränderte englische `docs/CONTENT-NOTICES.md` (Version 18) über einen festen Pfad als Textansicht. Navigationstitel, Hinweis auf den englischen Volltext sowie Lade- und Fehlerstatus sind in vier Sprachen lokalisiert; nur der vollständige Notice-Text ist Englisch.
- Die Änderungen verwenden vorhandene lokale Unit-Art- und Terrain-Assets sowie Systemfonts und fügen keine fremden Bilder, Webfonts oder Audioquellen hinzu. Die Konzeptdatei wurde nach Nutzerangabe vom Projektteam selbst mit Claude-Hilfe erstellt; ein separater Rechtevertrag liegt nicht vor. Das ist eine Herkunftsangabe, keine pauschale Rechtsgarantie. Tester Regression bestätigte auf `56c1354` 71/71 gezielte Tests und 44/44 neue Locale-Prüfungen; der frühere Vollsuite-Beleg umfasst 380/380 auf `655db6f`. Tester Release/Bedienung konsolidierte die unabhängigen Bedienbelege auf `56c1354` read-only. Der korrigierte Content-Quellenreview fand im UI-V2-Delta keine neue Fremdquelle und bestätigte unveränderte Notices v18. Offen sind die Nutzerentscheidung zur Standardansicht und die konkrete Veröffentlichungsfreigabe (`goblin-b22.7`). Reale Geräteprüfungen (`goblin-wtg`), Standard-Legacy-FR320 (`goblin-5an`) sowie bedienbare Randpanel-/Querformatreste bleiben gesondert ausgewiesen. [Releasevorlage](docs/UI_V2_RELEASE_CANDIDATE.md).

## [0.1.24] - 2026-10-18

- **Build 0.1.24: lokale QA bestanden, Veröffentlichung vom Nutzer freigegeben.** In der historischen Browser-Mission `iron-dust` erhalten neue Starts, Neustarts und Levelwechsel das Paar `scenarioVersion: 2` / `FIELD_TEST_LEGACY_v2` mit `skip-depleted-treads-v1` (`goblin-bzs`, Produktcommit `7e9e71da37264164eef28c3c78d4d97f276f9ae6`). Automatische Gegnerangriffe überspringen Ketten mit Wert 0 und können verbliebenes Antipersonnel treffen. Bei positivem Kettenwert bleibt die bisherige Priorität; ohne legales Systemziel wird kein Angriffswurf verbraucht.
- Die explizite historische `iron-dust`-v1-Paarung behält ihre Zielwahl. Die übrigen Legacy-Missionen, das separate IRON-DUST-Core-v2-Profil, Replay-Schema 1, Grafik- und UX-Assets bleiben unverändert. Auf der festen Produkt-SHA bestanden fokussierte Tests, vollständige Regression und lokale Bedienprüfung; diese Belege sind im Handoff und `goblin-bzs` verzeichnet. Content und Legal fanden im geprüften Delta keine neue Asset- oder Lizenzhürde für die bisherige begrenzte nichtkommerzielle Vorschau; eine umfassende Regel-, Marken- oder Produktfreigabe ist das nicht. Auf dem lokalen Metadatenkandidaten `5bde0973e7a6b006e1e0af083f95cee440006ea7` bestanden unabhängige Regression, Release-Verifier und ein Build-24-Browser-Smoke (`goblin-bzs`). Der Nutzer gab die Veröffentlichung am 18.10.2026 im Koordinations-Chat ausdrücklich frei. Das Versionstag lautet `v0.1.24`; tatsächlich veröffentlichter Commit, Workflow, Tag und öffentliche Pages-Nachprüfung werden nach der Auslieferung in `goblin-bzs` belegt. `v0.1.23` auf `2748063b83dbb8957d00a7b0f8523753c6b80ae9` ist die zuvor öffentlich geprüfte Version und der Rückfallpunkt.

## [0.1.23] - 2026-10-13

- Diagnostisch veröffentlichter Stand: Die kleinen Karten-, Listen- und Auswahlicons der Sets 01–05 laden 130 kanonische, projektinterne 256 × 256-RGBA-PNGs statt der SVG-Dateien (`09b1b70`, `goblin-gp7`). Die PNGs stimmen 130/130 per SHA-256 mit den Content-06-Quelldateien überein und ergänzen die rohen Runtime-Assets um 1.416.801 Bytes (1,35 MiB). Die SVGs bleiben im Repository; Set 06, Unit Guide, Terrain, Regeln und Layout behalten ihre bisherigen Pfade beziehungsweise Funktionen. Der lokale Server liefert PNGs als `image/png`; die geänderte Icon-Pfadlogik erhält einen neuen Skript-Cacheparameter.
- Der Wechsel umgeht die interne SVG-Darstellung als technische Hypothese zum auf echtem Android weiterhin beobachteten Verlust heller Icon-Innenflächen. Auf dem lokalen Paketstand `5e596eb` bestanden 375/375 Tests und der Release-Verifier; die nachfolgende Handoff-Klarstellung auf `6f7e30b` bestand den gezielten Diff-Check und Verifier. Unabhängige Desktop-Bedien-QA in Legacy und IRON DUST v2 zeigte geladene PNGs und sichtbare Innenflächen; ein finaler Browser-Smoke auf `6f7e30b` bestätigte Build 0.1.23 mit HTTP 200 `image/png`. Die Motive wirken durch transparente Ränder schmaler als die bisherigen eng zugeschnittenen SVGs. Content und Legal fanden im engen Delta keine neue Provenienz- oder Rechtehürde für die begrenzte nichtkommerzielle Vorschau. Der Nutzer hat am 13.10.2026 die diagnostische Veröffentlichung von 0.1.23 ausdrücklich freigegeben. Anschließend wurde Build 0.1.23 unter `v0.1.23` auf `2748063b83dbb8957d00a7b0f8523753c6b80ae9` veröffentlicht; der Pages-Workflow und der öffentliche Einstieg wurden geprüft (`goblin-gp7`). `v0.1.22` bleibt der ältere Rückfallpunkt. Der echte Android-Nachtest zeigte die Innenflächen im geprüften Edge-Mobile-Fall; die ursprüngliche SVG-Ursache ist nicht nachgewiesen.

## [0.1.22] - 2026-10-13

- Die 26 bestehenden Karten- und Listenicons des Sets 04 Pixel-Strategie enthalten ihre bisherigen Füll-, Kontur- und Schriftwerte zusätzlich als SVG-Präsentationsattribute (`c0fd78b`, `goblin-gp7`). Dies ist ein Kompatibilitätsfallback für die auf einem Android-Screenshot beobachteten fast schwarzen Innenflächen; Motive, Palette, Filter, Regeln und Layout sind unverändert.
- Der kanonische Unit-Art-Generator und seine 26 Set-04-Quellicons wurden separat auf `da9095b` nachgezogen und reproduzieren die Runtime-Dateien. Auf dem lokalen Kandidaten `5ad3481` bestanden finale Regression sowie Desktop-, v2- und emulierte Mobilprüfung im begrenzten Umfang; Content und Legal fanden für diesen mechanischen Fallback keine neue Rechtehürde für die bisherige nichtkommerzielle Vorschau (`goblin-gp7`). Build 0.1.22 wurde nach gesonderter Nutzerfreigabe unter `v0.1.22` auf `dc7d068b1b14043962a7e296620020e2567760a3` veröffentlicht und öffentlich geprüft. Der anschließende Test auf dem betroffenen Android-Gerät zeigte weiterhin fehlende helle Icon-Innenflächen; dieser Defekt bleibt in `goblin-gp7` offen.

## [0.1.21] - 2026-10-12

- IRON DUST v2 zeigt die gewählten `ICON SET`-Motive nun auch in Einheitenliste und Auswahl an. Der Setwechsel aktualisiert beide Bereiche, ohne den Spielzustand zu verändern (`eefda4f`, `goblin-dfs`).
- Am 13.10. wurden die 130 bestehenden Runtime-Icon-SVGs der Sets 01–05 (je 26) aus dem projektinternen Unit-Art-Stand `2fd8ae9` übernommen (`8133906`). Engere transparente Ausschnitte und eine helle Kontur aus der jeweiligen vorhandenen Setpalette verbessern ihre Erkennbarkeit in Legacy und v2. Guide-Bilder, Set 06, Regeln und Layout bleiben unverändert; Quell-PNG-Vorschauen sind nicht Teil des Runtime-Builds.
- Build 0.1.21 wurde nach den Release-Gates unter `v0.1.21` am Commit `00070606d6f5a4155cccff56a4b6daadb68997b5` veröffentlicht und öffentlich geprüft (`goblin-dfs`). `v0.1.20` bleibt der vorherige Rückfallpunkt. Der anschließend gemeldete mobile Set-04-Sichtbefund wird in `goblin-gp7` bearbeitet.

## [0.1.20] - 2026-10-09

- IRON DUST v2 ist als getrenntes, regulär auswählbares Level integriert. Es nutzt das versionierte Regelprofil mit vier eigenen und drei gegnerischen Einheiten, automatischem Gegnerzug und über die normale Oberfläche erreichbarem Sieg und Niederlage. Neue v2-Bedientexte, Missionsziel, Quick Start, Live-Status im Unit Guide und Kampfmeldungen sind in Deutsch, Englisch, Spanisch und Französisch angebunden; die übrigen historischen Katalogeinträge des Unit Guide bleiben unverändert.
- Die öffentliche Supercover-Mission aus 0.1.19 und die acht historischen Legacy-Missionen bleiben erhalten. IRON DUST v2 ist im regulären Level-Menü auch auf Pages auswählbar. Der Entwicklungsparameter `iron-dust-v2-seed=2` aktiviert den reproduzierbaren Niederlagepfad ausschließlich auf `localhost` oder `127.0.0.1`. Die bisher veröffentlichten Bildsets, Layouts und Content-Rechte werden nicht erweitert.
- Build 0.1.20 wurde nach lokaler Regression, Browser-/Bedien-QA und begrenzter Content-/Legal-Prüfung unter `v0.1.20` auf Commit `febdfe2c5b9950a6828a69c75783ce2b4f2f14e2` veröffentlicht (`goblin-nuu`). Der nach Veröffentlichung gemeldete Sichtbefund zu den Grafiksets wird in `goblin-dfs` bearbeitet; `v0.1.19` bleibt der zuvor geprüfte Rückfallpunkt.

## [0.1.19] - 2026-10-08

- Das neue, separat auswählbare Supercover-Showcase verwendet eine strenge, symmetrische Sichtlinie für Vorschau sowie Spieler- und Gegnerfeuer. Ein blockierendes Hex an einer berührten Grenzkante sperrt die Linie. Die acht bisherigen Missionen behalten ihren bisherigen Regel- und Sichtlinienstand.
- Spielskripte und Stile wurden im Repository unter `src/legacy/` geordnet; der Spieleinstieg bleibt an der Projektwurzel. Es gibt keine neuen Grafiksets, Icons oder Layouts. Vollkatalog-Regeln, Gegner-KI und weitere UX-Arbeit sind nicht Teil dieses Builds.

## [0.1.18] - 2026-10-06

- `ICON SET` wechselt die sechs vorhandenen Grafiksets während einer laufenden Partie. Karte, Listen, Auswahl und Unit Guide zeichnen die gewählten Motive neu; Runde, Phase, Einheitenzustand und Auswahl bleiben erhalten. Die Wahl wird weiterhin im Browser gemerkt.
- Build 0.1.18 enthält keine neuen Motive oder Spielregeln. Unabhängige Regression, Bedienprüfung sowie die Content-/Legal-Deltaprüfung auf Produktcommit `4d316868` sind bestanden (`goblin-rfe.2`, `goblin-rfe.3`, `goblin-rfe.4`). Veröffentlichung und öffentlicher Einstieg werden gesondert in `goblin-rfe` nachgewiesen.

## [0.1.17] - 2026-10-03

- Die 130 grafischen Content-08-Guide-Ansichten werden als 1024 × 683 WebP Q85 mit transparentem, optimiertem 768 × 512-PNG-Fallback geladen. Die 1536 × 1024-Master bleiben im getrennten Unit-Art-Quellcheckout; der Pages-Checkout enthält sie nicht mehr. Karten-/Listenicons und Military-Guide-SVGs bleiben separat.
- Der vollständige Export verkleinert die 130 WebP-Dateien auf 16.053.262 Bytes; alle 130 PNG-Fallbacks belegen 48.653.184 Bytes. Zusammen sind das 64.706.446 statt 256.085.118 Bytes für die früheren Runtime-PNGs. Der Browser fordert pro Guide-Ansicht das WebP an; die gesamte primär geladene Bildmenge ist damit um 93,7 % kleiner. Prüfbelege, Freigabe und Deployment-Stand werden in `goblin-hr7` festgehalten.

## [0.1.16] - 2026-10-02

### Content-08

- Der Unit Guide lädt für die fünf grafischen Stile je 26 große, freigestellte Content-08-PNG-Einzelansichten (insgesamt 130, 1536 × 1024 RGBA) statt der generierten 2.5D-SVG-Ersatzansichten. Die gewählte Stilvariante bestimmt weiterhin gleichzeitig Guide, Karten- und Listenmotive.
- Karte und Listen verwenden unverändert die kleinen SVG-Icons. Das militärische Set verwendet weiterhin getrennte Icon- und Guide-SVGs mit demselben Symbolmotiv. Mini-Map und General-Texte im Guide bleiben erhalten.
- Manifest, Asset-Dokumentation und [Content & Asset Notices](docs/CONTENT-NOTICES.md) dokumentieren Zuordnung, Herkunft, KI-Ursprung, menschliche Prüfung und Grenzen der Content-08-Bilder.

### Prüfung und Veröffentlichungsstand

- Quellenstand `tdc.game.ogre-unit-art` `10131dc16ede760f2338b6605e10675f0cd81d29`: 130/130 PNGs wurden mit den Quelldateien per SHA-256 abgeglichen. Auf dem Integrationscommit `5a069a6c5a1169f7f03345cfb217c15db3f8dbe4` bestanden 137/137 Node-Tests und lokale Browserprüfungen der sechs Stile auf Desktop und emulierten Mobilgrößen ohne Ladefehler; vier Screenshots liegen unter `qa-evidence/bvh-guide-*.png`.
- Build 0.1.16 wurde nach unabhängiger QA und gesonderter Nutzerfreigabe unter `v0.1.16` auf `ff3bcc448f2580035aad2b6cea0681434d98617a` veröffentlicht (`goblin-6q6`). `v0.1.15` bleibt Rückfallpunkt. Die oben beschriebene Payload-Optimierung gehört nicht zu diesem veröffentlichten Build.

## [0.1.15] - 2026-10-02

### Hinzugefügt und geändert

- Für die fünf grafischen Stile neue räumliche Dreiviertel-Ansichten im Unit Guide, getrennt von den kleinen Karten- und Listenicons. Der sechste Stil (Military) zeigt dasselbe taktische Symbolmotiv in getrennten kleinen und großen Asset-Dateien. Alle sechs Stile mit jeweils 26 Einheitentypen bleiben wählbar.
- Vier auswählbare Legacy-Showcases: Geländeparcours K sowie U1 Vorstoß, U2 Belagerung und U3 Spezialkräfte. Die Level werden aus validierten lokalen JSON-Daten geladen; Szenarioziele und Briefings sind in Deutsch, Englisch, Spanisch und Französisch verfügbar.
- Mobile Ansicht startet mit sichtbarer Karte. Truppe und Lage/Protokoll sind über eine Ansichtsleiste erreichbar; die Hauptaktion bleibt unten sichtbar. „Auf Karte“ im Unit Guide öffnet und fokussiert die gewählte Kartenansicht.
- Der Guide kennzeichnet die Artillery Drone im aktuellen Field Test mit Bewegung 2. Die stationäre Katalogregel mit Bewegung 0 ist als zukünftiges Ziel abgegrenzt.
- Bei gleichzeitiger vollständiger Ausschaltung beider Seiten gilt Niederlage; ein Sieg setzt mindestens eine überlebende eigene Einheit voraus. Das eigenständige Kern-Siegziel von IRON DUST bleibt bestehen.
- Die Legacy-Reichweitenberechnung folgt jetzt den tatsächlichen Nachbarn des versetzten Hexrasters. Feuerreichweite, Ein- und Aussteigen beim Transport sowie Nachbarfelder des Raketensplashs verwenden dieselbe odd-row-Distanz wie der Core. Beim Raketenwerfer in `UNIT TRIAL` können dadurch bisher scheinbar erreichbare Ziele abgelehnt und tatsächlich erreichbare Ziele angenommen werden; Friendly Fire trifft nur wirkliche Nachbarfelder.
- Das Pages-Release-Gate vergleicht die Buildnummer mit dem letzten veröffentlichten Vorgänger-Tag. Unveröffentlichte Zwischencommits mit derselben Buildnummer verhindern das Deployment damit nicht mehr.

### Grenzen und Prüfung

- Katalogwerte und noch nicht implementierte Sonderregeln sind keine Zusage für den Legacy Field Test. Die vier Showcases verwenden dessen historischen Regel- und Wertestand.
- Die Reichweitenkorrektur ändert nicht die historische Pixelabtastung für Sichtlinien an Hex-Grenzen. Die Grenzlinienwahl bleibt eine gesonderte Regelentscheidung (`goblin-9bj.27`).
- Die unabhängige QA auf dem Regelstand `279a16d` bestand 130 Node-Tests und zwölf vollständige Desktop-/Mobil-Endläufe unter dem Pages-Projektpfad (`goblin-0lk`). Der spätere Workflow- und Dokumentations-Fix verändert den Spielcode und die Assets nicht; sein exakter Veröffentlichungscommit wird mit Release-Gate und gezielter Browserprüfung gesondert abgesichert. Echte Fingerproben auf Tablet/Smartphone (`goblin-wtg`) bleiben offen.
- Herkunft und begrenzte Legal-/Content-Einschätzung der bereits veröffentlichten Assets gelten weiter; die neuen Guide-Ansichten der fünf grafischen Stile und die Leveltexte sind im Projekt entstanden. Eine kommerzielle oder verbindliche rechtliche Freigabe liegt nicht vor.

## [0.1.14] - 2026-10-01

### Hinzugefügt

- Sechs auswählbare Unit-Art-Stile mit je 26 kleinen Icons für Karte und Listen sowie 26 großen Ansichten für den Unit Guide. Die Combobox schaltet beide Größen gemeinsam um; Technische Illustration ist anfänglich gewählt. Fünf Stile sind grafische Varianten, das sechste ist ein inoffizielles militärisches Symbolset.
- Breite Guide-Ansicht mit vollständig sichtbaren 1024 × 768-SVGs und scrollbar nutzbarer Mobilansicht. Die zwölf Terrainmotive und das Logo des früheren Stilsets 01 dienen für die neuen Sets als Fallback.
- Herkunft, Nutzerreferenz, fünf KI-generierte Konzepttafeln und Grenzen der nichtkommerziellen Asset-Einschätzung sind in [Content & Asset Notices](docs/CONTENT-NOTICES.md) dokumentiert. Die Tafeln zeigen je vier Stilbeispiele und sind keine Laufzeitansichten.

### Präzisiert

- Der beschreibende Zielcode von `UNIT TRIAL` nennt nun Kommandokern und alle Gegner. Die damalige `checkVictory()`-Priorität bei gleichzeitiger vollständiger Ausschaltung blieb in 0.1.14 unverändert; sie wird erst mit dem lokalen Kandidaten 0.1.15 geändert.

### Geprüft und offen

- Die sechs gekoppelten Stile wurden vor der damaligen Versionssetzung unabhängig geprüft: 312/312 SVGs, 24/24 Browserprüfblöcke auf Desktop und zwei emulierten Mobilgrößen sowie 119/119 Node-Tests (`goblin-28c`). Build 0.1.14 wurde nach gesonderter Nutzerfreigabe am 01.10.2026 auf Commit `750941134f610ba7a75bbb11d8011e5714139e21` mit Tag `v0.1.14` veröffentlicht.
- Echte Tablet-/Smartphone-Fingerproben und eine professionelle Markenprüfung für kommerzielle Nutzung bleiben offen. Die begrenzte Asset-Einschätzung ist keine pauschale Rechtsfreigabe.

## [0.1.13] - 2026-10-01

### Hinzugefügt

- Modulare Spieloberfläche mit lokalisierter Bedienung in Deutsch, Englisch, Spanisch und Französisch, Terrain-Vorschau und sicherer Vorschau vor einem Bewegungsbefehl.
- Vier umschaltbare Terrain-Stile (Verdant Atlas, Dryland Survey, Natural Terrain und Field Atlas) auf derselben validierten VisualMap; Herkunft und offene Freigabefragen sind dokumentiert.
- Statischer GitHub-Pages-Projektpfad für die modulare Oberfläche und reproduzierbare Browser-Prüfung des Unterpfads.

### Geprüft

- Unabhängige UI-Nachprüfung: 42/42 Browserfälle. Unabhängige Pages-Pfad-Prüfung: 18/18 Fälle, vier Sprachen und vier Terrain-Stile; 115/115 Node-Tests.
- Terrain-Geometrie, Hexkanten-Picking und Spielzustand bei Stilwechseln sind mit festen Prüffällen abgesichert.
- Herkunft der Terrain-Assets, Nutzerangaben zu Grafik-Eingaben und die Grenzen der Legal-Risikoeinschätzung für eine nichtkommerzielle Vorschau sind dokumentiert.

### Noch offen

- Echte Tablet- und Smartphone-Fingerproben sowie formale Legal-Freigabe des neuen Terrain-Auftritts. Dieser lokale Kandidat ist noch nicht veröffentlicht.

## [0.1.12] - 2026-09-28

### Hinzugefügt

- Zentrale Spielregeln für alle zwölf ATLAS-Geländearten: Bewegung je Fahrzeugmodus, Wasserpassage für Skimmer und amphibische Infanterie, Sichtblocker und Deckung +1 auf die effektive Verteidigung.
- Field Intel zeigt Geländetyp, Bewegungskosten der gewählten Einheit und Deckung; Unit Intel zeigt den Deckungsbonus. Pfadsuche, Gegnerbewegung, Entladen und Kampfwürfe verwenden dieselben Regeln.
- Unit Guide mit allen 26 Motiven, Live-Werten im aktuellen Szenario, Szenarioverfügbarkeit, Phasenstatus, Aktionsprofil und „Auf Karte“-Schaltfläche. Geplante Spezialaktionen sind als solche gekennzeichnet.

### Bereinigt

- Regelmatrix und Quick Start auf den tatsächlichen Spielstand abgeglichen: Siegebreaker-Bewegung, Skimmer-Budget, CRT, Terrains und offene Spezialfähigkeiten.
- Dokumentation trennt implementierte Playtestregeln von vorläufigen ATLAS-Einheitenwerten und Entwurfswerten des Katalogs.

## [0.1.11] - 2026-09-28

### Hinzugefügt

- Zwölf Terrainmotive für jedes der fünf Icon-Sets. Der Stilwechsel aktualisiert nun Einheitengrafiken und Gelände gemeinsam.
- Spielbares Content-Showcase `ATLAS / PROVING GROUNDS` aus der gelieferten JSON-Leveldatei mit 26 platzierten Einheitentypen und allen zwölf Geländemotiven.
- Terrainbezeichnung und vorläufiger Regelstatus in `FIELD INTEL`; das neue Szenario nutzt die vorhandenen Bewegungs-, Feuer-, Transport- und Phasensysteme.

### Noch offen

- Trümmer und Berge verwenden die vorhandene Deckungsregel. Die zehn übrigen Geländemotive sind visuelle Prototypen ohne eigene Bewegungs- oder Sichtregel. Die ATLAS-Einheitenwerte sind vorläufig; Siegbedingung ist vorerst die Ausschaltung aller Gegner einschließlich Command Core.

## [0.1.10] - 2026-09-28

### Hinzugefügt

- Fünf vollständige, vom Content Creator erstellte SVG-Icon-Sets mit je 26 Motiven für Karte und Einheitenliste sowie größeren Illustrationen für den Unit Guide.
- Dropdown `ICON SET` neben der Szenariowahl. Die Auswahl bleibt lokal im Browser gespeichert; ein Wechsel startet das aktuelle Szenario neu und fragt bei Spielfortschritt vorher nach Bestätigung.
- Automatische Motivzuordnung für Szenario-Varianten wie Field Engineers, Relay Node und Siege Tank; vorhandene individuelle `setAsset`-Overrides bleiben möglich.
- Asset-Vollständigkeits- und Wechseltests für alle fünf Stile sowie ein lokaler visueller Smoke-Test.

## [0.1.9] - 2026-09-26

### Hinzugefügt

- Strategischer Raketenwerfer als fünfte eigene Einheit im Szenario `UNIT TRIAL`.
- Einmaliger, zielgebundener Flächenschlag in der Feuerphase: Angriff 6 auf das gewählte Feindziel, Angriff 3 auf Einheiten in benachbarten Hexen – inklusive eigener Einheiten und transportierter Passagiere.
- Munitionsanzeige in Unit Intel und Rücknahme des Raketenstarts über `BACK`.
- Regeltests für Munition, Flächenschaden, Friendly Fire und Undo.

### Präzisiert

- Unit Guide, Quick Start und Regelmatrix kennzeichnen die derzeitige Sichtlinienpflicht und die einmalige Munition. Freies Zielen auf leere Hexfelder und weitere strategische Sonderregeln sind noch nicht enthalten.

## [0.1.8] - 2026-09-26

### Hinzugefügt

- Aktive Waffenauswahl für den GOBLIN SIEGEBREAKER mit getrennten Feuerbudgets für Hauptbatterie, Sekundärbatterien, Raketen und Nahbereichsschutz.
- Zentraler Visual-Katalog für Einheitengrafiken mit austauschbaren lokalen SVG-, PNG- oder WebP-Assets und stabilen `visualKey`-Schlüsseln.
- Erweiterungshinweis `docs/UNIT_VISUALS.md` sowie automatische Tests für lokale Assets, Waffenauswahl, Munition und Undo.

### Geändert

- Feuerreichweite, Zielmarkierung und Unit Intel folgen beim Siegebreaker dem aktuell gewählten Waffensystem.
- Verbrauchte Batterien werden pro Runde zurückgesetzt; abgefeuerte Raketen bleiben verbraucht.
- Mehrere noch intakte Waffensysteme können innerhalb derselben Fire Phase nacheinander feuern.

### Behoben

- Bereits zerstörte Raketenwerfer können keine Phantommunition mehr erzeugen.

## [0.1.7] - 2026-09-26

### Content & Legal

- Sichtbare Einheiten-, Phasen- und Katalogbezeichnungen auf die eigenständige G.O.B.L.I.N.-Nomenklatur umgestellt.
- Erweiterungs- und Produktbezüge durch die internen Linien `CORE`, `EXPEDITIONARY`, `FRONTIER`, `SUPPORT` und `AUTONOMOUS` ersetzt.
- Externe Webfonts entfernt und durch lokale Systemschrift-Stacks ersetzt.
- Footer und Dokumentation um klare Herkunfts- und Unabhängigkeitshinweise ergänzt.
- Versionierte Content-Clearance und ein Drittanbieter-Inventar für die ausstehende Legal-Prüfung angelegt.

## [0.1.6] - 2026-09-26

### Hinzugefügt

- Maschinengeprüfte, versionierte Übersicht der Playtest- und Legal-Berichte mit eindeutigem Bezugsstand und Bearbeitungsstatus.
- Eigenes Browser-Favicon.

### Geändert

- Command Hub und Objective zeigen den regelrelevanten Schadenszustand `0/2` beziehungsweise `1/2` statt irreführender Trefferpunkte.
- Unit Intel und Kampfprotokoll erklären Deaktivierungsdauer sowie die Folge eines weiteren `D`- oder `X`-Treffers.
- Deaktivierte Einheiten sind in Liste und Karte klar von Einheiten getrennt, die in der aktuellen Phase bereits gehandelt haben.

### Behoben

- Der zweite `D`-Treffer auf eine bereits deaktivierte Einheit wird ausdrücklich als Ausschaltung gemeldet.
- Der 404-Fehler für `/favicon.ico` entfällt durch ein eingebundenes SVG-Favicon.

## [0.1.5] - 2026-09-26

### Hinzugefügt

- Zentraler Release- und Übergabemechanismus mit sichtbarer Buildnummer, Changelog und Tester-Checkliste.
- Automatische Deployment-Sperre, falls die Buildnummer nicht erhöht wurde oder der Changelog-Eintrag fehlt.
- GOBLIN-Systemmodell mit getrennten Haupt- und Sekundärbatterien, Raketen, AP-Systemen und 45 Kettenpunkten.
- Regelgerechte Transportzustände, Passagierfeuer und getrennte Schadensauswertung für den Skimmer Carrier und transportierte Infanterie.
- Phasenlokaler `BACK`-Befehl mit stabilen Kampfwürfen.
- Gemeinsames In-Game-Dialogsystem für Phasenende, Szenariowechsel und Neustart.

### Geändert

- GOBLIN-Bewegung folgt den Kettenschwellen 45–31 / 30–16 / 15–1 / 0.
- Cargo-Kapazität wird in Infanterie-Stärkepunkten statt in Einheiten gezählt.
- Unit Intel, Unit Guide, Quick Start und Regelmatrix wurden an die neuen Regeln angepasst.

### Behoben

- Ein- und Aussteigen ist auf die Movement Phase begrenzt und verbraucht nur die Infanteriebewegung.
- Ausgestiegene Infanterie kann im selben Zug nicht erneut verladen werden.
- Eingeschiffte Infanterie wird von der Gegner-KI nicht als separates Kartenziel behandelt.

## [0.1.4] - 2026-09-24

- Letzter Stand vor Einführung des formalen Build- und Tester-Handoffs.
