# G.O.B.L.I.N — Field Test

G.O.B.L.I.N steht für **Ground Operations, Battlefield Logistics & Intelligence Network**. Dieses Repository enthält einen eigenständigen Browser-Prototypen für eine rundenbasierte Hexfeld-Taktikmission mit eigener UI, SVG-Karte und frei entwickelten Einheitenmarkern.

## Aktueller Stand

Der Prototyp ist spielbar. **0.1.24 / Build 24** wurde nach Nutzerfreigabe unter `v0.1.24` auf Commit `ceaf301c99ec35623dcf3dd323f9a7d7ee69137d` veröffentlicht und auf Pages geprüft (`goblin-bzs`). Diese Version korrigiert die versionierte Zielwahl der historischen Browser-Mission `iron-dust`; Content und Legal fanden im geprüften Delta keine neue Asset- oder Lizenzhürde für die bisherige begrenzte nichtkommerzielle Vorschau. Eine umfassende Regel-, Marken- oder Produktfreigabe folgt daraus nicht. **0.1.23 / Build 23** auf `2748063b83dbb8957d00a7b0f8523753c6b80ae9` bleibt der bisherige Rückfallpunkt (`goblin-gp7`). Lokal ist **0.1.25 / Build 25** als UI-V2-Kandidat vorbereitet; der bisher geprüfte V2-Runtimestand war `56c135457c0384f08c3579af83b7ee3e724cbeba`. Nach Nutzerentscheidung startet V2 im Kandidaten unter der normalen URL ohne `ui`-Parameter; `?ui=v2` funktioniert weiterhin. Der Kandidat ist weder getaggt noch veröffentlicht; seine [Releasevorlage](docs/UI_V2_RELEASE_CANDIDATE.md) hält QA, Grenzen und offene Entscheidungen fest.

Änderungen stehen im [Changelog](CHANGELOG.md), die Prüfaufträge in [Developer → Tester Handoff](reports/TEST_HANDOFF.md). Playtest-, Content- und Legal-Prüfungen werden in der [Berichtsübersicht](reports/REPORTS.md) versioniert. Die 130 kleineren Content-08-WebP-Bilder mit PNG-Fallback aus 0.1.17 bleiben in 0.1.18 unverändert.

Enthalten sind:

