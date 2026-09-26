# Changelog

Alle auf GitHub Pages veröffentlichten Änderungen werden hier nach Buildversion dokumentiert. Die Versionslinie bleibt vorerst bei `0.1`; mit jeder Übergabe wird ausschließlich die letzte Stelle erhöht.

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
