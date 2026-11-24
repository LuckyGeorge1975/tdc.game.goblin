# Lokales Autoplay und Feuerzieltraining

Die Werkzeuge laufen mit Node.js **24.14.0** und PowerShell ohne Agenten, Browser, Cloud oder Zeitplan. Sie lernen ausschließlich die bestehende Feuerzielbewertung; Bewegung, Engineering und andere Befehle bleiben Regelentscheidungen. Trainiert bedeutet keinen belegten Spielstärkevorteil. Modelle werden niemals automatisch ins Spiel übernommen.

## Starten

Im Repository, mit auf dem PATH verfügbarem Node:

Die Starter benötigen einen Git-Checkout mit `.git` und tatsächlichem HEAD für die Codebindung; ein reines Source-ZIP genügt nicht.

```powershell
./scripts/Start-AiAutoplay.ps1 -Output './training-runs/Versuch 01' -Seed 12345
./scripts/Start-AiTraining.ps1 -Dataset './training-runs/Versuch 01'
```

Der erste Aufruf sammelt Daten. Der zweite validiert dieselben Aufnahmebelege, trainiert getrennte Sitzmodelle mit Validation/EarlyStopping, friert ihre Bytes ein und startet **automatisch weitere Prüfspiele aus dem vorab reservierten Budget**. Eine Epoche verarbeitet alle Trainingspaare; Updates werden getrennt gezählt. `DATA_INSUFFICIENT` und `NO_IMPROVEMENT` sind echte fachliche Ergebnisse. Ein positiver kleiner Versuch ist ebenfalls kein allgemeiner Stärkenachweis.

Standard: maximal **1000 tatsächliche Spielstarts insgesamt**, höchstens 700 Datenspiele und 300 reservierte Prüfspiele, höchstens 5000 Epochen, Patience 50. Referenzen, Einzelinterventionen und wiederholte Versuche zählen zum selben Budget. Replays zur Integritätsprüfung sind keine neuen Spiele und werden nicht als unabhängige Stichproben ausgegeben. Pro Datenfamilie sind eine Referenz und höchstens eine Intervention je Sitz vorgesehen. Technische Limits erhalten kein Sieg-/Remis-/Niederlagenlabel.

Für kleine Funktionsproben eine JSON-Konfiguration verwenden, beispielsweise:

```json
{"maxGames":18,"evaluationGames":3,"masterSeed":12345,"workers":1,"maxEpochs":20,"patience":5,"strategies":["medium"],"commandLimit":300,"roundLimit":30}
```

```powershell
./scripts/Start-AiAutoplay.ps1 -Config './probe.json' -LevelDirectory './kleiner Levelpool' -Output './training-runs/Probe'
./scripts/Start-AiTraining.ps1 -Dataset './training-runs/Probe' -MaxEpochs 20
```

Das ist ein Budgetbeispiel, kein Versprechen ausreichender Daten. Auch neutrale Paare bleiben neutral. Die Epochenobergrenze wird vor der Datensammlung gebunden. `-MaxEpochs` am zweiten Starter kann vor dem **ersten Fit** einen kleineren Wert wählen; diese tatsächliche Fitpolicy wird vorher unveränderlich festgehalten. Resume verwendet dieselbe Policy, nicht nachträglich gewählte Hyperparameter. Neue Datensammlung oder andere Rahmenkonfiguration: neuer Runordner. Andere Parameter: `-MaxGames`, `-EvaluationGames` (positives Vielfaches von drei), `-Seed`, `-Workers 1`, optional `-NodePath 'C:/Pfad mit Leerzeichen/node.exe'`. Explizite PS-Parameter überschreiben die entsprechenden Configfelder nur vor einem neuen Lauf.

## Karten ohne Codeänderung

Standardpool: `training-levels/`. Beliebige andere Ordner über `-LevelDirectory` oder Configfeld `levelDirectory` (relativ zur Configdatei) angeben. Die Discovery liest **rekursiv alle `.json`-Dateien** und sortiert deterministisch: einzelne aktuelle `goblin-level-v3`-Level mit stabiler `id`/`scenarioVersion` oder `goblin-level-package-v3` mit `levels`. Aus JSON wird kein Skript ausgeführt. Native Validierung entscheidet über Regeln, Positionen, erlaubte KI-Belegung und Mindeststufe. Symlinks, ungültige/inkompatible Level, doppelte IDs und leere Pools brechen vor dem ersten Spiel ab. Keine Tutorials/Menschen im Autoplay.