- Hexfeldkarte mit zwölf Terrainarten im ATLAS-Showcase: modusspezifische Bewegung, Deckung +1 auf Verteidigung und unterschiedliche Sichtblocker
- Bewegung mit Gelände- und Belegungskosten sowie expliziten Bewegungsmodi für Kettenfahrzeuge, Infanterie, Skimmer und stationäre Einheiten
- getrennte Movement-, Fire- und Skimmer-Manöverphasen
- Einheitliche Spiel-Dialoge für Phasenende, Szenariowechsel und Neustart. Escape bricht ab; Tab und Enter bedienen den Dialog. Spielkürzel und AUTO sind währenddessen gesperrt. „Never ask again“ gilt ausschließlich für das Phasenende. Keine Browser-Messageboxen.
- Taste `L` beim ausgewählten Transporter: ohne Fracht Ladeauswahl wie `+`; mit Fracht Zielfelder zum Entladen der ersten geladenen Einheit anzeigen. Es gelten dieselben Phasenregeln wie beim Klick.
- `BACK` nimmt Befehle der aktuellen Phase einzeln zurück: Bewegung, Feuer, Rammen und Transport inklusive Aktionsstatus und Kampflog. Phasenwechsel und Spielende schließen die Historie ab. AUTO wartet nach dem letzten Befehl zwei Sekunden; mit AUTO aus bleibt Zeit bis zum manuellen Phasenwechsel. Wiederholte Schüsse verwenden denselben gespeicherten Würfelwurf.
- Fire Range und Line-of-Sight-Prüfung. Die acht bisherigen Missionen behalten ihre historische Sichtlinien-Pixelabtastung. Das zusätzliche Supercover-Showcase verwendet `FIELD_TEST_SUPERCOVER_v1`: Berührt die Sichtlinie die Grenze zweier Zwischenhexe, sperrt bereits ein blockierendes Hex den Schuss in beiden Richtungen.
- CRT-Kampfsystem mit NE, D und X sowie expliziten Verteidigungswerten
- Deaktivierung, Wiederherstellung, Zerstörung und sichtbare Wracks
- Goblin-Ramming gegen gegnerische Fahrzeuge
- einfache Gegner-KI mit Bewegung und Feuer
- Szenarien `IRON DUST`, `RELAY RUN`, `UNIT TRIAL` und `ATLAS / PROVING GROUNDS`. ATLAS zeigt alle 26 Einheitentypen; Einheiten-Spezialwerte und Siegbedingung sind dort noch vorläufig. Die Terrainregeln sind implementiert und in der [Regelmatrix](docs/RULE_MATRIX.md) dokumentiert.
- Area-Modi `MOVEMENT RANGE`, `FIRE RANGE`, `LINE OF SIGHT`
- optionales Hex-Grid und oberster Feld-Fokusmarker
- Quick-Start-Guide, Einheitenbibliothek mit 26 Typen, Live-Werten, Aktionsprofil und „Auf Karte“-Funktion sowie kombinierte Feld- und Einheiteninformationen
- Skimmer-Carrier-Transport im Szenario `UNIT TRIAL`: Kapazität wird in Infanterie-Stärkepunkten geführt; Ein-/Aussteigen verbraucht die Infanteriebewegung, nicht die Bewegung des Trägers
- Transportierte Infanterie kann aus dem Skimmer Carrier feuern. Angriffe auf die Kombination verwenden einen gemeinsamen Würfelwurf, werden aber getrennt gegen Träger und Passagiere ausgewertet
- Der GOBLIN SIEGEBREAKER besitzt einen eigenen Systemzustand für Hauptbatterie, Sekundärbatterien, Raketen, Nahbereichsschutz und 45 Ketteneinheiten. Gegnerische Treffer werden gegen ein einzelnes System ausgewertet; Kettenschäden reduzieren seine Bewegung bei 30, 15 und 0 verbleibenden Kettenpunkten.
- In der Fire Phase lassen sich die noch verfügbaren Waffensysteme des Siegebreakers einzeln auswählen und abfeuern. Nicht verbrauchte Batterien halten die Einheit handlungsfähig; Raketenmunition bleibt über Runden hinweg verbraucht.
- Der Strategic Missile Carrier ist in `UNIT TRIAL` spielbar: eine Rakete pro Mission, Angriff 6 auf ein sichtbares Feindziel innerhalb von acht Hexen und Angriff 3 auf alle Einheiten in Nachbarhexen. Friendly Fire ist möglich; `BACK` stellt die Rakete innerhalb der Feuerphase wieder her.
- Kartenmarker werden zentral über [docs/UNIT_VISUALS.md](docs/UNIT_VISUALS.md) konfiguriert. Lokale SVG-, PNG- oder WebP-Dateien können pro stabiler Einheiten-ID ausgetauscht werden, ohne Regeln oder Szenarien zu ändern.
- [Sechs wählbare Grafiksets](assets/unit-art/README.md) mit je 26 kleinen Karten- und Listenicons und getrennten großen Ansichten im Unit Guide. `ICON SET` schaltet beide Größen gemeinsam um. Die fünf grafischen Guide-Sets laden 130 Content-08-WebP-Bilder mit PNG-Fallback; Military nutzt weiterhin getrennte kleine und große SVGs. In 0.1.18 bleibt die laufende Partie beim Wechsel erhalten. Die Wahl wird im Browser gemerkt. Herkunft und Grenzen der Motive stehen im [Unit-Art-Handoff](assets/unit-art/README.md) und in den [Content & Asset Notices](docs/CONTENT-NOTICES.md).
- Vier auswählbare Legacy-Showcases K/U1/U2/U3, mobile Karten-/Truppen-/Intel-Navigation und die Niederlage bei simultaner vollständiger Ausschaltung. Die Showcases nutzen historische Field-Test-Werte; Katalog-Sonderregeln sind nicht vollständig umgesetzt.
- Phasen- und Zugende-Overlays mit optionaler Bestätigungsunterdrückung

## Lokal starten

Im Projektordner:

```powershell
node server.mjs
```

Danach `http://localhost:4173` öffnen.

`index.html`, `release.js` und `server.mjs` liegen im Projektroot. Der lokale Einstieg lädt die integrierten Spielskripte aus dem Projektroot; der ältere Legacy-Pfad unter `src/legacy/` bleibt für seine Referenzen erhalten. Der modulare Pfad liegt unter `src/app/`, `src/core/` und `src/hex-renderer/`. Browser-URLs werden relativ zum jeweiligen HTML-Einstieg aufgelöst.

