# Changelog

Veröffentlichte Builds und lokale Kandidaten werden hier nach Buildversion dokumentiert. Build 0.1.14 ist seit dem 01.10.2026 auf GitHub Pages veröffentlicht; Build 0.1.15 ist ein lokaler Kandidat. Build 0.1.13 blieb ein unveröffentlichter Vorläufer. Die Versionslinie bleibt vorerst bei `0.1`; mit jeder Übergabe wird ausschließlich die letzte Stelle erhöht.

## [0.1.15] - 2026-10-02

### Lokaler Kandidat – hinzugefügt und geändert

- Für die fünf grafischen Stile neue räumliche Dreiviertel-Ansichten im Unit Guide, getrennt von den kleinen Karten- und Listenicons. Der sechste Stil (Military) zeigt dasselbe taktische Symbolmotiv in getrennten kleinen und großen Asset-Dateien. Alle sechs Stile mit jeweils 26 Einheitentypen bleiben wählbar.
- Vier auswählbare Legacy-Showcases: Geländeparcours K sowie U1 Vorstoß, U2 Belagerung und U3 Spezialkräfte. Die Level werden aus validierten lokalen JSON-Daten geladen; Szenarioziele und Briefings sind in Deutsch, Englisch, Spanisch und Französisch verfügbar.
- Mobile Ansicht startet mit sichtbarer Karte. Truppe und Lage/Protokoll sind über eine Ansichtsleiste erreichbar; die Hauptaktion bleibt unten sichtbar. „Auf Karte“ im Unit Guide öffnet und fokussiert die gewählte Kartenansicht.
- Der Guide kennzeichnet die Artillery Drone im aktuellen Field Test mit Bewegung 2. Die stationäre Katalogregel mit Bewegung 0 ist als zukünftiges Ziel abgegrenzt.
- Bei gleichzeitiger vollständiger Ausschaltung beider Seiten gilt Niederlage; ein Sieg setzt mindestens eine überlebende eigene Einheit voraus. Das eigenständige Kern-Siegziel von IRON DUST bleibt bestehen.

### Grenzen und Prüfung

- Katalogwerte und noch nicht implementierte Sonderregeln sind keine Zusage für den Legacy Field Test. Die vier Showcases verwenden dessen historischen Regel- und Wertestand.
- Echte Fingerproben auf Tablet/Smartphone (`goblin-wtg`) und die unabhängige finale QA auf dem exakt versionierten Kandidatencommit stehen aus. Ein Push, Tag oder Deployment dieses Kandidaten ist noch nicht erfolgt.
- Herkunft und begrenzte Legal-/Content-Einschätzung der bereits veröffentlichten Assets gelten weiter; die neuen Guide-Ansichten der fünf grafischen Stile und die Leveltexte sind im Projekt entstanden. Eine kommerzielle oder verbindliche rechtliche Freigabe liegt nicht vor.

## [0.1.14] - 2026-10-01

### Hinzugefügt

- Sechs auswählbare Unit-Art-Stile mit je 26 kleinen Icons für Karte und Listen sowie 26 großen Ansichten für den Unit Guide. Die Combobox schaltet beide Größen gemeinsam um; Technische Illustration ist anfänglich gewählt. Fünf Stile sind grafische Varianten, das sechste ist ein inoffizielles militärisches Symbolset.
- Breite Guide-Ansicht mit vollständig sichtbaren 1024 × 768-SVGs und scrollbar nutzbarer Mobilansicht. Die zwölf Terrainmotive und das Logo des früheren Stilsets 01 dienen für die neuen Sets als Fallback.
- Herkunft, Nutzerreferenz, fünf KI-generierte Konzepttafeln und Grenzen der nichtkommerziellen Asset-Einschätzung sind in [Content & Asset Notices](CONTENT-NOTICES.md) dokumentiert. Die Tafeln zeigen je vier Stilbeispiele und sind keine Laufzeitansichten.

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
- Erweiterungshinweis `UNIT_VISUALS.md` sowie automatische Tests für lokale Assets, Waffenauswahl, Munition und Undo.

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
