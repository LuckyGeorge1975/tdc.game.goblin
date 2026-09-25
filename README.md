# G.O.B.L.I.N — Field Test

G.O.B.L.I.N steht für **Ground Operations, Battlefield Logistics & Intelligence Network**. Dieses Repository enthält einen eigenständigen Browser-Prototypen für eine rundenbasierte Hexfeld-Taktikmission mit eigener UI, SVG-Karte und frei entwickelten Einheitenmarkern.

## Aktueller Stand

Der Prototyp ist spielbar und auf [GitHub Pages](https://luckygeorge1975.github.io/tdc.game.goblin/) veröffentlicht.

Enthalten sind:

- Hexfeldkarte mit offenem Gelände sowie Berg-/Trümmerfeldern
- Bewegung mit Gelände- und Belegungskosten
- getrennte Movement-, Fire- und GEV-Zweitbewegungsphasen
- Fire Range und Line-of-Sight-Prüfung
- CRT-Kampfsystem mit NE, D und X sowie expliziten Verteidigungswerten
- Deaktivierung, Wiederherstellung, Zerstörung und sichtbare Wracks
- Goblin-Ramming gegen gegnerische Fahrzeuge
- einfache Gegner-KI mit Bewegung und Feuer
- Szenarien `IRON DUST`, `RELAY RUN` und `UNIT TRIAL`
- Area-Modi `MOVEMENT RANGE`, `FIRE RANGE`, `LINE OF SIGHT`
- optionales Hex-Grid und oberster Feld-Fokusmarker
- Einheiten-Guide mit Basis- und Erweiterungseinheiten sowie kombinierte Feld- und Einheiteninformationen
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

Die verbindliche Regelmatrix steht in [RULE_MATRIX.md](RULE_MATRIX.md). Die zentrale, testbare Regelbasis liegt in [rules.mjs](rules.mjs). Die aktuellen Regressionstests werden ausgeführt mit:

```powershell
node --test tests/rules.test.mjs
```

Die Tests decken derzeit Einheitengrundwerte, den kanonischen Einheitenkatalog, Oger-Systemdaten, Hex-Distanzen, Geländekosten, Sichtlinienflags, CRT-Verhältnisse sowie Deaktivierung und Zerstörung ab.

## Bekannte Grenzen

- Die Feuerergebnisse sind noch zufallsbasiert; ein reproduzierbarer Testwürfel fehlt.
- Deckung blockiert derzeit die Sichtlinie, verändert aber noch nicht separat die Verteidigungswerte.
- Die kanonischen Einheitenwerte sind jetzt katalogisiert. Die aktive Mission verwendet weiterhin bewusst eine kleinere Prototypauswahl, bis die jeweiligen Sonderregeln integriert sind.
- Oger-Komponenten, Transport, Cruise Missiles, Overrun, Engineering, indirektes Feuer und Verstärkungen sind noch nicht vollständig spielbar.

## Nächste Ausbaustufe

Als Nächstes werden die katalogisierten Einheiten schrittweise spielbar gemacht: zuerst Verteidigungswerte und unterschiedliche Bewegungsmodi, danach Transport/Infanterie, Oger-Komponenten und Engineering. Jede Stufe erhält eigene Regeltests und einen Szenario-Smoke-Test.