## Steuerung

- Einheit oder Feld anklicken: Information und Fokusmarker anzeigen
- Eigenes Fahrzeug auswählen, danach ein erreichbares Feld anklicken: bewegen
- In der Feuerphase ein sichtbares Ziel anklicken: feuern
- `F`: nächstes sichtbares Ziel in Reichweite angreifen
- `ESC`: aktive Einheitenauswahl aufheben
- `MOVEMENT RANGE`, `FIRE RANGE`, `LINE OF SIGHT`: Overlay wechseln
- `GRID`: dezentes Hexraster ein-/ausblenden
- `ICON SET`: Stilrichtung für Karte, Listen und Unit Guide gemeinsam wechseln; die laufende Partie bleibt erhalten
- `END TURN`: aktuelle Phase beenden bzw. Gegnerzug starten

Nach Sieg oder Niederlage bleibt die Karte samt Combat Log sichtbar. Der Kampf wird nicht automatisch zurückgesetzt; nur `RESTART` startet die Mission neu.

Gegnerische Fahrzeuge können zur Information und zur Anzeige ihrer Bereiche ausgewählt werden. Ein Angriff wird nur durch ein gültiges Ziel in der Feuerphase ausgelöst.

## Regelbasis und Tests

Die [Dokumentationsübersicht](docs/README.md) bündelt Regeln, Architektur, Gestaltung und Testplanung. Die [Berichtsübersicht](reports/REPORTS.md) führt Playtest-, QA-, Content- und Legal-Befunde.

Die verbindliche Regelmatrix steht in [docs/RULE_MATRIX.md](docs/RULE_MATRIX.md). Die zentrale, testbare Regelbasis liegt in [rules.mjs](rules.mjs). Die Content-Abgrenzung, Benennungsstandards und offenen Prüfpunkte für Legal stehen in [reports/CONTENT-CLEARANCE.md](reports/CONTENT-CLEARANCE.md); die öffentlichen Herkunftshinweise in [docs/CONTENT-NOTICES.md](docs/CONTENT-NOTICES.md).

Die aktuellen Regressionstests werden ausgeführt mit:

```powershell
node scripts/verify-release.mjs
node --test tests/*.test.mjs
```

Die Tests decken unter anderem Szenariostatus, zwölf Terrainregeln, Wasserpassage, Deckungsbonus, Sichtlinie, Kampf, Transport, Undo und die Einheitenbibliothek ab.

## Versionierung und Tester-Übergabe

Die Versionslinie lautet vorerst `0.1.<Build>`. Jeder Push auf `main`, der über GitHub Pages veröffentlicht wird, benötigt eine höhere Buildnummer in [release.js](release.js), einen passenden Eintrag in [CHANGELOG.md](CHANGELOG.md) und eine aktualisierte Übergabe in [reports/TEST_HANDOFF.md](reports/TEST_HANDOFF.md). Der Pages-Workflow erzwingt diese Bedingungen und führt vor der Veröffentlichung die vollständige Testsuite aus.

Tester geben die sichtbare Version aus der Kopfzeile in jedem Bericht an. Für strukturierte Rückmeldungen steht die GitHub-Issue-Vorlage **Test Report** bereit.

## Bekannte Grenzen

- Die Feuerergebnisse sind noch zufallsbasiert; ein reproduzierbarer Testwürfel fehlt.
- ATLAS enthält alle 26 Motive, aber viele Spezialisten verwenden vorläufige Werte und noch keine eigene Sonderaktion; der Unit Guide kennzeichnet geplante Fähigkeiten.
- Weitere strategische Raketenregeln (freies Zielen auf leere Hexfelder), Nahbereichsgefechte, Engineering, indirektes Feuer und Verstärkungen sind noch nicht vollständig spielbar; Transport ist zunächst auf den Skimmer Carrier begrenzt, bildet dessen grundlegende Bewegungs-, Feuer- und Schadensregeln aber ab.

## Nächste Ausbaustufe

Als Nächstes folgen geteiltes Feuer, Engineering und differenzierte Fähigkeiten der schweren Plattformen. Jede Stufe erhält eigene Regeltests und einen Szenario-Smoke-Test.