Eine Datei hinzufügen oder entfernen genügt für den **nächsten neuen Run**. Es gibt keine ID- oder Kartenzahlliste im Runner. Nicht ein Paket und dieselben Einzelkarten zusammen ablegen: gleiche IDs sind ein Fehler. Ein gestarteter Run bewahrt die Leveldaten und Dateihashes in `manifest.json`; Resume liest diesen Snapshot und ändert seinen Kartenpool nicht nachträglich. Die mitgelieferten zwölf Einzelkarten stammen aus den vorhandenen vier Trainingskarten und dem gesonderten Levelhandoff vom 24.11.2026, nicht aus einer laufzeitabhängigen `.tools`-Quelle.

Karten werden in zufällig gemischten, gleichmäßig belegten Decks gewählt; innerhalb jeder Karte rotieren ihre erlaubten Strategiepaare gleichmäßig. Der Masterseed wird vor dem ersten Spiel gebunden. TRAIN/VALIDATION-Familien und spätere Prüfseeds sind getrennt; keine einzelne Alternative wird von ihrer Referenzfamilie getrennt. Einen bereits verwendeten Prüfseed nicht nach wiederholter Optimierung als unabhängigen neuen Test ausgeben.

Alle vier nativen Strategien dürfen Originalpartien spielen. Der vorhandene native Scopeguard des trainierten Spielers bleibt unangetastet. Dieses erste Werkzeugpaket bietet Feuerinterventionen und Modelloverlays auf dem **kontrollierten** Sitz nur für Gering, Mittel und Stark. Kontrolliert Trainiert bleibt eine echte Originalaufnahme und wird im Journal sichtbar als `UNSUPPORTED_CONTROLLED_STRATEGY` für Paarbildung übersprungen; sein Spielstart zählt. Trainiert kann weiterhin der unveränderte Gegner eines gültigen Eingriffs sein. In der reservierten Evaluation werden nur unterstützte Kandidatensitze geplant, bei gemischten Paarungen gegebenenfalls nur ein Kandidatenarm statt zwei. Es gibt keinen heimlichen Ersatz durch Mittel. Ein Pool, dessen Mindeststufen nur nicht unterstützte Trainingssitze erlauben, kann deshalb regulär `DATA_INSUFFICIENT` liefern.

## Stop, Status und Resume

```powershell
node ./scripts/ai-train.mjs status --output './training-runs/Versuch 01'
node ./scripts/ai-train.mjs stop --output './training-runs/Versuch 01'
./scripts/Start-AiAutoplay.ps1 -Output './training-runs/Versuch 01' -Resume
./scripts/Start-AiTraining.ps1 -Dataset './training-runs/Versuch 01' -Resume
node ./scripts/ai-train.mjs verify --output './training-runs/Versuch 01'
```

Ctrl+C und die Stopdatei stoppen eigene Kindprozesse. Ein teilweise aufgenommenes Spiel wird nicht nachträglich vervollständigt oder umetikettiert: neuer Attemptordner, derselbe Fall/Seed, erneuter Budgetverbrauch. Vollständige Belege werden erneut geprüft und einmal gezählt. Ein exklusives Controllerlock verhindert Doppelwriter; ein noch lebender alter Controller oder Kindprozess blockiert die Übernahme. Verwaiste Sperren werden nur beim expliziten Resume und nach dieser Lebendigkeitsprüfung entfernt. Originalfragmente bleiben erhalten. Bei geänderten Quellen, Konfiguration, Modellbytes oder Aufnahmedaten meldet die Prüfung einen Fehler.

Erste Version: bewusst **ein äußerer Worker**, auch für den internen Strong-Trainingspool ein Worker, keine versteckte Parallelität. `maxHeapMb` (Standard 1024) begrenzt den Node-Heap je Match; `minFreeMemoryMb` und `minFreeDiskMb` (jeweils Standard 512) prüfen freien RAM beziehungsweise Plattenplatz vor neuen Spielen. Das ist keine harte Gesamtprozess-RAM-Garantie. Große Karten und Regel Stark können lange rechnen. CPU/Wallzeit der Spiele und Controller stehen getrennt in den Belegen; Browseranimationen laufen hier nicht. Keine zugesicherte Fünfsekundenantwort.

`status.json` ist die aktuelle Ansicht, `journal/` das atomare verkettete Jobjournal, `attempts/` enthält unveränderte Aufnahmen, `fit/` die gebundenen Checkpoints/Modelle. `report.json` und `report.html` dokumentieren das Ergebnis, gültige Vergleichszahl, technische Fälle, Modellfreeze und Budget. Fehlercodes sind Nichtnull-Exitcodes; fachlich negative Ergebnisse stehen im Report und sind kein behaupteter Trainingsfehler.
