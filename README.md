# G.O.B.L.I.N — Field Test

Eigenständiger Browser-Prototyp einer rundenbasierten Hexfeld-Taktikmission. G.O.B.L.I.N steht für **Ground Operations, Battlefield Logistics & Intelligence Network** – ein taktisches Einsatznetz für Bodenoperationen, Logistik und Aufklärung. Die Oberfläche und die Einheitenmarker sind als SVG/CSS im Projekt gezeichnet; es werden keine Originalgrafiken oder externen Bilddateien benötigt.

## Start

Im Projektordner den eingebauten Preview-Server starten:

```powershell
node server.mjs
```

Danach `http://localhost:4173` öffnen.

## Spielziel und Steuerung

- Eigene Einheit anklicken, anschließend ein grünes Feld zum Bewegen oder ein rotes Feld zum Feuern anklicken.
- `F` feuert auf das nächstgelegene Ziel in Reichweite.
- `ESC` hebt die Auswahl auf; `END TURN` löst den Gegnerzug aus.
- Die Kartenansicht bietet `MOVEMENT RANGE`, `FIRE RANGE`, `LINE OF SIGHT` und ein optionales `GRID`.
- Der eigene Zug besteht aus Movement-, Fire- und GEV-Zweitbewegungsphase; Einheiten können in den jeweils erlaubten Phasen handeln. `END TURN` startet den Gegnerzug und lädt anschließend alle eigenen Einheiten neu. Der Gegner nutzt seine individuelle Bewegung und kann dabei auch begehbares Deckungsgelände durchqueren.
- Über `SCENARIO` kann zwischen `IRON DUST` und `RELAY RUN` gewechselt werden; dabei werden Karte, Gelände, Einheiten und Missionsbriefing gemeinsam neu geladen.
- Der Kommandokern muss zerstört werden. `RESTART` setzt die Mission zurück.

## Nächste sinnvolle Iteration

Die verbindliche Regelmatrix liegt in [RULE_MATRIX.md](RULE_MATRIX.md). Die ersten mechanischen Regressionstests laufen mit `node --test`.
