# G.O.B.L.I.N. — Field Test

G.O.B.L.I.N. steht für **Ground Operations, Battlefield Logistics & Intelligence Network**. Der Browserprototyp ist ein rundenbasiertes Taktikspiel auf einer Hexkarte. Versionsbasis ist [v0.1.32](CHANGELOG.md#0132---2026-11-22).

![FULL Atlas Proving Grounds, Build 32, Zug 1 in der Bewegungsphase](docs/images/field-test-0.1.32-full-atlas.webp)

[Herkunft und Prüfung der Aufnahme aus Build 32](reports/TEST_HANDOFF.md#readme-aufnahme-build-32)

## Lokal starten

```powershell
node server.mjs
```

Danach [localhost:4173](http://localhost:4173) öffnen. Der Spieleinstieg ist `index.html`. Das Repository enthält die zum Spielen benötigten Assetableitungen. Build und Spiel laden keine Dateien aus dem privaten Content-Repository.

## Spielen

- **Levelwahl.** FULL Atlas Proving Grounds und vier symmetrische Missionen ergänzen die bestehenden Vollkatalog-Missionen. Die Levelwahl bietet außerdem Iron Dust V2, Kampagnen und Showcases. Jede Mission verwendet ihr zugelassenes Regelprofil.
- **Kampagnen und Tutorial.** Relay Line enthält zwei, Scorched Earth zwölf Missionen. Das Tutorial in der Startansicht führt durch T01 und T02. T03 ist als eigene Lektion in der Levelwahl verfügbar.
- **Sitzwahl und Rundenanalyse.** Vorhandene FULL-Sitze bieten Mensch sowie die zugelassenen Stufen Gering, Mittel, Stark und Trainiert; Tutorials bleiben für Menschen. Trainiert ist eine bestehende experimentelle Strategie, kein Nachweis höherer Spielstärke. Die Spieleransicht gibt nur sichtbare Ereignisse frei. Zuschauer und die Auswertung nach Missionsende können die aufgezeichneten Entscheidungen einsehen.
- **Editor und eigene Level.** Der Editor kann eine Mission vorbereiten und im Browser speichern. Austauschformat sind `goblin-level-v3` und Pakete im Format `goblin-level-package-v3`. Die Levelwahl öffnet gespeicherte Missionen unter »Eigene Level«.
- **Befehle.** Einheit auswählen, Aktion wählen, ein Ziel prüfen und ausführen. Das Spiel zeigt nur die im jeweiligen Regelprofil verfügbaren Befehle. Bewegungs-, Feuer- und Skimmer-Manöverphasen setzen ihren jeweiligen Befehlsraum.

## Regeln, Tests und Build

Lokales Autoplay und Feuerzieltraining starten über `scripts/Start-AiAutoplay.ps1` und `scripts/Start-AiTraining.ps1`. Der [Werkzeugleitfaden](docs/AI-TRAINING.md) beschreibt den dynamischen Levelordner, Gesamtbudget, Stop/Resume und die Modellgrenzen. Diese Werkzeuge führen keine automatische Produktübernahme durch.

Regel Stark kann auf großen Karten lange rechnen. Eine allgemeine Antwortzeit ist nicht zugesichert. Die Auswahl Trainiert bedeutet keinen nachgewiesenen Spielstärkevorteil; die neu untersuchten Trainingsmodelle werden nicht übernommen.

Die [Projektdokumentation](docs/README.md) führt die [Regelmatrix](docs/RULE_MATRIX.md), die Architektur und die aktuellen Herkunftshinweise. [Content & Asset Notices](docs/CONTENT-NOTICES.md) dokumentiert die verwendeten Grafiken und Modelle.

```powershell
node scripts/verify-release.mjs
node scripts/run-tests.mjs
node scripts/run-tests.mjs --slow
```

Die erste Testsuite prüft unter anderem native Befehle, Sitzübergabe, Tutorial und Editor. Die langsame Suite enthält aufgezeichnete Produkt-Replays. Für beide zusammen dient `node scripts/run-tests.mjs --all`. Trainingslektionen und Skripte liegen unter `assets/training/`. Aufgezeichnete Befehle werden mit den zugehörigen Profilen und Checkpoints geprüft.

[Changelog](CHANGELOG.md) und [Test-Handoff](reports/TEST_HANDOFF.md) ordnen Version und Prüfumfang zu. GitHub Pages prüft den Build vor der Bereitstellung. `scripts/package-itch.py` baut ein HTML5-Paket aus einem gepinnten Release-Tag.
