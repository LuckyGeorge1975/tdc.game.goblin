# G.O.B.L.I.N — Field Test

G.O.B.L.I.N steht für **Ground Operations, Battlefield Logistics & Intelligence Network**. Dieses Repository enthält einen eigenständigen Browser-Prototypen für eine rundenbasierte Hexfeld-Taktikmission mit eigener UI, SVG-Karte und frei entwickelten Einheitenmarkern.

## Aktueller Stand

Der Prototyp ist spielbar und auf [GitHub Pages](https://luckygeorge1975.github.io/tdc.game.goblin/) veröffentlicht.

Aktueller Übergabestand: **0.1.5 / Build 5**. Änderungen stehen im [Changelog](CHANGELOG.md), der verbindliche Ablauf in [Developer → Tester Handoff](TEST_HANDOFF.md).

Enthalten sind:

- Hexfeldkarte mit offenem Gelände sowie Berg-/Trümmerfeldern
- Bewegung mit Gelände- und Belegungskosten sowie expliziten Bewegungsmodi für Kettenfahrzeuge, Infanterie, Skimmer und stationäre Einheiten
- getrennte Movement-, Fire- und Skimmer-Manöverphasen
- Einheitliche Spiel-Dialoge für Phasenende, Szenariowechsel und Neustart. Escape bricht ab; Tab und Enter bedienen den Dialog. Spielkürzel und AUTO sind währenddessen gesperrt. „Never ask again“ gilt ausschließlich für das Phasenende. Keine Browser-Messageboxen.
- Taste `L` beim ausgewählten Transporter: ohne Fracht Ladeauswahl wie `+`; mit Fracht Zielfelder zum Entladen der ersten geladenen Einheit anzeigen. Es gelten dieselben Phasenregeln wie beim Klick.
- `BACK` nimmt Befehle der aktuellen Phase einzeln zurück: Bewegung, Feuer, Rammen und Transport inklusive Aktionsstatus und Kampflog. Phasenwechsel und Spielende schließen die Historie ab. AUTO wartet nach dem letzten Befehl zwei Sekunden; mit AUTO aus bleibt Zeit bis zum manuellen Phasenwechsel. Wiederholte Schüsse verwenden denselben gespeicherten Würfelwurf.
- Fire Range und Line-of-Sight-Prüfung
- CRT-Kampfsystem mit NE, D und X sowie expliziten Verteidigungswerten
- Deaktivierung, Wiederherstellung, Zerstörung und sichtbare Wracks
- Goblin-Ramming gegen gegnerische Fahrzeuge
- einfache Gegner-KI mit Bewegung und Feuer
- Szenarien `IRON DUST`, `RELAY RUN` und `UNIT TRIAL`
- Area-Modi `MOVEMENT RANGE`, `FIRE RANGE`, `LINE OF SIGHT`
- optionales Hex-Grid und oberster Feld-Fokusmarker
- Quick-Start-Guide, Einheiten-Guide mit Basis- und Erweiterungseinheiten sowie kombinierte Feld- und Einheiteninformationen
- Skimmer-Carrier-Transport im Szenario `UNIT TRIAL`: Kapazität wird in Infanterie-Stärkepunkten geführt; Ein-/Aussteigen verbraucht die Infanteriebewegung, nicht die Bewegung des Trägers
- Transportierte Infanterie kann aus dem Skimmer Carrier feuern. Angriffe auf die Kombination verwenden einen gemeinsamen Würfelwurf, werden aber getrennt gegen Träger und Passagiere ausgewertet
- Der GOBLIN SIEGEBREAKER besitzt einen eigenen Systemzustand für Hauptbatterie, Sekundärbatterien, Raketen, Nahbereichsschutz und 45 Ketteneinheiten. Gegnerische Treffer werden gegen ein einzelnes System ausgewertet; Kettenschäden reduzieren seine Bewegung bei 30, 15 und 0 verbleibenden Kettenpunkten.
- Phasen- und Zugende-Overlays mit optionaler Bestätigungsunterdrückung

## Lokal starten

Im Projektordner:

```powershell
node server.mjs
```

Danach `http://localhost:4173` öffnen.

## Steuerung

- Einheit oder Feld anklicken: Information und Fokusmarker anzeigen
- Eigenes Fahrzeug auswählen, danach ein erreichbares Feld anklicken: bewegen
- In der Feuerphase ein sichtbares Ziel anklicken: feuern
- `F`: nächstes sichtbares Ziel in Reichweite angreifen
- `ESC`: aktive Einheitenauswahl aufheben
- `MOVEMENT RANGE`, `FIRE RANGE`, `LINE OF SIGHT`: Overlay wechseln
- `GRID`: dezentes Hexraster ein-/ausblenden
- `END TURN`: aktuelle Phase beenden bzw. Gegnerzug starten

Nach Sieg oder Niederlage bleibt die Karte samt Combat Log sichtbar. Der Kampf wird nicht automatisch zurückgesetzt; nur `RESTART` startet die Mission neu.

Gegnerische Fahrzeuge können zur Information und zur Anzeige ihrer Bereiche ausgewählt werden. Ein Angriff wird nur durch ein gültiges Ziel in der Feuerphase ausgelöst.

## Regelbasis und Tests

Die verbindliche Regelmatrix steht in [RULE_MATRIX.md](RULE_MATRIX.md). Die zentrale, testbare Regelbasis liegt in [rules.mjs](rules.mjs). Die Content-Abgrenzung, Benennungsstandards und offenen Prüfpunkte für Legal stehen in [CONTENT-CLEARANCE.md](CONTENT-CLEARANCE.md); die öffentlichen Herkunftshinweise in [CONTENT-NOTICES.md](CONTENT-NOTICES.md).

Die aktuellen Regressionstests werden ausgeführt mit:

```powershell
node scripts/verify-release.mjs
node --test tests/*.test.mjs
```

Die Tests decken derzeit Einheitengrundwerte, den G.O.B.L.I.N.-Einheitenkatalog, Plattform-Systemdaten, Hex-Distanzen, Geländekosten, Sichtlinienflags, CRT-Verhältnisse sowie Deaktivierung und Zerstörung ab.

## Versionierung und Tester-Übergabe

Die Versionslinie lautet vorerst `0.1.<Build>`. Jeder Push auf `main`, der über GitHub Pages veröffentlicht wird, benötigt eine höhere Buildnummer in [release.js](release.js), einen passenden Eintrag in [CHANGELOG.md](CHANGELOG.md) und eine aktualisierte Übergabe in [TEST_HANDOFF.md](TEST_HANDOFF.md). Der Pages-Workflow erzwingt diese Bedingungen und führt vor der Veröffentlichung die vollständige Testsuite aus.

Tester geben die sichtbare Version aus der Kopfzeile in jedem Bericht an. Für strukturierte Rückmeldungen steht die GitHub-Issue-Vorlage **Test Report** bereit.

## Bekannte Grenzen

- Die Feuerergebnisse sind noch zufallsbasiert; ein reproduzierbarer Testwürfel fehlt.
- Deckung blockiert derzeit die Sichtlinie, verändert aber noch nicht separat die Verteidigungswerte.
- Die Einheitenwerte sind jetzt im eigenständigen G.O.B.L.I.N.-Katalog erfasst. Die aktive Mission verwendet weiterhin bewusst eine kleinere Prototypauswahl, bis die jeweiligen Sonderregeln integriert sind.
- Plattform-Komponenten, strategische Lenkflugkörper, Nahbereichsgefechte, Engineering, indirektes Feuer und Verstärkungen sind noch nicht vollständig spielbar; Transport ist zunächst auf den Skimmer Carrier begrenzt, bildet dessen grundlegende Bewegungs-, Feuer- und Schadensregeln aber ab.

## Nächste Ausbaustufe

Als Nächstes wird das begonnene GOBLIN-Systemmodell um die aktive Waffenauswahl und mehrere Schüsse pro Feuerphase ergänzt. Danach folgen strategische Lenkflugkörper, Nahbereichsgefechte und Engineering. Jede Stufe erhält eigene Regeltests und einen Szenario-Smoke-Test.
